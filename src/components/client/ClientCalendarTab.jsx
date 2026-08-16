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

  return (
    <section className="client-booking-board">
      <header className="client-booking-board-heading">
        <div>
          <span>
            Book Studio
          </span>

          <h2>
            Kalender Studio
          </h2>

          <p>
            Pilih slot kosong pada kalender. Jadwal client lain tetap privat dan hanya ditandai sebagai terisi.
          </p>
        </div>

        <div className="client-booking-board-summary">
          <span>
            <b>
              {
                availableSlots
              }
            </b>

            <small>
              slot tersedia
            </small>

            minggu ini
          </span>
        </div>
      </header>

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
    </section>
  );
}
