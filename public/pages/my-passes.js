import { sb, getSession } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { renderPassCard } from '../components/pass-card.js';
import { showToast } from '../components/toast.js';
import { t, getLocale } from '../lib/i18n.js';

export async function renderMyPasses() {
  const app = document.getElementById('app');
  const session = await getSession();
  const userId = session.user.id;

  // Fetch user passes, available pass types, and pending requests in parallel
  const [passesRes, typesRes, requestsRes] = await Promise.all([
    sb.from('user_passes').select('*, pass_types(*)').eq('user_id', userId).order('created_at', { ascending: false }),
    sb.from('pass_types').select('*').eq('is_active', true).order('kind'),
    sb.from('pass_requests').select('*, pass_types(*)').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);

  const passes = passesRes.data || [];
  const passTypes = typesRes.data || [];
  const requests = requestsRes.data || [];
  const today = new Date().toISOString().split('T')[0];

  // Set of pass_type_ids that have a pending request
  const pendingTypeIds = new Set(
    requests.filter(r => r.status === 'pending').map(r => r.pass_type_id)
  );

  // Check if user already has an active unpaid single pass
  const hasUnpaidSingle = passes.some(p =>
    p.pass_types?.kind === 'single' &&
    !p.is_paid &&
    new Date(p.expires_at) >= new Date(today) &&
    p.classes_remaining > 0
  );

  // Render available pass types
  const availableHtml = passTypes.map(pt => {
    const priceStr = `$${Number(pt.price).toFixed(0)}`;
    const kindLabel = pt.kind === 'single' ? t('passes.singleClass')
      : pt.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
      : t('passes.unlimited');
    const validityStr = t('passes.validFor', { days: pt.validity_days });
    const isPending = pendingTypeIds.has(pt.id);

    if (pt.kind === 'single') {
      // Single class: two options - pay digitally OR pay cash at class
      return `
        <div class="pass-type-card">
          <div class="pass-type-info">
            <div class="pass-kind">${kindLabel}</div>
            <div class="pass-type-detail">${priceStr} · ${validityStr}</div>
          </div>
          <div class="pass-type-actions">
            ${isPending
              ? `<button class="btn btn-secondary btn-sm disabled" disabled>${t('requests.pending')}</button>`
              : `<button class="btn btn-primary btn-sm btn-request-pass" data-type-id="${pt.id}" data-method="transfer">${t('passes.payDigital')}</button>`
            }
            ${hasUnpaidSingle
              ? `<button class="btn btn-secondary btn-sm disabled" disabled>${t('passes.alreadySelected')}</button>`
              : `<button class="btn btn-secondary btn-sm btn-cash-single" data-type-id="${pt.id}">${t('passes.payCash')}</button>`
            }
          </div>
        </div>
      `;
    }

    // Multi/unlimited: request with digital payment
    return `
      <div class="pass-type-card">
        <div class="pass-type-info">
          <div class="pass-kind">${kindLabel}</div>
          <div class="pass-type-detail">${priceStr} · ${validityStr}</div>
        </div>
        <div class="pass-type-actions">
          ${isPending
            ? `<button class="btn btn-secondary btn-sm disabled" disabled>${t('requests.pending')}</button>`
            : `<div class="pass-type-request-group">
                <select class="payment-select" data-type-id="${pt.id}">
                  <option value="transfer">${t('passes.methodTransfer')}</option>
                  <option value="other">${t('passes.methodOther')}</option>
                </select>
                <button class="btn btn-primary btn-sm btn-request-pass" data-type-id="${pt.id}">${t('requests.request')}</button>
              </div>`
          }
        </div>
      </div>
    `;
  }).join('');

  // Render pending/rejected requests
  const activeRequests = requests.filter(r => r.status === 'pending' || r.status === 'rejected');
  const requestsHtml = activeRequests.length ? activeRequests.map(r => {
    const pt = r.pass_types;
    const kindLabel = pt.kind === 'single' ? t('passes.singleClass')
      : pt.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
      : t('passes.unlimited');
    const dateStr = new Date(r.created_at).toLocaleDateString(getLocale(), {
      day: 'numeric', month: 'short',
    });
    const statusClass = r.status === 'pending' ? 'request-pending' : 'request-rejected';
    const statusLabel = r.status === 'pending' ? t('requests.pending') : t('requests.rejected');
    const methodLabel = r.payment_method === 'transfer' ? t('passes.methodTransfer')
      : r.payment_method === 'cash' ? t('admin.cash')
      : t('passes.methodOther');

    return `
      <div class="request-card ${statusClass}">
        <div class="request-info">
          <span class="pass-kind">${kindLabel}</span>
          <span class="request-date">${dateStr} · ${methodLabel}</span>
        </div>
        <span class="pass-badge">${statusLabel}</span>
      </div>
    `;
  }).join('') : '';

  app.innerHTML = `
    <div class="page">
      <h2>${t('passes.title')}</h2>

      ${passes.length
        ? `<div class="section-label">${t('passes.yourPasses')}</div>
           ${passes.map(p => renderPassCard(p, p.pass_types)).join('')}`
        : `<p class="muted">${t('passes.noPasses')}</p>`
      }

      ${passTypes.length ? `
        <div class="section-label" style="margin-top:1.5rem">${t('passes.availableTypes')}</div>
        <p class="muted pass-instructions">${t('passes.howItWorks')}</p>
        <div class="pass-types-list">${availableHtml}</div>
      ` : ''}

      ${requestsHtml ? `
        <div class="section-label" style="margin-top:1.5rem">${t('requests.yourRequests')}</div>
        <p class="muted">${t('requests.pendingNote')}</p>
        ${requestsHtml}
      ` : ''}
    </div>
  `;

  // Handle digital payment request (all pass types)
  app.querySelectorAll('.btn-request-pass:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const passTypeId = parseInt(btn.dataset.typeId, 10);
      // For single passes, method is always 'transfer'. For others, read from dropdown.
      let paymentMethod = btn.dataset.method;
      if (!paymentMethod) {
        const select = app.querySelector(`.payment-select[data-type-id="${passTypeId}"]`);
        paymentMethod = select ? select.value : 'transfer';
      }

      btn.disabled = true;
      btn.textContent = '...';

      try {
        await api('/api/me/request-pass', {
          method: 'POST',
          body: JSON.stringify({ pass_type_id: passTypeId, payment_method: paymentMethod }),
        });
        showToast(t('requests.requestSent'), 'success');
        renderMyPasses();
      } catch (err) {
        const msg = err.message.includes('already_pending')
          ? t('requests.alreadyPending')
          : err.message;
        showToast(msg, 'error');
        renderMyPasses();
      }
    });
  });

  // Handle single-class cash-at-class flow (instant, no admin approval needed)
  app.querySelectorAll('.btn-cash-single:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const passTypeId = parseInt(btn.dataset.typeId, 10);
      btn.disabled = true;
      btn.textContent = '...';

      try {
        await api('/api/me/select-pass', {
          method: 'POST',
          body: JSON.stringify({ pass_type_id: passTypeId }),
        });
        showToast(t('passes.cashSingleSelected'), 'success');
        renderMyPasses();
      } catch (err) {
        const msg = err.message.includes('already_has_single_pass')
          ? t('passes.alreadyHasSingle')
          : err.message;
        showToast(msg, 'error');
        renderMyPasses();
      }
    });
  });
}
