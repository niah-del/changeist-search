import { supabase } from '../../lib/supabase';
import { geoFromRequest } from '../../lib/analytics';

/**
 * POST /api/report
 * Body: { key, user_message, assistant_message }
 * Saves a flagged response to the reports table.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, user_message, assistant_message } = req.body || {};
  if (!key) return res.status(401).json({ error: 'Missing API key' });

  const internalKey = process.env.INTERNAL_EMBED_KEY || 'changeist-internal';
  let embedKeyId = null;

  if (key !== internalKey) {
    const { data: keyRow, error: keyError } = await supabase
      .from('embed_keys')
      .select('id, is_active')
      .eq('key', key)
      .single();

    if (keyError || !keyRow || !keyRow.is_active) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }
    embedKeyId = keyRow.id;
  }

  const { error } = await supabase.from('reports').insert({
    user_message: user_message || null,
    assistant_message: assistant_message || null,
    embed_key_id: embedKeyId,
    ...geoFromRequest(req),
  });

  if (error) {
    console.error('[Report]', error);
    return res.status(500).json({ error: 'Failed to save report' });
  }

  return res.status(200).json({ ok: true });
}
