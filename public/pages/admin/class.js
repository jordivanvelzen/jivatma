import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t } from '../../lib/i18n.js';

export async function renderAdminClass() {
  const app = document.getElementById('app');

  const hashParts = window.location.hash.split('?');
  const params = new URLSearchParams(hashParts[1] || '');
  const selectedDate = params.get('date') || new Date().toISOString().split('T')[0];
  const selectedSessionId = params.get('session') ? parseInt(params.get('session'), 10) : null;

  const { data: sessions } = await sb
    .from('class_sessions')
    .select('*')
    .eq('date', selectedDate)
    .order('start_time', { ascending: true });

  const activeSession = selectedSessionId
    ? sessions?.find(s => s.id === selectedSessionId)
    : sessions?.length === 1 ? sessions[0] : null;

  let attendanceHtml = '';

  if (activeSession) {
    const { data: bookings } = await sb
      .from('bookings')
      .select('*, profiles(id, full_name)')
      .eq('session_id', activeSession.id)
      .is('cancelled_at', null)
      .order('profiles(full_name)', { ascending: true });

    const { data: existingAttendance } = await sb
      .from('attendance')
      .select('user_id, attended')
      .eq('session_id', activeSession.id);

    // existingMap[userId] = true (attended) | false (no-show) | undefined (not marked)
    const existingMap = {};
    (existingAttendance || []).forEach(a => { existingMap[a.user_id] = a.attended; });

    const { data: allUsers } = await sb
      .from('profiles')
      .select('id, full_name')
      .order('full_name', { ascending: true });

    const bookedIds = new Set((bookings || []).map(b => b.profiles?.id).filter(Boolean));
    const unbookedUsers = (allUsers || []).filter(u => !bookedIds.has(u.id) && u.full_name);

    const stateButtons = (userId, withNoShow) => {
      const state = existingMap[userId]; // true / false / undefined
      const unmarked = state === undefined;
      return `
        <div class="att-seg" data-user="${userId}">
          <button type="button" class="att-seg-btn ${state === true ? 'active att-attended' : ''}" data-state="attended" title="${t('admin.attended')}">\u2713</button>
          ${withNoShow ? `<button type="button" class="att-seg-btn ${state === false ? 'active att-noshow' : ''}" data-state="noshow" title="${t('admin.noShow')}">\u2717</button>` : ''}
          <button type="button" class="att-seg-btn ${unmarked ? 'active' : ''}" data-state="unmarked" title="${t('admin.unmarked')}">\u2014</button>
        </div>
      `;
    };

    attendanceHtml = `
      <div class="attendance-section">
        <h3>${activeSession.start_time.slice(0, 5)} · ${t('type.' + activeSession.class_type)}</h3>
        <p class="muted" style="font-size:0.85rem">${t('admin.attendanceHelp')}</p>

        <div id="attendance-form">
          ${bookings?.length ? `<h4>${t('admin.booked')}</h4>` : ''}
          ${(bookings || []).filter(b => b.profiles).map(b => `
            <div class="attendance-row booked">
              <span class="user-name">${b.profiles.full_name}</span>
              ${stateButtons(b.profiles.id, true)}
            </div>
          `).join('')}

          ${unbookedUsers.length ? `<h4>${t('admin.others')}</h4>` : ''}
          ${unbookedUsers.map(u => `
            <div class="attendance-row">
              <span class="user-name">${u.full_name}</span>
              ${stateButtons(u.id, false)}
            </div>
          `).join('')}

          <button type="button" id="save-attendance" class="btn btn-primary btn-block">${t('admin.saveAttendance')}</button>
        </div>
      </div>
    `;
  }

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.attendance')}</h2>

      <div class="date-nav">
        <button id="prev-date" class="btn btn-icon">\u2190</button>
        <input type="date" id="date-picker" value="${selectedDate}" />
        <button id="next-date" class="btn btn-icon">\u2192</button>
      </div>

      ${!sessions?.length
        ? `<p class="muted">${t('admin.noClassesDate')}</p>`
        : !activeSession
          ? `<div class="session-picker">
              ${sessions.map(s => `
                <a href="#/admin/class?date=${selectedDate}&session=${s.id}" class="class-card clickable">
                  <div class="class-time">${s.start_time.slice(0, 5)}</div>
                  <div class="class-type">${t('type.' + s.class_type)}</div>
                </a>
              `).join('')}
            </div>`
          : attendanceHtml
      }
    </div>
  `;

  // Date navigation
  document.getElementById('date-picker')?.addEventListener('change', (e) => {
    window.location.hash = `/admin/class?date=${e.target.value}`;
  });
  document.getElementById('prev-date')?.addEventListener('click', () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    window.location.hash = `/admin/class?date=${d.toISOString().split('T')[0]}`;
  });
  document.getElementById('next-date')?.addEventListener('click', () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    window.location.hash = `/admin/class?date=${d.toISOString().split('T')[0]}`;
  });

  // Segmented control clicks
  app.querySelectorAll('.att-seg').forEach(seg => {
    seg.querySelectorAll('.att-seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        seg.querySelectorAll('.att-seg-btn').forEach(b => {
          b.classList.remove('active', 'att-attended', 'att-noshow');
        });
        btn.classList.add('active');
        if (btn.dataset.state === 'attended') btn.classList.add('att-attended');
        if (btn.dataset.state === 'noshow') btn.classList.add('att-noshow');
      });
    });
  });

  // Save
  document.getElementById('save-attendance')?.addEventListener('click', async () => {
    const records = [];
    app.querySelectorAll('.att-seg').forEach(seg => {
      const userId = seg.dataset.user;
      const activeBtn = seg.querySelector('.att-seg-btn.active');
      const state = activeBtn?.dataset.state;
      if (state === 'attended') records.push({ user_id: userId, attended: true });
      else if (state === 'noshow') records.push({ user_id: userId, attended: false });
      // unmarked → omit entirely
    });

    try {
      const result = await api('/api/admin/attendance', {
        method: 'POST',
        body: JSON.stringify({ session_id: activeSession.id, records }),
      });
      const parts = [t('admin.checkedIn', { n: result.checked_in, p: result.passes_deducted })];
      if (result.no_shows > 0) parts.push(t('admin.noShowsCount', { n: result.no_shows }));
      if (result.no_pass > 0) parts.push(t('admin.noPass', { n: result.no_pass }));
      showToast(parts.join(' · '), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
