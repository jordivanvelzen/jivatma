import { sb, getSession } from '../lib/supabase.js';
import { renderClassCard } from '../components/class-card.js';
import { showToast } from '../components/toast.js';
import { t } from '../lib/i18n.js';
import { todayStr } from '../lib/dates.js';
import { icon } from '../lib/icons.js';
import { withLoading } from '../lib/loading.js';

export async function renderSchedule() {
  const app = document.getElementById('app');
  const session = await getSession();
  const userId = session.user.id;
  const today = todayStr();

  // Fetch non-expired passes to derive active status and expiry warnings
  const { data: myPasses } = await sb
    .from('user_passes')
    .select('id, classes_remaining, expires_at, pass_types(kind)')
    .eq('user_id', userId)
    .gte('expires_at', today)
    .order('expires_at', { ascending: true });

  const activePasses = (myPasses || []).filter(p =>
    p.pass_types?.kind === 'unlimited' || p.classes_remaining > 0
  );
  const hasActivePass = activePasses.length > 0;

  // Sign-up window
  const { data: windowSetting } = await sb
    .from('settings').select('value').eq('key', 'signup_window_weeks').single();
  const windowWeeks = parseInt(windowSetting?.value || '2', 10);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + windowWeeks * 7);
  const maxDateStr = maxDate.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  // Sessions in window — include cancelled so students see "class not happening" instead
  // of the slot disappearing without explanation.
  const { data: sessions } = await sb
    .from('class_sessions')
    .select('*')
    .in('status', ['scheduled', 'cancelled'])
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
    .from('bookings').select('session_id, attendance_mode').in('session_id', sessionIds).is('cancelled_at', null);

  const bookingCounts = {};
  const modeCounts = {}; // { sessionId: { in_person: N, online: M } }
  (allBookings || []).forEach(b => {
    bookingCounts[b.session_id] = (bookingCounts[b.session_id] || 0) + 1;
    if (!modeCounts[b.session_id]) modeCounts[b.session_id] = { in_person: 0, online: 0 };
    if (b.attendance_mode === 'in_person' || b.attendance_mode === 'online') {
      modeCounts[b.session_id][b.attendance_mode]++;
    }
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
    const counts = modeCounts[s.id] || { in_person: 0, online: 0 };
    const spotsLeftInPerson = s.capacity_inperson != null ? s.capacity_inperson - counts.in_person : null;
    const spotsLeftOnline = s.capacity_online != null ? s.capacity_online - counts.online : null;
    const sessionWithCap = {
      ...s,
      capacity: cap,
      _spotsLeftInPerson: spotsLeftInPerson,
      _spotsLeftOnline: spotsLeftOnline,
    };
    sessionMap[s.id] = sessionWithCap;
    return renderClassCard(sessionWithCap, bookingMap[s.id], spotsLeft, hasActivePass);
  }).join('');

  function buildScheduleBanner() {
    if (!hasActivePass) {
      const outOfClasses = (myPasses || []).filter(p =>
        p.pass_types?.kind !== 'unlimited' && p.classes_remaining === 0
      );
      const msg = outOfClasses.length > 0 ? t('banner.outOfClasses') : t('schedule.noPassBanner');
      const urgent = outOfClasses.length > 0;
      return `<div class="no-pass-banner${urgent ? ' no-pass-banner--urgent' : ''}">
        <p>${msg}</p>
        <a href="/my-passes" class="btn btn-primary btn-small">${t('banner.renew')}</a>
      </div>`;
    }
    // Active pass — check if expiring soon
    const soonest = activePasses[0];
    if (soonest?.expires_at) {
      const daysLeft = Math.ceil((new Date(soonest.expires_at) - new Date(today)) / 86400000);
      if (daysLeft <= 0) return `<div class="no-pass-banner no-pass-banner--urgent"><p>${t('banner.expiringToday')}</p><a href="/my-passes" class="btn btn-primary btn-small">${t('banner.renew')}</a></div>`;
      if (daysLeft === 1) return `<div class="no-pass-banner no-pass-banner--urgent"><p>${t('banner.expiringTomorrow')}</p><a href="/my-passes" class="btn btn-primary btn-small">${t('banner.renew')}</a></div>`;
      if (daysLeft <= 7) return `<div class="no-pass-banner"><p>${t('banner.expiringInDays', { n: daysLeft })}</p><a href="/my-passes" class="btn btn-primary btn-small">${t('banner.renew')}</a></div>`;
    }
    return '';
  }
  const noPassBanner = buildScheduleBanner();

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
      const s = sessionMap[sessionId] || {};
      const ipLeft = s._spotsLeftInPerson;
      const olLeft = s._spotsLeftOnline;
      const ipFull = ipLeft != null && ipLeft <= 0;
      const olFull = olLeft != null && olLeft <= 0;
      const ipSub = ipLeft != null
        ? (ipFull ? t('schedule.full') : `${ipLeft} ${t('schedule.spots')}`)
        : t('schedule.pickModeInPersonSub');
      const olSub = olLeft != null
        ? (olFull ? t('schedule.full') : `${olLeft} ${t('schedule.spots')}`)
        : t('schedule.pickModeOnlineSub');
      const wrap = document.createElement('div');
      wrap.className = 'modal';
      wrap.innerHTML = `
        <div class="modal-content">
          <h3>${t('schedule.pickModeTitle')}</h3>
          <p class="muted" style="margin-bottom: var(--s-3, 0.75rem)">${t('schedule.pickModeBody')}</p>
          <div class="mode-picker">
            <button type="button" class="mode-option mode-option--in-person" data-mode="in_person" ${ipFull ? 'disabled' : ''}>
              <span class="icon-circle">${icon('in_person', { size: 24 })}</span>
              <span>${t('schedule.pickModeInPerson')}</span>
              <span class="mode-sub">${ipSub}</span>
            </button>
            <button type="button" class="mode-option mode-option--online" data-mode="online" ${olFull ? 'disabled' : ''}>
              <span class="icon-circle">${icon('online', { size: 24 })}</span>
              <span>${t('schedule.pickModeOnline')}</span>
              <span class="mode-sub">${olSub}</span>
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
        b.addEventListener('click', () => {
          if (b.disabled) return;
          close(b.dataset.mode);
        });
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
      await withLoading(btn, () => doBook(sessionId, mode));
    });
  });

  app.querySelectorAll('.btn-cancel').forEach((btn) => {
    btn.addEventListener('click', () => withLoading(btn, async () => {
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
    }));
  });
}
