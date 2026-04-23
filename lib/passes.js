import { supabase } from './supabase.js';
import { todayStr } from './dates.js';

/**
 * Find the best active pass for a user (FIFO: soonest-expiring first).
 * Returns the pass row or null.
 */
export async function findActivePass(userId) {
  const today = todayStr();

  const { data: passes } = await supabase
    .from('user_passes')
    .select('*')
    .eq('user_id', userId)
    .gte('expires_at', today)
    .or('classes_remaining.gt.0,classes_remaining.is.null')
    .order('expires_at', { ascending: true })
    .limit(1);

  return passes?.[0] || null;
}

/**
 * Deduct one class from a pass. Returns the updated pass or null.
 * Unlimited passes (classes_remaining=null) are not decremented.
 */
export async function deductPass(passId) {
  // First get current state
  const { data: pass } = await supabase
    .from('user_passes')
    .select('*')
    .eq('id', passId)
    .single();

  if (!pass) return null;

  // Unlimited pass — no deduction needed
  if (pass.classes_remaining === null) return pass;

  if (pass.classes_remaining <= 0) return null;

  const { data: updated } = await supabase
    .from('user_passes')
    .update({ classes_remaining: pass.classes_remaining - 1 })
    .eq('id', passId)
    .select()
    .single();

  return updated;
}

/**
 * Reverse a deduction (undo attendance). Increments classes_remaining.
 */
export async function reverseDeduction(passId) {
  const { data: pass } = await supabase
    .from('user_passes')
    .select('*')
    .eq('id', passId)
    .single();

  if (!pass || pass.classes_remaining === null) return pass;

  const { data: updated } = await supabase
    .from('user_passes')
    .update({ classes_remaining: pass.classes_remaining + 1 })
    .eq('id', passId)
    .select()
    .single();

  return updated;
}
