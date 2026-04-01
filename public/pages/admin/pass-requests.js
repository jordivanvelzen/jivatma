import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t, getLocale } from '../../lib/i18n.js';

export async function renderAdminPassRequests() {
  const app = document.getElementById('app');
  const locale = getLocale();

  const { data: requests } = await sb
    .from('pass_requests')
    .select('*, profiles(full_name), pass_types(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const pendingList = (requests || []).map(r => {
    const pt = r.pass_types;
    const kindLabel = pt.kind === 'single' ? t('passes.singleClass')
      : pt.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
      : t('passes.unlimited');
    const priceStr = `$${Number(pt.price).toFixed(0)}`;
    const name = r.profiles?.full_name || '—';
    const dateStr = new Date(r.created_at).toLocaleDateString(locale, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    const methodLabel = r.payment_method === 'transfer' ? t('passes.methodTransfer')
      : r.payment_method === 'cash' ? t('admin.cash')
      : t('passes.methodOther');

    return `
      <div class="request-admin-card" data-id="${r.id}">
        <div class="request-admin-info">
          <div class="request-admin-name">${name}</div>
          <div class="request-admin-detail">${kindLabel} · ${priceStr} · ${methodLabel}</div>
          <div class="request-admin-date">${dateStr}</div>
        </div>
        <div class="request-admin-actions">
          <button class="btn btn-primary btn-sm btn-approve" data-id="${r.id}">${t('requests.approve')}</button>
          <button class="btn btn-secondary btn-sm btn-reject" data-id="${r.id}">${t('requests.reject')}</button>
        </div>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="page">
      <h2>${t('requests.title')}</h2>
      ${!requests?.length
        ? `<p class="muted">${t('requests.noRequests')}</p>`
        : pendingList
      }
    </div>
  `;

  // Approve
  app.querySelectorAll('.btn-approve').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      btn.disabled = true;
      btn.textContent = '...';

      try {
        await api('/api/admin/pass-requests', {
          method: 'PATCH',
          body: JSON.stringify({ id, action: 'approve' }),
        });
        showToast(t('requests.passApproved'), 'success');
        renderAdminPassRequests();
      } catch (err) {
        showToast(err.message, 'error');
        renderAdminPassRequests();
      }
    });
  });

  // Reject
  app.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      btn.disabled = true;
      btn.textContent = '...';

      try {
        await api('/api/admin/pass-requests', {
          method: 'PATCH',
          body: JSON.stringify({ id, action: 'reject' }),
        });
        showToast(t('requests.passRejected'), 'info');
        renderAdminPassRequests();
      } catch (err) {
        showToast(err.message, 'error');
        renderAdminPassRequests();
      }
    });
  });
}
