import { supabase } from '../../lib/supabase.js';
import { sendTelegram } from '../../lib/telegram.js';

export default async function handler(req, res) {
  const today = new Date().toISOString().split('T')[0];

  // Find passes expiring in the next 3 days
  const threeDays = new Date();
  threeDays.setDate(threeDays.getDate() + 3);

  const { data: expiringSoon } = await supabase
    .from('user_passes')
    .select('*, profiles(full_name, phone), pass_types(kind)')
    .gte('expires_at', today)
    .lte('expires_at', threeDays.toISOString().split('T')[0]);

  const { data: lowClasses } = await supabase
    .from('user_passes')
    .select('*, profiles(full_name, phone), pass_types(kind)')
    .gte('expires_at', today)
    .gt('classes_remaining', 0)
    .lte('classes_remaining', 2);

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
      const kind = pt?.kind === 'single' ? 'Clase Única'
        : pt?.kind === 'multi' ? `Pase de ${pt.class_count} Clases`
        : 'Mensual Ilimitado';
      const price = pt?.price ? `$${parseFloat(pt.price).toFixed(0)}` : '';
      const name = p.profiles?.full_name || 'Alumna';
      const ageDays = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);
      lines.push(`\u2022 ${name} \u2014 ${kind}${price ? ' ' + price : ''} _(${ageDays}d)_`);
    }
    sendTelegram(lines.join('\n')).catch(() => {});
  }

  return res.json({
    expiring_soon: expiringSoon?.length || 0,
    low_classes: lowClasses?.length || 0,
    stale_unpaid: staleUnpaid?.length || 0,
  });
}
