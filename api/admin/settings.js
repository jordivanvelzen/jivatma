import { verifyAdmin } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) return res.status(500).json({ error: error.message });
    const settings = {};
    (data || []).forEach(s => { settings[s.key] = s.value; });
    return res.json(settings);
  }

  if (req.method === 'PATCH') {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      const { error } = await supabase.from('settings').upsert({ key, value: String(value) });
      if (error) return res.status(500).json({ error: error.message });
    }
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
