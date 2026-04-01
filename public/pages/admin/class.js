import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t } from '../../lib/i18n.js';

export async function renderAdminClass() {
  const app = document.getElementById('app');

  // Parse query params from hash
  const hashParts = window.location.hash.split('?');
  const params = new URLSearchParams(hashParts[1] || '');
  const selectedDate = params.get('date') || new Date().toISOString().split('T')[0];
  const selectedSessionId = params.get('session') ? parseInt(params.get('session'), 10) : null;

  // Get sessions for selected date
  const { data: sessions } = await sb
    .from('class_sessions')
    .select('*')
    .eq('date', selectedDate)
    .order('start_time', { ascending: true });

  // If only one session and none selected, auto-select it
  const activeSession = selectedSessionId
    ? sessions?.find(s => s.id === selectedSessionId)
    : sessions?.length === 1 ? sessions[0] : null;

  let attendanceHtml = '';

  if (activeSession) {
    // Get bookings for this session
    const { data: bookings } = await sb
      .from('bookings')
      .select('*, profiles(id, full_name)')
      .eq('session_id', activeSession.id)
      .is('cancelled_at', null)
      .order('profiles(full_name)', { ascending: true });

    // Get existing attendance
    const { data: existingAttendance } = await sb
      .from('attendance')
      .select('user_id')
      .eq('session_id', activeSession.id);

    const checkedIn = new Set((existingAttendance || []).map(a => a.user_id));

    // Get all users (for walk-ins)
    const { data: allUsers } = await sb
      .from('profiles')
      .select('id, full_name')
      .order('full_name', { ascending: true });

    const bookedIds = new Set((bookings || []).map(b => b.profiles?.id).filter(Boolean));
    const unbookedUsers = (allUsers || []).filter(u => !bookedIds.has(u.id) && u.full_name);

    attendanceHtml = `
      <div class="attendance-section">
        <h3>${activeSession.start_time.slice(0, 5)} · ${t('type.' + activeSession.class_type)}</h3>

        <form id="attendance-form">
          ${bookings?.length ? `<h4>${t('admin.booked')}</h4>` : ''}
          ${(bookings || []).filter(b => b.profiles).map(b => `
            <label class="attendance-row booked">
              <input type="checkbox" name="user" value="${b.profiles.id}" ${checkedIn.has(b.profiles.id) ? 'checked' : ''} />
              <span class="user-name">${b.profiles.full_name}</span>
              <span class="badge badge-booked">${t('admin.booked')}</span>
            </label>
          `).join('')}

          ${unbookedUsers.length ? `<h4>${t('admin.others')}</h4>` : ''}
          ${unbookedUsers.map(u => `
            <label class="attendance-row">
              <input type="checkbox" name="user" value="${u.id}" ${checkedIn.has(u.id) ? 'checked' : ''} />
              <span class="user-name">${u.full_name}</span>
            </label>
          `).join('')}

          <button type="submit" class="btn btn-primary btn-block">${t('admin.saveAttendance')}</button>
        </form>
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

  // Attendance form submission
  document.getElementById('attendance-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const checked = [...e.target.querySelectorAll('input[name="user"]:checked')].map(cb => cb.value);

    try {
      const result = await api('/api/admin/attendance', {
        method: 'POST',
        body: JSON.stringify({
          session_id: activeSession.id,
          user_ids: checked,
        }),
      });
      let msg = t('admin.checkedIn', { n: result.checked_in, p: result.passes_deducted });
      if (result.no_pass > 0) {
        msg += `, ${t('admin.noPass', { n: result.no_pass })}`;
      }
      showToast(msg, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
