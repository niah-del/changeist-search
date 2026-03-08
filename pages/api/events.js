import { supabase } from '../../lib/supabase';
import { logEvent, geoFromRequest } from '../../lib/analytics';

/**
 * POST /api/events
 * Receives anonymous session metadata from the widget (e.g. session duration).
 * No personal data is stored — IP is never saved; geo is country/region/city only.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, event_type, duration_seconds, message_count } = req.body || {};

  if (!key) return res.status(401).json({ error: 'Missing API key' });

  const internalKey = process.env.INTERNAL_EMBED_KEY || 'changeist-internal';
  let embed_key_id = null;

  if (key !== internalKey) {
    const { data: keyRow, error } = await supabase
      .from('embed_keys')
      .select('id, is_active')
      .eq('key', key)
      .single();

    if (error || !keyRow || !keyRow.is_active) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }
    embed_key_id = keyRow.id;
  }

  await logEvent(event_type || 'session_end', {
    duration_seconds: typeof duration_seconds === 'number' ? duration_seconds : null,
    message_count:    typeof message_count === 'number'    ? message_count    : null,
    embed_key_id,
    ...geoFromRequest(req),
  });

  return res.status(200).json({ ok: true });
}
