import { verifyAdmin } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  // GET: list requests
  if (req.method === 'GET') {
    const status = req.query.status || 'pending';
    let query = supabase
      .from('pass_requests')
      .select('*, profiles(full_name), pass_types(*)')
      .order('created_at', { ascending: true });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // PATCH: approve or reject
  if (req.method === 'PATCH') {
    const { id, action, admin_notes } = req.body;
    if (!id || !action) return res.status(400).json({ error: 'id and action required' });
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' });

    // Fetch the request (must be pending)
    const { data: request } = await supabase
      .from('pass_requests')
      .select('*, pass_types(*)')
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    if (!request) return res.status(404).json({ error: 'Pending request not found' });

    if (action === 'approve') {
      const passType = request.pass_types;

      // Create user_passes entry — mark as paid since admin verified payment
      const startsAt = new Date().toISOString().split('T')[0];
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + passType.validity_days);

      const { error: passError } = await supabase.from('user_passes').insert({
        user_id: request.user_id,
        pass_type_id: request.pass_type_id,
        classes_remaining: passType.class_count,
        starts_at: startsAt,
        expires_at: expiresAt.toISOString().split('T')[0],
        payment_method: request.payment_method,
        is_paid: true,
        created_by: admin.profile.id,
      });

      if (passError) return res.status(500).json({ error: passError.message });
    }

    // Update request status
    const { data: updated, error: updateError } = await supabase
      .from('pass_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: admin.profile.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: admin_notes || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.json(updated);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
