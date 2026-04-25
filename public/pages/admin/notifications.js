import { api } from '../../lib/api.js';

const CHANNEL_META = {
  sms:      { label: 'SMS',      glyph: '📱' },
  telegram: { label: 'Telegram', glyph: '✈️' },
};

const EVENT_LABELS = {
  pass_request:     'Solicitud de pase',
  pass_approved:    'Pase aprobado',
  pass_declined:    'Pase rechazado',
  expiry_reminder:  'Aviso vencimiento',
  low_classes:      'Pocas clases',
  stale_unpaid:     'Cobros pendientes',
  class_cancelled:  'Clase cancelada',
  new_signup:       'Nuevo registro',
  test:             'Prueba',
  unknown:          'Desconocido',
};

function eventLabel(t) {
  if (!t) return 'Desconocido';
  if (t.startsWith('cc:')) return `CC · ${EVENT_LABELS[t.slice(3)] || t.slice(3)}`;
  return EVENT_LABELS[t] || t;
}

const STATUS_META = {
  sent:               { label: 'Enviado',         tone: 'ok'      },
  failed:             { label: 'Error',           tone: 'err'     },
  opted_out:          { label: 'No opt-in',       tone: 'warn'    },
  not_configured:     { label: 'Sin config',      tone: 'warn'    },
  test_phone_not_set: { label: 'Sin tel prueba',  tone: 'warn'    },
  invalid_phone:      { label: 'Tel inválido',    tone: 'err'     },
  skipped:            { label: 'Omitido',         tone: 'neutral' },
};

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
  // Try JSON first.
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
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} d`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function fullDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function renderCard(r) {
  const ch     = CHANNEL_META[r.channel] || { label: r.channel, glyph: '•' };
  const status = STATUS_META[r.status]   || { label: r.status,  tone: 'neutral' };
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
    detailsParts.push(`<div class="ncard__det-label">Mensaje</div><pre class="ncard__pre">${escHtml(r.message_preview)}</pre>`);
  }
  if (err && err.raw && err.raw !== err.short) {
    detailsParts.push(`<div class="ncard__det-label">Error completo</div><pre class="ncard__pre ncard__pre--err">${escHtml(err.raw)}</pre>`);
  }
  detailsParts.push(`<div class="ncard__det-label">Fecha exacta</div><div class="ncard__det-text">${escHtml(fullDate(r.created_at))}</div>`);

  const details = detailsParts.length
    ? `<details class="ncard__details">
         <summary>Detalles</summary>
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
  app.innerHTML = `<div class="page"><h2>Notificaciones</h2><div class="page-loading"><span class="spinner"></span></div></div>`;

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
      app.innerHTML = `<div class="page"><h2>Notificaciones</h2><p class="muted">Error al cargar el historial.</p></div>`;
      return;
    }

    const channelOpts = ['', 'sms', 'telegram'].map(v =>
      `<option value="${v}" ${channel === v ? 'selected' : ''}>${v ? `${CHANNEL_META[v].glyph} ${CHANNEL_META[v].label}` : 'Todos los canales'}</option>`
    ).join('');
    const eventOpts = ['', ...Object.keys(EVENT_LABELS)].map(v =>
      `<option value="${v}" ${event_type === v ? 'selected' : ''}>${v ? EVENT_LABELS[v] : 'Todos los eventos'}</option>`
    ).join('');

    const hasPrev = offset > 0;
    const hasNext = offset + limit < total;
    const from    = total === 0 ? 0 : offset + 1;
    const to      = Math.min(offset + limit, total);

    const cardsHtml = rows.length === 0
      ? `<div class="ncard-empty">Sin registros</div>`
      : rows.map(renderCard).join('');

    app.innerHTML = `
      <div class="page nlog-page">
        <div class="nlog-header">
          <h2>Notificaciones</h2>
          <div class="nlog-count">${total === 0 ? 'Sin resultados' : `${from}–${to} de ${total}`}</div>
        </div>

        <div class="nlog-filters">
          <select id="filter-channel" class="input">${channelOpts}</select>
          <select id="filter-event"   class="input">${eventOpts}</select>
        </div>

        <div class="nlog-list">${cardsHtml}</div>

        <div class="nlog-pagination">
          <button id="btn-prev" class="btn btn-secondary btn-small" ${hasPrev ? '' : 'disabled'}>← Anterior</button>
          <button id="btn-next" class="btn btn-secondary btn-small" ${hasNext ? '' : 'disabled'}>Siguiente →</button>
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
