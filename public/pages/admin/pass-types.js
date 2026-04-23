import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t, getLocale } from '../../lib/i18n.js';

export async function renderAdminPassTypes() {
  const app = document.getElementById('app');

  const { data: passTypes } = await sb.from('pass_types').select('*').order('kind');

  let requests = [];
  try { requests = await api('/api/pass-requests'); } catch {}

  const pendingRequests = (requests || []).filter(r => r.status === 'pending');
  const processedRequests = (requests || []).filter(r => r.status !== 'pending');
  const locale = getLocale();

  const ptLabel = (pt) => pt.kind === 'single' ? t('passes.singleClass')
    : pt.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
    : t('passes.unlimited');

  const passTypeCard = (pt) => `
    <div class="pt-card ${pt.is_active ? '' : 'pt-card-inactive'}" data-pt-id="${pt.id}">
      <div class="pt-card-head">
        <div class="pt-card-title">${ptLabel(pt)}</div>
        <span class="badge ${pt.is_active ? 'badge-active' : 'badge-expired'}">${pt.is_active ? t('passes.active') : t('admin.inactive')}</span>
      </div>
      <div class="pt-card-fields">
        <label>${t('admin.classes')}
          <input type="number" class="pt-edit-count" value="${pt.class_count ?? ''}" placeholder="\u221E" min="1" />
        </label>
        <label>${t('admin.validDays')}
          <input type="number" class="pt-edit-days" value="${pt.validity_days}" min="1" />
        </label>
        <label>${t('admin.price')} (MXN)
          <input type="number" class="pt-edit-price" value="${parseFloat(pt.price).toFixed(2)}" min="0" step="0.01" />
        </label>
      </div>
      <div class="pt-card-actions">
        <button class="btn btn-small btn-primary save-pt">${t('general.save')}</button>
        <button class="btn btn-small btn-secondary toggle-active" data-active="${pt.is_active}">
          ${pt.is_active ? t('admin.deactivate') : t('admin.activate')}
        </button>
      </div>
    </div>
  `;

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.passTypes')}</h2>

      <div class="pt-card-list">
        ${(passTypes || []).map(passTypeCard).join('')}
      </div>

      <details class="section-collapsible" style="margin-top:1.5rem">
        <summary><strong>${t('admin.addPassType')}</strong></summary>
        <form id="add-pass-form" class="form" style="margin-top:0.75rem">
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
      </details>

      <section class="section" style="margin-top: 2rem;">
        <h3>${t('requests.title')} ${pendingRequests.length ? `(${pendingRequests.length})` : ''}</h3>
        ${!pendingRequests.length
          ? `<p class="muted">${t('requests.noRequestsAdmin')}</p>`
          : `<div class="request-list">
              ${pendingRequests.map(r => {
                const pt = r.pass_types;
                const dateStr = new Date(r.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                const name = r.profiles?.full_name || 'Unknown';
                const paid = (r.notes || '').startsWith('[PAID]');
                const payLabel = r.payment_method === 'cash' ? t('admin.cash')
                  : r.payment_method === 'transfer' ? t('admin.transfer')
                  : r.payment_method ? t('admin.other') : '-';
                const priceStr = pt?.price ? `$${parseFloat(pt.price).toFixed(0)} MXN` : '';
                return `
                  <div class="request-card">
                    <div class="request-head">
                      <a href="#/admin/users/${r.user_id}" class="request-name">${name}</a>
                      <span class="muted">${dateStr}</span>
                    </div>
                    <div class="request-body">
                      <div>${ptLabel(pt)}${priceStr ? ' · ' + priceStr : ''}</div>
                      <div class="muted">${payLabel}${paid ? ' \u2705 ' + t('payment.markedPaid') : ''}</div>
                      ${r.notes ? `<div class="muted" style="font-size:0.85rem">${r.notes}</div>` : ''}
                      ${r.payment_method === 'transfer' ? `<div class="warn-line">\u26a0\ufe0f ${t('requests.verifyBankFirst')}</div>` : ''}
                      ${r.payment_method === 'cash' ? `<div class="info-line">\u{1F4B5} ${t('requests.cashReminderAdmin')}</div>` : ''}
                    </div>
                    <div class="request-actions">
                      <button class="btn btn-small btn-primary approve-req" data-id="${r.id}">${t('requests.approve')}</button>
                      <button class="btn btn-small btn-secondary decline-req" data-id="${r.id}">${t('requests.decline')}</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>`
        }

        ${processedRequests.length ? `
          <details style="margin-top: 1rem;">
            <summary class="muted" style="cursor:pointer;">${t('requests.history')} (${processedRequests.length})</summary>
            <div class="request-list" style="margin-top: 0.5rem;">
              ${processedRequests.map(r => {
                const pt = r.pass_types;
                const dateStr = new Date(r.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                const name = r.profiles?.full_name || 'Unknown';
                const statusLabel = r.status === 'approved' ? t('requests.approved') : t('requests.declined');
                const statusClass = r.status === 'approved' ? 'badge-active' : 'badge-expired';
                return `
                  <div class="request-card request-card-done">
                    <div class="request-head">
                      <a href="#/admin/users/${r.user_id}" class="request-name">${name}</a>
                      <span class="badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="request-body">
                      <div>${ptLabel(pt)}</div>
                      <div class="muted">${dateStr}</div>
                    </div>
                    <div class="request-actions">
                      <a href="#/admin/users/${r.user_id}" class="btn btn-small btn-secondary">${t('admin.viewPass')}</a>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
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

  // Pass type cards: save / toggle
  app.querySelectorAll('.pt-card').forEach(card => {
    const id = parseInt(card.dataset.ptId, 10);

    card.querySelector('.save-pt').addEventListener('click', async () => {
      const countEl = card.querySelector('.pt-edit-count');
      const daysEl = card.querySelector('.pt-edit-days');
      const priceEl = card.querySelector('.pt-edit-price');
      const updates = {
        id,
        class_count: countEl.value ? parseInt(countEl.value, 10) : null,
        validity_days: parseInt(daysEl.value, 10),
        price: parseFloat(priceEl.value),
      };
      try {
        await api('/api/admin/passes?type=types', {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        showToast(t('admin.passTypeUpdated'), 'success');
        renderAdminPassTypes();
      } catch (err) { showToast(err.message, 'error'); }
    });

    card.querySelector('.toggle-active').addEventListener('click', async () => {
      const currentlyActive = card.querySelector('.toggle-active').dataset.active === 'true';
      const { error } = await sb.from('pass_types').update({ is_active: !currentlyActive }).eq('id', id);
      if (error) { showToast(error.message, 'error'); return; }
      renderAdminPassTypes();
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

  // Approve/decline
  app.querySelectorAll('.approve-req').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api('/api/pass-requests', {
          method: 'PATCH',
          body: JSON.stringify({ id: parseInt(btn.dataset.id, 10), status: 'approved' }),
        });
        showToast(t('requests.requestApproved'), 'success');
        renderAdminPassTypes();
      } catch (err) { showToast(err.message, 'error'); }
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
      } catch (err) { showToast(err.message, 'error'); }
    });
  });
}
