import { verifyUser } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { canBook } from '../lib/bookings.js';

export default async function handler(req, res) {
  const auth = await verifyUser(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, class_sessions(*)')
      .eq('user_id', auth.user.id)
      .is('cancelled_at', null)
      .order('booked_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'POST') {
    const { session_id, attendance_mode = null } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    if (attendance_mode && !['online', 'in_person'].includes(attendance_mode)) {
      return res.status(400).json({ error: 'attendance_mode must be online or in_person' });
    }

    const check = await canBook(session_id, auth.user.id);
    if (!check.ok) return res.status(400).json({ error: check.reason });

    // Check if there's a cancelled booking to reactivate
    const { data: existing } = await supabase
      .from('bookings').select('*')
      .eq('session_id', session_id).eq('user_id', auth.user.id).single();

    if (existing) {
      const { data, error } = await supabase
        .from('bookings')
        .update({ cancelled_at: null, booked_at: new Date().toISOString(), attendance_mode })
        .eq('id', existing.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({ session_id, user_id: auth.user.id, attendance_mode })
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const { error } = await supabase
      .from('bookings')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('session_id', session_id)
      .eq('user_id', auth.user.id)
      .is('cancelled_at', null);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
