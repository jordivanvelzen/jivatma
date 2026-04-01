import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Extract and verify the JWT from the Authorization header.
 * Returns { user, profile } or null.
 */
export async function verifyUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return { user, profile };
}

/**
 * Verify the request is from an admin.
 * Returns { user, profile } or null.
 */
export async function verifyAdmin(req) {
  const result = await verifyUser(req);
  if (!result) return null;
  if (result.profile.role !== 'admin') return null;
  return result;
}
