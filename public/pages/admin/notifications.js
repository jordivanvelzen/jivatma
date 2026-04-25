import { api } from '../../lib/api.js';
import { t, getLocale } from '../../lib/i18n.js';

const CHANNEL_META = {
  sms:      { label: 'SMS',      glyph: '📱' },
  telegram: { label: 'Telegram', glyph: '✈️' },
};

const EVENT_KEYS = {
  pass_request:     'notifications.event.pass_request',
  pass_approved:    'notifications.event.pass_approved',
  pass_declined:    'notifications.event.pass_declined',
  expiry_reminder:  'notifications.event.expiry_reminder',
  low_classes:      'notifications.event.low_classes',
  stale_unpaid:     'notifications.event.stale_unpaid',
  class_cancelled:  'notifications.event.class_cancelled',
  new_signup:       'notifications.event.new_signup',
  test:             'notifications.event.test',
  unknown:          'notifications.event.unknown',
};

function eventLabel(type) {
  if (!type) return t('notifications.event.unknown');
  if (type.startsWith('cc:')) return `CC · ${t(EVENT_KEYS[type.slice(3)] || 'notifications.event.unknown')}`;
  return t(EVENT_KEYS[type] || 'notifications.event.unknown');
}

const STATUS_TONE = {
  sent:               'ok',
  failed:             'err',
  opted_out:          'warn',
  not_configured:     'warn',
  test_phone_not_set: 'warn',
  invalid_phone:      'err',
  skipped:            'neutral',
};

const STATUS_KEYS = {
  sent:               'notifications.status.sent',
  failed:             'notifications.status.failed',
  opted_out:          'notifications.status.opted_out',
  not_configured:     'notifications.status.not_configured',
  test_phone_not_set: 'notifications.status.test_phone_not_set',
  invalid_phone:      'notifications.status.invalid_phone',
  skipped:            'notifications.status.skipped',
};

function statusMeta(status) {
  return {
    label: t(STATUS_KEYS[status] || status),
    tone:  STATUS_TONE[status] || 'neutral',
  };
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Turn raw error_detail (often Twilio JSON) into a short human line + full raw.
function parseError(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  try {
    const j = JSON.parse(s);
    const msg = j.message || j.error || j.description || s;
    const code = j.code ? ` (${j.code})` : '';
    return { short: `${msg}${code}`.slice(0, 140), raw: s };
  } catch {
    return { short: s.slice(0, 140), raw: s };
  }
}

function relTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return t('notifications.timeNow');
  if (min < 60) return t('notifications.timeMinutes', { n: min });
  const hrs = Math.round(min / 60);
  if (hrs < 24) return t('notifications.timeHours', { n: hrs });
  const days = Math.round(hrs / 24);
  if (days === 1) return t('notifications.timeYesterday');
  if (days < 7) return t('notifications.timeDays', { n: days });
  return d.toLocaleDateString(getLocale(), { day: '2-digit', month: 'short' });
}

function fullDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(getLocale(), { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}

function renderCard(r) {
  const ch     = CHANNEL_META[r.channel] || { label: r.channel, glyph: '•' };
  const status = statusMeta(r.status);
  const err    = parseError(r.error_detail);
  const isFailed = status.tone === 'err';

  const phoneLine = r.recipient_phone
    ? `<div class="ncard__phone">${escHtml(r.recipient_phone)}</div>`
    : '';

  const testBadge = r.test_mode
    ? `<span class="ncard__test">TEST</span>` : '';

  const errLine = err
    ? `<div class="ncard__err">⚠ ${escHtml(err.short)}</div>` : '';

  const detailsParts = [];
  if (r.message_preview) {
    detailsParts.push(`<div class="ncard__det-label">${t('notifications.message')}</div><pre class="ncard__pre">${escHtml(r.message_preview)}</pre>`);
  }
  if (err && err.raw && err.raw !== err.short) {
    detailsParts.push(`<div class="ncard__det-label">${t('notifications.fullError')}</div><pre class="ncard__pre ncard__pre--err">${escHtml(err.raw)}</pre>`);
  }
  detailsParts.push(`<div class="ncard__det-label">${t('notifications.exactDate')}</div><div class="ncard__det-text">${escHtml(fullDate(r.created_at))}</div>`);

  const details = detailsParts.length
    ? `<details class="ncard__details">
         <summary>${t('notifications.details')}</summary>
         <div class="ncard__det-body">${detailsParts.join('')}</div>
       </details>` : '';

  return `
    <article class="ncard ncard--${status.tone}${isFailed ? ' ncard--failed' : ''}">
      <div class="ncard__icon" aria-hidden="true">${ch.glyph}</div>
      <div class="ncard__body">
        <div class="ncard__head">
          <span class="ncard__event">${escHtml(eventLabel(r.event_type))}</span>
          <span class="ncard__status ncard__status--${status.tone}">${escHtml(status.label)}</span>
        </div>
        <div class="ncard__recipient">${escHtml(r.recipient_name || '—')}</div>
        ${phoneLine}
        <div class="ncard__meta">
          <span class="ncard__time" title="${escHtml(fullDate(r.created_at))}">${escHtml(relTime(r.created_at))}</span>
          <span class="ncard__sep">·</span>
          <span class="ncard__channel">${escHtml(ch.label)}</span>
          ${testBadge ? `<span class="ncard__sep">·</span>${testBadge}` : ''}
        </div>
        ${errLine}
        ${details}
      </div>
    </article>`;
}

export async function renderAdminNotifications() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="page"><h2>${t('notifications.title')}</h2><div class="page-loading"><span class="spinner"></span></div></div>`;

  let channel = '';
  let event_type = '';
  let offset = 0;
  const limit = 25;
  let total = 0;

  async function load() {
    const params = new URLSearchParams({ type: 'notifications', limit, offset });
    if (channel)    params.set('channel',    channel);
    if (event_type) params.set('event_type', event_type);
    try {
      const data = await api(`/api/admin/settings?${params}`);
      total = data.total ?? 0;
      return data.rows || [];
    } catch {
      total = 0;
      return null;
    }
  }

  async function render() {
    const rows = await load();
    if (rows === null) {
      app.innerHTML = `<div class="page"><h2>${t('notifications.title')}</h2><p class="muted">${t('notifications.loadError')}</p></div>`;
      return;
    }

    const channelOpts = ['', 'sms', 'telegram'].map(v =>
      `<option value="${v}" ${channel === v ? 'selected' : ''}>${v ? `${CHANNEL_META[v].glyph} ${CHANNEL_META[v].label}` : t('notifications.allChannels')}</option>`
    ).join('');
    const eventOpts = ['', ...Object.keys(EVENT_KEYS)].map(v =>
      `<option value="${v}" ${event_type === v ? 'selected' : ''}>${v ? eventLabel(v) : t('notifications.allEvents')}</option>`
    ).join('');

    const hasPrev = offset > 0;
    const hasNext = offset + limit < total;
    const from    = total === 0 ? 0 : offset + 1;
    const to      = Math.min(offset + limit, total);

    const cardsHtml = rows.length === 0
      ? `<div class="ncard-empty">${t('notifications.noRecords')}</div>`
      : rows.map(renderCard).join('');

    const countLabel = total === 0
      ? t('notifications.noResults')
      : t('notifications.countRange', { from, to, total });

    app.innerHTML = `
      <div class="page nlog-page">
        <div class="nlog-header">
          <h2>${t('notifications.title')}</h2>
          <div class="nlog-count">${countLabel}</div>
        </div>

        <div class="nlog-filters">
          <select id="filter-channel" class="input">${channelOpts}</select>
          <select id="filter-event"   class="input">${eventOpts}</select>
        </div>

        <div class="nlog-list">${cardsHtml}</div>

        <div class="nlog-pagination">
          <button id="btn-prev" class="btn btn-secondary btn-small" ${hasPrev ? '' : 'disabled'}>${t('notifications.prev')}</button>
          <button id="btn-next" class="btn btn-secondary btn-small" ${hasNext ? '' : 'disabled'}>${t('notifications.next')}</button>
        </div>
      </div>
    `;

    document.getElementById('filter-channel').addEventListener('change', e => {
      channel = e.target.value; offset = 0; render();
    });
    document.getElementById('filter-event').addEventListener('change', e => {
      event_type = e.target.value; offset = 0; render();
    });
    document.getElementById('btn-prev')?.addEventListener('click', () => {
      offset = Math.max(0, offset - limit); render();
    });
    document.getElementById('btn-next')?.addEventListener('click', () => {
      offset += limit; render();
    });
  }

  await render();
}
