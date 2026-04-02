import { sb, getSession } from '../../lib/supabase.js';
import { showToast } from '../../components/toast.js';
import { renderPassCard } from '../../components/pass-card.js';
import { t, getLocale } from '../../lib/i18n.js';

export async function renderAdminUserDetail(params) {
  const app = document.getElementById('app');
  const userId = params.id;

  const { data: user } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (!user) { app.innerHTML = '<div class="page"><p>User not found.</p></div>'; return; }

  const today = new Date().toISOString().split('T')[0];

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

  app.innerHTML = `
    <div class="page">
      <a href="#/admin/users" class="back-link">${t('admin.backToUsers')}</a>
      <h2>${user.full_name || '(no name)'}</h2>
      <p class="muted">${user.phone || t('admin.noPhone')} · <span class="badge badge-${user.role}">${user.role}</span></p>

      ${!isSelf ? `
        <div class="role-toggle">
          <button id="toggle-role" class="btn btn-small btn-secondary">
            ${user.role === 'admin' ? t('admin.removeAdmin') : t('admin.makeAdmin')}
          </button>
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
          : passes.map(p => renderPassCard(p, p.pass_types)).join('')
        }
      </section>

      <section class="section">
        <h3>${t('admin.recentAttendance')}</h3>
        ${!attendance?.length
          ? `<p class="muted">${t('admin.noAttendanceYet')}</p>`
          : `<ul class="list">${attendance.filter(a => a.class_sessions).map(a => {
              const s = a.class_sessions;
              const dateStr = new Date(s.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
              return `<li>${dateStr} · ${s.start_time.slice(0, 5)}</li>`;
            }).join('')}</ul>`
        }
      </section>
    </div>
  `;

  // Toggle role
  document.getElementById('toggle-role')?.addEventListener('click', async () => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(t('admin.roleChanged', { role: newRole }), 'success');
    renderAdminUserDetail(params);
  });

  // Assign pass
  document.getElementById('assign-pass-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passTypeId = parseInt(document.getElementById('pass-type-select').value, 10);
    const paymentMethod = document.getElementById('payment-method').value;
    const isPaid = document.getElementById('is-paid').checked;

    const passType = passTypes.find(pt => pt.id === passTypeId);
    if (!passType) { showToast(t('admin.selectPassType'), 'error'); return; }

    const startsAt = today;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + passType.validity_days);

    const { error } = await sb.from('user_passes').insert({
      user_id: userId,
      pass_type_id: passTypeId,
      classes_remaining: passType.class_count,
      starts_at: startsAt,
      expires_at: expiresAt.toISOString().split('T')[0],
      payment_method: paymentMethod,
      is_paid: isPaid,
      created_by: currentSession.user.id,
    });

    if (error) { showToast(error.message, 'error'); return; }
    showToast(t('admin.passAssigned'), 'success');
    renderAdminUserDetail(params);
  });
}
