import { navigate } from '../lib/router.js';
import { sb } from '../lib/supabase.js';
import { t, toggleLang } from '../lib/i18n.js';

function formatTime(timeStr) {
  // "08:30:00" → "8:30 am"
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12; if (h === 0) h = 12;
  return { time: `${h}:${m}`, ampm };
}

function renderScheduleCards(templates) {
  if (!templates || templates.length === 0) {
    return `<p class="landing-schedule-empty">${t('landing.schedule.empty')}</p>`;
  }
  // Group by start_time → list of day_of_week
  const groups = new Map();
  for (const tpl of templates) {
    const key = tpl.start_time;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tpl.day_of_week);
  }
  // Sort: groups by time asc; days within a group asc
  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.map(([time, days]) => {
    const dayNames = [...new Set(days)].sort((a, b) => a - b).map(d => t(`day.${d}`));
    const daysLabel = dayNames.length > 1
      ? dayNames.slice(0, -1).join(', ') + ' & ' + dayNames[dayNames.length - 1]
      : dayNames[0];
    const { time: tStr, ampm } = formatTime(time);
    return `
      <div class="landing-schedule-card">
        <span class="landing-schedule-days">${daysLabel}</span>
        <div class="landing-schedule-time-row">
          <span class="landing-schedule-time">${tStr}</span>
          <span class="landing-schedule-ampm">${ampm}</span>
        </div>
      </div>
    `;
  }).join('');
}

export async function renderLanding() {
  document.getElementById('nav').classList.add('hidden');

  // Fetch active class templates (publicly readable). Failure → empty state.
  let templates = [];
  try {
    const { data } = await sb
      .from('class_templates')
      .select('day_of_week, start_time')
      .eq('is_active', true)
      .order('start_time', { ascending: true });
    templates = data || [];
  } catch { /* ignore — show empty state */ }

  document.getElementById('app').innerHTML = `
    <div class="landing-page">

      <!-- ── Top nav ── -->
      <header class="landing-nav">
        <a class="landing-nav-brand" href="/" aria-label="Jivatma">
          <img src="/brand/wordmark.svg" alt="Jivatma" class="landing-nav-wordmark" />
        </a>
        <div class="landing-nav-actions">
          <button class="landing-lang-btn" id="landing-lang">${t('lang.switch')}</button>
          <a href="/login" class="landing-btn-outline" style="padding:9px 20px;font-size:0.9rem">${t('auth.login')}</a>
        </div>
      </header>

      <!-- ── Hero ── -->
      <section class="landing-hero">
        <!-- Right-side image (desktop) -->
        <div class="landing-hero-image" aria-hidden="true">
          <div class="landing-hero-image-fade-l"></div>
          <div class="landing-hero-image-fade-b"></div>
          <img src="/brand/flyer.svg" alt="Claudia Ontiveros — Yoga Iyengar" class="landing-claudia-img" />
        </div>

        <!-- Mobile decorative hint -->
        <img src="/brand/flyer.svg" alt="" class="landing-hero-mobile-img" aria-hidden="true" />

        <div class="landing-hero-content">
          <h1 class="landing-title">
            <img src="/brand/logo-full.svg" alt="Jivatma — Yoga Iyengar" class="landing-full-logo" />
          </h1>
          <p class="landing-subtitle">${t('landing.subtitle')}</p>

          <span class="landing-type-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l2.5 2.5"/>
            </svg>
            ${t('landing.type')}
          </span>

          <div class="landing-ctas">
            <a href="/register" class="landing-btn-primary">${t('landing.cta.signup')}</a>
            <a href="/login" class="landing-btn-outline">${t('landing.cta.login')}</a>
          </div>
        </div>
      </section>

      <!-- ── Diagonal accent strip ── -->
      <div class="landing-strip" aria-hidden="true"></div>

      <!-- ── Schedule ── -->
      <section class="landing-schedule">
        <p class="landing-section-label">${t('landing.schedule.title')}</p>
        <div class="landing-schedule-grid">
          ${renderScheduleCards(templates)}
        </div>
        <p class="landing-schedule-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          ${t('landing.schedule.note')}
        </p>
      </section>

      <!-- ── About ── -->
      <section class="landing-about">
        <div class="landing-about-inner">
          <div class="landing-about-mark" aria-hidden="true">
            <img src="/brand/logo.svg" alt="" width="64" height="64" />
          </div>
          <p class="landing-section-label" style="color:#b87a3a">${t('landing.about.eyebrow')}</p>
          <h2 class="landing-about-title">${t('landing.about.title')}</h2>
          <p class="landing-about-body">${t('landing.about.body')}</p>
          <a href="/register" class="landing-btn-primary" style="margin-top:2rem;display:inline-flex">
            ${t('landing.cta.signup')} →
          </a>
        </div>
      </section>

      <!-- ── Location ── -->
      <section class="landing-location">
        <div class="landing-location-inner">
          <p class="landing-section-label">${t('landing.location.eyebrow')}</p>
          <p class="landing-location-cities">${t('landing.location.cities')}</p>
          <div class="landing-location-divider"></div>
          <p class="landing-location-contact-label">${t('landing.location.contact')}</p>
          <a href="tel:+523314779844" class="landing-location-phone">+52 33 1477 9844</a>
        </div>
      </section>

      <!-- ── Footer ── -->
      <footer class="landing-footer">
        <img src="/brand/logo.svg" alt="Jivatma" width="28" height="28" style="border-radius:6px;opacity:.6" />
        <span>&copy; ${new Date().getFullYear()} Jivatma &middot; Yoga Iyengar</span>
        <button class="landing-lang-btn" id="landing-lang-footer">${t('lang.switch')}</button>
      </footer>

    </div>
  `;

  document.getElementById('landing-lang').addEventListener('click', () => toggleLang());
  document.getElementById('landing-lang-footer').addEventListener('click', () => toggleLang());

  // Internal link clicks go through the SPA router
  document.querySelectorAll('.landing-page a[href^="/"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.getAttribute('href'));
    });
  });
}
