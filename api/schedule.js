import { verifyUser } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  const auth = await verifyUser(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const today = new Date().toISOString().split('T')[0];

    const { data: windowSetting } = await supabase
      .from('settings').select('value').eq('key', 'signup_window_weeks').single();
    const windowWeeks = parseInt(windowSetting?.value || '2', 10);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + windowWeeks * 7);

    const { data, error } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('status', 'scheduled')
      .gte('date', today)
      .lte('date', maxDate.toISOString().split('T')[0])
      .order('date').order('start_time');

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
