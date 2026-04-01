import { sb, getSession } from '../lib/supabase.js';
import { renderPassCard } from '../components/pass-card.js';
import { t } from '../lib/i18n.js';

export async function renderMyPasses() {
  const app = document.getElementById('app');
  const session = await getSession();

  const { data: passes } = await sb
    .from('user_passes')
    .select('*, pass_types(*)')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  app.innerHTML = `
    <div class="page">
      <h2>${t('passes.title')}</h2>
      ${!passes?.length
        ? `<p class="muted">${t('passes.noPasses')}</p>`
        : passes.map(p => renderPassCard(p, p.pass_types)).join('')
      }
    </div>
  `;
}
