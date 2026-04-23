import { sb } from '../../lib/supabase.js';
import { t, getLocale } from '../../lib/i18n.js';
import { todayStr, formatDbDate } from '../../lib/dates.js';

export async function renderAdminDashboard() {
  const app = document.getElementById('app');
  const today = todayStr();

  // Today's sessions
  const { data: sessions } = await sb
    .from('class_sessions')
    .select('*')
    .eq('date', today)
    .eq('status', 'scheduled')
    .order('start_time', { ascending: true });

  // Expiring passes (within 7 days)
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const weekStr = weekFromNow.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  const { data: expiringPasses } = await sb
    .from('user_passes')
    .select('*, profiles(full_name), pass_types(kind, class_count)')
    .gte('expires_at', today)
    .lte('expires_at', weekStr)
    .order('expires_at', { ascending: true });

  // Passes with few classes left (1-2 remaining on multi passes)
  const { data: lowPasses } = await sb
    .from('user_passes')
    .select('*, profiles(full_name), pass_types(kind, class_count)')
    .gte('expires_at', today)
    .gt('classes_remaining', 0)
    .lte('classes_remaining', 2)
    .order('classes_remaining', { ascending: true });

  const locale = getLocale();

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.dashboard')}</h2>

      <section class="section">
        <h3>${t('admin.todaysClasses')}</h3>
        ${!sessions?.length
          ? `<p class="muted">${t('admin.noClassesToday')}</p>`
          : `<div class="class-list">
              ${sessions.map(s => `
                <a href="#/admin/class?date=${today}&session=${s.id}" class="class-card clickable">
                  <div class="class-time">${s.start_time.slice(0, 5)}</div>
                  <div class="class-type">${t('type.' + s.class_type)}</div>
                </a>
              `).join('')}
            </div>`
        }
      </section>

      <section class="section">
        <h3>${t('admin.expiringSoon')}</h3>
        ${!expiringPasses?.length && !lowPasses?.length
          ? `<p class="muted">${t('admin.noExpiring')}</p>`
          : `<ul class="list">
              ${(expiringPasses || []).map(p => {
                const name = p.profiles?.full_name || 'Unknown';
                const dateStr = formatDbDate(p.expires_at, locale, { day: 'numeric', month: 'short' });
                return `<li class="alert-item">\u23F0 ${name} — ${t('admin.expiresOn', { date: dateStr })}</li>`;
              }).join('')}
              ${(lowPasses || []).map(p => {
                const name = p.profiles?.full_name || 'Unknown';
                return `<li class="alert-item">\u26A0\uFE0F ${name} — ${t('admin.classesRemaining', { n: p.classes_remaining })}</li>`;
              }).join('')}
            </ul>`
        }
      </section>

      <section class="section">
        <h3>${t('admin.quickActions')}</h3>
        <div class="quick-actions">
          <a href="#/admin/class" class="btn btn-primary">${t('admin.markAttendance')}</a>
          <a href="#/admin/users" class="btn btn-secondary">${t('admin.manageUsers')}</a>
          <a href="#/admin/schedule" class="btn btn-secondary">${t('admin.editSchedule')}</a>
        </div>
      </section>
    </div>
  `;
}
