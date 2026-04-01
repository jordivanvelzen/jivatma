import { verifyUser } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyUser(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { pass_type_id } = req.body;
  if (!pass_type_id) return res.status(400).json({ error: 'pass_type_id required' });

  // Only allow self-selection of single-class passes
  const { data: passType } = await supabase
    .from('pass_types')
    .select('*')
    .eq('id', pass_type_id)
    .eq('is_active', true)
    .single();

  if (!passType) return res.status(404).json({ error: 'Pass type not found' });
  if (passType.kind !== 'single') return res.status(400).json({ error: 'Only single-class passes can be self-selected' });

  // Prevent duplicates: check if user already has an active unpaid single pass
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('user_passes')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('pass_type_id', pass_type_id)
    .eq('is_paid', false)
    .gte('expires_at', today)
    .gt('classes_remaining', 0)
    .limit(1);

  if (existing?.length) {
    return res.status(400).json({ error: 'already_has_single_pass' });
  }

  const startsAt = today;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + passType.validity_days);

  const { data, error } = await supabase.from('user_passes').insert({
    user_id: auth.user.id,
    pass_type_id,
    classes_remaining: passType.class_count,
    starts_at: startsAt,
    expires_at: expiresAt.toISOString().split('T')[0],
    payment_method: 'cash',
    is_paid: false,
    created_by: auth.user.id,
  }).select('*, pass_types(*)').single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}
