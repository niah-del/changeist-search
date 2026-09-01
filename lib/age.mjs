/**
 * Age detection from a user's own words.
 *
 * This module gates every downstream minor-safety control in the product, so
 * it is kept separate from the chat route specifically to be testable —
 * see lib/age.test.mjs. Run the tests with `npm test`.
 *
 * .mjs so plain `node --test` can load it without making the whole package
 * ESM (next.config.js and the rest of the repo are CommonJS to Node).
 *
 * Every ambiguous case resolves to the YOUNGER interpretation. Guessing too
 * young shows a teenager fewer options; guessing too old shows a child an
 * adult opportunity.
 */
export function extractAge(text) {
  const numericPatterns = [
    /\bi(?:'m| am)\s+(\d{1,3})\b/i,              // "I'm 25" / "I am 25"
    /\b(\d{1,3})\s+years?\s*old\b/i,             // "25 years old"
    /\bage[d]?\s*(?:is\s+|of\s+)?(\d{1,3})\b/i, // "age 25" / "aged 25"
  ];
  for (const p of numericPatterns) {
    const m = text.match(p);
    if (m) {
      const age = parseInt(m[1]);
      if (age >= 5 && age <= 110) return age;
    }
  }

  // Grade-level detection — returns a conservative (older end) age for the grade band
  const gradeMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+grade\b/i);
  if (gradeMatch) {
    const grade = parseInt(gradeMatch[1]);
    if (grade >= 1 && grade <= 12) return grade + 5; // grade 6 → 11, grade 12 → 17
  }

  // School-level cues — use the oldest plausible age in the band (conservative)
  if (/\belementary\s+school(?:er)?\b/i.test(text)) return 11;
  if (/\bmiddle\s+school(?:er)?\b/i.test(text)) return 13;
  if (/\bjunior\s+high\b/i.test(text)) return 13;

  // Year-in-school detection — differentiate HS vs college context
  const yearWords = { freshman: 0, freshmen: 0, sophomore: 1, junior: 2, senior: 3 };
  const hsPattern = /\b(high\s+school|h\.?s\.?)\b/i;
  const collegePattern = /\b(college|university|undergrad)\b/i;
  const yearPattern = /\b(freshman|freshmen|sophomore|junior|senior)\b/i;

  const yearMatch = text.match(yearPattern);
  if (yearMatch) {
    const offset = yearWords[yearMatch[1].toLowerCase()] ?? 0;
    if (hsPattern.test(text)) return 14 + offset;     // HS freshman=14 … senior=17
    if (collegePattern.test(text)) return 18 + offset; // College freshman=18 … senior=21
    // Standalone ("I'm a sophomore") — default to HS (safer/younger interpretation)
    if (/\bi(?:'m| am)\s+a\s+(freshman|freshmen|sophomore|junior|senior)\b/i.test(text)) {
      return 14 + offset;
    }
  }

  if (/\bhigh\s+school(?:er)?\b/i.test(text)) return 17;

  return null;
}
