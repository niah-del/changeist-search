import { supabase } from './supabase';
import { googleSearch } from './google-search';

/**
 * Core search logic shared by /api/search and /api/chat.
 * @param {object} params
 * @param {string} params.query
 * @param {string} [params.type]
 * @param {string} [params.location]
 * @returns {Promise<Array>} ranked results array
 */
export async function searchOpportunities({ query, type = '', location = '', embedKeyId = null, userAge = null }) {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
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

  const internalResults = (dbListings || [])
    .filter((l) => l.priority === 0)
    .map((l) => ({ ...l, source: 'internal' }));

  const sponsoredResults = (dbListings || [])
    .filter((l) => l.priority === 1)
    .map((l) => ({ ...l, source: 'sponsored' }));

  let webResults = await googleSearch(query, 10, type || '', userAge);

  // Hard-filter web results for underage users — drop anything with college-level signals
  if (userAge !== null && userAge < 18) {
    const adultSignals = [
      /\bcollege\b/i, /\buniversity\b/i, /\bundergrad(uate)?\b/i,
      /\bgraduate\s+student\b/i, /\bmaster'?s\b/i, /\bphd\b/i,
      /\bbachelor'?s\b/i, /\bdegree\s+required\b/i,
      /\bsophomore\b/i, /\bjunior\b/i, /\bsenior\b/i,
      /\bmust\s+be\s+(?:at\s+least\s+)?1[89]\b/i,
      /\b(?:18|21)\+\b/i, /\bage\s+(?:18|21)\b/i,
    ];
    webResults = webResults.filter(r => {
      const text = `${r.title || ''} ${r.description || ''}`;
      return !adultSignals.some(pattern => pattern.test(text));
    });
  }

  // Log impressions for all DB listings (fire-and-forget)
  const dbMatches = [...internalResults, ...sponsoredResults];
  if (dbMatches.length > 0) {
    const impressionRows = dbMatches.map(l => ({
      listing_id: l.id,
      event_type: 'impression',
      query: query,
      embed_key_id: embedKeyId,
    }));
    supabase.from('listing_events').insert(impressionRows).then(({ error }) => {
      if (error) console.error('[listing_events impression]', error);
    });
  }

  return [...internalResults, ...sponsoredResults, ...webResults];
}
