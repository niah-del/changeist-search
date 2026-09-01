import { logEvent } from './analytics';

/**
 * Web search via Serper.dev (real Google results).
 * Docs: https://serper.dev/api-reference
 * Sign up at https://serper.dev to get your API key (2,500 free queries).
 */
// The value shipped in .env.example. Seeing it at runtime means the key was
// never filled in — worth calling out by name, because it fails exactly like a
// revoked key (403) and sends you looking at your Serper billing instead.
const PLACEHOLDER_KEY = 'your-serper-api-key';

/**
 * Record a Serper outage so it is visible instead of silent.
 *
 * Every failure path in this file returns [] so search keeps working on
 * internal listings alone. That is the right behaviour for the user and the
 * wrong behaviour for whoever is running the service: web results simply stop,
 * with nothing in the logs and nothing in the dashboard. This makes the failure
 * loud in both places.
 */
async function reportSerperFailure(reason, query) {
  console.error(
    `[serper] WEB RESULTS DISABLED — ${reason}. ` +
    `Every search is now returning internal listings only. Query: ${JSON.stringify(query)}`,
  );
  try {
    await logEvent('serper_error', { query: `${reason}: ${query}`.slice(0, 500) });
  } catch (err) {
    console.error('[serper] could not record the failure event', err);
  }
}

export async function googleSearch(query, maxResults = 10, type = '', userAge = null) {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey || apiKey === PLACEHOLDER_KEY) {
    await reportSerperFailure(
      !apiKey ? 'SERPER_API_KEY is not set' : 'SERPER_API_KEY is still the .env.example placeholder',
      query,
    );
    return [];
  }

  // Job aggregator sites blocked for safety — traffickers use these to post fake listings.
  // Only direct organization/employer sites are allowed.
  const BLOCKED_DOMAINS = [
    'indeed.com', 'linkedin.com', 'glassdoor.com', 'ziprecruiter.com',
    'monster.com', 'careerbuilder.com', 'simplyhired.com', 'snagajob.com',
    'wayup.com', 'internships.com', 'chegg.com', 'collegegrad.com',
    'joblist.com', 'talent.com', 'jooble.org', 'jobrapido.com',
    'nexxt.com', 'jobs.com', 'lensa.com', 'adzuna.com',
  ];

  // Build a focused query that targets the right type of opportunity,
  // explicitly excluding blocked domains from Google results
  const typeTerms = {
    volunteer: 'volunteer opportunities',
    job: 'job openings',
    internship: 'internship program',
    event: 'community event',
  };
  const typeSuffix = typeTerms[type] || 'volunteer job internship opportunities';
  const siteExclusions = BLOCKED_DOMAINS.map(d => `-site:${d}`).join(' ');

  // Append age-appropriate terms so Google surfaces youth-friendly results
  let ageSuffix = '';
  if (userAge !== null && userAge < 18) {
    ageSuffix = userAge < 14
      ? 'for middle school students youth'
      : 'for high school students teens';
  }

  const focusedQuery = `${query} ${typeSuffix}${ageSuffix ? ' ' + ageSuffix : ''} ${siteExclusions}`;

  let res;
  try {
    res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: focusedQuery,
        num: Math.min(maxResults, 10),
      }),
    });
  } catch (err) {
    // Network-level failure. Previously this threw straight through to the
    // caller and surfaced to the user as a generic chat error.
    await reportSerperFailure(`network error (${err?.message || err})`, query);
    return [];
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const hint = res.status === 403 ? ' — key rejected: check it is valid and matches the Serper dashboard'
               : res.status === 429 ? ' — rate limited or out of credits'
               : '';
    await reportSerperFailure(`HTTP ${res.status}${hint}. ${body.slice(0, 200)}`, query);
    return [];
  }

  const data = await res.json();
  const items = data.organic || [];

  // Secondary filter: drop any blocked domains that still slipped through
  const filtered = items.filter(item => {
    try {
      const hostname = new URL(item.link).hostname.replace('www.', '');
      return !BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
    } catch {
      return false;
    }
  });

  return filtered.map((item) => ({
    id: item.link,
    title: item.title,
    organization: item.displayLink || new URL(item.link).hostname,
    description: item.snippet,
    url: item.link,
    type: type || null,
    location: null,
    priority: 2,
    source: 'web',
  }));
}
