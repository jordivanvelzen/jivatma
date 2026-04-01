/**
 * Simple hash-based SPA router.
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
 * Navigate to a hash route.
 */
export function navigate(path) {
  window.location.hash = path;
}

/**
 * Get the current hash path.
 */
export function currentPath() {
  return window.location.hash.slice(1) || '/';
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
 * Resolve the current hash and call the matching handler.
 */
async function resolve() {
  const path = currentPath();

  for (const [pattern, handler] of Object.entries(routes)) {
    const params = matchRoute(pattern, path);
    if (params !== null) {
      await handler(params);
      return;
    }
  }

  if (notFoundHandler) {
    await notFoundHandler();
  }
}

/**
 * Start listening for hash changes.
 */
export function startRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
