// Client-side Supabase init (uses anon key — safe for browser)
const SUPABASE_URL = 'https://rrqvnrolqollitlhpvjw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycXZucm9scW9sbGl0bGhwdmp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzE2ODQsImV4cCI6MjA4OTYwNzY4NH0.Xpy4eqKveN9UnfIoC67YzwiI1OISWCLk2u-o15Q46Aw';

// Auth config: be explicit about persistence so installed PWAs / home-screen
// shortcuts keep the session across app launches. The Supabase JS client stores
// the session in localStorage and auto-refreshes the access token. Default
// storageKey (sb-<ref>-auth-token) is left as-is so existing sessions survive.
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

/**
 * Boot the auth session: read whatever's persisted, and if the access token
 * is expired (or about to expire), force a refresh before any route guard
 * runs. Without this, a user returning to the PWA after the 1h access-token
 * lifetime can briefly see "no session" and get bounced to /login even though
 * the refresh token is still valid.
 *
 * Returns the live session, or null if there's nothing valid (refresh failed
 * or never logged in).
 */
export async function bootSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const expiresAt = session.expires_at; // unix seconds
  const now = Math.floor(Date.now() / 1000);
  // Refresh if expired, or within 60s of expiring (avoid a race where the
  // first API call fires with a token that expires mid-flight).
  if (!expiresAt || expiresAt - now < 60) {
    const { data, error } = await sb.auth.refreshSession();
    if (error || !data.session) {
      // Refresh token is dead (revoked or past max lifetime). Clear the stale
      // tokens so the next getSession() returns null cleanly.
      try { await sb.auth.signOut({ scope: 'local' }); } catch (_) {}
      return null;
    }
    return data.session;
  }

  return session;
}

/**
 * Get the current session, or null.
 */
export async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

/**
 * Get current user's profile (with role).
 */
export async function getProfile() {
  const session = await getSession();
  if (!session) return null;

  const { data } = await sb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return data;
}

/**
 * Check if the current user is admin.
 */
export async function isAdmin() {
  const profile = await getProfile();
  return profile?.role === 'admin';
}
