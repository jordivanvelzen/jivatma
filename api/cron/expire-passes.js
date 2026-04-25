import { supabase } from '../../lib/supabase.js';
import { sendTelegram, buildWaLink } from '../../lib/telegram.js';
import { todayStr } from '../../lib/dates.js';

function passKindLabel(pt) {
  if (!pt) return 'Pase';
  if (pt.kind === 'single') return 'Clase Única';
  if (pt.kind === 'multi') return `Pase de ${pt.class_count} Clases`;
  return 'Mensual Ilimitado';
}

export default async function handler(req, res) {
  const today = todayStr();

  // Passes expiring TODAY — notify admin so she can reach out via WhatsApp
  const { data: expiringToday } = await supabase
    .from('user_passes')
    .select('id, user_id, expires_at, profiles(full_name, phone), pass_types(kind, class_count)')
    .eq('expires_at', today);

  if (expiringToday?.length) {
    const lines = [`📅 *Pases que vencen hoy*`, ``];
    for (const p of expiringToday) {
      const name = p.profiles?.full_name || 'Alumna';
      const kind = passKindLabel(p.pass_types);
      const waText = `Hola ${name.split(' ')[0]}, tu pase de ${kind} en Jivatma vence hoy. ¡Renuévalo antes de tu próxima clase! 🧘`;
      const waLink = buildWaLink(p.profiles?.phone, waText);
      lines.push(waLink ? `• ${name} — ${kind} [💬 WhatsApp](${waLink})` : `• ${name} — ${kind} _(sin teléfono)_`);
    }
    sendTelegram(lines.join('\n'), { eventType: 'expiry_reminder', recipientName: 'Admin' }).catch(() => {});
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
    sendTelegram(lines.join('\n'), { eventType: 'stale_unpaid', recipientName: 'Admin' }).catch(() => {});
  }

  return res.json({
    expiring_today: expiringToday?.length || 0,
    stale_unpaid: staleUnpaid?.length || 0,
  });
}
