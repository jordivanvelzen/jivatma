import { supabase } from './supabase.js';
import { logNotification } from './notification-log.js';

/**
 * SMS via Twilio.
 *
 * Credentials come from env vars (set in Vercel):
 *   - TWILIO_ACCOUNT_SID
 *   - TWILIO_AUTH_TOKEN
 *   - TWILIO_FROM_NUMBER       (E.164, e.g. "+19786257620")
 *   - DEFAULT_COUNTRY_CODE     (e.g. "52" for Mexico, "57" for Colombia) — used when a
 *                              student's stored phone has no country code prefix.
 *
 * Runtime toggles come from the `settings` table:
 *   - test_mode='true'         → all sends are rerouted to `jordi_test_phone`
 *                                (also stored in settings) and prepended with [TEST]
 *
 * Per-recipient gate: students with `profiles.sms_opt_in=false` are skipped.
 */

async function getRuntimeConfig() {
  const { data: rows } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['test_mode', 'jordi_test_phone']);
  const cfg = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
  return {
    testMode: (cfg.test_mode || '').trim().toLowerCase() === 'true',
    jordiTestPhone: cfg.jordi_test_phone?.trim() || '',
  };
}

function getEnvConfig() {
  return {
    sid: (process.env.TWILIO_ACCOUNT_SID || '').trim(),
    token: (process.env.TWILIO_AUTH_TOKEN || '').trim(),
    from: (process.env.TWILIO_FROM_NUMBER || '').trim(),
    defaultCC: (process.env.DEFAULT_COUNTRY_CODE || '52').trim(),
  };
}

/**
 * Normalize a stored phone string to E.164 (`+<digits>`).
 * - Strips spaces, dashes, parens, etc.
 * - If it already starts with `+`, trust it.
 * - Otherwise prepend the default country code.
 * Returns null if there are no digits.
 */
export function toE164(phone, defaultCC) {
  if (!phone) return null;
  const raw = String(phone).trim();
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : null;
  }
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  // >= 11 digits without + means country code is already present (e.g. "525578923883")
  if (digits.length >= 11) return `+${digits}`;
  return `+${defaultCC}${digits}`;
}

/**
 * Send an SMS. Never throws. Returns `{ ok, reason?, sid?, twilioError? }`.
 *
 * @param {string} toPhone - student's stored phone (any format)
 * @param {string} text    - message body
 * @param {object} [opts]
 * @param {string} [opts.userId]         - if set, we look up profiles.sms_opt_in and skip when false
 * @param {boolean} [opts.bypassOptIn]   - true for admin-only messages (test SMS, admin alerts)
 * @param {string} [opts.eventType]      - label for notification_log (e.g. 'pass_approved')
 * @param {string} [opts.recipientName]  - human name for notification_log
 */
export async function sendSms(toPhone, text, opts = {}) {
  const eventType = opts.eventType || 'unknown';
  const recipientName = opts.recipientName || null;

  try {
    const { sid, token, from, defaultCC } = getEnvConfig();
    if (!sid || !token || !from) {
      await logNotification({ channel: 'sms', event_type: eventType, recipient_name: recipientName, message_preview: text, status: 'not_configured' });
      return { ok: false, reason: 'not_configured' };
    }

    // Opt-in gate (skip for admin/test messages)
    if (opts.userId && !opts.bypassOptIn) {
      const { data: profile } = await supabase
        .from('profiles').select('sms_opt_in').eq('id', opts.userId).single();
      if (profile && profile.sms_opt_in === false) {
        await logNotification({ channel: 'sms', event_type: eventType, recipient_name: recipientName, message_preview: text, status: 'opted_out' });
        return { ok: false, reason: 'opted_out' };
      }
    }

    const { testMode, jordiTestPhone } = await getRuntimeConfig();

    // Jordi's Dutch WhatsApp number is stored in his profile but SMS must always
    // go to his Colombian number regardless of what's on file.
    if (opts.userId) {
      const { data: au } = await supabase.auth.admin.getUserById(opts.userId);
      if (au?.user?.email === 'jordi.vanvelzen@gmail.com') {
        toPhone = '+525578923883';
      }
    }

    // Reroute in test mode
    let destination = toE164(toPhone, defaultCC);
    if (testMode) {
      const reroute = toE164(jordiTestPhone, defaultCC);
      if (!reroute) {
        await logNotification({ channel: 'sms', event_type: eventType, recipient_name: recipientName, message_preview: text, status: 'test_phone_not_set', test_mode: true });
        return { ok: false, reason: 'test_phone_not_set' };
      }
      destination = reroute;
    }
    if (!destination) {
      await logNotification({ channel: 'sms', event_type: eventType, recipient_name: recipientName, message_preview: text, status: 'invalid_phone' });
      return { ok: false, reason: 'invalid_phone' };
    }

    const body = testMode ? `[TEST] ${text}` : text;

    // Twilio Messages API — basic auth, form-encoded body
    const params = new URLSearchParams();
    params.set('To', destination);
    params.set('From', from);
    params.set('Body', body);

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    if (!res.ok) {
      const t = await res.text();
      const result = { ok: false, reason: 'send_failed', twilioError: t.slice(0, 300) };
      await logNotification({ channel: 'sms', event_type: eventType, recipient_name: recipientName, recipient_phone: destination, message_preview: body, status: 'failed', error_detail: result.twilioError, test_mode: testMode });
      return result;
    }
    const json = await res.json();
    await logNotification({ channel: 'sms', event_type: eventType, recipient_name: recipientName, recipient_phone: destination, message_preview: body, status: 'sent', test_mode: testMode });
    return { ok: true, sid: json.sid, status: json.status };
  } catch (err) {
    await logNotification({ channel: 'sms', event_type: eventType, recipient_name: recipientName, message_preview: text, status: 'failed', error_detail: err.message });
    return { ok: false, reason: 'exception', twilioError: err.message };
  }
}
