import { verifyUser } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const auth = await verifyUser(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  // Route by query param: /api/me?action=passes or /api/me?action=attendance
  const action = req.query.action || 'profile';

  if (action === 'profile') {
    if (req.method === 'GET') return res.json(auth.profile);
    if (req.method === 'PATCH') {
      const { full_name, phone } = req.body;
      const { data, error } = await supabase.from('profiles').update({ full_name, phone }).eq('id', auth.user.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
  }

  if (action === 'passes') {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('user_passes').select('*, pass_types(*)').eq('user_id', auth.user.id).order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
  }

  if (action === 'attendance') {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('attendance').select('*, class_sessions(*)').eq('user_id', auth.user.id).order('checked_in_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
  }

  if (action === 'requests') {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('pass_requests').select('*, pass_types(*)').eq('user_id', auth.user.id).order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
