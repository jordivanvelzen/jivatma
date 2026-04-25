import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t } from '../../lib/i18n.js';
import { withLoading, onSubmitWithLoading } from '../../lib/loading.js';

export async function renderAdminSettings() {
  const app = document.getElementById('app');

  const { data: allSettings } = await sb.from('settings').select('*');
  const settings = {};
  (allSettings || []).forEach(s => { settings[s.key] = s.value; });

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.settingsTitle')}</h2>
      <form id="settings-form" class="form">
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

        <h3 style="margin-top:1.5rem">${t('admin.paymentSection')}</h3>
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

        <h3 style="margin-top:1.5rem">${t('admin.telegramSection')}</h3>
        <p class="muted" style="font-size:0.85rem">${t('admin.telegramHelp')}</p>
        <label>${t('admin.telegramToken')}
          <input type="text" id="s-tg-token" value="${settings.telegram_bot_token || ''}" placeholder="123456:ABC-DEF..." autocomplete="off" />
        </label>
        <label>Chat ID — Claudia (producción)
          <input type="text" id="s-tg-chat" value="${settings.telegram_chat_id || ''}" placeholder="123456789" autocomplete="off" />
        </label>
        <label>Chat ID — Jordi (pruebas)
          <input type="text" id="s-tg-chat-jordi" value="${settings.jordi_telegram_chat_id || ''}" placeholder="123456789" autocomplete="off" />
        </label>

        <h3 style="margin-top:1.5rem">📩 Destinatario activo</h3>
        <p class="muted" style="font-size:0.85rem">Quién recibe las notificaciones de Telegram y los SMS de prueba ahora mismo.</p>
        <div class="radio-group" style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:1rem">
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
            <input type="radio" name="recipient" value="claudia" ${(settings.test_mode || 'true') !== 'true' ? 'checked' : ''} />
            <span>👩‍🦰 Claudia (producción) — los SMS reales se envían a las alumnas</span>
          </label>
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
            <input type="radio" name="recipient" value="jordi" ${(settings.test_mode || 'true') === 'true' ? 'checked' : ''} />
            <span>🧪 Jordi (pruebas) — todos los mensajes van a tu chat y teléfono</span>
          </label>
        </div>

        <h3 style="margin-top:1.5rem">📱 SMS (Twilio)</h3>
        <p class="muted" style="font-size:0.85rem">Las credenciales de Twilio (SID, token, número) están configuradas como variables de entorno en Vercel. Aquí solo configuras el teléfono de pruebas.</p>
        <label>Teléfono de pruebas — Jordi (E.164, ej. +525578923883)
          <input type="text" id="s-jordi-phone" value="${settings.jordi_test_phone || ''}" placeholder="+525578923883" autocomplete="off" />
        </label>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${t('admin.saveSettings')}</button>
          <button type="button" id="tg-test" class="btn btn-secondary">${t('admin.telegramTest')}</button>
          <button type="button" id="tg-webhook" class="btn btn-secondary">🔘 ${t('admin.telegramWebhook')}</button>
          <button type="button" id="sms-test" class="btn btn-secondary">📱 Enviar SMS de prueba</button>
        </div>
        <p class="muted" style="font-size:0.8rem;margin-top:0.4rem">${t('admin.telegramWebhookHelp')}</p>
      </form>
    </div>
  `;

  onSubmitWithLoading(document.getElementById('settings-form'), async () => {
    const updates = {
      location_address: document.getElementById('s-location').value,
      online_meeting_link: document.getElementById('s-meeting-link').value,
      signup_window_weeks: document.getElementById('s-window').value,
      default_capacity: document.getElementById('s-capacity').value,
      bank_account_holder: document.getElementById('s-holder').value,
      bank_name: document.getElementById('s-bank').value,
      bank_account_number: document.getElementById('s-account').value,
      bank_clabe: document.getElementById('s-clabe').value,
      bank_card_number: document.getElementById('s-card').value,
      payment_instructions: document.getElementById('s-instructions').value,
      telegram_bot_token: document.getElementById('s-tg-token').value,
      telegram_chat_id: document.getElementById('s-tg-chat').value,
      jordi_telegram_chat_id: document.getElementById('s-tg-chat-jordi').value,
      jordi_test_phone: document.getElementById('s-jordi-phone').value,
      test_mode: (document.querySelector('input[name="recipient"]:checked')?.value === 'jordi') ? 'true' : 'false',
    };

    for (const [key, value] of Object.entries(updates)) {
      const { error } = await sb.from('settings').upsert({ key, value });
      if (error) { showToast(`Error saving ${key}: ${error.message}`, 'error'); return; }
    }

    showToast(t('admin.settingsSaved'), 'success');
  });

  // SMS test button — uses current recipient toggle (test_mode) to decide whether
  // to reroute to Jordi's test phone. Saves the test phone first so the lib reads it.
  document.getElementById('sms-test').addEventListener('click', (ev) => {
    const btn = ev.currentTarget;
    const recipient = document.querySelector('input[name="recipient"]:checked')?.value || 'jordi';
    const jordiPhone = document.getElementById('s-jordi-phone').value.trim();
    return withLoading(btn, async () => {
      try {
        // Persist the toggle + test phone before firing so the server-side lib picks them up
        await sb.from('settings').upsert({ key: 'test_mode', value: recipient === 'jordi' ? 'true' : 'false' });
        if (jordiPhone) await sb.from('settings').upsert({ key: 'jordi_test_phone', value: jordiPhone });

        const body = recipient === 'jordi' ? {} : { to: jordiPhone || '' };
        const result = await api('/api/admin/settings', {
          method: 'POST',
          body: JSON.stringify({ action: 'sms-test', ...body }),
        });
        if (result.ok) showToast('📱 SMS enviado', 'success');
        else showToast(`SMS: ${result.error || result.reason}`, 'error');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // Telegram webhook activator — saves current token first, then registers the webhook
  document.getElementById('tg-webhook').addEventListener('click', (ev) => {
    const btn = ev.currentTarget;
    const token = document.getElementById('s-tg-token').value.trim();
    if (!token) { showToast(t('admin.telegramNeedBoth'), 'error'); return; }
    return withLoading(btn, async () => {
      try {
        await sb.from('settings').upsert({ key: 'telegram_bot_token', value: token });
        const result = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'register-webhook' }) });
        if (result.ok) showToast(t('admin.telegramWebhookOk'), 'success');
        else showToast(`Webhook: ${result.error || result.reason}`, 'error');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // Telegram test button — saves current token/chat first, then sends a test message
  document.getElementById('tg-test').addEventListener('click', (ev) => {
    const btn = ev.currentTarget;
    const token = document.getElementById('s-tg-token').value.trim();
    const chat = document.getElementById('s-tg-chat').value.trim();
    const jordiChat = document.getElementById('s-tg-chat-jordi').value.trim();
    const recipient = document.querySelector('input[name="recipient"]:checked')?.value || 'jordi';
    const activeChat = recipient === 'jordi' ? jordiChat : chat;
    if (!token || !activeChat) { showToast(t('admin.telegramNeedBoth'), 'error'); return; }
    return withLoading(btn, async () => {
      try {
        await sb.from('settings').upsert({ key: 'telegram_bot_token', value: token });
        if (chat) await sb.from('settings').upsert({ key: 'telegram_chat_id', value: chat });
        if (jordiChat) await sb.from('settings').upsert({ key: 'jordi_telegram_chat_id', value: jordiChat });
        await sb.from('settings').upsert({ key: 'test_mode', value: recipient === 'jordi' ? 'true' : 'false' });
        const result = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'telegram-test' }) });
        if (result.ok) showToast(t('admin.telegramSent'), 'success');
        else showToast(`Telegram: ${result.error || result.reason}`, 'error');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}
