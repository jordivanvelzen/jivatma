import { verifyAdmin } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';
import { todayStr } from '../../lib/dates.js';
import { notifySessionsCancelled } from '../../lib/telegram.js';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  const type = req.query.type;
  const action = req.query.action;

  // ---- Unavailability windows ----
  if (type === 'unavailability') {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('unavailability')
        .select('*')
        .order('start_date', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
    if (req.method === 'POST') {
      const { start_date, end_date, reason } = req.body;
      if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date required' });
      if (end_date < start_date) return res.status(400).json({ error: 'end_date must be >= start_date' });
      const { data, error } = await supabase
        .from('unavailability')
        .insert({ start_date, end_date, reason: reason || null })
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const { error } = await supabase.from('unavailability').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ---- Manual cancel / re-open of a single session ----
  // Sets status='cancelled' (or back to 'scheduled'), records the reason, and marks
  // auto_cancelled=false so the cron's auto-restore rule doesn't re-open it later.
  // On cancel, fires a Telegram notification per session with WhatsApp deeplinks for each
  // affected (still-active) booking.
  if (action === 'cancel-session' && req.method === 'POST') {
    const { id, reason } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const cancellationReason = (reason && reason.trim()) || 'Cancelada';
    const { data, error } = await supabase
      .from('class_sessions')
      .update({ status: 'cancelled', cancellation_reason: cancellationReason, auto_cancelled: false })
      .eq('id', id)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    let notify = { sent: 0 };
    try { notify = await notifySessionsCancelled([id]); } catch (err) {
      return res.json({ session: data, notify: { sent: 0, error: err.message } });
    }
    return res.json({ session: data, notify });
  }

  if (action === 'uncancel-session' && req.method === 'POST') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { data, error } = await supabase
      .from('class_sessions')
      .update({ status: 'scheduled', cancellation_reason: null, auto_cancelled: false })
      .eq('id', id)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ session: data });
  }

  // ---- Resync future sessions to their template ----
  // Updates start_time / class_type / capacity / capacity_inperson / capacity_online on every
  // future scheduled session that still has a template_id, so template edits propagate.
  // Reports which updated sessions had active bookings so admin can review notification needs.
  if (action === 'resync' && req.method === 'POST') {
    const today = todayStr();
    const { data: templates, error: tplErr } = await supabase
      .from('class_templates')
      .select('*');
    if (tplErr) return res.status(500).json({ error: tplErr.message });
    const tplById = new Map((templates || []).map(t => [t.id, t]));

    const { data: sessions, error: sErr } = await supabase
      .from('class_sessions')
      .select('id, template_id, date, start_time, class_type, capacity, capacity_inperson, capacity_online, status')
      .gte('date', today)
      .eq('status', 'scheduled')
      .not('template_id', 'is', null);
    if (sErr) return res.status(500).json({ error: sErr.message });

    let updated = 0;
    const errors = [];
    const changedIds = [];

    for (const s of sessions || []) {
      const t = tplById.get(s.template_id);
      if (!t) continue;
      const targetCap = t.capacity ?? null;
      const targetCapIp = t.capacity_inperson ?? null;
      const targetCapOl = t.capacity_online ?? null;
      if (
        s.start_time === t.start_time &&
        s.class_type === t.class_type &&
        s.capacity === targetCap &&
        s.capacity_inperson === targetCapIp &&
        s.capacity_online === targetCapOl
      ) continue;
      const { error } = await supabase
        .from('class_sessions')
        .update({
          start_time: t.start_time,
          class_type: t.class_type,
          capacity: targetCap,
          capacity_inperson: targetCapIp,
          capacity_online: targetCapOl,
        })
        .eq('id', s.id);
      if (error) { errors.push({ id: s.id, error: error.message }); continue; }
      updated++;
      changedIds.push(s.id);
    }

    let withBookings = [];
    if (changedIds.length) {
      const { data: bks } = await supabase
        .from('bookings')
        .select('session_id')
        .in('session_id', changedIds)
        .is('cancelled_at', null);
      const counts = {};
      (bks || []).forEach(b => { counts[b.session_id] = (counts[b.session_id] || 0) + 1; });
      withBookings = Object.entries(counts).map(([sid, n]) => ({ session_id: parseInt(sid, 10), bookings: n }));
    }

    return res.json({ updated, withBookings, errors });
  }

  const isSessions = type === 'sessions';

  if (isSessions) {
    if (req.method === 'GET') {
      const { date } = req.query;
      let query = supabase.from('class_sessions').select('*').order('date').order('start_time');
      if (date) query = query.eq('date', date);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
    if (req.method === 'POST') {
      const { date, start_time, class_type, capacity, capacity_inperson, capacity_online, notes } = req.body;
      if (!date || !start_time || !class_type) {
        return res.status(400).json({ error: 'date, start_time, class_type required' });
      }
      const { data, error } = await supabase
        .from('class_sessions')
        .insert({
          template_id: null,
          date, start_time, class_type,
          capacity: capacity || null,
          capacity_inperson: capacity_inperson ?? null,
          capacity_online: capacity_online ?? null,
          notes: notes || null,
        })
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const { data, error } = await supabase.from('class_sessions').update(updates).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const { error } = await supabase.from('class_sessions').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Templates
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('class_templates').select('*').order('day_of_week').order('start_time');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'POST') {
    const { day_of_week, start_time, duration_min, class_type, capacity, capacity_inperson, capacity_online } = req.body;
    const { data, error } = await supabase.from('class_templates').insert({
      day_of_week, start_time, duration_min: duration_min || 60, class_type, capacity,
      capacity_inperson: capacity_inperson ?? null,
      capacity_online: capacity_online ?? null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { data, error } = await supabase.from('class_templates').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase.from('class_templates').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
