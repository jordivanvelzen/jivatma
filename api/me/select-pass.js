import { verifyUser } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';
import { todayStr, addDays } from '../../lib/dates.js';

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

  // Stackable: students may hold multiple single-class passes.
  const today = todayStr();
  const startsAt = today;
  const expiresAt = addDays(today, passType.validity_days);

  const { data, error } = await supabase.from('user_passes').insert({
    user_id: auth.user.id,
    pass_type_id,
    classes_remaining: passType.class_count,
    starts_at: startsAt,
    expires_at: expiresAt,
    payment_method: 'cash',
    is_paid: false,
    created_by: auth.user.id,
  }).select('*, pass_types(*)').single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}
