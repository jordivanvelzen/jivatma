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
      // updateViaCache: 'none' forces the browser to bypass HTTP cache for /sw.js itself
      // when checking for updates. Without this, a cached sw.js can hide a fresh deploy
      // for up to 24h depending on Cache-Control headers from the CDN.
      const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

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

// iOS Safari "Add to Home Screen" nudge — fires after app is loaded and
// user is authenticated (i.e. not on the login/register screen).
function isIosSafari() {
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) &&
    /safari/i.test(ua) &&
    !/crios|fxios|opios|chromium/i.test(ua) &&
    window.navigator.standalone !== true
  );
}

export function maybeShowIosInstallNudge() {
  if (!isIosSafari()) return;
  if (localStorage.getItem('jivatma_ios_nudge_dismissed')) return;
  if (document.getElementById('pwa-ios-nudge')) return;

  const label = (() => {
    try {
      return {
        prefix: t('pwa.iosInstall'),
        suffix: t('pwa.iosInstallSuffix'),
        dismiss: t('pwa.iosDismiss'),
      };
    } catch {
      return {
        prefix: 'Instala la app: toca',
        suffix: 'y elige «Agregar a inicio»',
        dismiss: 'No, gracias',
      };
    }
  })();

  // iOS share icon SVG (matches the actual Safari share button shape)
  const shareIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;vertical-align:middle">
    <path d="M8 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>`;

  const bar = document.createElement('div');
  bar.id = 'pwa-ios-nudge';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `
    <span class="pwa-ios-msg">${label.prefix} ${shareIcon} ${label.suffix}</span>
    <button type="button" class="pwa-ios-dismiss">${label.dismiss}</button>
  `;
  document.body.appendChild(bar);

  bar.querySelector('.pwa-ios-dismiss').addEventListener('click', () => {
    localStorage.setItem('jivatma_ios_nudge_dismissed', '1');
    bar.classList.add('pwa-ios-hiding');
    bar.addEventListener('animationend', () => bar.remove(), { once: true });
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
