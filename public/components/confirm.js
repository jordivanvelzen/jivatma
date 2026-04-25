import { t } from '../lib/i18n.js';

let mounted = false;

function ensureStyles() {
  if (document.getElementById('confirm-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'confirm-modal-styles';
  style.textContent = `
    .confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(31, 42, 38, 0.55);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--s-4);
      z-index: 1000;
      opacity: 0;
      transition: opacity var(--t-fast) var(--ease);
    }
    .confirm-overlay.is-open { opacity: 1; }
    .confirm-modal {
      background: #fff;
      border-radius: var(--r-lg);
      box-shadow: 0 20px 60px rgba(0,0,0,.25), var(--sh-3, 0 4px 16px rgba(0,0,0,.12));
      width: 100%;
      max-width: 380px;
      padding: var(--s-5);
      display: flex;
      flex-direction: column;
      gap: var(--s-3);
      transform: translateY(8px) scale(.98);
      transition: transform var(--t-med) var(--ease);
    }
    .confirm-overlay.is-open .confirm-modal { transform: translateY(0) scale(1); }
    .confirm-icon {
      width: 48px; height: 48px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem;
      background: var(--green-50, #eef3ee);
      color: var(--green-700);
      flex-shrink: 0;
    }
    .confirm-icon.is-danger {
      background: #fdecec;
      color: #c93535;
    }
    .confirm-icon.is-warning {
      background: #fff4e0;
      color: #b56a07;
    }
    .confirm-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--ink-900);
      line-height: 1.3;
    }
    .confirm-message {
      margin: 0;
      font-size: .95rem;
      color: var(--ink-700);
      line-height: 1.5;
    }
    .confirm-actions {
      display: flex;
      gap: var(--s-2);
      justify-content: flex-end;
      flex-wrap: wrap;
      margin-top: var(--s-2);
    }
    .confirm-actions .btn {
      min-width: 100px;
    }
    @media (max-width: 380px) {
      .confirm-actions { flex-direction: column-reverse; }
      .confirm-actions .btn { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

export function showConfirm({
  title,
  message,
  confirmText,
  cancelText,
  variant = 'default',
  icon,
} = {}) {
  ensureStyles();
  if (mounted) return Promise.resolve(false);
  mounted = true;

  const t_title = title ?? t('confirm.defaultTitle');
  const t_confirm = confirmText ?? t('general.confirm');
  const t_cancel = cancelText ?? t('general.cancel');
  const iconChar = icon ?? (variant === 'danger' ? '⚠' : variant === 'warning' ? '!' : '?');
  const confirmClass = variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary';

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="confirm-modal">
        <div style="display:flex; align-items:flex-start; gap: var(--s-3);">
          <div class="confirm-icon ${variant === 'danger' ? 'is-danger' : variant === 'warning' ? 'is-warning' : ''}">${iconChar}</div>
          <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap: var(--s-2);">
            <h3 class="confirm-title">${t_title}</h3>
            ${message ? `<p class="confirm-message">${message}</p>` : ''}
          </div>
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn btn-secondary" data-act="cancel">${t_cancel}</button>
          <button type="button" class="${confirmClass}" data-act="confirm">${t_confirm}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    const close = (result) => {
      overlay.classList.remove('is-open');
      setTimeout(() => {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        mounted = false;
        resolve(result);
      }, 160);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter') close(true);
    };
    document.addEventListener('keydown', onKey);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      close(btn.dataset.act === 'confirm');
    });

    setTimeout(() => overlay.querySelector('[data-act="confirm"]')?.focus(), 50);
  });
}
