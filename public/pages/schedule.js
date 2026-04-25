import { sb, getSession } from '../lib/supabase.js';
import { renderClassCard } from '../components/class-card.js';
import { showToast } from '../components/toast.js';
import { t } from '../lib/i18n.js';
import { todayStr } from '../lib/dates.js';
import { icon } from '../lib/icons.js';

export async function renderSchedule() {
  const app = document.getElementById('app');
  const session = await getSession();
  const userId = session.user.id;
  const today = todayStr();

  // Active pass?
  const { data: activePasses } = await sb
    .from('user_passes')
    .select('id')
    .eq('user_id', userId)
    .gte('expires_at', today)
    .or('classes_remaining.gt.0,classes_remaining.is.null')
    .limit(1);
  const hasActivePass = activePasses && activePasses.length > 0;

  // Sign-up window
  const { data: windowSetting } = await sb
    .from('settings').select('value').eq('key', 'signup_window_weeks').single();
  const windowWeeks = parseInt(windowSetting?.value || '2', 10);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + windowWeeks * 7);
  const maxDateStr = maxDate.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  // Sessions in window
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

  const sessionIds = sessions.map(s => s.id);
  const { data: myBookings } = await sb
    .from('bookings').select('*').eq('user_id', userId).in('session_id', sessionIds);

  const { data: allBookings } = await sb
    .from('bookings').select('session_id').in('session_id', sessionIds).is('cancelled_at', null);

  const bookingCounts = {};
  (allBookings || []).forEach(b => {
    bookingCounts[b.session_id] = (bookingCounts[b.session_id] || 0) + 1;
  });

  const { data: capSetting } = await sb
    .from('settings').select('value').eq('key', 'default_capacity').single();
  const defaultCapacity = parseInt(capSetting?.value || '15', 10);

  const { data: linkSetting } = await sb
    .from('settings').select('value').eq('key', 'online_meeting_link').single();
  const meetingLink = linkSetting?.value || '';

  const bookingMap = {};
  (myBookings || []).forEach(b => { bookingMap[b.session_id] = b; });

  const sessionMap = {};
  const cards = sessions.map(s => {
    const cap = s.capacity || defaultCapacity;
    const booked = bookingCounts[s.id] || 0;
    const spotsLeft = cap - booked;
    const sessionWithCap = { ...s, capacity: cap };
    sessionMap[s.id] = sessionWithCap;
    return renderClassCard(sessionWithCap, bookingMap[s.id], spotsLeft, hasActivePass);
  }).join('');

  const noPassBanner = !hasActivePass ? `
    <div class="no-pass-banner">
      <p>${t('schedule.noPassBanner')}</p>
      <a href="#/my-passes" class="btn btn-primary btn-small">${t('schedule.getPasses')}</a>
    </div>
  ` : '';

  app.innerHTML = `
    <div class="page">
      <h2>${t('schedule.title')}</h2>
      ${noPassBanner}
      ${meetingLink ? `<p class="meeting-link-note">${t('schedule.onlineLink')} <a href="${meetingLink}" target="_blank" rel="noopener">${meetingLink}</a></p>` : ''}
      <div class="class-list">${cards}</div>
    </div>
  `;

  // --- helpers ---
  async function doBook(sessionId, mode = null) {
    const existing = bookingMap[sessionId];
    if (existing) {
      const { error } = await sb
        .from('bookings')
        .update({ cancelled_at: null, booked_at: new Date().toISOString(), attendance_mode: mode })
        .eq('id', existing.id);
      if (error) { showToast(error.message, 'error'); return; }
    } else {
      const { error } = await sb
        .from('bookings')
        .insert({ session_id: sessionId, user_id: userId, attendance_mode: mode });
      if (error) { showToast(error.message, 'error'); return; }
    }
    showToast(t('schedule.signedUp'), 'success');
    renderSchedule();
  }

  function pickHybridMode(sessionId) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal';
      wrap.innerHTML = `
        <div class="modal-content">
          <h3>${t('schedule.pickModeTitle')}</h3>
          <p class="muted" style="margin-bottom: var(--s-3, 0.75rem)">${t('schedule.pickModeBody')}</p>
          <div class="mode-picker">
            <button type="button" class="mode-option mode-option--in-person" data-mode="in_person">
              <span class="icon-circle">${icon('in_person', { size: 24 })}</span>
              <span>${t('schedule.pickModeInPerson')}</span>
              <span class="mode-sub">${t('schedule.pickModeInPersonSub')}</span>
            </button>
            <button type="button" class="mode-option mode-option--online" data-mode="online">
              <span class="icon-circle">${icon('online', { size: 24 })}</span>
              <span>${t('schedule.pickModeOnline')}</span>
              <span class="mode-sub">${t('schedule.pickModeOnlineSub')}</span>
            </button>
          </div>
          <div class="form-actions" style="justify-content: flex-end; margin-top: var(--s-4, 1rem)">
            <button type="button" class="btn btn-secondary" data-cancel>${t('general.cancel')}</button>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);

      const close = (mode) => {
        wrap.remove();
        resolve(mode);
      };
      wrap.querySelectorAll('.mode-option').forEach((b) => {
        b.addEventListener('click', () => close(b.dataset.mode));
      });
      wrap.querySelector('[data-cancel]').addEventListener('click', () => close(null));
      wrap.addEventListener('click', (e) => { if (e.target === wrap) close(null); });
    });
  }

  // --- handlers ---
  app.querySelectorAll('.btn-signup:not(.disabled)').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sessionId = parseInt(btn.dataset.sessionId, 10);
      const type = btn.dataset.type;
      let mode = null;
      if (type === 'hybrid') {
        mode = await pickHybridMode(sessionId);
        if (!mode) return; // user cancelled
      } else if (type === 'online') {
        mode = 'online';
      } else if (type === 'in_person') {
        mode = 'in_person';
      }
      await doBook(sessionId, mode);
    });
  });

  app.querySelectorAll('.btn-cancel').forEach((btn) => {
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
