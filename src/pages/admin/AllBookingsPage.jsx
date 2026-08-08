import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertCircle,
  CalendarDays,
  CreditCard,
  Inbox,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  Search,
} from 'lucide-react';
import BookingDetailDrawer from '../../components/booking/BookingDetailDrawer.jsx';
import PaginationControls from '../../components/ui/PaginationControls.jsx';
import {
  BOOKING_PAYMENT_STATUS_META,
  BOOKING_REQUEST_STATUS_META,
  BOOKING_SESSION_STATUS_META,
} from '../../domain/booking/bookingStatus.js';
import {
  getBookingPaymentStatus,
  getBookingRequestStatus,
  getBookingSessionStatus,
  isBookingPaymentOpen,
  isBookingRequestActionable,
} from '../../domain/booking/bookingSelectors.js';
import { adminBookingRepository } from '../../services/adminBookingRepository.js';
import {
  getPaginationSlice,
} from '../../utils/pagination.js';
import '../../styles/modules/all-bookings.css';

const FILTER_ALL = 'all';

function buildFilterOptions(metaMap) {
  return Object.entries(metaMap)
    .map(([value, meta]) => ({
      label: meta.label,
      value,
    }));
}

const REQUEST_FILTERS = Object.freeze(
  buildFilterOptions(
    BOOKING_REQUEST_STATUS_META,
  ),
);

const PAYMENT_FILTERS = Object.freeze(
  buildFilterOptions(
    BOOKING_PAYMENT_STATUS_META,
  ),
);

const SESSION_FILTERS = Object.freeze(
  buildFilterOptions(
    BOOKING_SESSION_STATUS_META,
  ),
);

const STATUS_META = Object.freeze({
  request:
    BOOKING_REQUEST_STATUS_META,
  payment:
    BOOKING_PAYMENT_STATUS_META,
  session:
    BOOKING_SESSION_STATUS_META,
});

function cleanSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function formatRupiah(value) {
  return new Intl.NumberFormat(
    'id-ID',
    {
      currency: 'IDR',
      maximumFractionDigits: 0,
      style: 'currency',
    },
  ).format(
    Math.max(
      0,
      Number(value) || 0,
    ),
  );
}

function formatDateLabel(value) {
  if (!value) return '-';

  const date =
    new Date(
      String(value) +
        'T00:00:00',
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
}

function formatHour(value) {
  const safeHour =
    Number(value) || 0;

  const whole =
    Math.floor(safeHour);

  const minutes =
    Math.round(
      (
        safeHour -
        whole
      ) *
        60,
    );

  return (
    String(whole)
      .padStart(2, '0') +
    '.' +
    String(minutes)
      .padStart(2, '0')
  );
}

function getBookingWindowLabel(
  booking,
) {
  const start =
    Number(
      booking?.startHour,
    ) || 0;

  const duration =
    Number(
      booking?.durationHours ??
        booking?.duration,
    );

  if (
    !Number.isFinite(
      duration,
    ) ||
    duration <= 0
  ) {
    return (
      formatHour(start) +
      ' WIB'
    );
  }

  return (
    formatHour(start) +
    ' - ' +
    formatHour(
      start +
        duration,
    )
  );
}

function getServiceLabel(
  booking,
) {
  return (
    booking?.packageLabel ||
    booking?.recordingTypeLabel ||
    booking?.sessionLabel ||
    booking?.title ||
    'Sesi Studio'
  );
}

function getBookingCode(
  booking,
) {
  return (
    booking?.bookingCode ||
    booking?.bookingId ||
    booking?.id ||
    'BKG'
  );
}

function getBookingSearchHaystack(
  booking,
) {
  return [
    booking?.customer,
    booking?.bandName,
    booking?.phone,
    booking?.email,
    booking?.bookingCode,
    booking?.bookingId,
    booking?.invoiceNumber,
    booking?.id,
    booking?.source,
    getServiceLabel(booking),
    getBookingRequestStatus(
      booking,
    ),
    getBookingPaymentStatus(
      booking,
    ),
    getBookingSessionStatus(
      booking,
    ),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getBookingSortKey(
  booking,
) {
  const date =
    String(
      booking?.date || '',
    );

  const hour =
    String(
      Math.round(
        (
          Number(
            booking?.startHour,
          ) || 0
        ) *
          100,
      ),
    ).padStart(4, '0');

  const updatedAt =
    String(
      booking?.updatedAt ||
        booking?.createdAt ||
        '',
    );

  return (
    date +
    '|' +
    hour +
    '|' +
    updatedAt
  );
}

function sortBookings(
  first,
  second,
) {
  return getBookingSortKey(
    second,
  ).localeCompare(
    getBookingSortKey(
      first,
    ),
  );
}

function getSourceLabel(
  booking,
) {
  return booking?.source ===
    'clientPortal'
    ? 'Client'
    : 'Admin';
}

function DomainStatus({
  domain,
  status,
}) {
  const meta =
    STATUS_META[
      domain
    ]?.[
      status
    ] || {
      label:
        status ||
        '-',
      tone:
        'neutral',
    };

  return (
    <span
      className={
        'all-bookings-status is-' +
        domain +
        ' is-' +
        meta.tone
      }
    >
      {meta.label}
    </span>
  );
}

export default function AllBookingsPage() {
  const [
    bookings,
    setBookings,
  ] = useState([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState('');

  const [
    query,
    setQuery,
  ] = useState('');

  const [
    requestFilter,
    setRequestFilter,
  ] = useState(
    FILTER_ALL,
  );

  const [
    paymentFilter,
    setPaymentFilter,
  ] = useState(
    FILTER_ALL,
  );

  const [
    sessionFilter,
    setSessionFilter,
  ] = useState(
    FILTER_ALL,
  );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    selectedBookingId,
    setSelectedBookingId,
  ] = useState('');

  /**
   * Global booking index intentionally subscribes without a date range.
   * It is a read surface; write ownership remains with Calendar,
   * Request Inbox, and Finance modules.
   */
  useEffect(() => {
    const unsubscribe =
      adminBookingRepository
        .subscribeManualBookings(
          (data) => {
            setBookings(
              data,
            );

            setLoadError(
              '',
            );

            setIsLoading(
              false,
            );
          },
          (error) => {
            console.error(
              '[all-bookings] Gagal membaca booking:',
              error,
            );

            setLoadError(
              'Daftar booking belum dapat dimuat dari Firestore.',
            );

            setIsLoading(
              false,
            );
          },
        );

    return unsubscribe;
  }, []);

  const summary =
    useMemo(
      () => ({
        total:
          bookings.length,

        actionable:
          bookings.filter(
            isBookingRequestActionable,
          ).length,

        paymentOpen:
          bookings.filter(
            isBookingPaymentOpen,
          ).length,

        upcoming:
          bookings.filter(
            (booking) =>
              getBookingSessionStatus(
                booking,
              ) ===
              'upcoming',
          ).length,
      }),
      [bookings],
    );

  const visibleBookings =
    useMemo(
      () => {
        const search =
          cleanSearchText(
            query,
          );

        return bookings
          .filter(
            (booking) => {
              const requestStatus =
                getBookingRequestStatus(
                  booking,
                );

              const paymentStatus =
                getBookingPaymentStatus(
                  booking,
                );

              const sessionStatus =
                getBookingSessionStatus(
                  booking,
                );

              if (
                requestFilter !==
                  FILTER_ALL &&
                requestStatus !==
                  requestFilter
              ) {
                return false;
              }

              if (
                paymentFilter !==
                  FILTER_ALL &&
                paymentStatus !==
                  paymentFilter
              ) {
                return false;
              }

              if (
                sessionFilter !==
                  FILTER_ALL &&
                sessionStatus !==
                  sessionFilter
              ) {
                return false;
              }

              if (!search) {
                return true;
              }

              return getBookingSearchHaystack(
                booking,
              ).includes(
                search,
              );
            },
          )
          .toSorted(
            sortBookings,
          );
      },
      [
        bookings,
        paymentFilter,
        query,
        requestFilter,
        sessionFilter,
      ],
    );

  const pagedBookings =
    useMemo(
      () =>
        getPaginationSlice(
          visibleBookings,
          page,
        ),
      [
        page,
        visibleBookings,
      ],
    );

  const selectedBooking =
    useMemo(
      () =>
        bookings.find(
          (booking) =>
            booking.id ===
            selectedBookingId,
        ) ||
        null,
      [
        bookings,
        selectedBookingId,
      ],
    );

  const hasActiveFilters =
    Boolean(
      cleanSearchText(
        query,
      ),
    ) ||
    requestFilter !==
      FILTER_ALL ||
    paymentFilter !==
      FILTER_ALL ||
    sessionFilter !==
      FILTER_ALL;

  function changeQuery(
    value,
  ) {
    setQuery(value);
    setPage(1);
  }

  function changeRequestFilter(
    value,
  ) {
    setRequestFilter(
      value,
    );

    setPage(1);
  }

  function changePaymentFilter(
    value,
  ) {
    setPaymentFilter(
      value,
    );

    setPage(1);
  }

  function changeSessionFilter(
    value,
  ) {
    setSessionFilter(
      value,
    );

    setPage(1);
  }

  function resetFilters() {
    setQuery('');
    setRequestFilter(
      FILTER_ALL,
    );
    setPaymentFilter(
      FILTER_ALL,
    );
    setSessionFilter(
      FILTER_ALL,
    );
    setPage(1);
  }

  function openBooking(
    booking,
  ) {
    setSelectedBookingId(
      booking.id,
    );
  }

  function closeBooking() {
    setSelectedBookingId(
      '',
    );
  }

  return (
    <section
      className="all-bookings-page"
      aria-labelledby="all-bookings-title"
    >
      <header className="all-bookings-hero">
        <div className="all-bookings-heading">
          <span>
            Booking Command Center
          </span>

          <h2 id="all-bookings-title">
            All Bookings
          </h2>

          <p>
            Indeks global seluruh booking dengan status Request, Payment, dan Session yang dinormalisasi dari domain booking.
          </p>
        </div>

        <div
          className="all-bookings-total"
          aria-label={
            summary.total +
            ' total booking'
          }
        >
          <ListChecks
            aria-hidden="true"
            size={20}
          />

          <span>
            <strong>
              {summary.total}
            </strong>

            <small>
              Total Booking
            </small>
          </span>
        </div>
      </header>

      <section
        className="all-bookings-stats"
        aria-label="Ringkasan booking"
      >
        <article>
          <CalendarDays
            aria-hidden="true"
            size={17}
          />

          <span>
            Upcoming
          </span>

          <strong>
            {summary.upcoming}
          </strong>

          <small>
            sesi akan datang
          </small>
        </article>

        <article>
          <CreditCard
            aria-hidden="true"
            size={17}
          />

          <span>
            Payment Open
          </span>

          <strong>
            {summary.paymentOpen}
          </strong>

          <small>
            belum lunas
          </small>
        </article>

        <article>
          <Inbox
            aria-hidden="true"
            size={17}
          />

          <span>
            Actionable
          </span>

          <strong>
            {summary.actionable}
          </strong>

          <small>
            butuh keputusan
          </small>
        </article>
      </section>

      <section
        className="all-bookings-toolbar"
        aria-label="Filter All Bookings"
      >
        <label className="all-bookings-search">
          <Search
            aria-hidden="true"
            size={16}
          />

          <input
            aria-label="Cari seluruh booking"
            placeholder="Cari customer, WA, booking, invoice..."
            type="search"
            value={query}
            onChange={(event) =>
              changeQuery(
                event.target.value,
              )
            }
          />
        </label>

        <div className="all-bookings-filters">
          <label>
            <span>Request</span>

            <select
              value={requestFilter}
              onChange={(event) =>
                changeRequestFilter(
                  event.target.value,
                )
              }
            >
              <option value={FILTER_ALL}>
                Semua Request
              </option>

              {REQUEST_FILTERS.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>Payment</span>

            <select
              value={paymentFilter}
              onChange={(event) =>
                changePaymentFilter(
                  event.target.value,
                )
              }
            >
              <option value={FILTER_ALL}>
                Semua Payment
              </option>

              {PAYMENT_FILTERS.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>Session</span>

            <select
              value={sessionFilter}
              onChange={(event) =>
                changeSessionFilter(
                  event.target.value,
                )
              }
            >
              <option value={FILTER_ALL}>
                Semua Session
              </option>

              {SESSION_FILTERS.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        {hasActiveFilters ? (
          <button
            className="all-bookings-reset"
            type="button"
            onClick={
              resetFilters
            }
          >
            <RotateCcw
              aria-hidden="true"
              size={14}
            />
            Reset
          </button>
        ) : null}
      </section>

      <div className="all-bookings-result-bar">
        <span>
          Menampilkan
          {' '}
          <strong>
            {
              visibleBookings.length
            }
          </strong>
          {' '}
          dari
          {' '}
          <strong>
            {bookings.length}
          </strong>
          {' '}
          booking
        </span>

        <small>
          Realtime Firestore
        </small>
      </div>

      {isLoading ? (
        <div
          className="all-bookings-state"
          role="status"
        >
          <LoaderCircle
            className="is-spinning"
            size={24}
          />

          <strong>
            Memuat booking...
          </strong>
        </div>
      ) : loadError ? (
        <div
          className="all-bookings-state is-error"
          role="alert"
        >
          <AlertCircle
            size={24}
          />

          <strong>
            Gagal memuat booking
          </strong>

          <p>
            {loadError}
          </p>
        </div>
      ) : visibleBookings.length ? (
        <>
          <div className="all-bookings-table-shell">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Jadwal</th>
                  <th>Request</th>
                  <th>Payment</th>
                  <th>Session</th>
                  <th>Total</th>
                  <th aria-label="Aksi" />
                </tr>
              </thead>

              <tbody>
                {pagedBookings.map(
                  (booking) => {
                    const requestStatus =
                      getBookingRequestStatus(
                        booking,
                      );

                    const paymentStatus =
                      getBookingPaymentStatus(
                        booking,
                      );

                    const sessionStatus =
                      getBookingSessionStatus(
                        booking,
                      );

                    return (
                      <tr
                        key={
                          booking.id
                        }
                      >
                        <td>
                          <button
                            className="all-bookings-primary"
                            type="button"
                            onClick={() =>
                              openBooking(
                                booking,
                              )
                            }
                          >
                            <strong>
                              {
                                booking.customer ||
                                'Customer'
                              }
                            </strong>

                            <small>
                              {
                                getBookingCode(
                                  booking,
                                )
                              }
                              {' · '}
                              {
                                getSourceLabel(
                                  booking,
                                )
                              }
                            </small>

                            <span>
                              {
                                getServiceLabel(
                                  booking,
                                )
                              }
                            </span>
                          </button>
                        </td>

                        <td>
                          <div className="all-bookings-schedule">
                            <strong>
                              {
                                formatDateLabel(
                                  booking.date,
                                )
                              }
                            </strong>

                            <small>
                              {
                                getBookingWindowLabel(
                                  booking,
                                )
                              }
                            </small>
                          </div>
                        </td>

                        <td>
                          <DomainStatus
                            domain="request"
                            status={
                              requestStatus
                            }
                          />
                        </td>

                        <td>
                          <DomainStatus
                            domain="payment"
                            status={
                              paymentStatus
                            }
                          />
                        </td>

                        <td>
                          <DomainStatus
                            domain="session"
                            status={
                              sessionStatus
                            }
                          />
                        </td>

                        <td>
                          <strong className="all-bookings-money">
                            {
                              formatRupiah(
                                booking.total ||
                                  booking.subtotal ||
                                  0,
                              )
                            }
                          </strong>
                        </td>

                        <td>
                          <button
                            className="all-bookings-detail"
                            type="button"
                            onClick={() =>
                              openBooking(
                                booking,
                              )
                            }
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>

          <div className="all-bookings-mobile-list">
            {pagedBookings.map(
              (booking) => {
                const requestStatus =
                  getBookingRequestStatus(
                    booking,
                  );

                const paymentStatus =
                  getBookingPaymentStatus(
                    booking,
                  );

                const sessionStatus =
                  getBookingSessionStatus(
                    booking,
                  );

                return (
                  <article
                    className="all-bookings-card"
                    key={
                      booking.id
                    }
                  >
                    <button
                      className="all-bookings-card-main"
                      type="button"
                      onClick={() =>
                        openBooking(
                          booking,
                        )
                      }
                    >
                      <span className="all-bookings-card-heading">
                        <strong>
                          {
                            booking.customer ||
                            'Customer'
                          }
                        </strong>

                        <small>
                          {
                            getBookingCode(
                              booking,
                            )
                          }
                        </small>
                      </span>

                      <span className="all-bookings-card-service">
                        {
                          getServiceLabel(
                            booking,
                          )
                        }
                      </span>

                      <span className="all-bookings-card-schedule">
                        <b>
                          {
                            formatDateLabel(
                              booking.date,
                            )
                          }
                        </b>

                        <small>
                          {
                            getBookingWindowLabel(
                              booking,
                            )
                          }
                        </small>
                      </span>
                    </button>

                    <div className="all-bookings-card-statuses">
                      <DomainStatus
                        domain="request"
                        status={
                          requestStatus
                        }
                      />

                      <DomainStatus
                        domain="payment"
                        status={
                          paymentStatus
                        }
                      />

                      <DomainStatus
                        domain="session"
                        status={
                          sessionStatus
                        }
                      />
                    </div>

                    <footer>
                      <span>
                        {
                          getSourceLabel(
                            booking,
                          )
                        }
                      </span>

                      <strong>
                        {
                          formatRupiah(
                            booking.total ||
                              booking.subtotal ||
                              0,
                          )
                        }
                      </strong>

                      <button
                        type="button"
                        onClick={() =>
                          openBooking(
                            booking,
                          )
                        }
                      >
                        Detail
                      </button>
                    </footer>
                  </article>
                );
              },
            )}
          </div>

          <PaginationControls
            label="booking"
            page={page}
            totalItems={
              visibleBookings.length
            }
            onPageChange={
              setPage
            }
          />
        </>
      ) : (
        <div className="all-bookings-state">
          <ListChecks
            size={26}
          />

          <strong>
            Tidak ada booking
          </strong>

          <p>
            Tidak ada data yang cocok dengan pencarian atau filter saat ini.
          </p>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={
                resetFilters
              }
            >
              Reset filter
            </button>
          ) : null}
        </div>
      )}

      <BookingDetailDrawer
        booking={
          selectedBooking
        }
        isOpen={
          Boolean(
            selectedBooking,
          )
        }
        onClose={
          closeBooking
        }
      />
    </section>
  );
}
