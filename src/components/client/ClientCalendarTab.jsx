import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';

export default function ClientCalendarTab({
  calendarSelectedDate,
  calendarViewMode,
  setCalendarSelectedDate,
  setCalendarViewMode,
  gridTemplateColumns,
  visibleDays,
  businessHours,
  handleSlotClick,
  bookingBlocks,
  handleBookingBlockClick,
  getStatusLabel,
  ClientCalendarBookingBlock,
  shiftDate,
  startOfDay,
  formatRangeLabel,
  monthNames,
  toIsoDate,
  isSameDay,
  dayNames
}) {
  return (
    <div className="client-calendar-tab space-y-4">
      <div className="client-calendar-controls flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCalendarSelectedDate(shiftDate(calendarSelectedDate, calendarViewMode, -1))}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCalendarSelectedDate(startOfDay(new Date()))}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-colors"
          >
            Hari Ini
          </button>
          <button
            onClick={() => setCalendarSelectedDate(shiftDate(calendarSelectedDate, calendarViewMode, 1))}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <strong className="text-sm text-white font-semibold">
          {formatRangeLabel(calendarSelectedDate, calendarViewMode)}
        </strong>

        <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 self-start sm:self-auto">
          {['day', 'week', 'month'].map((mode) => (
            <button
              key={mode}
              onClick={() => setCalendarViewMode(mode)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${calendarViewMode === mode ? 'bg-[#ff8a2a] text-black shadow-md' : 'text-white/60 hover:text-white'}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="client-calendar-legend text-[11px] text-[var(--ui-text-muted)] flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-[#ff8a2a]/30 border border-[#ff8a2a]/50" />
          <span>Booking Anda</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-white/5 border border-white/10" />
          <span>Terisi (Sesi Lain)</span>
        </span>
        <span className="flex items-center gap-1.5 text-white/70">
          <span className="font-semibold text-orange-400">+</span>
          <span>Klik sel kosong untuk pesan</span>
        </span>
      </div>

      <div className="client-calendar-grid-shell schedule-grid-shell rounded-2xl border border-white/5 overflow-hidden">
        <div className="schedule-grid-scroll">
          <div
            className={`schedule-grid schedule-grid--${calendarViewMode}`}
            style={{ gridTemplateColumns }}
          >
            <div className="schedule-grid-corner" style={{ gridColumn: '1', gridRow: '1' }}>
              <span>{calendarViewMode === 'month' ? monthNames[calendarSelectedDate.getMonth()] : 'Jam'}</span>
            </div>

            {visibleDays.map((day, dayIndex) => {
              const dayIso = toIsoDate(day);
              const isToday = isSameDay(day, startOfDay(new Date()));
              const dayHeadClassName = `schedule-day-head ${isToday ? 'is-today' : ''}`;

              return (
                <div
                  className={dayHeadClassName}
                  key={dayIso}
                  style={{ gridColumn: String(dayIndex + 2), gridRow: '1' }}
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
                  <Clock3 size={12} aria-hidden="true" />
                  <span>{hour.rangeLabel}</span>
                </div>

                {visibleDays.map((day, dayIndex) => {
                  const cellKey = `${toIsoDate(day)}-${hour.key}`;
                  return (
                    <div
                      className="schedule-slot-cell"
                      key={cellKey}
                      style={{ gridColumn: String(dayIndex + 2), gridRow: String(hourIndex + 2) }}
                    >
                      <button
                        aria-label={`Pesan slot ${toIsoDate(day)} jam ${hour.label}`}
                        className="schedule-slot-button"
                        type="button"
                        onClick={() => handleSlotClick({ date: toIsoDate(day), startHour: String(hour.start) })}
                      >
                        <span className="schedule-slot-add-hint" aria-hidden="true">+</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}

            {bookingBlocks.map((block) => {
              const isOwn = Boolean(block.booking.isOwnClientBooking);

              return (
                <ClientCalendarBookingBlock
                  block={block}
                  key={block.booking.id || `${block.dayKey}-${block.startIndex}-${block.booking.customer}`}
                  onBookingClick={handleBookingBlockClick}
                  isOwn={isOwn}
                  getStatusLabel={getStatusLabel}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
