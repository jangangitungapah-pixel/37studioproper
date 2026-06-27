import StatusPill from '../../components/ui/StatusPill.jsx';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageCircle,
  Plus,
  X
} from 'lucide-react';
import BookingFormModal from '../../components/schedule/BookingFormModal.jsx';
import BookingDetailModal from '../../components/schedule/BookingDetailModal.jsx';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import {
  businessHours,
  statusFilters,
  viewModes,
} from './scheduleConfig.js';
import { adminBookingRepository } from '../../services/adminBookingRepository.js';
import { adminCustomerRepository } from '../../services/adminCustomerRepository.js';
import { bookingCommunicationRepository } from '../../services/bookingCommunicationRepository.js';
import { firebaseAuth } from '../../lib/firebase.js';

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
  return booking.paymentStatus || booking.status || 'pending';
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

function isUpcomingScheduleBooking(booking) {
  const status = String(getBookingStatus(booking)).toLowerCase();
  const requestStatus = String(booking?.bookingRequestStatus || '').toLowerCase();
  const startDate = getBookingStartDateTime(booking);

  if (!startDate) return false;
  if (['cancelled', 'canceled', 'void', 'deleted'].includes(status)) return false;
  if (['rejected', 'cancelled'].includes(requestStatus)) return false;

  return startDate >= new Date();
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
  const requestStatus = String(booking?.bookingRequestStatus || '').trim().toLowerCase();
  return (
    isNoDurationPackageBooking(booking) ||
    (
      booking?.source === 'clientPortal' &&
      ['submitted', 'rejected', 'cancelled'].includes(requestStatus)
    )
  );
}

function isBookingScheduleActive(booking) {
  const status = String(getBookingStatus(booking)).toLowerCase();
  if (shouldHideBookingFromCalendarGrid(booking)) return false;
  return !['cancelled', 'canceled', 'void', 'deleted'].includes(status);
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

function CalendarBookingBlock({ block, onBookingClick }) {
  const booking = block.booking;
  const title = booking.title || booking.sessionLabel || 'Booking';
  const statusLabel = getStatusLabel(block.status);
  const startLabel = booking.startTimeLabel || String(booking.startHour).padStart(2, '0') + '.00';
  const durationLabel = (Number(booking.durationHours) || block.spanRows) + 'j';
  const priceLabel = formatShortCurrency(booking.total || booking.subtotal || 0);
  
  const hasUnreadClientMessage = booking.lastMessageSenderRole === 'client' && booking.lastMessageReadByAdmin === false;
  const isNewClientRequest = booking.bookingRequestStatus === 'submitted';
  const isCancellation = booking.bookingRequestStatus === 'cancellation_requested';

  const requestClass = isCancellation 
    ? ' is-req-cancelled' 
    : isNewClientRequest 
      ? ' is-req-submitted' 
      : '';

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
        <StatusPill status={block.status}>{isNewClientRequest ? 'Request' : statusLabel}</StatusPill>
      </span>

      <span className="schedule-booking-title">{title}</span>

      <span className="schedule-booking-meta">
        <span>{startLabel} • {durationLabel}</span>
        <b>{priceLabel}</b>
      </span>

      {hasUnreadClientMessage ? (
        <i className="schedule-booking-message-dot" aria-label="Pesan client belum dibaca" />
      ) : null}
    </button>
  );
}

function RequestQueueModal({
  isOpen,
  onClose,
  onOpenRequest,
  onQuickAction,
  pendingActionKey,
  requests,
}) {
  if (!isOpen) return null;

  const sortedRequests = requests
    .slice()
    .sort((first, second) =>
      String(second.clientRequestUpdatedAt || second.createdAt || '').localeCompare(String(first.clientRequestUpdatedAt || first.createdAt || ''))
    );

  return (
    <div className="schedule-request-modal-backdrop" role="presentation">
      <section
        aria-label="Daftar request client"
        aria-modal="true"
        className="schedule-request-modal"
        role="dialog"
      >
        <header className="schedule-request-modal-header">
          <span>
            <MessageCircle size={15} />
            Request Client
          </span>
          <button aria-label="Tutup daftar request" type="button" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="schedule-request-modal-summary">
          <strong>{sortedRequests.length}</strong>
          <span>request menunggu tindakan admin</span>
        </div>

        <div className="schedule-request-list">
          {sortedRequests.length ? (
            sortedRequests.map((booking) => {
              const requestStatus = String(booking.bookingRequestStatus || 'submitted');
              const isCancellation = requestStatus === 'cancellation_requested';
              const windowLabel = getBookingWindowLabel(booking);
              const confirmStatus = isCancellation ? 'cancelled' : 'confirmed';
              const rejectStatus = isCancellation ? 'confirmed' : 'rejected';
              const confirmLabel = isCancellation ? 'Terima batal' : 'Confirm';
              const rejectLabel = isCancellation ? 'Tolak batal' : 'Reject';
              const confirmKey = booking.id + ':' + confirmStatus;
              const rejectKey = booking.id + ':' + rejectStatus;
              const isConfirming = pendingActionKey === confirmKey;
              const isRejecting = pendingActionKey === rejectKey;
              const isBusy = Boolean(pendingActionKey);

              return (
                <article
                  className={'schedule-request-card ' + (isCancellation ? 'is-cancellation' : 'is-submitted')}
                  key={booking.id}
                >
                  <button
                    className="schedule-request-card-open"
                    type="button"
                    onClick={() => onOpenRequest(booking)}
                  >
                    <span className="schedule-request-card-main">
                      <strong>{booking.customer || 'Client'}</strong>
                      <small>{booking.sessionLabel || booking.packageLabel || booking.title || 'Sesi Studio'}</small>
                      <em>{booking.date} • {windowLabel}</em>
                    </span>
                    <span className="schedule-request-card-meta">
                      <b>{isCancellation ? 'Minta batal' : 'Request baru'}</b>
                      <small>{booking.bookingCode || booking.bookingId || 'BKG'}</small>
                    </span>
                  </button>

                  <div className="schedule-request-card-actions" aria-label="Quick action request">
                    <button
                      className="is-confirm"
                      disabled={isBusy}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onQuickAction(booking, confirmStatus);
                      }}
                    >
                      {isConfirming ? '...' : confirmLabel}
                    </button>
                    <button
                      className="is-reject"
                      disabled={isBusy}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onQuickAction(booking, rejectStatus);
                      }}
                    >
                      {isRejecting ? '...' : rejectLabel}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="schedule-request-empty">Tidak ada request client.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function ScheduleUpcomingTable({ bookings, onBookingClick }) {
  const upcomingBookings = useMemo(() => getUpcomingScheduleBookings(bookings), [bookings]);
  const previewBookings = upcomingBookings.slice(0, 6);
  const mobileRemainingCount = Math.max(0, upcomingBookings.length - 2);
  const desktopRemainingCount = Math.max(0, upcomingBookings.length - previewBookings.length);

  return (
    <section className="schedule-upcoming-panel" aria-labelledby="schedule-upcoming-title">
      <header className="schedule-upcoming-head">
        <h3 id="schedule-upcoming-title">Jadwal Mendatang</h3>
        <span>{upcomingBookings.length}</span>
      </header>

      {previewBookings.length ? (
        <div className="schedule-upcoming-list" aria-label="Daftar jadwal mendatang">
          {previewBookings.map((booking) => {
            const noDurationPackage = isNoDurationPackageBooking(booking);
            const requestMeta = booking.bookingRequestStatus === 'submitted'
              ? 'Request'
              : booking.bookingRequestStatus === 'confirmed'
                ? 'Confirmed'
                : '';
            const statusText = requestMeta || getStatusLabel(getBookingStatus(booking));
            const serviceLabel = booking.packageLabel || booking.sessionLabel || booking.title || 'Sesi Studio';

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

function CalendarGrid({
  activeStatuses,
  bookings,
  onSlotClick,
  onBookingClick,
  selectedDate,
  todayFocusDateIso,
  todayFocusRequest,
  viewMode,
}) {
  const gridScrollRef = useRef(null);
  const focusDayRef = useRef(null);
  const today = startOfDay(new Date());
  const visibleDays = useMemo(() => getVisibleDays(selectedDate, viewMode), [selectedDate, viewMode]);
  const bookingBlocks = useMemo(
    () => getVisibleBookingBlocks(bookings, visibleDays, activeStatuses),
    [activeStatuses, bookings, visibleDays]
  );
  const gridTemplateColumns = getGridTemplate(viewMode, visibleDays.length);

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
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });

      scrollContainer.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: 'smooth',
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
    <section className="schedule-grid-shell" aria-label="Calendar grid">
      <div 
        className="schedule-grid-scroll overflow-x-auto scrollbar-none" 
        ref={gridScrollRef}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
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
            const isFocusDay = dayIso === todayFocusDateIso;
            const dayHeadClassName = [
              'schedule-day-head',
              isToday ? 'is-today' : '',
              isFocusDay ? 'is-focus-target' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                className={dayHeadClassName}
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
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function SchedulePage() {
  const [viewMode, setViewMode] = useState('month');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [activeStatuses, setActiveStatuses] = useState(() => statusFilters.map((item) => item.key));
  const [bookings, setBookings] = useState(() => isScheduleQaPreview ? SCHEDULE_QA_PREVIEW_BOOKINGS : []);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingInitialSlot, setBookingInitialSlot] = useState(null);
  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [scheduleToast, setScheduleToast] = useState(null);
  const [todayFocusRequest, setTodayFocusRequest] = useState(0);
  const [isRequestListOpen, setIsRequestListOpen] = useState(false);
  const [requestActionKey, setRequestActionKey] = useState('');

  // One-time local storage migration to Firestore
  useEffect(() => {
    if (isScheduleQaPreview) return undefined;

    const local = readStoredBookings();
    if (local && local.length > 0) {
      adminBookingRepository.migrateLocalBookingsToFirestore(local)
        .catch((err) => console.error('Gagal melakukan migrasi data lokal:', err));
    }
  }, []);

  // Subscribe to real-time Firestore bookings
  useEffect(() => {
    if (isScheduleQaPreview) return undefined;

    const unsubscribe = adminBookingRepository.subscribeManualBookings(
      (data) => {
        setBookings(data);
        adminBookingRepository.syncClientCalendarSlotsFromBookings(data)
          .catch((err) => console.error('Gagal sinkron slot client calendar:', err));
      },
      (_err) => {
        setScheduleToast({
          kind: 'warning',
          title: 'Database Terputus',
          message: 'Koneksi Firestore terganggu. Data mungkin tidak mutakhir.'
        });
      }
    );
    return unsubscribe;
  }, []);

  const rangeLabel = formatRangeLabel(selectedDate, viewMode);
  const scheduleStats = useMemo(() => {
    const counts = statusFilters.reduce((nextCounts, item) => {
      nextCounts[item.key] = 0;
      return nextCounts;
    }, {});
    let visibleCount = 0;

    bookings.forEach((booking) => {
      const status = getBookingStatus(booking);
      if (counts[status] !== undefined) {
        counts[status] += 1;
      }
      if (activeStatuses.includes(status)) {
        visibleCount += 1;
      }
    });

    return { counts, visibleCount };
  }, [activeStatuses, bookings]);

  const visibleBookingCount = scheduleStats.visibleCount;
  const paymentStatusCounts = scheduleStats.counts;
  const requestBookings = useMemo(
    () => bookings
      .filter((booking) => ['submitted', 'cancellation_requested'].includes(booking.bookingRequestStatus))
      .sort((first, second) =>
        String(second.clientRequestUpdatedAt || second.createdAt || '').localeCompare(String(first.clientRequestUpdatedAt || first.createdAt || ''))
      ),
    [bookings]
  );
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

  function closeRequestList() {
    setIsRequestListOpen(false);
  }

  function openRequestFromList(booking) {
    setIsRequestListOpen(false);
    openBookingDetail(booking);
  }

  async function handleQuickRequestAction(booking, status) {
    if (!booking?.id || requestActionKey) return;
    const actionKey = booking.id + ':' + status;
    setRequestActionKey(actionKey);
    try {
      await updateClientRequestStatus(booking, status);
    } catch {
      // Handled
    } finally {
      setRequestActionKey('');
    }
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

    const customerIdentity = resolveBookingCustomerIdentity(booking, current => bookings);
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

  async function updateClientRequestStatus(booking, status) {
    try {
      await bookingCommunicationRepository.updateBookingRequestStatus({
        booking,
        status,
        user: firebaseAuth?.currentUser,
      });
      setSelectedBookingDetail((current) => current?.id === booking.id
        ? { ...current, bookingRequestStatus: status }
        : current);
      setScheduleToast({
        kind: 'success',
        title: 'Status Client Diperbarui',
        message: status === 'confirmed' ? 'Booking sudah dikonfirmasi ke client.' : 'Keputusan admin sudah dikirim ke portal client.',
      });
    } catch (error) {
      console.error('Gagal memperbarui status request client:', error);
      setScheduleToast({ kind: 'warning', title: 'Gagal Memperbarui', message: 'Status request client belum tersimpan.' });
      throw error;
    }
  }

  return (
    <section className="schedule-page" aria-labelledby="schedule-calendar-title">
      {/* CSS overrides for high-density mobile layout optimization */}
      <style>{`
        /* Default styles for desktop helper classes */
        .schedule-booking-status-dot {
          display: none;
        }

        @media (max-width: 767px) {
          .schedule-grid {
            grid-template-rows: 32px repeat(13, minmax(34px, 1fr)) !important;
          }
          .schedule-day-head {
            padding: 2px !important;
            min-height: 32px !important;
          }
          .schedule-day-head span {
            font-size: 8px !important;
          }
          .schedule-day-head strong {
            font-size: 11px !important;
          }
          .schedule-time-cell {
            font-size: 8px !important;
            padding: 2px !important;
          }
          .schedule-time-cell svg {
            width: 10px !important;
            height: 10px !important;
          }
          .schedule-slot-cell {
            border-bottom: 1px solid var(--auth-border) !important;
            border-right: 1px solid var(--auth-border) !important;
          }
          
          /* Booking block mobile adjustments */
          .schedule-booking-block {
            border-radius: 4px !important;
            box-shadow: none !important;
            padding: 2px 4px !important;
            margin: 1px !important;
            border-left-width: 2px !important;
            gap: 0px !important;
          }
          .schedule-booking-topline {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 2px !important;
          }
          .schedule-booking-topline strong {
            font-size: 9px !important;
            line-height: 1.1 !important;
            letter-spacing: -0.02em !important;
          }
          .schedule-booking-topline .status-pill {
            display: none !important;
          }
          .schedule-booking-status-dot {
            display: inline-block !important;
            width: 5px !important;
            height: 5px !important;
            border-radius: 50% !important;
            flex-shrink: 0 !important;
          }
          .schedule-booking-block.is-lunas .schedule-booking-status-dot {
            background-color: #4ade80 !important;
          }
          .schedule-booking-block.is-dp .schedule-booking-status-dot {
            background-color: #fb923c !important;
          }
          .schedule-booking-block.is-pending .schedule-booking-status-dot {
            background-color: #fbbf24 !important;
          }
          .schedule-booking-block.is-req-cancelled .schedule-booking-status-dot {
            background-color: #ef4444 !important;
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          .schedule-booking-block.is-req-submitted .schedule-booking-status-dot {
            background-color: #fbbf24 !important;
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          .schedule-booking-title {
            font-size: 8px !important;
            line-height: 1.1 !important;
            color: var(--auth-text-main) !important;
            margin-top: 1px !important;
          }
          .schedule-booking-meta {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            font-size: 8px !important;
            line-height: 1.1 !important;
            margin-top: 1px !important;
          }
          .schedule-booking-meta b {
            font-size: 8px !important;
            color: var(--auth-text-main) !important;
          }
          .schedule-booking-message-dot {
            top: 2px !important;
            right: 2px !important;
            width: 5px !important;
            height: 5px !important;
          }
        }
      `}</style>

      {/* Symmetrical & Balanced Controls Toolbar (No horizontal scroll, fully responsive) */}
      <div className="schedule-toolbar bg-[#0b0c0e]/80 backdrop-blur-md border border-white/5 p-3 md:p-4 rounded-xl flex flex-col gap-3">
        {/* Client Request Banner at the Top */}
        {requestBookings.length ? (
          <button 
            className="w-full py-1.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-extrabold flex items-center justify-between transition-all animate-pulse" 
            type="button" 
            onClick={() => setIsRequestListOpen(true)}
          >
            <span className="flex items-center gap-1.5">
              <MessageCircle size={12} />
              Ada {requestBookings.length} request pemesanan baru
            </span>
            <span className="text-[9px] uppercase tracking-wider text-red-400/80">Lihat &rarr;</span>
          </button>
        ) : null}

        {/* Row 1: Title & Navigation Controls */}
        <div className="flex items-center justify-between gap-3 w-full">
          <h2 id="schedule-calendar-title" className="text-sm md:text-base font-extrabold text-white truncate max-w-[140px] xs:max-w-none">
            {rangeLabel}
          </h2>

          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 shrink-0">
            <button 
              type="button" 
              aria-label="Sebelumnya" 
              onClick={() => moveCalendar(-1)}
              className="w-7 h-7 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            <button 
              type="button" 
              onClick={goToday}
              className="px-2.5 h-7 flex items-center justify-center rounded text-[9px] font-extrabold uppercase tracking-wide text-white/70 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            >
              Hari ini
            </button>
            <button 
              type="button" 
              aria-label="Berikutnya" 
              onClick={() => moveCalendar(1)}
              className="w-7 h-7 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Row 2: View Switchers & Creation Button */}
        <div className="flex items-center justify-between gap-3 w-full">
          {/* Segmented View Switcher */}
          <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10 flex-1 max-w-[200px]">
            {viewModes.map((mode) => (
              <button
                key={mode.key}
                onClick={() => setViewMode(mode.key)}
                className={`flex-1 py-1 text-center rounded text-[9px] font-bold uppercase transition-all ${
                  viewMode === mode.key 
                    ? 'bg-[#ff8a2a] text-black font-extrabold shadow-sm' 
                    : 'text-white/60 hover:text-white'
                }`}
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button 
            className="px-3.5 h-8 flex items-center justify-center gap-1.5 bg-[#ff8a2a] text-black rounded-lg text-[10px] font-extrabold active:scale-95 transition-all shrink-0" 
            type="button" 
            onClick={() => openBookingModal()}
          >
            <Plus size={13} />
            <span>Tambah</span>
          </button>
        </div>

        {/* Row 3: Status Filters (Balanced full-width grid) */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {statusFilters.map((item) => {
            const isActive = activeStatuses.includes(item.key);

            return (
              <button
                aria-pressed={isActive}
                className={`h-7.5 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  isActive 
                    ? item.key === 'lunas' 
                      ? 'bg-green-500/10 border-green-500/30 text-green-400 font-extrabold'
                      : item.key === 'dp'
                        ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 font-extrabold'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-extrabold'
                    : 'bg-[#15171c] border-white/5 text-slate-500 hover:text-slate-400'
                }`}
                key={item.key}
                type="button"
                onClick={() => toggleStatusFilter(item.key)}
              >
                <span className={`w-1 h-1 rounded-full ${
                  item.key === 'lunas' 
                    ? 'bg-green-400' 
                    : item.key === 'dp' 
                      ? 'bg-orange-400' 
                      : 'bg-amber-400'
                }`} />
                <span>{item.label}</span>
                <strong className="opacity-70">({paymentStatusCounts[item.key] || 0})</strong>
              </button>
            );
          })}
        </div>
      </div>

      <div className="schedule-workspace">
        <ScheduleUpcomingTable
          bookings={bookings}
          onBookingClick={openBookingDetail}
        />

        <div className="schedule-calendar-surface">
          <CalendarGrid
            activeStatuses={activeStatuses}
            bookings={bookings}
            onBookingClick={openBookingDetail}
            selectedDate={selectedDate}
            todayFocusDateIso={todayIsoDate}
            todayFocusRequest={todayFocusRequest}
            viewMode={viewMode}
            onSlotClick={openBookingModal}
          />
        </div>
      </div>

      <BookingFormModal
        editingBooking={editingBooking}
        initialSlot={bookingInitialSlot}
        isOpen={isBookingModalOpen}
        onClose={closeBookingModal}
        onSave={saveBooking}
      />

      <BookingDetailModal
        booking={selectedBookingDetail}
        isOpen={Boolean(selectedBookingDetail)}
        onClose={closeBookingDetail}
        onEdit={editBookingFromDetail}
        onRequestStatusChange={updateClientRequestStatus}
      />

      <RequestQueueModal
        isOpen={isRequestListOpen}
        pendingActionKey={requestActionKey}
        requests={requestBookings}
        onClose={closeRequestList}
        onOpenRequest={openRequestFromList}
        onQuickAction={handleQuickRequestAction}
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
