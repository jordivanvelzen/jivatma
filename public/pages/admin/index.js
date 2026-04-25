import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t, getLocale } from '../../lib/i18n.js';
import { todayStr, formatDbDate } from '../../lib/dates.js';
import { icon, classTypeIcon } from '../../lib/icons.js';
import { withLoading } from '../../lib/loading.js';

function dateNDaysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

export async function renderAdminDashboard() {
  const app = document.getElementById('app');
  const today = todayStr();
  const tomorrow = dateNDaysFromToday(1);
  const locale = getLocale();

  // Sessions today + tomorrow, plus default capacity, expiring/low passes — all in parallel
  const weekFromNowStr = dateNDaysFromToday(7);

  const [sessionsRes, settingsRes, expiringRes, lowRes] = await Promise.all([
    sb.from('class_sessions').select('*')
      .in('date', [today, tomorrow])
      .eq('status', 'scheduled')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),
    sb.from('settings').select('key, value').eq('key', 'default_capacity').maybeSingle(),
    sb.from('user_passes')
      .select('*, profiles(full_name), pass_types(kind, class_count)')
      .gte('expires_at', today).lte('expires_at', weekFromNowStr)
      .order('expires_at', { ascending: true }),
    sb.from('user_passes')
      .select('*, profiles(full_name), pass_types(kind, class_count)')
      .gte('expires_at', today).gt('classes_remaining', 0).lte('classes_remaining', 2)
      .order('classes_remaining', { ascending: true }),
  ]);

  const sessions = sessionsRes.data || [];
  const defaultCapacity = parseInt(settingsRes.data?.value, 10) || 15;
  const expiringPasses = expiringRes.data || [];
  const lowPasses = lowRes.data || [];

  // Booking counts per session (active bookings only)
  const bookingsCountBySession = {};
  if (sessions.length) {
    const { data: bks } = await sb.from('bookings')
      .select('session_id, attendance_mode')
      .in('session_id', sessions.map(s => s.id))
      .is('cancelled_at', null);
    (bks || []).forEach(b => {
      const slot = bookingsCountBySession[b.session_id] || (bookingsCountBySession[b.session_id] = { total: 0, online: 0, in_person: 0 });
      slot.total += 1;
      if (b.attendance_mode === 'online') slot.online += 1;
      else if (b.attendance_mode === 'in_person') slot.in_person += 1;
    });
  }

  const renderClassCard = (s) => {
    const counts = bookingsCountBySession[s.id] || { total: 0, online: 0, in_person: 0 };
    const isHybrid = s.class_type === 'hybrid';
    let capLabel;
    if (isHybrid) {
      const ip = s.capacity_inperson;
      const on = s.capacity_online;
      const totalCap = (ip ?? 0) + (on ?? 0);
      capLabel = totalCap > 0
        ? t('admin.signedUpCount', { n: counts.total, m: totalCap })
        : t('admin.signedUpUnlimited', { n: counts.total });
    } else {
      const cap = s.capacity ?? defaultCapacity;
      capLabel = t('admin.signedUpCount', { n: counts.total, m: cap });
    }

    const modeBreakdown = isHybrid
      ? `<span class="dash-class-mode-bd">· ${counts.in_person} 🏠 / ${counts.online} 💻</span>`
      : '';

    return `
      <div class="dash-class-card" data-session="${s.id}" data-date="${s.date}">
        <button type="button" class="dash-class-head" aria-expanded="false">
          <div class="dash-class-time">${s.start_time.slice(0, 5)}</div>
          <div class="dash-class-meta">
            <div class="dash-class-type">${classTypeIcon(s.class_type)} ${t('type.' + s.class_type)}</div>
            <div class="dash-class-count">${icon('spots', { size: 14 })} ${capLabel} ${modeBreakdown}</div>
          </div>
          <div class="dash-class-chev">${icon('arrow_right', { size: 18 })}</div>
        </button>
        <div class="dash-class-body" hidden></div>
      </div>
    `;
  };

  const todaySessions = sessions.filter(s => s.date === today);
  const tomorrowSessions = sessions.filter(s => s.date === tomorrow);

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.dashboard')}</h2>

      <section class="section">
        <h3>${t('admin.todaysClasses')}</h3>
        ${!todaySessions.length
          ? `<p class="muted">${t('admin.noClassesToday')}</p>`
          : `<div class="dash-class-list">${todaySessions.map(renderClassCard).join('')}</div>`
        }
      </section>

      <section class="section">
        <h3>${t('admin.tomorrowsClasses')}</h3>
        ${!tomorrowSessions.length
          ? `<p class="muted">${t('admin.noClassesTomorrow')}</p>`
          : `<div class="dash-class-list">${tomorrowSessions.map(renderClassCard).join('')}</div>`
        }
      </section>

      <section class="section">
        <h3>${t('admin.expiringSoon')}</h3>
        ${!expiringPasses.length && !lowPasses.length
          ? `<p class="muted">${t('admin.noExpiring')}</p>`
          : `<ul class="list">
              ${expiringPasses.map(p => {
                const name = p.profiles?.full_name || 'Unknown';
                const dateStr = formatDbDate(p.expires_at, locale, { day: 'numeric', month: 'short' });
                return `<li class="alert-item">⏰ ${name} — ${t('admin.expiresOn', { date: dateStr })}</li>`;
              }).join('')}
              ${lowPasses.map(p => {
                const name = p.profiles?.full_name || 'Unknown';
                return `<li class="alert-item">⚠️ ${name} — ${t('admin.classesRemaining', { n: p.classes_remaining })}</li>`;
              }).join('')}
            </ul>`
        }
      </section>
    </div>
  `;

  // Wire up expansion / inline attendance for each card
  app.querySelectorAll('.dash-class-card').forEach(card => {
    const head = card.querySelector('.dash-class-head');
    const body = card.querySelector('.dash-class-body');
    head.addEventListener('click', async () => {
      const open = head.getAttribute('aria-expanded') === 'true';
      if (open) {
        head.setAttribute('aria-expanded', 'false');
        body.hidden = true;
        card.classList.remove('expanded');
        return;
      }
      head.setAttribute('aria-expanded', 'true');
      card.classList.add('expanded');
      body.hidden = false;
      if (!body.dataset.loaded) {
        body.innerHTML = `<p class="muted" style="padding: var(--s-2)">…</p>`;
        await loadAndRenderAttendance(card, body);
        body.dataset.loaded = '1';
      }
    });
  });
}

async function loadAndRenderAttendance(card, body) {
  const sessionId = parseInt(card.dataset.session, 10);
  const date = card.dataset.date;

  const [bookingsRes, attRes] = await Promise.all([
    sb.from('bookings')
      .select('id, attendance_mode, profiles(id, full_name, show_in_attendance)')
      .eq('session_id', sessionId)
      .is('cancelled_at', null)
      .order('profiles(full_name)', { ascending: true }),
    sb.from('attendance').select('user_id, attended').eq('session_id', sessionId),
  ]);

  const bookings = bookingsRes.data || [];
  const existingMap = {};
  (attRes.data || []).forEach(a => { existingMap[a.user_id] = a.attended; });

  const visible = bookings.filter(b =>
    b.profiles && (b.profiles.show_in_attendance !== false || existingMap[b.profiles.id] !== undefined)
  );

  const stateButtons = (userId) => {
    const state = existingMap[userId];
    const unmarked = state === undefined;
    return `
      <div class="att-seg" data-user="${userId}">
        <button type="button" class="att-seg-btn ${state === true ? 'active att-attended' : ''}" data-state="attended" title="${t('admin.attended')}">✓</button>
        <button type="button" class="att-seg-btn ${state === false ? 'active att-noshow' : ''}" data-state="noshow" title="${t('admin.noShow')}">✗</button>
        <button type="button" class="att-seg-btn ${unmarked ? 'active' : ''}" data-state="unmarked" title="${t('admin.unmarked')}">—</button>
      </div>
    `;
  };

  body.innerHTML = `
    ${!visible.length
      ? `<p class="muted" style="padding: var(--s-2) 0">${t('admin.noBookingsYet')}</p>`
      : `<div class="dash-att-list">
          ${visible.map(b => `
            <div class="attendance-row booked">
              <span class="user-name">${b.profiles.full_name}</span>
              ${stateButtons(b.profiles.id)}
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn-primary btn-block dash-save-att">${t('admin.saveAttendance')}</button>`
    }
    <a href="/admin/class?date=${date}&session=${sessionId}" class="btn btn-secondary btn-block dash-open-full">${t('admin.openFullAttendance')}</a>
  `;

  body.querySelectorAll('.att-seg').forEach(seg => {
    seg.querySelectorAll('.att-seg-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        seg.querySelectorAll('.att-seg-btn').forEach(b => {
          b.classList.remove('active', 'att-attended', 'att-noshow');
        });
        btn.classList.add('active');
        if (btn.dataset.state === 'attended') btn.classList.add('att-attended');
        if (btn.dataset.state === 'noshow') btn.classList.add('att-noshow');
      });
    });
  });

  body.querySelector('.dash-save-att')?.addEventListener('click', (ev) => withLoading(ev.currentTarget, async () => {
    const records = [];
    body.querySelectorAll('.att-seg').forEach(seg => {
      const userId = seg.dataset.user;
      const state = seg.querySelector('.att-seg-btn.active')?.dataset.state;
      if (state === 'attended') records.push({ user_id: userId, attended: true });
      else if (state === 'noshow') records.push({ user_id: userId, attended: false });
    });
    try {
      const result = await api('/api/admin/attendance', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, records }),
      });
      const parts = [t('admin.checkedIn', { n: result.checked_in, p: result.passes_deducted })];
      if (result.no_shows > 0) parts.push(t('admin.noShowsCount', { n: result.no_shows }));
      if (result.no_pass > 0) parts.push(t('admin.noPass', { n: result.no_pass }));
      showToast(parts.join(' · '), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }));
}
