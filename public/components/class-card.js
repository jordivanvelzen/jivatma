import { t, getLocale } from '../lib/i18n.js';
import { formatDbDate } from '../lib/dates.js';

export function renderClassCard(session, booking, spotsLeft, hasActivePass = true) {
  const dateStr = formatDbDate(session.date, getLocale(), {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  const timeStr = session.start_time.slice(0, 5);
  const typeLabel = t(`type.${session.class_type}`);
  const showSpots = session.class_type !== 'online';
  const isFull = showSpots && spotsLeft <= 0;
  const isBooked = booking && !booking.cancelled_at;
  const cantBook = isFull || !hasActivePass;

  return `
    <div class="class-card" data-session-id="${session.id}">
      <div class="class-date">${dateStr}</div>
      <div class="class-time">${timeStr}</div>
      <div class="class-type">${typeLabel}</div>
      ${showSpots ? `<div class="class-spots ${isFull ? 'full' : ''}">${spotsLeft}/${session.capacity} ${t('schedule.spots')}</div>` : ''}
      <div class="class-action">
        ${isBooked
          ? `<button class="btn btn-secondary btn-cancel" data-session-id="${session.id}">${t('schedule.cancel')}</button>
             <span class="booked-badge">${t('schedule.youreSignedUp')}</span>`
          : `<button class="btn btn-primary btn-signup ${cantBook ? 'disabled' : ''}" data-session-id="${session.id}" ${cantBook ? 'disabled' : ''}>
               ${isFull ? t('schedule.full') : !hasActivePass ? t('schedule.noPass') : t('schedule.signup')}
             </button>`
        }
      </div>
    </div>
  `;
}
