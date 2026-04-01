import { verifyUser } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyUser(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { pass_type_id, payment_method } = req.body;
  if (!pass_type_id) return res.status(400).json({ error: 'pass_type_id required' });
  if (!payment_method || !['transfer', 'cash', 'other'].includes(payment_method)) {
    return res.status(400).json({ error: 'payment_method required (transfer, cash, or other)' });
  }

  // Validate pass type exists and is active
  const { data: passType } = await supabase
    .from('pass_types')
    .select('*')
    .eq('id', pass_type_id)
    .eq('is_active', true)
    .single();

  if (!passType) return res.status(404).json({ error: 'Pass type not found' });

  // Check for existing pending request for same pass type
  const { data: existing } = await supabase
    .from('pass_requests')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('pass_type_id', pass_type_id)
    .eq('status', 'pending')
    .limit(1);

  if (existing?.length) {
    return res.status(400).json({ error: 'already_pending' });
  }

  const { data, error } = await supabase
    .from('pass_requests')
    .insert({
      user_id: auth.user.id,
      pass_type_id,
      payment_method,
    })
    .select('*, pass_types(*)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}
