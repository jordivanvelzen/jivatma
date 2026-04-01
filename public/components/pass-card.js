import { t, getLocale } from '../lib/i18n.js';

export function renderPassCard(pass, passType) {
  const isExpired = new Date(pass.expires_at) < new Date();
  const isUsedUp = passType.kind !== 'unlimited' && pass.classes_remaining <= 0;
  const status = isExpired ? 'expired' : isUsedUp ? 'used-up' : 'active';

  const kindLabel = passType.kind === 'single' ? t('passes.singleClass')
    : passType.kind === 'multi' ? t('passes.multiClass', { n: passType.class_count })
    : t('passes.unlimited');

  const dateStr = new Date(pass.expires_at).toLocaleDateString(getLocale(), {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  let detail = '';
  if (passType.kind === 'unlimited') {
    detail = t('passes.expires', { date: dateStr });
  } else {
    detail = t('passes.classesLeft', { remaining: pass.classes_remaining, total: passType.class_count })
      + ' · ' + t('passes.expires', { date: dateStr });
  }

  const statusLabel = status === 'active' ? t('passes.active')
    : status === 'expired' ? t('passes.expired')
    : t('passes.usedUp');

  return `
    <div class="pass-card pass-${status}">
      <div class="pass-kind">${kindLabel}</div>
      <div class="pass-detail">${detail}</div>
      <span class="pass-badge">${statusLabel}</span>
    </div>
  `;
}
