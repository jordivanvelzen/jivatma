import { verifyUser } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import {
  sendTelegram,
  editTelegramMessage,
  answerCallbackQuery,
  buildWaLink,
} from '../lib/telegram.js';
import { sendSms } from '../lib/sms.js';
import { todayStr, addDays } from '../lib/dates.js';

function buildApprovedSmsText(firstName, request) {
  const pt = request.pass_types;
  const kindStr = pt?.kind === 'single'
    ? 'Clase Única'
    : pt?.kind === 'multi'
    ? `Pase de ${pt.class_count} Clases`
    : 'Mensual Ilimitado';
  return `Hola ${firstName}, ¡tu pase de ${kindStr} ya está aprobado en Jivatma! Ya puedes reservar tus clases. Nos vemos pronto 🧘`;
}

function buildDeclineSmsText(firstName, reason) {
  return `Hola ${firstName}, tu solicitud de pase en Jivatma no fue aprobada. Motivo: ${reason}. Si tienes preguntas, escríbenos.`;
}

// ---------- helpers ----------

// Escape Telegram legacy-Markdown special chars in user-supplied text
function escMd(s) {
  return String(s || '').replace(/([_*`\[\]])/g, '\\$1');
}

const SMS_REASON_LABEL = {
  not_configured: 'Twilio no configurado',
  opted_out: 'la alumna desactivó SMS',
  invalid_phone: 'teléfono inválido',
  test_phone_not_set: 'teléfono de prueba no configurado',
  send_failed: 'error de envío',
  exception: 'error inesperado',
};

function buildSmsLine(text, hasPhone, result) {
  if (!hasPhone) return '📱 _SMS no enviada \\(sin teléfono\\)_';
  if (!result) return '📱 _SMS no enviada_';
  if (result.ok) return `📱 *SMS enviada:*\n«${escMd(text)}»`;
  const why = SMS_REASON_LABEL[result.reason] || result.reason || 'desconocido';
  return `📱 _SMS no enviada \\(${escMd(why)}\\)_`;
}

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
    `*Pago:* ${methodLabel(request.payment_method)}${paid ? ' ✅ _alumna marcó como pagado_' : ''}`,
  ];
  if (request.notes) lines.push(`*Notas:* ${request.notes}`);

  if (request.payment_method === 'transfer') {
    lines.push('');
    lines.push(paid
      ? '⚠️ _Verifica en el banco antes de aprobar._'
      : '⏳ _Esperando que la alumna confirme pago._');
  } else if (request.payment_method === 'cash') {
    lines.push('');
    lines.push('\u{1F4B5} _Efectivo: cobra en el estudio antes de aprobar._');
  }

  return lines.join('\n');
}

function buildInlineKeyboard(requestId) {
  return {
    inline_keyboard: [[
      { text: '✅ Aprobar', callback_data: `approve:${requestId}` },
      { text: '❌ Rechazar', callback_data: `decline:${requestId}` },
    ]],
  };
}

function buildApprovedMessage({ studentName, request, waLink, smsLine }) {
  const lines = [
    `✅ *Pase aprobado*`,
    ``,
    `*Alumna:* ${studentName}`,
    `*Pase:* ${kindLabel(request.pass_types)}`,
  ];
  if (smsLine) {
    lines.push('');
    lines.push(smsLine);
  }
  lines.push('');
  lines.push(waLink
    ? `[\u{1F4AC} Avisar por WhatsApp](${waLink})`
    : `_(Sin teléfono — avisar a mano)_`);
  return lines.join('\n');
}

function buildDeclinedMessage({ studentName, request, reason, smsLine }) {
  const lines = [
    `❌ *Solicitud rechazada*`,
    ``,
    `*Alumna:* ${studentName}`,
    `*Pase:* ${kindLabel(request.pass_types)}`,
    `*Motivo:* ${escMd(reason)}`,
  ];
  if (smsLine) {
    lines.push('');
    lines.push(smsLine);
  }
  return lines.join('\n');
}

function buildDeclinePromptMessage(requestId, studentName) {
  return [
    `✍️ *Motivo del rechazo*`,
    ``,
    `*Alumna:* ${studentName}`,
    ``,
    `_Responde a este mensaje con el motivo. Verás una vista previa del SMS antes de enviarlo a la alumna._`,
    ``,
    `[#REQ-${requestId}]`,
  ].join('\n');
}

function buildDeclinePreviewMessage({ studentName, reason, smsText }) {
  return [
    `✍️ *Vista previa del SMS de rechazo*`,
    ``,
    `*Alumna:* ${studentName}`,
    `*Motivo:* ${escMd(reason)}`,
    ``,
    `*Mensaje al enviar:*`,
    `«${escMd(smsText)}»`,
    ``,
    `_Confirma para rechazar y enviar el SMS, o cancela._`,
  ].join('\n');
}

function buildDeclineConfirmKeyboard(requestId) {
  return {
    inline_keyboard: [[
      { text: '✅ Confirmar y enviar', callback_data: `decline_send:${requestId}` },
      { text: '❌ Cancelar', callback_data: `decline_cancel:${requestId}` },
    ]],
  };
}

function buildApprovedWaText(firstName, request) {
  return `Hola ${firstName}, ¡tu pase de *${kindLabel(request.pass_types)}* ya está aprobado! Nos vemos pronto en Jivatma. 🧘`;
}

async function sendApprovedSmsAndBuildLine(request, studentName) {
  const firstName = studentName.split(' ')[0];
  const text = buildApprovedSmsText(firstName, request);
  if (!request.profiles?.phone) return { line: buildSmsLine(text, false, null), text };
  const result = await sendSms(request.profiles.phone, text, {
    userId: request.user_id,
    eventType: 'pass_approved',
    recipientName: studentName,
  });
  return { line: buildSmsLine(text, true, result), text };
}

async function sendDeclineSmsAndBuildLine(request, studentName, reason) {
  const firstName = studentName.split(' ')[0];
  const text = buildDeclineSmsText(firstName, reason);
  if (!request.profiles?.phone) return { line: buildSmsLine(text, false, null), text };
  const result = await sendSms(request.profiles.phone, text, {
    userId: request.user_id,
    eventType: 'pass_declined',
    recipientName: studentName,
  });
  return { line: buildSmsLine(text, true, result), text };
}

async function approveRequest(request, adminUserId) {
  if (request.status !== 'pending') return { ok: false, reason: 'already_processed' };

  const { error: updErr } = await supabase
    .from('pass_requests')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', request.id);
  if (updErr) return { ok: false, reason: updErr.message };

  const passType = request.pass_types;
  const startsAt = todayStr();
  const expiresAt = addDays(startsAt, passType.validity_days);

  // Approval is the admin's confirmation that payment has been verified
  // (transfer) or collected (cash), so the new pass is always marked paid.
  const { error: passErr } = await supabase.from('user_passes').insert({
    user_id: request.user_id,
    pass_type_id: request.pass_type_id,
    classes_remaining: passType.class_count,
    starts_at: startsAt,
    expires_at: expiresAt,
    payment_method: request.payment_method || 'cash',
    is_paid: true,
    created_by: adminUserId || null,
  });
  if (passErr) return { ok: false, reason: passErr.message };
  return { ok: true };
}

// ---------- webhook handler (Telegram callback queries + replies) ----------

const REQ_MARKER_RE = /\[#REQ-(\d+)\]/;

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

  // Plain message — only act when it's a reply to a decline-prompt we sent
  if (update.message && !update.callback_query) {
    return handleDeclineReply(update.message, res);
  }

  const cb = update.callback_query;
  if (!cb) return res.json({ ok: true });

  const [action, idStr] = String(cb.data || '').split(':');
  const requestId = parseInt(idStr, 10);
  const known = ['approve', 'decline', 'decline_send', 'decline_cancel'];
  if (!known.includes(action) || !requestId) {
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

  const studentName = request.profiles?.full_name || 'Alumna';

  // Cancel a pending decline draft — clears the stored reason and edits the preview
  if (action === 'decline_cancel') {
    await supabase.from('pass_requests')
      .update({ decline_reason: null }).eq('id', requestId);
    if (cb.message?.message_id) {
      await editTelegramMessage(cb.message.message_id,
        `❌ _Rechazo cancelado. La solicitud sigue pendiente._`,
        { replyMarkup: { inline_keyboard: [] } });
    }
    await answerCallbackQuery(cb.id, 'Cancelado');
    return res.json({ ok: true });
  }

  if (request.status !== 'pending') {
    await answerCallbackQuery(cb.id, 'Ya procesada', true);
    return res.json({ ok: true });
  }

  // Step 1 of decline: ask the admin to type a reason via force_reply
  if (action === 'decline') {
    const promptText = buildDeclinePromptMessage(requestId, studentName);
    await sendTelegram(promptText, {
      replyMarkup: {
        force_reply: true,
        input_field_placeholder: 'Motivo del rechazo…',
        selective: false,
      },
    });
    await answerCallbackQuery(cb.id, 'Escribe el motivo');
    return res.json({ ok: true });
  }

  // Step 3 of decline: confirm — finalize status, SMS the student, edit messages
  if (action === 'decline_send') {
    const reason = (request.decline_reason || '').trim();
    if (!reason) {
      await answerCallbackQuery(cb.id, 'Falta el motivo', true);
      return res.json({ ok: true });
    }
    const { error: declineErr } = await supabase.from('pass_requests')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', requestId);
    if (declineErr) {
      await answerCallbackQuery(cb.id, `Error: ${declineErr.message}`, true);
      return res.json({ ok: true });
    }
    const { line: smsLine } = await sendDeclineSmsAndBuildLine(request, studentName, reason);
    const finalMsg = buildDeclinedMessage({ studentName, request, reason, smsLine });

    if (request.telegram_message_id) {
      await editTelegramMessage(request.telegram_message_id, finalMsg,
        { replyMarkup: { inline_keyboard: [] } });
    } else {
      await sendTelegram(finalMsg);
    }
    if (cb.message?.message_id) {
      await editTelegramMessage(cb.message.message_id,
        `✅ _Rechazo enviado a la alumna._`,
        { replyMarkup: { inline_keyboard: [] } });
    }
    await answerCallbackQuery(cb.id, '✅ Rechazada');
    return res.json({ ok: true });
  }

  // approve
  if (action === 'approve') {
    const result = await approveRequest(request, null);
    if (!result.ok) {
      await answerCallbackQuery(cb.id, `Error: ${result.reason}`, true);
      return res.json({ ok: true });
    }
    const firstName = studentName.split(' ')[0];
    const waLink = buildWaLink(request.profiles?.phone, buildApprovedWaText(firstName, request));
    const { line: smsLine } = await sendApprovedSmsAndBuildLine(request, studentName);
    const editedMsg = buildApprovedMessage({ studentName, request, waLink, smsLine });

    if (request.telegram_message_id) {
      await editTelegramMessage(request.telegram_message_id, editedMsg,
        { replyMarkup: { inline_keyboard: [] } });
    } else {
      await sendTelegram(editedMsg);
    }
    await answerCallbackQuery(cb.id, '✅ Aprobada');
    return res.json({ ok: true });
  }

  return res.json({ ok: true });
}

// Step 2 of decline: admin replied to our prompt — store reason, send preview
async function handleDeclineReply(message, res) {
  const replyTo = message.reply_to_message;
  if (!replyTo?.text) return res.json({ ok: true });
  const m = replyTo.text.match(REQ_MARKER_RE);
  if (!m) return res.json({ ok: true });
  const requestId = parseInt(m[1], 10);
  const reason = String(message.text || '').trim();
  if (!reason) return res.json({ ok: true });

  const { data: request } = await supabase
    .from('pass_requests')
    .select('*, pass_types(*), profiles(full_name, phone)')
    .eq('id', requestId).single();
  if (!request) return res.json({ ok: true });
  if (request.status !== 'pending') {
    await sendTelegram(`_La solicitud ya fue procesada — no se puede rechazar._`);
    return res.json({ ok: true });
  }

  await supabase.from('pass_requests')
    .update({ decline_reason: reason }).eq('id', requestId);

  const studentName = request.profiles?.full_name || 'Alumna';
  const firstName = studentName.split(' ')[0];
  const smsText = buildDeclineSmsText(firstName, reason);
  const previewMsg = buildDeclinePreviewMessage({ studentName, reason, smsText });
  await sendTelegram(previewMsg, { replyMarkup: buildDeclineConfirmKeyboard(requestId) });
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
      const tg = await sendTelegram(msg, { replyMarkup: keyboard, eventType: 'pass_request', recipientName: studentName });
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
        const msg = `❌ *Solicitud rechazada*\n\n*Alumna:* ${studentName}\n*Pase:* ${kindLabel(request.pass_types)}`;
        editTelegramMessage(request.telegram_message_id, msg, { replyMarkup: { inline_keyboard: [] } }).catch(() => {});
      }
      return res.json({ success: true, status });
    }

    const result = await approveRequest(request, auth.user.id);
    if (!result.ok) return res.status(500).json({ error: result.reason });

    // Send SMS first so we can include the result in the edited Telegram msg
    const firstName = studentName.split(' ')[0];
    const waLink = buildWaLink(request.profiles?.phone, buildApprovedWaText(firstName, request));
    const { line: smsLine } = await sendApprovedSmsAndBuildLine(request, studentName);
    const editedMsg = buildApprovedMessage({ studentName, request, waLink, smsLine });
    if (request.telegram_message_id) {
      editTelegramMessage(request.telegram_message_id, editedMsg, { replyMarkup: { inline_keyboard: [] } }).catch(() => {});
    } else {
      sendTelegram(editedMsg).catch(() => {});
    }

    return res.json({ success: true, status });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
