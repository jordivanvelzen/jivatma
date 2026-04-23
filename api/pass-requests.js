import { verifyUser } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import {
  sendTelegram,
  editTelegramMessage,
  answerCallbackQuery,
  buildWaLink,
} from '../lib/telegram.js';

// ---------- helpers ----------

function kindLabel(pt) {
  if (!pt) return 'Pase';
  if (pt.kind === 'single') return 'Clase Única';
  if (pt.kind === 'multi') return `Pase de ${pt.class_count} Clases`;
  return 'Mensual Ilimitado';
}

function methodLabel(m) {
  if (m === 'transfer') return 'Transferencia';
  if (m === 'cash') return 'Efectivo';
  return m || 'N/A';
}

function buildRequestMessage({ studentName, request }) {
  const pt = request.pass_types;
  const priceStr = pt?.price ? `$${parseFloat(pt.price).toFixed(0)} MXN` : '';
  const paid = (request.notes || '').startsWith('[PAID]');
  const lines = [
    `*Nueva solicitud de pase* \u{1F4EC}`,
    ``,
    `*Alumna:* ${studentName}`,
    `*Pase:* ${kindLabel(pt)}${priceStr ? ' · ' + priceStr : ''}`,
    `*Pago:* ${methodLabel(request.payment_method)}${paid ? ' \u2705 _alumna marcó como pagado_' : ''}`,
  ];
  if (request.notes) lines.push(`*Notas:* ${request.notes}`);

  if (request.payment_method === 'transfer') {
    lines.push('');
    lines.push(paid
      ? '\u26a0\ufe0f _Verifica en el banco antes de aprobar._'
      : '\u23f3 _Esperando que la alumna confirme pago._');
  } else if (request.payment_method === 'cash') {
    lines.push('');
    lines.push('\u{1F4B5} _Efectivo: se cobra en el estudio antes de la siguiente clase._');
  }

  return lines.join('\n');
}

function buildInlineKeyboard(requestId) {
  return {
    inline_keyboard: [[
      { text: '\u2705 Aprobar', callback_data: `approve:${requestId}` },
      { text: '\u274c Rechazar', callback_data: `decline:${requestId}` },
    ]],
  };
}

function buildApprovedMessage({ studentName, request, waLink, amount }) {
  const pt = request.pass_types;
  const lines = [
    `\u2705 *Pase aprobado*`,
    ``,
    `*Alumna:* ${studentName}`,
    `*Pase:* ${kindLabel(pt)}`,
  ];
  if (request.payment_method === 'cash' && amount) {
    lines.push(`*Pago:* Efectivo \u2014 *$${amount} pendiente en el estudio*`);
  }
  lines.push('');
  lines.push(waLink
    ? `[\u{1F4AC} Avisar por WhatsApp](${waLink})`
    : `_(Sin teléfono \u2014 avisar a mano)_`);
  return lines.join('\n');
}

async function approveRequest(request, adminUserId) {
  if (request.status !== 'pending') return { ok: false, reason: 'already_processed' };

  const { error: updErr } = await supabase
    .from('pass_requests')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', request.id);
  if (updErr) return { ok: false, reason: updErr.message };

  const passType = request.pass_types;
  const startsAt = new Date().toISOString().split('T')[0];
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + passType.validity_days);

  const { error: passErr } = await supabase.from('user_passes').insert({
    user_id: request.user_id,
    pass_type_id: request.pass_type_id,
    classes_remaining: passType.class_count,
    starts_at: startsAt,
    expires_at: expiresAt.toISOString().split('T')[0],
    payment_method: request.payment_method || 'cash',
    is_paid: false,
    created_by: adminUserId || null,
  });
  if (passErr) return { ok: false, reason: passErr.message };
  return { ok: true };
}

// ---------- webhook handler (Telegram callback query) ----------

async function handleTelegramWebhook(req, res) {
  // Validate secret header Telegram sends with every webhook request
  const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
  const { data: secretRow } = await supabase
    .from('settings').select('value').eq('key', 'telegram_webhook_secret').single();
  const expected = secretRow?.value?.trim();
  if (!expected || secretHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const update = req.body || {};
  const cb = update.callback_query;
  if (!cb) return res.json({ ok: true }); // ignore non-callback updates

  const [action, idStr] = String(cb.data || '').split(':');
  const requestId = parseInt(idStr, 10);
  if (!['approve', 'decline'].includes(action) || !requestId) {
    await answerCallbackQuery(cb.id, 'Acción inválida');
    return res.json({ ok: true });
  }

  const { data: request } = await supabase
    .from('pass_requests')
    .select('*, pass_types(*), profiles(full_name, phone)')
    .eq('id', requestId).single();

  if (!request) {
    await answerCallbackQuery(cb.id, 'Solicitud no encontrada', true);
    return res.json({ ok: true });
  }
  if (request.status !== 'pending') {
    await answerCallbackQuery(cb.id, 'Ya procesada', true);
    return res.json({ ok: true });
  }

  const studentName = request.profiles?.full_name || 'Alumna';

  if (action === 'decline') {
    await supabase.from('pass_requests')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    const msg = `\u274c *Solicitud rechazada*\n\n*Alumna:* ${studentName}\n*Pase:* ${kindLabel(request.pass_types)}`;
    if (request.telegram_message_id) {
      await editTelegramMessage(request.telegram_message_id, msg, { replyMarkup: null });
    }
    await answerCallbackQuery(cb.id, 'Rechazada');
    return res.json({ ok: true });
  }

  // approve
  const result = await approveRequest(request, null);
  if (!result.ok) {
    await answerCallbackQuery(cb.id, `Error: ${result.reason}`, true);
    return res.json({ ok: true });
  }

  const firstName = studentName.split(' ')[0];
  const amount = request.pass_types?.price ? parseFloat(request.pass_types.price).toFixed(0) : null;
  const waText = request.payment_method === 'cash' && amount
    ? `Hola ${firstName}, \u00a1tu pase de *${kindLabel(request.pass_types)}* está aprobado! Recuerda llegar 10 min antes de la próxima clase con $${amount} en efectivo para pagar en el estudio. 🧘`
    : `Hola ${firstName}, \u00a1tu pase de *${kindLabel(request.pass_types)}* ya está aprobado! Nos vemos pronto en Jivatma. \ud83e\uddd8`;
  const waLink = buildWaLink(request.profiles?.phone, waText);

  const editedMsg = buildApprovedMessage({
    studentName, request, waLink,
    amount: request.payment_method === 'cash' ? amount : null,
  });

  if (request.telegram_message_id) {
    await editTelegramMessage(request.telegram_message_id, editedMsg, { replyMarkup: null });
  } else {
    await sendTelegram(editedMsg);
  }
  await answerCallbackQuery(cb.id, '\u2705 Aprobada');
  return res.json({ ok: true });
}

// ---------- main handler ----------

export default async function handler(req, res) {
  // Telegram webhook: POST with ?webhook=telegram + secret header (no user auth)
  if (req.method === 'POST' && req.query?.webhook === 'telegram') {
    return handleTelegramWebhook(req, res);
  }

  const auth = await verifyUser(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const isAdmin = auth.profile.role === 'admin';

  // GET — list requests
  if (req.method === 'GET') {
    let query = supabase
      .from('pass_requests')
      .select('*, pass_types(*), profiles(full_name)')
      .order('created_at', { ascending: false });
    if (!isAdmin) query = query.eq('user_id', auth.user.id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // POST — create a new request (students)
  if (req.method === 'POST') {
    const { pass_type_id, payment_method, notes } = req.body;
    if (!pass_type_id) return res.status(400).json({ error: 'pass_type_id required' });

    const { data: passType } = await supabase
      .from('pass_types').select('*')
      .eq('id', pass_type_id).eq('is_active', true).single();
    if (!passType) return res.status(404).json({ error: 'Pass type not found' });

    const { data: existing } = await supabase
      .from('pass_requests').select('id')
      .eq('user_id', auth.user.id).eq('pass_type_id', pass_type_id)
      .eq('status', 'pending').limit(1);
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

    // Send Telegram notification w/ inline buttons and store message_id so the
    // webhook can edit the same message when admin taps Approve/Decline.
    const studentName = auth.profile.full_name || auth.user.email;
    const msg = buildRequestMessage({ studentName, request: data });
    const keyboard = buildInlineKeyboard(data.id);
    try {
      const tg = await sendTelegram(msg, { replyMarkup: keyboard });
      if (tg.ok && tg.messageId) {
        await supabase.from('pass_requests')
          .update({ telegram_message_id: tg.messageId })
          .eq('id', data.id);
      }
    } catch {}

    return res.status(201).json(data);
  }

  // PATCH — admin approve/decline from the web UI (legacy path)
  if (req.method === 'PATCH') {
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id, status } = req.body;
    if (!id || !['approved', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'id and status (approved/declined) required' });
    }

    const { data: request } = await supabase
      .from('pass_requests')
      .select('*, pass_types(*), profiles(full_name, phone)')
      .eq('id', id).single();
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    const studentName = request.profiles?.full_name || 'Alumna';

    if (status === 'declined') {
      await supabase.from('pass_requests')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (request.telegram_message_id) {
        const msg = `\u274c *Solicitud rechazada*\n\n*Alumna:* ${studentName}\n*Pase:* ${kindLabel(request.pass_types)}`;
        editTelegramMessage(request.telegram_message_id, msg, { replyMarkup: null }).catch(() => {});
      }
      return res.json({ success: true, status });
    }

    const result = await approveRequest(request, auth.user.id);
    if (!result.ok) return res.status(500).json({ error: result.reason });

    // Edit the original message with approval + WhatsApp link
    const firstName = studentName.split(' ')[0];
    const amount = request.pass_types?.price ? parseFloat(request.pass_types.price).toFixed(0) : null;
    const waText = request.payment_method === 'cash' && amount
      ? `Hola ${firstName}, \u00a1tu pase de *${kindLabel(request.pass_types)}* está aprobado! Recuerda llegar 10 min antes de la próxima clase con $${amount} en efectivo para pagar en el estudio. 🧘`
      : `Hola ${firstName}, \u00a1tu pase de *${kindLabel(request.pass_types)}* ya está aprobado! Nos vemos pronto en Jivatma. \ud83e\uddd8`;
    const waLink = buildWaLink(request.profiles?.phone, waText);
    const editedMsg = buildApprovedMessage({
      studentName, request, waLink,
      amount: request.payment_method === 'cash' ? amount : null,
    });
    if (request.telegram_message_id) {
      editTelegramMessage(request.telegram_message_id, editedMsg, { replyMarkup: null }).catch(() => {});
    } else {
      sendTelegram(editedMsg).catch(() => {});
    }

    return res.json({ success: true, status });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
