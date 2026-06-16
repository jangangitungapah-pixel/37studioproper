import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
} from 'lucide-react';
import BookingFormModal from '../../components/schedule/BookingFormModal.jsx';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import {
  businessHours,
  statusFilters,
  viewModes,
} from './scheduleConfig.js';

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

function getBookingForSlot(bookings, day, hour, enabledStatuses) {
  return bookings.find((booking) => {
    const bookingDate = startOfDay(new Date(booking.date));
    return (
      isSameDay(bookingDate, day) &&
      Number(booking.startHour) === hour &&
      enabledStatuses.includes(booking.status)
    );
  });
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

function CalendarGrid({
  activeStatuses,
  bookings,
  onSlotClick,
  selectedDate,
  viewMode,
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const visibleDays = useMemo(() => getVisibleDays(selectedDate, viewMode), [selectedDate, viewMode]);
  const gridTemplateColumns = getGridTemplate(viewMode, visibleDays.length);

  return (
    <section className="schedule-grid-shell" aria-label="Calendar grid">
      <div className="schedule-grid-scroll">
        <div
          className={'schedule-grid schedule-grid--' + viewMode}
          style={{ gridTemplateColumns }}
        >
          <div className="schedule-grid-corner">
            <span>{viewMode === 'month' ? monthNames[selectedDate.getMonth()] : 'Jam'}</span>
          </div>

          {visibleDays.map((day) => {
            const isToday = isSameDay(day, today);

            return (
              <div
                className={isToday ? 'schedule-day-head is-today' : 'schedule-day-head'}
                key={toIsoDate(day)}
              >
                <span>{dayNames[day.getDay()]}</span>
                <strong>{day.getDate()}</strong>
              </div>
            );
          })}

          {businessHours.map((hour) => (
            <div className="schedule-row-fragment" key={hour.key}>
              <div className="schedule-time-cell">
                <Clock3 size={14} aria-hidden="true" />
                <span>{hour.rangeLabel || hour.description || hour.label}</span>
              </div>

              {visibleDays.map((day) => {
                const booking = getBookingForSlot(bookings, day, hour.start, activeStatuses);
                const cellKey = toIsoDate(day) + '-' + hour.key;

                return (
                  <div className="schedule-slot-cell" key={cellKey}>
                    <button
                      aria-label={'Tambah booking ' + toIsoDate(day) + ' jam ' + hour.label}
                      className={booking ? 'schedule-slot-button has-booking' : 'schedule-slot-button'}
                      type="button"
                      onClick={() => onSlotClick({ date: toIsoDate(day), startHour: String(hour.start) })}
                    >
                      {booking ? (
                        <span className={'schedule-booking-pill is-' + booking.status}>
                          <strong>{booking.customer}</strong>
                          <span>{booking.title}</span>
                        </span>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
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
  const [bookings, setBookings] = useState(readStoredBookings);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingInitialSlot, setBookingInitialSlot] = useState(null);

  const rangeLabel = formatRangeLabel(selectedDate, viewMode);
  const visibleBookingCount = bookings.filter((booking) => activeStatuses.includes(booking.status)).length;

  useEffect(() => {
    window.localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
  }, [bookings]);

  function moveCalendar(direction) {
    setSelectedDate((current) => shiftDate(current, viewMode, direction));
  }

  function goToday() {
    setSelectedDate(startOfDay(new Date()));
  }

  function openBookingModal(slot) {
    setBookingInitialSlot(slot || { date: toIsoDate(selectedDate), startHour: '10' });
    setIsBookingModalOpen(true);
  }

  function closeBookingModal() {
    setIsBookingModalOpen(false);
  }

  function saveBooking(booking) {
    setBookings((current) => [booking, ...current]);
  }

  return (
    <section className="schedule-page" aria-labelledby="schedule-calendar-title">
      <div className="schedule-toolbar">
        <div className="schedule-title-block">
          <h2 id="schedule-calendar-title">{rangeLabel}</h2>
        </div>

        <div className="schedule-actions" aria-label="Kontrol kalender">
          <StudioSelect
            label="View Mode"
            options={viewModes}
            selectedKey={viewMode}
            onChange={setViewMode}
          />

          <StudioSelect
            label="Quick Filter"
            helper={visibleBookingCount + ' tampil'}
            multiple
            options={statusFilters}
            placeholder="Tidak ada status"
            selectedKeys={activeStatuses}
            onChange={setActiveStatuses}
          />

          <button className="schedule-add-button" type="button" onClick={() => openBookingModal()}>
            <Plus size={17} />
            Tambah
          </button>

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
        selectedDate={selectedDate}
        viewMode={viewMode}
        onSlotClick={openBookingModal}
      />

      <BookingFormModal
        initialSlot={bookingInitialSlot}
        isOpen={isBookingModalOpen}
        onClose={closeBookingModal}
        onSave={saveBooking}
      />
    </section>
  );
}
