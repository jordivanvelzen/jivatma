import { sb } from '../lib/supabase.js';
import { navigate } from '../lib/router.js';
import { showToast } from '../components/toast.js';
import { t, toggleLang } from '../lib/i18n.js';

export async function renderRegister() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-page">
      <h1>${t('auth.register')}</h1>
      <button id="lang-toggle" class="btn-link lang-toggle">${t('lang.switch')}</button>
      <form id="register-form" class="auth-form">
        <input type="text" id="full-name" placeholder="${t('auth.fullName')}" required autocomplete="name" />
        <input type="email" id="email" placeholder="${t('auth.email')}" required autocomplete="email" />
        <input type="password" id="password" placeholder="${t('auth.passwordMin')}" required minlength="6" autocomplete="new-password" />
        <button type="submit" class="btn btn-primary">${t('auth.createAccount')}</button>
      </form>
      <p class="auth-links">
        ${t('auth.haveAccount')} <a href="#/login">${t('auth.login')}</a>
      </p>
    </div>
  `;

  document.getElementById('lang-toggle').addEventListener('click', () => toggleLang());

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('full-name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    showToast(t('auth.accountCreated'), 'success');
    navigate('/login');
  });
}
