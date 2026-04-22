import { verifyAdmin } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';
import { findActivePass, deductPass, reverseDeduction } from '../../lib/passes.js';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'POST') {
    const { session_id, records } = req.body;
    // `records` is [{ user_id, attended: bool }]. `attended=false` is a no-show
    // but still deducts a pass. Users not in `records` are "not marked" (no row).
    // Accept legacy `user_ids` for backward compat (treated as all attended).
    let recs = records;
    if (!recs && Array.isArray(req.body.user_ids)) {
      recs = req.body.user_ids.map(user_id => ({ user_id, attended: true }));
    }
    if (!session_id || !Array.isArray(recs)) {
      return res.status(400).json({ error: 'session_id and records required' });
    }

    const { data: existing } = await supabase
      .from('attendance')
      .select('user_id, id, pass_id, attended')
      .eq('session_id', session_id);

    const existingMap = {};
    (existing || []).forEach(a => { existingMap[a.user_id] = a; });

    const newMap = {};
    recs.forEach(r => { newMap[r.user_id] = !!r.attended; });

    let checkedIn = 0;
    let noShows = 0;
    let passesDeducted = 0;
    let noPass = 0;

    for (const { user_id, attended } of recs) {
      const existingRec = existingMap[user_id];

      if (existingRec) {
        // Flip attended state if it changed; pass deduction is the same either way
        if (existingRec.attended !== attended) {
          await supabase.from('attendance').update({ attended }).eq('id', existingRec.id);
        }
      } else {
        const pass = await findActivePass(user_id);
        let passId = null;
        if (pass) {
          const updated = await deductPass(pass.id);
          if (updated) { passId = pass.id; passesDeducted++; }
        } else {
          noPass++;
        }

        await supabase.from('attendance').insert({
          session_id, user_id, pass_id: passId, attended,
        });
      }

      if (attended) checkedIn++;
      else noShows++;
    }

    // Remove records for users no longer in the list (reverses deduction)
    for (const [userId, record] of Object.entries(existingMap)) {
      if (!(userId in newMap)) {
        if (record.pass_id) await reverseDeduction(record.pass_id);
        await supabase.from('attendance').delete().eq('id', record.id);
      }
    }

    if (recs.length > 0) {
      await supabase.from('class_sessions').update({ status: 'completed' }).eq('id', session_id);
    }

    return res.json({
      checked_in: checkedIn,
      no_shows: noShows,
      passes_deducted: passesDeducted,
      no_pass: noPass,
    });
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
