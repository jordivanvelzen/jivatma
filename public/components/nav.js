import { sb, getSession, getProfile } from '../lib/supabase.js';
import { navigate } from '../lib/router.js';
import { t, toggleLang, getCurrentLang } from '../lib/i18n.js';
import { isStudentView, toggleStudentView, isMasterAdmin } from '../lib/view-mode.js';

export async function renderNav() {
  const nav = document.getElementById('nav');
  const profile = await getProfile();

  if (!profile) {
    nav.classList.add('hidden');
    return;
  }

  nav.classList.remove('hidden');
  const isAdmin = profile.role === 'admin';
  const session = await getSession();
  const masterAdmin = isAdmin && isMasterAdmin(session?.user?.email);
  const showAdminNav = isAdmin && !isStudentView();
  const lang = getCurrentLang();
  const otherLang = lang === 'es' ? 'EN' : 'ES';

  nav.classList.toggle('nav-student-view', masterAdmin && isStudentView());

  const mainLinks = showAdminNav ? `
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
  `;

  nav.innerHTML = `
    <div class="nav-inner">
      <a href="#/" class="nav-brand">Jivatma</a>

      <div class="nav-links">${mainLinks}</div>

      <div class="nav-actions">
        ${masterAdmin ? `
          <button id="view-toggle" class="view-toggle ${isStudentView() ? 'view-toggle--student' : ''}" title="${isStudentView() ? t('nav.adminView') : t('nav.studentView')}">
            ${isStudentView() ? '\u{1F469}\u200D\u{1F3EB}' : '\u{1F9D8}'}
          </button>
        ` : ''}
        <button id="lang-btn" class="nav-icon-btn" title="${t('lang.switch')}" aria-label="${t('lang.switch')}">${otherLang}</button>
        <a href="#/profile" class="nav-icon-btn" title="${t('nav.profile')}" aria-label="${t('nav.profile')}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>
        </a>
        <button id="logout-btn" class="nav-icon-btn" title="${t('nav.logout')}" aria-label="${t('nav.logout')}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
        <button id="nav-toggle" class="nav-toggle" aria-label="${t('nav.menu')}">\u2630</button>
      </div>
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

  const viewToggleBtn = document.getElementById('view-toggle');
  if (viewToggleBtn) {
    viewToggleBtn.addEventListener('click', () => {
      const nowStudent = toggleStudentView();
      navigate(nowStudent ? '/dashboard' : '/admin');
    });
  }

  document.getElementById('lang-btn').addEventListener('click', () => {
    toggleLang();
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
    navigate('/login');
    renderNav();
  });
}
