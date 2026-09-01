/**
 * Tests for query tokenisation — stop words used to flood the result limit,
 * because '%in%' matches "training", "Washington", "internship" and more.
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meaningfulTokens } from './tokens.mjs';

test('drops stop words and short fragments', () => {
  assert.deepEqual(
    meaningfulTokens('volunteer in Los Angeles'),
    ['volunteer', 'los', 'angeles'],
  );
  assert.deepEqual(
    meaningfulTokens('I want to find a job with animals'),
    ['find', 'job', 'animals'],
  );
});

test('lowercases for consistent matching', () => {
  assert.deepEqual(meaningfulTokens('Environmental JUSTICE'), ['environmental', 'justice']);
});

test('falls back to the raw tokens rather than matching nothing', () => {
  // Every token would otherwise be filtered out, leaving an empty OR clause.
  assert.deepEqual(meaningfulTokens('ai'), ['ai']);
  assert.deepEqual(meaningfulTokens('in the a'), ['in', 'the', 'a']);
});

test('handles messy whitespace', () => {
  assert.deepEqual(meaningfulTokens('  music   therapy  '), ['music', 'therapy']);
});
