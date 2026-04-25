import { navigate } from '../lib/router.js';
import { t, toggleLang } from '../lib/i18n.js';

export async function renderLanding() {
  document.getElementById('nav').classList.add('hidden');

  document.getElementById('app').innerHTML = `
    <div class="landing-page">

      <!-- ── Top nav ── -->
      <header class="landing-nav">
        <a class="landing-nav-brand" href="/">
          <img src="/brand/logo.svg" alt="Jivatma" width="36" height="36" />
          <span>Jivatma</span>
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
          <!-- Brand mark -->
          <div class="landing-brand-mark-wrap">
            <img src="/brand/logo.svg" alt="Jivatma" class="landing-brand-mark" />
          </div>

          <p class="landing-eyebrow">Yoga Iyengar</p>
          <h1 class="landing-title">JIVATMA</h1>
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
          <div class="landing-schedule-card">
            <span class="landing-schedule-days">${t('landing.schedule.monwed')}</span>
            <div class="landing-schedule-time-row">
              <span class="landing-schedule-time">10:00</span>
              <span class="landing-schedule-ampm">am</span>
            </div>
          </div>
          <div class="landing-schedule-card">
            <span class="landing-schedule-days">${t('landing.schedule.tuesat')}</span>
            <div class="landing-schedule-time-row">
              <span class="landing-schedule-time">8:30</span>
              <span class="landing-schedule-ampm">am</span>
            </div>
          </div>
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
