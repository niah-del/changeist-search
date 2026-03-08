import { supabase } from '../../lib/supabase';
import { searchOpportunities } from '../../lib/search';
import { logEvent, geoFromRequest } from '../../lib/analytics';

/**
 * GET /api/search?q=<query>&key=<embed_key>
 *
 * Returns ranked results:
 *   priority 0 — internal Changeist listings (always on top)
 *   priority 1 — sponsored/paid listings (paid advertisers)
 *   priority 2 — web results from Google CSE
 *
 * Requires a valid embed key passed as ?key= (or omit for changeist.org's own key).
 * Changeist.org can use key=internal (set INTERNAL_EMBED_KEY env var to "internal").
 */
export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, key, type, location } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Missing search query (q)' });
  }

  // --- Validate embed key ---
  const internalKey = process.env.INTERNAL_EMBED_KEY || 'changeist-internal';
  if (!key) {
    return res.status(401).json({ error: 'Missing API key (key)' });
  }

  let embed_key_id = null;
  if (key !== internalKey) {
    const { data: keyRow, error: keyError } = await supabase
      .from('embed_keys')
      .select('id, is_active')
      .eq('key', key)
      .single();

    if (keyError || !keyRow || !keyRow.is_active) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }
    embed_key_id = keyRow.id;
  }

  const results = await searchOpportunities({ query: q.trim(), type: type || '', location: location || '' });

  logEvent('search', {
    query: q.trim(),
    result_count: results.length,
    opportunity_type: type || null,
    embed_key_id,
    ...geoFromRequest(req),
  });

  return res.status(200).json({
    query: q.trim(),
    total: results.length,
    results,
  });
}
