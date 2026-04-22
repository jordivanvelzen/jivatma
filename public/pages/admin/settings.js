import { sb } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { showToast } from '../../components/toast.js';
import { t } from '../../lib/i18n.js';

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
        <label>${t('admin.telegramChatId')}
          <input type="text" id="s-tg-chat" value="${settings.telegram_chat_id || ''}" placeholder="123456789" autocomplete="off" />
        </label>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${t('admin.saveSettings')}</button>
          <button type="button" id="tg-test" class="btn btn-secondary">${t('admin.telegramTest')}</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();

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
    };

    for (const [key, value] of Object.entries(updates)) {
      const { error } = await sb.from('settings').upsert({ key, value });
      if (error) { showToast(`Error saving ${key}: ${error.message}`, 'error'); return; }
    }

    showToast(t('admin.settingsSaved'), 'success');
  });

  // Telegram test button — saves current token/chat first, then sends a test message
  document.getElementById('tg-test').addEventListener('click', async () => {
    const btn = document.getElementById('tg-test');
    const token = document.getElementById('s-tg-token').value.trim();
    const chat = document.getElementById('s-tg-chat').value.trim();
    if (!token || !chat) { showToast(t('admin.telegramNeedBoth'), 'error'); return; }

    btn.disabled = true;
    try {
      await sb.from('settings').upsert({ key: 'telegram_bot_token', value: token });
      await sb.from('settings').upsert({ key: 'telegram_chat_id', value: chat });
      const result = await api('/api/admin/telegram-test', { method: 'POST' });
      if (result.ok) showToast(t('admin.telegramSent'), 'success');
      else showToast(`Telegram: ${result.error || result.reason}`, 'error');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}
