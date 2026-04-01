import { sb } from '../../lib/supabase.js';
import { t } from '../../lib/i18n.js';

export async function renderAdminUsers() {
  const app = document.getElementById('app');

  const { data: users } = await sb
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.users')}</h2>
      ${!users?.length
        ? `<p class="muted">${t('admin.noUsers')}</p>`
        : `<table class="table">
            <thead><tr><th>${t('admin.name')}</th><th>${t('admin.role')}</th><th></th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>${u.full_name || '(no name)'}</td>
                  <td><span class="badge badge-${u.role}">${u.role}</span></td>
                  <td><a href="#/admin/users/${u.id}" class="btn btn-small">${t('admin.view')}</a></td>
                </tr>
              `).join('')}
            </tbody>
          </table>`
      }
    </div>
  `;
}
