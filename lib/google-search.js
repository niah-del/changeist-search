/**
 * Web search via Serper.dev (real Google results).
 * Docs: https://serper.dev/api-reference
 * Sign up at https://serper.dev to get your API key (2,500 free queries).
 */
export async function googleSearch(query, maxResults = 10, type = '') {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    console.warn('SERPER_API_KEY not configured — skipping web results');
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
  const focusedQuery = `${query} ${typeSuffix} ${siteExclusions}`;

  const res = await fetch('https://google.serper.dev/search', {
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

  if (!res.ok) {
    console.error('Serper error:', res.status, await res.text());
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
