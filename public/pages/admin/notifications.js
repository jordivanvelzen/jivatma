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
  sent:              'badge-active',
  failed:            'badge-expired',
  opted_out:         'badge-pending',
  not_configured:    'badge-pending',
  test_phone_not_set:'badge-pending',
  invalid_phone:     'badge-pending',
  skipped:           'badge-pending',
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
    invalid_phone: 'Tel inválido', skipped: 'Omitido', unknown: s,
  };
  return map[s] || s;
}

export async function renderAdminNotifications() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="page"><h2>Notificaciones enviadas</h2><div class="page-loading"><span class="spinner"></span></div></div>`;

  // State
  let channel = '';
  let event_type = '';
  let offset = 0;
  const limit = 50;
  let total = 0;

  async function load() {
    const params = new URLSearchParams({ limit, offset });
    if (channel)    params.set('channel',    channel);
    if (event_type) params.set('event_type', event_type);

    try {
      const data = await api(`/api/admin/notifications?${params}`);
      total = data.total ?? 0;
      return data.rows || [];
    } catch (err) {
      total = 0;
      return null; // signal error
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

    const tableRows = rows.length === 0
      ? `<tr><td colspan="6" style="text-align:center;color:var(--ink-400);padding:var(--s-6)">Sin registros</td></tr>`
      : rows.map(r => {
          const statusBadge = `<span class="badge ${STATUS_CLASS[r.status] || 'badge-pending'}">${statusLabel(r.status)}</span>`;
          const testBadge   = r.test_mode ? `<span class="badge" style="background:var(--amber-bg);color:var(--orange);margin-left:4px">TEST</span>` : '';
          const preview     = r.message_preview
            ? `<details><summary style="cursor:pointer;color:var(--ink-500);font-size:0.8rem">Ver mensaje</summary><pre style="margin-top:4px;white-space:pre-wrap;font-size:0.75rem;color:var(--ink-700)">${escHtml(r.message_preview)}</pre></details>`
            : '—';
          return `
            <tr>
              <td style="white-space:nowrap;font-size:0.8rem">${fmtDate(r.created_at)}</td>
              <td>${CHANNEL_LABELS[r.channel] || r.channel}${testBadge}</td>
              <td>${EVENT_LABELS[r.event_type] || r.event_type}</td>
              <td>${escHtml(r.recipient_name || '—')}${r.recipient_phone ? `<br><span style="font-size:0.75rem;color:var(--ink-400)">${escHtml(r.recipient_phone)}</span>` : ''}</td>
              <td>${statusBadge}${r.error_detail ? `<br><span style="font-size:0.72rem;color:var(--red)">${escHtml(r.error_detail)}</span>` : ''}</td>
              <td>${preview}</td>
            </tr>`;
        }).join('');

    const hasPrev = offset > 0;
    const hasNext = offset + limit < total;
    const from = total === 0 ? 0 : offset + 1;
    const to   = Math.min(offset + limit, total);

    app.innerHTML = `
      <div class="page">
        <h2>Notificaciones enviadas</h2>

        <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;margin-bottom:var(--s-4)">
          <select id="filter-channel" class="input" style="width:auto">
            ${channelOpts}
          </select>
          <select id="filter-event" class="input" style="width:auto">
            ${eventOpts}
          </select>
        </div>

        <p class="muted" style="font-size:0.85rem;margin-bottom:var(--s-3)">
          ${total === 0 ? 'Sin resultados' : `Mostrando ${from}–${to} de ${total}`}
        </p>

        <div style="overflow-x:auto">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Canal</th>
                <th>Evento</th>
                <th>Destinatario</th>
                <th>Estado</th>
                <th>Mensaje</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>

        <div style="display:flex;gap:var(--s-2);margin-top:var(--s-4);align-items:center">
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
      offset = offset + limit; render();
    });
  }

  await render();
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
