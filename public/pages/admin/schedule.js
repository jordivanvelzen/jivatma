import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { showConfirm } from '../../components/confirm.js';
import { t, getLocale } from '../../lib/i18n.js';
import { todayStr } from '../../lib/dates.js';
import { withLoading, onSubmitWithLoading } from '../../lib/loading.js';

export async function renderAdminSchedule() {
  const app = document.getElementById('app');
  const today = todayStr();

  const [{ data: templates }, { data: capSetting }, { data: sessions }, { data: unavailability }] = await Promise.all([
    sb.from('class_templates').select('*').order('day_of_week').order('start_time'),
    sb.from('settings').select('value').eq('key', 'default_capacity').single(),
    sb.from('class_sessions').select('*').gte('date', today).order('date').order('start_time'),
    sb.from('unavailability').select('*').gte('end_date', today).order('start_date', { ascending: true }),
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
    const isCancelled = s.status === 'cancelled';
    const isAutoCancel = isCancelled && s.auto_cancelled;
    const cancelMeta = isCancelled
      ? `<div class="session-row-meta" style="color:var(--rose-700,#a02c4a)">⊘ ${t('admin.sessionCancelled')}${s.cancellation_reason ? ` · ${s.cancellation_reason}` : ''}${isAutoCancel ? ` · ${t('admin.cancelByUnavail')}` : ''}</div>`
      : '';
    let actionBtn;
    if (isCancelled && !isAutoCancel) {
      actionBtn = `<button class="btn btn-small btn-secondary uncancel-session" data-id="${s.id}">${t('admin.reopenClass')}</button>`;
    } else if (isCancelled && isAutoCancel) {
      // Auto-cancelled: removing the unavailability window restores it. Avoid a per-session "reopen" here.
      actionBtn = `<button class="btn btn-small btn-danger delete-session" data-id="${s.id}">${t('admin.delete')}</button>`;
    } else {
      actionBtn = `
        <button class="btn btn-small btn-secondary cancel-session" data-id="${s.id}">${t('admin.cancelClass')}</button>
        <button class="btn btn-small btn-danger delete-session" data-id="${s.id}">${t('admin.delete')}</button>
      `;
    }
    return `
      <div class="session-row ${isCancelled ? 'cancelled' : ''}" data-sid="${s.id}" style="${isCancelled ? 'opacity:0.65' : ''}">
        <div class="session-row-main">
          <div class="session-row-title" style="${isCancelled ? 'text-decoration:line-through' : ''}">${dateStr} · ${s.start_time.slice(0,5)}</div>
          <div class="session-row-meta">${t('type.' + s.class_type)} · ${capStr}${oneOffBadge}</div>
          ${cancelMeta}
        </div>
        <div class="session-row-actions" style="display:flex; gap:var(--s-2,0.5rem); flex-wrap:wrap; align-items:center">${actionBtn}</div>
      </div>
    `;
  };

  const unavailItem = (u) => {
    const fmt = (d) => new Date(d + 'T00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const range = u.start_date === u.end_date ? fmt(u.start_date) : `${fmt(u.start_date)} – ${fmt(u.end_date)}`;
    return `
      <div class="session-row" data-uid="${u.id}">
        <div class="session-row-main">
          <div class="session-row-title">${range}</div>
          ${u.reason ? `<div class="session-row-meta">${u.reason}</div>` : ''}
        </div>
        <button class="btn btn-small btn-danger delete-unavail" data-id="${u.id}">${t('admin.delete')}</button>
      </div>
    `;
  };

  app.innerHTML = `
    <style>
      .sched-page { display:flex; flex-direction:column; gap: var(--s-4); padding-bottom: var(--s-8); overflow-x: hidden; }
      .sched-page > h2 { margin: 0 0 var(--s-2); }

      .set-section {
        border:1px solid var(--ink-100);
        border-radius: var(--r-lg);
        background:#fff;
        box-shadow: var(--sh-1);
        overflow:hidden;
        transition: box-shadow var(--t-fast) var(--ease);
      }
      .set-section[open] { box-shadow: var(--sh-2); }
      .set-section > summary {
        list-style:none;
        cursor:pointer;
        padding: var(--s-4) var(--s-5);
        display:flex; align-items:center; gap: var(--s-3);
        font-weight:600;
        font-size: 1.05rem;
        color: var(--ink-900);
        user-select:none;
      }
      .set-section > summary:hover { background: var(--ink-50, #f7f7f4); }
      .set-section > summary::-webkit-details-marker { display:none; }
      .set-section > summary .sec-icon {
        width: 36px; height: 36px;
        display:inline-flex; align-items:center; justify-content:center;
        background: var(--green-50, #eef3ee);
        color: var(--green-700);
        border-radius: var(--r-md);
        font-size: 1.1rem;
        flex-shrink:0;
      }
      .set-section > summary .sec-title { flex:1; min-width:0; }
      .set-section > summary .sec-sub { display:block; font-weight:400; font-size:.8rem; color: var(--ink-500); margin-top:2px; }
      .set-section > summary .sec-chev {
        color: var(--ink-500);
        transition: transform var(--t-fast) var(--ease);
        flex-shrink:0;
      }
      .set-section[open] > summary .sec-chev { transform: rotate(180deg); }

      .set-body {
        padding: var(--s-4) var(--s-5) var(--s-5);
        display:flex; flex-direction:column; gap: var(--s-4);
        border-top:1px solid var(--ink-100);
      }
    </style>

    <div class="page sched-page">
      <h2>${t('admin.weeklySchedule')}</h2>

      <!-- Weekly templates -->
      <details class="set-section" id="sec-templates">
        <summary>
          <span class="sec-icon">📅</span>
          <span class="sec-title">${t('admin.weeklySchedule')}<span class="sec-sub">${t('admin.weeklyScheduleSub')}</span></span>
          <span class="sec-chev">▾</span>
        </summary>
        <div class="set-body">
          ${!templates?.length
            ? `<p class="muted">${t('admin.noTemplates')}</p>`
            : `<div class="pt-card-list">${templates.map(templateCard).join('')}</div>`
          }
        </div>
      </details>

      <!-- Add recurring class -->
      <details class="set-section" id="sec-add-tmpl">
        <summary>
          <span class="sec-icon">➕</span>
          <span class="sec-title">${t('admin.addClass')}<span class="sec-sub">${t('admin.addTemplateSub')}</span></span>
          <span class="sec-chev">▾</span>
        </summary>
        <div class="set-body">
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
        </div>
      </details>

      <!-- Add one-off session -->
      <details class="set-section" id="sec-add-oneoff">
        <summary>
          <span class="sec-icon">📆</span>
          <span class="sec-title">${t('admin.addOneOff')}<span class="sec-sub">${t('admin.addOneOffSub')}</span></span>
          <span class="sec-chev">▾</span>
        </summary>
        <div class="set-body">
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
        </div>
      </details>

      <!-- Upcoming sessions -->
      <details class="set-section" id="sec-sessions">
        <summary>
          <span class="sec-icon">📋</span>
          <span class="sec-title">${t('admin.upcomingSessions')}<span class="sec-sub">${t('admin.upcomingSessionsSub')}</span></span>
          <span class="sec-chev">▾</span>
        </summary>
        <div class="set-body">
          ${!upcomingSessions.length
            ? `<p class="muted">${t('admin.noClassesToday')}</p>`
            : `<div class="session-list">${upcomingSessions.map(sessionItem).join('')}</div>`
          }
        </div>
      </details>

      <!-- Unavailability -->
      <details class="set-section" id="sec-unavail">
        <summary>
          <span class="sec-icon">🚫</span>
          <span class="sec-title">${t('admin.unavailability')}<span class="sec-sub">${t('admin.unavailSub')}</span></span>
          <span class="sec-chev">▾</span>
        </summary>
        <div class="set-body">
          <p class="muted">${t('admin.unavailabilityNote')}</p>
          ${(unavailability || []).length
            ? `<div class="session-list">${(unavailability || []).map(unavailItem).join('')}</div>`
            : `<p class="muted">${t('admin.noUnavailability')}</p>`
          }
          <form id="add-unavail-form" class="form">
            <div class="form-row">
              <label>${t('admin.unavailFrom')}
                <input type="date" id="unavail-start" required min="${today}" />
              </label>
              <label>${t('admin.unavailTo')}
                <input type="date" id="unavail-end" required min="${today}" />
              </label>
            </div>
            <label>${t('admin.unavailReason')}
              <input type="text" id="unavail-reason" placeholder="${t('admin.unavailReasonPlaceholder')}" />
            </label>
            <button type="submit" class="btn btn-primary">${t('admin.unavailAdd')}</button>
          </form>
        </div>
      </details>

      <!-- Generate & sync -->
      <details class="set-section" id="sec-generate">
        <summary>
          <span class="sec-icon">⚙️</span>
          <span class="sec-title">${t('admin.generateSessions')}<span class="sec-sub">${t('admin.generateSub')}</span></span>
          <span class="sec-chev">▾</span>
        </summary>
        <div class="set-body">
          <p class="muted">${t('admin.generateNote')}</p>
          <div style="display:flex; gap: var(--s-2); flex-wrap: wrap">
            <button id="preview-btn" class="btn btn-secondary">${t('admin.previewGenerate')}</button>
            <button id="generate-btn" class="btn btn-secondary">${t('admin.generateNext2Weeks')}</button>
            <button id="resync-btn" class="btn btn-secondary">${t('admin.resyncTemplates')}</button>
          </div>
        </div>
      </details>
    </div>
  `;

  // Persist open/closed state of each section card across page visits.
  const SCHED_STORE = 'sched_sections';
  const sectionState = (() => {
    try { return JSON.parse(localStorage.getItem(SCHED_STORE) || '{}'); } catch { return {}; }
  })();
  app.querySelectorAll('details.set-section[id]').forEach(el => {
    if (el.id in sectionState) el.open = sectionState[el.id];
    el.addEventListener('toggle', () => {
      sectionState[el.id] = el.open;
      localStorage.setItem(SCHED_STORE, JSON.stringify(sectionState));
    });
  });

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
    btn.addEventListener('click', async () => {
      const ok = await showConfirm({
        title: t('confirm.deleteTemplateTitle'),
        message: t('confirm.deleteTemplateMessage'),
        confirmText: t('confirm.delete'),
        variant: 'danger',
      });
      if (!ok) return;
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

  // Cancel session (manual)
  app.querySelectorAll('.cancel-session').forEach(btn => {
    btn.addEventListener('click', () => {
      const reason = prompt(t('admin.cancelClassPrompt'), '');
      if (reason === null) return; // user dismissed
      return withLoading(btn, async () => {
        const id = parseInt(btn.dataset.id, 10);
        try {
          const data = await api('/api/admin/schedule?action=cancel-session', {
            method: 'POST',
            body: JSON.stringify({ id, reason: reason || null }),
          });
          const sent = data?.notify?.sent || 0;
          showToast(sent > 0 ? t('admin.cancelClassNotified', { n: sent }) : t('admin.cancelClassDone'), 'success');
          renderAdminSchedule();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  });

  // Reopen a manually-cancelled session
  app.querySelectorAll('.uncancel-session').forEach(btn => {
    btn.addEventListener('click', () => withLoading(btn, async () => {
      const id = parseInt(btn.dataset.id, 10);
      try {
        await api('/api/admin/schedule?action=uncancel-session', {
          method: 'POST',
          body: JSON.stringify({ id }),
        });
        showToast(t('admin.reopenDone'), 'success');
        renderAdminSchedule();
      } catch (err) { showToast(err.message, 'error'); }
    }));
  });

  // Delete session
  app.querySelectorAll('.delete-session').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await showConfirm({
        title: t('confirm.deleteSessionTitle'),
        message: t('confirm.deleteSessionMessage'),
        confirmText: t('confirm.delete'),
        variant: 'danger',
      });
      if (!ok) return;
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

  // Add unavailability
  onSubmitWithLoading(document.getElementById('add-unavail-form'), async () => {
    const start_date = document.getElementById('unavail-start').value;
    const end_date = document.getElementById('unavail-end').value;
    const reason = document.getElementById('unavail-reason').value || null;
    try {
      await api('/api/admin/schedule?type=unavailability', { method: 'POST', body: JSON.stringify({ start_date, end_date, reason }) });
      showToast(t('admin.unavailAdded'), 'success');
      // Auto-run generate so cancellations apply immediately to existing future sessions.
      try { await fetch('/api/cron/generate-sessions', { method: 'POST' }); } catch {}
      renderAdminSchedule();
    } catch (err) { showToast(err.message, 'error'); }
  });

  // Delete unavailability
  app.querySelectorAll('.delete-unavail').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await showConfirm({
        title: t('confirm.deleteUnavailTitle'),
        message: t('confirm.deleteUnavailMessage'),
        confirmText: t('confirm.delete'),
        variant: 'danger',
      });
      if (!ok) return;
      return withLoading(btn, async () => {
        const id = parseInt(btn.dataset.id, 10);
        try {
          await api('/api/admin/schedule?type=unavailability', { method: 'DELETE', body: JSON.stringify({ id }) });
          showToast(t('admin.deleted'), 'info');
          // Auto-run generate so any auto-cancelled sessions are restored.
          try { await fetch('/api/cron/generate-sessions', { method: 'POST' }); } catch {}
          renderAdminSchedule();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  });

  // Preview generate (dry-run)
  document.getElementById('preview-btn').addEventListener('click', (ev) => withLoading(ev.currentTarget, async () => {
    try {
      const res = await fetch('/api/cron/generate-sessions?dryRun=1', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const lines = [
        `${t('admin.previewWindow')}: ${data.window.from} → ${data.window.to}`,
        `+ ${data.created} ${t('admin.previewCreated')}`,
        `⊘ ${data.autoCancelled} ${t('admin.previewAutoCancel')}`,
        `↺ ${data.restored} ${t('admin.previewRestore')}`,
        `🗑 ${data.cleanedUp} ${t('admin.previewCleanup')}`,
      ];
      if (data.cleanupSkippedWithBookings) lines.push(`⚠ ${data.cleanupSkippedWithBookings} ${t('admin.previewCleanupSkipped')}`);
      if (data.errors?.length) lines.push(`✗ ${data.errors.length} errors`);
      alert(lines.join('\n'));
    } catch (err) {
      showToast(err.message, 'error');
    }
  }));

  // Generate sessions
  document.getElementById('generate-btn').addEventListener('click', (ev) => withLoading(ev.currentTarget, async () => {
    try {
      const res = await fetch('/api/cron/generate-sessions', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const summary = `+${data.created} · ⊘${data.autoCancelled} · ↺${data.restored} · 🗑${data.cleanedUp}`;
      showToast(`${t('admin.generated', { n: data.created })} (${summary})`, 'success');
      if (data.errors?.length) showToast(`${data.errors.length} errors — see console`, 'error');
      if (data.errors?.length) console.error('generate-sessions errors:', data.errors);
      renderAdminSchedule();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }));

  // Resync future sessions to their templates
  document.getElementById('resync-btn').addEventListener('click', async (ev) => {
    const ok = await showConfirm({
      title: t('confirm.resyncTitle'),
      message: t('confirm.resyncMessage'),
      confirmText: t('confirm.apply'),
      variant: 'warning',
    });
    if (!ok) return;
    return withLoading(ev.currentTarget, async () => {
    try {
      const data = await api('/api/admin/schedule?action=resync', { method: 'POST', body: '{}' });
      let msg = t('admin.resyncDone', { n: data.updated });
      if (data.withBookings?.length) {
        msg += ` ⚠ ${data.withBookings.length} ${t('admin.resyncWithBookings')}`;
      }
      showToast(msg, data.withBookings?.length ? 'info' : 'success');
      renderAdminSchedule();
    } catch (err) {
      showToast(err.message, 'error');
    }
    });
  });
}
