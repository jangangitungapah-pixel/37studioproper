import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertCircle,
  ArrowRight,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Inbox,
  LoaderCircle,
  MessageCircle,
  Phone,
  Search,
  XCircle,
} from 'lucide-react';

import BookingDetailDrawer from '../../components/booking/BookingDetailDrawer.jsx';

import {
  getBookingRequestStatus,
  getLegacyBookingPaymentStatus,
  isBookingRequestActionable,
} from '../../domain/booking/bookingSelectors.js';

import {
  adminBookingRepository,
} from '../../services/adminBookingRepository.js';

import {
  bookingCommunicationRepository,
} from '../../services/bookingCommunicationRepository.js';

import '../../styles/modules/booking-requests.css';

const REQUEST_FILTERS =
  Object.freeze([
    {
      key:
        'all',

      label:
        'Semua',
    },

    {
      key:
        'submitted',

      label:
        'Request Baru',
    },

    {
      key:
        'cancellation_requested',

      label:
        'Pembatalan',
    },
  ]);

function cleanSearchText(value) {
  return String(
    value || '',
  )
    .trim()
    .toLowerCase();
}

function formatRupiah(value) {
  return new Intl.NumberFormat(
    'id-ID',
    {
      currency:
        'IDR',

      maximumFractionDigits:
        0,

      style:
        'currency',
    },
  ).format(
    Math.max(
      0,
      Number(
        value,
      ) || 0,
    ),
  );
}

function formatDateLabel(value) {
  if (!value) {
    return '-';
  }

  const date =
    new Date(
      String(
        value,
      ) +
        'T00:00:00',
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(
      value,
    );
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    },
  ).format(
    date,
  );
}

function formatUpdatedAt(value) {
  if (!value) {
    return '-';
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '-';
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day:
        '2-digit',

      hour:
        '2-digit',

      minute:
        '2-digit',

      month:
        'short',
    },
  ).format(
    date,
  );
}

function formatHour(hourValue) {
  const safeHour =
    Number(
      hourValue,
    ) || 0;

  const wholeHour =
    Math.floor(
      safeHour,
    );

  const minutes =
    Math.round(
      (
        safeHour -
        wholeHour
      ) *
        60,
    );

  return (
    String(
      wholeHour,
    ).padStart(
      2,
      '0',
    ) +
    '.' +
    String(
      minutes,
    ).padStart(
      2,
      '0',
    )
  );
}

function getBookingWindowLabel(
  booking,
) {
  const startHour =
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
      formatHour(
        startHour,
      ) +
      ' WIB'
    );
  }

  return (
    formatHour(
      startHour,
    ) +
    '–' +
    formatHour(
      startHour +
        duration,
    ) +
    ' WIB'
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

function getRequestUpdatedAt(
  booking,
) {
  return (
    booking?.clientRequestUpdatedAt ||
    booking?.lastMessageAt ||
    booking?.updatedAt ||
    booking?.createdAt ||
    ''
  );
}

function getRequestSearchHaystack(
  booking,
) {
  return [
    booking?.customer,
    booking?.phone,
    booking?.email,
    booking?.bookingCode,
    booking?.bookingId,
    booking?.id,
    getServiceLabel(
      booking,
    ),
    booking?.clientRequestNote,
    booking?.lastMessagePreview,
  ]
    .filter(
      Boolean,
    )
    .join(
      ' ',
    )
    .toLowerCase();
}

function sortRequestBookings(
  first,
  second,
) {
  return String(
    getRequestUpdatedAt(
      second,
    ),
  ).localeCompare(
    String(
      getRequestUpdatedAt(
        first,
      ),
    ),
  );
}

function getRequestPresentation(
  booking,
) {
  const status =
    getBookingRequestStatus(
      booking,
    );

  if (
    status ===
    'cancellation_requested'
  ) {
    return {
      status,

      label:
        'Minta Batal',

      description:
        'Client meminta pembatalan booking.',

      decisionLabel:
        'Butuh keputusan pembatalan',

      tone:
        'cancellation',

      Icon:
        Ban,

      positiveStatus:
        'cancelled',

      positiveLabel:
        'Setujui Batal',

      negativeStatus:
        'confirmed',

      negativeLabel:
        'Pertahankan',
    };
  }

  return {
    status,

    label:
      'Request Baru',

    description:
      'Menunggu keputusan admin.',

    decisionLabel:
      'Butuh keputusan booking',

    tone:
      'submitted',

    Icon:
      Inbox,

    positiveStatus:
      'confirmed',

    positiveLabel:
      'Konfirmasi',

    negativeStatus:
      'rejected',

    negativeLabel:
      'Tolak',
  };
}

function getPaymentPresentation(
  booking,
) {
  const status =
    getLegacyBookingPaymentStatus(
      booking,
    );

  if (
    status ===
    'lunas'
  ) {
    return {
      label:
        'Lunas',

      tone:
        'success',
    };
  }

  if (
    status ===
    'dp'
  ) {
    return {
      label:
        'DP',

      tone:
        'warning',
    };
  }

  if (
    status ===
    'void'
  ) {
    return {
      label:
        'Void',

      tone:
        'danger',
    };
  }

  return {
    label:
      'Pending',

    tone:
      'neutral',
  };
}

function hasUnreadClientMessage(
  booking,
) {
  return (
    booking
      ?.lastMessageSenderRole ===
      'client' &&
    booking
      ?.lastMessageReadByAdmin ===
      false
  );
}

function BookingRequestLoading() {
  return (
    <section
      aria-label="Memuat Request Inbox"
      className="booking-request-loading"
      role="status"
    >
      <div className="booking-request-loading-heading">
        <LoaderCircle
          aria-hidden="true"
          className="booking-request-spin"
          size={18}
        />

        <span>
          Menyusun decision queue...
        </span>
      </>
div>

      {[
        0,
        1,
        2,
      ].map(
        (
          item,
        ) => (
          <span
            className="booking-request-skeleton-row"
            key={item}
          />
        ),
      )}
    </section>
  );
}

function BookingRequestState({
  error = false,
  hasRequests = false,
}) {
  return (
    <section
      className={
        error
          ? 'booking-request-state is-error'
          : 'booking-request-state'
      }
      role={
        error
          ? 'alert'
          : 'status'
      }
    >
      <span className="booking-request-state-icon">
        {error ? (
          <AlertCircle
            aria-hidden="true"
            size={22}
          />
        ) : (
          <Inbox
            aria-hidden="true"
            size={22}
          />
        )}
      </span>

      <div>
        <small>
          {error
            ? 'Request Inbox belum siap'
            : hasRequests
              ? 'Tidak ada hasil'
              : 'Decision queue kosong'}
        </small>

        <strong>
          {error
            ? 'Request booking belum dapat dimuat.'
            : hasRequests
              ? 'Tidak ada request yang cocok.'
              : 'Semua request client sudah ditangani.'}
        </strong>

        <p>
          {error
            ? 'Periksa koneksi lalu muat ulang halaman.'
            : hasRequests
              ? 'Coba ubah filter atau kata pencarian.'
              : 'Request baru dan pembatalan akan muncul otomatis di sini.'}
        </p>
      </div>
    </section>
  );
}

export default function BookingRequestsPage({
  currentUser,
}) {
  const [
    bookings,
    setBookings,
  ] =
    useState([]);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    );

  const [
    loadError,
    setLoadError,
  ] =
    useState('');

  const [
    filter,
    setFilter,
  ] =
    useState(
      'all',
    );

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    pendingActionKey,
    setPendingActionKey,
  ] =
    useState('');

  const [
    selectedBooking,
    setSelectedBooking,
  ] =
    useState(
      null,
    );

  const [
    selectedBookingTab,
    setSelectedBookingTab,
  ] =
    useState(
      'overview',
    );

  const [
    actionNotice,
    setActionNotice,
  ] =
    useState(
      null,
    );

  /**
   * Intentionally subscribe WITHOUT date range.
   *
   * Request Inbox is the global actionable request source.
   * Calendar keeps its own date-range subscription for rendering performance.
   */
  useEffect(() => {
    const unsubscribe =
      adminBookingRepository
        .subscribeManualBookings(
          (
            data,
          ) => {
            setBookings(
              data,
            );

            setLoadError('');

            setIsLoading(
              false,
            );
          },
          (
            error,
          ) => {
            console.error(
              '[booking-requests] Gagal membaca request booking:',
              error,
            );

            setLoadError(
              'Request booking belum dapat dimuat dari Firestore.',
            );

            setIsLoading(
              false,
            );
          },
        );

    return unsubscribe;
  }, []);

  const requestBookings =
    useMemo(
      () =>
        bookings
          .filter(
            isBookingRequestActionable,
          )
          .sort(
            sortRequestBookings,
          ),
      [
        bookings,
      ],
    );

  const counts =
    useMemo(
      () => {
        const next = {
          all:
            requestBookings.length,

          submitted:
            0,

          cancellation_requested:
            0,

          unread:
            0,
        };

        requestBookings.forEach(
          (
            booking,
          ) => {
            const requestStatus =
              getBookingRequestStatus(
                booking,
              );

            if (
              requestStatus ===
              'submitted'
            ) {
              next.submitted +=
                1;
            }

            if (
              requestStatus ===
              'cancellation_requested'
            ) {
              next.cancellation_requested +=
                1;
            }

            if (
              hasUnreadClientMessage(
                booking,
              )
            ) {
              next.unread +=
                1;
            }
          },
        );

        return next;
      },
      [
        requestBookings,
      ],
    );

  const visibleRequests =
    useMemo(
      () => {
        const searchQuery =
          cleanSearchText(
            query,
          );

        return requestBookings.filter(
          (
            booking,
          ) => {
            const requestStatus =
              getBookingRequestStatus(
                booking,
              );

            if (
              filter !==
                'all' &&
              requestStatus !==
                filter
            ) {
              return false;
            }

            if (
              !searchQuery
            ) {
              return true;
            }

            return getRequestSearchHaystack(
              booking,
            ).includes(
              searchQuery,
            );
          },
        );
      },
      [
        filter,
        query,
        requestBookings,
      ],
    );

  async function updateRequestStatus(
    booking,
    status,
  ) {
    if (
      !booking?.id ||
      !currentUser?.uid
    ) {
      setActionNotice({
        kind:
          'warning',

        title:
          'Akun admin belum siap',

        message:
          'Refresh halaman lalu coba kembali.',
      });

      return false;
    }

    const actionKey =
      booking.id +
      ':' +
      status;

    if (
      pendingActionKey
    ) {
      return false;
    }

    setPendingActionKey(
      actionKey,
    );

    setActionNotice(
      null,
    );

    try {
      await bookingCommunicationRepository
        .updateBookingRequestStatus({
          booking,
          status,
          user:
            currentUser,
        });

      setSelectedBooking(
        (
          current,
        ) =>
          current?.id ===
          booking.id
            ? {
                ...current,

                requestStatus:
                  status,

                bookingRequestStatus:
                  status,
              }
            : current,
      );

      setActionNotice({
        kind:
          'success',

        title:
          status ===
          'confirmed'
            ? 'Booking dikonfirmasi'
            : status ===
                'cancelled'
              ? 'Pembatalan disetujui'
              : 'Request diperbarui',

        message:
          status ===
          'rejected'
            ? 'Request client sudah ditolak.'
            : status ===
                'confirmed'
              ? 'Status confirmed sudah dikirim ke client.'
              : status ===
                  'cancelled'
                ? 'Booking dibatalkan dan client telah diberi tahu.'
                : 'Perubahan request sudah tersimpan.',
      });

      return true;
    } catch (error) {
      console.error(
        '[booking-requests] Gagal memperbarui request:',
        error,
      );

      setActionNotice({
        kind:
          'warning',

        title:
          'Gagal memperbarui request',

        message:
          'Perubahan belum tersimpan. Periksa koneksi dan coba lagi.',
      });

      throw error;
    } finally {
      setPendingActionKey('');
    }
  }

  async function handleQuickAction(
    booking,
    status,
  ) {
    try {
      await updateRequestStatus(
        booking,
        status,
      );
    } catch {
      // Feedback already surfaced.
    }
  }

  function openRequest(
    booking,
    initialTab = 'overview',
  ) {
    setSelectedBookingTab(
      initialTab,
    );

    setSelectedBooking(
      booking,
    );
  }

  function closeRequest() {
    setSelectedBooking(
      null,
    );

    setSelectedBookingTab(
      'overview',
    );
  }

  return (
    <section
      aria-labelledby="booking-requests-title"
      className="booking-requests-page"
      data-request-inbox-ui="ui-2-spatial"
    >
      <header className="booking-requests-editorial-header">
        <div className="booking-requests-heading">
          <span className="booking-requests-kicker">
            Booking decision queue
          </span>

          <h2 id="booking-requests-title">
            Request Inbox
          </h2>

          <p>
            Lihat request yang butuh keputusan sekarang, pahami konteksnya,
            lalu tindak tanpa kehilangan alur booking.
          </p>
        </div>

        <div
          aria-label={
            counts.all +
            ' request aktif'
          }
          className="booking-request-live-summary"
        >
          <span className="booking-request-live-icon">
            <Inbox
              aria-hidden="true"
              size={18}
            />
          </span>

          <span>
            <small>
              Actionable sekarang
            </small>

            <strong>
              {counts.all}
            </strong>

            <em>
              {counts.unread
                ? counts.unread +
                  ' pesan baru'
                : 'Queue terbaca'}
            </em>
          </span>
        </div>
      </header>

      <section
        aria-label="Ringkasan Request Inbox"
        className="booking-request-overview-strip"
      >
        <article className="booking-request-overview-object is-all">
          <small>
            Semua actionable
          </small>

          <strong>
            {counts.all}
          </strong>

          <span>
            Butuh keputusan
          </span>
        </article>

        <article className="booking-request-overview-object is-submitted">
          <small>
            Request baru
          </small>

          <strong>
            {counts.submitted}
          </strong>

          <span>
            Menunggu konfirmasi
          </span>
        </article>

        <article className="booking-request-overview-object is-cancellation">
          <small>
            Pembatalan
          </small>

          <strong>
            {counts.cancellation_requested}
          </strong>

          <span>
            Perlu keputusan
          </span>
        </article>

        <article className="booking-request-overview-object is-unread">
          <small>
            Pesan baru
          </small>

          <strong>
            {counts.unread}
          </strong>

          <span>
            Belum dibaca
          </span>
        </article>
      </section>

      <section
        aria-label="Command shelf Request Inbox"
        className="booking-request-command-shelf"
      >
        <div
          aria-label="Filter status request"
          className="booking-request-filter-tabs"
          role="group"
        >
          {REQUEST_FILTERS.map(
            (
              item,
            ) => {
              const isActive =
                filter ===
                item.key;

              return (
                <button
                  aria-pressed={
                    isActive
                  }
                  className={
                    isActive
                      ? 'is-active'
                      : ''
                  }
                  key={
                    item.key
                  }
                  type="button"
                  onClick={() =>
                    setFilter(
                      item.key,
                    )
                  }
                >
                  <span>
                    {item.label}
                  </span>

                  <strong>
                    {counts[
                      item.key
                    ] || 0}
                  </strong>
                </button>
              );
            },
          )}
        </div>

        <label className="booking-request-search">
          <Search
            aria-hidden="true"
            size={16}
          />

          <input
            aria-label="Cari request booking"
            placeholder="Cari customer, WA, kode booking..."
            type="search"
            value={
              query
            }
            onChange={(
              event,
            ) =>
              setQuery(
                event
                  .target
                  .value,
              )
            }
          />
        </label>
      </section>

      {actionNotice ? (
        <aside
          className={
            'booking-request-notice is-' +
            actionNotice.kind
          }
          role={
            actionNotice.kind ===
            'warning'
              ? 'alert'
              : 'status'
          }
        >
          <span>
            <strong>
              {actionNotice.title}
            </strong>

            <small>
              {actionNotice.message}
            </small>
          </span>

          <button
            aria-label="Tutup notifikasi"
            type="button"
            onClick={() =>
              setActionNotice(
                null,
              )
            }
          >
            ×
          </button>
        </aside>
      ) : null}

      {isLoading ? (
        <BookingRequestLoading />
      ) : loadError ? (
        <BookingRequestState
          error={true}
        />
      ) : visibleRequests.length ? (
        <section
          aria-label="Daftar request client"
          className="booking-request-queue"
        >
          <header className="booking-request-queue-heading">
            <div>
              <span className="booking-requests-kicker">
                Decision queue
              </span>

              <h3>
                {visibleRequests.length}{' '}
                request ditampilkan
              </h3>

              <p>
                Terbaru di atas. Pembatalan dan pesan client diberi
                penanda visual tanpa mengubah lifecycle request.
              </p>
            </div>

            <span>
              {filter ===
              'all'
                ? 'Semua actionable'
                : filter ===
                    'submitted'
                  ? 'Request baru'
                  : 'Pembatalan'}
            </span>
          </header>

          <div className="booking-request-queue-list">
            {visibleRequests.map(
              (
                booking,
              ) => {
                const presentation =
                  getRequestPresentation(
                    booking,
                  );

                const payment =
                  getPaymentPresentation(
                    booking,
                  );

                const RequestIcon =
                  presentation.Icon;

                const positiveKey =
                  booking.id +
                  ':' +
                  presentation
                    .positiveStatus;

                const negativeKey =
                  booking.id +
                  ':' +
                  presentation
                    .negativeStatus;

                const isPositiveBusy =
                  pendingActionKey ===
                  positiveKey;

                const isNegativeBusy =
                  pendingActionKey ===
                  negativeKey;

                const isBusy =
                  Boolean(
                    pendingActionKey,
                  );

                const hasUnreadMessage =
                  hasUnreadClientMessage(
                    booking,
                  );

                return (
                  <article
                    className={
                      'booking-request-queue-row is-' +
                      presentation.tone +
                      (
                        hasUnreadMessage
                          ? ' has-unread'
                          : ''
                      )
                    }
                    key={
                      booking.id ||
                      booking.bookingCode
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="booking-request-priority-rail"
                    />

                    <button
                      className="booking-request-row-open"
                      type="button"
                      onClick={() =>
                        openRequest(
                          booking,
                        )
                      }
                    >
                      <span className="booking-request-row-icon">
                        <RequestIcon
                          aria-hidden="true"
                          size={17}
                        />
                      </span>

                      <span className="booking-request-row-copy">
                        <span className="booking-request-row-topline">
                          <strong>
                            {booking.customer ||
                              'Client'}
                          </strong>

                          <span
                            className={
                              'booking-request-type is-' +
                              presentation.tone
                            }
                          >
                            {presentation.label}
                          </span>

                          {hasUnreadMessage ? (
                            <span className="booking-request-unread">
                              <MessageCircle
                                aria-hidden="true"
                                size={11}
                              />

                              Pesan baru
                            </span>
                          ) : null}
                        </span>

                        <span className="booking-request-row-service">
                          {getServiceLabel(
                            booking,
                          )}
                        </span>

                        <span className="booking-request-row-meta">
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
                            <Clock3
                              aria-hidden="true"
                              size={13}
                            />

                            {getBookingWindowLabel(
                              booking,
                            )}
                          </span>

                          <span>
                            <Phone
                              aria-hidden="true"
                              size={13}
                            />

                            {booking.phone ||
                              '-'}
                          </span>
                        </span>
                      </span>

                      <span className="booking-request-row-trailing">
                        <strong>
                          {formatRupiah(
                            booking.total ||
                              booking.subtotal,
                          )}
                        </strong>

                        <span
                          className={
                            'booking-request-payment is-' +
                            payment.tone
                          }
                        >
                          {payment.label}
                        </span>

                        <small>
                          {booking.bookingCode ||
                            booking.bookingId ||
                            booking.id ||
                            'BKG'}
                        </small>

                        <em>
                          Update{' '}
                          {formatUpdatedAt(
                            getRequestUpdatedAt(
                              booking,
                            ),
                          )}
                        </em>
                      </span>

                      <ArrowRight
                        aria-hidden="true"
                        className="booking-request-row-arrow"
                        size={16}
                      />
                    </button>

                    {booking.clientRequestNote ? (
                      <blockquote className="booking-request-client-note">
                        <small>
                          Catatan client
                        </small>

                        <span>
                          {booking.clientRequestNote}
                        </span>
                      </blockquote>
                    ) : null}

                    <footer className="booking-request-row-actions">
                      <span className="booking-request-decision-copy">
                        <strong>
                          {presentation.decisionLabel}
                        </strong>

                        <small>
                          {presentation.description}
                        </small>
                      </span>

                      <button
                        className="is-secondary"
                        type="button"
                        onClick={() =>
                          openRequest(
                            booking,
                            'messages',
                          )
                        }
                      >
                        <MessageCircle
                          aria-hidden="true"
                          size={15}
                        />

                        Detail & Chat
                      </button>

                      <button
                        className="is-positive"
                        disabled={
                          isBusy
                        }
                        type="button"
                        onClick={() =>
                          handleQuickAction(
                            booking,
                            presentation
                              .positiveStatus,
                          )
                        }
                      >
                        <CheckCircle2
                          aria-hidden="true"
                          size={15}
                        />

                        {isPositiveBusy
                          ? 'Menyimpan...'
                          : presentation
                              .positiveLabel}
                      </button>

                      <button
                        className="is-negative"
                        disabled={
                          isBusy
                        }
                        type="button"
                        onClick={() =>
                          handleQuickAction(
                            booking,
                            presentation
                              .negativeStatus,
                          )
                        }
                      >
                        <XCircle
                          aria-hidden="true"
                          size={15}
                        />

                        {isNegativeBusy
                          ? 'Menyimpan...'
                          : presentation
                              .negativeLabel}
                      </button>
                    </footer>
                  </article>
                );
              },
            )}
          </div>
        </section>
      ) : (
        <BookingRequestState
          hasRequests={
            Boolean(
              requestBookings.length,
            )
          }
        />
      )}

      <BookingDetailDrawer
        booking={
          selectedBooking
        }
        initialTab={
          selectedBookingTab
        }
        isOpen={
          Boolean(
            selectedBooking,
          )
        }
        onClose={
          closeRequest
        }
        onRequestStatusChange={
          updateRequestStatus
        }
        user={
          currentUser
        }
      />
    </section>
  );
}
