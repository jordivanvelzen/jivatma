import { sb, getSession } from '../lib/supabase.js';
import { renderPassCard } from '../components/pass-card.js';
import { t, getLocale } from '../lib/i18n.js';
import { todayStr, formatDbDate } from '../lib/dates.js';

export async function renderDashboard() {
  const app = document.getElementById('app');
  const session = await getSession();
  const userId = session.user.id;
  const today = todayStr();

  const [{ data: profile }, { data: passes }, { data: bookings }, { data: attendance }, { data: pendingRequests }] = await Promise.all([
    sb.from('profiles').select('full_name, phone').eq('id', userId).single(),
    sb.from('user_passes').select('*, pass_types(*)').eq('user_id', userId).gte('expires_at', today).order('expires_at', { ascending: true }),
    sb.from('bookings').select('*, class_sessions(*)').eq('user_id', userId).is('cancelled_at', null).gte('class_sessions.date', today).order('booked_at', { ascending: true }).limit(5),
    sb.from('attendance').select('*, class_sessions(*)').eq('user_id', userId).order('checked_in_at', { ascending: false }).limit(5),
    sb.from('pass_requests').select('*, pass_types(*)').eq('user_id', userId).eq('status', 'pending').order('created_at', { ascending: false }),
  ]);

  const activePasses = (passes || []).filter(p =>
    p.pass_types.kind === 'unlimited' || p.classes_remaining > 0
  );
  const pending = pendingRequests || [];

  // Compute pass status banner
  function buildPassBanner() {
    if (activePasses.length > 0) {
      // Sort by soonest expiry; unlimited passes (null expires_at not possible here) are fine
      const soonest = activePasses[0];
      if (!soonest.expires_at) return '';
      const daysLeft = Math.ceil((new Date(soonest.expires_at) - new Date(today)) / 86400000);
      if (daysLeft <= 0) return `<div class="no-pass-banner no-pass-banner--urgent"><p>${t('banner.expiringToday')}</p><a href="/my-passes" class="btn btn-small btn-primary">${t('banner.renew')}</a></div>`;
      if (daysLeft === 1) return `<div class="no-pass-banner no-pass-banner--urgent"><p>${t('banner.expiringTomorrow')}</p><a href="/my-passes" class="btn btn-small btn-primary">${t('banner.renew')}</a></div>`;
      if (daysLeft <= 7) return `<div class="no-pass-banner"><p>${t('banner.expiringInDays', { n: daysLeft })}</p><a href="/my-passes" class="btn btn-small btn-primary">${t('banner.renew')}</a></div>`;
      return '';
    }
    // No active pass — check if they have passes with 0 classes (not expired)
    const outOfClasses = (passes || []).filter(p =>
      p.pass_types?.kind !== 'unlimited' && p.classes_remaining === 0
    );
    if (outOfClasses.length > 0) {
      return `<div class="no-pass-banner no-pass-banner--urgent"><p>${t('banner.outOfClasses')}</p><a href="/my-passes" class="btn btn-small btn-primary">${t('banner.renew')}</a></div>`;
    }
    return '';
  }
  const passBanner = buildPassBanner();

  // Cancelled upcoming-class alert: any active booking whose session was cancelled.
  const cancelledBookings = (bookings || []).filter(b => b.class_sessions?.status === 'cancelled');
  const cancelledBanner = cancelledBookings.length
    ? (() => {
        const lines = cancelledBookings.map(b => {
          const s = b.class_sessions;
          const dateStr = formatDbDate(s.date, getLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
          const time = s.start_time.slice(0, 5);
          const reason = s.cancellation_reason ? ` — ${s.cancellation_reason}` : '';
          return `<li>${dateStr} · ${time}${reason}</li>`;
        }).join('');
        return `<div class="no-pass-banner no-pass-banner--urgent">
          <p><strong>${t('dash.cancelledHeading', { n: cancelledBookings.length })}</strong></p>
          <ul style="margin: var(--s-2,0.5rem) 0 0; padding-left: 1.2em">${lines}</ul>
        </div>`;
      })()
    : '';

  function kindLabel(pt) {
    if (!pt) return '';
    if (pt.kind === 'single') return t('passes.singleClass');
    if (pt.kind === 'multi') return t('passes.multiClass', { n: pt.class_count });
    return t('passes.unlimited');
  }

  const pendingHtml = pending.map(r => {
    const waitMsg = r.payment_method === 'transfer'
      ? t('dash.pendingTransfer')
      : t('dash.pendingGeneric');
    return `
      <div class="pass-card pass-pending">
        <div class="pass-kind">${kindLabel(r.pass_types)}</div>
        <div class="pass-detail">${waitMsg}</div>
        <div class="pass-badges">
          <span class="pass-badge pass-badge-pending">${t('requests.pending')}</span>
        </div>
      </div>
    `;
  }).join('');

  const locale = getLocale();
  const firstName = (profile?.full_name || '').split(' ')[0];

  // Show onboarding for brand-new students: no passes, no pending requests, no bookings, no attendance
  const isBrandNew = !activePasses.length && !pending.length && !bookings?.length && !attendance?.length;

  const onboardingHtml = isBrandNew ? `
    <div class="onboarding-card">
      <h3>${t('onboarding.welcomeTitle')}</h3>
      <p>${t('onboarding.welcomeIntro')}</p>
      <ol class="onboarding-steps">
        <li><strong>${t('onboarding.step1Title')}</strong> — ${t('onboarding.step1Body')}</li>
        <li><strong>${t('onboarding.step2Title')}</strong> — ${t('onboarding.step2Body')}</li>
        <li><strong>${t('onboarding.step3Title')}</strong> — ${t('onboarding.step3Body')}</li>
      </ol>
      <div class="onboarding-actions">
        <a href="/my-passes" class="btn btn-primary">${t('onboarding.goPasses')}</a>
        <a href="/schedule" class="btn btn-secondary">${t('onboarding.goSchedule')}</a>
      </div>
    </div>
  ` : '';

  app.innerHTML = `
    <div class="page">
      <h2>${t('dash.welcome')}${firstName ? `, ${firstName}` : ''}</h2>

      ${cancelledBanner}
      ${passBanner}
      ${onboardingHtml}

      <section class="section">
        <h3>${t('dash.yourPasses')}</h3>
        ${pendingHtml}
        ${activePasses.length === 0 && pending.length === 0
          ? `<div class="empty-state">
              <p class="muted">${t('dash.noActivePasses')}</p>
              <a href="/my-passes" class="btn btn-small btn-primary">${t('onboarding.goPasses')}</a>
            </div>`
          : activePasses.map(p => renderPassCard(p, p.pass_types)).join('')
        }
      </section>

      <section class="section">
        <h3>${t('dash.upcomingClasses')}</h3>
        ${!bookings?.length
          ? `<div class="empty-state">
              <p class="muted">${t('dash.noBookings')}</p>
              <a href="/schedule" class="btn btn-small btn-secondary">${t('dash.browseClasses')}</a>
            </div>`
          : `<ul class="list">${bookings.filter(b => b.class_sessions).map(b => {
              const s = b.class_sessions;
              const dateStr = formatDbDate(s.date, locale, { weekday: 'short', day: 'numeric', month: 'short' });
              const modeSuffix = (s.class_type === 'hybrid' && b.attendance_mode)
                ? ` · ${t('schedule.mode.' + b.attendance_mode)}`
                : '';
              const isCancelled = s.status === 'cancelled';
              const style = isCancelled ? ' style="text-decoration:line-through; opacity:0.6"' : '';
              const tag = isCancelled ? ` · <span style="color:var(--rose-700,#a02c4a); text-decoration:none; font-weight:600">${t('schedule.cancelled')}</span>` : '';
              return `<li${style}>${dateStr} · ${s.start_time.slice(0, 5)} · ${t('type.' + s.class_type)}${modeSuffix}${tag}</li>`;
            }).join('')}</ul>`
        }
      </section>

      ${attendance?.length ? `
        <section class="section">
          <h3>${t('dash.recentAttendance')}</h3>
          <ul class="list">${attendance.filter(a => a.class_sessions).map(a => {
            const s = a.class_sessions;
            const dateStr = formatDbDate(s.date, locale, { weekday: 'short', day: 'numeric', month: 'short' });
            return `<li>${dateStr} · ${s.start_time.slice(0, 5)}</li>`;
          }).join('')}</ul>
        </section>
      ` : ''}
    </div>
  `;
}
