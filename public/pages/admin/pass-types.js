import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t, getLocale } from '../../lib/i18n.js';

export async function renderAdminPassTypes() {
  const app = document.getElementById('app');

  const { data: passTypes } = await sb
    .from('pass_types')
    .select('*')
    .order('kind');

  // Fetch pass requests
  let requests = [];
  try {
    requests = await api('/api/pass-requests');
  } catch (e) {
    // pass_requests table may not exist yet
  }

  const pendingRequests = (requests || []).filter(r => r.status === 'pending');
  const processedRequests = (requests || []).filter(r => r.status !== 'pending');
  const locale = getLocale();

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.passTypes')}</h2>

      <table class="table">
        <thead><tr><th>${t('admin.kind')}</th><th>${t('admin.classes')}</th><th>${t('admin.validDays')}</th><th>${t('admin.price')}</th><th>${t('admin.activeCol')}</th><th></th></tr></thead>
        <tbody>
          ${(passTypes || []).map(pt => `
            <tr data-pt-id="${pt.id}">
              <td>${pt.kind === 'single' ? t('passes.singleClass') : pt.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count }) : t('passes.unlimited')}</td>
              <td><input type="number" class="pt-edit-count" data-id="${pt.id}" value="${pt.class_count ?? ''}" placeholder="\u221E" min="1" style="width:4rem" /></td>
              <td><input type="number" class="pt-edit-days" data-id="${pt.id}" value="${pt.validity_days}" min="1" style="width:5rem" /></td>
              <td><input type="number" class="pt-edit-price" data-id="${pt.id}" value="${parseFloat(pt.price).toFixed(2)}" min="0" step="0.01" style="width:6rem" /> MXN</td>
              <td>${pt.is_active ? '\u2713' : '\u2717'}</td>
              <td>
                <button class="btn btn-small save-pt" data-id="${pt.id}">${t('general.save')}</button>
                <button class="btn btn-small toggle-active" data-id="${pt.id}" data-active="${pt.is_active}">
                  ${pt.is_active ? t('admin.deactivate') : t('admin.activate')}
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h3>${t('admin.addPassType')}</h3>
      <form id="add-pass-form" class="form">
        <div class="form-row">
          <label>${t('admin.kind')}
            <select id="pt-kind" required>
              <option value="single">${t('passes.singleClass')}</option>
              <option value="multi">${t('passes.multiClass', { n: '' })}</option>
              <option value="unlimited">${t('passes.unlimited')}</option>
            </select>
          </label>
          <label>${t('admin.classes')}
            <input type="number" id="pt-count" placeholder="e.g. 10" min="1" />
          </label>
        </div>
        <div class="form-row">
          <label>${t('admin.validDays')}
            <input type="number" id="pt-days" required min="1" value="30" />
          </label>
          <label>${t('admin.price')} (MXN)
            <input type="number" id="pt-price" required min="0" step="0.01" />
          </label>
        </div>
        <button type="submit" class="btn btn-primary">${t('admin.add')}</button>
      </form>

      <section class="section" style="margin-top: 2rem;">
        <h3>${t('requests.title')} ${pendingRequests.length ? `(${pendingRequests.length})` : ''}</h3>
        ${!pendingRequests.length
          ? `<p class="muted">${t('requests.noRequestsAdmin')}</p>`
          : `<table class="table">
              <thead><tr><th>${t('requests.student')}</th><th>${t('requests.passType')}</th><th>${t('requests.paymentMethod')}</th><th>${t('requests.date')}</th><th></th></tr></thead>
              <tbody>
                ${pendingRequests.map(r => {
                  const pt = r.pass_types;
                  const kindLabel = pt?.kind === 'single' ? t('passes.singleClass')
                    : pt?.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
                    : t('passes.unlimited');
                  const dateStr = new Date(r.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                  const name = r.profiles?.full_name || 'Unknown';
                  const payLabel = r.payment_method === 'cash' ? t('admin.cash')
                    : r.payment_method === 'transfer' ? t('admin.transfer')
                    : r.payment_method ? t('admin.other') : '-';
                  return `
                    <tr>
                      <td>${name}${r.notes ? `<br><small class="muted">${r.notes}</small>` : ''}</td>
                      <td>${kindLabel}</td>
                      <td>${payLabel}</td>
                      <td>${dateStr}</td>
                      <td>
                        <button class="btn btn-small btn-primary approve-req" data-id="${r.id}">${t('requests.approve')}</button>
                        <button class="btn btn-small btn-secondary decline-req" data-id="${r.id}">${t('requests.decline')}</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>`
        }

        ${processedRequests.length ? `
          <details style="margin-top: 1rem;">
            <summary class="muted" style="cursor:pointer;">${t('requests.history')} (${processedRequests.length})</summary>
            <table class="table" style="margin-top: 0.5rem;">
              <thead><tr><th>${t('requests.student')}</th><th>${t('requests.passType')}</th><th>${t('requests.status')}</th><th>${t('requests.date')}</th></tr></thead>
              <tbody>
                ${processedRequests.map(r => {
                  const pt = r.pass_types;
                  const kindLabel = pt?.kind === 'single' ? t('passes.singleClass')
                    : pt?.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
                    : t('passes.unlimited');
                  const dateStr = new Date(r.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                  const name = r.profiles?.full_name || 'Unknown';
                  const statusLabel = r.status === 'approved' ? t('requests.approved') : t('requests.declined');
                  const statusClass = r.status === 'approved' ? 'badge-active' : 'badge-expired';
                  return `<tr><td>${name}</td><td>${kindLabel}</td><td><span class="badge ${statusClass}">${statusLabel}</span></td><td>${dateStr}</td></tr>`;
                }).join('')}
              </tbody>
            </table>
          </details>
        ` : ''}
      </section>
    </div>
  `;

  // Kind change -> auto-fill defaults
  document.getElementById('pt-kind').addEventListener('change', (e) => {
    const kind = e.target.value;
    const countInput = document.getElementById('pt-count');
    const daysInput = document.getElementById('pt-days');

    if (kind === 'single') { countInput.value = 1; daysInput.value = 1; }
    else if (kind === 'multi') { countInput.value = 10; daysInput.value = 90; }
    else { countInput.value = ''; daysInput.value = 30; }
  });

  // Toggle active
  app.querySelectorAll('.toggle-active').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      const currentlyActive = btn.dataset.active === 'true';
      const { error } = await sb.from('pass_types').update({ is_active: !currentlyActive }).eq('id', id);
      if (error) { showToast(error.message, 'error'); return; }
      renderAdminPassTypes();
    });
  });

  // Save edits on a pass type row
  app.querySelectorAll('.save-pt').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      const countEl = app.querySelector(`.pt-edit-count[data-id="${id}"]`);
      const daysEl = app.querySelector(`.pt-edit-days[data-id="${id}"]`);
      const priceEl = app.querySelector(`.pt-edit-price[data-id="${id}"]`);
      const updates = {
        class_count: countEl.value ? parseInt(countEl.value, 10) : null,
        validity_days: parseInt(daysEl.value, 10),
        price: parseFloat(priceEl.value),
      };
      try {
        await api('/api/admin/passes?type=types', {
          method: 'PATCH',
          body: JSON.stringify({ id, ...updates }),
        });
        showToast(t('admin.passTypeUpdated'), 'success');
        renderAdminPassTypes();
      } catch (err) { showToast(err.message, 'error'); }
    });
  });

  // Add pass type
  document.getElementById('add-pass-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const kind = document.getElementById('pt-kind').value;
    const classCount = document.getElementById('pt-count').value ? parseInt(document.getElementById('pt-count').value, 10) : null;
    const validityDays = parseInt(document.getElementById('pt-days').value, 10);
    const price = parseFloat(document.getElementById('pt-price').value);

    const { error } = await sb.from('pass_types').insert({
      kind, class_count: classCount, validity_days: validityDays, price,
    });

    if (error) { showToast(error.message, 'error'); return; }
    showToast(t('admin.passTypeAdded'), 'success');
    renderAdminPassTypes();
  });

  // Approve/decline request handlers
  app.querySelectorAll('.approve-req').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api('/api/pass-requests', {
          method: 'PATCH',
          body: JSON.stringify({ id: parseInt(btn.dataset.id, 10), status: 'approved' }),
        });
        showToast(t('requests.requestApproved'), 'success');
        renderAdminPassTypes();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  app.querySelectorAll('.decline-req').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api('/api/pass-requests', {
          method: 'PATCH',
          body: JSON.stringify({ id: parseInt(btn.dataset.id, 10), status: 'declined' }),
        });
        showToast(t('requests.requestDeclined'), 'success');
        renderAdminPassTypes();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}
