import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertCircle,
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
import { adminBookingRepository } from '../../services/adminBookingRepository.js';
import { bookingCommunicationRepository } from '../../services/bookingCommunicationRepository.js';
import '../../styles/modules/booking-requests.css';

const REQUEST_FILTERS = Object.freeze([
  {
    key: 'all',
    label: 'Semua',
  },
  {
    key: 'submitted',
    label: 'Request Baru',
  },
  {
    key: 'cancellation_requested',
    label: 'Pembatalan',
  },
]);

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

function formatUpdatedAt(value) {
  if (!value) return '-';

  const date = new Date(value);

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
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
    },
  ).format(date);
}

function formatHour(hourValue) {
  const safeHour =
    Number(hourValue) || 0;

  const wholeHour =
    Math.floor(safeHour);

  const minutes =
    Math.round(
      (
        safeHour -
        wholeHour
      ) *
        60,
    );

  return (
    String(wholeHour)
      .padStart(2, '0') +
    '.' +
    String(minutes)
      .padStart(2, '0')
  );
}

function getBookingWindowLabel(booking) {
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
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return (
      formatHour(startHour) +
      ' WIB'
    );
  }

  return (
    formatHour(startHour) +
    ' - ' +
    formatHour(
      startHour +
        duration,
    )
  );
}

function getServiceLabel(booking) {
  return (
    booking?.packageLabel ||
    booking?.recordingTypeLabel ||
    booking?.sessionLabel ||
    booking?.title ||
    'Sesi Studio'
  );
}

function getRequestUpdatedAt(booking) {
  return (
    booking?.clientRequestUpdatedAt ||
    booking?.lastMessageAt ||
    booking?.updatedAt ||
    booking?.createdAt ||
    ''
  );
}

function getRequestSearchHaystack(booking) {
  return [
    booking?.customer,
    booking?.phone,
    booking?.email,
    booking?.bookingCode,
    booking?.bookingId,
    booking?.id,
    getServiceLabel(booking),
    booking?.clientRequestNote,
    booking?.lastMessagePreview,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function sortRequestBookings(
  first,
  second,
) {
  return String(
    getRequestUpdatedAt(second),
  ).localeCompare(
    String(
      getRequestUpdatedAt(first),
    ),
  );
}

function getRequestPresentation(booking) {
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
      label: 'Minta Batal',
      description:
        'Client meminta pembatalan booking.',
      tone: 'cancellation',
      Icon: Ban,
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
    label: 'Request Baru',
    description:
      'Menunggu keputusan admin.',
    tone: 'submitted',
    Icon: Inbox,
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

export default function BookingRequestsPage({
  currentUser,
}) {
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
    filter,
    setFilter,
  ] = useState('all');

  const [
    query,
    setQuery,
  ] = useState('');

  const [
    pendingActionKey,
    setPendingActionKey,
  ] = useState('');

  const [
    selectedBooking,
    setSelectedBooking,
  ] = useState(null);

  const [
    selectedBookingTab,
    setSelectedBookingTab,
  ] = useState('overview');

  const [
    actionNotice,
    setActionNotice,
  ] = useState(null);

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
          (data) => {
            setBookings(data);
            setLoadError('');
            setIsLoading(false);
          },
          (error) => {
            console.error(
              '[booking-requests] Gagal membaca request booking:',
              error,
            );

            setLoadError(
              'Request booking belum dapat dimuat dari Firestore.',
            );

            setIsLoading(false);
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
      [bookings],
    );

  const counts = useMemo(
    () => {
      const next = {
        all:
          requestBookings.length,
        submitted: 0,
        cancellation_requested: 0,
        unread: 0,
      };

      requestBookings.forEach(
        (booking) => {
          const requestStatus =
            getBookingRequestStatus(
              booking,
            );

          if (
            requestStatus ===
            'submitted'
          ) {
            next.submitted += 1;
          }

          if (
            requestStatus ===
            'cancellation_requested'
          ) {
            next.cancellation_requested += 1;
          }

          if (
            booking
              ?.lastMessageSenderRole ===
              'client' &&
            booking
              ?.lastMessageReadByAdmin ===
              false
          ) {
            next.unread += 1;
          }
        },
      );

      return next;
    },
    [requestBookings],
  );

  const visibleRequests =
    useMemo(
      () => {
        const searchQuery =
          cleanSearchText(query);

        return requestBookings.filter(
          (booking) => {
            const requestStatus =
              getBookingRequestStatus(
                booking,
              );

            if (
              filter !== 'all' &&
              requestStatus !==
                filter
            ) {
              return false;
            }

            if (!searchQuery) {
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
        kind: 'warning',
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

    if (pendingActionKey) {
      return false;
    }

    setPendingActionKey(
      actionKey,
    );

    setActionNotice(null);

    try {
      await bookingCommunicationRepository
        .updateBookingRequestStatus({
          booking,
          status,
          user: currentUser,
        });

      setSelectedBooking(
        (current) =>
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
        kind: 'success',
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
        kind: 'warning',
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
    setSelectedBooking(null);
    setSelectedBookingTab(
      'overview',
    );
  }

  return (
    <section
      className="booking-requests-page"
      aria-labelledby="booking-requests-title"
    >
      <header className="booking-requests-hero">
        <div className="booking-requests-heading">
          <span className="booking-requests-kicker">
            Booking Command Center
          </span>

          <h2 id="booking-requests-title">
            Request Inbox
          </h2>

          <p>
            Semua request booking dan permintaan pembatalan client yang masih membutuhkan tindakan admin.
          </p>
        </div>

        <div
          className="booking-requests-total"
          aria-label={
            counts.all +
            ' request aktif'
          }
        >
          <Inbox
            aria-hidden="true"
            size={20}
          />

          <span>
            <strong>
              {counts.all}
            </strong>

            <small>
              Actionable
            </small>
          </span>
        </div>
      </header>

      <section
        className="booking-request-stats"
        aria-label="Ringkasan request"
      >
        <article>
          <span>Request Baru</span>
          <strong>
            {counts.submitted}
          </strong>
          <small>
            menunggu konfirmasi
          </small>
        </article>

        <article>
          <span>Pembatalan</span>
          <strong>
            {
              counts
                .cancellation_requested
            }
          </strong>
          <small>
            menunggu keputusan
          </small>
        </article>

        <article>
          <span>Pesan Belum Dibaca</span>
          <strong>
            {counts.unread}
          </strong>
          <small>
            dari client
          </small>
        </article>
      </section>

      <section
        className="booking-request-toolbar"
        aria-label="Filter Request Inbox"
      >
        <div
          className="booking-request-filter-tabs"
          role="group"
          aria-label="Filter status request"
        >
          {REQUEST_FILTERS.map(
            (item) => {
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
                  key={item.key}
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
                    {
                      counts[
                        item.key
                      ] || 0
                    }
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
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value,
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
              {
                actionNotice.title
              }
            </strong>

            <small>
              {
                actionNotice.message
              }
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
        <div
          className="booking-request-state"
          role="status"
        >
          <LoaderCircle
            className="booking-request-spin"
            size={24}
          />

          <strong>
            Memuat Request Inbox...
          </strong>
        </div>
      ) : loadError ? (
        <div
          className="booking-request-state is-error"
          role="alert"
        >
          <AlertCircle
            size={24}
          />

          <strong>
            Firestore belum terhubung
          </strong>

          <p>
            {loadError}
          </p>
        </div>
      ) : visibleRequests.length ? (
        <div
          className="booking-request-list"
          aria-label="Daftar request client"
        >
          {visibleRequests.map(
            (booking) => {
              const presentation =
                getRequestPresentation(
                  booking,
                );

              const RequestIcon =
                presentation.Icon;

              const paymentStatus =
                getLegacyBookingPaymentStatus(
                  booking,
                );

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
                booking
                  ?.lastMessageSenderRole ===
                  'client' &&
                booking
                  ?.lastMessageReadByAdmin ===
                  false;

              return (
                <article
                  className={
                    'booking-request-card is-' +
                    presentation.tone
                  }
                  key={
                    booking.id ||
                    booking.bookingCode
                  }
                >
                  <button
                    className="booking-request-card-open"
                    type="button"
                    onClick={() =>
                      openRequest(
                        booking,
                      )
                    }
                  >
                    <span className="booking-request-card-icon">
                      <RequestIcon
                        aria-hidden="true"
                        size={18}
                      />
                    </span>

                    <span className="booking-request-card-copy">
                      <span className="booking-request-card-topline">
                        <strong>
                          {
                            booking.customer ||
                            'Client'
                          }
                        </strong>

                        <span
                          className={
                            'booking-request-type is-' +
                            presentation.tone
                          }
                        >
                          {
                            presentation.label
                          }
                        </span>

                        {hasUnreadMessage ? (
                          <span className="booking-request-unread">
                            <MessageCircle
                              aria-hidden="true"
                              size={11}
                            />

                            Baru
                          </span>
                        ) : null}
                      </span>

                      <small>
                        {
                          getServiceLabel(
                            booking,
                          )
                        }
                      </small>

                      <em>
                        {
                          presentation.description
                        }
                      </em>
                    </span>

                    <span className="booking-request-card-code">
                      <strong>
                        {
                          booking.bookingCode ||
                          booking.bookingId ||
                          booking.id ||
                          'BKG'
                        }
                      </strong>

                      <small>
                        Update{' '}
                        {
                          formatUpdatedAt(
                            getRequestUpdatedAt(
                              booking,
                            ),
                          )
                        }
                      </small>
                    </span>
                  </button>

                  <div className="booking-request-card-details">
                    <span>
                      <CalendarDays
                        aria-hidden="true"
                        size={14}
                      />

                      <small>
                        Tanggal
                      </small>

                      <strong>
                        {
                          formatDateLabel(
                            booking.date,
                          )
                        }
                      </strong>
                    </span>

                    <span>
                      <Clock3
                        aria-hidden="true"
                        size={14}
                      />

                      <small>
                        Waktu
                      </small>

                      <strong>
                        {
                          getBookingWindowLabel(
                            booking,
                          )
                        }
                      </strong>
                    </span>

                    <span>
                      <Phone
                        aria-hidden="true"
                        size={14}
                      />

                      <small>
                        WhatsApp
                      </small>

                      <strong>
                        {
                          booking.phone ||
                          '-'
                        }
                      </strong>
                    </span>

                    <span>
                      <small>
                        Pembayaran
                      </small>

                      <strong
                        className={
                          'is-payment-' +
                          paymentStatus
                        }
                      >
                        {
                          paymentStatus ===
                          'lunas'
                            ? 'Lunas'
                            : paymentStatus ===
                                'dp'
                              ? 'DP'
                              : paymentStatus ===
                                  'void'
                                ? 'Void'
                                : 'Pending'
                        }
                      </strong>
                    </span>

                    <span>
                      <small>
                        Total
                      </small>

                      <strong>
                        {
                          formatRupiah(
                            booking.total ||
                            booking.subtotal,
                          )
                        }
                      </strong>
                    </span>
                  </div>

                  {booking.clientRequestNote ? (
                    <blockquote className="booking-request-client-note">
                      {
                        booking.clientRequestNote
                      }
                    </blockquote>
                  ) : null}

                  <footer className="booking-request-card-actions">
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
                        size={15}
                      />

                      Detail & Chat
                    </button>

                    <span className="booking-request-action-spacer" />

                    <button
                      className="is-positive"
                      disabled={isBusy}
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
                        size={15}
                      />

                      {
                        isPositiveBusy
                          ? 'Menyimpan...'
                          : presentation
                              .positiveLabel
                      }
                    </button>

                    <button
                      className="is-negative"
                      disabled={isBusy}
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
                        size={15}
                      />

                      {
                        isNegativeBusy
                          ? 'Menyimpan...'
                          : presentation
                              .negativeLabel
                      }
                    </button>
                  </footer>
                </article>
              );
            },
          )}
        </div>
      ) : (
        <div className="booking-request-state">
          <Inbox size={26} />

          <strong>
            Tidak ada request yang cocok
          </strong>

          <p>
            {
              requestBookings.length
                ? 'Coba ubah filter atau kata pencarian.'
                : 'Semua request client sudah ditangani.'
            }
          </p>
        </div>
      )}

      <BookingDetailDrawer
        booking={selectedBooking}
        initialTab={
          selectedBookingTab
        }
        isOpen={
          Boolean(
            selectedBooking,
          )
        }
        onClose={closeRequest}
        onRequestStatusChange={
          updateRequestStatus
        }
        user={currentUser}
      />
    </section>
  );
}
