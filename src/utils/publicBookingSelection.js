import { businessHours } from '../constants/scheduleConfig.js';

export function getLocalDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function isRealIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getDateWindowOffset(todayKey, targetKey) {
  const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number);
  const [targetYear, targetMonth, targetDay] = targetKey.split('-').map(Number);
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
  const targetUtc = Date.UTC(targetYear, targetMonth - 1, targetDay);
  const daysAhead = Math.max(0, Math.floor((targetUtc - todayUtc) / 86_400_000));

  return Math.floor(daysAhead / 7);
}

export function parsePublicBookingSelection(search, todayKey = getLocalDateKey()) {
  const params = new URLSearchParams(String(search || ''));
  const requestedDate = String(params.get('date') || '').trim();
  const validRequestedDate = isRealIsoDate(requestedDate) && requestedDate >= todayKey;
  const date = validRequestedDate ? requestedDate : todayKey;
  const rawStartHour = params.get('startHour');
  const parsedStartHour = rawStartHour !== null && /^\d+$/.test(rawStartHour.trim())
    ? Number(rawStartHour)
    : NaN;
  const validStartHour = validRequestedDate
    && Number.isInteger(parsedStartHour)
    && businessHours.some((hour) => Number(hour.start) === parsedStartHour);

  return {
    date,
    startHour: validStartHour ? parsedStartHour : null,
    dateWindowOffset: getDateWindowOffset(todayKey, date),
  };
}
