import { sb } from '../lib/supabase.js';
import { navigate } from '../lib/router.js';
import { renderNav } from '../components/nav.js';
import { showToast } from '../components/toast.js';
import { t, toggleLang } from '../lib/i18n.js';

export async function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-page">
      <h1>Jivatma</h1>
      <button id="lang-toggle" class="btn-link lang-toggle">${t('lang.switch')}</button>
      <form id="login-form" class="auth-form">
        <input type="email" id="email" placeholder="${t('auth.email')}" required autocomplete="email" />
        <input type="password" id="password" placeholder="${t('auth.password')}" required autocomplete="current-password" />
        <button type="submit" class="btn btn-primary">${t('auth.login')}</button>
      </form>
      <p class="auth-links">
        <a href="#/register">${t('auth.createAccount')}</a> · <a href="#/forgot-password">${t('auth.forgotPassword')}</a>
      </p>
    </div>
  `;

  document.getElementById('lang-toggle').addEventListener('click', () => toggleLang());

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    await renderNav();
    // Check role and redirect
    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', (await sb.auth.getUser()).data.user.id)
      .single();

    navigate(profile?.role === 'admin' ? '/admin' : '/dashboard');
  });
}
