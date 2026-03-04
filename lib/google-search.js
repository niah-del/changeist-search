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

  // Build a focused query that targets the right type of opportunity
  const typeTerms = {
    volunteer: 'volunteer opportunities',
    job: 'job openings',
    internship: 'internship program',
    event: 'community event',
  };
  const typeSuffix = typeTerms[type] || 'volunteer job internship opportunities';
  const focusedQuery = `${query} ${typeSuffix}`;

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

  return items.map((item) => ({
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
