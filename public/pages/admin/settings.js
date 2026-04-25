import { sb } from '../../lib/supabase.js';
import { showToast } from '../../components/toast.js';
import { showConfirm } from '../../components/confirm.js';
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
  wa_template_class_cancelled:
    'Hola {name}, te avisamos que la clase del {date} a las {time} en Jivatma fue cancelada{reason}. Lamentamos las molestias. Avísanos si quieres reagendar. 🙏',
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
      .settings-page { display:flex; flex-direction:column; gap: var(--s-4); padding-bottom: var(--s-8); overflow-x: hidden; }
      .settings-page > h2 { margin: 0 0 var(--s-2); }

      .set-section {
        border:1px solid var(--ink-100);
        border-radius: var(--r-lg);
        background:#fff;
        box-shadow: var(--sh-1);
        overflow:hidden;
        transition: box-shadow var(--t-fast) var(--ease);
      }
      .set-section[open] { box-shadow: var(--sh-2); }
      .set-section > summary {
        list-style:none;
        cursor:pointer;
        padding: var(--s-4) var(--s-5);
        display:flex; align-items:center; gap: var(--s-3);
        font-weight:600;
        font-size: 1.05rem;
        color: var(--ink-900);
        user-select:none;
      }
      .set-section > summary:hover { background: var(--ink-50, #f7f7f4); }
      .set-section > summary::-webkit-details-marker { display:none; }
      .set-section > summary .sec-icon {
        width: 36px; height: 36px;
        display:inline-flex; align-items:center; justify-content:center;
        background: var(--green-50, #eef3ee);
        color: var(--green-700);
        border-radius: var(--r-md);
        font-size: 1.1rem;
        flex-shrink:0;
      }
      .set-section > summary .sec-title { flex:1; min-width:0; }
      .set-section > summary .sec-sub { display:block; font-weight:400; font-size:.8rem; color: var(--ink-500); margin-top:2px; }
      .set-section > summary .sec-chev {
        color: var(--ink-500);
        transition: transform var(--t-fast) var(--ease);
        flex-shrink:0;
      }
      .set-section[open] > summary .sec-chev { transform: rotate(180deg); }

      .set-body {
        padding: var(--s-2) var(--s-5) var(--s-5);
        display:flex; flex-direction:column; gap: var(--s-4);
        border-top:1px solid var(--ink-100);
      }
      .set-body label {
        display:flex; flex-direction:column; gap: var(--s-1);
        font-size: .875rem; font-weight:500; color: var(--ink-700);
      }
      .set-body input[type="text"],
      .set-body input[type="url"],
      .set-body input[type="number"],
      .set-body textarea {
        padding: var(--s-3);
        border: 1px solid var(--ink-200);
        border-radius: var(--r-md);
        font-size: 1rem;
        background: #fff;
        font-family: inherit;
        transition: border-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
        min-height: 44px;
        width: 100%;
        box-sizing: border-box;
      }
      .set-body input:focus,
      .set-body textarea:focus {
        outline:none;
        border-color: var(--green-500, #5a8a5f);
        box-shadow: 0 0 0 3px rgba(90,138,95,.15);
      }
      .set-body textarea { line-height: 1.5; resize: vertical; }
      .set-body .form-grid {
        display:grid; grid-template-columns: 1fr 1fr; gap: var(--s-4);
      }
      @media (max-width: 540px) { .set-body .form-grid { grid-template-columns: 1fr; } }

      .set-section .form-actions {
        margin-top: var(--s-2);
        display:flex; gap: var(--s-2); flex-wrap:wrap; justify-content:flex-end;
      }

      .pill-toggle {
        display:flex; padding:4px;
        background: var(--ink-100, #eef0ee);
        border-radius: var(--r-pill);
      }
      .pill-toggle button {
        flex:1 1 0;
        min-width: 0;
        padding: .6rem .5rem;
        border:0; background:transparent;
        border-radius: var(--r-pill);
        font-weight:600; font-size: .85rem;
        color: var(--ink-700);
        cursor:pointer;
        transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
        text-align: center;
        line-height: 1.3;
      }
      .pill-toggle button.is-active {
        background: #fff;
        color: var(--green-700);
        box-shadow: var(--sh-1);
      }

      .recipient-card {
        background: linear-gradient(135deg, var(--green-700) 0%, var(--green-800, #2f4a35) 100%);
        color:#fff;
        border-radius: var(--r-lg);
        padding: var(--s-5);
        box-shadow: var(--sh-2);
      }
      .recipient-card h3 {
        margin:0 0 .25rem;
        font-size: 1rem;
        display:flex; align-items:center; gap: .5rem;
      }
      .recipient-card p { margin:0 0 var(--s-3); font-size:.85rem; opacity:.85; }
      .recipient-card .pill-toggle {
        background: rgba(0,0,0,.25);
        width:100%;
      }
      .recipient-card .pill-toggle button { color: rgba(255,255,255,.75); }
      .recipient-card .pill-toggle button.is-active { color: var(--green-700); }

      .tpl-help {
        font-size:.85rem; color: var(--ink-600, var(--ink-500));
        margin: 0 0 var(--s-2);
        padding: var(--s-3);
        background: var(--ink-50, #f7f7f4);
        border-radius: var(--r-md);
        line-height: 1.6;
      }
      .tpl-help code {
        background:#fff;
        border:1px solid var(--ink-200);
        padding: 1px 6px;
        border-radius: 4px;
        font-size: .85em;
        color: var(--green-700);
      }

      .tpl-group {
        border:1px solid var(--ink-100);
        border-radius: var(--r-md);
        padding: var(--s-3);
        background: var(--ink-50, #fafaf7);
      }
      .tpl-group .tpl-label {
        display:flex; align-items:center; gap:.5rem;
        font-weight:600; font-size: .9rem;
        color: var(--ink-900);
        margin-bottom: var(--s-2);
      }
      .tpl-group textarea { background:#fff; }
    </style>

    <div class="page settings-page">
      <h2>${t('admin.settingsTitle')}</h2>

      <!-- Recipient toggle: most-used control, kept always visible at top -->
      <div class="recipient-card">
        <h3>${t('admin.recipientTitle')}</h3>
        <p>${t('admin.recipientHelp')}</p>
        <div class="pill-toggle" role="tablist" id="recipient-toggle">
          <button type="button" data-val="claudia" class="${recipient === 'claudia' ? 'is-active' : ''}">${t('admin.recipientClaudia')}</button>
          <button type="button" data-val="jordi" class="${recipient === 'jordi' ? 'is-active' : ''}">${t('admin.recipientJordi')}</button>
        </div>
      </div>

      <!-- Studio settings -->
      <details class="set-section" id="sec-studio">
        <summary>
          <span class="sec-icon">📍</span>
          <span class="sec-title">${t('admin.studioSection')}<span class="sec-sub">${t('admin.studioSectionSub')}</span></span>
          <span class="sec-chev">▾</span>
        </summary>
        <div class="set-body">
          <label>${t('admin.locationAddress')}
            <input type="text" id="s-location" value="${settings.location_address || ''}" placeholder="${t('admin.locationPlaceholder')}" />
          </label>
          <label>${t('admin.meetingLink')}
            <input type="url" id="s-meeting-link" value="${settings.online_meeting_link || ''}" placeholder="${t('admin.meetingLinkPlaceholder')}" />
          </label>
          <div class="form-grid">
            <label>${t('admin.signupWindow')}
              <input type="number" id="s-window" value="${settings.signup_window_weeks || '2'}" min="1" max="12" />
            </label>
            <label>${t('admin.defaultCapacity')}
              <input type="number" id="s-capacity" value="${settings.default_capacity || '15'}" min="1" />
            </label>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-primary" data-save="studio">${t('admin.saveSettings')}</button>
          </div>
        </div>
      </details>

      <!-- WhatsApp templates -->
      <details class="set-section" id="sec-wa">
        <summary>
          <span class="sec-icon">💬</span>
          <span class="sec-title">${t('admin.waSection')}<span class="sec-sub">${t('admin.waSectionSub')}</span></span>
          <span class="sec-chev">▾</span>
        </summary>
        <div class="set-body">
          <p class="tpl-help">${t('admin.waVarsHelp')
            .replace('{nameVar}', '<code>{name}</code>')
            .replace('{kindVar}', '<code>{kind}</code>')
            .replace('{reasonVar}', '<code>{reason}</code>')}</p>

          <div class="tpl-group">
            <div class="tpl-label">${t('admin.tplApproved')}</div>
            <textarea id="s-tpl-approved" rows="3">${tplVal('wa_template_approved')}</textarea>
          </div>

          <div class="tpl-group">
            <div class="tpl-label">${t('admin.tplDeclined')}</div>
            <textarea id="s-tpl-declined" rows="3">${tplVal('wa_template_declined')}</textarea>
          </div>

          <div class="tpl-group">
            <div class="tpl-label">${t('admin.tplExpiring')}</div>
            <textarea id="s-tpl-expiring" rows="3">${tplVal('wa_template_expiring')}</textarea>
          </div>

          <div class="tpl-group">
            <div class="tpl-label">${t('admin.tplLastClass')}</div>
            <textarea id="s-tpl-last-class" rows="3">${tplVal('wa_template_last_class')}</textarea>
          </div>

          <div class="tpl-group">
            <div class="tpl-label">${t('admin.tplClassCancelled')} <span class="muted" style="font-weight:400">${t('admin.tplClassCancelledVars')}</span></div>
            <textarea id="s-tpl-class-cancelled" rows="3">${tplVal('wa_template_class_cancelled')}</textarea>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" data-restore="wa">${t('admin.restoreDefaults')}</button>
            <button type="button" class="btn btn-primary" data-save="wa">${t('admin.saveSettings')}</button>
          </div>
        </div>
      </details>

      <!-- Bank details -->
      <details class="set-section" id="sec-bank">
        <summary>
          <span class="sec-icon">💳</span>
          <span class="sec-title">${t('admin.bankSection')}<span class="sec-sub">${t('admin.bankSectionSub')}</span></span>
          <span class="sec-chev">▾</span>
        </summary>
        <div class="set-body">
          <label>${t('admin.accountHolder')}
            <input type="text" id="s-holder" value="${settings.bank_account_holder || ''}" />
          </label>
          <div class="form-grid">
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
          </div>
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
    else showToast(val === 'jordi' ? t('admin.recipientToTest') : t('admin.recipientToProd'), 'success');
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
  document.querySelector('[data-restore="wa"]').addEventListener('click', async () => {
    const ok = await showConfirm({
      title: t('confirm.restoreDefaultsTitle'),
      message: t('confirm.restoreDefaultsMessage'),
      confirmText: t('confirm.restore'),
      variant: 'warning',
    });
    if (!ok) return;
    document.getElementById('s-tpl-approved').value = WA_DEFAULTS.wa_template_approved;
    document.getElementById('s-tpl-declined').value = WA_DEFAULTS.wa_template_declined;
    document.getElementById('s-tpl-expiring').value = WA_DEFAULTS.wa_template_expiring;
    document.getElementById('s-tpl-last-class').value = WA_DEFAULTS.wa_template_last_class;
    document.getElementById('s-tpl-class-cancelled').value = WA_DEFAULTS.wa_template_class_cancelled;
    showToast(t('admin.restoredToast'), 'info');
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
      wa_template_class_cancelled: document.getElementById('s-tpl-class-cancelled').value,
    };
  }
  return {};
}
