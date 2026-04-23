import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t, getLocale } from '../../lib/i18n.js';
import { todayStr } from '../../lib/dates.js';

export async function renderAdminSchedule() {
  const app = document.getElementById('app');
  const today = todayStr();

  const [{ data: templates }, { data: capSetting }, { data: sessions }] = await Promise.all([
    sb.from('class_templates').select('*').order('day_of_week').order('start_time'),
    sb.from('settings').select('value').eq('key', 'default_capacity').single(),
    sb.from('class_sessions').select('*').gte('date', today).order('date').order('start_time'),
  ]);
  const defaultCap = capSetting?.value || '15';
  const locale = getLocale();

  const templateRow = (tmpl) => `
    <tr class="${tmpl.is_active ? '' : 'inactive-row'}" data-tid="${tmpl.id}">
      <td>
        <select class="tmpl-edit-day" style="width:auto">
          ${[0,1,2,3,4,5,6].map(i => `<option value="${i}" ${i === tmpl.day_of_week ? 'selected' : ''}>${t('day.' + i)}</option>`).join('')}
        </select>
      </td>
      <td><input type="time" class="tmpl-edit-time" value="${tmpl.start_time.slice(0,5)}" /></td>
      <td>
        <select class="tmpl-edit-type" style="width:auto">
          <option value="in_person" ${tmpl.class_type === 'in_person' ? 'selected' : ''}>${t('type.in_person')}</option>
          <option value="online" ${tmpl.class_type === 'online' ? 'selected' : ''}>${t('type.online')}</option>
          <option value="hybrid" ${tmpl.class_type === 'hybrid' ? 'selected' : ''}>${t('type.hybrid')}</option>
        </select>
      </td>
      <td><input type="number" class="tmpl-edit-cap" value="${tmpl.capacity || ''}" placeholder="${defaultCap}" min="1" style="width:4rem" /></td>
      <td>
        <button class="btn btn-small save-template" data-id="${tmpl.id}">${t('general.save')}</button>
        <button class="btn btn-small toggle-template" data-id="${tmpl.id}" data-active="${tmpl.is_active}">
          ${tmpl.is_active ? t('admin.disable') : t('admin.enable')}
        </button>
        <button class="btn btn-small btn-danger delete-template" data-id="${tmpl.id}">${t('admin.delete')}</button>
      </td>
    </tr>
  `;

  const upcomingSessions = (sessions || []).slice(0, 30);
  const sessionRow = (s) => {
    const dateStr = new Date(s.date + 'T00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    return `
      <tr data-sid="${s.id}" class="${s.status === 'cancelled' ? 'inactive-row' : ''}">
        <td>${dateStr}</td>
        <td>${s.start_time.slice(0,5)}</td>
        <td>${t('type.' + s.class_type)}${s.template_id ? '' : ` <span class="badge badge-pending" style="font-size:0.65rem">${t('admin.oneOff').split('(')[0].trim()}</span>`}</td>
        <td>${s.capacity || defaultCap}</td>
        <td>
          <button class="btn btn-small btn-danger delete-session" data-id="${s.id}">${t('admin.delete')}</button>
        </td>
      </tr>
    `;
  };

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.weeklySchedule')}</h2>

      ${!templates?.length
        ? `<p class="muted">${t('admin.noTemplates')}</p>`
        : `<table class="table">
            <thead><tr><th>${t('admin.day')}</th><th>${t('attendance.time')}</th><th>${t('attendance.type')}</th><th>${t('admin.capacity')}</th><th></th></tr></thead>
            <tbody>${templates.map(templateRow).join('')}</tbody>
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
          <label>${t('admin.capacity')}
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
      <h3>${t('admin.addOneOff')}</h3>
      <form id="add-oneoff-form" class="form">
        <div class="form-row">
          <label>${t('admin.date')}
            <input type="date" id="oo-date" required min="${today}" />
          </label>
          <label>${t('attendance.time')}
            <input type="time" id="oo-time" required value="09:00" />
          </label>
        </div>
        <div class="form-row">
          <label>${t('attendance.type')}
            <select id="oo-type" required>
              <option value="in_person">${t('type.in_person')}</option>
              <option value="online">${t('type.online')}</option>
              <option value="hybrid">${t('type.hybrid')}</option>
            </select>
          </label>
          <label>${t('admin.capacity')}
            <input type="number" id="oo-cap" min="1" placeholder="${defaultCap}" />
          </label>
        </div>
        <label>${t('admin.sessionNotes')}
          <input type="text" id="oo-notes" />
        </label>
        <button type="submit" class="btn btn-primary">${t('admin.addOneOff')}</button>
      </form>

      <hr />
      <h3>${t('admin.upcomingSessions')}</h3>
      ${!upcomingSessions.length
        ? `<p class="muted">${t('admin.noClassesToday')}</p>`
        : `<table class="table">
            <thead><tr><th>${t('admin.date')}</th><th>${t('attendance.time')}</th><th>${t('attendance.type')}</th><th>${t('admin.capacity')}</th><th></th></tr></thead>
            <tbody>${upcomingSessions.map(sessionRow).join('')}</tbody>
          </table>`
      }

      <hr />
      <h3>${t('admin.generateSessions')}</h3>
      <p class="muted">${t('admin.generateNote')}</p>
      <button id="generate-btn" class="btn btn-secondary">${t('admin.generateNext2Weeks')}</button>
    </div>
  `;

  // Save template edit
  app.querySelectorAll('.save-template').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      const row = app.querySelector(`tr[data-tid="${id}"]`);
      const updates = {
        id,
        day_of_week: parseInt(row.querySelector('.tmpl-edit-day').value, 10),
        start_time: row.querySelector('.tmpl-edit-time').value,
        class_type: row.querySelector('.tmpl-edit-type').value,
        capacity: row.querySelector('.tmpl-edit-cap').value ? parseInt(row.querySelector('.tmpl-edit-cap').value, 10) : null,
      };
      try {
        await api('/api/admin/schedule', { method: 'PATCH', body: JSON.stringify(updates) });
        showToast(t('admin.templateUpdated'), 'success');
        renderAdminSchedule();
      } catch (err) { showToast(err.message, 'error'); }
    });
  });

  // Toggle template active
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

  // Add one-off session
  document.getElementById('add-oneoff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      date: document.getElementById('oo-date').value,
      start_time: document.getElementById('oo-time').value,
      class_type: document.getElementById('oo-type').value,
      capacity: document.getElementById('oo-cap').value ? parseInt(document.getElementById('oo-cap').value, 10) : null,
      notes: document.getElementById('oo-notes').value || null,
    };
    try {
      await api('/api/admin/schedule?type=sessions', { method: 'POST', body: JSON.stringify(payload) });
      showToast(t('admin.sessionAdded'), 'success');
      renderAdminSchedule();
    } catch (err) { showToast(err.message, 'error'); }
  });

  // Delete session
  app.querySelectorAll('.delete-session').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('admin.deleteConfirm'))) return;
      const id = parseInt(btn.dataset.id, 10);
      try {
        await api('/api/admin/schedule?type=sessions', { method: 'DELETE', body: JSON.stringify({ id }) });
        showToast(t('admin.sessionDeleted'), 'info');
        renderAdminSchedule();
      } catch (err) { showToast(err.message, 'error'); }
    });
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
