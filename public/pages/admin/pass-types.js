import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t, getLocale } from '../../lib/i18n.js';
import { withLoading, onSubmitWithLoading } from '../../lib/loading.js';

export async function renderAdminPassTypes() {
  const app = document.getElementById('app');

  let userPassesRaw = [];
  let userPassesError = null;
  const [{ data: passTypes }, requests] = await Promise.all([
    sb.from('pass_types').select('*').order('kind'),
    api('/api/pass-requests').catch(() => []),
  ]);
  try {
    userPassesRaw = await api('/api/admin/passes');
  } catch (err) {
    userPassesError = err.message || 'Error loading passes';
  }
  const userPasses = Array.isArray(userPassesRaw) ? userPassesRaw : [];

  const pendingRequests = (requests || []).filter(r => r.status === 'pending');
  const processedRequests = (requests || []).filter(r => r.status !== 'pending');
  const locale = getLocale();

  const ptLabel = (pt) => !pt ? '-'
    : pt.kind === 'single' ? t('passes.singleClass')
    : pt.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
    : t('passes.unlimited');

  const fmtPrice = (p) => `$${parseFloat(p).toFixed(0)} MXN`;

  // ---- Pass type card (collapsed by default, expand to edit) ----
  const passTypeCard = (pt) => {
    const isUnlimited = pt.kind === 'unlimited';
    const countSummary = isUnlimited
      ? t('admin.unlimitedShort')
      : `${pt.class_count} ${t('admin.classesShort')}`;
    const summaryMeta = `${countSummary} · ${pt.validity_days} ${t('admin.daysShort')} · ${fmtPrice(pt.price)}`;

    return `
      <details class="pt-card ${pt.is_active ? '' : 'pt-card-inactive'}" data-pt-id="${pt.id}">
        <summary>
          <div class="pt-summary-main">
            <div class="pt-summary-title">${ptLabel(pt)}</div>
            <div class="pt-summary-meta">${summaryMeta}</div>
          </div>
          <span class="badge ${pt.is_active ? 'badge-active' : 'badge-expired'}">${pt.is_active ? t('passes.active') : t('admin.inactive')}</span>
        </summary>
        <div class="pt-card-body">
          <div class="pt-card-fields">
            <label>${t('admin.classes')}
              <input type="number" class="pt-edit-count" value="${pt.class_count ?? ''}" placeholder="∞" min="1" ${isUnlimited ? 'disabled' : ''} />
            </label>
            <label>${t('admin.validDays')}
              <input type="number" class="pt-edit-days" value="${pt.validity_days}" min="1" inputmode="numeric" />
            </label>
            <label>${t('admin.price')} (MXN)
              <input type="number" class="pt-edit-price" value="${parseFloat(pt.price).toFixed(2)}" min="0" step="0.01" inputmode="decimal" />
            </label>
          </div>
          <div class="pt-card-actions">
            <button class="btn btn-small btn-primary save-pt">${t('general.save')}</button>
            <button class="btn btn-small btn-secondary toggle-active" data-active="${pt.is_active}">
              ${pt.is_active ? t('admin.deactivate') : t('admin.activate')}
            </button>
          </div>
        </div>
      </details>
    `;
  };

  // ---- Active passes computation ----
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysBetween = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  };
  const isActivePass = (p) => {
    if (!p.expires_at) return false;
    const daysLeft = daysBetween(p.expires_at);
    if (daysLeft < 0) return false;
    if (p.classes_remaining !== null && p.classes_remaining <= 0) return false;
    return true;
  };

  const activePasses = (userPasses || [])
    .filter(isActivePass)
    .sort((a, b) => a.expires_at.localeCompare(b.expires_at));

  const activePassCard = (p) => {
    const daysLeft = daysBetween(p.expires_at);
    const pt = p.pass_types;
    const name = p.profiles?.full_name || '—';

    const classesLabel = p.classes_remaining === null
      ? '∞'
      : p.classes_remaining === 1 ? t('admin.oneClassLeft')
      : t('admin.classesLeftShort', { n: p.classes_remaining });

    const expiresLabel = daysLeft === 0 ? t('admin.expiresToday')
      : daysLeft === 1 ? t('admin.expiresTomorrow')
      : t('admin.expiresInDays', { n: daysLeft });
    const expiresDate = new Date(p.expires_at + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' });

    const expiring = daysLeft <= 7;
    const unpaid = !p.is_paid;
    const classes = [
      'active-pass-card',
      unpaid ? 'unpaid' : (expiring ? 'expiring' : ''),
    ].filter(Boolean).join(' ');

    const filterTags = [
      'all',
      unpaid ? 'unpaid' : '',
      expiring ? 'expiring' : '',
    ].filter(Boolean).join(' ');

    return `
      <a href="#/admin/users/${p.user_id}" class="${classes}" data-filter="${filterTags}">
        <div class="active-pass-main">
          <div class="active-pass-name">
            ${name}
            ${unpaid ? `<span class="badge-unpaid-inline">\u{1F4B5} ${t('admin.cashDue')}</span>` : ''}
          </div>
          <div class="active-pass-type">${ptLabel(pt)} · ${classesLabel}</div>
          <div class="active-pass-meta">
            <span class="${expiring ? 'expiring-text' : ''}">${expiresLabel}</span>
            <span class="sep">·</span>
            <span>${expiresDate}</span>
          </div>
        </div>
      </a>
    `;
  };

  const unpaidCount = activePasses.filter(p => !p.is_paid).length;
  const expiringCount = activePasses.filter(p => daysBetween(p.expires_at) <= 7).length;

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.passTypes')}</h2>

      <div class="pt-card-list">
        ${(passTypes || []).map(passTypeCard).join('')}
      </div>

      <div class="add-pt-wrap">
        <button class="btn btn-secondary add-pt-open" id="add-pt-open">+ ${t('admin.addPassType')}</button>
        <div class="add-pt-card" id="add-pt-card" hidden>
          <div class="add-pt-card-header">
            <span>${t('admin.addPassType')}</span>
            <button type="button" class="add-pt-close-btn" id="add-pt-close" aria-label="Cerrar">✕</button>
          </div>
          <form id="add-pass-form">
            <div class="kind-pills" role="group" aria-label="${t('admin.kind')}">
              <label class="kind-pill">
                <input type="radio" name="add-kind" value="single" checked>
                <span>${t('passes.singleClass')}</span>
              </label>
              <label class="kind-pill">
                <input type="radio" name="add-kind" value="multi">
                <span>${t('passes.multiClass', { n: 'N' })}</span>
              </label>
              <label class="kind-pill">
                <input type="radio" name="add-kind" value="unlimited">
                <span>${t('passes.unlimited')}</span>
              </label>
            </div>
            <div id="add-pt-count-row" class="add-pt-count-row" hidden>
              <label class="add-pt-field-label">${t('admin.classes')}
                <input type="number" id="pt-count" min="1" placeholder="10" inputmode="numeric" />
              </label>
            </div>
            <div class="add-pt-row">
              <label class="add-pt-field-label">${t('admin.validDays')}
                <input type="number" id="pt-days" required min="1" value="1" inputmode="numeric" />
              </label>
              <label class="add-pt-field-label">${t('admin.price')} (MXN)
                <input type="number" id="pt-price" required min="0" step="0.01" inputmode="decimal" placeholder="0" />
              </label>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%">${t('admin.add')}</button>
          </form>
        </div>
      </div>

      <section class="section" style="margin-top: 2rem;">
        <div class="active-passes-head">
          <h3>${t('admin.activePasses')} ${activePasses.length ? `(${activePasses.length})` : ''}</h3>
        </div>
        ${userPassesError
          ? `<p class="error-line">Error loading passes: ${userPassesError}</p>`
          : !activePasses.length
          ? `<p class="muted">${t('admin.activePassesNone')}</p>`
          : `
            <div class="filter-chips" id="active-pass-filters">
              <button class="filter-chip active" data-filter="all">${t('admin.filterAll')} (${activePasses.length})</button>
              ${unpaidCount ? `<button class="filter-chip" data-filter="unpaid">\u{1F4B5} ${t('admin.filterUnpaid')} (${unpaidCount})</button>` : ''}
              ${expiringCount ? `<button class="filter-chip" data-filter="expiring">⚠️ ${t('admin.filterExpiring')} (${expiringCount})</button>` : ''}
            </div>
            <div class="active-pass-list" id="active-pass-list">
              ${activePasses.map(activePassCard).join('')}
            </div>
          `
        }
      </section>

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
                      <div class="muted">${payLabel}${paid ? ' ✅ ' + t('payment.markedPaid') : ''}</div>
                      ${r.notes ? `<div class="muted" style="font-size:0.85rem">${r.notes}</div>` : ''}
                      ${r.payment_method === 'transfer' ? `<div class="warn-line">⚠️ ${t('requests.verifyBankFirst')}</div>` : ''}
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

  // Add pass type form toggle
  document.getElementById('add-pt-open').addEventListener('click', () => {
    document.getElementById('add-pt-card').hidden = false;
    document.getElementById('add-pt-open').hidden = true;
  });
  document.getElementById('add-pt-close').addEventListener('click', () => {
    document.getElementById('add-pt-card').hidden = true;
    document.getElementById('add-pt-open').hidden = false;
  });

  // Kind radio -> update count/days defaults
  app.querySelectorAll('[name="add-kind"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const kind = radio.value;
      const countRow = document.getElementById('add-pt-count-row');
      const countInput = document.getElementById('pt-count');
      const daysInput = document.getElementById('pt-days');
      if (kind === 'single') {
        countRow.hidden = true;
        daysInput.value = 1;
      } else if (kind === 'multi') {
        countRow.hidden = false;
        countInput.value = 10;
        daysInput.value = 90;
      } else {
        countRow.hidden = true;
        daysInput.value = 30;
      }
    });
  });

  // Pass type cards: save / toggle. Stop propagation on clicks so the
  // <details> open state doesn't toggle when interacting with inputs/buttons.
  app.querySelectorAll('.pt-card').forEach(card => {
    const id = parseInt(card.dataset.ptId, 10);
    card.querySelectorAll('.pt-card-body').forEach(body => {
      body.addEventListener('click', (e) => e.stopPropagation());
    });

    card.querySelector('.save-pt').addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      return withLoading(btn, async () => {
        const countEl = card.querySelector('.pt-edit-count');
        const daysEl = card.querySelector('.pt-edit-days');
        const priceEl = card.querySelector('.pt-edit-price');
        const updates = {
          id,
          class_count: countEl.disabled ? null : (countEl.value ? parseInt(countEl.value, 10) : null),
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
    });

    card.querySelector('.toggle-active').addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      return withLoading(btn, async () => {
        const currentlyActive = btn.dataset.active === 'true';
        const { error } = await sb.from('pass_types').update({ is_active: !currentlyActive }).eq('id', id);
        if (error) { showToast(error.message, 'error'); return; }
        renderAdminPassTypes();
      });
    });
  });

  // Active-pass filter chips
  const filtersEl = document.getElementById('active-pass-filters');
  if (filtersEl) {
    filtersEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-chip');
      if (!btn) return;
      const filter = btn.dataset.filter;
      filtersEl.querySelectorAll('.filter-chip').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('#active-pass-list .active-pass-card').forEach(card => {
        const tags = (card.dataset.filter || '').split(' ');
        card.style.display = tags.includes(filter) ? '' : 'none';
      });
    });
  }

  // Add pass type
  onSubmitWithLoading(document.getElementById('add-pass-form'), async () => {
    const kind = app.querySelector('[name="add-kind"]:checked')?.value || 'single';
    const countInput = document.getElementById('pt-count');
    const classCount = kind === 'unlimited' ? null : (countInput.value ? parseInt(countInput.value, 10) : null);
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
    btn.addEventListener('click', () => withLoading(btn, async () => {
      try {
        await api('/api/pass-requests', {
          method: 'PATCH',
          body: JSON.stringify({ id: parseInt(btn.dataset.id, 10), status: 'approved' }),
        });
        showToast(t('requests.requestApproved'), 'success');
        renderAdminPassTypes();
      } catch (err) { showToast(err.message, 'error'); }
    }));
  });

  app.querySelectorAll('.decline-req').forEach(btn => {
    btn.addEventListener('click', () => withLoading(btn, async () => {
      try {
        await api('/api/pass-requests', {
          method: 'PATCH',
          body: JSON.stringify({ id: parseInt(btn.dataset.id, 10), status: 'declined' }),
        });
        showToast(t('requests.requestDeclined'), 'success');
        renderAdminPassTypes();
      } catch (err) { showToast(err.message, 'error'); }
    }));
  });
}
