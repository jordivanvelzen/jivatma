import { sb } from '../lib/supabase.js';
import { navigate } from '../lib/router.js';
import { showToast } from '../components/toast.js';
import { t, toggleLang } from '../lib/i18n.js';
import { onSubmitWithLoading } from '../lib/loading.js';

export async function renderResetPassword() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-page">
      <img class="auth-wordmark" src="/brand/wordmark.svg" alt="Jivatma">
      <p class="auth-subtitle">${t('auth.newPassword')}</p>
      <div class="auth-card">
        <button id="lang-toggle" class="btn-link lang-toggle">${t('lang.switch')}</button>
        <form id="reset-form" class="auth-form">
          <input type="password" id="password" placeholder="${t('auth.passwordMin')}" required minlength="6" autocomplete="new-password" />
          <button type="submit" class="btn btn-primary btn-block">${t('auth.updatePassword')}</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('lang-toggle').addEventListener('click', () => toggleLang());

  onSubmitWithLoading(document.getElementById('reset-form'), async () => {
    const password = document.getElementById('password').value;

    const { error } = await sb.auth.updateUser({ password });

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    showToast(t('auth.passwordUpdated'), 'success');
    navigate('/login');
  });
}
