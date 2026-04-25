import { supabase } from '../../lib/supabase.js';
import { todayStr, addDays } from '../../lib/dates.js';

const WINDOW_DAYS = 14;
const DEFAULT_REASON = 'Teacher unavailable';

// Run the generate / auto-cancel / auto-restore / cleanup pass.
// Pass { dryRun: true } to compute the plan without writing anything.
//
// Cron starts from tomorrow so a manually-deleted "today" session doesn't get re-created the
// same day. The admin button calls the same handler.
export async function runGenerate({ dryRun = false } = {}) {
  const errors = [];
  const today = todayStr();
  const startDay = addDays(today, 1); // skip today
  const endDay = addDays(today, WINDOW_DAYS);

  // Build the list of dates in the window with their day-of-week.
  const windowDates = [];
  for (let offset = 1; offset <= WINDOW_DAYS; offset++) {
    const dateStr = addDays(today, offset);
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    windowDates.push({ dateStr, dayOfWeek });
  }

  const [
    { data: templates, error: tplErr },
    { data: capSetting },
    { data: existingSessions, error: sessErr },
    { data: unavailability, error: unavailErr },
  ] = await Promise.all([
    supabase.from('class_templates').select('*'),
    supabase.from('settings').select('value').eq('key', 'default_capacity').single(),
    supabase
      .from('class_sessions')
      .select('id, template_id, date, status, cancellation_reason')
      .gte('date', startDay)
      .lte('date', endDay),
    supabase
      .from('unavailability')
      .select('*')
      .gte('end_date', startDay)
      .lte('start_date', endDay),
  ]);

  if (tplErr) errors.push({ step: 'fetch_templates', error: tplErr.message });
  if (sessErr) errors.push({ step: 'fetch_sessions', error: sessErr.message });
  if (unavailErr) errors.push({ step: 'fetch_unavailability', error: unavailErr.message });

  const defaultCap = parseInt(capSetting?.value || '15', 10);
  const activeTemplates = (templates || []).filter(t => t.is_active);
  const inactiveTemplateIds = new Set((templates || []).filter(t => !t.is_active).map(t => t.id));

  // Index existing sessions by (template_id, date) for O(1) lookup.
  const existingByKey = new Map();
  for (const s of existingSessions || []) {
    if (s.template_id != null) existingByKey.set(`${s.template_id}|${s.date}`, s);
  }

  const isUnavailable = (dateStr) => {
    for (const w of unavailability || []) {
      if (dateStr >= w.start_date && dateStr <= w.end_date) return w;
    }
    return null;
  };

  // 1. Plan creates.
  const toInsert = [];
  for (const { dateStr, dayOfWeek } of windowDates) {
    for (const tmpl of activeTemplates) {
      if (tmpl.day_of_week !== dayOfWeek) continue;
      if (existingByKey.has(`${tmpl.id}|${dateStr}`)) continue;
      const window = isUnavailable(dateStr);
      const cancellationReason = window ? (window.reason || DEFAULT_REASON) : null;
      toInsert.push({
        template_id: tmpl.id,
        date: dateStr,
        start_time: tmpl.start_time,
        class_type: tmpl.class_type,
        capacity: tmpl.capacity || defaultCap,
        capacity_inperson: tmpl.capacity_inperson ?? null,
        capacity_online: tmpl.capacity_online ?? null,
        status: cancellationReason ? 'cancelled' : 'scheduled',
        cancellation_reason: cancellationReason,
      });
    }
  }

  // 2. Plan auto-cancellations (existing scheduled sessions now in an unavailable window).
  const toAutoCancel = [];
  for (const s of existingSessions || []) {
    if (s.status !== 'scheduled') continue;
    const window = isUnavailable(s.date);
    if (window) {
      toAutoCancel.push({ id: s.id, reason: window.reason || DEFAULT_REASON });
    }
  }

  // 3. Plan restores (auto-cancelled sessions no longer in any unavailable window).
  const toRestore = [];
  for (const s of existingSessions || []) {
    if (s.status !== 'cancelled') continue;
    if (!s.cancellation_reason) continue; // admin-cancelled — leave alone
    if (!isUnavailable(s.date)) toRestore.push({ id: s.id });
  }

  // 4. Plan cleanup of sessions whose template is now inactive AND have no active bookings.
  const candidateInactive = (existingSessions || []).filter(
    s => s.template_id != null && inactiveTemplateIds.has(s.template_id)
  );
  let toCleanup = [];
  let cleanupSkipped = [];
  if (candidateInactive.length) {
    const ids = candidateInactive.map(s => s.id);
    const { data: bookings } = await supabase
      .from('bookings')
      .select('session_id')
      .in('session_id', ids)
      .is('cancelled_at', null);
    const hasBookings = new Set((bookings || []).map(b => b.session_id));
    for (const s of candidateInactive) {
      if (hasBookings.has(s.id)) cleanupSkipped.push(s.id);
      else toCleanup.push(s.id);
    }
  }

  if (dryRun) {
    return {
      dryRun: true,
      window: { from: startDay, to: endDay },
      created: toInsert.length,
      createdSample: toInsert.slice(0, 20).map(s => ({ date: s.date, time: s.start_time, status: s.status })),
      autoCancelled: toAutoCancel.length,
      restored: toRestore.length,
      cleanedUp: toCleanup.length,
      cleanupSkippedWithBookings: cleanupSkipped.length,
      errors,
    };
  }

  // ---- Apply ----
  let created = 0;
  if (toInsert.length) {
    const { error } = await supabase.from('class_sessions').insert(toInsert);
    if (error) errors.push({ step: 'insert_sessions', error: error.message });
    else created = toInsert.length;
  }

  let autoCancelled = 0;
  for (const item of toAutoCancel) {
    const { error } = await supabase
      .from('class_sessions')
      .update({ status: 'cancelled', cancellation_reason: item.reason })
      .eq('id', item.id);
    if (error) errors.push({ step: 'auto_cancel', id: item.id, error: error.message });
    else autoCancelled++;
  }

  let restored = 0;
  if (toRestore.length) {
    const { error } = await supabase
      .from('class_sessions')
      .update({ status: 'scheduled', cancellation_reason: null })
      .in('id', toRestore.map(r => r.id));
    if (error) errors.push({ step: 'restore', error: error.message });
    else restored = toRestore.length;
  }

  let cleanedUp = 0;
  if (toCleanup.length) {
    const { error } = await supabase.from('class_sessions').delete().in('id', toCleanup);
    if (error) errors.push({ step: 'cleanup', error: error.message });
    else cleanedUp = toCleanup.length;
  }

  return {
    dryRun: false,
    window: { from: startDay, to: endDay },
    created,
    autoCancelled,
    restored,
    cleanedUp,
    cleanupSkippedWithBookings: cleanupSkipped.length,
    errors,
  };
}

export default async function handler(req, res) {
  const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true';
  try {
    const result = await runGenerate({ dryRun });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
