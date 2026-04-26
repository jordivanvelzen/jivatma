import { sb, getSession, getProfile, bootSession } from './lib/supabase.js';
import { route, setNotFound, startRouter, navigate } from './lib/router.js';
import { t } from './lib/i18n.js';
import { isStudentView, setStudentView } from './lib/view-mode.js';
import { renderNav } from './components/nav.js';
import { renderLogin } from './pages/login.js';
import { renderRegister } from './pages/register.js';
import { renderForgotPassword } from './pages/forgot-password.js';
import { renderResetPassword } from './pages/reset-password.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderSchedule } from './pages/schedule.js';
import { renderMyPasses } from './pages/my-passes.js';
import { renderMyAttendance } from './pages/my-attendance.js';
import { renderProfile } from './pages/profile.js';
import { renderAdminDashboard } from './pages/admin/index.js';
import { renderAdminClass } from './pages/admin/class.js';
import { renderAdminUsers } from './pages/admin/users.js';
import { renderAdminUserDetail } from './pages/admin/user-detail.js';
import { renderAdminPassTypes } from './pages/admin/pass-types.js';
import { renderAdminSchedule } from './pages/admin/schedule.js';
import { renderAdminSettings } from './pages/admin/settings.js';
import { renderAdminNotifications } from './pages/admin/notifications.js';
import { maybeShowIosInstallNudge, maybeShowAndroidInstallPrompt } from './lib/pwa-update.js';
import { renderLanding } from './pages/landing.js';
import { renderGuide } from './pages/guide.js';

// Show a centered spinner in #app while the next page is loading.
// The renderFn overwrites #app via innerHTML, so this clears on render.
function showPageLoading() {
  const app = document.getElementById('app');
  if (app) app.innerHTML = `<div class="page-loading"><span class="spinner"></span> ${t('general.loading')}</div>`;
}

// Auth guard: redirect to login if not logged in
async function requireAuth(renderFn, params) {
  const session = await getSession();
  if (!session) { navigate('/login'); return; }
  await renderNav();
  showPageLoading();
  await renderFn(params);
  maybeShowIosInstallNudge();
  maybeShowAndroidInstallPrompt();
}

// Admin guard: redirect if not admin or if in student view mode
async function requireAdmin(renderFn, params) {
  const session = await getSession();
  if (!session) { navigate('/login'); return; }
  const profile = await getProfile();
  if (profile?.role !== 'admin') { navigate('/dashboard'); return; }
  if (isStudentView()) { navigate('/dashboard'); return; }
  await renderNav();
  showPageLoading();
  await renderFn(params);
}

// Public pages
route('/login', async () => {
  const session = await getSession();
  if (session) {
    const profile = await getProfile();
    const isAdminNormal = profile?.role === 'admin' && !isStudentView();
    navigate(isAdminNormal ? '/admin' : '/dashboard');
    return;
  }
  setStudentView(false);
  document.getElementById('nav').classList.add('hidden');
  await renderLogin();
});

route('/register', async () => {
  document.getElementById('nav').classList.add('hidden');
  await renderRegister();
});

route('/forgot-password', async () => {
  document.getElementById('nav').classList.add('hidden');
  await renderForgotPassword();
});

route('/reset-password', async () => {
  document.getElementById('nav').classList.add('hidden');
  await renderResetPassword();
});

route('/guide', async () => {
  document.getElementById('nav').classList.add('hidden');
  await renderGuide();
});

// User pages
route('/dashboard', (p) => requireAuth(renderDashboard, p));
route('/schedule', (p) => requireAuth(renderSchedule, p));
route('/my-passes', (p) => requireAuth(renderMyPasses, p));
route('/my-attendance', (p) => requireAuth(renderMyAttendance, p));
route('/profile', (p) => requireAuth(renderProfile, p));

// Admin pages
route('/admin', (p) => requireAdmin(renderAdminDashboard, p));
route('/admin/class', (p) => requireAdmin(renderAdminClass, p));
route('/admin/users', (p) => requireAdmin(renderAdminUsers, p));
route('/admin/users/:id', (p) => requireAdmin(renderAdminUserDetail, p));
route('/admin/passes', (p) => requireAdmin(renderAdminPassTypes, p));
route('/admin/schedule', (p) => requireAdmin(renderAdminSchedule, p));
route('/admin/settings', (p) => requireAdmin(renderAdminSettings, p));
route('/admin/notifications', (p) => requireAdmin(renderAdminNotifications, p));

// Default route — landing page for visitors, dashboard/admin for logged-in users
route('/', async () => {
  const session = await getSession();
  if (!session) {
    document.getElementById('nav').classList.add('hidden');
    await renderLanding();
    return;
  }
  const profile = await getProfile();
  const isAdminNormal = profile?.role === 'admin' && !isStudentView();
  navigate(isAdminNormal ? '/admin' : '/dashboard');
});

setNotFound(() => {
  document.getElementById('app').innerHTML = `
    <div class="page"><h2>${t('general.notFound')}</h2><a href="/">${t('general.goHome')}</a></div>
  `;
});

// If the refresh token dies mid-session (revoked, past max lifetime, etc.),
// Supabase fires SIGNED_OUT. Bounce to /login so we don't leave an authed UI
// pointing at a dead session. Only act when we're on a guarded page.
const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/forgot-password', '/reset-password']);
sb.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' && !PUBLIC_PATHS.has(window.location.pathname)) {
    navigate('/login');
  }
});

// Start: refresh the session up front so route guards see a live token even
// after the PWA has been backgrounded for >1h. Returning PWA users no longer
// get a flash of /login while the auto-refresh races the auth guard.
(async () => {
  await bootSession();
  startRouter();
})();
