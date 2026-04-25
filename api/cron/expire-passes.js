import { supabase } from '../../lib/supabase.js';
import { sendTelegram, buildWaLink, getWaTemplate } from '../../lib/telegram.js';
import { todayStr, addDays } from '../../lib/dates.js';

// Bi-weekly Monday nudge: ask Claudia if she wants to extend the schedule by 2 more weeks.
// Runs from inside the daily expire-passes cron (we're at the Vercel Hobby function limit so
// this can't be its own endpoint). Cadence is enforced via settings.extend_nudge_last_sent —
// fires only on Mondays (studio TZ) and only if 13+ days have passed since the last send.
async function maybeSendExtendNudge() {
  const today = todayStr();
  // Day-of-week in studio TZ. We anchored to en-CA so the parts come back stable.
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (dow !== 1) return { skipped: 'not_monday' };

  const { data: lastRow } = await supabase
    .from('settings').select('value').eq('key', 'extend_nudge_last_sent').maybeSingle();
  const lastSent = lastRow?.value || '';
  if (lastSent && addDays(lastSent, 13) > today) {
    return { skipped: 'too_soon', lastSent };
  }

  // Find the latest scheduled session date so the message gives Claudia useful context.
  const { data: latest } = await supabase
    .from('class_sessions')
    .select('date')
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date', { ascending: false })
    .limit(1);
  const latestDate = latest?.[0]?.date || today;

  const fmt = (d) => new Date(d + 'T00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const text = [
    `🗓 *¿Extender el horario?*`,
    ``,
    `Hoy hay clases hasta el *${fmt(latestDate)}*.`,
    `¿Generar 2 semanas más para que los alumnos puedan reservar más adelante?`,
  ].join('\n');

  const fmtEn = (d) => new Date(d + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const textEn = [
    `🗓 *Extend the schedule?*`,
    ``,
    `Schedule currently covers through *${fmtEn(latestDate)}*.`,
    `Generate 2 more weeks so students can book further out?`,
  ].join('\n');

  const res = await sendTelegram(text, {
    eventType: 'extend_nudge',
    recipientName: 'Admin',
    englishText: textEn,
    replyMarkup: {
      inline_keyboard: [[
        { text: '✅ Sí, extender 2 semanas', callback_data: 'ext:approve:28' },
        { text: '⏭ Ahora no', callback_data: 'ext:skip:0' },
      ]],
    },
  });

  if (res?.ok) {
    await supabase.from('settings').upsert({ key: 'extend_nudge_last_sent', value: today });
  }
  return { sent: !!res?.ok, latestDate };
}

function passKindLabel(pt) {
  if (!pt) return 'Pase';
  if (pt.kind === 'single') return 'Clase Única';
  if (pt.kind === 'multi') return `Pase de ${pt.class_count} Clases`;
  return 'Mensual Ilimitado';
}

function passKindLabelEn(pt) {
  if (!pt) return 'Pass';
  if (pt.kind === 'single') return 'Single class';
  if (pt.kind === 'multi') return `${pt.class_count}-class pass`;
  return 'Unlimited monthly';
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
    const linesEn = [`📅 *Passes expiring today*`, ``];
    for (const p of expiringToday) {
      const name = p.profiles?.full_name || 'Alumna';
      const kind = passKindLabel(p.pass_types);
      const kindEn = passKindLabelEn(p.pass_types);
      const waText = await getWaTemplate('wa_template_expiring', { name: name.split(' ')[0], kind });
      const waLink = buildWaLink(p.profiles?.phone, waText);
      lines.push(waLink ? `• ${name} — ${kind} [💬 WhatsApp](${waLink})` : `• ${name} — ${kind} _(sin teléfono)_`);
      linesEn.push(waLink ? `• ${name} — ${kindEn} [💬 WhatsApp](${waLink})` : `• ${name} — ${kindEn} _(no phone)_`);
    }
    sendTelegram(lines.join('\n'), { eventType: 'expiry_reminder', recipientName: 'Admin', englishText: linesEn.join('\n') }).catch(() => {});
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
    const linesEn = [`💵 *Pending payments*`, ``];
    for (const p of staleUnpaid) {
      const pt = p.pass_types;
      const kind = passKindLabel(pt);
      const kindEn = passKindLabelEn(pt);
      const price = pt?.price ? `$${parseFloat(pt.price).toFixed(0)}` : '';
      const name = p.profiles?.full_name || 'Alumna';
      const ageDays = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);
      lines.push(`• ${name} — ${kind}${price ? ' ' + price : ''} _(${ageDays}d)_`);
      linesEn.push(`• ${name} — ${kindEn}${price ? ' ' + price : ''} _(${ageDays}d)_`);
    }
    sendTelegram(lines.join('\n'), { eventType: 'stale_unpaid', recipientName: 'Admin', englishText: linesEn.join('\n') }).catch(() => {});
  }

  let extendNudge = { skipped: 'error' };
  try { extendNudge = await maybeSendExtendNudge(); } catch (err) { extendNudge = { error: err.message }; }

  return res.json({
    expiring_today: expiringToday?.length || 0,
    stale_unpaid: staleUnpaid?.length || 0,
    extend_nudge: extendNudge,
  });
}
