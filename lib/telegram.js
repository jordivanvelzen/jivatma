import { supabase } from './supabase.js';
import { logNotification } from './notification-log.js';

async function getConfig() {
  const { data: rows } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'telegram_bot_token',
      'telegram_chat_id',
      'telegram_webhook_secret',
      'test_mode',
      'jordi_telegram_chat_id',
    ]);

  const cfg = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
  const testMode = (cfg.test_mode || '').trim().toLowerCase() === 'true';
  const claudiaId = cfg.telegram_chat_id?.trim() || '';
  const jordiId = cfg.jordi_telegram_chat_id?.trim() || '';

  // In test mode, route to Jordi's chat (fallback to Claudia's if Jordi isn't set yet).
  // In production, route to Claudia's chat (fallback to Jordi's so things still arrive
  // somewhere if Claudia's chat_id is ever cleared).
  const chatId = testMode ? (jordiId || claudiaId) : (claudiaId || jordiId);

  return {
    token: cfg.telegram_bot_token?.trim() || '',
    chatId,
    webhookSecret: cfg.telegram_webhook_secret?.trim() || '',
    testMode,
  };
}

function applyTestPrefix(text, testMode) {
  if (!testMode) return text;
  // Prepend a visible marker so test sends are obvious. Markdown-safe.
  return `🧪 *\\[TEST\\]*\n${text}`;
}

/**
 * Send a Telegram message to the configured admin chat.
 * Returns `{ ok, messageId?, reason?, telegramError? }`. Never throws.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {object} [opts.replyMarkup]    — Telegram inline keyboard
 * @param {string} [opts.eventType]      — label for notification_log
 * @param {string} [opts.recipientName]  — human name for notification_log
 */
export async function sendTelegram(text, opts = {}) {
  const eventType     = opts.eventType     || 'unknown';
  const recipientName = opts.recipientName || 'Admin';

  try {
    const { token, chatId, testMode } = await getConfig();
    if (!token || !chatId) {
      await logNotification({ channel: 'telegram', event_type: eventType, recipient_name: recipientName, message_preview: text, status: 'not_configured' });
      return { ok: false, reason: 'not_configured' };
    }

    const finalText = applyTestPrefix(text, testMode);
    const body = {
      chat_id: chatId,
      text: finalText,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };
    if (opts.replyMarkup) body.reply_markup = opts.replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text();
      const result = { ok: false, reason: 'send_failed', telegramError: t.slice(0, 200) };
      await logNotification({ channel: 'telegram', event_type: eventType, recipient_name: recipientName, message_preview: text, status: 'failed', error_detail: result.telegramError, test_mode: testMode });
      return result;
    }
    const json = await res.json();
    await logNotification({ channel: 'telegram', event_type: eventType, recipient_name: recipientName, message_preview: text, status: 'sent', test_mode: testMode });
    return { ok: true, messageId: json?.result?.message_id };
  } catch (err) {
    await logNotification({ channel: 'telegram', event_type: eventType, recipient_name: recipientName, message_preview: text, status: 'failed', error_detail: err.message });
    return { ok: false, reason: 'exception', telegramError: err.message };
  }
}

/**
 * Edit a previously sent message (text + optional new inline keyboard).
 */
export async function editTelegramMessage(messageId, text, opts = {}) {
  try {
    const { token, chatId, testMode } = await getConfig();
    if (!token || !chatId || !messageId) return { ok: false, reason: 'not_configured' };

    const body = {
      chat_id: chatId,
      message_id: messageId,
      text: applyTestPrefix(text, testMode),
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };
    if (opts.replyMarkup !== undefined) body.reply_markup = opts.replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, reason: 'edit_failed', telegramError: t.slice(0, 200) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'exception', telegramError: err.message };
  }
}

/**
 * Answer a callback query (pop-up toast in Telegram after inline button tap).
 */
export async function answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  try {
    const { token } = await getConfig();
    if (!token || !callbackQueryId) return { ok: false };
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: showAlert }),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Set the Telegram webhook URL. Called from the admin settings page once
 * the bot token + chat ID are configured.
 */
export async function setTelegramWebhook(url, secret) {
  try {
    const { token } = await getConfig();
    if (!token) return { ok: false, reason: 'not_configured' };
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token: secret,
        allowed_updates: ['callback_query', 'message'],
      }),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, reason: 'register_failed', telegramError: json.description };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'exception', telegramError: err.message };
  }
}

/**
 * Build a Markdown-safe WhatsApp deeplink for a student.
 * Returns null when phone is missing.
 */
export function buildWaLink(phone, text) {
  let clean = (phone || '').replace(/[^\d]/g, '');
  if (!clean) return null;
  if (clean.length === 10) clean = '52' + clean; // MX country code
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

// Editable WhatsApp message templates — admin can override these from the
// settings page. Placeholders: {name}, {kind}, {reason}.
export const WA_TEMPLATE_DEFAULTS = {
  wa_template_approved:
    'Hola {name}, ¡tu pase de *{kind}* ya está aprobado! Nos vemos pronto en Jivatma. 🧘',
  wa_template_declined:
    'Hola {name}, tu solicitud de pase en Jivatma no fue aprobada. Motivo: {reason}. Si tienes preguntas, escríbenos. 🙏',
  wa_template_expiring:
    'Hola {name}, tu pase de {kind} en Jivatma vence hoy. ¡Renuévalo antes de tu próxima clase! 🧘',
  wa_template_last_class:
    'Hola {name}, acabas de usar tu última clase del {kind} en Jivatma. ¡Renueva tu pase para seguir reservando! 🧘',
  wa_template_class_cancelled:
    'Hola {name}, te avisamos que la clase del {date} a las {time} en Jivatma fue cancelada{reason}. Lamentamos las molestias. Avísanos si quieres reagendar. 🙏',
  wa_template_welcome:
    '¡Hola {name}! 🙏 Bienvenida/o a Jivatma. Ya puedes entrar a la app y elegir tu pase. Si necesitas ayuda, escríbenos por aquí. 🧘',
};

export async function getWaTemplate(key, vars = {}) {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  let tpl = (data?.value && data.value.trim()) || WA_TEMPLATE_DEFAULTS[key] || '';
  for (const [k, v] of Object.entries(vars)) {
    tpl = tpl.split(`{${k}}`).join(v ?? '');
  }
  return tpl;
}

// Markdown special chars that need backslash-escaping in Telegram MarkdownV1.
function tgEscape(s) {
  return String(s ?? '').replace(/([_*`\[\]])/g, '\\$1');
}

/**
 * Notify the admin Telegram chat about one or more newly-cancelled sessions that have
 * active bookings. Sends one message per session, listing each affected student with a
 * pre-filled WhatsApp deeplink so Claudia can tap-to-message them. No-op (silently)
 * for sessions with no active bookings.
 *
 * @param {number[]} sessionIds
 */
export async function notifySessionsCancelled(sessionIds) {
  if (!sessionIds?.length) return { sent: 0 };

  const { data: sessions } = await supabase
    .from('class_sessions')
    .select('id, date, start_time, class_type, cancellation_reason')
    .in('id', sessionIds);
  if (!sessions?.length) return { sent: 0 };

  const { data: bookings } = await supabase
    .from('bookings')
    .select('session_id, profiles(id, full_name, phone)')
    .in('session_id', sessionIds)
    .is('cancelled_at', null);

  const bySession = new Map();
  for (const b of bookings || []) {
    if (!b.profiles) continue;
    const list = bySession.get(b.session_id) || [];
    list.push(b.profiles);
    bySession.set(b.session_id, list);
  }

  let sent = 0;
  for (const s of sessions) {
    const students = bySession.get(s.id) || [];
    if (!students.length) continue;

    const dateStr = new Date(s.date + 'T00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const timeStr = s.start_time.slice(0, 5);
    const reasonRaw = s.cancellation_reason || '';
    const reasonClause = reasonRaw ? ` por ${reasonRaw}` : '';
    const reasonLine = reasonRaw ? `\n_Motivo:_ ${tgEscape(reasonRaw)}` : '';

    const lines = [
      `⊘ *Clase cancelada*`,
      `${tgEscape(dateStr)} · ${timeStr}${reasonLine}`,
      ``,
      `Avisar a *${students.length}* alumno(s):`,
    ];
    for (const stu of students) {
      const wa = await getWaTemplate('wa_template_class_cancelled', {
        name: stu.full_name || 'amigo/a',
        date: dateStr,
        time: timeStr,
        reason: reasonClause,
      });
      const link = buildWaLink(stu.phone, wa);
      if (link) {
        lines.push(`• [${tgEscape(stu.full_name || 'Sin nombre')}](${link})`);
      } else {
        lines.push(`• ${tgEscape(stu.full_name || 'Sin nombre')} _(sin teléfono)_`);
      }
    }

    const res = await sendTelegram(lines.join('\n'), {
      eventType: 'class_cancelled',
      recipientName: 'Admin',
    });
    if (res?.ok) sent++;
  }
  return { sent };
}

/**
 * Notify the admin Telegram chat that a new user just signed up.
 * Sends an informational message with the student's name + email + phone, and
 * a pre-filled WhatsApp deeplink (using the `wa_template_welcome` template) so
 * Claudia can tap-to-greet them. No buttons, no approval — purely informational.
 */
export async function notifyNewSignup({ full_name, email, phone }) {
  const name = full_name || 'Sin nombre';
  const phoneClean = (phone || '').trim();
  const lines = [
    `📝 *Nuevo registro*`,
    `*${tgEscape(name)}*`,
    `✉️ ${tgEscape(email || '—')}`,
    phoneClean ? `📱 ${tgEscape(phoneClean)}` : `📱 _sin teléfono_`,
  ];

  if (phoneClean) {
    const wa = await getWaTemplate('wa_template_welcome', { name });
    const link = buildWaLink(phoneClean, wa);
    if (link) {
      lines.push('');
      lines.push(`💬 [Saludar por WhatsApp](${link})`);
    }
  }

  return sendTelegram(lines.join('\n'), {
    eventType: 'new_signup',
    recipientName: 'Admin',
  });
}
