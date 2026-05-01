import { supabase } from '../../lib/supabase';

/**
 * GET /api/analytics?secret=<ADMIN_SECRET>
 * Returns anonymous usage metrics for the last 30 days.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.query.secret || (req.headers.authorization || '').replace('Bearer ', '');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const month = parseInt(req.query.month) || (now.getUTCMonth() + 1);
  const year  = parseInt(req.query.year)  || now.getUTCFullYear();
  const since = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const until = new Date(Date.UTC(year, month, 1)).toISOString(); // exclusive: first of next month

  const [
    { count: totalSearches },
    { count: totalChatStarts },
    { data: queryRows },
    { data: geoRows },
    { data: usCityRows },
    { data: dayRows },
    { data: sessionRows },
    { data: ageRows },
    { data: reportRows },
    { data: oppTypeRows },
  ] = await Promise.all([
    supabase.from('search_events').select('*', { count: 'exact', head: true })
      .eq('event_type', 'search').gte('created_at', since).lt('created_at', until),
    supabase.from('search_events').select('*', { count: 'exact', head: true })
      .eq('event_type', 'chat_start').gte('created_at', since).lt('created_at', until),
    supabase.from('search_events').select('query')
      .eq('event_type', 'search').gte('created_at', since).lt('created_at', until).not('query', 'is', null),
    supabase.from('search_events').select('country, region')
      .gte('created_at', since).lt('created_at', until).not('country', 'is', null),
    supabase.from('search_events').select('city, country')
      .gte('created_at', since).lt('created_at', until).not('city', 'is', null),
    supabase.from('search_events').select('created_at, event_type')
      .gte('created_at', since).lt('created_at', until),
    supabase.from('search_events').select('duration_seconds, message_count')
      .eq('event_type', 'session_end').gte('created_at', since).lt('created_at', until),
    supabase.from('search_events').select('age')
      .eq('event_type', 'age_mention').gte('created_at', since).lt('created_at', until).not('age', 'is', null),
    supabase.from('reports').select('id, user_message, assistant_message, country, created_at')
      .gte('created_at', since).lt('created_at', until).order('created_at', { ascending: false }).limit(50),
    supabase.from('search_events').select('opportunity_type')
      .eq('event_type', 'search').gte('created_at', since).lt('created_at', until).not('opportunity_type', 'is', null),
  ]);

  // Top search queries
  const queryCounts = {};
  (queryRows || []).forEach(r => {
    const q = r.query?.toLowerCase().trim();
    if (q) queryCounts[q] = (queryCounts[q] || 0) + 1;
  });
  const top_queries = Object.entries(queryCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([query, count]) => ({ query, count }));

  // Age distribution
  const ageBuckets = { '10–17': 0, '18–24': 0, '25–34': 0, '35–44': 0, '45–54': 0, '55+': 0 };
  (ageRows || []).forEach(r => {
    const a = r.age;
    if (a >= 10 && a <= 17)      ageBuckets['10–17']++;
    else if (a >= 18 && a <= 24) ageBuckets['18–24']++;
    else if (a >= 25 && a <= 34) ageBuckets['25–34']++;
    else if (a >= 35 && a <= 44) ageBuckets['35–44']++;
    else if (a >= 45 && a <= 54) ageBuckets['45–54']++;
    else if (a >= 55)            ageBuckets['55+']++;
  });
  const age_distribution = Object.entries(ageBuckets).map(([range, count]) => ({ range, count }));

  // US cities — filter by country in JS to handle both 'us' and 'US' stored values
  const usCityCounts = {};
  (usCityRows || []).forEach(r => {
    if (r.city && r.country && r.country.toUpperCase() === 'US') {
      usCityCounts[r.city] = (usCityCounts[r.city] || 0) + 1;
    }
  });
  const us_cities = Object.entries(usCityCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([city, count]) => ({ city, count }));

  // By country
  const countryCounts = {};
  (geoRows || []).forEach(r => {
    if (r.country) countryCounts[r.country] = (countryCounts[r.country] || 0) + 1;
  });
  const by_country = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([country, count]) => ({ country, count }));

  // By region
  const regionCounts = {};
  (geoRows || []).forEach(r => {
    if (r.region) regionCounts[r.region] = (regionCounts[r.region] || 0) + 1;
  });
  const by_region = Object.entries(regionCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([region, count]) => ({ region, count }));

  // Opportunity type distribution
  const oppTypeCounts = {};
  (oppTypeRows || []).forEach(r => {
    if (r.opportunity_type) oppTypeCounts[r.opportunity_type] = (oppTypeCounts[r.opportunity_type] || 0) + 1;
  });
  const by_opportunity_type = Object.entries(oppTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  // Events by day
  const dayCounts = {};
  (dayRows || []).forEach(r => {
    const day = r.created_at?.slice(0, 10);
    if (day) dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  const by_day = Object.entries(dayCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  // Session stats
  const durations = (sessionRows || []).map(r => r.duration_seconds).filter(n => n != null);
  const msgCounts = (sessionRows || []).map(r => r.message_count).filter(n => n != null);
  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  return res.status(200).json({
    period: { month, year },
    totals: {
      searches:           totalSearches || 0,
      chat_starts:        totalChatStarts || 0,
      completed_sessions: durations.length,
    },
    avg_session_duration_seconds: avg(durations),
    avg_messages_per_session:     avg(msgCounts),
    top_queries,
    age_distribution,
    by_opportunity_type,
    by_country,
    by_region,
    us_cities,
    by_day,
    reports: reportRows || [],
  });
}
