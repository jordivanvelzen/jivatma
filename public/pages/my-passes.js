import { sb, getSession } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { renderPassCard } from '../components/pass-card.js';
import { showToast } from '../components/toast.js';
import { t, getLocale } from '../lib/i18n.js';

export async function renderMyPasses() {
  const app = document.getElementById('app');
  const session = await getSession();

  const { data: passes } = await sb
    .from('user_passes')
    .select('*, pass_types(*)')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  const { data: passTypes } = await sb
    .from('pass_types')
    .select('*')
    .eq('is_active', true)
    .order('kind');

  // Fetch user's pass requests
  let requests = [];
  try {
    requests = await api('/api/pass-requests');
  } catch (e) {
    // pass_requests table may not exist yet
  }

  const pendingTypeIds = new Set(
    (requests || []).filter(r => r.status === 'pending').map(r => r.pass_type_id)
  );

  const locale = getLocale();

  app.innerHTML = `
    <div class="page">
      <h2>${t('passes.title')}</h2>
      ${!passes?.length
        ? `<p class="muted">${t('passes.noPasses')}</p>`
        : passes.map(p => renderPassCard(p, p.pass_types)).join('')
      }

      <section class="section" style="margin-top: 2rem;">
        <h3>${t('requests.availablePasses')}</h3>
        <div class="pass-types-grid">
          ${(passTypes || []).map(pt => {
            const kindLabel = pt.kind === 'single' ? t('passes.singleClass')
              : pt.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
              : t('passes.unlimited');
            const hasPending = pendingTypeIds.has(pt.id);
            return `
              <div class="pass-type-card">
                <div class="pass-kind">${kindLabel}</div>
                <div class="pass-price">$${parseFloat(pt.price).toFixed(2)} MXN</div>
                <div class="pass-detail">${pt.validity_days} ${t('admin.validDays').toLowerCase()}</div>
                ${hasPending
                  ? `<span class="btn btn-small btn-disabled">${t('requests.pending')}</span>`
                  : `<button class="btn btn-small btn-primary request-pass-btn" data-id="${pt.id}">${t('requests.request')}</button>`
                }
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <div id="request-modal" class="modal hidden">
        <div class="modal-content">
          <h3>${t('requests.request')}</h3>
          <form id="request-form" class="form">
            <input type="hidden" id="req-pass-type-id" />
            <label>${t('requests.paymentMethod')}
              <select id="req-payment">
                <option value="cash">${t('admin.cash')}</option>
                <option value="transfer">${t('admin.transfer')}</option>
                <option value="other">${t('admin.other')}</option>
              </select>
            </label>
            <label>${t('requests.notes')}
              <textarea id="req-notes" rows="2" placeholder="${t('requests.notesPlaceholder')}"></textarea>
            </label>
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

  // Request button handlers
  app.querySelectorAll('.request-pass-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('req-pass-type-id').value = btn.dataset.id;
      document.getElementById('request-modal').classList.remove('hidden');
    });
  });

  document.getElementById('cancel-request')?.addEventListener('click', () => {
    document.getElementById('request-modal').classList.add('hidden');
  });

  document.getElementById('request-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passTypeId = parseInt(document.getElementById('req-pass-type-id').value, 10);
    const paymentMethod = document.getElementById('req-payment').value;
    const notes = document.getElementById('req-notes').value.trim();

    try {
      await api('/api/pass-requests', {
        method: 'POST',
        body: JSON.stringify({
          pass_type_id: passTypeId,
          payment_method: paymentMethod,
          notes: notes || null,
        }),
      });
      showToast(t('requests.sent'), 'success');
      document.getElementById('request-modal').classList.add('hidden');
      renderMyPasses();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
