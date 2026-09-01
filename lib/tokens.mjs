/**
 * Query tokenisation for listing search.
 *
 * Kept in its own dependency-free module so `node --test` can load it without
 * pulling in the Supabase client (which throws when env vars are absent).
 * See lib/search.test.mjs.
 */

// Words that carry no search signal but match nearly every row when used with
// a substring (ilike '%token%') match — "in" alone matches "training",
// "Washington", "internship" and so on, which used to flood the 20-row limit.
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do',
  'for', 'from', 'get', 'has', 'have', 'how', 'i', 'im', 'in', 'is', 'it',
  'like', 'looking', 'me', 'my', 'near', 'of', 'on', 'or', 'that', 'the',
  'their', 'there', 'this', 'to', 'want', 'was', 'we', 'what', 'where',
  'which', 'who', 'with', 'would', 'you', 'your',
]);

/**
 * Reduce a raw query to the tokens worth matching on.
 * Drops stop words and very short fragments. If that would leave nothing,
 * falls back to the original tokens so short queries ("ai", "art") still work.
 * @param {string} query
 * @returns {string[]}
 */
export function meaningfulTokens(query) {
  const raw = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const kept = raw.filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return kept.length > 0 ? kept : raw;
}
