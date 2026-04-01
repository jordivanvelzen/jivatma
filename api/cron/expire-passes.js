import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  // Check for expired passes and passes with few classes remaining
  // This is a placeholder for V2 email notifications
  const today = new Date().toISOString().split('T')[0];

  // Find passes expiring in the next 3 days
  const threeDays = new Date();
  threeDays.setDate(threeDays.getDate() + 3);

  const { data: expiringSoon } = await supabase
    .from('user_passes')
    .select('*, profiles(full_name, phone), pass_types(kind)')
    .gte('expires_at', today)
    .lte('expires_at', threeDays.toISOString().split('T')[0]);

  // Find passes with 1-2 classes remaining
  const { data: lowClasses } = await supabase
    .from('user_passes')
    .select('*, profiles(full_name, phone), pass_types(kind)')
    .gte('expires_at', today)
    .gt('classes_remaining', 0)
    .lte('classes_remaining', 2);

  // V2: Send email/WhatsApp notifications here
  return res.json({
    expiring_soon: expiringSoon?.length || 0,
    low_classes: lowClasses?.length || 0,
    message: 'V2: notifications will be sent here',
  });
}
