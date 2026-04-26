import { sb, getSession, getProfile } from '../lib/supabase.js';
import { navigate, currentPath } from '../lib/router.js';
import { t, toggleLang, getCurrentLang } from '../lib/i18n.js';
import { isStudentView, toggleStudentView, isMasterAdmin } from '../lib/view-mode.js';
import { icon } from '../lib/icons.js';

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 264.28 55.34" aria-label="Jivatma" role="img" preserveAspectRatio="xMidYMid meet" class="nav-brand-svg"><g fill="#fffbd2"><path d="M21.89,13.12c-.08-.86-.4-1.75-.95-2.65-.55-.91-1.39-1.73-2.5-2.47v-.38c.77,.04,1.71,.1,2.81,.2,1.11,.09,2.09,.12,2.93,.12,.77,0,1.52-.04,2.27-.12,.75-.09,1.52-.15,2.33-.2v.32c-.96,.43-1.56,1.19-1.81,2.27-.25,1.08-.41,2.12-.49,3.11-.08,1.04-.12,2.08-.12,3.14v14.74c0,2.98-.08,5.72-.23,8.23-.15,2.51-.65,4.63-1.5,6.35-.61,1.29-1.42,2.33-2.43,3.1-1.01,.77-2.06,1.38-3.13,1.81-.77,.39-1.5,.71-2.21,.98-.71,.25-1.42,.39-2.15,.39-.19,0-.4-.03-.63-.1-.23-.06-.34-.18-.34-.36s.1-.28,.29-.32c1.42-.56,2.7-1.18,3.85-1.85,1.15-.67,2.04-1.81,2.7-3.4,.38-1,.69-2.1,.92-3.33,.23-1.23,.41-2.51,.52-3.85,.11-1.35,.19-2.68,.23-4.02,.04-1.34,.05-2.64,.05-3.89v-3.75c0-2.24-.03-4.59-.11-7.03-.08-2.44-.17-4.78-.29-7.03Z"/><path d="M42.56,45.58c-.8,0-1.62,.02-2.44,.05-.83,.04-1.6,.09-2.33,.15v-.3c.73-.26,1.35-.66,1.87-1.19,.51-.53,.79-1.15,.83-1.88,.03-1.75,.05-3.5,.05-5.26v-5.25c0-1.72-.02-3.53-.08-5.41-.06-1.88-.14-3.68-.26-5.41-.04-.69-.22-1.38-.54-2.05-.33-.68-1.04-1.32-2.16-1.91v-.19c.76,.06,1.58,.11,2.44,.14,.86,.03,1.7,.05,2.5,.05s1.61-.02,2.44-.07c.82-.05,1.64-.09,2.44-.12v.19c-.96,.36-1.59,.95-1.9,1.76-.31,.82-.5,1.58-.57,2.31-.12,.92-.18,1.89-.21,2.9-.02,1.01-.02,2.02-.02,3.05v4.66c0,1.73,.04,3.46,.11,5.21,.08,1.75,.15,3.48,.22,5.2,.08,.73,.33,1.38,.75,1.96,.42,.58,1.1,1.02,2.01,1.31v.3c-.88-.07-1.75-.12-2.61-.15-.86-.03-1.71-.05-2.55-.05Z"/><path d="M67.14,27.89c-.92-2.24-1.94-4.64-3.08-7.18-1.13-2.55-2.21-4.95-3.25-7.2-.38-.9-.83-1.78-1.35-2.62-.52-.84-1.51-1.63-2.96-2.36l-.06-.39c.81,.04,1.63,.11,2.5,.2,.86,.09,1.71,.13,2.56,.13,.76,0,1.56-.02,2.39-.07,.82-.04,1.65-.08,2.5-.12l.17,.38c-.38,.22-.66,.55-.84,.98-.17,.43-.26,.88-.26,1.36,0,.95,.17,1.87,.52,2.78,.8,2.25,1.71,4.58,2.73,7s1.95,4.71,2.79,6.87c.76,1.86,1.56,3.7,2.38,5.54,.82,1.84,1.64,3.68,2.44,5.54h.46c.65-1.6,1.31-3.2,1.98-4.79,.67-1.6,1.33-3.21,1.98-4.86,.96-2.24,1.92-4.75,2.9-7.51,.98-2.77,1.89-5.27,2.73-7.52,.19-.43,.35-.91,.49-1.43,.14-.52,.2-1.04,.2-1.55,0-.61-.15-1.14-.46-1.62-.31-.48-.92-.8-1.84-.98l.17-.32c.73,.04,1.51,.1,2.33,.16,.82,.06,1.66,.09,2.5,.09,.76,0,1.57-.03,2.41-.09,.84-.07,1.71-.12,2.59-.16l-.12,.32c-1.15,.47-2.11,1.24-2.87,2.3-.77,1.06-1.4,2.06-1.9,3.01-1.04,2.16-2.05,4.47-3.04,6.94-1,2.46-1.93,4.75-2.81,6.86-.46,1.12-.95,2.27-1.47,3.47-.52,1.19-1.09,2.5-1.72,3.92-.63,1.43-1.32,3.02-2.07,4.79-.75,1.77-1.58,3.82-2.5,6.15-.12,.35-.31,.52-.57,.52-.23,0-.46-.24-.69-.71-.46-1.12-1.03-2.47-1.72-4.05-.69-1.57-1.41-3.2-2.15-4.86-.75-1.67-1.47-3.28-2.18-4.86-.71-1.57-1.31-2.93-1.81-4.05Z"/><path d="M112.86,13.51l11.14,27.41c.88,2.25,2.28,3.76,4.2,4.54v.33c-1.73-.26-3.43-.39-5.11-.39-1.84,0-3.64,.13-5.4,.39v-.26c0-.43,.24-.89,.72-1.36,.48-.47,.72-1.01,.72-1.62,0-.65-.14-1.23-.41-1.75l-3.56-9.72c-1-.08-2.01-.16-3.05-.23-1.03-.06-2.06-.09-3.1-.09s-2.15,.03-3.21,.09c-1.08,.07-2.13,.15-3.16,.23l-4.13,10.56c-.16,.39-.29,.74-.4,1.07-.12,.32-.17,.66-.17,1,0,.56,.28,1.17,.86,1.81v.26c-.65-.09-1.29-.15-1.9-.2-.61-.05-1.24-.07-1.9-.07s-1.38,.02-2.06,.07c-.69,.04-1.36,.1-2.01,.2l.29-.26c1.07-.34,2.04-.93,2.9-1.75,.86-.82,1.56-1.84,2.09-3.05l11.26-26.56c.08-.34,.12-.61,.12-.78,.04-.86-.29-1.76-1-2.68-.71-.93-1.55-1.71-2.5-2.37l-.12-.33c.73,.04,1.63,.09,2.7,.13,1.07,.04,2.01,.06,2.81,.06h1.26l2.12,5.31Zm1.32,15.43v-.26l-4.89-12.76h-.11l-5.4,12.76v.26c.84,.04,1.7,.07,2.56,.09,.86,.02,1.73,.03,2.61,.03s1.7,0,2.58-.03c.88-.02,1.76-.06,2.64-.09Z"/><path d="M158.58,7.42c-.15,.82-.57,1.79-1.24,2.92-.67,1.12-1.1,2.16-1.29,3.11-.08,.22-.17,.36-.28,.42-.12,.06-.22,.09-.29,.09-.15,0-.23-.23-.23-.68s-.03-.9-.11-1.33c-.12-.43-.43-.76-.95-1-.52-.24-.97-.38-1.35-.42-1.3-.05-2.67-.07-4.11-.07h-4.1l-.29,3.24c-.08,1.25-.13,2.53-.15,3.82-.02,1.3-.03,2.62-.03,3.95v6.09c0,2.29,.03,4.55,.08,6.8,.06,2.24,.17,4.52,.32,6.8,.04,.95,.28,1.79,.72,2.53,.44,.74,1.12,1.31,2.04,1.75v.39c-.88-.04-1.75-.1-2.62-.16-.85-.07-1.73-.1-2.61-.1-.8,0-1.61,.03-2.41,.1-.8,.06-1.57,.12-2.3,.16v-.39c.73-.34,1.35-.87,1.87-1.55,.52-.69,.77-1.52,.77-2.46,.04-2.29,.06-4.58,.09-6.86,.02-2.29,.03-4.58,.03-6.87s-.01-4.75-.03-7.39c-.02-2.63-.05-5.07-.09-7.32v-2.52c-1.57,0-3.13,.03-4.68,.1-1.55,.06-3.08,.27-4.57,.61-.49,.09-1.06,.26-1.7,.55-.63,.28-1.19,.62-1.69,1.01-.35,.3-.66,.6-.95,.88-.29,.28-.56,.42-.83,.42-.23,0-.34-.09-.34-.26,.04-.39,.29-.87,.77-1.45,.48-.58,.84-1.13,1.06-1.65,.23-.47,.49-.98,.78-1.52,.29-.54,.46-1.05,.54-1.52h.63c.23,.26,.55,.45,.95,.58,.4,.13,.99,.22,1.75,.26,1.91,.04,3.83,.07,5.75,.07h5.74c1.84,0,3.78-.03,5.83-.1,2.05-.07,4.04-.14,6-.23,.69,0,1.27-.1,1.75-.29,.48-.2,.93-.36,1.35-.49h.41Z"/><path d="M205.91,13.58l4.02,27.27c.19,1.12,.66,2.08,1.4,2.88,.75,.8,1.62,1.4,2.62,1.78v.33c-.84-.17-1.7-.3-2.56-.36-.87-.07-1.72-.1-2.56-.1-.92,0-1.84,.03-2.75,.1-.92,.06-1.83,.18-2.71,.36v-.33c0-.17,.12-.32,.35-.45,.23-.13,.48-.29,.75-.49,.26-.19,.49-.45,.66-.77,.17-.33,.22-.77,.14-1.33l-3.16-23h-.22l-11.03,26.05c-.2,.34-.37,.52-.52,.52-.08,0-.15-.06-.23-.19s-.19-.28-.34-.45c-.16-.26-.35-.62-.58-1.1-.23-.47-.74-1.53-1.55-3.17-.81-1.65-2.02-4.12-3.62-7.42-1.61-3.31-3.87-7.93-6.78-13.9l-.4,.13-2.82,20.8c-.04,.17-.06,.48-.06,.91,0,.86,.19,1.62,.58,2.27,.38,.65,1.03,1.14,1.95,1.49l.11,.39c-.61-.09-1.48-.15-2.59-.2-1.11-.05-1.99-.07-2.64-.07-.69,0-1.38,.02-2.07,.07-.69,.04-1.36,.1-2.01,.2l.29-.26c1.07-.34,1.93-1.07,2.58-2.17,.65-1.1,1.06-2.32,1.21-3.66l3.73-26.83c.04-.78-.17-1.55-.63-2.33-.46-.78-1.2-1.51-2.24-2.21v-.33c.76,.04,1.51,.09,2.24,.13,.73,.04,1.51,.06,2.36,.06l13.66,29.34h.86l10.34-24.04,2.24-5.31c.8,0,1.56-.02,2.27-.06,.71-.04,1.48-.11,2.32-.2v.33c-1,.47-1.72,1.25-2.18,2.34-.45,1.08-.61,2.06-.45,2.97Z"/><path d="M244.62,13.51l11.15,27.41c.88,2.25,2.28,3.76,4.19,4.54v.33c-1.73-.26-3.43-.39-5.11-.39-1.84,0-3.64,.13-5.4,.39v-.26c0-.43,.24-.89,.72-1.36,.47-.47,.72-1.01,.72-1.62,0-.65-.13-1.23-.41-1.75l-3.56-9.72c-1-.08-2.01-.16-3.04-.23-1.04-.06-2.07-.09-3.1-.09s-2.14,.03-3.22,.09c-1.07,.07-2.12,.15-3.16,.23l-4.13,10.56c-.15,.39-.29,.74-.41,1.07-.11,.32-.17,.66-.17,1,0,.56,.29,1.17,.86,1.81v.26c-.65-.09-1.28-.15-1.9-.2-.61-.05-1.24-.07-1.9-.07-.69,0-1.37,.02-2.07,.07-.69,.04-1.36,.1-2.01,.2l.29-.26c1.07-.34,2.03-.93,2.9-1.75,.86-.82,1.56-1.84,2.1-3.05l11.26-26.56c.08-.34,.12-.61,.12-.78,.04-.86-.3-1.76-1.01-2.68-.71-.93-1.54-1.71-2.5-2.37l-.11-.33c.73,.04,1.63,.09,2.7,.13,1.07,.04,2.01,.06,2.81,.06h1.26l2.13,5.31Zm1.32,15.43v-.26l-4.88-12.76h-.12l-5.4,12.76v.26c.85,.04,1.69,.07,2.55,.09,.86,.02,1.73,.03,2.62,.03s1.7,0,2.58-.03c.88-.02,1.76-.06,2.64-.09Z"/></g><path fill="#fdb515" d="M48.61,7.81c0,1.98-1.61,3.59-3.59,3.59s-3.6-1.61-3.6-3.59,1.61-3.59,3.6-3.59,3.59,1.61,3.59,3.59Z"/></svg>`;

// Pre-rendered icon shortcuts for nav (default size 20)
const ICON = {
  classes:   icon('classes',  { size: 24 }),
  passes:    icon('passes',   { size: 24 }),
  home:      icon('home',     { size: 24 }),
  check:     icon('check',    { size: 24 }),
  spots:     icon('spots',    { size: 24 }),
  settings:  icon('settings', { size: 24 }),
  profile24: icon('profile',  { size: 24 }),
  profile:   icon('profile',  { size: 20 }),
  lang:      icon('lang',     { size: 20 }),
  logout:    icon('logout',   { size: 20 }),
  admin:     icon('admin',    { size: 14 }),
  student:   icon('student',  { size: 14 }),
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
      <a href="/" class="nav-brand">${LOGO_SVG}</a>
      <div class="nav-links">
        <a href="/admin" class="nav-links__desktop ${currentPath() === '/admin' ? 'active' : ''}">${t('nav.dashboard')}</a>
        <a href="/admin/class" class="nav-links__desktop ${isActive('/admin/class') ? 'active' : ''}">${t('nav.attendance')}</a>
        <a href="/admin/users" class="nav-links__desktop ${isActive('/admin/users') ? 'active' : ''}">${t('nav.users')}</a>
        <a href="/admin/passes" class="nav-links__desktop ${isActive('/admin/passes') ? 'active' : ''}">${t('nav.passes')}</a>
        <a href="/admin/schedule" class="${isActive('/admin/schedule') ? 'active' : ''}">${t('nav.schedule')}</a>
        <a href="/admin/settings" class="${isActive('/admin/settings') ? 'active' : ''}">${t('nav.settings')}</a>
        <a href="/admin/notifications" class="${isActive('/admin/notifications') ? 'active' : ''}">Notificaciones</a>
        <a href="/guide#admin" class="${isActive('/guide') ? 'active' : ''}">${t('nav.guide')}</a>
        <a href="/profile" class="${isActive('/profile') ? 'active' : ''}">${t('nav.profile')}</a>
      </div>
      <div class="nav-actions">
        ${masterAdmin ? renderViewPill(false) : ''}
        <button id="lang-btn" class="nav-icon-btn" title="${t('lang.switch')}">${otherLang}</button>
        <a href="/profile" class="nav-icon-btn nav-icon-btn--desk" title="${t('nav.profile')}">${ICON.profile}</a>
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
      <a href="/dashboard" class="nav-brand">${LOGO_SVG}</a>
      <div class="nav-links">
        <a href="/dashboard" class="${currentPath() === '/dashboard' ? 'active' : ''}">${t('nav.home')}</a>
        <a href="/schedule" class="${isActive('/schedule') ? 'active' : ''}">${t('nav.classes')}</a>
        <a href="/my-passes" class="${isActive('/my-passes') ? 'active' : ''}">${t('nav.myPasses')}</a>
        <a href="/my-attendance" class="${isActive('/my-attendance') ? 'active' : ''}">${t('nav.history')}</a>
        <a href="/guide" class="${isActive('/guide') ? 'active' : ''}">${t('nav.guide')}</a>
        <a href="/profile" class="${isActive('/profile') ? 'active' : ''}">${t('nav.profile')}</a>
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
        { href: '/admin',        icon: ICON.home,    label: t('nav.panel'),      match: '/admin',      exact: true },
        { href: '/admin/class',  icon: ICON.check,   label: t('nav.attendance'), match: '/admin/class' },
        { href: '/admin/users',  icon: ICON.spots,   label: t('nav.users'),      match: '/admin/users' },
        { href: '/admin/passes', icon: ICON.passes,  label: t('nav.passes'),     match: '/admin/passes' },
      ]
    : [
        { href: '/dashboard',    icon: ICON.home,      label: t('nav.home'),     match: '/dashboard' },
        { href: '/schedule',     icon: ICON.classes,   label: t('nav.classes'),  match: '/schedule' },
        { href: '/my-passes',    icon: ICON.passes,    label: t('nav.myPasses'), match: '/my-passes' },
        { href: '/profile',      icon: ICON.profile24, label: t('nav.profile'),  match: '/profile' },
      ];

  const path = currentPath();
  const itemActive = (it) => {
    const primary = it.exact ? path === it.match : (path === it.match || path.startsWith(it.match + '/'));
    if (primary) return true;
    return it.extraMatches?.some(m => path === m || path.startsWith(m + '/')) ?? false;
  };

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
