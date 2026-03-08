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

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalSearches },
    { count: totalChatStarts },
    { data: queryRows },
    { data: geoRows },
    { data: dayRows },
    { data: sessionRows },
    { data: reportRows },
  ] = await Promise.all([
    supabase.from('search_events').select('*', { count: 'exact', head: true })
      .eq('event_type', 'search').gte('created_at', since),
    supabase.from('search_events').select('*', { count: 'exact', head: true })
      .eq('event_type', 'chat_start').gte('created_at', since),
    supabase.from('search_events').select('query')
      .eq('event_type', 'search').gte('created_at', since).not('query', 'is', null),
    supabase.from('search_events').select('country, region')
      .gte('created_at', since).not('country', 'is', null),
    supabase.from('search_events').select('created_at, event_type')
      .gte('created_at', since),
    supabase.from('search_events').select('duration_seconds, message_count')
      .eq('event_type', 'session_end').gte('created_at', since),
    supabase.from('reports').select('id, user_message, assistant_message, country, created_at')
      .order('created_at', { ascending: false }).limit(50),
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

  // By country
  const countryCounts = {};
  (geoRows || []).forEach(r => {
    if (r.country) countryCounts[r.country] = (countryCounts[r.country] || 0) + 1;
  });
  const by_country = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([country, count]) => ({ country, count }));

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
    period: 'last_30_days',
    totals: {
      searches:              totalSearches || 0,
      chat_starts:           totalChatStarts || 0,
      completed_sessions:    durations.length,
    },
    avg_session_duration_seconds: avg(durations),
    avg_messages_per_session:     avg(msgCounts),
    top_queries,
    by_country,
    by_day,
    reports:                reportRows || [],
  });
}
