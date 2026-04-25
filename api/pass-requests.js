import { verifyUser } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import {
  sendTelegram,
  editTelegramMessage,
  answerCallbackQuery,
  buildWaLink,
  getWaTemplate,
  sendCcEvent,
} from '../lib/telegram.js';
import { todayStr, addDays } from '../lib/dates.js';
import { runGenerate } from './cron/generate-sessions.js';

// ---------- text builders ----------

function buildDeclineWaText(firstName, reason) {
  return getWaTemplate('wa_template_declined', { name: firstName, reason });
}

function buildApprovedWaText(firstName, request) {
  return getWaTemplate('wa_template_approved', {
    name: firstName,
    kind: kindLabel(request.pass_types),
  });
}

// ---------- helpers ----------

function escMd(s) {
  return String(s || '').replace(/([_*`\[\]])/g, '\\$1');
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

function methodLabelEn(m) {
  if (m === 'transfer') return 'Bank transfer';
  if (m === 'cash') return 'Cash';
  return m || 'N/A';
}

function kindLabelEn(pt) {
  if (!pt) return 'Pass';
  if (pt.kind === 'single') return 'Single class';
  if (pt.kind === 'multi') return `${pt.class_count}-class pass`;
  return 'Unlimited monthly';
}

function buildRequestMessageEn({ studentName, request }) {
  const pt = request.pass_types;
  const priceStr = pt?.price ? `$${parseFloat(pt.price).toFixed(0)} MXN` : '';
  const paid = (request.notes || '').startsWith('[PAID]');
  const lines = [
    `*New pass request* 📬`,
    ``,
    `*Student:* ${studentName}`,
    `*Pass:* ${kindLabelEn(pt)}${priceStr ? ' · ' + priceStr : ''}`,
    `*Payment:* ${methodLabelEn(request.payment_method)}${paid ? ' ✅ _student marked as paid_' : ''}`,
  ];
  if (request.notes) lines.push(`*Notes:* ${request.notes}`);
  if (request.payment_method === 'transfer') {
    lines.push('');
    lines.push(paid
      ? '⚠️ _Verify in bank before approving._'
      : '⏳ _Waiting for student to confirm payment._');
  } else if (request.payment_method === 'cash') {
    lines.push('');
    lines.push('💵 _Cash: collect at the studio before approving._');
  }
  return lines.join('\n');
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

function buildApprovedMessage({ studentName, request, waLink }) {
  const lines = [
    `✅ *Pase aprobado*`,
    ``,
    `*Alumna:* ${studentName}`,
    `*Pase:* ${kindLabel(request.pass_types)}`,
    ``,
    waLink
      ? `[\u{1F4AC} Avisar por WhatsApp](${waLink})`
      : `_(Sin teléfono — avisar a mano)_`,
  ];
  return lines.join('\n');
}

function buildDeclinedMessage({ studentName, request, reason, waLink }) {
  const lines = [
    `❌ *Solicitud rechazada*`,
    ``,
    `*Alumna:* ${studentName}`,
    `*Pase:* ${kindLabel(request.pass_types)}`,
    `*Motivo:* ${escMd(reason)}`,
    ``,
    waLink
      ? `[\u{1F4AC} Avisar por WhatsApp](${waLink})`
      : `_(Sin teléfono — avisar a mano)_`,
  ];
  return lines.join('\n');
}

function buildDeclinePromptMessage(requestId, studentName) {
  return [
    `✍️ *Motivo del rechazo*`,
    ``,
    `*Alumna:* ${studentName}`,
    ``,
    `_Responde a este mensaje con el motivo. Verás una vista previa del mensaje de WhatsApp antes de confirmar._`,
    ``,
    `[#REQ-${requestId}]`,
  ].join('\n');
}

function buildDeclinePreviewMessage({ studentName, reason, waLink }) {
  const lines = [
    `✍️ *Vista previa del rechazo*`,
    ``,
    `*Alumna:* ${studentName}`,
    `*Motivo:* ${escMd(reason)}`,
    ``,
    `_Confirma para marcar como rechazado y enviar el aviso por WhatsApp._`,
  ];
  if (waLink) {
    lines.push('');
    lines.push(`[\u{1F4AC} Abrir WhatsApp](${waLink})`);
  }
  return lines.join('\n');
}

function buildDeclineConfirmKeyboard(requestId) {
  return {
    inline_keyboard: [[
      { text: '✅ Confirmar rechazo', callback_data: `decline_send:${requestId}` },
      { text: '❌ Cancelar', callback_data: `decline_cancel:${requestId}` },
    ]],
  };
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
  const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
  const { data: secretRow } = await supabase
    .from('settings').select('value').eq('key', 'telegram_webhook_secret').single();
  const expected = secretRow?.value?.trim();
  if (!expected || secretHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const update = req.body || {};

  if (update.message && !update.callback_query) {
    return handleDeclineReply(update.message, res);
  }

  const cb = update.callback_query;
  if (!cb) return res.json({ ok: true });

  // ---- CC no-op ----
  // Buttons on Jordi's CC copy carry callback_data prefixed with `cc_noop:`. They
  // exist so the message looks identical to Claudia's, but tapping them does nothing
  // beyond a toast. Real actions still come from Claudia's chat.
  if (String(cb.data || '').startsWith('cc_noop:')) {
    await answerCallbackQuery(cb.id, 'CC copy — actions go to Claudia.', true);
    return res.json({ ok: true });
  }

  // ---- Bi-weekly schedule-extend nudge ----
  // Callback data: 'ext:approve:<windowDays>' or 'ext:skip:0'.
  if (String(cb.data || '').startsWith('ext:')) {
    return handleExtendCallback(cb, res);
  }

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

  // Step 3 of decline: confirm — finalize status, edit messages, WA link shown
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
    const firstName = studentName.split(' ')[0];
    const waLink = buildWaLink(request.profiles?.phone, await buildDeclineWaText(firstName, reason));
    const finalMsg = buildDeclinedMessage({ studentName, request, reason, waLink });

    if (request.telegram_message_id) {
      await editTelegramMessage(request.telegram_message_id, finalMsg,
        { replyMarkup: { inline_keyboard: [] } });
    } else {
      await sendTelegram(finalMsg);
    }
    if (cb.message?.message_id) {
      await editTelegramMessage(cb.message.message_id,
        `✅ _Rechazo confirmado._`,
        { replyMarkup: { inline_keyboard: [] } });
    }
    sendCcEvent(`❌ Claudia declined ${studentName}'s pass request. Reason: ${reason}`).catch(() => {});
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
    const waLink = buildWaLink(request.profiles?.phone, await buildApprovedWaText(firstName, request));
    const editedMsg = buildApprovedMessage({ studentName, request, waLink });

    if (request.telegram_message_id) {
      await editTelegramMessage(request.telegram_message_id, editedMsg,
        { replyMarkup: { inline_keyboard: [] } });
    } else {
      await sendTelegram(editedMsg);
    }
    sendCcEvent(`✅ Claudia approved ${studentName}'s pass request (${kindLabel(request.pass_types)}).`).catch(() => {});
    await answerCallbackQuery(cb.id, '✅ Aprobada');
    return res.json({ ok: true });
  }

  return res.json({ ok: true });
}

// Bi-weekly schedule-extend nudge — handle the inline button taps from the
// Telegram message sent by the expire-passes cron on Monday mornings.
//
// callback_data: 'ext:approve:<windowDays>' or 'ext:skip:0'
async function handleExtendCallback(cb, res) {
  const parts = String(cb.data || '').split(':');
  const verb = parts[1];
  const windowDays = Math.max(parseInt(parts[2], 10) || 0, 14);

  if (verb === 'skip') {
    if (cb.message?.message_id) {
      await editTelegramMessage(cb.message.message_id, '⏭ _Saltado. Te preguntamos otra vez en 2 semanas._', { replyMarkup: { inline_keyboard: [] } });
    }
    sendCcEvent(`⏭ Claudia skipped the schedule-extend prompt. Next nudge in ~2 weeks.`).catch(() => {});
    await answerCallbackQuery(cb.id, 'OK');
    return res.json({ ok: true });
  }

  if (verb !== 'approve') {
    await answerCallbackQuery(cb.id, 'Acción inválida');
    return res.json({ ok: true });
  }

  await answerCallbackQuery(cb.id, 'Generando…');
  let result;
  try {
    result = await runGenerate({ windowDays });
  } catch (err) {
    if (cb.message?.message_id) {
      await editTelegramMessage(cb.message.message_id,
        `❌ _Error al extender: ${err.message}_`,
        { replyMarkup: { inline_keyboard: [] } });
    }
    return res.json({ ok: false, error: err.message });
  }

  const summary = `+${result.created || 0} · ⊘${result.autoCancelled || 0} · ↺${result.restored || 0}`;
  if (cb.message?.message_id) {
    const errLine = result.errors?.length ? `\n_⚠ ${result.errors.length} error(es) — revisa el log de Vercel_` : '';
    await editTelegramMessage(cb.message.message_id,
      `✅ *Horario extendido* — ventana ${windowDays} días\n${summary}${errLine}`,
      { replyMarkup: { inline_keyboard: [] } });
  }
  sendCcEvent(`✅ Claudia extended the schedule by ${windowDays} days. Counts: ${summary}.`).catch(() => {});
  return res.json({ ok: true, result });
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
  const waLink = buildWaLink(request.profiles?.phone, await buildDeclineWaText(firstName, reason));
  const previewMsg = buildDeclinePreviewMessage({ studentName, reason, waLink });
  await sendTelegram(previewMsg, { replyMarkup: buildDeclineConfirmKeyboard(requestId) });
  return res.json({ ok: true });
}

// ---------- main handler ----------

export default async function handler(req, res) {
  if (req.method === 'POST' && req.query?.webhook === 'telegram') {
    return handleTelegramWebhook(req, res);
  }

  const auth = await verifyUser(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const isAdmin = auth.profile.role === 'admin';

  if (req.method === 'GET') {
    let query = supabase
      .from('pass_requests')
      .select('*, pass_types(*), profiles(full_name)')
      .order('created_at', { ascending: false });
    if (!isAdmin || req.query?.mine === 'true') query = query.eq('user_id', auth.user.id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

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

    const studentName = auth.profile.full_name || auth.user.email;
    const msg = buildRequestMessage({ studentName, request: data });
    const msgEn = buildRequestMessageEn({ studentName, request: data });
    const keyboard = buildInlineKeyboard(data.id);
    try {
      const tg = await sendTelegram(msg, { replyMarkup: keyboard, eventType: 'pass_request', recipientName: studentName, englishText: msgEn });
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

    const firstName = studentName.split(' ')[0];
    const waLink = buildWaLink(request.profiles?.phone, await buildApprovedWaText(firstName, request));
    const editedMsg = buildApprovedMessage({ studentName, request, waLink });
    if (request.telegram_message_id) {
      editTelegramMessage(request.telegram_message_id, editedMsg, { replyMarkup: { inline_keyboard: [] } }).catch(() => {});
    } else {
      sendTelegram(editedMsg).catch(() => {});
    }

    return res.json({ success: true, status });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
