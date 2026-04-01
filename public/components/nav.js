import { sb, getProfile } from '../lib/supabase.js';
import { navigate } from '../lib/router.js';
import { t, toggleLang } from '../lib/i18n.js';

export async function renderNav() {
  const nav = document.getElementById('nav');
  const profile = await getProfile();

  if (!profile) {
    nav.classList.add('hidden');
    return;
  }

  nav.classList.remove('hidden');
  const isAdmin = profile.role === 'admin';

  nav.innerHTML = `
    <div class="nav-inner">
      <a href="#/" class="nav-brand">Jivatma</a>
      <div class="nav-links">
        ${isAdmin ? `
          <a href="#/admin">${t('nav.dashboard')}</a>
          <a href="#/admin/class">${t('nav.attendance')}</a>
          <a href="#/admin/users">${t('nav.users')}</a>
          <a href="#/admin/passes">${t('nav.passes')}</a>
          <a href="#/admin/schedule">${t('nav.schedule')}</a>
          <a href="#/admin/settings">${t('nav.settings')}</a>
        ` : `
          <a href="#/dashboard">${t('nav.home')}</a>
          <a href="#/schedule">${t('nav.classes')}</a>
          <a href="#/my-passes">${t('nav.myPasses')}</a>
          <a href="#/my-attendance">${t('nav.history')}</a>
        `}
        <a href="#/profile">${t('nav.profile')}</a>
        <button id="lang-btn" class="btn-link">${t('lang.switch')}</button>
        <button id="logout-btn" class="btn-link">${t('nav.logout')}</button>
      </div>
      <button id="nav-toggle" class="nav-toggle">☰</button>
    </div>
  `;

  document.getElementById('nav-toggle').addEventListener('click', () => {
    nav.querySelector('.nav-links').classList.toggle('open');
  });

  nav.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', () => {
      nav.querySelector('.nav-links').classList.remove('open');
    });
  });

  document.getElementById('lang-btn').addEventListener('click', () => {
    toggleLang();
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
    navigate('/login');
    renderNav();
  });
}
