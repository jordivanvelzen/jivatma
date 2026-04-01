import { t, getLocale } from '../lib/i18n.js';

export function renderClassCard(session, booking, spotsLeft) {
  const dateStr = new Date(session.date).toLocaleDateString(getLocale(), {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  const timeStr = session.start_time.slice(0, 5);
  const typeLabel = t(`type.${session.class_type}`);
  const showSpots = session.class_type !== 'online';
  const isFull = showSpots && spotsLeft <= 0;
  const isBooked = booking && !booking.cancelled_at;

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
          : `<button class="btn btn-primary btn-signup ${isFull ? 'disabled' : ''}" data-session-id="${session.id}" ${isFull ? 'disabled' : ''}>
               ${isFull ? t('schedule.full') : t('schedule.signup')}
             </button>`
        }
      </div>
    </div>
  `;
}
