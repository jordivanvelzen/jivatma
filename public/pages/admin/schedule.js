import { sb } from '../../lib/supabase.js';
import { showToast } from '../../components/toast.js';
import { t } from '../../lib/i18n.js';

export async function renderAdminSchedule() {
  const app = document.getElementById('app');

  const { data: templates } = await sb
    .from('class_templates')
    .select('*')
    .order('day_of_week')
    .order('start_time');

  const { data: capSetting } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'default_capacity')
    .single();
  const defaultCap = capSetting?.value || '15';

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.weeklySchedule')}</h2>

      ${!templates?.length
        ? `<p class="muted">${t('admin.noTemplates')}</p>`
        : `<table class="table">
            <thead><tr><th>${t('admin.day')}</th><th>${t('attendance.time')}</th><th>${t('attendance.type')}</th><th>${t('admin.capacity')}</th><th></th></tr></thead>
            <tbody>
              ${templates.map(tmpl => `
                <tr class="${tmpl.is_active ? '' : 'inactive-row'}">
                  <td>${t('day.' + tmpl.day_of_week)}</td>
                  <td>${tmpl.start_time.slice(0, 5)}</td>
                  <td>${t('type.' + tmpl.class_type)}</td>
                  <td>${tmpl.capacity || defaultCap}</td>
                  <td>
                    <button class="btn btn-small toggle-template" data-id="${tmpl.id}" data-active="${tmpl.is_active}">
                      ${tmpl.is_active ? t('admin.disable') : t('admin.enable')}
                    </button>
                    <button class="btn btn-small btn-danger delete-template" data-id="${tmpl.id}">${t('admin.delete')}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>`
      }

      <h3>${t('admin.addClass')}</h3>
      <form id="add-template-form" class="form">
        <div class="form-row">
          <label>${t('admin.day')}
            <select id="tmpl-day" required>
              ${[0,1,2,3,4,5,6].map(i => `<option value="${i}">${t('day.' + i)}</option>`).join('')}
            </select>
          </label>
          <label>${t('attendance.time')}
            <input type="time" id="tmpl-time" required value="09:00" />
          </label>
        </div>
        <div class="form-row">
          <label>${t('attendance.type')}
            <select id="tmpl-type" required>
              <option value="in_person">${t('type.in_person')}</option>
              <option value="online">${t('type.online')}</option>
              <option value="hybrid">${t('type.hybrid')}</option>
            </select>
          </label>
          <label>${t('admin.capacity')} (blank = default ${defaultCap})
            <input type="number" id="tmpl-cap" min="1" placeholder="${defaultCap}" />
          </label>
        </div>
        <div class="form-row">
          <label>${t('admin.duration')}
            <input type="number" id="tmpl-dur" min="15" value="60" required />
          </label>
        </div>
        <button type="submit" class="btn btn-primary">${t('admin.addClass')}</button>
      </form>

      <hr />
      <h3>${t('admin.generateSessions')}</h3>
      <p class="muted">${t('admin.generateNote')}</p>
      <button id="generate-btn" class="btn btn-secondary">${t('admin.generateNext2Weeks')}</button>
    </div>
  `;

  // Toggle template
  app.querySelectorAll('.toggle-template').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      const active = btn.dataset.active === 'true';
      const { error } = await sb.from('class_templates').update({ is_active: !active }).eq('id', id);
      if (error) { showToast(error.message, 'error'); return; }
      renderAdminSchedule();
    });
  });

  // Delete template
  app.querySelectorAll('.delete-template').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('admin.deleteConfirm'))) return;
      const id = parseInt(btn.dataset.id, 10);
      const { error } = await sb.from('class_templates').delete().eq('id', id);
      if (error) { showToast(error.message, 'error'); return; }
      showToast(t('admin.deleted'), 'info');
      renderAdminSchedule();
    });
  });

  // Add template
  document.getElementById('add-template-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dayOfWeek = parseInt(document.getElementById('tmpl-day').value, 10);
    const startTime = document.getElementById('tmpl-time').value;
    const classType = document.getElementById('tmpl-type').value;
    const capacity = document.getElementById('tmpl-cap').value ? parseInt(document.getElementById('tmpl-cap').value, 10) : null;
    const durationMin = parseInt(document.getElementById('tmpl-dur').value, 10);

    const { error } = await sb.from('class_templates').insert({
      day_of_week: dayOfWeek, start_time: startTime, class_type: classType, capacity, duration_min: durationMin,
    });

    if (error) { showToast(error.message, 'error'); return; }
    showToast(t('admin.classAdded'), 'success');
    renderAdminSchedule();
  });

  // Generate sessions
  document.getElementById('generate-btn').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/cron/generate-sessions', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(t('admin.generated', { n: data.created }), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
