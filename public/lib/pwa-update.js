// Service worker registration + in-app "Update available" prompt.
//
// Flow:
//   1. Page loads → register /sw.js.
//   2. Browser fetches sw.js, byte-compares to the active SW. If different, the new
//      SW installs and parks in "waiting" state (because we removed skipWaiting()).
//   3. We detect the waiting SW and render a small banner: "Update available — Reload".
//   4. User taps Reload → we postMessage SKIP_WAITING to the waiting SW → it activates,
//      fires controllerchange → we hard-reload the page so the new shell is in use.
//   5. If the user ignores the banner, the new version takes over on next full reload anyway.
//
// We never auto-reload mid-action — the user always confirms.

import { t } from './i18n.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');

      // Already a waiting SW from a previous tab/session.
      if (reg.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner(reg.waiting);
      }

      // New SW found mid-session.
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(installing);
          }
        });
      });

      // Re-check for updates whenever the tab comes back to focus (cheap; the browser
      // dedupes if nothing changed). Catches updates that landed while the tab was idle.
      window.addEventListener('focus', () => reg.update().catch(() => {}));
    } catch (_) {
      // SW registration failed (e.g. file:// or older browser) — site still works.
    }

    // When the new SW takes control, the page is using a stale shell. Reload once.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

function showUpdateBanner(waitingWorker) {
  if (document.getElementById('pwa-update-banner')) return;

  const label = (() => {
    try {
      return {
        message: t('pwa.updateAvailable'),
        button: t('pwa.reload'),
      };
    } catch {
      // i18n not initialised yet — fall back to Spanish (the app default).
      return {
        message: 'Nueva versión disponible',
        button: 'Recargar',
      };
    }
  })();

  const bar = document.createElement('div');
  bar.id = 'pwa-update-banner';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `
    <span class="pwa-update-msg">${label.message}</span>
    <button type="button" class="pwa-update-btn">${label.button}</button>
  `;
  document.body.appendChild(bar);

  bar.querySelector('.pwa-update-btn').addEventListener('click', () => {
    bar.classList.add('pwa-update-loading');
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    // controllerchange listener (above) will reload the page once the new SW activates.
  });
}
