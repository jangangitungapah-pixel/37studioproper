import { useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
} from 'lucide-react';

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

const viewModes = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

const statusFilters = [
  { key: 'pending', label: 'Pending' },
  { key: 'dp', label: 'DP' },
  { key: 'lunas', label: 'Lunas' },
];

const businessHours = Array.from({ length: 13 }, (_, index) => {
  const start = index + 10;
  const end = start + 1;

  return {
    key: String(start).padStart(2, '0'),
    start,
    end,
    label: `${String(start).padStart(2, '0')}.00-${String(end).padStart(2, '0')}.00`,
  };
});

const bookings = [];

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

  return `${year}-${month}-${day}`;
}

function formatRangeLabel(date, viewMode) {
  if (viewMode === 'day') {
    return `${dayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  }

  if (viewMode === 'week') {
    const start = getWeekStart(date);
    const end = addDays(start, 6);

    return `${start.getDate()} ${shortMonthNames[start.getMonth()]} - ${end.getDate()} ${shortMonthNames[end.getMonth()]} ${end.getFullYear()}`;
  }

  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
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

function getBookingForSlot(day, hour, enabledStatuses) {
  return bookings.find((booking) => {
    const bookingDate = startOfDay(new Date(booking.date));
    return (
      isSameDay(bookingDate, day) &&
      booking.startHour === hour &&
      enabledStatuses.includes(booking.status)
    );
  });
}

function getGridTemplate(viewMode, visibleDayCount) {
  if (viewMode === 'day') return '112px minmax(280px, 1fr)';
  if (viewMode === 'week') return `112px repeat(${visibleDayCount}, minmax(126px, 1fr))`;

  return `112px repeat(${visibleDayCount}, minmax(92px, 1fr))`;
}

function CalendarGrid({ selectedDate, viewMode, activeStatuses }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const visibleDays = useMemo(() => getVisibleDays(selectedDate, viewMode), [selectedDate, viewMode]);
  const gridTemplateColumns = getGridTemplate(viewMode, visibleDays.length);

  return (
    <section className="schedule-grid-shell" aria-label="Calendar grid">
      <div className="schedule-grid-scroll">
        <div
          className={`schedule-grid schedule-grid--${viewMode}`}
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
                <span>{hour.label}</span>
              </div>

              {visibleDays.map((day) => {
                const booking = getBookingForSlot(day, hour.start, activeStatuses);
                const cellKey = `${toIsoDate(day)}-${hour.key}`;

                return (
                  <div className="schedule-slot-cell" key={cellKey}>
                    {booking ? (
                      <div className={`schedule-booking-pill is-${booking.status}`}>
                        <strong>{booking.customer}</strong>
                        <span>{booking.title}</span>
                      </div>
                    ) : null}
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

  const rangeLabel = formatRangeLabel(selectedDate, viewMode);
  const visibleBookingCount = bookings.filter((booking) => activeStatuses.includes(booking.status)).length;

  function toggleStatus(status) {
    setActiveStatuses((current) => {
      if (current.includes(status)) {
        return current.filter((item) => item !== status);
      }

      return [...current, status];
    });
  }

  function moveCalendar(direction) {
    setSelectedDate((current) => shiftDate(current, viewMode, direction));
  }

  function goToday() {
    setSelectedDate(startOfDay(new Date()));
  }

  return (
    <section className="schedule-page" aria-labelledby="schedule-calendar-title">
      <div className="schedule-toolbar">
        <div className="schedule-title-block">
          <p>
            <CalendarClock size={15} aria-hidden="true" />
            Studio Calendar
          </p>
          <h2 id="schedule-calendar-title">{rangeLabel}</h2>
        </div>

        <div className="schedule-actions" aria-label="Kontrol kalender">
          <div className="schedule-segment" role="tablist" aria-label="Mode tampilan kalender">
            {viewModes.map((item) => (
              <button
                aria-selected={viewMode === item.key}
                className={viewMode === item.key ? 'is-active' : ''}
                key={item.key}
                role="tab"
                type="button"
                onClick={() => setViewMode(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

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

      <div className="schedule-filter-row" aria-label="Quick filter status booking">
        <span className="schedule-filter-label">Quick Filter</span>

        <div className="schedule-filter-group">
          {statusFilters.map((item) => {
            const isActive = activeStatuses.includes(item.key);

            return (
              <button
                aria-pressed={isActive}
                className={isActive ? `schedule-filter-chip is-active is-${item.key}` : `schedule-filter-chip is-${item.key}`}
                key={item.key}
                type="button"
                onClick={() => toggleStatus(item.key)}
              >
                <CircleDot size={13} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <span className="schedule-count">{visibleBookingCount} booking tampil</span>
      </div>

      <CalendarGrid
        activeStatuses={activeStatuses}
        selectedDate={selectedDate}
        viewMode={viewMode}
      />
    </section>
  );
}
