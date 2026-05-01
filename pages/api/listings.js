import { supabase } from '../../lib/supabase';

// Parses "16", "13-18", "13–18", "13 to 18" → { age_min, age_max }
function parseAgeRequirement(value) {
  if (!value && value !== 0) return { age_min: null, age_max: null };
  const str = String(value).trim();
  const rangeMatch = str.match(/^(\d+)\s*(?:[-–—]|to)\s*(\d+)$/i);
  if (rangeMatch) {
    return { age_min: parseInt(rangeMatch[1]), age_max: parseInt(rangeMatch[2]) };
  }
  const single = str.match(/^(\d+)$/);
  if (single) return { age_min: parseInt(single[1]), age_max: null };
  return { age_min: null, age_max: null };
}

/**
 * Admin endpoint for managing listings.
 * Protected by ADMIN_SECRET environment variable.
 *
 * GET    /api/listings?secret=...            — list all listings
 * POST   /api/listings?secret=...            — create a listing
 * PATCH  /api/listings?secret=...&id=<uuid>  — update a listing
 * DELETE /api/listings?secret=...&id=<uuid>  — deactivate a listing (soft delete)
 */

function isAuthorized(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  // Accept secret from query param or Authorization header
  const fromQuery = req.query.secret;
  const fromHeader = req.headers.authorization?.replace('Bearer ', '');
  return fromQuery === secret || fromHeader === secret;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // --- GET: list listings ---
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ listings: data });
  }

  // --- POST: create listing ---
  if (req.method === 'POST') {
    const { title, organization, description, type, location, url, priority, tags, expires_at, age_requirement } =
      req.body;

    if (!title || !organization) {
      return res.status(400).json({ error: 'title and organization are required' });
    }

    const { age_min, age_max } = parseAgeRequirement(age_requirement);

    const { data, error } = await supabase
      .from('listings')
      .insert({
        title,
        organization,
        description: description || null,
        type: type || null,
        location: location || null,
        url: url || null,
        priority: priority ?? 0,   // 0 = internal, 1 = sponsored
        tags: tags || [],
        expires_at: expires_at || null,
        age_min,
        age_max,
        is_active: true,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ listing: data });
  }

  // --- PATCH: update listing ---
  if (req.method === 'PATCH') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const updates = { ...req.body };
    if ('age_requirement' in updates) {
      const { age_min, age_max } = parseAgeRequirement(updates.age_requirement);
      updates.age_min = age_min;
      updates.age_max = age_max;
      delete updates.age_requirement;
    }

    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ listing: data });
  }

  // --- DELETE: soft-delete (deactivate) listing ---
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const { data, error } = await supabase
      .from('listings')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ listing: data, message: 'Listing deactivated' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
