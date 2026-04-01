import { sb } from '../../lib/supabase.js';
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
        <button type="submit" class="btn btn-primary">${t('admin.saveSettings')}</button>
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
    };

    for (const [key, value] of Object.entries(updates)) {
      const { error } = await sb.from('settings').upsert({ key, value });
      if (error) { showToast(`Error saving ${key}: ${error.message}`, 'error'); return; }
    }

    showToast(t('admin.settingsSaved'), 'success');
  });
}
