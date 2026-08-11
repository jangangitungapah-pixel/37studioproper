import StatusPill from '../../components/ui/StatusPill.jsx';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Inbox,
  Plus,
} from 'lucide-react';
import BookingFormModal from '../../components/schedule/BookingFormModal.jsx';
import BookingDetailDrawer from '../../components/booking/BookingDetailDrawer.jsx';
import { ADMIN_NAV_ITEMS } from '../../config/adminNavigation.js';
import {
  businessHours,
  statusFilters,
  viewModes,
} from './scheduleConfig.js';
import { adminBookingRepository } from '../../services/adminBookingRepository.js';
import { adminCustomerRepository } from '../../services/adminCustomerRepository.js';
import {
  getBookingOperatorFeeVisibility,
  subscribeOperatorFeeEntries,
} from '../../services/operatorFeeRepository.js';
import {
  hasAdminPagePermission,
} from '../../utils/adminPermissions.js';
import {
  getBookingRequestStatus,
  getBookingSessionStatus,
  getLegacyBookingPaymentStatus,
  isBookingCancelled,
} from '../../domain/booking/bookingSelectors.js';

const BOOKINGS_STORAGE_KEY = '37musicstudio.schedule.bookings.v1';
const SCHEDULE_QA_PREVIEW_BOOKINGS = [
  { id: 'qa-1', customer: 'Budi Santoso', sessionLabel: 'Recording', date: '2026-06-25', startHour: 10, durationHours: 2, paymentStatus: 'dp', total: 600000, bookingRequestStatus: 'confirmed' },
  { id: 'qa-2', customer: 'Andi Pratama', sessionLabel: 'Latihan Band', date: '2026-06-25', startHour: 13, durationHours: 1, paymentStatus: 'pending', total: 150000, bookingRequestStatus: 'submitted', lastMessageSenderRole: 'client', lastMessageReadByAdmin: false },
  { id: 'qa-3', customer: 'Dewi Lestari', sessionLabel: 'Mixing', date: '2026-06-25', startHour: 16, durationHours: 2, paymentStatus: 'lunas', total: 450000, bookingRequestStatus: 'confirmed' },
  { id: 'qa-4', customer: 'Raka Project', sessionLabel: 'Rehearsal', date: '2026-06-26', startHour: 11, durationHours: 2, paymentStatus: 'pending', total: 220000, bookingRequestStatus: 'submitted' },
  { id: 'qa-5', customer: 'Nadia Putri', sessionLabel: 'Mastering', date: '2026-06-27', startHour: 14, durationHours: 2, paymentStatus: 'lunas', total: 700000, bookingRequestStatus: 'confirmed' },
  { id: 'qa-6', customer: 'Fajar Audio', packageId: 'qa-package', packageLabel: 'Paket Produksi', pricingMode: 'package', date: '2026-06-28', startHour: 10, durationHours: 0, paymentStatus: 'dp', total: 1200000, bookingRequestStatus: 'confirmed' },
];

const isScheduleQaPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('schedulePreview');

const REQUEST_INBOX_PATH =
  ADMIN_NAV_ITEMS.find(
    (item) =>
      item.key === 'requests',
  )?.path ||
  '/admin/bookings/requests';

const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const shortMonthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getWeekStart(date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(date), diff);
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function isSameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function formatRangeLabel(date, viewMode) {
  if (viewMode === 'day') {
    return dayNames[date.getDay()] + ', ' + date.getDate() + ' ' + monthNames[date.getMonth()] + ' ' + date.getFullYear();
  }

  if (viewMode === 'week') {
    const start = getWeekStart(date);
    const end = addDays(start, 6);

    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return start.getDate() + '-' + end.getDate() + ' ' + shortMonthNames[end.getMonth()] + ' ' + end.getFullYear();
    }

    return start.getDate() + ' ' + shortMonthNames[start.getMonth()] + '-' + end.getDate() + ' ' + shortMonthNames[end.getMonth()] + ' ' + end.getFullYear();
  }

  return monthNames[date.getMonth()] + ' ' + date.getFullYear();
}

function getVisibleDays(date, viewMode) {
  if (viewMode === 'day') return [startOfDay(date)];

  if (viewMode === 'week') {
    const weekStart = getWeekStart(date);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }

  return Array.from({ length: getDaysInMonth(date) }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index + 1));
}

function shiftDate(date, viewMode, direction) {
  if (viewMode === 'day') return addDays(date, direction);
  if (viewMode === 'week') return addDays(date, direction * 7);
  return addMonths(date, direction);
}

function getGridTemplate(viewMode, visibleDayCount) {
  if (viewMode === 'day') return 'var(--schedule-time-col, 112px) minmax(220px, 1fr)';
  if (viewMode === 'week') return 'var(--schedule-time-col, 112px) repeat(' + visibleDayCount + ', minmax(var(--schedule-week-day-col, 126px), 1fr))';
  return 'var(--schedule-time-col, 112px) repeat(' + visibleDayCount + ', minmax(var(--schedule-month-day-col, 92px), 1fr))';
}

function getInitialScheduleViewMode() {
  if (typeof window === 'undefined') return 'month';
  return window.matchMedia?.('(max-width: 767px)')?.matches ? 'week' : 'month';
}

function getScheduleScrollBehavior() {
  if (typeof window === 'undefined') return 'auto';
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ? 'auto'
    : 'smooth';
}

function readStoredBookings() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BOOKINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeBookingCustomerPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

function cleanBookingCustomerName(value) {
  return String(value || '').trim().toLowerCase();
}

function hashBookingCustomerIdentity(value) {
  let hash = 0;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function makeBookingCustomerId(phoneKey, name, salt = '') {
  const cleanName = cleanBookingCustomerName(name).replace(/[^a-z0-9]+/g, '-') || 'customer';
  return 'cust_' + hashBookingCustomerIdentity((phoneKey || 'no-phone') + '|' + cleanName + '|' + String(salt || ''));
}

function resolveBookingCustomerIdentity(booking, currentBookings) {
  const phoneKey = normalizeBookingCustomerPhone(booking.phone);
  const customerName = booking.customer || booking.name || 'Customer';
  const nameKey = cleanBookingCustomerName(customerName);
  const samePhoneBookings = currentBookings.filter((item) => {
    if (item.id && booking.id && item.id === booking.id) return false;
    return normalizeBookingCustomerPhone(item.phone) === phoneKey;
  });

  const exactBooking = samePhoneBookings.find((item) => cleanBookingCustomerName(item.customer || item.name) === nameKey);

  if (exactBooking) {
    return {
      customerId: exactBooking.customerId || makeBookingCustomerId(phoneKey, customerName),
      existingCustomerName: exactBooking.customer || exactBooking.name || customerName,
      mode: 'exact',
      needsConfirmation: false,
      newCustomerId: exactBooking.customerId || makeBookingCustomerId(phoneKey, customerName),
      phoneKey,
    };
  }

  if (samePhoneBookings.length) {
    const existingBooking = samePhoneBookings[0];
    return {
      customerId: existingBooking.customerId || makeBookingCustomerId(phoneKey, existingBooking.customer || existingBooking.name || 'Customer'),
      existingCustomerName: existingBooking.customer || existingBooking.name || 'Customer lama',
      mode: 'same-phone-different-name',
      needsConfirmation: true,
      newCustomerId: makeBookingCustomerId(phoneKey, customerName, booking.id || Date.now()),
      phoneKey,
    };
  }

  return {
    customerId: makeBookingCustomerId(phoneKey, customerName),
    existingCustomerName: '',
    mode: 'new',
    needsConfirmation: false,
    newCustomerId: makeBookingCustomerId(phoneKey, customerName),
    phoneKey,
  };
}

function getBookingStatus(booking) {
  return getLegacyBookingPaymentStatus(booking);
}

function isNoDurationPackageBooking(booking) {
  const hasPackage = Boolean(booking?.packageId && booking.packageId !== 'none') || booking?.pricingMode === 'package';
  return hasPackage && Number(booking?.durationHours || booking?.duration || 0) <= 0;
}

function getStatusLabel(status) {
  return statusFilters.find((item) => item.key === status)?.label || status;
}

function formatShortCurrency(value) {
  const safeValue = Math.max(0, Number(value) || 0);
  if (safeValue >= 1000000) {
    const millionValue = safeValue / 1000000;
    return 'Rp ' + millionValue.toFixed(millionValue % 1 === 0 ? 0 : 1).replace('.', ',') + 'jt';
  }
  if (safeValue >= 1000) {
    return 'Rp ' + Math.round(safeValue / 1000) + 'rb';
  }
  return 'Rp ' + safeValue;
}

function getBookingDurationHours(booking) {
  const duration = Number(booking.durationHours);
  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

function getBookingStartHour(booking) {
  const startHour = Number(booking.startHour);
  return Number.isFinite(startHour) ? startHour : 0;
}

function getBookingEndHour(booking) {
  return getBookingStartHour(booking) + getBookingDurationHours(booking);
}

function formatHourLabel(hourValue) {
  const safeHour = Number(hourValue) || 0;
  const wholeHour = Math.floor(safeHour);
  const minutes = Math.round((safeHour - wholeHour) * 60);
  return String(wholeHour).padStart(2, '0') + '.' + String(minutes).padStart(2, '0');
}

function getBookingWindowLabel(booking) {
  if (isNoDurationPackageBooking(booking)) return 'Tanpa durasi studio';
  return formatHourLabel(getBookingStartHour(booking)) + '-' + formatHourLabel(getBookingEndHour(booking));
}

function getBookingStartDateTime(booking) {
  const dateText = String(booking?.date || '').trim();
  if (!dateText) return null;
  const dateValue = new Date(dateText + 'T00:00:00');
  if (Number.isNaN(dateValue.getTime())) return null;
  const startHour = getBookingStartHour(booking);
  const wholeHour = Math.floor(startHour);
  const minutes = Math.round((startHour - wholeHour) * 60);
  dateValue.setHours(wholeHour, minutes, 0, 0);
  return dateValue;
}

function formatBookingDateLabel(booking) {
  const startDate = getBookingStartDateTime(booking);
  if (!startDate) return booking?.date || '-';
  return startDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });
}

function getUpcomingScheduleTimeLabel(booking) {
  if (isNoDurationPackageBooking(booking)) {
    return formatHourLabel(getBookingStartHour(booking)) + ' WIB';
  }
  return getBookingWindowLabel(booking) + ' WIB';
}

function isUnscheduledClientRequest(booking) {
  const requestStatus =
    getBookingRequestStatus(
      booking,
    );

  return (
    booking?.source === 'clientPortal' &&
    [
      'submitted',
      'rejected',
      'cancelled',
    ].includes(
      requestStatus,
    )
  );
}
function isUpcomingScheduleBooking(booking) {
  const startDate = getBookingStartDateTime(booking);

  if (!startDate) return false;
  if (isBookingCancelled(booking)) return false;
  if (isUnscheduledClientRequest(booking)) return false;

  return getBookingSessionStatus(booking) === 'upcoming';
}

function getUpcomingScheduleBookings(bookings) {
  return bookings
    .filter(isUpcomingScheduleBooking)
    .toSorted((first, second) => {
      const firstDate = getBookingStartDateTime(first);
      const secondDate = getBookingStartDateTime(second);
      return (firstDate?.getTime() || 0) - (secondDate?.getTime() || 0);
    });
}

function getStudioOpenHour() {
  return businessHours[0]?.start ?? 0;
}

function getStudioCloseHour() {
  return businessHours[businessHours.length - 1]?.end ?? 24;
}

function shouldHideBookingFromCalendarGrid(booking) {
  return (
    isNoDurationPackageBooking(booking) ||
    isUnscheduledClientRequest(booking)
  );
}

function isBookingScheduleActive(booking) {
  if (shouldHideBookingFromCalendarGrid(booking)) return false;
  return !isBookingCancelled(booking);
}

// Overlaps verification
function doBookingIntervalsOverlap(firstBooking, secondBooking) {
  if (firstBooking.date !== secondBooking.date) return false;
  const firstStart = getBookingStartHour(firstBooking);
  const firstEnd = getBookingEndHour(firstBooking);
  const secondStart = getBookingStartHour(secondBooking);
  const secondEnd = getBookingEndHour(secondBooking);
  return Math.max(firstStart, secondStart) < Math.min(firstEnd, secondEnd);
}

function getBookingConflictIssue(nextBooking, currentBookings) {
  if (isNoDurationPackageBooking(nextBooking)) return null;

  const startHour = getBookingStartHour(nextBooking);
  const endHour = getBookingEndHour(nextBooking);
  const durationHours = getBookingDurationHours(nextBooking);
  const openHour = getStudioOpenHour();
  const closeHour = getStudioCloseHour();

  if (!nextBooking.date || !Number.isFinite(startHour) || !durationHours) {
    return {
      kind: 'warning',
      title: 'Booking belum lengkap',
      message: 'Tanggal, jam mulai, dan durasi harus valid sebelum booking disimpan.',
      meta: 'Cek kembali form booking.',
    };
  }

  if (startHour < openHour || endHour > closeHour) {
    return {
      kind: 'warning',
      title: 'Di luar jam operasional',
      message:
        'Slot ' +
        getBookingWindowLabel(nextBooking) +
        ' melewati jam operasional studio ' +
        formatHourLabel(openHour) +
        '-' +
        formatHourLabel(closeHour) +
        '.',
      meta: 'Booking tidak disimpan.',
    };
  }

  const conflicts = currentBookings
    .filter((existingBooking) => {
      if (!isBookingScheduleActive(existingBooking)) return false;
      if (existingBooking.id && nextBooking.id && existingBooking.id === nextBooking.id) return false;
      return doBookingIntervalsOverlap(existingBooking, nextBooking);
    })
    .sort((first, second) => {
      const startDiff = getBookingStartHour(first) - getBookingStartHour(second);
      if (startDiff !== 0) return startDiff;
      return getBookingEndHour(second) - getBookingEndHour(first);
    });

  if (!conflicts.length) return null;

  const primaryConflict = conflicts[0];
  const conflictName = primaryConflict.customer || primaryConflict.title || primaryConflict.sessionLabel || 'booking lain';
  const conflictCount = conflicts.length;

  return {
    kind: 'warning',
    title: 'Jadwal bentrok',
    message:
      'Slot ' +
      getBookingWindowLabel(nextBooking) +
      ' bentrok dengan ' +
      conflictName +
      ' pada ' +
      getBookingWindowLabel(primaryConflict) +
      '.',
    meta:
      conflictCount > 1
        ? String(conflictCount) + ' booking bertabrakan di tanggal yang sama.'
        : 'Back-to-back tetap aman, tapi overlap waktu tidak boleh.',
  };
}

function getBookingSavedToast(booking) {
  return {
    kind: 'success',
    title: 'Booking tersimpan',
    message:
      (booking.customer || 'Customer') +
      ' masuk ke slot ' +
      getBookingWindowLabel(booking) +
      ' tanggal ' +
      booking.date +
      '.',
    meta: booking.sessionLabel || booking.packageLabel || 'Schedule updated.',
  };
}

function getSlotSpanRows(booking, startIndex) {
  const duration = Math.max(1, Math.ceil(Number(booking.durationHours) || 1));
  const availableRows = businessHours.length - startIndex;
  return Math.max(1, Math.min(duration, availableRows));
}

function getVisibleBookingBlocks(bookings, visibleDays, activeStatuses) {
  const visibleDayKeys = visibleDays.map(toIsoDate);
  const rawBlocks = bookings
    .map((booking) => {
      const status = getBookingStatus(booking);
      if (shouldHideBookingFromCalendarGrid(booking)) {
        return null;
      }

      const dayIndex = visibleDayKeys.indexOf(booking.date);
      const startHour = Number(booking.startHour);
      const startIndex = businessHours.findIndex((hour) => Number(hour.start) === startHour);

      if (dayIndex === -1 || startIndex === -1 || !activeStatuses.includes(status)) {
        return null;
      }

      const spanRows = getSlotSpanRows(booking, startIndex);
      const rowStart = startIndex + 2;
      const endIndex = startIndex + spanRows;

      return {
        booking,
        dayIndex,
        dayKey: booking.date,
        endIndex,
        rowStart,
        spanRows,
        startIndex,
        status,
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      if (first.dayIndex !== second.dayIndex) return first.dayIndex - second.dayIndex;
      if (first.startIndex !== second.startIndex) return first.startIndex - second.startIndex;
      return second.spanRows - first.spanRows;
    });

  const blocksByDay = rawBlocks.reduce((groups, block) => {
    groups[block.dayKey] = groups[block.dayKey] || [];
    groups[block.dayKey].push(block);
    return groups;
  }, {});

  Object.values(blocksByDay).forEach((dayBlocks) => {
    const laneEnds = [];

    dayBlocks.forEach((block) => {
      let laneIndex = laneEnds.findIndex((endIndex) => endIndex <= block.startIndex);
      if (laneIndex === -1) {
        laneIndex = laneEnds.length;
        laneEnds.push(block.endIndex);
      } else {
        laneEnds[laneIndex] = block.endIndex;
      }
      block.laneIndex = laneIndex;
    });

    dayBlocks.forEach((block) => {
      const overlappingBlocks = dayBlocks.filter(
        (candidate) =>
          candidate.startIndex < block.endIndex &&
          candidate.endIndex > block.startIndex
      );
      const maxLaneIndex = overlappingBlocks.reduce(
        (maxLane, candidate) => Math.max(maxLane, candidate.laneIndex || 0),
        block.laneIndex || 0
      );
      block.laneCount = maxLaneIndex + 1;
    });
  });

  return rawBlocks;
}

function getBookingBlockStyle(block) {
  const style = {
    gridColumn: String(block.dayIndex + 2),
    gridRow: String(block.rowStart) + ' / span ' + String(block.spanRows),
  };

  if (block.laneCount > 1) {
    const laneWidth = 100 / block.laneCount;
    style.width = 'calc(' + laneWidth.toFixed(4) + '% - 8px)';
    style.marginLeft = 'calc(' + (laneWidth * block.laneIndex).toFixed(4) + '% + 5px)';
    style.marginRight = '3px';
  }

  return style;
}

function CalendarBookingBlock({
  block,
  onBookingClick,
  operatorFeeVisibility,
}) {
  const booking = block.booking;
  const title = booking.title || booking.sessionLabel || 'Booking';
  const statusLabel = getStatusLabel(block.status);
  const startLabel = booking.startTimeLabel || String(booking.startHour).padStart(2, '0') + '.00';
  const durationLabel = (Number(booking.durationHours) || block.spanRows) + 'j';
  const priceLabel = formatShortCurrency(booking.total || booking.subtotal || 0);
  
  const hasUnreadClientMessage = booking.lastMessageSenderRole === 'client' && booking.lastMessageReadByAdmin === false;
  const requestStatus = getBookingRequestStatus(booking);
  const isCancellationRequested = requestStatus === 'cancellation_requested';

  const requestClass = isCancellationRequested ? ' is-cancellation-requested' : '';

  return (
    <button
      aria-label={'Booking ' + booking.customer + ' ' + startLabel + ' ' + durationLabel}
      className={'schedule-booking-block is-' + block.status + requestClass + (hasUnreadClientMessage ? ' has-client-message' : '')}
      style={getBookingBlockStyle(block)}
      type="button"
      onClick={() => onBookingClick(booking)}
    >
      <span className="schedule-booking-glow" aria-hidden="true" />
      
      <span className="schedule-booking-topline">
        <strong>{booking.customer}</strong>
        
        {/* Micro status dot only visible on mobile screens */}
        <span className="schedule-booking-status-dot" />

        {/* Regular status pill only visible on desktop screens */}
        <StatusPill status={block.status}>{statusLabel}</StatusPill>
      </span>

      <span className="schedule-booking-title">{title}</span>

      {isCancellationRequested ? (
        <span className="schedule-booking-request-flag">
          Cancel request
        </span>
      ) : null}

      <span className="schedule-booking-meta">
        <span>{startLabel} • {durationLabel}</span>

        {operatorFeeVisibility ? (
          <span
            aria-label={operatorFeeVisibility.label}
            className={
              'schedule-booking-fee-indicator is-' +
              operatorFeeVisibility.status
            }
            role="img"
            title={operatorFeeVisibility.label}
          />
        ) : null}

        <b>{priceLabel}</b>
      </span>

      {hasUnreadClientMessage ? (
        <i className="schedule-booking-message-dot" aria-label="Pesan client belum dibaca" />
      ) : null}
    </button>
  );
}

function ScheduleUpcomingTable({
  bookings,
  getOperatorFeeVisibility,
  onBookingClick,
}) {
  const upcomingBookings = useMemo(() => getUpcomingScheduleBookings(bookings), [bookings]);
  const previewBookings = upcomingBookings.slice(0, 6);
  const mobileRemainingCount = Math.max(0, upcomingBookings.length - 2);
  const desktopRemainingCount = Math.max(0, upcomingBookings.length - previewBookings.length);

  return (
    <section
      className={
        'schedule-upcoming-panel' +
        (previewBookings.length ? '' : ' is-empty')
      }
      aria-labelledby="schedule-upcoming-title"
    >
      <header className="schedule-upcoming-head">
        <h3 id="schedule-upcoming-title">Jadwal Mendatang</h3>
        <span>{upcomingBookings.length}</span>
      </header>

      {previewBookings.length ? (
        <div className="schedule-upcoming-list" aria-label="Daftar jadwal mendatang">
          {previewBookings.map((booking) => {
            const noDurationPackage = isNoDurationPackageBooking(booking);
            const requestStatus = getBookingRequestStatus(booking);
            const requestMeta = requestStatus === 'cancellation_requested'
              ? 'Cancel request'
              : requestStatus === 'confirmed'
                ? 'Confirmed'
                : '';
            const statusText = requestMeta || getStatusLabel(getBookingStatus(booking));
            const serviceLabel = booking.packageLabel || booking.sessionLabel || booking.title || 'Sesi Studio';

            const operatorFeeVisibility =
              getOperatorFeeVisibility
                ? getOperatorFeeVisibility(
                    booking,
                  )
                : null;

            return (
              <button
                className={'schedule-upcoming-item ' + (noDurationPackage ? 'is-no-duration-package' : '')}
                key={booking.id || booking.bookingCode}
                type="button"
                onClick={() => onBookingClick(booking)}
              >
                <span className="schedule-upcoming-main">
                  <strong>{booking.customer || 'Customer'}</strong>
                  <small>{serviceLabel}</small>
                </span>

                <span className="schedule-upcoming-meta">
                  <span>{formatBookingDateLabel(booking)}</span>

                  <b>{getUpcomingScheduleTimeLabel(booking)}</b>

                  {operatorFeeVisibility ? (
                    <i
                      className={
                        'schedule-upcoming-fee is-' +
                        operatorFeeVisibility.status
                      }
                    >
                      {operatorFeeVisibility.shortLabel}
                    </i>
                  ) : null}
                </span>

                <span className="schedule-upcoming-side">
                  {noDurationPackage ? <em>Tanpa blok</em> : null}
                  <i className={'schedule-upcoming-status is-' + getBookingStatus(booking)}>{statusText}</i>
                  <b>{formatShortCurrency(booking.total || booking.subtotal || 0)}</b>
                  <ChevronRight size={14} aria-hidden="true" />
                </span>
              </button>
            );
          })}

          {mobileRemainingCount ? (
            <p className="schedule-upcoming-more is-mobile">+{mobileRemainingCount} jadwal lainnya</p>
          ) : null}

          {desktopRemainingCount ? (
            <p className="schedule-upcoming-more is-desktop">+{desktopRemainingCount} jadwal lainnya</p>
          ) : null}
        </div>
      ) : (
        <p className="schedule-upcoming-empty">Belum ada jadwal mendatang.</p>
      )}
    </section>
  );
}

function ScheduleLoading() {
  return (
    <section
      aria-label="Memuat kalender booking"
      className="schedule-loading"
      role="status"
    >
      <div className="schedule-loading-head">
        <span className="schedule-loading-copy">
          <small>
            Scheduling board
          </small>

          <strong>
            Menyusun kalender studio...
          </strong>
        </span>

        <span
          aria-hidden="true"
          className="schedule-loading-orb"
        />
      </div>

      <div className="schedule-loading-grid">
        {Array.from(
          {
            length: 18,
          },
          (
            _,
            index,
          ) => (
            <span
              className="schedule-loading-cell"
              key={index}
            />
          ),
        )}
      </div>
    </section>
  );
}

function CalendarGrid({
  activeStatuses,
  bookings,
  getOperatorFeeVisibility,
  onSlotClick,
  onBookingClick,
  selectedDate,
  todayFocusDateIso,
  todayFocusRequest,
  viewMode,
}) {
  const gridScrollRef = useRef(null);
  const focusDayRef = useRef(null);
  const gridGestureRef = useRef(null);
  const gridClickReleaseTimerRef = useRef(null);
  const suppressGridClickRef = useRef(false);

  const today = startOfDay(new Date());
  const visibleDays = useMemo(() => getVisibleDays(selectedDate, viewMode), [selectedDate, viewMode]);
  const selectedDayIso = toIsoDate(selectedDate);
  const bookingBlocks = useMemo(
    () => getVisibleBookingBlocks(bookings, visibleDays, activeStatuses),
    [activeStatuses, bookings, visibleDays]
  );
  const gridTemplateColumns = getGridTemplate(viewMode, visibleDays.length);

  function handleGridPointerDown(event) {
    if (
      gridClickReleaseTimerRef.current
    ) {
      window.clearTimeout(
        gridClickReleaseTimerRef.current,
      );

      gridClickReleaseTimerRef.current =
        null;
    }

    suppressGridClickRef.current =
      false;

    if (
      (
        event.pointerType !== 'touch' &&
        event.pointerType !== 'pen'
      ) ||
      !event.isPrimary
    ) {
      return;
    }

    const scrollContainer =
      gridScrollRef.current;

    if (!scrollContainer) return;

    gridGestureRef.current = {
      axis: 'pending',
      didDrag: false,
      pointerId: event.pointerId,
      startScrollLeft:
        scrollContainer.scrollLeft,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function handleGridPointerMove(event) {
    const gesture =
      gridGestureRef.current;

    if (
      !gesture ||
      gesture.pointerId !== event.pointerId
    ) {
      return;
    }

    const deltaX =
      event.clientX -
      gesture.startX;

    const deltaY =
      event.clientY -
      gesture.startY;

    const horizontalDistance =
      Math.abs(
        deltaX,
      );

    const verticalDistance =
      Math.abs(
        deltaY,
      );

    if (
      gesture.axis === 'pending'
    ) {
      if (
        Math.max(
          horizontalDistance,
          verticalDistance,
        ) < 6
      ) {
        return;
      }

      if (
        horizontalDistance <=
        verticalDistance * 1.15
      ) {
        gesture.axis =
          'vertical';

        return;
      }

      gesture.axis =
        'horizontal';

      event.currentTarget
        .setPointerCapture?.(
          event.pointerId,
        );

      event.currentTarget
        .classList
        .add(
          'is-horizontal-dragging',
        );
    }

    if (
      gesture.axis !== 'horizontal'
    ) {
      return;
    }

    event.preventDefault();

    const scrollContainer =
      gridScrollRef.current;

    if (!scrollContainer) return;

    const maxScrollLeft =
      Math.max(
        0,
        scrollContainer.scrollWidth -
          scrollContainer.clientWidth,
      );

    scrollContainer.scrollLeft =
      Math.min(
        maxScrollLeft,
        Math.max(
          0,
          gesture.startScrollLeft -
            deltaX,
        ),
      );

    gesture.didDrag =
      gesture.didDrag ||
      horizontalDistance >= 8;
  }

  function finishGridPointerGesture(
    event,
  ) {
    const gesture =
      gridGestureRef.current;

    if (
      !gesture ||
      gesture.pointerId !== event.pointerId
    ) {
      return;
    }

    event.currentTarget
      .classList
      .remove(
        'is-horizontal-dragging',
      );

    if (
      event.currentTarget
        .hasPointerCapture?.(
          event.pointerId,
        )
    ) {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId,
        );
    }

    if (
      gesture.didDrag
    ) {
      suppressGridClickRef.current =
        true;

      gridClickReleaseTimerRef.current =
        window.setTimeout(
          () => {
            suppressGridClickRef.current =
              false;

            gridClickReleaseTimerRef.current =
              null;
          },
          400,
        );
    }

    gridGestureRef.current =
      null;
  }

  function handleGridClickCapture(event) {
    if (
      !suppressGridClickRef.current
    ) {
      return;
    }

    suppressGridClickRef.current =
      false;

    if (
      gridClickReleaseTimerRef.current
    ) {
      window.clearTimeout(
        gridClickReleaseTimerRef.current,
      );

      gridClickReleaseTimerRef.current =
        null;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  useEffect(() => {
    return () => {
      if (
        gridClickReleaseTimerRef.current
      ) {
        window.clearTimeout(
          gridClickReleaseTimerRef.current,
        );
      }
    };
  }, []);

  useEffect(() => {
    if (!todayFocusRequest || !todayFocusDateIso) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const scrollContainer = gridScrollRef.current;
      const target = focusDayRef.current;

      if (!scrollContainer || !target) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const stickyTimeColumnWidth = Number.parseFloat(window.getComputedStyle(scrollContainer).getPropertyValue('--schedule-time-col')) || 62;
      const targetLeft =
        scrollContainer.scrollLeft +
        targetRect.left -
        containerRect.left -
        stickyTimeColumnWidth -
        8;

      scrollContainer.scrollIntoView({
        behavior: getScheduleScrollBehavior(),
        block: 'nearest',
        inline: 'nearest',
      });

      scrollContainer.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: getScheduleScrollBehavior(),
      });

      target.focus({ preventScroll: true });
      target.classList.remove('is-today-focus-pulse');
      void target.offsetWidth;
      target.classList.add('is-today-focus-pulse');
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [todayFocusDateIso, todayFocusRequest]);

  return (
    <section
      aria-label="Calendar grid"
      className="schedule-grid-shell"
      data-calendar-view={viewMode}
    >
      <header
        aria-label="Konteks tanggal kalender mobile"
        className="schedule-mobile-date-strip"
      >
        <span className="schedule-mobile-date-copy">
          <small>
            {viewMode === 'day'
              ? 'Hari dipilih'
              : viewMode === 'week'
                ? 'Minggu aktif'
                : 'Bulan aktif'}
          </small>

          <strong>
            {formatRangeLabel(
              selectedDate,
              viewMode,
            )}
          </strong>
        </span>

        <span
          className="schedule-mobile-gesture-hint"
          id="schedule-grid-gesture-hint"
        >
          <em>Geser grid</em>
          <ChevronRight aria-hidden="true" size={13} />
        </span>
      </header>

      <div
        aria-describedby="schedule-grid-gesture-hint"
        aria-label="Grid jadwal. Geser horizontal untuk melihat tanggal lain."
        className={
          'schedule-grid-scroll ' +
          (viewMode === 'month' ? 'is-month-scroll' : '')
        }
        onClickCapture={
          handleGridClickCapture
        }
        onPointerCancel={
          finishGridPointerGesture
        }
        onPointerDown={
          handleGridPointerDown
        }
        onPointerMove={
          handleGridPointerMove
        }
        onPointerUp={
          finishGridPointerGesture
        }
        ref={gridScrollRef}
        tabIndex={0}
      >
        <div
          className={'schedule-grid schedule-grid--' + viewMode}
          style={{ gridTemplateColumns }}
        >
          <div
            className="schedule-grid-corner"
            style={{ gridColumn: '1', gridRow: '1' }}
          >
            <span>{viewMode === 'month' ? monthNames[selectedDate.getMonth()] : 'Jam'}</span>
          </div>

          {visibleDays.map((day, dayIndex) => {
            const dayIso = toIsoDate(day);
            const isToday = isSameDay(day, today);
            const isSelectedDay = dayIso === selectedDayIso;
            const isFocusDay = dayIso === todayFocusDateIso;
            const dayHeadClassName = [
              'schedule-day-head',
              isToday ? 'is-today' : '',
              isSelectedDay ? 'is-selected' : '',
              isFocusDay ? 'is-focus-target' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                className={dayHeadClassName}
                data-calendar-day={dayIso}
                data-today-focus={isFocusDay ? 'true' : undefined}
                key={dayIso}
                ref={isFocusDay ? focusDayRef : null}
                style={{ gridColumn: String(dayIndex + 2), gridRow: '1' }}
                tabIndex={isFocusDay ? -1 : undefined}
              >
                <span>{dayNames[day.getDay()]}</span>
                <strong>{day.getDate()}</strong>
              </div>
            );
          })}

          {businessHours.map((hour, hourIndex) => (
            <Fragment key={hour.key}>
              <div
                className="schedule-time-cell"
                style={{ gridColumn: '1', gridRow: String(hourIndex + 2) }}
              >
                <Clock3 size={12} aria-hidden="true" />
                <span>{hour.shortLabel || hour.label || hour.rangeLabel || hour.description}</span>
              </div>

              {visibleDays.map((day, dayIndex) => {
                const cellKey = toIsoDate(day) + '-' + hour.key;

                return (
                  <div
                    className="schedule-slot-cell"
                    key={cellKey}
                    style={{ gridColumn: String(dayIndex + 2), gridRow: String(hourIndex + 2) }}
                  >
                    <button
                      aria-label={'Tambah booking ' + toIsoDate(day) + ' jam ' + hour.label}
                      className="schedule-slot-button"
                      type="button"
                      onClick={() => onSlotClick({ date: toIsoDate(day), startHour: String(hour.start) })}
                    >
                      <span className="schedule-slot-add-hint" aria-hidden="true">+</span>
                    </button>
                  </div>
                );
              })}
            </Fragment>
          ))}

          {bookingBlocks.map((block) => (
            <CalendarBookingBlock
              block={block}
              key={block.booking.id || block.dayKey + '-' + block.startIndex + '-' + block.booking.customer}
              onBookingClick={onBookingClick}
              operatorFeeVisibility={
                getOperatorFeeVisibility
                  ? getOperatorFeeVisibility(
                      block.booking,
                    )
                  : null
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function SchedulePage({
  currentUser,
}) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState(getInitialScheduleViewMode);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [activeStatuses, setActiveStatuses] = useState(() => statusFilters.map((item) => item.key));
  const [bookings, setBookings] = useState(() => isScheduleQaPreview ? SCHEDULE_QA_PREVIEW_BOOKINGS : []);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingInitialSlot, setBookingInitialSlot] = useState(null);
  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null);
  const [operatorFeeEntries, setOperatorFeeEntries] = useState([]);
  const [editingBooking, setEditingBooking] = useState(null);
  const [scheduleToast, setScheduleToast] = useState(null);
  const [todayFocusRequest, setTodayFocusRequest] = useState(0);
  const [isScheduleLoading, setIsScheduleLoading] = useState(
    () => !isScheduleQaPreview,
  );

  const canViewOperatorFee =
    hasAdminPagePermission(
      currentUser,
      'operator-fee',
    );

  // One-time local storage migration to Firestore
  useEffect(() => {
    if (isScheduleQaPreview) return undefined;

    const local = readStoredBookings();
    if (local && local.length > 0) {
      adminBookingRepository.migrateLocalBookingsToFirestore(local)
        .catch((err) => console.error('Gagal melakukan migrasi data lokal:', err));
    }
  }, []);

  const dateRange = useMemo(() => {
    let start, end;
    if (viewMode === 'day') {
      start = selectedDate;
      end = selectedDate;
    } else if (viewMode === 'week') {
      start = getWeekStart(selectedDate);
      end = addDays(start, 6);
    } else {
      start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), getDaysInMonth(selectedDate));
    }
    return {
      startDate: toIsoDate(start),
      endDate: toIsoDate(end)
    };
  }, [selectedDate, viewMode]);

  // Subscribe to real-time Firestore bookings
  useEffect(() => {
    if (isScheduleQaPreview) return undefined;

    const unsubscribe = adminBookingRepository.subscribeManualBookings(
      {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      },
      (data) => {
        setBookings(data);
        setIsScheduleLoading(false);
      },
      (_err) => {
        setIsScheduleLoading(false);

        setScheduleToast({
          kind: 'warning',
          title: 'Database Terputus',
          message: 'Koneksi Firestore terganggu. Data mungkin tidak mutakhir.'
        });
      }
    );
    return unsubscribe;
  }, [dateRange]);

  useEffect(() => {
    if (
      isScheduleQaPreview ||
      !canViewOperatorFee
    ) {
      return undefined;
    }

    return subscribeOperatorFeeEntries(
      (
        nextEntries,
      ) => {
        setOperatorFeeEntries(
          Array.isArray(
            nextEntries,
          )
            ? nextEntries
            : [],
        );
      },
      (
        error,
      ) => {
        console.error(
          '[schedule] Gagal membaca Operator Fee visibility:',
          error,
        );
      },
    );
  }, [
    canViewOperatorFee,
  ]);

  function resolveOperatorFeeVisibility(
    booking,
  ) {
    if (
      !canViewOperatorFee
    ) {
      return null;
    }

    return getBookingOperatorFeeVisibility(
      operatorFeeEntries,
      booking,
    );
  }

  const rangeLabel = formatRangeLabel(selectedDate, viewMode);
  const paymentStatusCounts = useMemo(() => {
    const counts = statusFilters.reduce((nextCounts, item) => {
      nextCounts[item.key] = 0;
      return nextCounts;
    }, {});

    bookings.forEach((booking) => {
      const status = getBookingStatus(booking);

      if (counts[status] !== undefined) {
        counts[status] += 1;
      }
    });

    return counts;
  }, [bookings]);
  const todayIsoDate = toIsoDate(startOfDay(new Date()));

  useEffect(() => {
    if (!scheduleToast) return undefined;
    const toastTimerId = window.setTimeout(
      () => setScheduleToast(null),
      scheduleToast.kind === 'warning' ? 6500 : 3600
    );
    return () => {
      window.clearTimeout(toastTimerId);
    };
  }, [scheduleToast]);

  function moveCalendar(direction) {
    setSelectedDate((current) => shiftDate(current, viewMode, direction));
  }

  function goToday() {
    const todayDate = startOfDay(new Date());
    setSelectedDate(todayDate);
    setTodayFocusRequest((current) => current + 1);
  }

  function toggleStatusFilter(status) {
    setActiveStatuses((current) => (
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status]
    ));
  }

  function openBookingModal(slot) {
    setEditingBooking(null);
    setBookingInitialSlot(slot || { date: toIsoDate(selectedDate), startHour: '10' });
    setIsBookingModalOpen(true);
  }

  function closeBookingModal() {
    setIsBookingModalOpen(false);
    setEditingBooking(null);
  }

  function openBookingDetail(booking) {
    setSelectedBookingDetail(booking);
  }

  function closeBookingDetail() {
    setSelectedBookingDetail(null);
  }

  function openRequestInbox() {
    navigate(
      REQUEST_INBOX_PATH,
    );
  }
  function editBookingFromDetail(booking) {
    setSelectedBookingDetail(null);
    setEditingBooking(booking);
    setBookingInitialSlot({ date: booking.date, startHour: String(booking.startHour) });
    setIsBookingModalOpen(true);
  }

  async function saveBooking(booking) {
    const conflictIssue = getBookingConflictIssue(booking, bookings);
    if (conflictIssue) {
      setScheduleToast(conflictIssue);
      return false;
    }

    const customerIdentity = resolveBookingCustomerIdentity(booking, bookings);
    let nextBooking = {
      ...booking,
      customerId: customerIdentity.customerId,
      customerPhoneKey: customerIdentity.phoneKey,
    };

    if (customerIdentity.needsConfirmation) {
      const shouldMergeCustomer = window.confirm(
        'Nomor WA ini sudah terdaftar atas nama ' +
          customerIdentity.existingCustomerName +
          '.\n\nOK = update/gabung ke customer lama.\nCancel = buat customer baru dengan nomor yang sama.'
      );

      nextBooking = {
        ...nextBooking,
        customerId: shouldMergeCustomer ? customerIdentity.customerId : customerIdentity.newCustomerId,
        customerIdentityMode: shouldMergeCustomer ? 'merge-existing-phone' : 'same-phone-new-customer',
      };
    }

    try {
      const linkedCustomer = await adminCustomerRepository.findCustomerByPhone(nextBooking.phone);
      if (linkedCustomer) {
        nextBooking = {
          ...nextBooking,
          customerId: linkedCustomer.id,
          clientUid: linkedCustomer.authUid || nextBooking.clientUid || '',
          email: linkedCustomer.email || nextBooking.email || '',
        };
      }

      if (editingBooking?.id) {
        await adminBookingRepository.updateManualBooking(nextBooking);
      } else {
        await adminBookingRepository.createManualBooking(nextBooking);
      }

      setScheduleToast(getBookingSavedToast(nextBooking));
      return true;
    } catch (err) {
      console.error('Error saving booking to Firestore:', err);
      setScheduleToast({
        kind: 'warning',
        title: 'Gagal Menyimpan',
        message: 'Koneksi ke Firestore bermasalah.'
      });
      return false;
    }
  }

  return (
    <section
      aria-labelledby="schedule-calendar-title"
      className="schedule-page"
      data-calendar-view={viewMode}
      data-schedule-mobile-ui="ui-3m-planning-deck"
      data-schedule-ui="ui-3-spatial"
    >
      <header className="schedule-editorial-header">
        <div className="schedule-editorial-copy">
          <span className="schedule-kicker">
            Studio scheduling board
          </span>

          <h2 id="schedule-calendar-title">
            {rangeLabel}
          </h2>

          <p>
            Lihat slot studio, booking aktif, status pembayaran, dan
            konteks operasional tanpa kehilangan ritme jadwal.
          </p>
        </div>

        <div
          aria-label={
            bookings.length +
            ' booking pada rentang aktif'
          }
          className="schedule-range-object"
        >
          <Clock3
            aria-hidden="true"
            size={18}
            strokeWidth={2}
          />

          <span>
            <small>
              Rentang aktif
            </small>

            <strong>
              {bookings.length}
            </strong>

            <em>
              booking terbaca
            </em>
          </span>
        </div>
      </header>

      <section
        aria-label="Kontrol scheduling board"
        className="schedule-command-shelf"
      >
        <div className="schedule-command-primary">
          <div
            aria-label="Navigasi tanggal"
            className="schedule-nav"
            role="group"
          >
            <button
              aria-label="Periode sebelumnya"
              type="button"
              onClick={() =>
                moveCalendar(
                  -1,
                )
              }
            >
              <ChevronLeft
                aria-hidden="true"
                size={15}
              />
            </button>

            <button
              className="schedule-today-button"
              type="button"
              onClick={
                goToday
              }
            >
              Hari ini
            </button>

            <button
              aria-label="Periode berikutnya"
              type="button"
              onClick={() =>
                moveCalendar(
                  1,
                )
              }
            >
              <ChevronRight
                aria-hidden="true"
                size={15}
              />
            </button>
          </div>

          <div
            aria-label="Mode kalender"
            className="schedule-view-switcher"
            role="group"
          >
            {viewModes.map(
              (
                mode,
              ) => {
                const isActive =
                  viewMode ===
                  mode.key;

                return (
                  <button
                    aria-pressed={
                      isActive
                    }
                    className={
                      isActive
                        ? 'is-active'
                        : ''
                    }
                    key={
                      mode.key
                    }
                    type="button"
                    onClick={() =>
                      setViewMode(
                        mode.key,
                      )
                    }
                  >
                    {mode.label}
                  </button>
                );
              },
            )}
          </div>
        </div>

        <div className="schedule-command-actions">
          <button
            className="schedule-add-button"
            type="button"
            onClick={() =>
              openBookingModal()
            }
          >
            <Plus
              aria-hidden="true"
              size={15}
            />

            <span>
              Tambah Booking
            </span>
          </button>

          <button
            aria-label="Buka Request Inbox"
            className="schedule-request-button"
            type="button"
            onClick={
              openRequestInbox
            }
          >
            <Inbox
              aria-hidden="true"
              size={15}
            />

            <span>
              Requests
            </span>
          </button>
        </div>

        <div
          aria-label="Filter status pembayaran"
          className="schedule-status-row"
          role="group"
        >
          {statusFilters.map(
            (
              item,
            ) => {
              const isActive =
                activeStatuses.includes(
                  item.key,
                );

              return (
                <button
                  aria-pressed={
                    isActive
                  }
                  className={
                    'schedule-status-filter is-' +
                    item.key +
                    (
                      isActive
                        ? ' is-active'
                        : ''
                    )
                  }
                  key={
                    item.key
                  }
                  type="button"
                  onClick={() =>
                    toggleStatusFilter(
                      item.key,
                    )
                  }
                >
                  <span
                    aria-hidden="true"
                    className="schedule-status-dot"
                  />

                  <span>
                    {item.label}
                  </span>

                  <strong>
                    {paymentStatusCounts[
                      item.key
                    ] || 0}
                  </strong>
                </button>
              );
            },
          )}
        </div>
      </section>

      {isScheduleLoading ? (
        <ScheduleLoading />
      ) : (
        <div className="schedule-workspace">
          <div className="schedule-calendar-surface">
            <CalendarGrid
              activeStatuses={activeStatuses}
              bookings={bookings}
              getOperatorFeeVisibility={resolveOperatorFeeVisibility}
              onBookingClick={openBookingDetail}
              selectedDate={selectedDate}
              todayFocusDateIso={todayIsoDate}
              todayFocusRequest={todayFocusRequest}
              viewMode={viewMode}
              onSlotClick={openBookingModal}
            />
          </div>

          <ScheduleUpcomingTable
            bookings={bookings}
            getOperatorFeeVisibility={resolveOperatorFeeVisibility}
            onBookingClick={openBookingDetail}
          />
        </div>
      )}

      <BookingFormModal
        editingBooking={editingBooking}
        initialSlot={bookingInitialSlot}
        isOpen={isBookingModalOpen}
        onClose={closeBookingModal}
        onSave={saveBooking}
      />

      <BookingDetailDrawer
        booking={selectedBookingDetail}
        isOpen={Boolean(selectedBookingDetail)}
        onClose={closeBookingDetail}
        onEdit={editBookingFromDetail}
        operatorFeeVisibility={
          selectedBookingDetail
            ? resolveOperatorFeeVisibility(
                selectedBookingDetail,
              )
            : null
        }
      />

      {scheduleToast ? (
        <aside
          aria-live={scheduleToast.kind === 'warning' ? 'assertive' : 'polite'}
          className={'schedule-toast is-' + scheduleToast.kind}
          role={scheduleToast.kind === 'warning' ? 'alert' : 'status'}
        >
          <span className="schedule-toast-orb" aria-hidden="true" />
          <span className="schedule-toast-copy">
            <strong>{scheduleToast.title}</strong>
            <span>{scheduleToast.message}</span>
            {scheduleToast.meta ? <small>{scheduleToast.meta}</small> : null}
          </span>
          <button
            aria-label="Tutup notifikasi"
            className="schedule-toast-close"
            type="button"
            onClick={() => setScheduleToast(null)}
          >
            ×
          </button>
        </aside>
      ) : null}
    </section>
  );
}
