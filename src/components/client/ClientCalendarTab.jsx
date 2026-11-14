import { Fragment, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Lock,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { viewModes } from '../../constants/scheduleConfig.js';
import { getLegacyBookingPaymentStatus } from '../../domain/booking/bookingSelectors.js';

function getWeekStart(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const diff = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - diff);
  return value;
}

function getWeekDays(date) {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function formatHourClock(hourValue) {
  const numeric = Number(hourValue);
  if (!Number.isFinite(numeric)) return '00.00';
  return `${String(numeric).padStart(2, '0')}.00`;
}

function formatHourRange(startHour, endHour) {
  const start = Number(startHour);
  const end = Number.isFinite(Number(endHour)) ? Number(endHour) : start + 1;
  return `${formatHourClock(start)}–${formatHourClock(end)}`;
}

function formatDayRange(days = [], monthNames = []) {
  if (!Array.isArray(days) || days.length === 0) return '';
  const first = days[0];
  const last = days[days.length - 1];
  const monthLabel = (monthIdx) =>
    (Array.isArray(monthNames) && monthNames[monthIdx] ? monthNames[monthIdx].slice(0, 3) : '') || '';

  if (days.length === 1) {
    return `${first.getDate()} ${monthLabel(first.getMonth())} ${first.getFullYear()}`;
  }
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    return `${first.getDate()}–${last.getDate()} ${monthLabel(first.getMonth())} ${first.getFullYear()}`;
  }
  return `${first.getDate()} ${monthLabel(first.getMonth())} – ${last.getDate()} ${monthLabel(last.getMonth())} ${last.getFullYear()}`;
}

function getBlockEndHour(block) {
  const booking = block?.booking || block || {};
  const start = Number(booking.startHour ?? block?.startHour);
  const rawEnd = Number(booking.endHour ?? block?.endHour);
  if (Number.isFinite(start) && Number.isFinite(rawEnd) && rawEnd > start) {
    return rawEnd;
  }
  const span = Math.max(1, Math.ceil(Number(booking.durationHours ?? booking.duration ?? block?.spanRows) || 1));
  return Number.isFinite(start) ? start + span : rawEnd;
}

function shiftCalendarViewDate(baseDate, direction, viewMode, shiftDate) {
  const current = baseDate instanceof Date && !Number.isNaN(baseDate.getTime())
    ? new Date(baseDate)
    : new Date();
  const deltaDays = viewMode === 'day' ? direction : direction * 7;
  if (typeof shiftDate === 'function') {
    const shifted = shiftDate.length >= 3
      ? shiftDate(current, viewMode, direction)
      : shiftDate(current, deltaDays);
    if (shifted instanceof Date && !Number.isNaN(shifted.getTime())) {
      return shifted;
    }
  }
  if (viewMode === 'month') {
    const next = new Date(current.getFullYear(), current.getMonth() + direction, 1);
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(current.getDate(), maxDay));
    return next;
  }
  const next = new Date(current);
  next.setDate(current.getDate() + deltaDays);
  return next;
}

function getBlockForSlot(bookingBlocks, dayIso, hourStart) {
  if (!Array.isArray(bookingBlocks) || !dayIso) return null;
  const targetHour = Number(hourStart);
  return (
    bookingBlocks.find((block) => {
      if (!block || block.dayKey !== dayIso) return false;
      const start = Number(block.booking?.startHour ?? block.startHour);
      const end = getBlockEndHour(block);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        return targetHour >= start && targetHour < end;
      }
      return false;
    }) || null
  );
}

function getServiceLabel(booking) {
  return (
    booking?.serviceType ||
    booking?.packageName ||
    booking?.serviceLabel ||
    booking?.bookingCode ||
    'Sesi Studio'
  );
}

function getBookingBlockPlacement(block) {
  const dayColumn = Math.max(0, Number(block?.dayIndex) || 0) + 2;
  const startIndex = Number(block?.startIndex);
  const rowStart = Number.isFinite(startIndex)
    ? startIndex + 2
    : Math.max(2, Number(block?.rowStart) || 2);
  const spanRows = Math.max(1, Number(block?.spanRows) || 1);
  const laneCount = Math.max(1, Number(block?.laneCount) || 1);
  const laneIndex = Math.min(laneCount - 1, Math.max(0, Number(block?.laneIndex) || 0));

  const style = {
    gridColumn: `${dayColumn}`,
    gridRow: `${rowStart} / span ${spanRows}`,
  };

  if (laneCount > 1) {
    const lanePercent = 100 / laneCount;
    style.width = `calc(${lanePercent}% - 6px)`;
    style.marginLeft = `calc(${laneIndex * lanePercent}% + 3px)`;
  } else {
    style.marginInline = '4px';
  }

  return style;
}

export default function ClientCalendarTab({
  calendarSelectedDate,
  calendarViewMode = 'week',
  setCalendarSelectedDate,
  setCalendarViewMode,
  visibleDays = [],
  businessHours = [],
  calendarSlotsReady = false,
  calendarSlotsLoading = false,
  calendarSlotsError = '',
  onRetryCalendarSlots,
  handleSlotClick,
  bookingBlocks = [],
  handleBookingBlockClick,
  getStatusLabel,
  shiftDate,
  startOfDay,
  formatRangeLabel,
  monthNames = [],
  toIsoDate,
  isSameDay,
  dayNames = [],
}) {
  const boardScrollRef = useRef(null);
  const dragStateRef = useRef({ active: false, pointerId: null, startX: 0, startScrollLeft: 0, moved: false });
  const dragMovedRef = useRef(false);

  const normalizedToday = useMemo(
    () => (typeof startOfDay === 'function' ? startOfDay(new Date()) : new Date()),
    [startOfDay]
  );

  const normalizedSelectedDate = useMemo(() => {
    const base = calendarSelectedDate || new Date();
    return typeof startOfDay === 'function' ? startOfDay(base) : new Date(base);
  }, [calendarSelectedDate, startOfDay]);

  const activeDays = useMemo(() => {
    if (Array.isArray(visibleDays) && visibleDays.length > 0) {
      return visibleDays;
    }
    if (calendarViewMode === 'day') {
      return [normalizedSelectedDate];
    }
    return getWeekDays(normalizedSelectedDate);
  }, [visibleDays, calendarViewMode, normalizedSelectedDate]);

  const hours = useMemo(
    () => (Array.isArray(businessHours) ? businessHours : []),
    [businessHours]
  );

  const selectedDay = useMemo(() => {
    const match = activeDays.find((day) => isSameDay?.(day, normalizedSelectedDate));
    return match || activeDays[0] || normalizedSelectedDate;
  }, [activeDays, isSameDay, normalizedSelectedDate]);

  const selectedDayIso = useMemo(
    () => (typeof toIsoDate === 'function' ? toIsoDate(selectedDay) : ''),
    [selectedDay, toIsoDate]
  );

  const blocksList = useMemo(
    () => (Array.isArray(bookingBlocks) ? bookingBlocks : []),
    [bookingBlocks]
  );

  const ownBlocks = useMemo(
    () =>
      blocksList
        .filter((block) => Boolean(block?.booking?.isOwnClientBooking))
        .sort((a, b) => {
          const dayDiff = (Number(a?.dayIndex) || 0) - (Number(b?.dayIndex) || 0);
          if (dayDiff !== 0) return dayDiff;
          return (Number(a?.booking?.startHour) || 0) - (Number(b?.booking?.startHour) || 0);
        }),
    [blocksList]
  );

  const busyBlocksCount = useMemo(
    () => blocksList.filter((block) => !block?.booking?.isOwnClientBooking).length,
    [blocksList]
  );

  const totalAvailableSlots = useMemo(() => {
    if (!activeDays.length || !hours.length) return 0;
    let available = 0;
    activeDays.forEach((day) => {
      const dayIso = toIsoDate?.(day);
      hours.forEach((hour) => {
        if (!getBlockForSlot(blocksList, dayIso, hour.start)) {
          available += 1;
        }
      });
    });
    return available;
  }, [activeDays, hours, blocksList, toIsoDate]);

  const selectedDaySlots = useMemo(
    () =>
      hours.map((hour) => {
        const block = getBlockForSlot(blocksList, selectedDayIso, hour.start);
        return {
          hour,
          block,
          isOwn: Boolean(block?.booking?.isOwnClientBooking),
        };
      }),
    [hours, blocksList, selectedDayIso]
  );

  const selectedDayOpenCount = useMemo(
    () => selectedDaySlots.filter((item) => !item.block).length,
    [selectedDaySlots]
  );

  const firstOpenHourForSelectedDay = useMemo(() => {
    const firstOpen = selectedDaySlots.find((item) => !item.block);
    return firstOpen?.hour?.start ?? hours[0]?.start ?? 10;
  }, [selectedDaySlots, hours]);

  const rangeText = useMemo(() => {
    if (
      typeof formatRangeLabel === 'function' &&
      normalizedSelectedDate instanceof Date &&
      !Number.isNaN(normalizedSelectedDate.getTime())
    ) {
      const label = formatRangeLabel(normalizedSelectedDate, calendarViewMode);
      if (label) return label;
    }
    return formatDayRange(activeDays, monthNames);
  }, [formatRangeLabel, normalizedSelectedDate, calendarViewMode, activeDays, monthNames]);

  const selectedDayFormatted = useMemo(() => {
    const dayLabel = Array.isArray(dayNames) && dayNames[selectedDay.getDay()] ? dayNames[selectedDay.getDay()] : '';
    const monthLabel =
      Array.isArray(monthNames) && monthNames[selectedDay.getMonth()]
        ? monthNames[selectedDay.getMonth()]
        : '';
    return `${dayLabel}, ${selectedDay.getDate()} ${monthLabel} ${selectedDay.getFullYear()}`.trim();
  }, [selectedDay, dayNames, monthNames]);

  const summaryScopeLabel =
    calendarViewMode === 'day'
      ? 'hari ini'
      : calendarViewMode === 'month'
        ? 'bulan ini'
        : 'minggu ini';

  const handleNavigate = (direction) => {
    const nextDate = shiftCalendarViewDate(normalizedSelectedDate, direction, calendarViewMode, shiftDate);
    setCalendarSelectedDate?.(typeof startOfDay === 'function' ? startOfDay(nextDate) : nextDate);
  };

  const handleGoToday = () => {
    setCalendarSelectedDate?.(normalizedToday);
  };

  const handleBoardPointerDown = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if (event.target.closest('button, a, input, select, textarea, .client-calendar-booking-block')) {
      return;
    }
    const scrollEl = boardScrollRef.current;
    if (!scrollEl || scrollEl.scrollWidth <= scrollEl.clientWidth + 2) return;

    dragMovedRef.current = false;
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: scrollEl.scrollLeft,
      moved: false,
    };
    scrollEl.setPointerCapture?.(event.pointerId);
  };

  const handleBoardPointerMove = (event) => {
    const state = dragStateRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    const scrollEl = boardScrollRef.current;
    if (!scrollEl) return;

    const deltaX = event.clientX - state.startX;
    if (Math.abs(deltaX) > 6) {
      state.moved = true;
      dragMovedRef.current = true;
      scrollEl.classList.add('is-dragging');
    }
    if (state.moved) {
      scrollEl.scrollLeft = state.startScrollLeft - deltaX;
    }
  };

  const finishBoardPointerDrag = (event) => {
    const state = dragStateRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    const scrollEl = boardScrollRef.current;
    scrollEl?.classList.remove('is-dragging');
    scrollEl?.releasePointerCapture?.(event.pointerId);
    dragStateRef.current = { active: false, pointerId: null, startX: 0, startScrollLeft: 0, moved: false };
    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 0);
  };

  const handleBoardClickCapture = (event) => {
    if (dragMovedRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const isMonthView = calendarViewMode === 'month';

  return (
    <motion.section
      className="client-booking-board"
      aria-label="Kalender Booking Studio"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <header className="client-booking-board-heading">
        <div className="client-booking-editorial-copy">
          <span>BOOK STUDIO</span>
          <h2>Pilih Jadwal Studio</h2>
          <p>
            Cek ketersediaan studio per jam, pilih tanggal yang Anda inginkan, atau ketuk blok jadwal Anda untuk melihat detail booking.
          </p>
        </div>

        <div className="client-booking-board-summary">
          <span>
            <b>{calendarSlotsReady ? totalAvailableSlots : '—'}</b>
            <strong>Slot Tersedia</strong>
            <small>{calendarSlotsReady ? summaryScopeLabel : 'memuat'}</small>
          </span>
        </div>
      </header>

      <div className="client-booking-command-shelf" role="region" aria-label="Kontrol dan filter kalender">
        <div className="client-booking-command-top">
          <div className="client-booking-nav-group">
            <div className="client-booking-nav">
              <button
                type="button"
                className="client-booking-nav-arrow"
                onClick={() => handleNavigate(-1)}
                aria-label="Periode sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="client-booking-nav-today"
                onClick={handleGoToday}
              >
                Hari ini
              </button>
              <button
                type="button"
                className="client-booking-nav-arrow"
                onClick={() => handleNavigate(1)}
                aria-label="Periode berikutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="client-booking-range-pill">
              <CalendarDays size={15} />
              <strong>{rangeText}</strong>
            </div>
          </div>

          <div className="client-booking-command-right">
            <div className="client-booking-view-switcher" role="group" aria-label="Mode tampilan kalender">
              {viewModes.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  className={calendarViewMode === mode.key ? 'active' : ''}
                  aria-pressed={calendarViewMode === mode.key}
                  onClick={() => setCalendarViewMode?.(mode.key)}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="client-booking-command-actions">
              <button
                type="button"
                className="client-booking-cta-button"
                disabled={!calendarSlotsReady}
                title={!calendarSlotsReady ? 'Data jadwal studio sedang dimuat — data belum siap' : 'Ajukan booking baru'}
                onClick={() =>
                  handleSlotClick?.({
                    date: selectedDayIso,
                    startHour: String(firstOpenHourForSelectedDay),
                  })
                }
              >
                <Plus size={15} />
                <span>Ajukan Booking</span>
              </button>
            </div>
          </div>
        </div>

        <div className="client-booking-status-row">
          <div className="client-booking-status-pills">
            <span className="client-booking-status-pill is-available">
              <i aria-hidden="true" />
              <span>Slot Tersedia</span>
              <strong>{calendarSlotsReady ? totalAvailableSlots : '—'}</strong>
            </span>
            <span className="client-booking-status-pill is-own">
              <i aria-hidden="true" />
              <span>Booking Anda</span>
              <strong>{ownBlocks.length}</strong>
            </span>
            <span className="client-booking-status-pill is-busy">
              <i aria-hidden="true" />
              <span>Studio Terisi</span>
              <strong>{busyBlocksCount}</strong>
            </span>
          </div>

          <span className="client-booking-selected-readout">
            Fokus hari: <strong>{selectedDayFormatted}</strong>
          </span>
        </div>
      </div>

      {(!calendarSlotsReady || calendarSlotsError) && (
        <div
          className={`client-booking-sync-banner ${calendarSlotsError ? 'is-error' : 'is-loading'}`}
          role="status"
        >
          <div className="client-booking-sync-copy">
            <AlertCircle size={16} />
            <div>
              <strong>
                {calendarSlotsError
                  ? 'Sinkronisasi kalender terganggu'
                  : 'Menyiapkan jadwal terbaru studio'}
              </strong>
              <span>
                {calendarSlotsError
                  ? `${calendarSlotsError} (data belum siap untuk pengajuan booking).`
                  : calendarSlotsLoading
                    ? 'Memuat slot terbaru — data belum siap sebelum sinkronisasi selesai.'
                    : 'Menunggu konfirmasi ketersediaan slot — data belum siap.'}
              </span>
            </div>
          </div>
          {typeof onRetryCalendarSlots === 'function' && (
            <button
              type="button"
              className="client-booking-sync-retry"
              onClick={onRetryCalendarSlots}
              disabled={calendarSlotsLoading}
            >
              <RefreshCw size={14} className={calendarSlotsLoading ? 'spin' : ''} />
              <span>{calendarSlotsLoading ? 'Memuat...' : 'Muat Ulang'}</span>
            </button>
          )}
        </div>
      )}

      <div className="client-booking-workspace">
        <div className="client-booking-calendar-shell">
          <div className="client-booking-mobile-context">
            <span>{calendarViewMode === 'day' ? 'Tampilan Harian' : isMonthView ? 'Tampilan Bulanan' : 'Minggu Ini'}</span>
            <strong>{rangeText}</strong>
            <em>
              Geser samping <ArrowRight size={11} />
            </em>
          </div>

          <div className="client-booking-board-desktop">
            <div
              ref={boardScrollRef}
              className={`client-booking-board-scroll ${isMonthView ? 'is-month-scroll' : ''}`}
              onPointerDown={handleBoardPointerDown}
              onPointerMove={handleBoardPointerMove}
              onPointerUp={finishBoardPointerDrag}
              onPointerCancel={finishBoardPointerDrag}
              onClickCapture={handleBoardClickCapture}
            >
              <div
                className={`client-booking-board-grid is-${calendarViewMode}-view`}
                style={{ '--client-book-days': Math.max(1, activeDays.length) }}
              >
                <div className="client-booking-board-corner" aria-hidden="true">
                  <Clock3 size={14} />
                  <span>WIB</span>
                </div>

                {activeDays.map((day) => {
                  const dayIso = toIsoDate?.(day) || '';
                  const isToday = Boolean(isSameDay?.(day, normalizedToday));
                  const isSelected = Boolean(isSameDay?.(day, selectedDay));
                  const shortDay =
                    Array.isArray(dayNames) && dayNames[day.getDay()]
                      ? dayNames[day.getDay()].slice(0, 3)
                      : '';
                  const shortMonth =
                    Array.isArray(monthNames) && monthNames[day.getMonth()]
                      ? monthNames[day.getMonth()].slice(0, 3)
                      : '';

                  return (
                    <button
                      key={dayIso || day.toISOString()}
                      type="button"
                      className={`client-booking-day-header ${isToday ? 'is-today' : ''} ${
                        isSelected ? 'is-selected' : ''
                      }`}
                      onClick={() => setCalendarSelectedDate?.(day)}
                    >
                      <span>{shortDay}</span>
                      <strong>{day.getDate()}</strong>
                      {isMonthView && <small>{shortMonth}</small>}
                    </button>
                  );
                })}

                {hours.map((hour) => (
                  <Fragment key={hour.key}>
                    <div className="client-booking-time-cell">
                      <strong>{formatHourClock(hour.start)}</strong>
                      <span>{formatHourRange(hour.start, hour.end)}</span>
                    </div>

                    {activeDays.map((day) => {
                      const dayIso = toIsoDate?.(day) || '';
                      const occupyingBlock = getBlockForSlot(blocksList, dayIso, hour.start);

                      if (occupyingBlock) {
                        return (
                          <div
                            key={`${dayIso}-${hour.key}`}
                            className="client-booking-slot is-under-booking"
                            aria-hidden="true"
                          />
                        );
                      }

                      return (
                        <button
                          key={`${dayIso}-${hour.key}`}
                          type="button"
                          className="client-booking-slot is-available"
                          disabled={!calendarSlotsReady}
                          aria-label={
                            !calendarSlotsReady
                              ? `Slot ${dayIso} jam ${formatHourClock(hour.start)} — data belum siap`
                              : `Ajukan booking ${dayIso} jam ${formatHourClock(hour.start)}`
                          }
                          title={
                            !calendarSlotsReady
                              ? 'Data jadwal studio sedang disiapkan — data belum siap'
                              : `Ajukan booking pukul ${formatHourRange(hour.start, hour.end)}`
                          }
                          onClick={() =>
                            handleSlotClick?.({
                              date: dayIso,
                              startHour: String(hour.start),
                            })
                          }
                        >
                          <span className="client-slot-add-hint">
                            <Plus size={14} />
                            <span>Pilih</span>
                          </span>
                        </button>
                      );
                    })}
                  </Fragment>
                ))}

                {blocksList.map((block, index) => {
                  const placement = getBookingBlockPlacement(block);
                  const booking = block?.booking || {};
                  const isOwn = Boolean(booking.isOwnClientBooking);
                  const paymentStatus = getLegacyBookingPaymentStatus(booking) || 'pending';
                  const spanRows = Math.max(1, Number(block?.spanRows) || 1);
                  const timeText = formatHourRange(booking.startHour, getBlockEndHour(block));

                  if (isOwn) {
                    const statusLabel =
                      typeof getStatusLabel === 'function' ? getStatusLabel(paymentStatus) : paymentStatus;
                    const serviceName = getServiceLabel(booking);

                    return (
                      <button
                        key={booking.id || `own-${block.dayKey}-${booking.startHour}-${index}`}
                        type="button"
                        className={`client-calendar-booking-block is-own is-${paymentStatus} ${
                          spanRows <= 1 ? 'is-compact' : ''
                        }`}
                        style={placement}
                        onClick={() => handleBookingBlockClick?.(booking)}
                        title={`${serviceName} (${timeText}) • ${statusLabel}`}
                      >
                        <div className="client-calendar-block-top">
                          <span>{statusLabel}</span>
                          <em>Anda</em>
                        </div>
                        <strong>{serviceName}</strong>
                        <small>{timeText}</small>
                      </button>
                    );
                  }

                  return (
                    <div
                      key={booking.id || `busy-${block.dayKey}-${booking.startHour}-${index}`}
                      className={`client-calendar-booking-block is-busy ${
                        spanRows <= 1 ? 'is-compact' : ''
                      }`}
                      style={placement}
                      aria-label={`Studio terisi ${timeText}`}
                    >
                      <div className="client-calendar-block-top">
                        <span>
                          <Lock size={11} />
                          Terisi
                        </span>
                      </div>
                      <strong>Studio Terisi</strong>
                      <small>{timeText}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <aside className="client-booking-side-deck" aria-label="Inspeksi hari dan daftar jadwal Anda">
          <section className="client-calendar-day-inspector">
            <header className="client-calendar-side-head">
              <div>
                <span>PILIH CEPAT PER HARI</span>
                <h3>{selectedDayFormatted}</h3>
              </div>
              <em>
                {calendarSlotsReady ? `${selectedDayOpenCount} jam buka` : 'Sinkron...'}
              </em>
            </header>

            <div className="client-calendar-day-hours">
              {selectedDaySlots.map(({ hour, block, isOwn }) => {
                const hourClock = formatHourClock(hour.start);
                if (block) {
                  return isOwn ? (
                    <button
                      key={`quick-${hour.key}`}
                      type="button"
                      className="client-calendar-hour-chip is-own"
                      onClick={() => handleBookingBlockClick?.(block.booking)}
                    >
                      <strong>{hourClock}</strong>
                      <span>Booking Anda</span>
                    </button>
                  ) : (
                    <div key={`quick-${hour.key}`} className="client-calendar-hour-chip is-busy">
                      <strong>{hourClock}</strong>
                      <span>
                        <Lock size={11} /> Terisi
                      </span>
                    </div>
                  );
                }

                return (
                  <button
                    key={`quick-${hour.key}`}
                    type="button"
                    className="client-calendar-hour-chip is-available"
                    disabled={!calendarSlotsReady}
                    title={
                      !calendarSlotsReady
                        ? 'Menunggu data — data belum siap'
                        : `Pilih jam ${hourClock} pada ${selectedDayFormatted}`
                    }
                    onClick={() =>
                      handleSlotClick?.({
                        date: selectedDayIso,
                        startHour: String(hour.start),
                      })
                    }
                  >
                    <strong>{hourClock}</strong>
                    <span>
                      <Plus size={11} /> Pilih
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="client-calendar-upcoming-panel">
            <header className="client-calendar-side-head">
              <div>
                <span>SESI AKTIF ANDA</span>
                <h3>Jadwal di Rentang Ini</h3>
              </div>
              <em>{ownBlocks.length} sesi</em>
            </header>

            {ownBlocks.length === 0 ? (
              <div className="client-calendar-upcoming-empty">
                <p>Belum ada booking Anda pada tampilan kalender ini. Pilih slot kosong mana saja untuk mengajukan sesi.</p>
              </div>
            ) : (
              <div className="client-calendar-upcoming-list">
                {ownBlocks.map((block, index) => {
                  const booking = block?.booking || {};
                  const paymentStatus = getLegacyBookingPaymentStatus(booking) || 'pending';
                  const statusLabel =
                    typeof getStatusLabel === 'function' ? getStatusLabel(paymentStatus) : paymentStatus;
                  const targetDay = activeDays[block.dayIndex] || selectedDay;
                  const shortDay =
                    Array.isArray(dayNames) && dayNames[targetDay.getDay()]
                      ? dayNames[targetDay.getDay()].slice(0, 3)
                      : '';
                  const shortMonth =
                    Array.isArray(monthNames) && monthNames[targetDay.getMonth()]
                      ? monthNames[targetDay.getMonth()].slice(0, 3)
                      : '';

                  return (
                    <button
                      key={booking.id || `upcoming-${index}`}
                      type="button"
                      className={`client-calendar-upcoming-item is-${paymentStatus}`}
                      onClick={() => handleBookingBlockClick?.(booking)}
                    >
                      <div className="client-calendar-upcoming-date">
                        <span>{shortDay}</span>
                        <strong>{targetDay.getDate()}</strong>
                        <small>{shortMonth}</small>
                      </div>
                      <div className="client-calendar-upcoming-info">
                        <div className="client-calendar-upcoming-meta">
                          <span className={`client-calendar-status-tag is-${paymentStatus}`}>
                            {statusLabel}
                          </span>
                          <small>{formatHourRange(booking.startHour, getBlockEndHour(block))}</small>
                        </div>
                        <strong>{getServiceLabel(booking)}</strong>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </div>
    </motion.section>
  );
}
