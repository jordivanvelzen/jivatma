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

  const isHybrid = type === 'hybrid';
  const ipLeft = session._spotsLeftInPerson;
  const olLeft = session._spotsLeftOnline;
  const hasPerModeCaps = isHybrid && (ipLeft != null || olLeft != null);
  const ipFull = ipLeft != null && ipLeft <= 0;
  const olFull = olLeft != null && olLeft <= 0;

  const showSpots = true;
  let isFull;
  if (hasPerModeCaps) {
    // Class is unbookable only if every available mode is full.
    const ipBlocked = ipLeft == null ? false : ipFull;
    const olBlocked = olLeft == null ? false : olFull;
    isFull = ipBlocked && olBlocked;
  } else {
    isFull = showSpots && spotsLeft <= 0;
  }
  const isBooked = booking && !booking.cancelled_at;
  const isCancelled = session.status === 'cancelled';
  const cantBook = isFull || !hasActivePass || isCancelled;

  // Booking mode display (hybrid only — for already booked classes)
  const bookedMode = isBooked && isHybrid && booking.attendance_mode
    ? `<span class="cc-mode-pill">${icon(booking.attendance_mode === 'online' ? 'online' : 'in_person', { size: 14 })}${t('schedule.mode.' + booking.attendance_mode)}</span>`
    : '';

  let actions;
  if (isCancelled) {
    actions = `<span class="cc-cancelled-pill">⊘ ${t('schedule.cancelled')}${session.cancellation_reason ? ` · ${session.cancellation_reason}` : ''}</span>`;
  } else if (isBooked) {
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
    <article class="cc ${isBooked ? 'cc--booked' : ''} ${isFull ? 'cc--full' : ''} ${isCancelled ? 'cc--cancelled' : ''} ${session._isStarted && !isCancelled ? 'cc--started' : ''}" data-session-id="${session.id}">
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
          ${hasPerModeCaps ? `
            ${ipLeft != null ? `<span class="cc-spots ${ipFull ? 'full' : ''}">${icon('in_person', { size: 14 })} ${Math.max(ipLeft, 0)}/${session.capacity_inperson}</span>` : ''}
            ${olLeft != null ? `<span class="cc-spots ${olFull ? 'full' : ''}">${icon('online', { size: 14 })} ${Math.max(olLeft, 0)}/${session.capacity_online}</span>` : ''}
          ` : showSpots ? `<span class="cc-spots ${isFull ? 'full' : ''}">${icon(type === 'online' ? 'online' : 'in_person', { size: 14 })} ${spotsLeft}/${session.capacity} ${t('schedule.spots')}</span>` : ''}
        </div>
        <div class="cc-actions">${actions}</div>
      </div>
    </article>
  `;
}
