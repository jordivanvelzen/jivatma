import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t } from '../../lib/i18n.js';
import { todayStr, parseLocalDate } from '../../lib/dates.js';
import { icon } from '../../lib/icons.js';
import { withLoading } from '../../lib/loading.js';
import { navigate } from '../../lib/router.js';

export async function renderAdminClass() {
  const app = document.getElementById('app');

  const params = new URLSearchParams(window.location.search);
  const selectedDate = params.get('date') || todayStr();
  const selectedSessionId = params.get('session') ? parseInt(params.get('session'), 10) : null;
  const today = todayStr();

  const { data: sessions } = await sb
    .from('class_sessions').select('*')
    .eq('date', selectedDate).order('start_time', { ascending: true });

  const activeSession = selectedSessionId
    ? sessions?.find(s => s.id === selectedSessionId)
    : sessions?.length === 1 ? sessions[0] : null;

  let attendanceHtml = '';
  // Map of userId -> { id, amount } for unpaid active passes, used after save for toast
  let unpaidMap = {};

  if (activeSession) {
    const { data: bookings } = await sb
      .from('bookings')
      .select('*, profiles(id, full_name, show_in_attendance)')
      .eq('session_id', activeSession.id)
      .is('cancelled_at', null)
      .order('profiles(full_name)', { ascending: true });

    const { data: existingAttendance } = await sb
      .from('attendance').select('user_id, attended')
      .eq('session_id', activeSession.id);

    const existingMap = {};
    (existingAttendance || []).forEach(a => { existingMap[a.user_id] = a.attended; });

    const { data: allUsers } = await sb
      .from('profiles').select('id, full_name, show_in_attendance')
      .order('full_name', { ascending: true });

    // Users flagged as hidden from attendance (e.g. Claudia the teacher) are
    // removed from both the booked list and the walk-in list, but we keep
    // showing anyone who already has an attendance record so past data
    // remains editable.
    const visibleBookings = (bookings || []).filter(b =>
      b.profiles && (b.profiles.show_in_attendance !== false || existingMap[b.profiles.id] !== undefined)
    );
    const bookedIds = new Set(visibleBookings.map(b => b.profiles.id));
    const unbookedUsers = (allUsers || []).filter(u =>
      !bookedIds.has(u.id)
      && u.full_name
      && (u.show_in_attendance !== false || existingMap[u.id] !== undefined)
    );

    // Fetch active unpaid passes for the users we care about (so we can flag payment due)
    const relevantUserIds = [
      ...visibleBookings.map(b => b.profiles.id),
      ...unbookedUsers.map(u => u.id),
    ];
    let unpaidRows = [];
    if (relevantUserIds.length) {
      const { data } = await sb.from('user_passes')
        .select('id, user_id, is_paid, pass_types(price)')
        .in('user_id', relevantUserIds)
        .eq('is_paid', false)
        .gte('expires_at', today);
      unpaidRows = data || [];
    }
    unpaidRows.forEach(p => {
      // Keep first unpaid pass per user (cheapest lookup)
      if (!unpaidMap[p.user_id]) {
        unpaidMap[p.user_id] = { id: p.id, amount: p.pass_types?.price ? parseFloat(p.pass_types.price).toFixed(0) : null };
      }
    });

    const unpaidBadge = (userId) => {
      const u = unpaidMap[userId];
      if (!u) return '';
      const amt = u.amount ? `$${u.amount}` : '';
      return `<span class="badge-unpaid-inline" title="${t('admin.cashDueTooltip')}">\u{1F4B5} ${t('admin.cashDue')} ${amt}</span>
              <button type="button" class="btn btn-xs btn-secondary mark-paid-btn" data-pass="${u.id}">${t('admin.markPaid')}</button>`;
    };

    const stateButtons = (userId, withNoShow) => {
      const state = existingMap[userId];
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
          ${visibleBookings.length ? `<h4>${t('admin.booked')}</h4>` : ''}
          ${visibleBookings.map(b => {
            const isHybrid = activeSession.class_type === 'hybrid';
            const mode = b.attendance_mode;
            const modeBadge = (isHybrid && mode)
              ? `<span class="cc-mode-pill" title="${t('schedule.mode.' + mode)}">${icon(mode === 'online' ? 'online' : 'in_person', { size: 14 })}${t('schedule.mode.' + mode)}</span>`
              : '';
            return `
              <div class="attendance-row booked">
                <div class="user-name-wrap">
                  <span class="user-name">${b.profiles.full_name}</span>
                  ${modeBadge}
                  ${unpaidBadge(b.profiles.id)}
                </div>
                ${stateButtons(b.profiles.id, true)}
              </div>
            `;
          }).join('')}

          ${unbookedUsers.length ? `<h4>${t('admin.others')}</h4>` : ''}
          ${unbookedUsers.map(u => `
            <div class="attendance-row">
              <div class="user-name-wrap">
                <span class="user-name">${u.full_name}</span>
                ${unpaidBadge(u.id)}
              </div>
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
                <a href="/admin/class?date=${selectedDate}&session=${s.id}" class="class-card clickable">
                  <div class="class-time">${s.start_time.slice(0, 5)}</div>
                  <div class="class-type">${t('type.' + s.class_type)}</div>
                </a>
              `).join('')}
            </div>`
          : attendanceHtml
      }
    </div>
  `;

  document.getElementById('date-picker')?.addEventListener('change', (e) => {
    navigate(`/admin/class?date=${e.target.value}`);
  });
  const shiftDate = (delta) => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  document.getElementById('prev-date')?.addEventListener('click', () => {
    navigate(`/admin/class?date=${shiftDate(-1)}`);
  });
  document.getElementById('next-date')?.addEventListener('click', () => {
    navigate(`/admin/class?date=${shiftDate(1)}`);
  });

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

  // One-tap "mark paid" on a user's unpaid pass right from the attendance list
  app.querySelectorAll('.mark-paid-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      return withLoading(btn, async () => {
        const passId = parseInt(btn.dataset.pass, 10);
        try {
          await api('/api/admin/passes', {
            method: 'PATCH',
            body: JSON.stringify({ id: passId, is_paid: true }),
          });
          showToast(t('admin.markedPaid'), 'success');
          // Remove the badge + button from the row
          const row = btn.closest('.attendance-row');
          row?.querySelectorAll('.badge-unpaid-inline, .mark-paid-btn').forEach(el => el.remove());
          for (const uid in unpaidMap) {
            if (unpaidMap[uid].id === passId) delete unpaidMap[uid];
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  });

  // Save attendance
  document.getElementById('save-attendance')?.addEventListener('click', (ev) => withLoading(ev.currentTarget, async () => {
    const records = [];
    const attendedUserIds = [];
    app.querySelectorAll('.att-seg').forEach(seg => {
      const userId = seg.dataset.user;
      const activeBtn = seg.querySelector('.att-seg-btn.active');
      const state = activeBtn?.dataset.state;
      if (state === 'attended') { records.push({ user_id: userId, attended: true }); attendedUserIds.push(userId); }
      else if (state === 'noshow') records.push({ user_id: userId, attended: false });
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

      // Cash-due reminder for any attended student with an unpaid pass
      const cashDebts = [];
      for (const uid of attendedUserIds) {
        const u = unpaidMap[uid];
        if (!u) continue;
        const row = app.querySelector(`.att-seg[data-user="${uid}"]`)?.closest('.attendance-row');
        const name = row?.querySelector('.user-name')?.textContent?.trim() || '';
        cashDebts.push(`${name}${u.amount ? ' ($' + u.amount + ')' : ''}`);
      }
      if (cashDebts.length) {
        setTimeout(() => showToast(`\u{1F4B5} ${t('admin.remindCollect')}: ${cashDebts.join(', ')}`, 'info'), 1200);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }));
}
