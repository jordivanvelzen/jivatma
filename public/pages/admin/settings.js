import { sb } from '../../lib/supabase.js';
import { showToast } from '../../components/toast.js';
import { t } from '../../lib/i18n.js';
import { withLoading } from '../../lib/loading.js';

const WA_DEFAULTS = {
  wa_template_approved:
    'Hola {name}, ¡tu pase de *{kind}* ya está aprobado! Nos vemos pronto en Jivatma. 🧘',
  wa_template_declined:
    'Hola {name}, tu solicitud de pase en Jivatma no fue aprobada. Motivo: {reason}. Si tienes preguntas, escríbenos. 🙏',
  wa_template_expiring:
    'Hola {name}, tu pase de {kind} en Jivatma vence hoy. ¡Renuévalo antes de tu próxima clase! 🧘',
  wa_template_last_class:
    'Hola {name}, acabas de usar tu última clase del {kind} en Jivatma. ¡Renueva tu pase para seguir reservando! 🧘',
};

export async function renderAdminSettings() {
  const app = document.getElementById('app');
  const { data: allSettings } = await sb.from('settings').select('*');
  const settings = {};
  (allSettings || []).forEach(s => { settings[s.key] = s.value; });

  const recipient = (settings.test_mode || 'true') === 'true' ? 'jordi' : 'claudia';
  const tplVal = (k) => (settings[k] && settings[k].length ? settings[k] : WA_DEFAULTS[k]);

  app.innerHTML = `
    <style>
      .set-section { margin-bottom: var(--s-3); border:1px solid var(--ink-100); border-radius: var(--r-md); background:#fff; }
      .set-section[open] { box-shadow: var(--sh-1); }
      .set-section > summary { list-style:none; cursor:pointer; padding: var(--s-4); display:flex; align-items:center; justify-content:space-between; gap:.5rem; font-weight:600; }
      .set-section > summary::-webkit-details-marker { display:none; }
      .set-section > summary::after { content:'▾'; transition: transform var(--t-fast) var(--ease); color: var(--ink-500); }
      .set-section[open] > summary::after { transform: rotate(180deg); }
      .set-body { padding: 0 var(--s-4) var(--s-4); display:flex; flex-direction:column; gap: var(--s-3); }
      .set-section .form-actions { margin-top: var(--s-2); }
      .pill-toggle { display:inline-flex; padding:4px; background: var(--ink-100, #eef0ee); border-radius: var(--r-pill); border:1px solid var(--ink-100); }
      .pill-toggle button { flex:1 1 0; padding: .55rem 1rem; border:0; background:transparent; border-radius: var(--r-pill); font-weight:600; color: var(--ink-700); cursor:pointer; transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease); white-space:nowrap; }
      .pill-toggle button.is-active { background: var(--green-700); color:#fff; box-shadow: var(--sh-1); }
      .recipient-card { background:#fff; border:1px solid var(--ink-100); border-radius: var(--r-md); padding: var(--s-4); margin-bottom: var(--s-3); }
      .recipient-card h3 { margin:0 0 .25rem; }
      .recipient-card .pill-toggle { width:100%; margin-top: var(--s-3); }
      .tpl-help { font-size:.8rem; color: var(--ink-500); margin: 0 0 .25rem; }
      .tpl-help code { background: var(--ink-100, #eef0ee); padding: 1px 6px; border-radius: 4px; font-size: .85em; }
      textarea.tpl { font-family: inherit; line-height: 1.45; }
    </style>

    <div class="page">
      <h2>${t('admin.settingsTitle')}</h2>

      <!-- Recipient toggle: most-used control, kept always visible at top -->
      <div class="recipient-card">
        <h3>📩 Destinatario activo</h3>
        <p class="muted" style="margin:0;font-size:.85rem">Quién recibe las notificaciones de Telegram y los SMS ahora mismo.</p>
        <div class="pill-toggle" role="tablist" id="recipient-toggle">
          <button type="button" data-val="claudia" class="${recipient === 'claudia' ? 'is-active' : ''}">👩‍🦰 Claudia (producción)</button>
          <button type="button" data-val="jordi" class="${recipient === 'jordi' ? 'is-active' : ''}">🧪 Jordi (pruebas)</button>
        </div>
      </div>

      <!-- Studio settings -->
      <details class="set-section" id="sec-studio">
        <summary>📍 Estudio</summary>
        <div class="set-body">
          <label>${t('admin.locationAddress')}
            <input type="text" id="s-location" value="${settings.location_address || ''}" placeholder="${t('admin.locationPlaceholder')}" />
          </label>
          <label>${t('admin.meetingLink')}
            <input type="url" id="s-meeting-link" value="${settings.online_meeting_link || ''}" placeholder="${t('admin.meetingLinkPlaceholder')}" />
          </label>
          <label>${t('admin.signupWindow')}
            <input type="number" id="s-window" value="${settings.signup_window_weeks || '2'}" min="1" max="12" />
          </label>
          <label>${t('admin.defaultCapacity')}
            <input type="number" id="s-capacity" value="${settings.default_capacity || '15'}" min="1" />
          </label>
          <div class="form-actions">
            <button type="button" class="btn btn-primary" data-save="studio">${t('admin.saveSettings')}</button>
          </div>
        </div>
      </details>

      <!-- WhatsApp templates -->
      <details class="set-section" id="sec-wa">
        <summary>💬 Plantillas de WhatsApp</summary>
        <div class="set-body">
          <p class="tpl-help">Variables disponibles: <code>{name}</code> (primer nombre del alumno), <code>{kind}</code> (tipo de pase), <code>{reason}</code> (solo en rechazo).</p>

          <label>✅ Pase aprobado
            <textarea class="tpl" id="s-tpl-approved" rows="3">${tplVal('wa_template_approved')}</textarea>
          </label>

          <label>❌ Pase rechazado
            <textarea class="tpl" id="s-tpl-declined" rows="3">${tplVal('wa_template_declined')}</textarea>
          </label>

          <label>📅 Pase vence hoy
            <textarea class="tpl" id="s-tpl-expiring" rows="3">${tplVal('wa_template_expiring')}</textarea>
          </label>

          <label>🔔 Última clase usada
            <textarea class="tpl" id="s-tpl-last-class" rows="3">${tplVal('wa_template_last_class')}</textarea>
          </label>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" data-restore="wa">Restaurar predeterminados</button>
            <button type="button" class="btn btn-primary" data-save="wa">${t('admin.saveSettings')}</button>
          </div>
        </div>
      </details>

      <!-- Bank details -->
      <details class="set-section" id="sec-bank">
        <summary>💳 Datos bancarios para pagos</summary>
        <div class="set-body">
          <label>${t('admin.accountHolder')}
            <input type="text" id="s-holder" value="${settings.bank_account_holder || ''}" />
          </label>
          <label>${t('admin.bankName')}
            <input type="text" id="s-bank" value="${settings.bank_name || ''}" placeholder="BanCoppel" />
          </label>
          <label>${t('admin.accountNumber')}
            <input type="text" id="s-account" value="${settings.bank_account_number || ''}" />
          </label>
          <label>${t('admin.clabe')}
            <input type="text" id="s-clabe" value="${settings.bank_clabe || ''}" />
          </label>
          <label>${t('admin.cardNumber')}
            <input type="text" id="s-card" value="${settings.bank_card_number || ''}" />
          </label>
          <label>${t('admin.paymentInstructions')}
            <textarea id="s-instructions" rows="3">${settings.payment_instructions || ''}</textarea>
          </label>
          <div class="form-actions">
            <button type="button" class="btn btn-primary" data-save="bank">${t('admin.saveSettings')}</button>
          </div>
        </div>
      </details>
    </div>
  `;

  // Recipient toggle — saves immediately on click
  const toggle = document.getElementById('recipient-toggle');
  toggle.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-val]');
    if (!btn) return;
    const val = btn.dataset.val;
    toggle.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === btn));
    const { error } = await sb.from('settings').upsert({ key: 'test_mode', value: val === 'jordi' ? 'true' : 'false' });
    if (error) showToast(error.message, 'error');
    else showToast(val === 'jordi' ? '🧪 Modo pruebas (Jordi)' : '👩‍🦰 Modo producción (Claudia)', 'success');
  });

  // Per-section save handlers
  const saveSection = async (section, btn) => {
    const updates = collectSection(section);
    return withLoading(btn, async () => {
      for (const [key, value] of Object.entries(updates)) {
        const { error } = await sb.from('settings').upsert({ key, value });
        if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
      }
      showToast(t('admin.settingsSaved'), 'success');
    });
  };

  document.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', () => saveSection(btn.dataset.save, btn));
  });

  // Restore default WhatsApp templates (just resets the textareas — admin still has to Save)
  document.querySelector('[data-restore="wa"]').addEventListener('click', () => {
    document.getElementById('s-tpl-approved').value = WA_DEFAULTS.wa_template_approved;
    document.getElementById('s-tpl-declined').value = WA_DEFAULTS.wa_template_declined;
    document.getElementById('s-tpl-expiring').value = WA_DEFAULTS.wa_template_expiring;
    document.getElementById('s-tpl-last-class').value = WA_DEFAULTS.wa_template_last_class;
    showToast('Plantillas restauradas (recuerda Guardar)', 'info');
  });
}

function collectSection(section) {
  if (section === 'studio') {
    return {
      location_address: document.getElementById('s-location').value,
      online_meeting_link: document.getElementById('s-meeting-link').value,
      signup_window_weeks: document.getElementById('s-window').value,
      default_capacity: document.getElementById('s-capacity').value,
    };
  }
  if (section === 'bank') {
    return {
      bank_account_holder: document.getElementById('s-holder').value,
      bank_name: document.getElementById('s-bank').value,
      bank_account_number: document.getElementById('s-account').value,
      bank_clabe: document.getElementById('s-clabe').value,
      bank_card_number: document.getElementById('s-card').value,
      payment_instructions: document.getElementById('s-instructions').value,
    };
  }
  if (section === 'wa') {
    return {
      wa_template_approved: document.getElementById('s-tpl-approved').value,
      wa_template_declined: document.getElementById('s-tpl-declined').value,
      wa_template_expiring: document.getElementById('s-tpl-expiring').value,
      wa_template_last_class: document.getElementById('s-tpl-last-class').value,
    };
  }
  return {};
}
