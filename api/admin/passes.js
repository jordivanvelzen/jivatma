import { verifyAdmin } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  // Route: /api/admin/passes?type=types for pass type management
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
    let query = supabase.from('user_passes').select('*, pass_types(*), profiles(full_name)').order('created_at', { ascending: false });
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

    const startsAt = new Date().toISOString().split('T')[0];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + passType.validity_days);

    const { data, error } = await supabase.from('user_passes').insert({
      user_id, pass_type_id,
      classes_remaining: passType.class_count,
      starts_at: startsAt,
      expires_at: expiresAt.toISOString().split('T')[0],
      payment_method: payment_method || 'cash',
      is_paid: is_paid || false,
      created_by: admin.profile.id,
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
