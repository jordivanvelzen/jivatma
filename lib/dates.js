// Server-side date helpers — mirror of public/lib/dates.js.
// Studio timezone is America/Bogota (Medellín, UTC-5, no DST).
// Using naive `new Date().toISOString()` returns UTC date, which drops
// today's classes after 7pm local time. Always prefer these helpers.

const STUDIO_TZ = 'America/Bogota';

/** Today as YYYY-MM-DD in the studio's timezone. */
export function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: STUDIO_TZ });
}

/** Add N days to a YYYY-MM-DD string, return YYYY-MM-DD. */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split('T')[0];
}
