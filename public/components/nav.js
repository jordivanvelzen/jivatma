import { sb, getSession, getProfile } from '../lib/supabase.js';
import { navigate, currentPath } from '../lib/router.js';
import { t, toggleLang, getCurrentLang } from '../lib/i18n.js';
import { isStudentView, toggleStudentView, isMasterAdmin } from '../lib/view-mode.js';
import { icon } from '../lib/icons.js';

// Pre-rendered icon shortcuts for nav (default size 20)
const ICON = {
  classes: icon('classes', { size: 24 }),
  passes:  icon('passes',  { size: 24 }),
  home:    icon('home',    { size: 24 }),
  check:   icon('check',   { size: 24 }),
  spots:   icon('spots',   { size: 24 }),
  profile24: icon('profile', { size: 24 }),
  profile: icon('profile', { size: 20 }),
  lang:    icon('lang',    { size: 20 }),
  logout:  icon('logout',  { size: 20 }),
  admin:   icon('admin',   { size: 14 }),
  student: icon('student', { size: 14 }),
};

function isActive(prefix) {
  const p = currentPath();
  return p === prefix || p.startsWith(prefix + '/');
}

export async function renderNav() {
  const nav = document.getElementById('nav');
  const profile = await getProfile();

  // Clean up any existing bottom-nav from previous render
  document.querySelectorAll('.bottom-nav').forEach((el) => el.remove());
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
    renderBottomNav('admin');
  } else {
    renderStudentNav(nav, { masterAdmin, otherLang });
    renderBottomNav('student');
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
        <a href="#/profile" class="${isActive('/profile') ? 'active' : ''}">${t('nav.profile')}</a>
      </div>
      <div class="nav-actions">
        ${masterAdmin ? renderViewPill(false) : ''}
        <button id="lang-btn" class="nav-icon-btn" title="${t('lang.switch')}">${otherLang}</button>
        <a href="#/profile" class="nav-icon-btn nav-icon-btn--desk" title="${t('nav.profile')}">${ICON.profile}</a>
        <button id="logout-btn" class="nav-icon-btn" title="${t('nav.logout')}">${ICON.logout}</button>
        <button id="nav-toggle" class="nav-toggle" aria-label="${t('nav.menu')}">☰</button>
      </div>
    </div>
  `;
  wireCommonHandlers(nav);
}

function renderStudentNav(nav, { masterAdmin, otherLang }) {
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="#/dashboard" class="nav-brand">Jivatma</a>
      <div class="nav-links">
        <a href="#/dashboard" class="${currentPath() === '/dashboard' ? 'active' : ''}">${t('nav.home')}</a>
        <a href="#/schedule" class="${isActive('/schedule') ? 'active' : ''}">${t('nav.classes')}</a>
        <a href="#/my-passes" class="${isActive('/my-passes') ? 'active' : ''}">${t('nav.myPasses')}</a>
        <a href="#/my-attendance" class="${isActive('/my-attendance') ? 'active' : ''}">${t('nav.history')}</a>
        <a href="#/profile" class="${isActive('/profile') ? 'active' : ''}">${t('nav.profile')}</a>
      </div>
      <div class="nav-actions">
        ${masterAdmin ? renderViewPill(true) : ''}
        <button id="lang-btn" class="nav-icon-btn" title="${t('lang.switch')}">${otherLang}</button>
        <button id="logout-btn" class="nav-icon-btn" title="${t('nav.logout')}">${ICON.logout}</button>
      </div>
    </div>
  `;
  wireCommonHandlers(nav);
}

function renderBottomNav(mode) {
  document.body.classList.add('has-bottom-nav');

  const items = mode === 'admin'
    ? [
        { href: '#/admin',        icon: ICON.home,      label: t('nav.panel'),      match: '/admin',        exact: true },
        { href: '#/admin/class',  icon: ICON.check,     label: t('nav.attendance'), match: '/admin/class' },
        { href: '#/admin/users',  icon: ICON.spots,     label: t('nav.users'),      match: '/admin/users' },
        { href: '#/admin/passes', icon: ICON.passes,    label: t('nav.passes'),     match: '/admin/passes' },
      ]
    : [
        { href: '#/dashboard',    icon: ICON.home,      label: t('nav.home'),     match: '/dashboard' },
        { href: '#/schedule',     icon: ICON.classes,   label: t('nav.classes'),  match: '/schedule' },
        { href: '#/my-passes',    icon: ICON.passes,    label: t('nav.myPasses'), match: '/my-passes' },
        { href: '#/profile',      icon: ICON.profile24, label: t('nav.profile'),  match: '/profile' },
      ];

  const path = currentPath();
  const itemActive = (it) => it.exact ? path === it.match : (path === it.match || path.startsWith(it.match + '/'));

  const bottomNav = document.createElement('nav');
  bottomNav.className = 'bottom-nav';
  bottomNav.setAttribute('aria-label', t('nav.viewToggle'));
  bottomNav.innerHTML = items.map((it) => `
    <a href="${it.href}" class="bottom-nav-item ${itemActive(it) ? 'active' : ''}">
      ${it.icon}<span>${it.label}</span>
    </a>
  `).join('');
  document.body.appendChild(bottomNav);
  setupVisualViewportSync();
}

// Some mobile browsers (Fennec/Firefox Android, older iOS Safari) overlay browser
// chrome on top of the visual viewport. `position: fixed; bottom: 0` anchors to the
// LAYOUT viewport, so the bar gets covered by the URL bar / toolbar. We use the
// VisualViewport API to lift the bar by the gap between the layout and visual
// viewports — the bar tracks the visible bottom edge as the toolbar shows/hides.
let viewportSyncBound = false;
function setupVisualViewportSync() {
  const vv = window.visualViewport;
  if (!vv) return;

  const sync = () => {
    const bn = document.querySelector('.bottom-nav');
    if (!bn) return;
    const inset = window.innerHeight - (vv.height + vv.offsetTop);
    bn.style.bottom = inset > 0 ? `${inset}px` : '0px';
  };

  if (!viewportSyncBound) {
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    window.addEventListener('orientationchange', sync);
    viewportSyncBound = true;
  }
  sync();
}

function renderViewPill(isStudent) {
  return `
    <div class="view-pill" role="group" aria-label="${t('nav.viewToggle')}">
      <button type="button" class="view-pill-btn ${!isStudent ? 'active' : ''}" data-view="admin" title="${t('nav.adminView')}">
        ${ICON.admin}<span>${t('nav.adminShort')}</span>
      </button>
      <button type="button" class="view-pill-btn view-pill-btn--student ${isStudent ? 'active' : ''}" data-view="student" title="${t('nav.studentView')}">
        ${ICON.student}<span>${t('nav.studentShort')}</span>
      </button>
    </div>
  `;
}

function wireCommonHandlers(nav) {
  const navToggle = nav.querySelector('#nav-toggle');
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      nav.querySelector('.nav-links')?.classList.toggle('open');
    });
  }
  nav.querySelectorAll('.nav-links a').forEach((a) => {
    a.addEventListener('click', () => {
      nav.querySelector('.nav-links')?.classList.remove('open');
    });
  });

  // Segmented view-pill — clicking the inactive side flips
  nav.querySelectorAll('.view-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wantStudent = btn.dataset.view === 'student';
      const currentlyStudent = isStudentView();
      if (wantStudent === currentlyStudent) return;
      const nowStudent = toggleStudentView();
      const target = nowStudent ? '/dashboard' : '/admin';
      // If the hash is already the target, set hash to '' first to force resolve()
      if (currentPath() === target) {
        renderNav();
      } else {
        navigate(target);
      }
    });
  });

  nav.querySelector('#lang-btn')?.addEventListener('click', () => {
    toggleLang();
  });

  nav.querySelector('#logout-btn')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    navigate('/login');
    renderNav();
  });
}
