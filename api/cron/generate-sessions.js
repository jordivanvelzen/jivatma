import { supabase } from '../../lib/supabase.js';
import { todayStr, addDays } from '../../lib/dates.js';

export default async function handler(req, res) {
  // Generate sessions for the next 14 days from active templates
  const { data: templates } = await supabase
    .from('class_templates')
    .select('*')
    .eq('is_active', true);

  if (!templates?.length) {
    return res.json({ created: 0, message: 'No active templates' });
  }

  // Get default capacity
  const { data: capSetting } = await supabase
    .from('settings').select('value').eq('key', 'default_capacity').single();
  const defaultCap = parseInt(capSetting?.value || '15', 10);

  let created = 0;
  const today = todayStr();

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const dateStr = addDays(today, dayOffset);
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();

    for (const tmpl of templates) {
      if (tmpl.day_of_week !== dayOfWeek) continue;

      // Check if session already exists
      const { data: existing } = await supabase
        .from('class_sessions')
        .select('id')
        .eq('template_id', tmpl.id)
        .eq('date', dateStr)
        .single();

      if (existing) continue;

      const { error } = await supabase.from('class_sessions').insert({
        template_id: tmpl.id,
        date: dateStr,
        start_time: tmpl.start_time,
        class_type: tmpl.class_type,
        capacity: tmpl.capacity || defaultCap,
      });

      if (!error) created++;
    }
  }

  return res.json({ created });
}
