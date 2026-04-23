import { verifyUser } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { todayStr, addDays } from '../lib/dates.js';

export default async function handler(req, res) {
  const auth = await verifyUser(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const today = todayStr();

    const { data: windowSetting } = await supabase
      .from('settings').select('value').eq('key', 'signup_window_weeks').single();
    const windowWeeks = parseInt(windowSetting?.value || '2', 10);
    const maxDateStr = addDays(today, windowWeeks * 7);

    const { data, error } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('status', 'scheduled')
      .gte('date', today)
      .lte('date', maxDateStr)
      .order('date').order('start_time');

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
