import { sb, getSession, getProfile } from '../lib/supabase.js';
import { navigate } from '../lib/router.js';
import { t, toggleLang } from '../lib/i18n.js';
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

  // Apply nav color based on view mode
  nav.classList.toggle('nav-student-view', masterAdmin && isStudentView());

  nav.innerHTML = `
    <div class="nav-inner">
      <a href="#/" class="nav-brand">Jivatma</a>
      ${masterAdmin ? `
        <button id="view-toggle" class="view-toggle ${isStudentView() ? 'view-toggle--student' : ''}">
          ${isStudentView() ? t('nav.adminView') : t('nav.studentView')}
        </button>
      ` : ''}
      <div class="nav-links">
        ${showAdminNav ? `
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
