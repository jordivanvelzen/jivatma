import { sb, getSession } from '../lib/supabase.js';
import { t, getLocale } from '../lib/i18n.js';
import { formatDbDate } from '../lib/dates.js';

export async function renderMyAttendance() {
  const app = document.getElementById('app');
  const session = await getSession();

  const { data: records } = await sb
    .from('attendance')
    .select('*, class_sessions(*)')
    .eq('user_id', session.user.id)
    .order('checked_in_at', { ascending: false });

  const locale = getLocale();

  app.innerHTML = `
    <div class="page">
      <h2>${t('attendance.title')}</h2>
      ${!records?.length
        ? `<p class="muted">${t('attendance.noRecords')}</p>`
        : `<table class="table">
            <thead><tr><th>${t('attendance.date')}</th><th>${t('attendance.time')}</th><th>${t('attendance.type')}</th></tr></thead>
            <tbody>
              ${records.filter(r => r.class_sessions).map(r => {
                const s = r.class_sessions;
                const dateStr = formatDbDate(s.date, locale, { day: 'numeric', month: 'short', year: 'numeric' });
                return `<tr><td>${dateStr}</td><td>${s.start_time.slice(0, 5)}</td><td>${t('type.' + s.class_type)}</td></tr>`;
              }).join('')}
            </tbody>
          </table>`
      }
    </div>
  `;
}
