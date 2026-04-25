import { sb, getSession, getProfile } from '../lib/supabase.js';
import { navigate, currentPath } from '../lib/router.js';
import { t, toggleLang, getCurrentLang } from '../lib/i18n.js';
import { isStudentView, toggleStudentView, isMasterAdmin } from '../lib/view-mode.js';

// SVG icons (24x24 stroke)
const ICON = {
  classes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  passes:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 12h20"/></svg>',
  more:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  home:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L3 9"/><path d="M12 7v5l3 2"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>',
  lang:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  logout:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

function isActive(prefix) {
  const p = currentPath();
  return p === prefix || p.startsWith(prefix + '/');
}

export async function renderNav() {
  const nav = document.getElementById('nav');
  const profile = await getProfile();

  // Clean up any existing bottom-nav / sheet from previous render
  document.querySelectorAll('.bottom-nav, .sheet, .sheet-backdrop').forEach((el) => el.remove());
  document.body.classList.remove('has-bottom-nav');

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

  if (showAdminNav) {
    renderAdminNav(nav, { masterAdmin, otherLang });
  } else {
    renderStudentNav(nav, { masterAdmin, otherLang });
  }
}

function renderAdminNav(nav, { masterAdmin, otherLang }) {
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="#/" class="nav-brand">Jivatma</a>
      <div class="nav-links">
        <a href="#/admin" class="${currentPath() === '/admin' ? 'active' : ''}">${t('nav.dashboard')}</a>
        <a href="#/admin/class" class="${isActive('/admin/class') ? 'active' : ''}">${t('nav.attendance')}</a>
        <a href="#/admin/users" class="${isActive('/admin/users') ? 'active' : ''}">${t('nav.users')}</a>
        <a href="#/admin/passes" class="${isActive('/admin/passes') ? 'active' : ''}">${t('nav.passes')}</a>
        <a href="#/admin/schedule" class="${isActive('/admin/schedule') ? 'active' : ''}">${t('nav.schedule')}</a>
        <a href="#/admin/settings" class="${isActive('/admin/settings') ? 'active' : ''}">${t('nav.settings')}</a>
      </div>
      <div class="nav-actions">
        ${masterAdmin ? `
          <button id="view-toggle" class="view-toggle" title="${t('nav.studentView')}">
            \u{1F9D8}
          </button>` : ''}
        <button id="lang-btn" class="nav-icon-btn" title="${t('lang.switch')}">${otherLang}</button>
        <a href="#/profile" class="nav-icon-btn" title="${t('nav.profile')}">${ICON.profile}</a>
        <button id="logout-btn" class="nav-icon-btn" title="${t('nav.logout')}">${ICON.logout}</button>
        <button id="nav-toggle" class="nav-toggle" aria-label="${t('nav.menu')}">☰</button>
      </div>
    </div>
  `;
  wireCommonHandlers(nav);
}

function renderStudentNav(nav, { masterAdmin, otherLang }) {
  // Slim top bar (brand only on mobile; full nav on desktop)
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="#/dashboard" class="nav-brand">Jivatma</a>
      <div class="nav-links">
        <a href="#/schedule" class="${isActive('/schedule') ? 'active' : ''}">${t('nav.classes')}</a>
        <a href="#/my-passes" class="${isActive('/my-passes') ? 'active' : ''}">${t('nav.myPasses')}</a>
        <a href="#/dashboard" class="${currentPath() === '/dashboard' ? 'active' : ''}">${t('nav.home')}</a>
        <a href="#/my-attendance" class="${isActive('/my-attendance') ? 'active' : ''}">${t('nav.history')}</a>
      </div>
      <div class="nav-actions">
        ${masterAdmin ? `
          <button id="view-toggle" class="view-toggle view-toggle--student" title="${t('nav.adminView')}">
            \u{1F469}‍\u{1F3EB}
          </button>` : ''}
        <button id="lang-btn" class="nav-icon-btn" title="${t('lang.switch')}">${otherLang}</button>
        <a href="#/profile" class="nav-icon-btn" title="${t('nav.profile')}">${ICON.profile}</a>
        <button id="logout-btn" class="nav-icon-btn" title="${t('nav.logout')}">${ICON.logout}</button>
      </div>
    </div>
  `;

  // Bottom nav (mobile) — hidden via CSS at ≥768px
  document.body.classList.add('has-bottom-nav');
  const bottomNav = document.createElement('nav');
  bottomNav.className = 'bottom-nav';
  bottomNav.innerHTML = `
    <a href="#/schedule" class="bottom-nav-item ${isActive('/schedule') ? 'active' : ''}">
      ${ICON.classes}<span>${t('nav.classes')}</span>
    </a>
    <a href="#/my-passes" class="bottom-nav-item ${isActive('/my-passes') ? 'active' : ''}">
      ${ICON.passes}<span>${t('nav.myPasses')}</span>
    </a>
    <button id="more-btn" class="bottom-nav-item" type="button">
      ${ICON.more}<span>${t('nav.more')}</span>
    </button>
  `;
  document.body.appendChild(bottomNav);

  // Sheet
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', t('nav.more'));
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-list">
      <a href="#/dashboard" class="sheet-item" data-close>${ICON.home}<span>${t('nav.home')}</span></a>
      <a href="#/my-attendance" class="sheet-item" data-close>${ICON.history}<span>${t('nav.history')}</span></a>
      <a href="#/profile" class="sheet-item" data-close>${ICON.profile}<span>${t('nav.profile')}</span></a>
      <button class="sheet-item" id="sheet-lang" type="button">${ICON.lang}<span>${t('lang.switch')}</span><span class="sheet-item-trail">${otherLang}</span></button>
      <button class="sheet-item" id="sheet-logout" type="button">${ICON.logout}<span>${t('nav.logout')}</span></button>
    </div>
  `;
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  const openSheet = () => {
    backdrop.classList.add('open');
    requestAnimationFrame(() => sheet.classList.add('open'));
  };
  const closeSheet = () => {
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
  };

  bottomNav.querySelector('#more-btn').addEventListener('click', openSheet);
  backdrop.addEventListener('click', closeSheet);
  sheet.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', closeSheet);
  });
  sheet.querySelector('#sheet-lang').addEventListener('click', () => {
    closeSheet();
    toggleLang();
  });
  sheet.querySelector('#sheet-logout').addEventListener('click', async () => {
    closeSheet();
    await sb.auth.signOut();
    navigate('/login');
    renderNav();
  });

  wireCommonHandlers(nav);
}

function wireCommonHandlers(nav) {
  const navToggle = document.getElementById('nav-toggle');
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      nav.querySelector('.nav-links').classList.toggle('open');
    });
  }
  nav.querySelectorAll('.nav-links a').forEach((a) => {
    a.addEventListener('click', () => {
      nav.querySelector('.nav-links')?.classList.remove('open');
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
