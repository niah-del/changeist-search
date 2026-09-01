import { supabase } from './supabase';

/**
 * Fixed-window rate limiting, counted in Postgres.
 *
 * Serverless functions share no memory, so an in-process counter would reset on
 * every cold start and count separately per instance. The counter lives in the
 * database instead, incremented by the check_rate_limit function so concurrent
 * requests cannot race past the limit.
 *
 * FAILS OPEN. If the database is unreachable, or the function has not been
 * created yet, requests are allowed through. A broken limiter should slow
 * nothing down and take nothing offline — the cost of wrongly allowing traffic
 * is a bill; the cost of wrongly blocking it is a young person who cannot use
 * the service.
 */

/**
 * The caller's IP, from the headers Vercel sets. Only used to build a rate
 * limit key — never stored, and never written to any table.
 */
export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || 'unknown';
}

/**
 * @param {object}  params
 * @param {string}  params.scope         what is being limited, e.g. 'chat'
 * @param {string}  params.identifier    who is being limited, e.g. an IP
 * @param {number}  params.limit         requests allowed per window
 * @param {number}  params.windowSeconds window length
 * @returns {Promise<{allowed: boolean, retryAfter: number, degraded: boolean}>}
 */
export async function checkRateLimit({ scope, identifier, limit, windowSeconds }) {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: `${scope}:${identifier}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      // Most likely cause: the migration adding check_rate_limit has not been
      // run yet. Say so loudly rather than silently policing nothing.
      console.error(
        `[rate-limit] DISABLED for "${scope}" — ${error.message}. ` +
        'Run the rate_limits migration in supabase-schema.sql.',
      );
      return { allowed: true, retryAfter: 0, degraded: true };
    }

    return {
      allowed: data?.allowed !== false,
      retryAfter: data?.retry_after ?? 0,
      degraded: false,
    };
  } catch (err) {
    console.error(`[rate-limit] DISABLED for "${scope}" —`, err?.message || err);
    return { allowed: true, retryAfter: 0, degraded: true };
  }
}

/**
 * Apply a limit and, when exceeded, write the 429 response.
 * @returns {Promise<boolean>} true if the request was blocked and answered.
 */
export async function enforceRateLimit(req, res, { scope, identifier, limit, windowSeconds, message }) {
  const { allowed, retryAfter } = await checkRateLimit({ scope, identifier, limit, windowSeconds });
  if (allowed) return false;

  res.setHeader('Retry-After', String(retryAfter));
  res.status(429).json({
    error: message || 'Too many requests. Please wait a moment and try again.',
    retry_after: retryAfter,
  });
  return true;
}

/**
 * Limits per endpoint. Tuned so a real young person having a long conversation
 * never touches them, while scripted abuse of a publicly visible embed key hits
 * a wall quickly. Chat and export are the ones that cost real money.
 */
export const LIMITS = {
  // A genuine session runs maybe 10-20 messages; 40 per 10 min leaves room.
  chat:        { limit: 40,  windowSeconds: 600 },
  // Per embed key per day, so one leaked key cannot run up an unbounded bill.
  chatDaily:   { limit: 3000, windowSeconds: 86400 },
  // Cheap endpoint, no model call.
  search:      { limit: 60,  windowSeconds: 60 },
  // Calls Opus and generates a document — expensive and rarely needed twice.
  export:      { limit: 10,  windowSeconds: 3600 },
  // Enough to flag genuine problems, not enough to spam the reports table.
  report:      { limit: 20,  windowSeconds: 3600 },
  // Brute-force protection for the admin secret, which travels in the URL.
  admin:       { limit: 30,  windowSeconds: 300 },
  // Telemetry. No model call and no cost, but both write rows, so they are
  // worth bounding so the tables cannot be inflated by a script. Generous
  // enough that ordinary clicking and page-unload beacons never hit them.
  telemetry:   { limit: 120, windowSeconds: 60 },
};
