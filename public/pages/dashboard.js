import { sb, getSession } from '../lib/supabase.js';
import { renderPassCard } from '../components/pass-card.js';
import { t, getLocale } from '../lib/i18n.js';
import { todayStr, formatDbDate } from '../lib/dates.js';

export async function renderDashboard() {
  const app = document.getElementById('app');
  const session = await getSession();
  const userId = session.user.id;
  const today = todayStr();

  const [{ data: profile }, { data: passes }, { data: bookings }, { data: attendance }] = await Promise.all([
    sb.from('profiles').select('full_name, phone').eq('id', userId).single(),
    sb.from('user_passes').select('*, pass_types(*)').eq('user_id', userId).gte('expires_at', today).order('expires_at', { ascending: true }),
    sb.from('bookings').select('*, class_sessions(*)').eq('user_id', userId).is('cancelled_at', null).gte('class_sessions.date', today).order('booked_at', { ascending: true }).limit(5),
    sb.from('attendance').select('*, class_sessions(*)').eq('user_id', userId).order('checked_in_at', { ascending: false }).limit(5),
  ]);

  const activePasses = (passes || []).filter(p =>
    p.pass_types.kind === 'unlimited' || p.classes_remaining > 0
  );

  const locale = getLocale();
  const firstName = (profile?.full_name || '').split(' ')[0];

  // Show onboarding for brand-new students: no passes, no bookings, no attendance
  const isBrandNew = !activePasses.length && !bookings?.length && !attendance?.length;

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
        <a href="#/my-passes" class="btn btn-primary">${t('onboarding.goPasses')}</a>
        <a href="#/schedule" class="btn btn-secondary">${t('onboarding.goSchedule')}</a>
      </div>
    </div>
  ` : '';

  app.innerHTML = `
    <div class="page">
      <h2>${t('dash.welcome')}${firstName ? `, ${firstName}` : ''}</h2>

      ${onboardingHtml}

      <section class="section">
        <h3>${t('dash.yourPasses')}</h3>
        ${activePasses.length === 0
          ? `<div class="empty-state">
              <p class="muted">${t('dash.noActivePasses')}</p>
              <a href="#/my-passes" class="btn btn-small btn-primary">${t('onboarding.goPasses')}</a>
            </div>`
          : activePasses.map(p => renderPassCard(p, p.pass_types)).join('')
        }
      </section>

      <section class="section">
        <h3>${t('dash.upcomingClasses')}</h3>
        ${!bookings?.length
          ? `<div class="empty-state">
              <p class="muted">${t('dash.noBookings')}</p>
              <a href="#/schedule" class="btn btn-small btn-secondary">${t('dash.browseClasses')}</a>
            </div>`
          : `<ul class="list">${bookings.filter(b => b.class_sessions).map(b => {
              const s = b.class_sessions;
              const dateStr = formatDbDate(s.date, locale, { weekday: 'short', day: 'numeric', month: 'short' });
              return `<li>${dateStr} · ${s.start_time.slice(0, 5)} · ${t('type.' + s.class_type)}</li>`;
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
