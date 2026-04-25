import { sb, getSession } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { renderPassCard } from '../components/pass-card.js';
import { showToast } from '../components/toast.js';
import { t, getLocale } from '../lib/i18n.js';
import { todayStr } from '../lib/dates.js';
import { withLoading, onSubmitWithLoading } from '../lib/loading.js';

export async function renderMyPasses() {
  const app = document.getElementById('app');
  const session = await getSession();
  const userId = session.user.id;
  const today = todayStr();

  // Fetch user passes, available pass types, and bank settings in parallel
  const [passesRes, typesRes, settingsRes] = await Promise.all([
    sb.from('user_passes').select('*, pass_types(*)').eq('user_id', userId).order('created_at', { ascending: false }),
    sb.from('pass_types').select('*').eq('is_active', true).order('kind'),
    sb.from('settings').select('*').in('key', ['bank_name', 'bank_account_holder', 'bank_account_number', 'bank_clabe', 'bank_card_number', 'payment_instructions']),
  ]);

  const passes = passesRes.data || [];
  const passTypes = typesRes.data || [];
  const bank = {};
  (settingsRes.data || []).forEach(s => { bank[s.key] = s.value; });
  const hasBank = bank.bank_clabe || bank.bank_account_number || bank.bank_card_number;

  // Fetch user's pass requests
  let requests = [];
  try {
    requests = await api('/api/pass-requests?mine=true');
  } catch (e) {
    // pass_requests table may not exist yet
  }

  const pendingTypeIds = new Set(
    (requests || []).filter(r => r.status === 'pending').map(r => r.pass_type_id)
  );

  const locale = getLocale();

  // Render available pass types section
  const availableHtml = passTypes.map(pt => {
    const priceStr = `$${Number(pt.price).toFixed(0)} MXN`;
    const kindLabel = pt.kind === 'single' ? t('passes.singleClass')
      : pt.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
      : t('passes.unlimited');
    const validityStr = t('passes.validFor', { days: pt.validity_days });

    if (pt.kind === 'single') {
      return `
        <div class="pass-type-card">
          <div class="pass-type-info">
            <div class="pass-kind">${kindLabel}</div>
            <div class="pass-type-detail">${priceStr} · ${validityStr}</div>
            <div class="pass-type-note">${t('passes.singleNote')}</div>
          </div>
          <button class="btn btn-primary btn-select-single" data-type-id="${pt.id}">
            ${t('passes.selectSingle')}
          </button>
        </div>
      `;
    }

    // Multi/unlimited: show request button
    const hasPending = pendingTypeIds.has(pt.id);
    return `
      <div class="pass-type-card">
        <div class="pass-type-info">
          <div class="pass-kind">${kindLabel}</div>
          <div class="pass-type-detail">${priceStr} · ${validityStr}</div>
        </div>
        ${hasPending
          ? `<span class="btn btn-small btn-disabled">${t('requests.pending')}</span>`
          : `<button class="btn btn-small btn-primary request-pass-btn" data-id="${pt.id}">${t('requests.request')}</button>`
        }
      </div>
    `;
  }).join('');

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
        <div class="pass-types-list">${availableHtml}</div>
      ` : ''}

      <div id="request-modal" class="modal hidden">
        <div class="modal-content">
          <h3>${t('requests.request')}</h3>
          <form id="request-form" class="form">
            <input type="hidden" id="req-pass-type-id" />
            <label>${t('requests.paymentMethod')}
              <select id="req-payment">
                <option value="transfer">${t('admin.transfer')}</option>
                <option value="cash">${t('admin.cash')}</option>
                <option value="other">${t('admin.other')}</option>
              </select>
            </label>

            <div id="cash-notice" class="cash-notice hidden">
              <strong>\u{1F4B5} ${t('payment.cashTitle')}</strong>
              <p>${t('payment.cashInstruction')}</p>
            </div>

            ${hasBank ? `
              <div id="bank-details" class="bank-details">
                <h4>${t('payment.title')}</h4>
                ${bank.bank_account_holder ? `<div class="bank-row"><span>${t('payment.accountHolder')}:</span><strong>${bank.bank_account_holder}</strong></div>` : ''}
                ${bank.bank_name ? `<div class="bank-row"><span>${t('payment.bankName')}:</span><strong>${bank.bank_name}</strong></div>` : ''}
                ${bank.bank_account_number ? `<div class="bank-row"><span>${t('payment.accountNumber')}:</span><strong class="copyable" data-copy="${bank.bank_account_number}">${bank.bank_account_number}</strong></div>` : ''}
                ${bank.bank_clabe ? `<div class="bank-row"><span>CLABE:</span><strong class="copyable" data-copy="${bank.bank_clabe}">${bank.bank_clabe}</strong></div>` : ''}
                ${bank.bank_card_number ? `<div class="bank-row"><span>${t('payment.cardNumber')}:</span><strong class="copyable" data-copy="${bank.bank_card_number.replace(/\s+/g, '')}">${bank.bank_card_number}</strong></div>` : ''}
                ${bank.payment_instructions ? `<p class="muted" style="margin-top:0.5rem">${bank.payment_instructions}</p>` : ''}
              </div>
            ` : ''}

            <label>${t('requests.notes')}
              <textarea id="req-notes" rows="2" placeholder="${t('requests.notesPlaceholder')}"></textarea>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="req-paid" /> ${t('payment.iHavePaid')}
            </label>
            <p class="muted" style="font-size:0.8rem">${t('payment.paymentNote')}</p>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">${t('requests.submit')}</button>
              <button type="button" class="btn btn-secondary" id="cancel-request">${t('requests.cancel')}</button>
            </div>
          </form>
        </div>
      </div>

      ${requests?.length ? `
        <section class="section" style="margin-top: 2rem;">
          <h3>${t('requests.myRequests')}</h3>
          <table class="table">
            <thead><tr><th>${t('requests.passType')}</th><th>${t('requests.date')}</th><th>${t('requests.status')}</th></tr></thead>
            <tbody>
              ${requests.map(r => {
                const pt = r.pass_types;
                const kindLabel = pt?.kind === 'single' ? t('passes.singleClass')
                  : pt?.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
                  : t('passes.unlimited');
                const dateStr = new Date(r.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                const statusLabel = r.status === 'pending' ? t('requests.pending')
                  : r.status === 'approved' ? t('requests.approved')
                  : t('requests.declined');
                const statusClass = r.status === 'approved' ? 'badge-active' : r.status === 'declined' ? 'badge-expired' : 'badge-pending';
                return `<tr><td>${kindLabel}</td><td>${dateStr}</td><td><span class="badge ${statusClass}">${statusLabel}</span></td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </section>
      ` : ''}
    </div>
  `;

  // Handle single pass selection
  app.querySelectorAll('.btn-select-single:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => withLoading(btn, async () => {
      const passTypeId = parseInt(btn.dataset.typeId, 10);
      try {
        await api('/api/me/select-pass', {
          method: 'POST',
          body: JSON.stringify({ pass_type_id: passTypeId }),
        });
        showToast(t('passes.singleSelected'), 'success');
        renderMyPasses();
      } catch (err) {
        const msg = err.message.includes('already_has_single_pass')
          ? t('passes.alreadyHasSingle')
          : err.message;
        showToast(msg, 'error');
        renderMyPasses();
      }
    }));
  });

  // Request button handlers (for multi/unlimited passes)
  app.querySelectorAll('.request-pass-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('req-pass-type-id').value = btn.dataset.id;
      document.getElementById('request-modal').classList.remove('hidden');
    });
  });

  // Show cash/bank details based on payment method
  const togglePaymentDetails = () => {
    const method = document.getElementById('req-payment').value;
    const cashEl = document.getElementById('cash-notice');
    const bankEl = document.getElementById('bank-details');
    const paidEl = document.getElementById('req-paid')?.closest('label');
    if (method === 'cash') {
      cashEl?.classList.remove('hidden');
      bankEl?.classList.add('hidden');
      if (paidEl) paidEl.style.display = 'none';
    } else if (method === 'transfer') {
      cashEl?.classList.add('hidden');
      bankEl?.classList.remove('hidden');
      if (paidEl) paidEl.style.display = '';
    } else {
      cashEl?.classList.add('hidden');
      bankEl?.classList.add('hidden');
      if (paidEl) paidEl.style.display = '';
    }
  };
  document.getElementById('req-payment')?.addEventListener('change', togglePaymentDetails);
  // Pre-open handler: when a request button is clicked, show the right panel on open
  app.querySelectorAll('.request-pass-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Reset select to transfer each open so the visible state is predictable
      const sel = document.getElementById('req-payment');
      if (sel) sel.value = 'transfer';
      togglePaymentDetails();
    });
  });

  document.getElementById('cancel-request')?.addEventListener('click', () => {
    document.getElementById('request-modal').classList.add('hidden');
  });

  onSubmitWithLoading(document.getElementById('request-form'), async () => {
    const passTypeId = parseInt(document.getElementById('req-pass-type-id').value, 10);
    const paymentMethod = document.getElementById('req-payment').value;
    const notes = document.getElementById('req-notes').value.trim();
    const paid = document.getElementById('req-paid').checked;
    const paidMarker = paid ? '[PAID] ' : '';

    try {
      await api('/api/pass-requests', {
        method: 'POST',
        body: JSON.stringify({
          pass_type_id: passTypeId,
          payment_method: paymentMethod,
          notes: (paidMarker + (notes || '')).trim() || null,
        }),
      });
      showToast(t('requests.sent'), 'success');
      document.getElementById('request-modal').classList.add('hidden');
      renderMyPasses();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Copy-to-clipboard on bank detail values
  app.querySelectorAll('.copyable').forEach(el => {
    el.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(el.dataset.copy);
        showToast(t('payment.copied'), 'success');
      } catch {}
    });
  });
}
