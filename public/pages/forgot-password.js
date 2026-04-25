import { sb } from '../lib/supabase.js';
import { showToast } from '../components/toast.js';
import { t, toggleLang } from '../lib/i18n.js';
import { onSubmitWithLoading } from '../lib/loading.js';

export async function renderForgotPassword() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-page">
      <img class="auth-wordmark" src="/brand/wordmark.svg" alt="Jivatma">
      <p class="auth-subtitle">${t('auth.resetPassword')}</p>
      <div class="auth-card">
        <button id="lang-toggle" class="btn-link lang-toggle">${t('lang.switch')}</button>
        <form id="forgot-form" class="auth-form">
          <input type="email" id="email" placeholder="${t('auth.email')}" required autocomplete="email" />
          <button type="submit" class="btn btn-primary btn-block">${t('auth.sendResetLink')}</button>
        </form>
      </div>
      <p class="auth-links"><a href="/login">${t('auth.backToLogin')}</a></p>
    </div>
  `;

  document.getElementById('lang-toggle').addEventListener('click', () => toggleLang());

  onSubmitWithLoading(document.getElementById('forgot-form'), async () => {
    const email = document.getElementById('email').value;

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    showToast(t('auth.checkEmailReset'), 'success');
  });
}
