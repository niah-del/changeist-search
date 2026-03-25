import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { key, url, query } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  // Validate embed key
  const internalKey = process.env.INTERNAL_EMBED_KEY || 'changeist-internal';
  let embedKeyId = null;
  if (key && key !== internalKey) {
    const { data: keyRow } = await supabase
      .from('embed_keys')
      .select('id, is_active')
      .eq('key', key)
      .single();
    if (keyRow?.is_active) embedKeyId = keyRow.id;
  }

  // Resolve listing_id from URL
  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('url', url)
    .single();

  if (!listing) return res.status(200).json({ ok: true }); // not a tracked listing

  supabase.from('listing_events').insert({
    listing_id: listing.id,
    event_type: 'click',
    query: query || null,
    embed_key_id: embedKeyId,
  }).then(({ error }) => {
    if (error) console.error('[listing-click]', error);
  });

  return res.status(200).json({ ok: true });
}
