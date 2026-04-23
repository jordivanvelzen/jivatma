import { t, getLocale } from '../lib/i18n.js';
import { parseLocalDate, formatDbDate, todayStr } from '../lib/dates.js';

export function renderPassCard(pass, passType) {
  const isExpired = parseLocalDate(pass.expires_at) < parseLocalDate(todayStr());
  const isUsedUp = passType.kind !== 'unlimited' && pass.classes_remaining <= 0;
  const status = isExpired ? 'expired' : isUsedUp ? 'used-up' : 'active';

  const kindLabel = passType.kind === 'single' ? t('passes.singleClass')
    : passType.kind === 'multi' ? t('passes.multiClass', { n: passType.class_count })
    : t('passes.unlimited');

  const dateStr = formatDbDate(pass.expires_at, getLocale(), {
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

  const unpaidLabel = (!pass.is_paid && status === 'active')
    ? `<span class="pass-badge pass-badge-unpaid">${t('passes.payAtClass')}</span>`
    : '';

  return `
    <div class="pass-card pass-${status}">
      <div class="pass-kind">${kindLabel}</div>
      <div class="pass-detail">${detail}</div>
      <div class="pass-badges">
        <span class="pass-badge">${statusLabel}</span>
        ${unpaidLabel}
      </div>
    </div>
  `;
}
