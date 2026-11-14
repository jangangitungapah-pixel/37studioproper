import {
  Fragment,
  useEffect,
  useRef,
} from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Lock,
  MoveHorizontal,
  Plus,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  getLegacyBookingPaymentStatus,
} from '../../domain/booking/bookingSelectors.js';

function getWeekStart(
  value,
  startOfDay,
) {
  const date =
    startOfDay(
      value,
    );

  const day =
    date.getDay();

  const difference =
    day === 0
      ? -6
      : 1 - day;

  const next =
    new Date(
      date,
    );

  next.setDate(
    next.getDate() +
      difference,
  );

  return startOfDay(
    next,
  );
}

function getWeekDays(
  value,
  startOfDay,
) {
  const start =
    getWeekStart(
      value,
      startOfDay,
    );

  return Array.from(
    {
      length:
        7,
    },
    (
      _,
      index,
    ) => {
      const next =
        new Date(
          start,
        );

      next.setDate(
        next.getDate() +
          index,
      );

      return next;
    },
  );
}

function formatDayRange(
  days,
) {
  if (
    !days.length
  ) {
    return '';
  }

  const first =
    days[0];

  const last =
    days[
      days.length - 1
    ];

  const firstLabel =
    new Intl.DateTimeFormat(
      'id-ID',
      {
        day:
          'numeric',
        month:
          'short',
      },
    ).format(
      first,
    );

  const lastLabel =
    new Intl.DateTimeFormat(
      'id-ID',
      {
        day:
          'numeric',
        month:
          'short',
        year:
          'numeric',
      },
    ).format(
      last,
    );

  return (
    firstLabel +
    ' — ' +
    lastLabel
  );
}

function getBlockForSlot(
  bookingBlocks,
  dayIso,
  hourStart,
) {
  return (
    bookingBlocks.find(
      (
        block,
      ) => {
        if (
          block.dayKey !==
          dayIso
        ) {
          return false;
        }

        const start =
          Number(
            block.booking
              ?.startHour,
          );

        const duration =
          Math.max(
            1,
            Number(
              block.booking
                ?.durationHours ||
              block.booking
                ?.duration ||
              1,
            ),
          );

        return (
          hourStart >=
            start &&
          hourStart <
            start +
              duration
        );
      },
    ) ||
    null
  );
}

function getServiceLabel(
  booking,
) {
  return (
    booking?.sessionLabel ||
    booking?.packageLabel ||
    booking?.title ||
    'Sesi Studio'
  );
}

function getBookingBlockPlacement(
  block,
) {
  const laneCount =
    Math.max(
      1,
      Number(
        block?.laneCount,
      ) || 1,
    );

  const laneIndex =
    Math.max(
      0,
      Number(
        block?.laneIndex,
      ) || 0,
    );

  const laneWidth =
    100 /
    laneCount;

  return {
    gridColumn:
      String(
        block.dayIndex +
        2,
      ),
    gridRow:
      String(
        block.rowStart,
      ) +
      ' / span ' +
      String(
        block.spanRows,
      ),
    marginLeft:
      laneCount > 1
        ? 'calc(' +
          (
            laneWidth *
            laneIndex
          ).toFixed(
            4,
          ) +
          '% + 3px)'
        : '3px',
    width:
      laneCount > 1
        ? 'calc(' +
          laneWidth.toFixed(
            4,
          ) +
          '% - 6px)'
        : 'calc(100% - 6px)',
  };
}

export default function ClientCalendarTab({
  calendarSelectedDate,
  setCalendarSelectedDate,
  businessHours,
  calendarSlotsReady = false,
  calendarSlotsLoading = false,
  calendarSlotsError = '',
  onRetryCalendarSlots,
  handleSlotClick,
  bookingBlocks,
  handleBookingBlockClick,
  getStatusLabel,
  shiftDate,
  startOfDay,
  toIsoDate,
  isSameDay,
  dayNames,
}) {
  const boardScrollRef =
    useRef(
      null,
    );

  const weekDays =
    getWeekDays(
      calendarSelectedDate,
      startOfDay,
    );

  const today =
    startOfDay(
      new Date(),
    );

  const occupiedSlotCount =
    weekDays.reduce(
      (
        count,
        day,
      ) => {
        const dayIso =
          toIsoDate(
            day,
          );

        return (
          count +
          businessHours.filter(
            (
              hour,
            ) =>
              Boolean(
                getBlockForSlot(
                  bookingBlocks,
                  dayIso,
                  Number(
                    hour.start,
                  ),
                ),
              ),
          ).length
        );
      },
      0,
    );

  const totalSlots =
    weekDays.length *
    businessHours.length;

  const availableSlots =
    Math.max(
      0,
      totalSlots -
        occupiedSlotCount,
    );

  const selectedDateKey =
    toIsoDate(
      calendarSelectedDate,
    );

  useEffect(
    () => {
      const scroller =
        boardScrollRef.current;

      if (
        !scroller ||
        scroller.scrollWidth <=
          scroller.clientWidth +
            1
      ) {
        return undefined;
      }

      const frame =
        window.requestAnimationFrame(
          () => {
            const selectedHeader =
              scroller.querySelector(
                '[data-client-day="' +
                  selectedDateKey +
                  '"]',
              );

            if (
              !selectedHeader
            ) {
              return;
            }

            const nextLeft =
              Math.max(
                0,
                selectedHeader.offsetLeft -
                  (
                    scroller.clientWidth -
                    selectedHeader.offsetWidth
                  ) /
                    2,
              );

            scroller.scrollTo({
              behavior:
                window.matchMedia(
                  '(prefers-reduced-motion: reduce)',
                ).matches
                  ? 'auto'
                  : 'smooth',
              left:
                nextLeft,
            });
          },
        );

      return () =>
        window.cancelAnimationFrame(
          frame,
        );
    },
    [
      selectedDateKey,
    ],
  );

  function previousWeek() {
    setCalendarSelectedDate(
      shiftDate(
        calendarSelectedDate,
        'week',
        -1,
      ),
    );
  }

  function nextWeek() {
    setCalendarSelectedDate(
      shiftDate(
        calendarSelectedDate,
        'week',
        1,
      ),
    );
  }

  function goToday() {
    setCalendarSelectedDate(
      startOfDay(
        new Date(),
      ),
    );
  }

  const quickDaySummaries = weekDays.map((day) => {
    const dayIso = toIsoDate(day);
    const busyCount = businessHours.filter((hour) =>
      Boolean(getBlockForSlot(bookingBlocks, dayIso, Number(hour.start))),
    ).length;

    return {
      day,
      dayIso,
      freeCount: Math.max(0, businessHours.length - busyCount),
      isToday: isSameDay(day, today),
      isSelected: isSameDay(day, calendarSelectedDate),
    };
  });

  const activeQuickDay =
    quickDaySummaries.find((item) => item.isSelected) || quickDaySummaries[0];

  const activeDayHeading = activeQuickDay
    ? new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(activeQuickDay.day)
    : '';

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="client-booking-board"
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <header className="client-booking-board-heading">
        <div>
          <span>
            Book Studio
          </span>

          <h2>
            Pilih Jadwal Studio
          </h2>

          <p>
            Ketuk tanggal &amp; jam kosong di bawah untuk langsung mengajukan booking, atau jelajahi kalender mingguan.
          </p>
        </div>

        <div className="client-booking-board-summary">
          <span>
            <b>
              {
                calendarSlotsReady ? availableSlots : '—'
              }
            </b>

            <small>
              {
                calendarSlotsReady ? 'slot tersedia' : 'data belum siap'
              }
            </small>

            minggu ini
          </span>
        </div>
      </header>

      {calendarSlotsLoading ? (
        <div className="client-calendar-data-state" role="status">
          Memuat ketersediaan jadwal…
        </div>
      ) : null}

      {calendarSlotsError ? (
        <div className="client-calendar-data-state is-error" role="alert">
          <span>{calendarSlotsError}</span>
          <button onClick={onRetryCalendarSlots} type="button">Coba lagi</button>
        </div>
      ) : null}

      <section
        aria-label="Pilih cepat hari dan jam kosong"
        className="client-calendar-quick-strip"
      >
        <div className="client-calendar-quick-head">
          <div>
            <span>Cara cepat</span>
            <h3>1. Pilih Hari · 2. Ketuk Jam Kosong</h3>
          </div>
          <div className="client-calendar-quick-week-controls">
            <button
              aria-label="Minggu sebelumnya"
              type="button"
              onClick={previousWeek}
            >
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={goToday}>
              Hari Ini
            </button>
            <button
              aria-label="Minggu berikutnya"
              type="button"
              onClick={nextWeek}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="client-calendar-quick-days" role="listbox" aria-label="Tanggal dalam minggu">
          {quickDaySummaries.map((item) => (
            <button
              aria-selected={item.isSelected}
              className={
                'client-calendar-quick-day' +
                (item.isSelected ? ' is-selected' : '') +
                (item.isToday ? ' is-today' : '')
              }
              key={item.dayIso}
              role="option"
              type="button"
              onClick={() => setCalendarSelectedDate(startOfDay(item.day))}
            >
              <span>{dayNames[item.day.getDay()]}</span>
              <strong>{item.day.getDate()}</strong>
              <small>
                {!calendarSlotsReady
                  ? '—'
                  : item.freeCount > 0
                    ? `${item.freeCount} jam`
                    : 'Penuh'}
              </small>
            </button>
          ))}
        </div>

        {activeQuickDay ? (
          <div className="client-calendar-day-hours-wrap">
            <div className="client-calendar-day-hours-label">
              <strong>{activeDayHeading}</strong>
              <span>
                {!calendarSlotsReady
                  ? 'Menunggu data jadwal…'
                  : activeQuickDay.freeCount > 0
                    ? `${activeQuickDay.freeCount} slot jam siap dibooking`
                    : 'Semua jam pada tanggal ini sudah terisi'}
              </span>
            </div>

            <div className="client-calendar-day-hours">
              {businessHours.map((hour) => {
                const hourStart = Number(hour.start);
                const block = getBlockForSlot(
                  bookingBlocks,
                  activeQuickDay.dayIso,
                  hourStart,
                );
                const own = Boolean(block?.booking?.isOwnClientBooking);

                if (block && own) {
                  return (
                    <button
                      className="client-calendar-hour-chip is-own"
                      key={`${activeQuickDay.dayIso}-${hour.key}`}
                      type="button"
                      onClick={() => handleBookingBlockClick(block.booking)}
                    >
                      <strong>{hour.label} WIB</strong>
                      <span>Booking Anda</span>
                    </button>
                  );
                }

                if (block) {
                  return (
                    <span
                      aria-label={`${hour.label} WIB sudah terisi`}
                      className="client-calendar-hour-chip is-busy"
                      key={`${activeQuickDay.dayIso}-${hour.key}`}
                    >
                      <strong>{hour.label}</strong>
                      <span>
                        <Lock size={12} aria-hidden="true" /> Terisi
                      </span>
                    </span>
                  );
                }

                return (
                  <button
                    className="client-calendar-hour-chip is-available"
                    disabled={!calendarSlotsReady}
                    key={`${activeQuickDay.dayIso}-${hour.key}`}
                    type="button"
                    onClick={() =>
                      handleSlotClick({
                        date: activeQuickDay.dayIso,
                        startHour: String(hour.start),
                      })
                    }
                  >
                    <strong>{hour.label} WIB</strong>
                    <span>
                      <Plus size={13} aria-hidden="true" /> Pilih
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <div className="client-booking-calendar-shell">
        <div className="client-booking-toolbar">
        <div className="client-booking-toolbar-navigation">
          <button
            aria-label="Minggu sebelumnya"
            type="button"
            onClick={
              previousWeek
            }
          >
            <ChevronLeft
              size={17}
            />
          </button>

          <button
            className="is-today"
            type="button"
            onClick={
              goToday
            }
          >
            Hari Ini
          </button>

          <button
            aria-label="Minggu berikutnya"
            type="button"
            onClick={
              nextWeek
            }
          >
            <ChevronRight
              size={17}
            />
          </button>
        </div>

        <div className="client-booking-toolbar-range">
          <CalendarDays
            size={16}
          />

          <strong>
            {
              formatDayRange(
                weekDays,
              )
            }
          </strong>
        </div>

        <div className="client-booking-toolbar-legend">
          <span className="is-available">
            Tersedia
          </span>

          <span className="is-busy">
            Terisi
          </span>

          <span className="is-own">
            Booking Anda
          </span>
        </div>
        </div>

        <div className="client-booking-mobile-context">
          <span>
            Kalender minggu
          </span>

          <strong>
            {
              formatDayRange(
                weekDays,
              )
            }
          </strong>

          <em>
            <MoveHorizontal
              size={14}
            />

            Geser
          </em>
        </div>

        <div className="client-booking-board-desktop">
        <div
          className="client-booking-board-scroll"
          ref={
            boardScrollRef
          }
        >
          <div
            className="client-booking-board-grid"
            style={{
              '--client-book-days':
                weekDays.length,
            }}
          >
            <div
              className="client-booking-board-corner"
              style={{
                gridColumn:
                  1,
                gridRow:
                  1,
              }}
            >
              <Clock3
                size={15}
              />

              <span>
                Jam
              </span>
            </div>

            {weekDays.map(
              (
                day,
                dayIndex,
              ) => {
                const todayCell =
                  isSameDay(
                    day,
                    today,
                  );

                const selectedCell =
                  isSameDay(
                    day,
                    calendarSelectedDate,
                  );

                return (
                  <button
                    className={
                      'client-booking-day-header' +
                      (
                        todayCell
                          ? ' is-today'
                          : ''
                      ) +
                      (
                        selectedCell
                          ? ' is-selected'
                          : ''
                      )
                    }
                    key={
                      toIsoDate(
                        day,
                      )
                    }
                    data-client-day={
                      toIsoDate(
                        day,
                      )
                    }
                    type="button"
                    style={{
                      gridColumn:
                        dayIndex +
                        2,
                      gridRow:
                        1,
                    }}
                    onClick={() =>
                      setCalendarSelectedDate(
                        startOfDay(
                          day,
                        ),
                      )
                    }
                  >
                    <span>
                      {
                        dayNames[
                          day.getDay()
                        ]
                      }
                    </span>

                    <strong>
                      {
                        day.getDate()
                      }
                    </strong>

                    {todayCell ? (
                      <small>
                        Hari ini
                      </small>
                    ) : null}
                  </button>
                );
              },
            )}

            {businessHours.map(
              (
                hour,
                hourIndex,
              ) => {
                const hourStart =
                  Number(
                    hour.start,
                  );

                return (
                  <Fragment
                    key={
                      hour.key
                    }
                  >
                    <div
                      className="client-booking-time-cell"
                      style={{
                        gridColumn:
                          1,
                        gridRow:
                          hourIndex +
                          2,
                      }}
                    >
                      <strong>
                        {
                          hour.label
                        }
                      </strong>

                      <span>
                        {
                          hour.rangeLabel
                        }
                      </span>
                    </div>

                    {weekDays.map(
                      (
                        day,
                        dayIndex,
                      ) => {
                        const dayIso =
                          toIsoDate(
                            day,
                          );

                        const block =
                          getBlockForSlot(
                            bookingBlocks,
                            dayIso,
                            hourStart,
                          );

                        const cellPlacement = {
                          gridColumn:
                            dayIndex +
                            2,
                          gridRow:
                            hourIndex +
                            2,
                        };

                        if (
                          block
                        ) {
                          return (
                            <div
                              aria-hidden="true"
                              className="client-booking-slot is-under-booking"
                              key={
                                dayIso +
                                '-' +
                                hour.key
                              }
                              style={
                                cellPlacement
                              }
                            />
                          );
                        }

                        return (
                          <button
                            aria-label={
                              'Book ' +
                              dayIso +
                              ' jam ' +
                              hour.label
                            }
                            className="client-booking-slot is-available"
                            disabled={!calendarSlotsReady}
                            key={
                              dayIso +
                              '-' +
                              hour.key
                            }
                            style={
                              cellPlacement
                            }
                            type="button"
                            onClick={() =>
                              handleSlotClick({
                                date:
                                  dayIso,
                                startHour:
                                  String(
                                    hour.start,
                                  ),
                              })
                            }
                          >
                            <Plus
                              size={14}
                            />

                            <span>
                              Book
                            </span>
                          </button>
                        );
                      },
                    )}
                  </Fragment>
                );
              },
            )}

            {bookingBlocks.map(
              (
                block,
              ) => {
                const own =
                  Boolean(
                    block.booking
                      ?.isOwnClientBooking,
                  );

                const startHour =
                  Number(
                    block.booking
                      ?.startHour,
                  );

                const duration =
                  Math.max(
                    1,
                    Number(
                      block.booking
                        ?.durationHours ||
                      block.spanRows,
                    ),
                  );

                const blockKey =
                  block.booking
                    ?.id ||
                  block.dayKey +
                    '-' +
                    startHour;

                const blockContent = (
                  <>
                    <span>
                      {
                        own
                          ? 'Booking Anda'
                          : 'Studio terisi'
                      }
                    </span>

                    <strong>
                      {
                        own
                          ? getServiceLabel(
                              block.booking,
                            )
                          : 'Tidak tersedia'
                      }
                    </strong>

                    <small>
                      {
                        String(
                          startHour,
                        ).padStart(
                          2,
                          '0',
                        ) +
                        '.00 — ' +
                        String(
                          startHour +
                          duration,
                        ).padStart(
                          2,
                          '0',
                        ) +
                        '.00'
                      }

                      {own
                        ? ' · ' +
                          getStatusLabel(
                            getLegacyBookingPaymentStatus(
                              block.booking,
                            ),
                          )
                        : ''}
                    </small>
                  </>
                );

                if (
                  own
                ) {
                  return (
                    <button
                      aria-label={
                        'Buka booking Anda tanggal ' +
                        block.dayKey +
                        ' jam ' +
                        startHour +
                        '.00'
                      }
                      className={
                        'client-calendar-booking-block is-own' +
                        (
                          block.spanRows === 1
                            ? ' is-single'
                            : ''
                        )
                      }
                      key={
                        blockKey
                      }
                      style={
                        getBookingBlockPlacement(
                          block,
                        )
                      }
                      type="button"
                      onClick={() =>
                        handleBookingBlockClick(
                          block.booking,
                        )
                      }
                    >
                      {
                        blockContent
                      }
                    </button>
                  );
                }

                return (
                  <div
                    aria-label={
                      'Studio terisi tanggal ' +
                      block.dayKey +
                      ' jam ' +
                      startHour +
                      '.00'
                    }
                    className={
                      'client-calendar-booking-block is-busy' +
                      (
                        block.spanRows === 1
                          ? ' is-single'
                          : ''
                      )
                    }
                    key={
                      blockKey
                    }
                    role="img"
                    style={
                      getBookingBlockPlacement(
                        block,
                      )
                    }
                  >
                    <Lock
                      aria-hidden="true"
                      size={13}
                    />

                    {
                      blockContent
                    }
                  </div>
                );
              },
            )}
          </div>
        </div>
        </div>
      </div>
    </motion.section>
  );
}
