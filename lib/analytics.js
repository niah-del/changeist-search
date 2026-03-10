import { supabase } from './supabase';

/**
 * Log an anonymous event to the search_events table.
 * Never throws — analytics must never break the main request flow.
 */
export async function logEvent(eventType, data = {}) {
  try {
    await supabase.from('search_events').insert({
      event_type: eventType,
      ...data,
    });
  } catch (err) {
    console.error('[Analytics]', err);
  }
}

/**
 * Extract anonymous geo data from Vercel's request headers.
 * These are country/region/city codes derived from IP — the IP itself is never stored.
 */
export function geoFromRequest(req) {
  return {
    country: req.headers['x-vercel-ip-country'] || null,
    region:  req.headers['x-vercel-ip-country-region'] || null,
    city:    req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : null,
  };
}
