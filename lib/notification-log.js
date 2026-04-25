import { supabase } from './supabase.js';

/**
 * Fire-and-forget logger for outgoing notifications.
 * Never throws — a logging failure must never break the main flow.
 *
 * @param {object} entry
 * @param {'telegram'} entry.channel
 * @param {string} entry.event_type   — e.g. 'pass_request', 'pass_approved', 'expiry_reminder', 'test'
 * @param {string} [entry.recipient_name]
 * @param {string} [entry.recipient_phone]
 * @param {string} [entry.message_preview]   — truncated to 300 chars
 * @param {string} entry.status       — 'sent' | 'failed' | 'opted_out' | 'not_configured' | etc.
 * @param {string} [entry.error_detail]
 * @param {boolean} [entry.test_mode]
 */
export async function logNotification(entry) {
  try {
    await supabase.from('notification_log').insert({
      channel:         entry.channel,
      event_type:      entry.event_type,
      recipient_name:  entry.recipient_name  || null,
      recipient_phone: entry.recipient_phone || null,
      message_preview: entry.message_preview ? String(entry.message_preview).slice(0, 300) : null,
      status:          entry.status,
      error_detail:    entry.error_detail    ? String(entry.error_detail).slice(0, 300) : null,
      test_mode:       entry.test_mode       || false,
    });
  } catch {
    // Intentionally swallowed — logging must not affect the caller
  }
}
