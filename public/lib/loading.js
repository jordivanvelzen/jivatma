// Small helper for showing a loading state on buttons during async work.
// Disables the button, swaps its label with a spinner + original label,
// and restores everything in `finally`. Safe to call when the page
// re-renders during the async (the button is no longer connected).

export async function withLoading(btn, fn) {
  if (!btn) return fn();
  if (btn.classList.contains('btn-loading')) return; // already in flight
  const originalHTML = btn.innerHTML;
  const wasDisabled = btn.disabled;
  btn.disabled = true;
  btn.classList.add('btn-loading');
  btn.innerHTML = `<span class="spinner" aria-hidden="true"></span><span class="btn-loading-label">${originalHTML}</span>`;
  try {
    return await fn();
  } finally {
    if (btn.isConnected) {
      btn.classList.remove('btn-loading');
      btn.innerHTML = originalHTML;
      btn.disabled = wasDisabled;
    }
  }
}

// Convenience: wrap a form submit so the submit button shows the loading state.
export function onSubmitWithLoading(form, fn) {
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    await withLoading(btn, () => fn(e));
  });
}
