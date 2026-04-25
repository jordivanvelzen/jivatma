import { sb, getSession } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t, getLocale } from '../../lib/i18n.js';
import { todayStr, parseLocalDate, formatDbDate } from '../../lib/dates.js';
import { withLoading, onSubmitWithLoading } from '../../lib/loading.js';

export async function renderAdminUserDetail(params) {
  const app = document.getElementById('app');
  const userId = params.id;
  const backHref = params.from === 'passes' ? '#/admin/passes' : '#/admin/users';
  const backLabel = params.from === 'passes' ? t('admin.backToPasses') : t('admin.backToUsers');

  const { data: user } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (!user) { app.innerHTML = '<div class="page"><p>User not found.</p></div>'; return; }

  const today = todayStr();

  const { data: passes } = await sb
    .from('user_passes')
    .select('*, pass_types(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const { data: passTypes } = await sb
    .from('pass_types')
    .select('*')
    .eq('is_active', true)
    .order('kind');

  const { data: attendance } = await sb
    .from('attendance')
    .select('*, class_sessions(*)')
    .eq('user_id', userId)
    .order('checked_in_at', { ascending: false })
    .limit(10);

  const currentSession = await getSession();
  const isSelf = currentSession.user.id === userId;
  const locale = getLocale();

  const passRow = (p) => {
    const pt = p.pass_types;
    const kindLabel = pt?.kind === 'single' ? t('passes.singleClass')
      : pt?.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
      : t('passes.unlimited');
    const expired = parseLocalDate(p.expires_at) < parseLocalDate(today);
    const usedUp = p.classes_remaining !== null && p.classes_remaining <= 0;
    const status = expired ? t('passes.expired') : usedUp ? t('passes.usedUp') : t('passes.active');
    const statusClass = expired ? 'badge-expired' : usedUp ? 'badge-pending' : 'badge-active';
    const methodLabel = p.payment_method === 'gift' ? t('passes.gift')
      : p.payment_method === 'transfer' ? t('admin.transfer')
      : p.payment_method === 'other' ? t('admin.other')
      : t('admin.cash');
    return `
      <div class="pass-admin-card" data-pass-id="${p.id}">
        <div class="pass-admin-head">
          <div>
            <div class="pass-kind">${kindLabel}</div>
            <div class="muted" style="font-size:0.8rem">${methodLabel} · ${p.is_paid ? t('admin.paid') : t('passes.payAtClass')}</div>
          </div>
          <span class="badge ${statusClass}">${status}</span>
        </div>
        <div class="pass-admin-fields">
          <label>${t('passes.classesRemaining')}
            <input type="number" class="pass-edit-remaining" value="${p.classes_remaining ?? ''}" placeholder="\u221E" min="0" />
          </label>
          <label>${t('passes.expiresAt')}
            <input type="date" class="pass-edit-expires" value="${p.expires_at}" />
          </label>
          <label class="checkbox-label">
            <input type="checkbox" class="pass-edit-paid" ${p.is_paid ? 'checked' : ''} /> ${t('admin.paid')}
          </label>
        </div>
        <div class="pass-admin-actions">
          <button class="btn btn-small save-pass">${t('general.save')}</button>
          <button class="btn btn-small btn-secondary credit-pass">${t('passes.addClass')}</button>
          <button class="btn btn-small btn-secondary extend-pass">${t('passes.extend7')}</button>
          <button class="btn btn-small btn-danger delete-pass">${t('passes.deletePass')}</button>
        </div>
      </div>
    `;
  };

  app.innerHTML = `
    <div class="page">
      <a href="${backHref}" class="back-link">${backLabel}</a>
      <h2>${user.full_name || '(no name)'}</h2>
      <p class="muted">${user.phone || t('admin.noPhone')} · <span class="badge badge-${user.role}">${user.role}</span></p>

      ${!isSelf ? `
        <div class="role-toggle">
          <button id="toggle-role" class="btn btn-small btn-secondary">
            ${user.role === 'admin' ? t('admin.removeAdmin') : t('admin.makeAdmin')}
          </button>
        </div>
      ` : ''}

      ${user.role === 'admin' ? `
        <div class="role-toggle">
          <label class="checkbox-label">
            <input type="checkbox" id="toggle-show-attendance" ${user.show_in_attendance !== false ? 'checked' : ''} />
            ${t('admin.showInAttendance')}
          </label>
          <p class="muted" style="font-size:0.8rem;margin-top:0.25rem">${t('admin.showInAttendanceHelp')}</p>
        </div>
      ` : ''}

      <section class="section">
        <h3>${t('admin.assignPass')}</h3>
        <form id="assign-pass-form" class="form form-inline">
          <select id="pass-type-select" required>
            <option value="">${t('admin.selectPassType')}</option>
            ${(passTypes || []).map(pt => {
              const label = pt.kind === 'single' ? t('passes.singleClass')
                : pt.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
                : t('passes.unlimited');
              return `<option value="${pt.id}">${label} — $${parseFloat(pt.price).toFixed(2)} MXN</option>`;
            }).join('')}
          </select>
          <select id="payment-method">
            <option value="cash">${t('admin.cash')}</option>
            <option value="transfer">${t('admin.transfer')}</option>
            <option value="other">${t('admin.other')}</option>
            <option value="gift">${t('passes.gift')}</option>
          </select>
          <label class="checkbox-label">
            <input type="checkbox" id="is-paid" /> ${t('admin.paid')}
          </label>
          <button type="submit" class="btn btn-primary">${t('admin.assign')}</button>
        </form>
      </section>

      <section class="section">
        <h3>${t('passes.title')}</h3>
        ${!passes?.length
          ? `<p class="muted">${t('passes.noPasses')}</p>`
          : passes.map(passRow).join('')
        }
      </section>

      <section class="section">
        <h3>${t('admin.recentAttendance')}</h3>
        ${!attendance?.length
          ? `<p class="muted">${t('admin.noAttendanceYet')}</p>`
          : `<ul class="list">${attendance.filter(a => a.class_sessions).map(a => {
              const s = a.class_sessions;
              const dateStr = formatDbDate(s.date, locale, { day: 'numeric', month: 'short' });
              return `<li>${dateStr} · ${s.start_time.slice(0, 5)}</li>`;
            }).join('')}</ul>`
        }
      </section>
    </div>
  `;

  // Role toggle
  document.getElementById('toggle-role')?.addEventListener('click', (ev) => withLoading(ev.currentTarget, async () => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(t('admin.roleChanged', { role: newRole }), 'success');
    renderAdminUserDetail(params);
  }));

  // Show-in-attendance toggle (admins only)
  document.getElementById('toggle-show-attendance')?.addEventListener('change', async (e) => {
    const show = e.target.checked;
    try {
      await api('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({ id: userId, show_in_attendance: show }),
      });
      showToast(show ? t('admin.shownInAttendance') : t('admin.hiddenFromAttendance'), 'success');
      user.show_in_attendance = show;
    } catch (err) {
      e.target.checked = !show;
      showToast(err.message, 'error');
    }
  });

  // Gift → auto-check paid
  document.getElementById('payment-method')?.addEventListener('change', (e) => {
    if (e.target.value === 'gift') {
      document.getElementById('is-paid').checked = true;
    }
  });

  // Assign pass
  onSubmitWithLoading(document.getElementById('assign-pass-form'), async () => {
    const passTypeId = parseInt(document.getElementById('pass-type-select').value, 10);
    const paymentMethod = document.getElementById('payment-method').value;
    const isPaid = document.getElementById('is-paid').checked || paymentMethod === 'gift';

    try {
      await api('/api/admin/passes', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          pass_type_id: passTypeId,
          payment_method: paymentMethod,
          is_paid: isPaid,
        }),
      });
      showToast(paymentMethod === 'gift' ? t('passes.gifted') : t('admin.passAssigned'), 'success');
      renderAdminUserDetail(params);
    } catch (err) { showToast(err.message, 'error'); }
  });

  // Per-pass action handlers
  app.querySelectorAll('.pass-admin-card').forEach(card => {
    const id = parseInt(card.dataset.passId, 10);

    card.querySelector('.save-pass').addEventListener('click', (ev) => withLoading(ev.currentTarget, async () => {
      const remainingVal = card.querySelector('.pass-edit-remaining').value;
      const updates = {
        id,
        classes_remaining: remainingVal === '' ? null : parseInt(remainingVal, 10),
        expires_at: card.querySelector('.pass-edit-expires').value,
        is_paid: card.querySelector('.pass-edit-paid').checked,
      };
      try {
        await api('/api/admin/passes', { method: 'PATCH', body: JSON.stringify(updates) });
        showToast(t('passes.passUpdated'), 'success');
        renderAdminUserDetail(params);
      } catch (err) { showToast(err.message, 'error'); }
    }));

    card.querySelector('.credit-pass').addEventListener('click', (ev) => withLoading(ev.currentTarget, async () => {
      try {
        await api('/api/admin/passes', { method: 'PUT', body: JSON.stringify({ id, action: 'credit' }) });
        showToast(t('passes.creditAdded'), 'success');
        renderAdminUserDetail(params);
      } catch (err) { showToast(err.message, 'error'); }
    }));

    card.querySelector('.extend-pass').addEventListener('click', (ev) => withLoading(ev.currentTarget, async () => {
      try {
        await api('/api/admin/passes', { method: 'PUT', body: JSON.stringify({ id, action: 'extend', days: 7 }) });
        showToast(t('passes.extended'), 'success');
        renderAdminUserDetail(params);
      } catch (err) { showToast(err.message, 'error'); }
    }));

    card.querySelector('.delete-pass').addEventListener('click', (ev) => {
      if (!confirm(t('passes.deleteConfirm'))) return;
      return withLoading(ev.currentTarget, async () => {
        try {
          await api('/api/admin/passes', { method: 'DELETE', body: JSON.stringify({ id }) });
          showToast(t('passes.passDeleted'), 'info');
          renderAdminUserDetail(params);
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  });
}
