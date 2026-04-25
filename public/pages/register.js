import { sb } from '../lib/supabase.js';
import { navigate } from '../lib/router.js';
import { showToast } from '../components/toast.js';
import { t, toggleLang } from '../lib/i18n.js';
import { onSubmitWithLoading } from '../lib/loading.js';
import { api } from '../lib/api.js';

export async function renderRegister() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-page">
      <img class="auth-wordmark" src="/brand/wordmark.svg" alt="Jivatma">
      <p class="auth-subtitle">${t('auth.register')}</p>
      <div class="auth-card">
        <button id="lang-toggle" class="btn-link lang-toggle">${t('lang.switch')}</button>
        <p class="muted" style="font-size:0.875rem; margin:0">
          ${t('auth.registerIntro')}
        </p>
        <form id="register-form" class="auth-form">
          <input type="text" id="full-name" placeholder="${t('auth.fullName')}" required autocomplete="name" />
          <input type="email" id="email" placeholder="${t('auth.email')}" required autocomplete="email" />
          <input type="tel" id="phone" placeholder="${t('auth.phonePlaceholder')}" required autocomplete="tel" pattern="[0-9+\\s\\-\\(\\)]{7,}" />
          <input type="password" id="password" placeholder="${t('auth.passwordMin')}" required minlength="6" autocomplete="new-password" />
          <button type="submit" class="btn btn-primary btn-block">${t('auth.createAccount')}</button>
        </form>
      </div>

      <div class="info-box" style="text-align:left">
        <strong>${t('auth.nextSteps')}</strong>
        <ol style="margin:0.5rem 0 0 1.2rem; padding:0; font-size:0.875rem">
          <li>${t('auth.step1Email')}</li>
          <li>${t('auth.step2Confirm')}</li>
          <li>${t('auth.step3Login')}</li>
        </ol>
      </div>

      <p class="auth-links">
        ${t('auth.haveAccount')} <a href="/login">${t('auth.login')}</a>
      </p>
    </div>
  `;

  document.getElementById('lang-toggle').addEventListener('click', () => toggleLang());

  onSubmitWithLoading(document.getElementById('register-form'), async () => {
    const fullName = document.getElementById('full-name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    });

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    // Best-effort: save phone to profile (trigger may have created it already)
    if (data?.user) {
      await sb.from('profiles').update({ full_name: fullName, phone }).eq('id', data.user.id);
    }

    // Fire-and-forget: notify Claudia in Telegram about the new signup.
    // Only works when there's a session (email confirmation off). No-op otherwise.
    if (data?.session) {
      api('/api/me?action=notify-signup', { method: 'POST' }).catch(() => {});
    }

    showToast(t('auth.accountCreated'), 'success');
    navigate('/login');
  });
}
