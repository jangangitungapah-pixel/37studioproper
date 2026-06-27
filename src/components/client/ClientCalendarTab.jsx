import { ChevronLeft, ChevronRight, Clock3, CalendarDays, CheckCircle, Info } from 'lucide-react';
import { formatRupiah } from '../../settings/pricingSettings.js';

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
  const selectedDateIso = toIsoDate(calendarSelectedDate);

  // Generate 7 days of the week containing calendarSelectedDate (Monday - Sunday)
  const startOfWeek = (() => {
    const day = calendarSelectedDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const next = new Date(calendarSelectedDate);
    next.setDate(next.getDate() + diff);
    return startOfDay(next);
  })();

  const rollingDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Filter booking blocks on the selected date
  const blocksOnSelectedDate = bookingBlocks.filter(block => block.dayKey === selectedDateIso);

  // Identify client's own bookings on the selected date
  const ownBookingsToday = blocksOnSelectedDate.filter(block => block.booking.isOwnClientBooking);

  return (
    <div className="client-calendar-tab flex flex-col gap-3">
      {/* ========================================================================= */}
      {/* 📱 MOBILE-FIRST VIEW: High-Density Calendar Strip & Badge slots           */}
      {/* ========================================================================= */}
      <div className="block md:hidden space-y-4">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-3 rounded-xl">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCalendarSelectedDate(shiftDate(calendarSelectedDate, 'week', -1))}
              className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform"
              title="Minggu sebelumnya"
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCalendarSelectedDate(startOfDay(new Date()))}
              className="px-2.5 h-9 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold active:scale-95 transition-transform"
              type="button"
            >
              Hari Ini
            </button>
            <button
              onClick={() => setCalendarSelectedDate(shiftDate(calendarSelectedDate, 'week', 1))}
              className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform"
              title="Minggu berikutnya"
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          
          <strong className="text-xs text-white font-extrabold tracking-wide uppercase">
            {monthNames[calendarSelectedDate.getMonth()]} {calendarSelectedDate.getFullYear()}
          </strong>
        </div>

        {/* Compact Horizontal Date Strip */}
        <div 
          className="flex justify-between gap-1 p-1 bg-[#0f0c09] border border-white/5 rounded-xl"
          style={{ overflowX: 'auto', scrollbarWidth: 'none' }}
        >
          {rollingDays.map((day) => {
            const isSelected = isSameDay(day, calendarSelectedDate);
            const isToday = isSameDay(day, startOfDay(new Date()));
            
            return (
              <button
                key={toIsoDate(day)}
                onClick={() => setCalendarSelectedDate(day)}
                type="button"
                className={`flex-1 min-w-[42px] py-1.5 flex flex-col items-center gap-1 rounded-lg transition-all ${
                  isSelected 
                    ? 'bg-[#ff8a2a] text-black shadow-md font-bold' 
                    : isToday 
                      ? 'bg-white/5 border border-[#ff8a2a]/30 text-white' 
                      : 'hover:bg-white/5 text-slate-400'
                }`}
              >
                <span className={`text-[9px] uppercase tracking-wider font-bold ${isSelected ? 'text-black' : 'text-slate-500'}`}>
                  {dayNames[day.getDay()]}
                </span>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold ${
                  isSelected ? 'bg-black text-[#ff8a2a]' : isToday ? 'text-[#ff8a2a]' : 'text-white'
                }`}>
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Legend strip */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 px-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-white/5 border border-white/20" />
            <span>Tersedia</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-white/5 border border-white/10 opacity-30" />
            <span>Terisi</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-[#ff8a2a] border border-[#ff8a2a]" />
            <span>Booking Anda</span>
          </span>
        </div>

        {/* Badge Row for Time Slots (Horizontal wrapped list, 44px touch target) */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Pilih Jam Sesi</h4>
          <div className="grid grid-cols-3 xs:grid-cols-4 gap-2">
            {businessHours.map((hour) => {
              const hourStart = Number(hour.start);
              
              // Check if slot is occupied
              const overlappingBlock = blocksOnSelectedDate.find(block => {
                const start = Number(block.booking.startHour);
                const duration = Number(block.booking.durationHours || block.booking.duration || 1);
                return hourStart >= start && hourStart < (start + duration);
              });

              if (overlappingBlock) {
                const isOwn = Boolean(overlappingBlock.booking.isOwnClientBooking);
                
                if (isOwn) {
                  return (
                    <button
                      key={hour.key}
                      onClick={() => handleBookingBlockClick(overlappingBlock.booking)}
                      type="button"
                      className="h-11 rounded-lg bg-[#ff8a2a] text-black border border-[#ff8a2a] text-[11px] font-extrabold flex flex-col items-center justify-center leading-none transition-transform active:scale-95"
                      title="Klik untuk detail booking Anda"
                    >
                      <span>{hour.label}</span>
                      <span className="text-[8px] mt-0.5 opacity-80">Milik Saya</span>
                    </button>
                  );
                } else {
                  return (
                    <button
                      key={hour.key}
                      disabled
                      type="button"
                      className="h-11 rounded-lg bg-white/[0.01] border border-white/5 text-slate-600 text-[11px] font-semibold flex items-center justify-center cursor-not-allowed opacity-30"
                    >
                      <span>{hour.label} (Penuh)</span>
                    </button>
                  );
                }
              }

              // Available Slot
              return (
                <button
                  key={hour.key}
                  onClick={() => handleSlotClick({ date: selectedDateIso, startHour: String(hour.start) })}
                  type="button"
                  className="h-11 rounded-lg bg-transparent hover:bg-white/5 border border-white/10 hover:border-[#ff8a2a] text-white text-[11px] font-bold flex flex-col items-center justify-center transition-all active:scale-95 active:border-[#ff8a2a]"
                >
                  <span className="text-white">{hour.label}</span>
                  <span className="text-[8px] text-[#ff8a2a] font-bold mt-0.5">+ Pesan</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The Single-Row Active Booking list for selected date */}
        {ownBookingsToday.length > 0 && (
          <div className="space-y-2 pt-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Booking Anda Hari Ini</h4>
            <div className="space-y-1.5">
              {ownBookingsToday.map((block) => {
                const booking = block.booking;
                const status = booking.paymentStatus || booking.status || 'pending';
                const startHourNum = Number(booking.startHour);
                const durationNum = Number(booking.durationHours || booking.duration || 1);
                
                return (
                  <article
                    key={booking.id || `${block.dayKey}-${block.startIndex}`}
                    onClick={() => handleBookingBlockClick(booking)}
                    className="flex flex-row items-center justify-between gap-3 p-2.5 bg-white/[0.02] border border-white/5 rounded-lg cursor-pointer hover:border-white/10 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <h5 className="margin-0 text-[12px] font-bold text-white truncate">
                        {booking.sessionLabel || booking.packageLabel || booking.title || 'Sesi Studio'}
                      </h5>
                      <span className="text-[9px] uppercase tracking-wider bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-slate-400">
                        {booking.bookingCode || 'BKG'}
                      </span>
                    </div>

                    <div className="text-right flex flex-col items-end shrink-0">
                      <span className="text-[10px] font-bold text-white">
                        {String(startHourNum).padStart(2, '0')}.00 WIB
                      </span>
                      <span className="text-[9px] text-slate-500">
                        Durasi: {durationNum}j
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        status.toLowerCase() === 'lunas' 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                          : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                      }`}>
                        {status}
                      </span>
                      <ChevronRight size={13} className="text-slate-500" />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 🖥 DESKTOP VIEW: Complete Grid representation (Standard layout)           */}
      {/* ========================================================================= */}
      <div className="hidden md:block space-y-4">
        <div className="client-calendar-controls flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-xl">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCalendarSelectedDate(shiftDate(calendarSelectedDate, calendarViewMode, -1))}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCalendarSelectedDate(startOfDay(new Date()))}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-colors"
              type="button"
            >
              Hari Ini
            </button>
            <button
              onClick={() => setCalendarSelectedDate(shiftDate(calendarSelectedDate, calendarViewMode, 1))}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
              type="button"
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
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="client-calendar-legend text-[11px] text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-2">
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
    </div>
  );
}
