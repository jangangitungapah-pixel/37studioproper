import {
  Fragment,
} from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Lock,
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

function isBlockStart(
  block,
  hourStart,
) {
  return (
    Number(
      block?.booking
        ?.startHour,
    ) ===
    Number(
      hourStart,
    )
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
  const weekDays =
    getWeekDays(
      calendarSelectedDate,
      startOfDay,
    );

  const today =
    startOfDay(
      new Date(),
    );

  const selectedDateIso =
    toIsoDate(
      calendarSelectedDate,
    );

  const selectedDayBlocks =
    bookingBlocks.filter(
      (
        block,
      ) =>
        block.dayKey ===
        selectedDateIso,
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
            Pilih waktu yang cocok.
          </h2>

          <p>
            Slot kosong dapat langsung dipilih. Jadwal milik client lain hanya ditampilkan sebagai terisi.
          </p>
        </div>

        <div className="client-booking-board-summary">
          <span>
            <b>
              {
                availableSlots
              }
            </b>

            slot tersedia minggu ini
          </span>
        </div>
      </header>

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

      <div className="client-booking-mobile">
        <div className="client-booking-mobile-days">
          {weekDays.map(
            (
              day,
            ) => {
              const selected =
                isSameDay(
                  day,
                  calendarSelectedDate,
                );

              const isToday =
                isSameDay(
                  day,
                  today,
                );

              return (
                <button
                  className={
                    selected
                      ? 'is-selected'
                      : isToday
                        ? 'is-today'
                        : ''
                  }
                  key={
                    toIsoDate(
                      day,
                    )
                  }
                  type="button"
                  onClick={() =>
                    setCalendarSelectedDate(
                      startOfDay(
                        day,
                      ),
                    )
                  }
                >
                  <small>
                    {
                      dayNames[
                        day.getDay()
                      ]
                    }
                  </small>

                  <strong>
                    {
                      day.getDate()
                    }
                  </strong>
                </button>
              );
            },
          )}
        </div>

        <div className="client-booking-mobile-date">
          <div>
            <span>
              Jadwal
            </span>

            <strong>
              {
                new Intl.DateTimeFormat(
                  'id-ID',
                  {
                    day:
                      'numeric',
                    month:
                      'long',
                    weekday:
                      'long',
                    year:
                      'numeric',
                  },
                ).format(
                  calendarSelectedDate,
                )
              }
            </strong>
          </div>

          <span>
            {
              businessHours.length -
              selectedDayBlocks.reduce(
                (
                  count,
                  block,
                ) =>
                  count +
                  Math.max(
                    1,
                    Number(
                      block.booking
                        ?.durationHours ||
                      1,
                    ),
                  ),
                0,
              )
            }
            {' kosong'}
          </span>
        </div>

        <div className="client-booking-mobile-slots">
          {businessHours.map(
            (
              hour,
            ) => {
              const hourStart =
                Number(
                  hour.start,
                );

              const block =
                getBlockForSlot(
                  bookingBlocks,
                  selectedDateIso,
                  hourStart,
                );

              if (
                block
              ) {
                const own =
                  Boolean(
                    block.booking
                      ?.isOwnClientBooking,
                  );

                if (
                  own
                ) {
                  return (
                    <button
                      className="client-book-mobile-slot is-own"
                      key={
                        hour.key
                      }
                      type="button"
                      onClick={() =>
                        handleBookingBlockClick(
                          block.booking,
                        )
                      }
                    >
                      <span>
                        {
                          hour.label
                        }
                      </span>

                      <strong>
                        Booking Anda
                      </strong>
                    </button>
                  );
                }

                return (
                  <div
                    className="client-book-mobile-slot is-busy"
                    key={
                      hour.key
                    }
                  >
                    <span>
                      {
                        hour.label
                      }
                    </span>

                    <strong>
                      Terisi
                    </strong>
                  </div>
                );
              }

              return (
                <button
                  className="client-book-mobile-slot is-available"
                  key={
                    hour.key
                  }
                  type="button"
                  onClick={() =>
                    handleSlotClick({
                      date:
                        selectedDateIso,
                      startHour:
                        String(
                          hour.start,
                        ),
                    })
                  }
                >
                  <span>
                    {
                      hour.label
                    }
                  </span>

                  <strong>
                    <Plus
                      size={12}
                    />

                    Book
                  </strong>
                </button>
              );
            },
          )}
        </div>
      </div>

      <div className="client-booking-board-desktop">
        <div className="client-booking-board-scroll">
          <div
            className="client-booking-board-grid"
            style={{
              '--client-book-days':
                weekDays.length,
            }}
          >
            <div className="client-booking-board-corner">
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
              ) => {
                const todayCell =
                  isSameDay(
                    day,
                    today,
                  );

                return (
                  <button
                    className={
                      'client-booking-day-header' +
                      (
                        todayCell
                          ? ' is-today'
                          : ''
                      )
                    }
                    key={
                      toIsoDate(
                        day,
                      )
                    }
                    type="button"
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
                    <div className="client-booking-time-cell">
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

                        if (
                          block
                        ) {
                          const own =
                            Boolean(
                              block.booking
                                ?.isOwnClientBooking,
                            );

                          const blockStart =
                            isBlockStart(
                              block,
                              hourStart,
                            );

                          if (
                            own
                          ) {
                            return (
                              <button
                                className="client-booking-slot is-own"
                                key={
                                  dayIso +
                                  '-' +
                                  hour.key
                                }
                                type="button"
                                onClick={() =>
                                  handleBookingBlockClick(
                                    block.booking,
                                  )
                                }
                              >
                                <span>
                                  {
                                    blockStart
                                      ? getServiceLabel(
                                          block.booking,
                                        )
                                      : 'Booking Anda'
                                  }
                                </span>

                                <small>
                                  {
                                    blockStart
                                      ? getStatusLabel(
                                          getLegacyBookingPaymentStatus(
                                            block.booking,
                                          ),
                                        )
                                      : 'lanjutan'
                                  }
                                </small>
                              </button>
                            );
                          }

                          return (
                            <div
                              className="client-booking-slot is-busy"
                              key={
                                dayIso +
                                '-' +
                                hour.key
                              }
                            >
                              <Lock
                                size={13}
                              />

                              <span>
                                Terisi
                              </span>

                              <small>
                                tidak tersedia
                              </small>
                            </div>
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
          </div>
        </div>
      </div>
    </section>
  );
}
