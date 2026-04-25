import { supabase } from './supabase.js';

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
 * @param {object} [opts.replyMarkup] — Telegram inline keyboard
 */
export async function sendTelegram(text, opts = {}) {
  try {
    const { token, chatId, testMode } = await getConfig();
    if (!token || !chatId) return { ok: false, reason: 'not_configured' };

    const body = {
      chat_id: chatId,
      text: applyTestPrefix(text, testMode),
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
      return { ok: false, reason: 'send_failed', telegramError: t.slice(0, 200) };
    }
    const json = await res.json();
    return { ok: true, messageId: json?.result?.message_id };
  } catch (err) {
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
        allowed_updates: ['callback_query'],
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
