// Super-admin gate. Master admins (Claudia + Jordi) both have full admin powers,
// but a few dev-only controls — Telegram test/production routing and the
// "CC Jordi during production" toggle — should only be visible to Jordi.
// Hardcode his addresses here. Email comparison is case-insensitive.
const SUPER_ADMIN_EMAILS = new Set([
  'jordi.vanvelzen@gmail.com',
  'dev.jordi@pm.me',
]);

export function isSuperAdmin(email) {
  return !!email && SUPER_ADMIN_EMAILS.has(String(email).trim().toLowerCase());
}
