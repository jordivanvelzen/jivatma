import { verifyAdmin } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';
import { sendTelegram, setTelegramWebhook } from '../../lib/telegram.js';
import { sendSms } from '../../lib/sms.js';
import crypto from 'node:crypto';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) return res.status(500).json({ error: error.message });
    const settings = {};
    (data || []).forEach(s => { settings[s.key] = s.value; });
    return res.json(settings);
  }

  if (req.method === 'PATCH') {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      const { error } = await supabase.from('settings').upsert({ key, value: String(value) });
      if (error) return res.status(500).json({ error: error.message });
    }

    // Auto-register the Telegram webhook whenever the bot token is saved,
    // so inline Approve/Decline buttons "just work" without a manual step.
    if (updates.telegram_bot_token) {
      try {
        const secret = crypto.randomBytes(24).toString('hex');
        await supabase.from('settings').upsert({ key: 'telegram_webhook_secret', value: secret });
        const baseUrl = `https://${req.headers.host}`;
        const webhookUrl = `${baseUrl}/api/pass-requests?webhook=telegram`;
        await setTelegramWebhook(webhookUrl, secret);
      } catch {
        // Non-fatal — settings still saved; the user can re-save to retry
      }
    }

    return res.json({ ok: true });
  }

  // POST — actions (currently only telegram-test)
  if (req.method === 'POST') {
    const action = req.body?.action || req.query?.action;
    if (action === 'telegram-test') {
      const result = await sendTelegram(
        '\u{1F9D8} *Prueba de Jivatma*\n\nSi ves este mensaje, las notificaciones de Telegram est\u00e1n configuradas correctamente.',
        { eventType: 'test', recipientName: 'Admin' }
      );
      if (!result.ok) {
        return res.status(400).json({ ok: false, reason: result.reason, error: result.telegramError });
      }
      return res.json({ ok: true });
    }

    if (action === 'sms-test') {
      // Sends a test SMS. In test_mode it routes to jordi_test_phone; otherwise
      // it requires an explicit `to` in the request body so we never silently
      // text Claudia's number when production toggle is on.
      const { data: testModeRow } = await supabase
        .from('settings').select('value').eq('key', 'test_mode').single();
      const testMode = (testModeRow?.value || '').trim().toLowerCase() === 'true';

      let toPhone = req.body?.to;
      if (testMode) {
        // sendSms will reroute to jordi_test_phone — pass any non-empty placeholder
        toPhone = toPhone || '+10000000000';
      }
      if (!toPhone) {
        return res.status(400).json({ ok: false, reason: 'to_required_in_production' });
      }

      const result = await sendSms(
        toPhone,
        '🧘 Prueba de Jivatma: si recibes este SMS, Twilio está configurado correctamente.',
        { bypassOptIn: true, eventType: 'test', recipientName: 'Admin' }
      );
      if (!result.ok) {
        return res.status(400).json({ ok: false, reason: result.reason, error: result.twilioError });
      }
      return res.json({ ok: true, sid: result.sid });
    }

    if (action === 'register-webhook') {
      // Generate a fresh secret, persist it, then ask Telegram to use it
      const secret = crypto.randomBytes(24).toString('hex');
      await supabase.from('settings').upsert({ key: 'telegram_webhook_secret', value: secret });

      const baseUrl = req.body?.baseUrl || `https://${req.headers.host}`;
      const webhookUrl = `${baseUrl}/api/pass-requests?webhook=telegram`;
      const result = await setTelegramWebhook(webhookUrl, secret);
      if (!result.ok) {
        return res.status(400).json({ ok: false, reason: result.reason, error: result.telegramError });
      }
      return res.json({ ok: true, url: webhookUrl });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
