import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageCircle,
  Plus,
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

const monthNames = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const shortMonthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
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

    return start.getDate() + ' ' + shortMonthNames[start.getMonth()] + ' - ' + end.getDate() + ' ' + shortMonthNames[end.getMonth()] + ' ' + end.getFullYear();
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
  if (viewMode === 'day') return '112px minmax(280px, 1fr)';
  if (viewMode === 'week') return '112px repeat(' + visibleDayCount + ', minmax(126px, 1fr))';

  return '112px repeat(' + visibleDayCount + ', minmax(92px, 1fr))';
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
  return formatHourLabel(getBookingStartHour(booking)) + '-' + formatHourLabel(getBookingEndHour(booking));
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
    booking?.source === 'clientPortal' &&
    ['submitted', 'rejected', 'cancelled'].includes(requestStatus)
  );
}

function isBookingScheduleActive(booking) {
  const status = String(getBookingStatus(booking)).toLowerCase();

  if (shouldHideBookingFromCalendarGrid(booking)) return false;

  return !['cancelled', 'canceled', 'void', 'deleted'].includes(status);
}

function doBookingIntervalsOverlap(firstBooking, secondBooking) {
  if (firstBooking.date !== secondBooking.date) return false;

  const firstStart = getBookingStartHour(firstBooking);
  const firstEnd = getBookingEndHour(firstBooking);
  const secondStart = getBookingStartHour(secondBooking);
  const secondEnd = getBookingEndHour(secondBooking);

  return Math.max(firstStart, secondStart) < Math.min(firstEnd, secondEnd);
}

function getBookingConflictIssue(nextBooking, currentBookings) {
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

  return (
    <button
      aria-label={'Booking ' + booking.customer + ' ' + startLabel + ' ' + durationLabel}
      className={'schedule-booking-block is-' + block.status + (hasUnreadClientMessage ? ' has-client-message' : '')}
      style={getBookingBlockStyle(block)}
      type="button"
      onClick={() => onBookingClick(booking)}
    >
      <span className="schedule-booking-glow" aria-hidden="true" />
      <span className="schedule-booking-topline">
        <strong>{booking.customer}</strong>
        <em>{isNewClientRequest ? 'Request' : statusLabel}</em>
      </span>
      <span className="schedule-booking-title">{title}</span>
      <span className="schedule-booking-meta">
        <span>{startLabel} • {durationLabel}</span>
        <b>{priceLabel}</b>
      </span>
      {hasUnreadClientMessage ? <i className="schedule-booking-message-dot" aria-label="Pesan client belum dibaca" /> : null}
    </button>
  );
}

function RequestQueueModal({ isOpen, onClose, onOpenRequest, requests }) {
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
            <MessageCircle size={16} />
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

              return (
                <button
                  className={'schedule-request-card ' + (isCancellation ? 'is-cancellation' : 'is-submitted')}
                  key={booking.id}
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
      const targetLeft =
        scrollContainer.scrollLeft +
        targetRect.left -
        containerRect.left -
        containerRect.width / 2 +
        targetRect.width / 2;

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
      <div className="schedule-grid-scroll" ref={gridScrollRef}>
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
            <div className="schedule-row-fragment" key={hour.key}>
              <div
                className="schedule-time-cell"
                style={{ gridColumn: '1', gridRow: String(hourIndex + 2) }}
              >
                <Clock3 size={14} aria-hidden="true" />
                <span>{hour.rangeLabel || hour.description || hour.label}</span>
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
            </div>
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
  const [bookings, setBookings] = useState([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingInitialSlot, setBookingInitialSlot] = useState(null);
  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [scheduleToast, setScheduleToast] = useState(null);
  const [todayFocusRequest, setTodayFocusRequest] = useState(0);
  const [isRequestListOpen, setIsRequestListOpen] = useState(false);

  // One-time local storage migration to Firestore
  useEffect(() => {
    const local = readStoredBookings();
    if (local && local.length > 0) {
      adminBookingRepository.migrateLocalBookingsToFirestore(local)
        .catch((err) => console.error('Gagal melakukan migrasi data lokal:', err));
    }
  }, []);

  // Subscribe to real-time Firestore bookings
  useEffect(() => {
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

    return {
      counts,
      visibleCount,
    };
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
      <div className="schedule-toolbar">
        <div className="schedule-title-block">
          <h2 id="schedule-calendar-title">{rangeLabel}</h2>
        </div>

        <div className="schedule-actions" aria-label="Kontrol kalender">
          <div className="schedule-primary-controls">
            <StudioSelect
              label="View Mode"
              options={viewModes}
              selectedKey={viewMode}
              onChange={setViewMode}
            />

            <button className="schedule-add-button" type="button" onClick={() => openBookingModal()}>
              <Plus size={17} />
              Tambah
            </button>
          </div>

          <StudioSelect
            label="Quick Filter"
            helper={visibleBookingCount + ' tampil'}
            multiple
            options={statusFilters}
            placeholder="Tidak ada status"
            selectedKeys={activeStatuses}
            onChange={setActiveStatuses}
          />

          <div className="schedule-payment-counters" aria-label="Ringkasan status pembayaran">
            {statusFilters.map((item, index) => (
              <span className={'schedule-payment-counter is-' + item.key} key={item.key}>
                <span>{item.label}</span>
                <strong>{paymentStatusCounts[item.key] || 0}</strong>
                {index < statusFilters.length - 1 ? <i aria-hidden="true">|</i> : null}
              </span>
            ))}
          </div>

          {requestBookings.length ? (
            <button className="schedule-client-request-alert" type="button" onClick={() => setIsRequestListOpen(true)}>
              <MessageCircle size={14} />
              <span>{requestBookings.length} request client</span>
            </button>
          ) : null}

          <div className="schedule-nav">
            <button type="button" aria-label="Sebelumnya" onClick={() => moveCalendar(-1)}>
              <ChevronLeft size={17} />
            </button>
            <button type="button" onClick={goToday}>Today</button>
            <button type="button" aria-label="Berikutnya" onClick={() => moveCalendar(1)}>
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </div>

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
        requests={requestBookings}
        onClose={closeRequestList}
        onOpenRequest={openRequestFromList}
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
