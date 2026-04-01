import { sb } from '../../lib/supabase.js';
import { showToast } from '../../components/toast.js';
import { t } from '../../lib/i18n.js';

export async function renderAdminPassTypes() {
  const app = document.getElementById('app');

  const { data: passTypes } = await sb
    .from('pass_types')
    .select('*')
    .order('kind');

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.passTypes')}</h2>

      <table class="table">
        <thead><tr><th>${t('admin.kind')}</th><th>${t('admin.classes')}</th><th>${t('admin.validDays')}</th><th>${t('admin.price')}</th><th>${t('admin.activeCol')}</th><th></th></tr></thead>
        <tbody>
          ${(passTypes || []).map(pt => `
            <tr>
              <td>${pt.kind === 'single' ? t('passes.singleClass') : pt.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count }) : t('passes.unlimited')}</td>
              <td>${pt.class_count ?? '\u221E'}</td>
              <td>${pt.validity_days}</td>
              <td>$${parseFloat(pt.price).toFixed(2)}</td>
              <td>${pt.is_active ? '\u2713' : '\u2717'}</td>
              <td>
                <button class="btn btn-small toggle-active" data-id="${pt.id}" data-active="${pt.is_active}">
                  ${pt.is_active ? t('admin.deactivate') : t('admin.activate')}
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h3>${t('admin.addPassType')}</h3>
      <form id="add-pass-form" class="form">
        <div class="form-row">
          <label>${t('admin.kind')}
            <select id="pt-kind" required>
              <option value="single">${t('passes.singleClass')}</option>
              <option value="multi">${t('passes.multiClass', { n: '' })}</option>
              <option value="unlimited">${t('passes.unlimited')}</option>
            </select>
          </label>
          <label>${t('admin.classes')}
            <input type="number" id="pt-count" placeholder="e.g. 10" min="1" />
          </label>
        </div>
        <div class="form-row">
          <label>${t('admin.validDays')}
            <input type="number" id="pt-days" required min="1" value="30" />
          </label>
          <label>${t('admin.price')} ($)
            <input type="number" id="pt-price" required min="0" step="0.01" />
          </label>
        </div>
        <button type="submit" class="btn btn-primary">${t('admin.add')}</button>
      </form>
    </div>
  `;

  // Kind change -> auto-fill defaults
  document.getElementById('pt-kind').addEventListener('change', (e) => {
    const kind = e.target.value;
    const countInput = document.getElementById('pt-count');
    const daysInput = document.getElementById('pt-days');

    if (kind === 'single') { countInput.value = 1; daysInput.value = 1; }
    else if (kind === 'multi') { countInput.value = 10; daysInput.value = 90; }
    else { countInput.value = ''; daysInput.value = 30; }
  });

  // Toggle active
  app.querySelectorAll('.toggle-active').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      const currentlyActive = btn.dataset.active === 'true';
      const { error } = await sb.from('pass_types').update({ is_active: !currentlyActive }).eq('id', id);
      if (error) { showToast(error.message, 'error'); return; }
      renderAdminPassTypes();
    });
  });

  // Add pass type
  document.getElementById('add-pass-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const kind = document.getElementById('pt-kind').value;
    const classCount = document.getElementById('pt-count').value ? parseInt(document.getElementById('pt-count').value, 10) : null;
    const validityDays = parseInt(document.getElementById('pt-days').value, 10);
    const price = parseFloat(document.getElementById('pt-price').value);

    const { error } = await sb.from('pass_types').insert({
      kind, class_count: classCount, validity_days: validityDays, price,
    });

    if (error) { showToast(error.message, 'error'); return; }
    showToast(t('admin.passTypeAdded'), 'success');
    renderAdminPassTypes();
  });
}
