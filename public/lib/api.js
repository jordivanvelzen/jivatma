import { getSession } from './supabase.js';

/**
 * Fetch wrapper that adds the auth token automatically.
 */
export async function api(path, options = {}) {
  const session = await getSession();
  const headers = {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(path, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error ${res.status}`);
  }

  return data;
}
