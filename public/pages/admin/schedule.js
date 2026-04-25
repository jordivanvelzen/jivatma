import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t, getLocale } from '../../lib/i18n.js';
import { todayStr } from '../../lib/dates.js';
import { withLoading, onSubmitWithLoading } from '../../lib/loading.js';

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

  const capSummary = (tmpl) => {
    if (tmpl.class_type === 'hybrid') {
      const ip = tmpl.capacity_inperson ?? '—';
      const ol = tmpl.capacity_online ?? '—';
      return `${ip} ${t('admin.inPersonShort')} / ${ol} ${t('admin.onlineShort')}`;
    }
    return `${tmpl.capacity || defaultCap} ${t('admin.capacity').toLowerCase()}`;
  };

  const templateCard = (tmpl) => {
    const isHybrid = tmpl.class_type === 'hybrid';
    const title = `${t('day.' + tmpl.day_of_week)} · ${tmpl.start_time.slice(0,5)}`;
    const meta = `${t('type.' + tmpl.class_type)} · ${capSummary(tmpl)}`;
    return `
      <details class="pt-card ${tmpl.is_active ? '' : 'pt-card-inactive'}" data-tid="${tmpl.id}">
        <summary>
          <div class="pt-summary-main">
            <div class="pt-summary-title">${title}</div>
            <div class="pt-summary-meta">${meta}</div>
          </div>
          <span class="badge ${tmpl.is_active ? 'badge-active' : 'badge-expired'}">${tmpl.is_active ? t('passes.active') : t('admin.inactive')}</span>
        </summary>
        <div class="pt-card-body">
          <div class="pt-card-fields">
            <label>${t('admin.day')}
              <select class="tmpl-edit-day">
                ${[0,1,2,3,4,5,6].map(i => `<option value="${i}" ${i === tmpl.day_of_week ? 'selected' : ''}>${t('day.' + i)}</option>`).join('')}
              </select>
            </label>
            <label>${t('attendance.time')}
              <input type="time" class="tmpl-edit-time" value="${tmpl.start_time.slice(0,5)}" />
            </label>
            <label>${t('attendance.type')}
              <select class="tmpl-edit-type">
                <option value="in_person" ${tmpl.class_type === 'in_person' ? 'selected' : ''}>${t('type.in_person')}</option>
                <option value="online" ${tmpl.class_type === 'online' ? 'selected' : ''}>${t('type.online')}</option>
                <option value="hybrid" ${tmpl.class_type === 'hybrid' ? 'selected' : ''}>${t('type.hybrid')}</option>
              </select>
            </label>
            <label class="tmpl-cap-generic" style="${isHybrid ? 'display:none' : ''}">${t('admin.capacity')}
              <input type="number" class="tmpl-edit-cap" value="${tmpl.capacity || ''}" placeholder="${defaultCap}" min="1" inputmode="numeric" />
            </label>
            <label class="tmpl-cap-permode" style="${isHybrid ? '' : 'display:none'}; grid-column: 1 / -1;">${t('admin.capacity')}
              <div class="field-pair">
                <input type="number" class="tmpl-edit-cap-ip" value="${tmpl.capacity_inperson || ''}" placeholder="${t('admin.inPersonShort')}" min="1" inputmode="numeric" title="${t('admin.capacityInPerson')}" />
                <input type="number" class="tmpl-edit-cap-ol" value="${tmpl.capacity_online || ''}" placeholder="${t('admin.onlineShort')}" min="1" inputmode="numeric" title="${t('admin.capacityOnline')}" />
              </div>
            </label>
          </div>
          <div class="pt-card-actions">
            <button class="btn btn-small btn-primary save-template" data-id="${tmpl.id}">${t('general.save')}</button>
            <button class="btn btn-small btn-secondary toggle-template" data-id="${tmpl.id}" data-active="${tmpl.is_active}">
              ${tmpl.is_active ? t('admin.disable') : t('admin.enable')}
            </button>
            <button class="btn btn-small btn-danger delete-template" data-id="${tmpl.id}">${t('admin.delete')}</button>
          </div>
        </div>
      </details>
    `;
  };

  const upcomingSessions = (sessions || []).slice(0, 30);
  const sessionItem = (s) => {
    const dateStr = new Date(s.date + 'T00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    const capStr = s.class_type === 'hybrid' && (s.capacity_inperson != null || s.capacity_online != null)
      ? `${s.capacity_inperson ?? '—'} ${t('admin.inPersonShort')} / ${s.capacity_online ?? '—'} ${t('admin.onlineShort')}`
      : `${s.capacity || defaultCap} ${t('admin.capacity').toLowerCase()}`;
    const oneOffBadge = s.template_id ? '' : ` <span class="badge badge-pending" style="font-size:0.65rem">${t('admin.oneOff').split('(')[0].trim()}</span>`;
    return `
      <div class="session-row ${s.status === 'cancelled' ? 'cancelled' : ''}" data-sid="${s.id}">
        <div class="session-row-main">
          <div class="session-row-title">${dateStr} · ${s.start_time.slice(0,5)}</div>
          <div class="session-row-meta">${t('type.' + s.class_type)} · ${capStr}${oneOffBadge}</div>
        </div>
        <button class="btn btn-small btn-danger delete-session" data-id="${s.id}" aria-label="${t('admin.delete')}">${t('admin.delete')}</button>
      </div>
    `;
  };

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.weeklySchedule')}</h2>

      ${!templates?.length
        ? `<p class="muted">${t('admin.noTemplates')}</p>`
        : `<div class="pt-card-list">${templates.map(templateCard).join('')}</div>`
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
          <label class="cap-generic">${t('admin.capacity')}
            <input type="number" id="tmpl-cap" min="1" placeholder="${defaultCap}" />
          </label>
        </div>
        <div class="form-row cap-permode" style="display:none">
          <label>${t('admin.capacityInPerson')}
            <input type="number" id="tmpl-cap-ip" min="1" placeholder="${defaultCap}" />
          </label>
          <label>${t('admin.capacityOnline')}
            <input type="number" id="tmpl-cap-ol" min="1" placeholder="${defaultCap}" />
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
          <label class="oo-cap-generic">${t('admin.capacity')}
            <input type="number" id="oo-cap" min="1" placeholder="${defaultCap}" />
          </label>
        </div>
        <div class="form-row oo-cap-permode" style="display:none">
          <label>${t('admin.capacityInPerson')}
            <input type="number" id="oo-cap-ip" min="1" placeholder="${defaultCap}" />
          </label>
          <label>${t('admin.capacityOnline')}
            <input type="number" id="oo-cap-ol" min="1" placeholder="${defaultCap}" />
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
        : `<div class="session-list">${upcomingSessions.map(sessionItem).join('')}</div>`
      }

      <hr />
      <h3>${t('admin.generateSessions')}</h3>
      <p class="muted">${t('admin.generateNote')}</p>
      <button id="generate-btn" class="btn btn-secondary">${t('admin.generateNext2Weeks')}</button>
    </div>
  `;

  // Toggle per-mode/generic capacity inputs in template cards when type changes.
  app.querySelectorAll('.pt-card .tmpl-edit-type').forEach(sel => {
    sel.addEventListener('change', () => {
      const card = sel.closest('details.pt-card');
      if (!card) return;
      const isHybrid = sel.value === 'hybrid';
      const generic = card.querySelector('.tmpl-cap-generic');
      const permode = card.querySelector('.tmpl-cap-permode');
      if (generic) generic.style.display = isHybrid ? 'none' : '';
      if (permode) permode.style.display = isHybrid ? '' : 'none';
    });
  });

  // Save template edit
  app.querySelectorAll('.save-template').forEach(btn => {
    btn.addEventListener('click', () => withLoading(btn, async () => {
      const id = parseInt(btn.dataset.id, 10);
      const card = app.querySelector(`details.pt-card[data-tid="${id}"]`);
      const classType = card.querySelector('.tmpl-edit-type').value;
      const isHybrid = classType === 'hybrid';
      const capVal = (q) => {
        const el = card.querySelector(q);
        return el && el.value ? parseInt(el.value, 10) : null;
      };
      const updates = {
        id,
        day_of_week: parseInt(card.querySelector('.tmpl-edit-day').value, 10),
        start_time: card.querySelector('.tmpl-edit-time').value,
        class_type: classType,
        capacity: isHybrid ? null : capVal('.tmpl-edit-cap'),
        capacity_inperson: isHybrid ? capVal('.tmpl-edit-cap-ip') : null,
        capacity_online: isHybrid ? capVal('.tmpl-edit-cap-ol') : null,
      };
      try {
        await api('/api/admin/schedule', { method: 'PATCH', body: JSON.stringify(updates) });
        showToast(t('admin.templateUpdated'), 'success');
        renderAdminSchedule();
      } catch (err) { showToast(err.message, 'error'); }
    }));
  });

  // Toggle template active
  app.querySelectorAll('.toggle-template').forEach(btn => {
    btn.addEventListener('click', () => withLoading(btn, async () => {
      const id = parseInt(btn.dataset.id, 10);
      const active = btn.dataset.active === 'true';
      const { error } = await sb.from('class_templates').update({ is_active: !active }).eq('id', id);
      if (error) { showToast(error.message, 'error'); return; }
      renderAdminSchedule();
    }));
  });

  // Delete template
  app.querySelectorAll('.delete-template').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm(t('admin.deleteConfirm'))) return;
      return withLoading(btn, async () => {
        const id = parseInt(btn.dataset.id, 10);
        const { error } = await sb.from('class_templates').delete().eq('id', id);
        if (error) { showToast(error.message, 'error'); return; }
        showToast(t('admin.deleted'), 'info');
        renderAdminSchedule();
      });
    });
  });

  // Toggle per-mode capacity inputs in the add-template form when type changes.
  const tmplTypeSel = document.getElementById('tmpl-type');
  const tmplCapGeneric = app.querySelector('#add-template-form .cap-generic');
  const tmplCapPermode = app.querySelector('#add-template-form .cap-permode');
  const syncTmplCap = () => {
    const isHybrid = tmplTypeSel.value === 'hybrid';
    if (tmplCapGeneric) tmplCapGeneric.style.display = isHybrid ? 'none' : '';
    if (tmplCapPermode) tmplCapPermode.style.display = isHybrid ? 'flex' : 'none';
  };
  tmplTypeSel.addEventListener('change', syncTmplCap);

  // Add template
  onSubmitWithLoading(document.getElementById('add-template-form'), async () => {
    const dayOfWeek = parseInt(document.getElementById('tmpl-day').value, 10);
    const startTime = document.getElementById('tmpl-time').value;
    const classType = document.getElementById('tmpl-type').value;
    const isHybrid = classType === 'hybrid';
    const intOrNull = (id) => {
      const v = document.getElementById(id).value;
      return v ? parseInt(v, 10) : null;
    };
    const durationMin = parseInt(document.getElementById('tmpl-dur').value, 10);

    const { error } = await sb.from('class_templates').insert({
      day_of_week: dayOfWeek, start_time: startTime, class_type: classType,
      capacity: isHybrid ? null : intOrNull('tmpl-cap'),
      capacity_inperson: isHybrid ? intOrNull('tmpl-cap-ip') : null,
      capacity_online: isHybrid ? intOrNull('tmpl-cap-ol') : null,
      duration_min: durationMin,
    });

    if (error) { showToast(error.message, 'error'); return; }
    showToast(t('admin.classAdded'), 'success');
    renderAdminSchedule();
  });

  // Toggle per-mode capacity inputs in the one-off form when type changes.
  const ooTypeSel = document.getElementById('oo-type');
  const ooCapGeneric = app.querySelector('#add-oneoff-form .oo-cap-generic');
  const ooCapPermode = app.querySelector('#add-oneoff-form .oo-cap-permode');
  const syncOoCap = () => {
    const isHybrid = ooTypeSel.value === 'hybrid';
    if (ooCapGeneric) ooCapGeneric.style.display = isHybrid ? 'none' : '';
    if (ooCapPermode) ooCapPermode.style.display = isHybrid ? 'flex' : 'none';
  };
  ooTypeSel.addEventListener('change', syncOoCap);

  // Add one-off session
  onSubmitWithLoading(document.getElementById('add-oneoff-form'), async () => {
    const classType = document.getElementById('oo-type').value;
    const isHybrid = classType === 'hybrid';
    const intOrNull = (id) => {
      const v = document.getElementById(id).value;
      return v ? parseInt(v, 10) : null;
    };
    const payload = {
      date: document.getElementById('oo-date').value,
      start_time: document.getElementById('oo-time').value,
      class_type: classType,
      capacity: isHybrid ? null : intOrNull('oo-cap'),
      capacity_inperson: isHybrid ? intOrNull('oo-cap-ip') : null,
      capacity_online: isHybrid ? intOrNull('oo-cap-ol') : null,
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
    btn.addEventListener('click', () => {
      if (!confirm(t('admin.deleteConfirm'))) return;
      return withLoading(btn, async () => {
        const id = parseInt(btn.dataset.id, 10);
        try {
          await api('/api/admin/schedule?type=sessions', { method: 'DELETE', body: JSON.stringify({ id }) });
          showToast(t('admin.sessionDeleted'), 'info');
          renderAdminSchedule();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  });

  // Generate sessions
  document.getElementById('generate-btn').addEventListener('click', (ev) => withLoading(ev.currentTarget, async () => {
    try {
      const res = await fetch('/api/cron/generate-sessions', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(t('admin.generated', { n: data.created }), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }));
}
