import { supabase } from './supabase';
import { googleSearch } from './google-search';
import { meaningfulTokens } from './tokens.mjs';

// Signals that a result is aimed at college students or adults. Used to drop
// web results for under-18 users on every path that reaches the open web.
const ADULT_SIGNALS = [
  /\bcollege\b/i, /\buniversity\b/i, /\bundergrad(uate)?\b/i,
  /\bgraduate\s+student\b/i, /\bmaster'?s\b/i, /\bphd\b/i,
  /\bbachelor'?s\b/i, /\bdegree\s+required\b/i,
  /\bsophomore\b/i, /\bjunior\b/i, /\bsenior\b/i,
  /\bmust\s+be\s+(?:at\s+least\s+)?1[89]\b/i,
  /\b(?:18|21)\+\b/i, /\bage\s+(?:18|21)\b/i,
];

/**
 * Hard-filter web results for underage users — drop anything with
 * college-level or adults-only signals. Exported so every path that reaches
 * the open web (opportunity search AND follow-up research) applies it.
 * @param {Array} results
 * @param {number|null} userAge
 */
export function filterAdultResults(results, userAge) {
  if (userAge === null || userAge >= 18) return results;
  return results.filter((r) => {
    const text = `${r.title || ''} ${r.description || ''}`;
    return !ADULT_SIGNALS.some((pattern) => pattern.test(text));
  });
}

/**
 * Count how many distinct query tokens a listing actually matches.
 * Used to rank within a priority tier so the most relevant listing leads,
 * rather than whatever order Postgres happened to return.
 */
function relevanceScore(listing, tokens) {
  const haystack = [
    listing.title,
    listing.description,
    listing.organization,
    listing.location,
    (listing.tags || []).join(' '),
  ].join(' ').toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score++;
    // Title matches count double — they're the strongest relevance signal.
    if ((listing.title || '').toLowerCase().includes(token)) score++;
  }
  return score;
}

/**
 * Core search logic shared by /api/search and /api/chat.
 * @param {object} params
 * @param {string} params.query
 * @param {string} [params.type]
 * @param {string} [params.location]
 * @returns {Promise<Array>} ranked results array
 */
export async function searchOpportunities({ query, type = '', location = '', embedKeyId = null, userAge = null }) {
  const tokens = meaningfulTokens(query);
  const tokenFilters = tokens.flatMap((token) => [
    `title.ilike.%${token}%`,
    `description.ilike.%${token}%`,
    `organization.ilike.%${token}%`,
    `location.ilike.%${token}%`,
    `tags.cs.{${token}}`,
  ]);

  let dbQuery = supabase
    .from('listings')
    .select('id, title, organization, description, type, location, url, priority, tags, age_min, age_max, expires_at, location_requirement, experience_required, youth_gains, participation_cost')
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .or(tokenFilters.join(','))
    .order('priority', { ascending: true })
    .limit(20);

  if (type) dbQuery = dbQuery.eq('type', type);
  if (location) dbQuery = dbQuery.ilike('location', `%${location}%`);

  // Hard-filter by age at the DB level when user age is known
  if (userAge !== null) {
    dbQuery = dbQuery
      .or(`age_min.is.null,age_min.lte.${userAge}`)
      .or(`age_max.is.null,age_max.gte.${userAge}`);
  }

  const { data: dbListings, error: dbError } = await dbQuery;
  if (dbError) console.error('Supabase query error:', dbError);

  // Within a priority tier, lead with the listing that matches the most of
  // what the user actually asked for.
  const byRelevance = (a, b) => relevanceScore(b, tokens) - relevanceScore(a, tokens);

  const internalResults = (dbListings || [])
    .filter((l) => l.priority === 0)
    .sort(byRelevance)
    .map((l) => ({ ...l, source: 'internal' }));

  const sponsoredResults = (dbListings || [])
    .filter((l) => l.priority === 1)
    .sort(byRelevance)
    .map((l) => ({ ...l, source: 'sponsored' }));

  const webResults = filterAdultResults(
    await googleSearch(query, 10, type || '', userAge),
    userAge,
  );

  // Log impressions for all DB listings.
  // Awaited: serverless functions are frozen once the response is sent, so an
  // un-awaited insert here is silently dropped a meaningful share of the time.
  const dbMatches = [...internalResults, ...sponsoredResults];
  if (dbMatches.length > 0) {
    const impressionRows = dbMatches.map(l => ({
      listing_id: l.id,
      event_type: 'impression',
      query: query,
      embed_key_id: embedKeyId,
    }));
    const { error: impressionError } = await supabase
      .from('listing_events')
      .insert(impressionRows);
    if (impressionError) console.error('[listing_events impression]', impressionError);
  }

  return [...internalResults, ...sponsoredResults, ...webResults];
}
