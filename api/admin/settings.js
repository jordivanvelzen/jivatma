import { verifyAdmin } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';
import { sendTelegram, setTelegramWebhook } from '../../lib/telegram.js';
import crypto from 'node:crypto';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'GET') {
    if (req.query?.type === 'notifications') {
      const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
      const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);
      const channel    = req.query.channel    || null;
      const event_type = req.query.event_type || null;
      const status     = req.query.status     || null;

      let query = supabase
        .from('notification_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (channel)    query = query.eq('channel',    channel);
      if (event_type) query = query.eq('event_type', event_type);
      if (status)     query = query.eq('status',     status);

      const { data, error, count } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ rows: data || [], total: count ?? 0 });
    }

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
