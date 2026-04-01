import { sb, getSession } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { renderPassCard } from '../components/pass-card.js';
import { showToast } from '../components/toast.js';
import { t, getLocale } from '../lib/i18n.js';

export async function renderMyPasses() {
  const app = document.getElementById('app');
  const session = await getSession();
  const userId = session.user.id;
  const today = new Date().toISOString().split('T')[0];

  // Fetch user passes and available pass types in parallel
  const [passesRes, typesRes] = await Promise.all([
    sb.from('user_passes').select('*, pass_types(*)').eq('user_id', userId).order('created_at', { ascending: false }),
    sb.from('pass_types').select('*').eq('is_active', true).order('kind'),
  ]);

  const passes = passesRes.data || [];
  const passTypes = typesRes.data || [];

  // Check if user has an active pass (any kind)
  const hasActivePass = passes.some(p =>
    new Date(p.expires_at) >= new Date(today) &&
    (p.classes_remaining === null || p.classes_remaining > 0)
  );

  // Check if user already has an active unpaid single pass
  const hasUnpaidSingle = passes.some(p =>
    p.pass_types?.kind === 'single' &&
    !p.is_paid &&
    new Date(p.expires_at) >= new Date(today) &&
    p.classes_remaining > 0
  );

  // Render available pass types section
  const availableHtml = passTypes.map(pt => {
    const priceStr = `€${Number(pt.price).toFixed(0)}`;
    const kindLabel = pt.kind === 'single' ? t('passes.singleClass')
      : pt.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
      : t('passes.unlimited');
    const validityStr = t('passes.validFor', { days: pt.validity_days });

    if (pt.kind === 'single') {
      const alreadySelected = hasUnpaidSingle;
      return `
        <div class="pass-type-card">
          <div class="pass-type-info">
            <div class="pass-kind">${kindLabel}</div>
            <div class="pass-type-detail">${priceStr} · ${validityStr}</div>
            <div class="pass-type-note">${t('passes.singleNote')}</div>
          </div>
          <button class="btn btn-primary btn-select-single ${alreadySelected ? 'disabled' : ''}"
                  data-type-id="${pt.id}" ${alreadySelected ? 'disabled' : ''}>
            ${alreadySelected ? t('passes.alreadySelected') : t('passes.selectSingle')}
          </button>
        </div>
      `;
    }

    return `
      <div class="pass-type-card">
        <div class="pass-type-info">
          <div class="pass-kind">${kindLabel}</div>
          <div class="pass-type-detail">${priceStr} · ${validityStr}</div>
        </div>
        <span class="pass-type-contact">${t('passes.contactInstructor')}</span>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="page">
      <h2>${t('passes.title')}</h2>

      ${passes.length
        ? `<div class="section-label">${t('passes.yourPasses')}</div>
           ${passes.map(p => renderPassCard(p, p.pass_types)).join('')}`
        : `<p class="muted">${t('passes.noPasses')}</p>`
      }

      ${passTypes.length ? `
        <div class="section-label" style="margin-top:1.5rem">${t('passes.availableTypes')}</div>
        <div class="pass-types-list">${availableHtml}</div>
      ` : ''}
    </div>
  `;

  // Handle single pass selection
  app.querySelectorAll('.btn-select-single:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '...';
      const passTypeId = parseInt(btn.dataset.typeId, 10);

      try {
        await api('/api/me/select-pass', {
          method: 'POST',
          body: JSON.stringify({ pass_type_id: passTypeId }),
        });

        showToast(t('passes.singleSelected'), 'success');
        renderMyPasses();
      } catch (err) {
        const msg = err.message.includes('already_has_single_pass')
          ? t('passes.alreadyHasSingle')
          : err.message;
        showToast(msg, 'error');
        renderMyPasses();
      }
    });
  });
}
