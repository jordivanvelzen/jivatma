let timeout;

export function showToast(message, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast ${type}`;

  clearTimeout(timeout);
  timeout = setTimeout(() => {
    el.className = 'toast hidden';
  }, 3000);
}
