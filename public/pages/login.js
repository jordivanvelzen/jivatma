import { sb } from '../lib/supabase.js';
import { navigate } from '../lib/router.js';
import { renderNav } from '../components/nav.js';
import { showToast } from '../components/toast.js';
import { t, toggleLang } from '../lib/i18n.js';
import { withLoading, onSubmitWithLoading } from '../lib/loading.js';

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
      <div id="unconfirmed-banner" class="cash-notice hidden" style="margin-top:1rem">
        <p style="margin:0 0 0.5rem">${t('auth.emailNotConfirmed')}</p>
        <button type="button" id="resend-confirmation" class="btn btn-small btn-secondary">${t('auth.resendConfirmation')}</button>
      </div>
      <p class="auth-links">
        <a href="#/register">${t('auth.createAccount')}</a> · <a href="#/forgot-password">${t('auth.forgotPassword')}</a>
      </p>
    </div>
  `;

  document.getElementById('lang-toggle').addEventListener('click', () => toggleLang());

  const banner = document.getElementById('unconfirmed-banner');
  const resendBtn = document.getElementById('resend-confirmation');

  resendBtn.addEventListener('click', () => withLoading(resendBtn, async () => {
    const email = document.getElementById('email').value;
    if (!email) return;
    const { error } = await sb.auth.resend({ type: 'signup', email });
    if (error) { showToast(error.message, 'error'); return; }
    showToast(t('auth.confirmationResent'), 'success');
  }));

  onSubmitWithLoading(document.getElementById('login-form'), async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      // Case 1: Supabase explicitly tells us the email isn't confirmed
      const code = error.code || '';
      const msg = (error.message || '').toLowerCase();
      const unconfirmed = code === 'email_not_confirmed' || msg.includes('not confirmed') || msg.includes('not verified');

      if (unconfirmed) {
        banner.classList.remove('hidden');
        showToast(t('auth.emailNotConfirmed'), 'error');
        return;
      }

      // Case 2: generic "Invalid login credentials". Could be wrong password OR unconfirmed
      // email on projects that mask that error. Probe by calling resend — if it succeeds
      // without error, the user exists but is unconfirmed.
      if (code === 'invalid_credentials' || msg.includes('invalid')) {
        const { error: resendErr } = await sb.auth.resend({ type: 'signup', email });
        // If resend succeeds (no error) OR the error is about rate-limiting, the account
        // most likely exists and is unconfirmed. If it errors with "already confirmed" or
        // "user not found", it's genuinely bad credentials.
        const rMsg = (resendErr?.message || '').toLowerCase();
        const looksUnconfirmed = !resendErr || rMsg.includes('rate') || rMsg.includes('seconds') || rMsg.includes('for security');

        if (looksUnconfirmed) {
          banner.classList.remove('hidden');
          showToast(t('auth.emailNotConfirmed'), 'error');
          return;
        }

        showToast(t('auth.invalidCredentials'), 'error');
        return;
      }

      showToast(error.message, 'error');
      return;
    }

    banner.classList.add('hidden');

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
