import { verifyAdmin } from '../../lib/auth.js';
import { sendTelegram } from '../../lib/telegram.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  const result = await sendTelegram(
    '\u{1F9D8} *Prueba de Jivatma*\n\nSi ves este mensaje, las notificaciones de Telegram están configuradas correctamente.'
  );

  if (!result.ok) {
    return res.status(400).json({
      ok: false,
      reason: result.reason,
      error: result.telegramError,
    });
  }

  return res.json({ ok: true });
}
