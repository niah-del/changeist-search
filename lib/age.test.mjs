/**
 * Tests for age detection — the gate in front of every minor-safety control.
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAge } from './age.mjs';

test('reads a directly stated age', () => {
  assert.equal(extractAge("I'm 15"), 15);
  assert.equal(extractAge('I am 12 and I like animals'), 12);
  assert.equal(extractAge('I am 16 years old'), 16);
  assert.equal(extractAge('age 14'), 14);
  assert.equal(extractAge('aged 17'), 17);
});

test('ignores numbers that are not plausible ages', () => {
  // Out of the 5–110 range, so no numeric pattern should win.
  assert.equal(extractAge("I'm 3"), null);
  assert.equal(extractAge("I'm 250"), null);
});

test('maps school grades to the top of the band', () => {
  assert.equal(extractAge("I'm in 6th grade"), 11);
  assert.equal(extractAge('9th grade'), 14);
  assert.equal(extractAge('12th grade'), 17);
});

test('maps school-level cues conservatively', () => {
  assert.equal(extractAge('I am an elementary schooler'), 11);
  assert.equal(extractAge('I go to middle school'), 13);
  assert.equal(extractAge('junior high student'), 13);
  assert.equal(extractAge('I am in high school'), 17);
});

test('separates high-school years from college years', () => {
  assert.equal(extractAge('high school freshman'), 14);
  assert.equal(extractAge('I am a high school senior'), 17);
  assert.equal(extractAge('college freshman'), 18);
  assert.equal(extractAge('university sophomore'), 19);
  assert.equal(extractAge('undergrad senior'), 21);
});

test('a bare year word defaults to the younger reading', () => {
  // No school context — must not be read as college, which would unlock
  // adult-only opportunities for a 15-year-old.
  assert.equal(extractAge("I'm a sophomore"), 15);
  assert.equal(extractAge('I am a freshman'), 14);
});

test('returns null when no age signal is present', () => {
  assert.equal(extractAge('I want to help animals'), null);
  assert.equal(extractAge('looking for volunteer work in Stockton'), null);
  assert.equal(extractAge(''), null);
});

test('an explicit age wins over a weaker school cue', () => {
  // Numeric patterns are checked before school cues, so the stated age wins.
  assert.equal(extractAge("I'm 15 and in high school"), 15);
});
