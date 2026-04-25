import { verifyAdmin } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';
import { todayStr, addDays } from '../../lib/dates.js';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  const isTypes = req.query.type === 'types';

  if (isTypes) {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('pass_types').select('*').order('kind');
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
    if (req.method === 'POST') {
      const { kind, class_count, validity_days, price } = req.body;
      const { data, error } = await supabase.from('pass_types').insert({ kind, class_count, validity_days, price }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const { data, error } = await supabase.from('pass_types').update(updates).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // User passes
  if (req.method === 'GET') {
    const userId = req.query.user_id;
    let query = supabase.from('user_passes').select('*, pass_types(*), profiles!user_id(full_name)').order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'POST') {
    const { user_id, pass_type_id, payment_method, is_paid } = req.body;
    if (!user_id || !pass_type_id) return res.status(400).json({ error: 'user_id and pass_type_id required' });

    const { data: passType } = await supabase.from('pass_types').select('*').eq('id', pass_type_id).single();
    if (!passType) return res.status(404).json({ error: 'Pass type not found' });

    const startsAt = todayStr();
    const expiresAt = addDays(startsAt, passType.validity_days);

    const method = payment_method || 'cash';
    const paid = method === 'gift' ? true : !!is_paid;

    const { data, error } = await supabase.from('user_passes').insert({
      user_id, pass_type_id,
      classes_remaining: passType.class_count,
      starts_at: startsAt,
      expires_at: expiresAt,
      payment_method: method,
      is_paid: paid,
      created_by: admin.profile.id,
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // Edit an issued pass (expiry, remaining, paid, method)
  if (req.method === 'PATCH') {
    const { id, ...raw } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const allowed = ['expires_at', 'classes_remaining', 'is_paid', 'payment_method', 'starts_at'];
    const updates = {};
    for (const key of allowed) {
      if (raw[key] !== undefined) updates[key] = raw[key];
    }

    const { data, error } = await supabase.from('user_passes').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // Credit back / extend a pass (used when admin cancels a class the student already attended)
  if (req.method === 'PUT') {
    const { id, action, days } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const { data: pass } = await supabase.from('user_passes').select('*').eq('id', id).single();
    if (!pass) return res.status(404).json({ error: 'Pass not found' });

    if (action === 'credit') {
      if (pass.classes_remaining === null) return res.json(pass);
      const { data, error } = await supabase
        .from('user_passes')
        .update({ classes_remaining: pass.classes_remaining + 1 })
        .eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }

    if (action === 'extend') {
      const d = parseInt(days, 10) || 7;
      const nextStr = addDays(pass.expires_at, d);
      const { data, error } = await supabase
        .from('user_passes')
        .update({ expires_at: nextStr })
        .eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }

    return res.status(400).json({ error: 'action must be credit or extend' });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase.from('user_passes').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
