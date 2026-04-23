import { supabase } from './supabase.js';
import { findActivePass } from './passes.js';
import { todayStr, addDays } from './dates.js';

/**
 * Check if a user can book a session.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export async function canBook(sessionId, userId) {
  // Get session
  const { data: session } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session) return { ok: false, reason: 'Session not found' };
  if (session.status !== 'scheduled') return { ok: false, reason: 'Session is not open for booking' };

  // Check date is in the future
  const today = todayStr();
  if (session.date < today) return { ok: false, reason: 'Session is in the past' };

  // Check sign-up window
  const { data: windowSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'signup_window_weeks')
    .single();

  const windowWeeks = parseInt(windowSetting?.value || '2', 10);
  const maxDateStr = addDays(today, windowWeeks * 7);

  if (session.date > maxDateStr) return { ok: false, reason: 'Session is too far in the future' };

  // Check user has an active pass
  const activePass = await findActivePass(userId);
  if (!activePass) return { ok: false, reason: 'no_active_pass' };

  // Check capacity
  const capacity = session.capacity || await getDefaultCapacity();

  const { count } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .is('cancelled_at', null);

  if (count >= capacity) return { ok: false, reason: 'Class is full' };

  // Check not already booked
  const { data: existing } = await supabase
    .from('bookings')
    .select('id, cancelled_at')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .single();

  if (existing && !existing.cancelled_at) return { ok: false, reason: 'Already booked' };

  return { ok: true };
}

/**
 * Get default capacity from settings.
 */
async function getDefaultCapacity() {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'default_capacity')
    .single();

  return parseInt(data?.value || '15', 10);
}
