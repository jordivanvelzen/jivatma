import { supabase } from '../../lib/supabase.js';
import { sendTelegram } from '../../lib/telegram.js';
import { sendSms } from '../../lib/sms.js';
import { todayStr, addDays } from '../../lib/dates.js';

// SMS-throttling: only nudge each pass once per status (so the cron
// doesn't spam students every day with the same expiring-soon warning).
async function shouldNotifySms(userPassId, kind) {
  // We piggy-back on a tiny `sms_log` table if present, else just send.
  // Schema is intentionally lightweight: (user_pass_id INT, kind TEXT, sent_at TIMESTAMPTZ).
  // If the table doesn't exist yet, this query fails silently and we always send —
  // acceptable for a daily cron.
  const { data, error } = await supabase
    .from('sms_log')
    .select('id')
    .eq('user_pass_id', userPassId)
    .eq('kind', kind)
    .limit(1);
  if (error) return true; // table missing → don't block sending
  return !data?.length;
}

async function recordSmsSent(userPassId, kind) {
  await supabase.from('sms_log').insert({ user_pass_id: userPassId, kind }).then(() => {}, () => {});
}

function passKindLabel(pt) {
  if (!pt) return 'Pase';
  if (pt.kind === 'single') return 'Clase Única';
  if (pt.kind === 'multi') return `Pase de ${pt.class_count} Clases`;
  return 'Mensual Ilimitado';
}

export default async function handler(req, res) {
  const today = todayStr();

  // Find passes expiring in the next 3 days
  const threeDaysStr = addDays(today, 3);

  const { data: expiringSoon } = await supabase
    .from('user_passes')
    .select('id, user_id, expires_at, profiles(full_name, phone, sms_opt_in), pass_types(kind, class_count)')
    .gte('expires_at', today)
    .lte('expires_at', threeDaysStr);

  const { data: lowClasses } = await supabase
    .from('user_passes')
    .select('id, user_id, classes_remaining, profiles(full_name, phone, sms_opt_in), pass_types(kind, class_count)')
    .gte('expires_at', today)
    .gt('classes_remaining', 0)
    .lte('classes_remaining', 2);

  // SMS each expiring student (best-effort, throttled to once per pass per kind)
  for (const p of (expiringSoon || [])) {
    if (!p.profiles?.phone) continue;
    if (p.profiles?.sms_opt_in === false) continue;
    if (!(await shouldNotifySms(p.id, 'expiring'))) continue;
    const firstName = (p.profiles.full_name || '').split(' ')[0] || 'alumna';
    const daysLeft = Math.ceil((new Date(p.expires_at) - new Date(today)) / 86400000);
    const whenStr = daysLeft <= 0 ? 'hoy' : daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`;
    const text = `Hola ${firstName}, tu pase de Jivatma vence ${whenStr}. ¡Aprovecha tus clases restantes! 🧘`;
    const result = await sendSms(p.profiles.phone, text, { userId: p.user_id });
    if (result.ok) await recordSmsSent(p.id, 'expiring');
  }

  for (const p of (lowClasses || [])) {
    if (!p.profiles?.phone) continue;
    if (p.profiles?.sms_opt_in === false) continue;
    if (!(await shouldNotifySms(p.id, 'low_classes'))) continue;
    const firstName = (p.profiles.full_name || '').split(' ')[0] || 'alumna';
    const left = p.classes_remaining;
    const text = `Hola ${firstName}, te ${left === 1 ? 'queda' : 'quedan'} ${left} ${left === 1 ? 'clase' : 'clases'} en tu pase de Jivatma. ¡Reserva pronto! 🧘`;
    const result = await sendSms(p.profiles.phone, text, { userId: p.user_id });
    if (result.ok) await recordSmsSent(p.id, 'low_classes');
  }

  // Stale unpaid passes (>3 days since creation, still not paid, still active)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: staleUnpaid } = await supabase
    .from('user_passes')
    .select('id, created_at, profiles(full_name), pass_types(kind, price, class_count)')
    .eq('is_paid', false)
    .gte('expires_at', today)
    .lte('created_at', threeDaysAgo.toISOString());

  if (staleUnpaid?.length) {
    const lines = [`\u{1F4B5} *Cobros pendientes*`, ``];
    for (const p of staleUnpaid) {
      const pt = p.pass_types;
      const kind = passKindLabel(pt);
      const price = pt?.price ? `$${parseFloat(pt.price).toFixed(0)}` : '';
      const name = p.profiles?.full_name || 'Alumna';
      const ageDays = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);
      lines.push(`• ${name} — ${kind}${price ? ' ' + price : ''} _(${ageDays}d)_`);
    }
    sendTelegram(lines.join('\n')).catch(() => {});
  }

  return res.json({
    expiring_soon: expiringSoon?.length || 0,
    low_classes: lowClasses?.length || 0,
    stale_unpaid: staleUnpaid?.length || 0,
  });
}
