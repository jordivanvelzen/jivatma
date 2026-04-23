import { sb } from '../../lib/supabase.js';
import { t, getLocale } from '../../lib/i18n.js';

export async function renderAdminUsers() {
  const app = document.getElementById('app');
  const today = new Date().toISOString().split('T')[0];

  const [{ data: users }, { data: passes }] = await Promise.all([
    sb.from('profiles').select('*').order('full_name', { ascending: true }),
    sb.from('user_passes').select('*, pass_types(*)').gte('expires_at', today).order('expires_at'),
  ]);

  const locale = getLocale();

  // Pick the best active pass per user: unlimited with classes left > singles first, then by expiry
  const byUser = {};
  (passes || []).forEach(p => {
    const usedUp = p.classes_remaining !== null && p.classes_remaining <= 0;
    if (usedUp) return;
    const existing = byUser[p.user_id];
    if (!existing) { byUser[p.user_id] = p; return; }
    // Prefer unlimited / multi over single, then later expiry
    const score = (pass) => {
      if (pass.pass_types?.kind === 'unlimited') return 3;
      if (pass.pass_types?.kind === 'multi') return 2;
      return 1;
    };
    if (score(p) > score(existing)) byUser[p.user_id] = p;
    else if (score(p) === score(existing) && new Date(p.expires_at) > new Date(existing.expires_at)) {
      byUser[p.user_id] = p;
    }
  });

  const passSummary = (userId) => {
    const p = byUser[userId];
    if (!p) return `<span class="muted">\u2014</span>`;
    const pt = p.pass_types;
    const label = pt?.kind === 'single' ? t('passes.singleClass')
      : pt?.kind === 'multi' ? t('passes.multiClass', { n: pt.class_count })
      : t('passes.unlimited');
    const expires = new Date(p.expires_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const remaining = p.classes_remaining !== null
      ? ` · ${p.classes_remaining} ${t('passes.leftShort')}`
      : '';
    const unpaid = !p.is_paid ? ` <span class="badge-unpaid">\u{1F4B5}</span>` : '';
    return `<div class="user-pass-summary">${label}${remaining}<br><span class="muted">${t('passes.expiresShort')} ${expires}</span>${unpaid}</div>`;
  };

  app.innerHTML = `
    <div class="page">
      <h2>${t('admin.users')}</h2>
      ${!users?.length
        ? `<p class="muted">${t('admin.noUsers')}</p>`
        : `<div class="user-list">
            ${users.map(u => `
              <a href="#/admin/users/${u.id}" class="user-row">
                <div class="user-row-main">
                  <div class="user-row-name">${u.full_name || '(no name)'}</div>
                  ${u.role === 'admin' ? `<span class="badge badge-admin">${u.role}</span>` : ''}
                </div>
                <div class="user-row-pass">${passSummary(u.id)}</div>
              </a>
            `).join('')}
          </div>`
      }
    </div>
  `;
}
