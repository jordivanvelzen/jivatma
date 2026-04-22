import { verifyAdmin } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  const isSessions = req.query.type === 'sessions';

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
      const { date, start_time, class_type, capacity, notes } = req.body;
      if (!date || !start_time || !class_type) {
        return res.status(400).json({ error: 'date, start_time, class_type required' });
      }
      const { data, error } = await supabase
        .from('class_sessions')
        .insert({
          template_id: null,
          date, start_time, class_type,
          capacity: capacity || null,
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
    const { day_of_week, start_time, duration_min, class_type, capacity } = req.body;
    const { data, error } = await supabase.from('class_templates').insert({ day_of_week, start_time, duration_min: duration_min || 60, class_type, capacity }).select().single();
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
