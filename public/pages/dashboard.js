import { sb, getSession } from '../lib/supabase.js';
import { renderPassCard } from '../components/pass-card.js';
import { t, getLocale } from '../lib/i18n.js';

export async function renderDashboard() {
  const app = document.getElementById('app');
  const session = await getSession();
  const userId = session.user.id;
  const today = new Date().toISOString().split('T')[0];

  // Fetch active passes with their type info
  const { data: passes } = await sb
    .from('user_passes')
    .select('*, pass_types(*)')
    .eq('user_id', userId)
    .gte('expires_at', today)
    .order('expires_at', { ascending: true });

  // Fetch upcoming bookings
  const { data: bookings } = await sb
    .from('bookings')
    .select('*, class_sessions(*)')
    .eq('user_id', userId)
    .is('cancelled_at', null)
    .gte('class_sessions.date', today)
    .order('booked_at', { ascending: true })
    .limit(5);

  // Fetch recent attendance
  const { data: attendance } = await sb
    .from('attendance')
    .select('*, class_sessions(*)')
    .eq('user_id', userId)
    .order('checked_in_at', { ascending: false })
    .limit(5);

  const activePasses = (passes || []).filter(p =>
    p.pass_types.kind === 'unlimited' || p.classes_remaining > 0
  );

  const locale = getLocale();

  app.innerHTML = `
    <div class="page">
      <h2>${t('dash.welcome')}</h2>

      <section class="section">
        <h3>${t('dash.yourPasses')}</h3>
        ${activePasses.length === 0
          ? `<p class="muted">${t('dash.noActivePasses')}</p>`
          : activePasses.map(p => renderPassCard(p, p.pass_types)).join('')
        }
      </section>

      <section class="section">
        <h3>${t('dash.upcomingClasses')}</h3>
        ${!bookings?.length
          ? `<p class="muted">${t('dash.noBookings')} <a href="#/schedule">${t('dash.browseClasses')}</a></p>`
          : `<ul class="list">${bookings.filter(b => b.class_sessions).map(b => {
              const s = b.class_sessions;
              const dateStr = new Date(s.date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
              return `<li>${dateStr} · ${s.start_time.slice(0, 5)} · ${t('type.' + s.class_type)}</li>`;
            }).join('')}</ul>`
        }
      </section>

      <section class="section">
        <h3>${t('dash.recentAttendance')}</h3>
        ${!attendance?.length
          ? `<p class="muted">${t('dash.noAttendance')}</p>`
          : `<ul class="list">${attendance.filter(a => a.class_sessions).map(a => {
              const s = a.class_sessions;
              const dateStr = new Date(s.date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
              return `<li>${dateStr} · ${s.start_time.slice(0, 5)}</li>`;
            }).join('')}</ul>`
        }
      </section>
    </div>
  `;
}
