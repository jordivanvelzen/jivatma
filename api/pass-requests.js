import { verifyUser, verifyAdmin } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { sendTelegram } from '../lib/telegram.js';

export default async function handler(req, res) {
  const auth = await verifyUser(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const isAdmin = auth.profile.role === 'admin';

  // GET — list requests
  if (req.method === 'GET') {
    let query = supabase
      .from('pass_requests')
      .select('*, pass_types(*), profiles(full_name)')
      .order('created_at', { ascending: false });

    // Non-admins only see their own
    if (!isAdmin) {
      query = query.eq('user_id', auth.user.id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // POST — create a new request (students only)
  if (req.method === 'POST') {
    const { pass_type_id, payment_method, notes } = req.body;
    if (!pass_type_id) return res.status(400).json({ error: 'pass_type_id required' });

    // Check pass type exists and is active
    const { data: passType } = await supabase
      .from('pass_types')
      .select('*')
      .eq('id', pass_type_id)
      .eq('is_active', true)
      .single();

    if (!passType) return res.status(404).json({ error: 'Pass type not found' });

    // Check for existing pending request of same type
    const { data: existing } = await supabase
      .from('pass_requests')
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('pass_type_id', pass_type_id)
      .eq('status', 'pending')
      .limit(1);

    if (existing?.length) {
      return res.status(409).json({ error: 'You already have a pending request for this pass type' });
    }

    const { data, error } = await supabase
      .from('pass_requests')
      .insert({
        user_id: auth.user.id,
        pass_type_id,
        payment_method: payment_method || null,
        notes: notes || null,
      })
      .select('*, pass_types(*)')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Fire-and-forget Telegram notification to admin
    const pt = data.pass_types;
    const kindLabel = pt?.kind === 'single' ? 'Clase Única'
      : pt?.kind === 'multi' ? `Pase de ${pt.class_count} Clases`
      : 'Mensual Ilimitado';
    const priceStr = pt?.price ? `$${parseFloat(pt.price).toFixed(0)} MXN` : '';
    const methodLabel = data.payment_method === 'transfer' ? 'Transferencia'
      : data.payment_method === 'cash' ? 'Efectivo'
      : data.payment_method || 'N/A';
    const paid = (data.notes || '').startsWith('[PAID]');
    const studentName = auth.profile.full_name || auth.user.email;
    const msg = [
      `*Nueva solicitud de pase* \u{1F4EC}`,
      ``,
      `*Alumna:* ${studentName}`,
      `*Pase:* ${kindLabel}${priceStr ? ' · ' + priceStr : ''}`,
      `*Pago:* ${methodLabel}${paid ? ' \u2705 _marcado como pagado_' : ''}`,
      data.notes ? `*Notas:* ${data.notes}` : '',
      ``,
      `Abrir: https://jivatma.vercel.app/#/admin/passes`,
    ].filter(Boolean).join('\n');

    sendTelegram(msg).catch(() => {});

    return res.status(201).json(data);
  }

  // PATCH — admin approve/decline
  if (req.method === 'PATCH') {
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id, status } = req.body;
    if (!id || !['approved', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'id and status (approved/declined) required' });
    }

    // Get the request (with student profile for WhatsApp deeplink)
    const { data: request } = await supabase
      .from('pass_requests')
      .select('*, pass_types(*), profiles(full_name, phone)')
      .eq('id', id)
      .single();

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    // Update status
    const { error: updateError } = await supabase
      .from('pass_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) return res.status(500).json({ error: updateError.message });

    // If approved, create the user_pass
    if (status === 'approved') {
      const passType = request.pass_types;
      const startsAt = new Date().toISOString().split('T')[0];
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + passType.validity_days);

      const { error: passError } = await supabase.from('user_passes').insert({
        user_id: request.user_id,
        pass_type_id: request.pass_type_id,
        classes_remaining: passType.class_count,
        starts_at: startsAt,
        expires_at: expiresAt.toISOString().split('T')[0],
        payment_method: request.payment_method || 'cash',
        is_paid: false,
        created_by: auth.user.id,
      });

      if (passError) return res.status(500).json({ error: passError.message });

      // Telegram nudge: tap-to-WhatsApp so admin can confirm with the student
      const pt = request.pass_types;
      const kindLabel = pt?.kind === 'single' ? 'Clase Única'
        : pt?.kind === 'multi' ? `Pase de ${pt.class_count} Clases`
        : 'Mensual Ilimitado';
      const studentName = request.profiles?.full_name || 'Alumna';
      const firstName = studentName.split(' ')[0];
      let phone = (request.profiles?.phone || '').replace(/[^\d]/g, '');
      // Prepend Mexico country code (52) if it looks like a bare 10-digit local number
      if (phone.length === 10) phone = '52' + phone;
      const waText = encodeURIComponent(
        `Hola ${firstName}, \u00a1tu pase de *${kindLabel}* ya est\u00e1 aprobado! Nos vemos pronto en Jivatma. \ud83e\uddd8`
      );
      const waLink = phone
        ? `https://wa.me/${phone}?text=${waText}`
        : null;

      const lines = [
        `\u2705 *Pase aprobado*`,
        ``,
        `*Alumna:* ${studentName}`,
        `*Pase:* ${kindLabel}`,
        ``,
        waLink
          ? `[Avisar por WhatsApp](${waLink})`
          : `_(Sin tel\u00e9fono guardado \u2014 avisar a mano)_`,
      ];
      sendTelegram(lines.join('\n')).catch(() => {});
    }

    return res.json({ success: true, status });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
