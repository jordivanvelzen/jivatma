/**
 * History API SPA router.
 * Clean URLs (no `#`). Vercel rewrites all non-asset / non-/api paths to /index.html.
 */

const routes = {};
let notFoundHandler = null;

/**
 * Register a route handler.
 * @param {string} path — e.g., '/login', '/admin/users/:id'
 * @param {function} handler — async (params) => void, renders into #app
 */
export function route(path, handler) {
  routes[path] = handler;
}

/**
 * Set a fallback for unknown routes.
 */
export function setNotFound(handler) {
  notFoundHandler = handler;
}

/**
 * Navigate to a route via the History API. Same-route is a no-op (no extra history entry).
 * Pass an absolute path like '/dashboard' or '/admin/class?date=2026-04-25'.
 */
export function navigate(path) {
  const current = window.location.pathname + window.location.search;
  if (path !== current) {
    window.history.pushState({}, '', path);
  }
  resolve();
}

/**
 * Replace the current history entry (for redirects) — back button skips it.
 */
export function replace(path) {
  window.history.replaceState({}, '', path);
  resolve();
}

/**
 * Get the current path (without query string).
 */
export function currentPath() {
  return window.location.pathname || '/';
}

/**
 * Match a route pattern against a path.
 * Supports :param segments (e.g., /admin/users/:id).
 */
function matchRoute(pattern, path) {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

/**
 * Resolve the current location and call the matching handler.
 */
async function resolve() {
  const path = currentPath();
  const query = Object.fromEntries(new URLSearchParams(window.location.search));

  for (const [pattern, handler] of Object.entries(routes)) {
    const params = matchRoute(pattern, path);
    if (params !== null) {
      await handler({ ...params, ...query });
      return;
    }
  }

  if (notFoundHandler) {
    await notFoundHandler();
  }
}

/**
 * Re-render the current route without changing the URL (used by language toggle, view-pill).
 */
export function rerender() {
  resolve();
}

/**
 * Intercept clicks on internal `<a>` links so they navigate via pushState instead of a full reload.
 * Skips: external links, target=_blank, modifier-clicks, links flagged with data-external.
 */
function interceptClicks() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return; // left-click only
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const a = e.target.closest('a');
    if (!a) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    if (a.dataset.external !== undefined) return;

    const href = a.getAttribute('href');
    if (!href) return;
    // External absolute URLs (http://, https://, mailto:, tel:, wa.me handled via full URLs)
    if (/^[a-z]+:/i.test(href) && !href.startsWith(window.location.origin)) return;
    // Same-origin absolute URL — strip origin
    let path = href;
    if (href.startsWith(window.location.origin)) path = href.slice(window.location.origin.length);
    if (!path.startsWith('/')) return; // relative or anchor — let browser handle

    e.preventDefault();
    navigate(path);
  });
}

/**
 * Start listening for navigation events.
 */
export function startRouter() {
  window.addEventListener('popstate', resolve);
  interceptClicks();
  resolve();
}
