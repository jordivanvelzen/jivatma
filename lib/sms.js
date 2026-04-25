import { supabase } from './supabase.js';

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
  return `+${defaultCC}${digits}`;
}

/**
 * Send an SMS. Never throws. Returns `{ ok, reason?, sid?, twilioError? }`.
 *
 * @param {string} toPhone - student's stored phone (any format)
 * @param {string} text    - message body
 * @param {object} [opts]
 * @param {string} [opts.userId]       - if set, we look up profiles.sms_opt_in and skip when false
 * @param {boolean} [opts.bypassOptIn] - true for admin-only messages (test SMS, admin alerts)
 */
export async function sendSms(toPhone, text, opts = {}) {
  try {
    const { sid, token, from, defaultCC } = getEnvConfig();
    if (!sid || !token || !from) return { ok: false, reason: 'not_configured' };

    // Opt-in gate (skip for admin/test messages)
    if (opts.userId && !opts.bypassOptIn) {
      const { data: profile } = await supabase
        .from('profiles').select('sms_opt_in').eq('id', opts.userId).single();
      if (profile && profile.sms_opt_in === false) {
        return { ok: false, reason: 'opted_out' };
      }
    }

    const { testMode, jordiTestPhone } = await getRuntimeConfig();

    // Reroute in test mode
    let destination = toE164(toPhone, defaultCC);
    if (testMode) {
      const reroute = toE164(jordiTestPhone, defaultCC);
      if (!reroute) return { ok: false, reason: 'test_phone_not_set' };
      destination = reroute;
    }
    if (!destination) return { ok: false, reason: 'invalid_phone' };

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
      return { ok: false, reason: 'send_failed', twilioError: t.slice(0, 300) };
    }
    const json = await res.json();
    return { ok: true, sid: json.sid, status: json.status };
  } catch (err) {
    return { ok: false, reason: 'exception', twilioError: err.message };
  }
}
