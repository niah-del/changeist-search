import { supabase } from '../../lib/supabase';

// Canonical form for comparing a clicked link against stored listing URLs.
// Ignores protocol, a leading "www.", casing of the host, and trailing
// slashes — the differences that made exact matching drop clicks. The query
// string is kept, since it can distinguish two apply links on one domain.
function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    const host = u.host.toLowerCase().replace(/^www\./, '');
    let path = u.pathname.replace(/\/+$/, '');
    if (path === '') path = '/';
    return host + path + (u.search || '');
  } catch {
    return String(raw).trim().toLowerCase().replace(/\/+$/, '');
  }
}

function hostOf(raw) {
  try {
    return new URL(raw).host.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

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

  // Resolve listing_id from the clicked URL.
  // Fast path: exact match (indexed). On ties/duplicates, prefer an active,
  // higher-priority (lower number) listing rather than erroring on .single().
  let listingId = null;

  const { data: exact } = await supabase
    .from('listings')
    .select('id, is_active, priority')
    .eq('url', url)
    .order('is_active', { ascending: false })
    .order('priority', { ascending: true })
    .limit(1);

  if (exact && exact.length) {
    listingId = exact[0].id;
  } else {
    // Fallback: tolerant match. Narrow to same-domain listings, then compare
    // normalized URLs in JS so trailing slash / www / http-vs-https / casing
    // don't drop the click.
    const target = normalizeUrl(url);
    const host = hostOf(url);
    let cq = supabase
      .from('listings')
      .select('id, url, is_active, priority')
      .order('is_active', { ascending: false })
      .order('priority', { ascending: true });
    if (host) cq = cq.ilike('url', `%${host}%`);
    const { data: candidates } = await cq;
    const match = (candidates || []).find((l) => normalizeUrl(l.url) === target);
    if (match) listingId = match.id;
  }

  if (!listingId) return res.status(200).json({ ok: true }); // not a tracked listing

  supabase.from('listing_events').insert({
    listing_id: listingId,
    event_type: 'click',
    query: query || null,
    embed_key_id: embedKeyId,
  }).then(({ error }) => {
    if (error) console.error('[listing-click]', error);
  });

  return res.status(200).json({ ok: true });
}
