import { supabase } from './supabase.js';

/**
 * Send a Telegram message to the configured admin chat.
 * Reads bot token + chat ID from the `settings` table; no-ops if unset.
 * Never throws — notifications must not block business logic.
 *
 * @param {string} text — message text (supports Markdown)
 * @returns {Promise<{ ok: boolean, reason?: string, telegramError?: string }>}
 */
export async function sendTelegram(text) {
  try {
    const { data: rows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['telegram_bot_token', 'telegram_chat_id']);

    const cfg = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
    const token = cfg.telegram_bot_token?.trim();
    const chatId = cfg.telegram_chat_id?.trim();

    if (!token || !chatId) {
      return { ok: false, reason: 'not_configured' };
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: 'send_failed', telegramError: body.slice(0, 200) };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'exception', telegramError: err.message };
  }
}
