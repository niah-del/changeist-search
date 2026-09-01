/**
 * Guard for prompt caching.
 *
 * Claude Haiku 4.5 will not cache a system block below 4,096 tokens, and that
 * minimum is measured against the system prompt ALONE — the tool definitions
 * are cached with it but do not count toward the threshold (verified against
 * the live API). Falling under the line produces no error and no warning: the
 * cache_control markers in pages/api/chat.js just quietly stop saving money.
 *
 * SYSTEM_PROMPT measured 4,197 tokens at 17,507 characters (~4.17 chars per
 * token). This test fails if an edit trims it close enough to the threshold to
 * put caching at risk, so the regression is caught here rather than on a bill.
 *
 * If this test fails: either restore the length, or re-measure the real token
 * count and only lower FLOOR if the prompt genuinely still clears 4,096.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const chatSource = fs.readFileSync(path.join(here, '..', 'pages', 'api', 'chat.js'), 'utf8');

// Characters corresponding to 4,096 tokens at the measured ratio, plus a
// margin so we fail before caching actually breaks rather than after.
const FLOOR = 17086 + 200;

test('SYSTEM_PROMPT stays long enough for Haiku 4.5 to cache it', () => {
  const match = chatSource.match(/const SYSTEM_PROMPT = `([\s\S]*?)\n`;/);
  assert.ok(match, 'could not find SYSTEM_PROMPT in pages/api/chat.js');

  const length = match[1].length;
  assert.ok(
    length >= FLOOR,
    `SYSTEM_PROMPT is ${length} chars; needs at least ${FLOOR} to stay above ` +
    `Haiku 4.5's 4,096-token cache minimum. Caching fails silently below it.`,
  );
});

test('the cache breakpoint and constant tool list are still in place', () => {
  // The age policy must stay in its own block after the breakpoint, and the
  // tool definitions must not be swapped out mid-conversation — changing tool
  // definitions invalidates the whole tools+system cache.
  assert.match(chatSource, /cache_control: \{ type: 'ephemeral' \}/,
    'cache_control breakpoint is missing from the system block');
  assert.doesNotMatch(chatSource, /tools: toolCallCount < 2 \? tools : undefined/,
    'tools are being removed mid-conversation, which invalidates the cache; ' +
    'use tool_choice to stop tool use instead');
});
