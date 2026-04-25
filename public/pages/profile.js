import { sb, getSession, getProfile } from '../lib/supabase.js';
import { showToast } from '../components/toast.js';
import { t } from '../lib/i18n.js';
import { onSubmitWithLoading } from '../lib/loading.js';

export async function renderProfile() {
  const app = document.getElementById('app');
  const profile = await getProfile();

  app.innerHTML = `
    <div class="page">
      <h2>${t('profile.title')}</h2>
      <form id="profile-form" class="form">
        <label>${t('profile.fullName')}
          <input type="text" id="full-name" value="${profile?.full_name || ''}" required />
        </label>
        <label>${t('profile.phone')}
          <input type="tel" id="phone" value="${profile?.phone || ''}" placeholder="${t('profile.phoneOptional')}" />
        </label>
        <button type="submit" class="btn btn-primary">${t('profile.save')}</button>
      </form>

      <hr />

      <h3>${t('profile.changePassword')}</h3>
      <form id="password-form" class="form">
        <label>${t('auth.newPassword')}
          <input type="password" id="new-password" placeholder="${t('auth.passwordMin')}" required minlength="6" />
        </label>
        <button type="submit" class="btn btn-secondary">${t('auth.updatePassword')}</button>
      </form>
    </div>
  `;

  onSubmitWithLoading(document.getElementById('profile-form'), async () => {
    const fullName = document.getElementById('full-name').value;
    const phone = document.getElementById('phone').value;

    const session = await getSession();
    const { error } = await sb
      .from('profiles')
      .update({ full_name: fullName, phone: phone || null })
      .eq('id', session.user.id);

    if (error) { showToast(error.message, 'error'); return; }
    showToast(t('profile.updated'), 'success');
  });

  onSubmitWithLoading(document.getElementById('password-form'), async () => {
    const password = document.getElementById('new-password').value;
    const { error } = await sb.auth.updateUser({ password });
    if (error) { showToast(error.message, 'error'); return; }
    showToast(t('auth.passwordUpdated'), 'success');
    document.getElementById('new-password').value = '';
  });
}
