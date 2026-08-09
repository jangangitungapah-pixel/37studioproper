import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertCircle,
  ArrowUpRight,
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
import StudioSelect from '../../components/ui/StudioSelect.jsx';
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
      key: value,
      label: meta.label,
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

const REQUEST_SELECT_OPTIONS =
  Object.freeze([
    {
      key:
        FILTER_ALL,

      label:
        'Semua Request',
    },

    ...REQUEST_FILTERS,
  ]);

const PAYMENT_SELECT_OPTIONS =
  Object.freeze([
    {
      key:
        FILTER_ALL,

      label:
        'Semua Payment',
    },

    ...PAYMENT_FILTERS,
  ]);

const SESSION_SELECT_OPTIONS =
  Object.freeze([
    {
      key:
        FILTER_ALL,

      label:
        'Semua Session',
    },

    ...SESSION_FILTERS,
  ]);

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
      aria-labelledby="all-bookings-title"
      className="all-bookings-page"
      data-all-bookings-ui="ui-4-spatial"
    >
      <header className="all-bookings-editorial-header">
        <div className="all-bookings-heading">
          <span className="all-bookings-kicker">
            Global booking index
          </span>

          <h2 id="all-bookings-title">
            All Bookings
          </h2>

          <p>
            Temukan booking apa pun dengan cepat, lalu pahami status
            Request, Payment, dan Session dalam satu indeks global.
          </p>
        </div>

        <div className="all-bookings-live-object">
          <span
            aria-hidden="true"
            className="all-bookings-live-dot"
          />

          <span>
            <small>
              Realtime index
            </small>

            <strong>
              {summary.total}
            </strong>

            <em>
              booking terbaca
            </em>
          </span>
        </div>
      </header>

      <section
        aria-label="Ringkasan operasional booking"
        className="all-bookings-metric-strip"
      >
        <article className="all-bookings-metric is-total">
          <span className="all-bookings-metric-icon">
            <ListChecks
              aria-hidden="true"
              size={17}
            />
          </span>

          <span>
            <small>
              Total Booking
            </small>

            <strong>
              {summary.total}
            </strong>

            <em>
              seluruh indeks
            </em>
          </span>
        </article>

        <article className="all-bookings-metric is-upcoming">
          <span className="all-bookings-metric-icon">
            <CalendarDays
              aria-hidden="true"
              size={17}
            />
          </span>

          <span>
            <small>
              Upcoming
            </small>

            <strong>
              {summary.upcoming}
            </strong>

            <em>
              sesi akan datang
            </em>
          </span>
        </article>

        <article className="all-bookings-metric is-payment">
          <span className="all-bookings-metric-icon">
            <CreditCard
              aria-hidden="true"
              size={17}
            />
          </span>

          <span>
            <small>
              Payment Open
            </small>

            <strong>
              {summary.paymentOpen}
            </strong>

            <em>
              belum selesai
            </em>
          </span>
        </article>

        <article className="all-bookings-metric is-actionable">
          <span className="all-bookings-metric-icon">
            <Inbox
              aria-hidden="true"
              size={17}
            />
          </span>

          <span>
            <small>
              Actionable
            </small>

            <strong>
              {summary.actionable}
            </strong>

            <em>
              butuh keputusan
            </em>
          </span>
        </article>
      </section>

      <section
        aria-label="Command shelf All Bookings"
        className="all-bookings-command-shelf"
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

        <div className="all-bookings-filter-grid">
          <StudioSelect
            className="all-bookings-filter-select"
            label="Request"
            options={REQUEST_SELECT_OPTIONS}
            selectedKey={requestFilter}
            onChange={
              changeRequestFilter
            }
          />

          <StudioSelect
            className="all-bookings-filter-select"
            label="Payment"
            options={PAYMENT_SELECT_OPTIONS}
            selectedKey={paymentFilter}
            onChange={
              changePaymentFilter
            }
          />

          <StudioSelect
            className="all-bookings-filter-select"
            label="Session"
            options={SESSION_SELECT_OPTIONS}
            selectedKey={sessionFilter}
            onChange={
              changeSessionFilter
            }
          />
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
        ) : (
          <span
            aria-hidden="true"
            className="all-bookings-command-rest"
          >
            Filter siap
          </span>
        )}
      </section>

      {isLoading ? (
        <section
          aria-label="Memuat All Bookings"
          className="all-bookings-loading"
          role="status"
        >
          <header>
            <LoaderCircle
              aria-hidden="true"
              className="is-spinning"
              size={18}
            />

            <span>
              <strong>
                Menyusun booking index...
              </strong>

              <small>
                Membaca status realtime
              </small>
            </span>
          </header>

          <div className="all-bookings-loading-rows">
            {Array.from(
              {
                length:
                  6,
              },
              (
                _,
                index,
              ) => (
                <span
                  className="all-bookings-loading-row"
                  key={index}
                />
              ),
            )}
          </div>
        </section>
      ) : loadError ? (
        <section
          className="all-bookings-state is-error"
          role="alert"
        >
          <span className="all-bookings-state-icon">
            <AlertCircle
              aria-hidden="true"
              size={22}
            />
          </span>

          <div>
            <small>
              Global booking index
            </small>

            <strong>
              Gagal memuat booking
            </strong>

            <p>
              {loadError}
            </p>
          </div>
        </section>
      ) : visibleBookings.length ? (
        <>
          <section
            aria-label="Global booking data surface"
            className="all-bookings-data-surface"
          >
            <header className="all-bookings-data-head">
              <div>
                <span className="all-bookings-kicker">
                  Booking index
                </span>

                <h3>
                  {visibleBookings.length}{' '}
                  booking ditampilkan
                </h3>

                <p>
                  {hasActiveFilters
                    ? 'Hasil mengikuti search dan filter aktif.'
                    : 'Urutan terbaru berdasarkan jadwal dan update booking.'}
                </p>
              </div>

              <span className="all-bookings-data-live">
                <i
                  aria-hidden="true"
                  className="all-bookings-live-dot"
                />

                Realtime Firestore
              </span>
            </header>

            <div className="all-bookings-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      Customer
                    </th>

                    <th scope="col">
                      Jadwal
                    </th>

                    <th scope="col">
                      Request
                    </th>

                    <th scope="col">
                      Payment
                    </th>

                    <th scope="col">
                      Session
                    </th>

                    <th scope="col">
                      Total
                    </th>

                    <th
                      aria-label="Aksi"
                      scope="col"
                    />
                  </tr>
                </thead>

                <tbody>
                  {pagedBookings.map(
                    (
                      booking,
                    ) => {
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

                      const needsAttention =
                        isBookingRequestActionable(
                          booking,
                        ) ||
                        isBookingPaymentOpen(
                          booking,
                        );

                      return (
                        <tr
                          className={
                            needsAttention
                              ? 'has-attention'
                              : ''
                          }
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
                                {booking.customer ||
                                  'Customer'}
                              </strong>

                              <small>
                                {getBookingCode(
                                  booking,
                                )}
                                {' · '}
                                {getSourceLabel(
                                  booking,
                                )}
                              </small>

                              <span>
                                {getServiceLabel(
                                  booking,
                                )}
                              </span>
                            </button>
                          </td>

                          <td>
                            <div className="all-bookings-schedule">
                              <strong>
                                {formatDateLabel(
                                  booking.date,
                                )}
                              </strong>

                              <small>
                                {getBookingWindowLabel(
                                  booking,
                                )}
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
                              {formatRupiah(
                                booking.total ||
                                  booking.subtotal ||
                                  0,
                              )}
                            </strong>
                          </td>

                          <td>
                            <button
                              aria-label={
                                'Buka detail booking ' +
                                getBookingCode(
                                  booking,
                                )
                              }
                              className="all-bookings-detail"
                              type="button"
                              onClick={() =>
                                openBooking(
                                  booking,
                                )
                              }
                            >
                              <span>
                                Detail
                              </span>

                              <ArrowUpRight
                                aria-hidden="true"
                                size={13}
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>

            <div className="all-bookings-mobile-rows">
              {pagedBookings.map(
                (
                  booking,
                ) => {
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

                  const needsAttention =
                    isBookingRequestActionable(
                      booking,
                    ) ||
                    isBookingPaymentOpen(
                      booking,
                    );

                  return (
                    <article
                      className={
                        needsAttention
                          ? 'all-bookings-mobile-row has-attention'
                          : 'all-bookings-mobile-row'
                      }
                      key={
                        booking.id
                      }
                    >
                      <button
                        className="all-bookings-mobile-main"
                        type="button"
                        onClick={() =>
                          openBooking(
                            booking,
                          )
                        }
                      >
                        <span className="all-bookings-mobile-topline">
                          <strong>
                            {booking.customer ||
                              'Customer'}
                          </strong>

                          <small>
                            {getBookingCode(
                              booking,
                            )}
                          </small>
                        </span>

                        <span className="all-bookings-mobile-service">
                          {getServiceLabel(
                            booking,
                          )}
                        </span>

                        <span className="all-bookings-mobile-schedule">
                          <span>
                            <CalendarDays
                              aria-hidden="true"
                              size={13}
                            />

                            {formatDateLabel(
                              booking.date,
                            )}
                          </span>

                          <span>
                            {getBookingWindowLabel(
                              booking,
                            )}
                          </span>
                        </span>
                      </button>

                      <div className="all-bookings-mobile-statuses">
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

                      <footer className="all-bookings-mobile-footer">
                        <span className="all-bookings-source">
                          {getSourceLabel(
                            booking,
                          )}
                        </span>

                        <strong>
                          {formatRupiah(
                            booking.total ||
                              booking.subtotal ||
                              0,
                          )}
                        </strong>

                        <button
                          aria-label={
                            'Buka detail booking ' +
                            getBookingCode(
                              booking,
                            )
                          }
                          type="button"
                          onClick={() =>
                            openBooking(
                              booking,
                            )
                          }
                        >
                          Detail

                          <ArrowUpRight
                            aria-hidden="true"
                            size={13}
                          />
                        </button>
                      </footer>
                    </article>
                  );
                },
              )}
            </div>
          </section>

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
        <section className="all-bookings-state">
          <span className="all-bookings-state-icon">
            <ListChecks
              aria-hidden="true"
              size={22}
            />
          </span>

          <div>
            <small>
              Global booking index
            </small>

            <strong>
              Tidak ada booking
            </strong>

            <p>
              {hasActiveFilters
                ? 'Tidak ada booking yang cocok dengan pencarian atau filter saat ini.'
                : 'Belum ada booking untuk ditampilkan pada indeks global.'}
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
        </section>
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
