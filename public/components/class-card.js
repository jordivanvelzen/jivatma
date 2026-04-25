import { t, getLocale } from '../lib/i18n.js';
import { formatDbDate } from '../lib/dates.js';
import { icon, classTypeIcon } from '../lib/icons.js';

/**
 * Render a class card.
 * @param {Object} session
 * @param {Object|null} booking — booking row for current user (with optional attendance_mode)
 * @param {number} spotsLeft
 * @param {boolean} hasActivePass
 */
export function renderClassCard(session, booking, spotsLeft, hasActivePass = true) {
  const dow = formatDbDate(session.date, getLocale(), { weekday: 'short' });
  const day = formatDbDate(session.date, getLocale(), { day: 'numeric' });
  const mon = formatDbDate(session.date, getLocale(), { month: 'short' });
  const timeStr = session.start_time.slice(0, 5);
  const type = session.class_type;
  const typeLabel = t(`type.${type}.label`);
  const typeMod = type === 'online' ? 'cc-type--online' : type === 'hybrid' ? 'cc-type--hybrid' : 'cc-type--in-person';

  const showSpots = type !== 'online';
  const isFull = showSpots && spotsLeft <= 0;
  const isBooked = booking && !booking.cancelled_at;
  const cantBook = isFull || !hasActivePass;
  const isHybrid = type === 'hybrid';

  // Booking mode display (hybrid only — for already booked classes)
  const bookedMode = isBooked && isHybrid && booking.attendance_mode
    ? `<span class="cc-mode-pill">${icon(booking.attendance_mode === 'online' ? 'online' : 'in_person', { size: 14 })}${t('schedule.mode.' + booking.attendance_mode)}</span>`
    : '';

  let actions;
  if (isBooked) {
    actions = `
      ${bookedMode}
      <span class="cc-booked-pill">${icon('check', { size: 14 })}${t('schedule.youreSignedUp')}</span>
      <button class="btn btn-secondary btn-small btn-cancel" data-session-id="${session.id}">${t('schedule.cancel')}</button>
    `;
  } else {
    const label = isFull ? t('schedule.full') : !hasActivePass ? t('schedule.noPass') : t('schedule.signup');
    actions = `
      <button
        class="btn btn-primary btn-signup ${cantBook ? 'disabled' : ''} ${isHybrid && !cantBook ? 'js-signup-hybrid' : ''}"
        data-session-id="${session.id}"
        data-type="${type}"
        ${cantBook ? 'disabled' : ''}>
        ${label}${isHybrid && !cantBook ? icon('arrow_right', { size: 16 }) : ''}
      </button>
    `;
  }

  return `
    <article class="cc ${isBooked ? 'cc--booked' : ''} ${isFull ? 'cc--full' : ''}" data-session-id="${session.id}">
      <div class="cc-date" aria-hidden="true">
        <div class="cc-date-dow">${dow.replace('.', '')}</div>
        <div class="cc-date-day">${day}</div>
        <div class="cc-date-mon">${mon.replace('.', '')}</div>
      </div>
      <div class="cc-body">
        <div class="cc-row-top">
          <div class="cc-time">${icon('clock', { size: 16 })} ${timeStr}</div>
          <span class="cc-type-badge ${typeMod}">${icon(classTypeIcon(type), { size: 14 })} ${typeLabel}</span>
        </div>
        <div class="cc-meta">
          ${showSpots ? `<span class="cc-spots ${isFull ? 'full' : ''}">${icon('spots', { size: 14 })} ${spotsLeft}/${session.capacity} ${t('schedule.spots')}</span>` : ''}
        </div>
        <div class="cc-actions">${actions}</div>
      </div>
    </article>
  `;
}
