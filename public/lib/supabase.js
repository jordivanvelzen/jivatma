// Client-side Supabase init (uses anon key — safe for browser)
const SUPABASE_URL = 'https://rrqvnrolqollitlhpvjw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycXZucm9scW9sbGl0bGhwdmp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzE2ODQsImV4cCI6MjA4OTYwNzY4NH0.Xpy4eqKveN9UnfIoC67YzwiI1OISWCLk2u-o15Q46Aw';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
