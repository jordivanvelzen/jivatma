import { api } from '../../lib/api.js';

const CHANNEL_LABELS = { sms: '📱 SMS', telegram: '✈️ Telegram' };
const EVENT_LABELS = {
  pass_request:    'Solicitud de pase',
  pass_approved:   'Pase aprobado',
  pass_declined:   'Pase rechazado',
  expiry_reminder: 'Aviso vencimiento',
  low_classes:     'Pocas clases',
  stale_unpaid:    'Cobros pendientes',
  test:            'Prueba',
  unknown:         'Desconocido',
};
const STATUS_CLASS = {
  sent:               'badge-active',
  failed:             'badge-expired',
  opted_out:          'badge-pending',
  not_configured:     'badge-pending',
  test_phone_not_set: 'badge-pending',
  invalid_phone:      'badge-pending',
  skipped:            'badge-pending',
};

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(s) {
  const map = {
    sent: 'Enviado', failed: 'Error', opted_out: 'No opt-in',
    not_configured: 'Sin config', test_phone_not_set: 'Sin tel prueba',
    invalid_phone: 'Tel inválido', skipped: 'Omitido',
  };
  return map[s] || s;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCard(r) {
  const statusBadge = `<span class="badge ${STATUS_CLASS[r.status] || 'badge-pending'}">${statusLabel(r.status)}</span>`;
  const testBadge   = r.test_mode ? `<span class="badge" style="background:var(--amber-bg);color:var(--orange)">TEST</span>` : '';
  const errorRow    = r.error_detail
    ? `<div class="notif-card__error">${escHtml(r.error_detail)}</div>` : '';
  const preview     = r.message_preview
    ? `<details class="notif-card__preview"><summary>Ver mensaje</summary><pre>${escHtml(r.message_preview)}</pre></details>` : '';
  const phone       = r.recipient_phone
    ? `<span class="notif-card__phone">${escHtml(r.recipient_phone)}</span>` : '';

  return `
    <div class="notif-card ${r.status === 'failed' ? 'notif-card--failed' : ''}">
      <div class="notif-card__top">
        <span class="notif-card__channel">${CHANNEL_LABELS[r.channel] || r.channel}${testBadge}</span>
        <span class="notif-card__date">${fmtDate(r.created_at)}</span>
      </div>
      <div class="notif-card__mid">
        <span class="notif-card__event">${EVENT_LABELS[r.event_type] || r.event_type}</span>
        <div class="notif-card__recipient">${escHtml(r.recipient_name || '—')}${phone}</div>
      </div>
      <div class="notif-card__bot">
        ${statusBadge}
        ${errorRow}
        ${preview}
      </div>
    </div>`;
}

export async function renderAdminNotifications() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="page"><h2>Notificaciones enviadas</h2><div class="page-loading"><span class="spinner"></span></div></div>`;

  let channel = '';
  let event_type = '';
  let offset = 0;
  const limit = 50;
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
      app.innerHTML = `<div class="page"><h2>Notificaciones enviadas</h2><p class="muted">Error al cargar el historial.</p></div>`;
      return;
    }

    const channelOpts = ['', 'sms', 'telegram'].map(v =>
      `<option value="${v}" ${channel === v ? 'selected' : ''}>${v ? CHANNEL_LABELS[v] : 'Todos los canales'}</option>`
    ).join('');
    const eventOpts = ['', ...Object.keys(EVENT_LABELS)].map(v =>
      `<option value="${v}" ${event_type === v ? 'selected' : ''}>${v ? EVENT_LABELS[v] : 'Todos los eventos'}</option>`
    ).join('');

    const hasPrev = offset > 0;
    const hasNext = offset + limit < total;
    const from    = total === 0 ? 0 : offset + 1;
    const to      = Math.min(offset + limit, total);

    const cardsHtml = rows.length === 0
      ? `<p class="muted" style="text-align:center;padding:var(--s-8) 0">Sin registros</p>`
      : rows.map(renderCard).join('');

    app.innerHTML = `
      <div class="page">
        <h2>Notificaciones enviadas</h2>

        <div class="notif-filters">
          <select id="filter-channel" class="input">
            ${channelOpts}
          </select>
          <select id="filter-event" class="input">
            ${eventOpts}
          </select>
        </div>

        <p class="muted" style="font-size:0.85rem;margin-bottom:var(--s-3)">
          ${total === 0 ? 'Sin resultados' : `Mostrando ${from}–${to} de ${total}`}
        </p>

        <div class="notif-list">${cardsHtml}</div>

        <div class="notif-pagination">
          <button id="btn-prev" class="btn btn-secondary" ${hasPrev ? '' : 'disabled'}>← Anterior</button>
          <button id="btn-next" class="btn btn-secondary" ${hasNext ? '' : 'disabled'}>Siguiente →</button>
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
