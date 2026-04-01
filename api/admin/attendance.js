import { verifyAdmin } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';
import { findActivePass, deductPass, reverseDeduction } from '../../lib/passes.js';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'POST') {
    const { session_id, user_ids } = req.body;
    if (!session_id || !Array.isArray(user_ids)) {
      return res.status(400).json({ error: 'session_id and user_ids required' });
    }

    const { data: existing } = await supabase
      .from('attendance')
      .select('user_id, id, pass_id')
      .eq('session_id', session_id);

    const existingMap = {};
    (existing || []).forEach(a => { existingMap[a.user_id] = a; });

    const newUserIds = new Set(user_ids);
    let checkedIn = 0;
    let passesDeducted = 0;
    let noPass = 0;

    for (const userId of user_ids) {
      if (existingMap[userId]) continue;

      const pass = await findActivePass(userId);
      let passId = null;

      if (pass) {
        const updated = await deductPass(pass.id);
        if (updated) { passId = pass.id; passesDeducted++; }
      } else {
        noPass++;
      }

      await supabase.from('attendance').insert({
        session_id, user_id: userId, pass_id: passId,
      });
      checkedIn++;
    }

    for (const [userId, record] of Object.entries(existingMap)) {
      if (!newUserIds.has(userId)) {
        if (record.pass_id) await reverseDeduction(record.pass_id);
        await supabase.from('attendance').delete().eq('id', record.id);
      }
    }

    if (user_ids.length > 0) {
      await supabase.from('class_sessions').update({ status: 'completed' }).eq('id', session_id);
    }

    return res.json({ checked_in: checkedIn, passes_deducted: passesDeducted, no_pass: noPass });
  }

  if (req.method === 'DELETE') {
    const { session_id, user_id } = req.body;
    const { data: record } = await supabase
      .from('attendance').select('*')
      .eq('session_id', session_id).eq('user_id', user_id).single();

    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.pass_id) await reverseDeduction(record.pass_id);
    await supabase.from('attendance').delete().eq('id', record.id);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
