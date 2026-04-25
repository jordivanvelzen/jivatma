import { verifyAdmin } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'GET') {
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
    const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);
    const channel    = req.query.channel    || null; // 'sms' | 'telegram'
    const event_type = req.query.event_type || null;
    const status     = req.query.status     || null;

    let query = supabase
      .from('notification_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (channel)    query = query.eq('channel',    channel);
    if (event_type) query = query.eq('event_type', event_type);
    if (status)     query = query.eq('status',     status);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ rows: data || [], total: count ?? 0 });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
