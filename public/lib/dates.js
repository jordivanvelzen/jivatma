// Date helpers. All studio dates are stored as YYYY-MM-DD strings in the DB.
// Parsing them with `new Date(str)` treats them as UTC midnight, which renders
// as the previous day in any negative-offset timezone (e.g. Medellín UTC-5).
// Use these helpers to keep dates anchored to the studio's local timezone.

const STUDIO_TZ = 'America/Bogota'; // Medellín, Colombia — UTC-5, no DST

/**
 * Parse a YYYY-MM-DD DB date into a Date at LOCAL midnight,
 * so toLocaleDateString / comparisons render the correct day.
 */
export function parseLocalDate(str) {
  if (!str) return null;
  // Handle full ISO timestamps too (created_at etc.) — just pass through
  if (str.includes('T')) return new Date(str);
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Today as YYYY-MM-DD in the studio's timezone.
 * Use this for any `.gte('date', today)` style filter.
 */
export function todayStr() {
  // 'en-CA' formats as YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: STUDIO_TZ });
}

/**
 * Format a DB date string using a locale, anchored to local midnight.
 */
export function formatDbDate(str, locale, opts) {
  const d = parseLocalDate(str);
  return d ? d.toLocaleDateString(locale, opts) : '';
}
