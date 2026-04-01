import { sb, getSession } from '../lib/supabase.js';
import { renderClassCard } from '../components/class-card.js';
import { showToast } from '../components/toast.js';
import { t } from '../lib/i18n.js';

export async function renderSchedule() {
  const app = document.getElementById('app');
  const session = await getSession();
  const userId = session.user.id;
  const today = new Date().toISOString().split('T')[0];

  // Get sign-up window
  const { data: windowSetting } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'signup_window_weeks')
    .single();
  const windowWeeks = parseInt(windowSetting?.value || '2', 10);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + windowWeeks * 7);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  // Get sessions in window
  const { data: sessions } = await sb
    .from('class_sessions')
    .select('*')
    .eq('status', 'scheduled')
    .gte('date', today)
    .lte('date', maxDateStr)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (!sessions?.length) {
    app.innerHTML = `
      <div class="page">
        <h2>${t('schedule.title')}</h2>
        <p class="muted">${t('schedule.noClasses')}</p>
      </div>
    `;
    return;
  }

  // Get user's bookings for these sessions
  const sessionIds = sessions.map(s => s.id);
  const { data: myBookings } = await sb
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .in('session_id', sessionIds);

  // Get booking counts per session
  const { data: allBookings } = await sb
    .from('bookings')
    .select('session_id')
    .in('session_id', sessionIds)
    .is('cancelled_at', null);

  const bookingCounts = {};
  (allBookings || []).forEach(b => {
    bookingCounts[b.session_id] = (bookingCounts[b.session_id] || 0) + 1;
  });

  // Get default capacity
  const { data: capSetting } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'default_capacity')
    .single();
  const defaultCapacity = parseInt(capSetting?.value || '15', 10);

  // Get meeting link setting
  const { data: linkSetting } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'online_meeting_link')
    .single();
  const meetingLink = linkSetting?.value || '';

  const bookingMap = {};
  (myBookings || []).forEach(b => { bookingMap[b.session_id] = b; });

  const cards = sessions.map(s => {
    const cap = s.capacity || defaultCapacity;
    const booked = bookingCounts[s.id] || 0;
    const spotsLeft = cap - booked;
    const sessionWithCap = { ...s, capacity: cap };
    return renderClassCard(sessionWithCap, bookingMap[s.id], spotsLeft);
  }).join('');

  app.innerHTML = `
    <div class="page">
      <h2>${t('schedule.title')}</h2>
      ${meetingLink ? `<p class="meeting-link-note">${t('schedule.onlineLink')} <a href="${meetingLink}" target="_blank">${meetingLink}</a></p>` : ''}
      <div class="class-list">${cards}</div>
    </div>
  `;

  // Handle sign-up clicks
  app.querySelectorAll('.btn-signup:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sessionId = parseInt(btn.dataset.sessionId, 10);
      const existing = bookingMap[sessionId];

      if (existing && existing.cancelled_at) {
        // Re-book: clear cancelled_at
        const { error } = await sb
          .from('bookings')
          .update({ cancelled_at: null, booked_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) { showToast(error.message, 'error'); return; }
      } else {
        const { error } = await sb
          .from('bookings')
          .insert({ session_id: sessionId, user_id: userId });
        if (error) { showToast(error.message, 'error'); return; }
      }

      showToast(t('schedule.signedUp'), 'success');
      renderSchedule();
    });
  });

  // Handle cancel clicks
  app.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sessionId = parseInt(btn.dataset.sessionId, 10);
      const booking = bookingMap[sessionId];
      if (!booking) return;

      const { error } = await sb
        .from('bookings')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', booking.id);

      if (error) { showToast(error.message, 'error'); return; }

      showToast(t('schedule.bookingCancelled'), 'info');
      renderSchedule();
    });
  });
}
