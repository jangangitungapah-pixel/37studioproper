import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Edit3,
  History,
  MessageCircle,
  Phone,
  ReceiptText,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import {
  getBookingPaymentStatus,
  getBookingRequestStatus,
  getBookingSessionStatus,
} from '../../domain/booking/bookingSelectors.js';
import { firebaseAuth } from '../../lib/firebase.js';
import {
  getBookingRequestStatusMeta,
} from '../../services/bookingCommunicationRepository.js';
import {
  getBookingBillingTotal,
  getBookingOutstandingAmount,
  getBookingPaidAmount,
  getBookingPaymentHistory,
} from '../../utils/bookingPaymentUtils.js';
import BookingConversationPanel from './BookingConversationPanel.jsx';
import '../../styles/modules/booking-detail-drawer.css';

const DETAIL_TABS = Object.freeze([
  Object.freeze({
    key: 'overview',
    label: 'Overview',
    Icon: UserRound,
  }),
  Object.freeze({
    key: 'messages',
    label: 'Messages',
    Icon: MessageCircle,
  }),
  Object.freeze({
    key: 'payment',
    label: 'Payment',
    Icon: CreditCard,
  }),
  Object.freeze({
    key: 'activity',
    label: 'Activity',
    Icon: History,
  }),
]);

const DETAIL_TAB_KEYS = Object.freeze(
  DETAIL_TABS.map(
    (tab) => tab.key,
  ),
);

const PAYMENT_STATUS_LABELS =
  Object.freeze({
    unpaid: 'Belum Bayar',
    partial: 'Bayar Sebagian',
    paid: 'Lunas',
    refunded: 'Refund',
    void: 'Void',
  });

const SESSION_STATUS_LABELS =
  Object.freeze({
    upcoming: 'Akan Datang',
    in_progress: 'Berlangsung',
    completed: 'Selesai',
    no_show: 'Tidak Hadir',
    cancelled: 'Dibatalkan',
  });

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

function toDate(value) {
  if (!value) return null;

  if (
    value instanceof Date
  ) {
    return Number.isNaN(
      value.getTime(),
    )
      ? null
      : value;
  }

  if (
    typeof value?.toDate ===
    'function'
  ) {
    const next =
      value.toDate();

    return Number.isNaN(
      next?.getTime?.(),
    )
      ? null
      : next;
  }

  if (
    Number.isFinite(
      Number(
        value?.seconds,
      ),
    )
  ) {
    return new Date(
      Number(value.seconds) *
        1000,
    );
  }

  const next =
    new Date(value);

  return Number.isNaN(
    next.getTime(),
  )
    ? null
    : next;
}

function formatDateLabel(value) {
  if (!value) return '-';

  const source =
    /^\d{4}-\d{2}-\d{2}$/.test(
      String(value),
    )
      ? String(value) +
        'T00:00:00'
      : value;

  const date =
    toDate(source);

  if (!date) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    },
  ).format(date);
}

function formatDateTime(value) {
  const date =
    toDate(value);

  if (!date) return '-';

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
}

function formatHour(value) {
  const safeHour =
    Number(value) || 0;

  const whole =
    Math.floor(
      safeHour,
    );

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
    !Number.isFinite(duration) ||
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

function getPaymentMethodLabel(
  method,
) {
  const clean =
    String(
      method || '',
    )
      .trim()
      .toLowerCase();

  if (clean === 'transfer') {
    return 'Transfer';
  }

  if (clean === 'qris') {
    return 'QRIS';
  }

  if (clean === 'cash') {
    return 'Cash';
  }

  return (
    method ||
    'Lainnya'
  );
}

function buildBookingActivity(
  booking,
  paymentHistory,
) {
  const items = [];

  function addActivity({
    at,
    detail,
    id,
    title,
    tone = 'neutral',
  }) {
    const date =
      toDate(at);

    if (!date) return;

    items.push({
      at:
        date.toISOString(),
      detail,
      id,
      timeValue:
        date.getTime(),
      title,
      tone,
    });
  }

  addActivity({
    at:
      booking?.createdAt,
    detail:
      'Booking dibuat di sistem.',
    id:
      'created',
    title:
      'Booking dibuat',
  });

  if (
    booking
      ?.clientRequestUpdatedAt
  ) {
    const requestStatus =
      getBookingRequestStatus(
        booking,
      );

    addActivity({
      at:
        booking
          .clientRequestUpdatedAt,
      detail:
        requestStatus ===
        'cancellation_requested'
          ? 'Client mengajukan pembatalan booking.'
          : 'Request booking client diperbarui.',
      id:
        'client-request',
      title:
        requestStatus ===
        'cancellation_requested'
          ? 'Pembatalan diminta'
          : 'Request client',
      tone:
        requestStatus ===
        'cancellation_requested'
          ? 'warning'
          : 'accent',
    });
  }

  if (
    booking?.adminResponseAt
  ) {
    addActivity({
      at:
        booking
          .adminResponseAt,
      detail:
        booking
          ?.adminResponseNote ||
        'Admin memperbarui status request booking.',
      id:
        'admin-response',
      title:
        'Keputusan admin',
      tone:
        'accent',
    });
  }

  paymentHistory.forEach(
    (payment, index) => {
      addActivity({
        at:
          payment?.createdAt ||
          payment?.date,
        detail:
          formatRupiah(
            payment?.amount,
          ) +
          ' · ' +
          getPaymentMethodLabel(
            payment?.method,
          ),
        id:
          'payment:' +
          (
            payment?.id ||
            index
          ),
        title:
          payment?.category ===
          'pelunasan'
            ? 'Pelunasan diterima'
            : 'Pembayaran diterima',
        tone:
          'success',
      });
    },
  );

  if (
    booking?.lastMessageAt
  ) {
    addActivity({
      at:
        booking.lastMessageAt,
      detail:
        booking
          ?.lastMessagePreview ||
        'Percakapan booking diperbarui.',
      id:
        'last-message',
      title:
        'Pesan booking',
    });
  }

  if (
    booking?.voidedAt
  ) {
    addActivity({
      at:
        booking.voidedAt,
      detail:
        booking
          ?.voidReason ||
        'Booking atau invoice ditandai void.',
      id:
        'voided',
      title:
        'Booking di-void',
      tone:
        'danger',
    });
  }

  if (
    booking?.updatedAt
  ) {
    addActivity({
      at:
        booking.updatedAt,
      detail:
        'Data booking terakhir diperbarui.',
      id:
        'updated',
      title:
        'Booking diperbarui',
    });
  }

  const seen =
    new Set();

  return items
    .filter((item) => {
      const identity =
        item.id +
        '|' +
        item.at;

      if (
        seen.has(identity)
      ) {
        return false;
      }

      seen.add(identity);

      return true;
    })
    .sort(
      (first, second) =>
        second.timeValue -
        first.timeValue,
    );
}

function StatusChip({
  label,
  tone,
}) {
  return (
    <span
      className={
        'booking-detail-drawer-status is-' +
        tone
      }
    >
      {label}
    </span>
  );
}

function MoneyStat({
  label,
  tone = '',
  value,
}) {
  return (
    <article
      className={
        tone
          ? 'booking-detail-drawer-money is-' +
            tone
          : 'booking-detail-drawer-money'
      }
    >
      <span>{label}</span>
      <strong>
        {formatRupiah(value)}
      </strong>
    </article>
  );
}

export default function BookingDetailDrawer({
  booking,
  initialTab = 'overview',
  isOpen,
  onClose,
  onEdit,
  onRequestStatusChange,
  user,
}) {
  const closeButtonRef =
    useRef(null);

  const [
    tabState,
    setTabState,
  ] = useState({
    bookingKey: '',
    tab: 'overview',
  });

  const [
    isUpdatingRequest,
    setIsUpdatingRequest,
  ] = useState(false);

  const normalizedInitialTab =
    DETAIL_TAB_KEYS.includes(
      initialTab,
    )
      ? initialTab
      : 'overview';

  const bookingKey =
    String(
      booking?.id ||
      booking?.bookingCode ||
      booking?.bookingId ||
      'booking',
    );

  const activeTab =
    tabState.bookingKey ===
    bookingKey
      ? tabState.tab
      : normalizedInitialTab;

  const requestStatus =
    getBookingRequestStatus(
      booking,
    );

  const requestMeta =
    getBookingRequestStatusMeta(
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

  const paymentHistory =
    useMemo(
      () =>
        getBookingPaymentHistory(
          booking,
        ),
      [booking],
    );

  const billingTotal =
    getBookingBillingTotal(
      booking,
    );

  const paidAmount =
    getBookingPaidAmount(
      booking,
    );

  const outstandingAmount =
    getBookingOutstandingAmount(
      booking,
    );

  const activity =
    useMemo(
      () =>
        buildBookingActivity(
          booking,
          paymentHistory,
        ),
      [
        booking,
        paymentHistory,
      ],
    );

  const communicationUser =
    user ||
    firebaseAuth?.currentUser ||
    null;

  const isLinkedClientBooking =
    Boolean(
      booking?.clientUid,
    );

  const isClientRequest =
    booking?.source ===
      'clientPortal' &&
    isLinkedClientBooking;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style
      .overflow = 'hidden';

    function handleKeyDown(
      event,
    ) {
      if (
        event.key ===
        'Escape'
      ) {
        setTabState({
          bookingKey: '',
          tab:
            normalizedInitialTab,
        });

        onClose();
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body.style
        .overflow =
        previousOverflow;

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    isOpen,
    normalizedInitialTab,
    onClose,
  ]);

  useEffect(() => {
    if (
      !isOpen ||
      typeof window ===
        'undefined'
    ) {
      return undefined;
    }

    const frameId =
      window.requestAnimationFrame(
        () => {
          closeButtonRef
            .current
            ?.focus();
        },
      );

    return () => {
      window
        .cancelAnimationFrame(
          frameId,
        );
    };
  }, [
    bookingKey,
    isOpen,
  ]);

  if (
    !isOpen ||
    !booking
  ) {
    return null;
  }

  function selectTab(tab) {
    if (
      !DETAIL_TAB_KEYS.includes(
        tab,
      )
    ) {
      return;
    }

    setTabState({
      bookingKey,
      tab,
    });
  }

  function closeDrawer() {
    setTabState({
      bookingKey: '',
      tab:
        normalizedInitialTab,
    });

    onClose();
  }

  function handleBackdrop(
    event,
  ) {
    if (
      event.target ===
      event.currentTarget
    ) {
      closeDrawer();
    }
  }

  async function updateRequestStatus(
    nextStatus,
  ) {
    if (
      !onRequestStatusChange ||
      isUpdatingRequest
    ) {
      return;
    }

    setIsUpdatingRequest(true);

    try {
      await onRequestStatusChange(
        booking,
        nextStatus,
      );
    } catch {
      // Parent surfaces its own request update feedback.
    } finally {
      setIsUpdatingRequest(false);
    }
  }

  return (
    <div
      className="booking-detail-drawer-backdrop"
      role="presentation"
      onMouseDown={
        handleBackdrop
      }
    >
      <aside
        aria-labelledby="booking-detail-drawer-title"
        aria-modal="true"
        className="booking-detail-drawer"
        role="dialog"
      >
        <header className="booking-detail-drawer-header">
          <div className="booking-detail-drawer-heading">
            <span>
              Booking Command Center
            </span>

            <h2 id="booking-detail-drawer-title">
              {
                booking.customer ||
                'Detail Booking'
              }
            </h2>

            <p>
              {getBookingCode(
                booking,
              )}
              {' · '}
              {getServiceLabel(
                booking,
              )}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            aria-label="Tutup detail booking"
            className="booking-detail-drawer-close"
            type="button"
            onClick={
              closeDrawer
            }
          >
            <X size={19} />
          </button>
        </header>

        <section
          className="booking-detail-drawer-statuses"
          aria-label="Status booking"
        >
          {requestMeta ? (
            <StatusChip
              label={
                requestMeta.label
              }
              tone={
                'request-' +
                requestMeta.tone
              }
            />
          ) : null}

          <StatusChip
            label={
              PAYMENT_STATUS_LABELS[
                paymentStatus
              ] ||
              paymentStatus
            }
            tone={
              'payment-' +
              paymentStatus
            }
          />

          <StatusChip
            label={
              SESSION_STATUS_LABELS[
                sessionStatus
              ] ||
              sessionStatus
            }
            tone={
              'session-' +
              sessionStatus
            }
          />
        </section>

        <nav
          className="booking-detail-drawer-tabs"
          role="tablist"
          aria-label="Detail booking"
        >
          {DETAIL_TABS.map(
            (tab) => {
              const Icon =
                tab.Icon;

              const isActive =
                activeTab ===
                tab.key;

              return (
                <button
                  aria-controls={
                    'booking-detail-panel-' +
                    tab.key
                  }
                  aria-selected={
                    isActive
                  }
                  className={
                    isActive
                      ? 'is-active'
                      : ''
                  }
                  id={
                    'booking-detail-tab-' +
                    tab.key
                  }
                  key={tab.key}
                  role="tab"
                  tabIndex={
                    isActive
                      ? 0
                      : -1
                  }
                  type="button"
                  onClick={() =>
                    selectTab(
                      tab.key,
                    )
                  }
                >
                  <Icon
                    aria-hidden="true"
                    size={15}
                  />

                  <span>
                    {tab.label}
                  </span>
                </button>
              );
            },
          )}
        </nav>

        <div className="booking-detail-drawer-body">
          {activeTab ===
          'overview' ? (
            <section
              aria-labelledby="booking-detail-tab-overview"
              className="booking-detail-drawer-panel"
              id="booking-detail-panel-overview"
              role="tabpanel"
            >
              <div className="booking-detail-drawer-overview-grid">
                <article>
                  <UserRound
                    aria-hidden="true"
                    size={16}
                  />

                  <span>
                    Customer
                  </span>

                  <strong>
                    {
                      booking.customer ||
                      '-'
                    }
                  </strong>

                  <small>
                    {
                      booking.bandName ||
                      booking.email ||
                      'Customer booking'
                    }
                  </small>
                </article>

                <article>
                  <CalendarDays
                    aria-hidden="true"
                    size={16}
                  />

                  <span>
                    Tanggal
                  </span>

                  <strong>
                    {
                      formatDateLabel(
                        booking.date,
                      )
                    }
                  </strong>

                  <small>
                    Jadwal sesi
                  </small>
                </article>

                <article>
                  <Clock3
                    aria-hidden="true"
                    size={16}
                  />

                  <span>
                    Waktu
                  </span>

                  <strong>
                    {
                      getBookingWindowLabel(
                        booking,
                      )
                    }
                  </strong>

                  <small>
                    {
                      Number(
                        booking
                          ?.durationHours ??
                        booking
                          ?.duration,
                      ) > 0
                        ? String(
                          Number(
                            booking
                              ?.durationHours ??
                            booking
                              ?.duration,
                          ),
                        ) +
                          ' jam'
                        : 'Tanpa blok durasi'
                    }
                  </small>
                </article>

                <article>
                  <ReceiptText
                    aria-hidden="true"
                    size={16}
                  />

                  <span>
                    Layanan
                  </span>

                  <strong>
                    {
                      getServiceLabel(
                        booking,
                      )
                    }
                  </strong>

                  <small>
                    {
                      booking
                        ?.pricingMode ||
                      'standard'
                    }
                  </small>
                </article>
              </div>

              <section className="booking-detail-drawer-contact">
                <div>
                  <span>
                    Kontak Customer
                  </span>

                  <strong>
                    {
                      booking.phone ||
                      '-'
                    }
                  </strong>

                  <small>
                    {
                      booking.email ||
                      'Email tidak tersedia'
                    }
                  </small>
                </div>

                {booking.phone ? (
                  <a
                    href={
                      'tel:' +
                      booking.phone
                    }
                  >
                    <Phone
                      size={15}
                    />
                    Hubungi
                  </a>
                ) : null}
              </section>

              {requestMeta ? (
                <section
                  className={
                    'booking-detail-drawer-request is-' +
                    requestMeta.tone
                  }
                >
                  <span>
                    Request Client
                  </span>

                  <strong>
                    {
                      requestMeta.label
                    }
                  </strong>

                  {booking
                    ?.adminResponseNote ? (
                    <small>
                      {
                        booking
                          .adminResponseNote
                      }
                    </small>
                  ) : null}
                </section>
              ) : null}

              {booking
                ?.clientRequestNote ? (
                <section className="booking-detail-drawer-note">
                  <span>
                    Catatan Client
                  </span>

                  <p>
                    {
                      booking
                        .clientRequestNote
                    }
                  </p>
                </section>
              ) : null}

              <section className="booking-detail-drawer-metadata">
                <span>
                  <small>
                    Booking ID
                  </small>

                  <strong>
                    {
                      booking.id ||
                      '-'
                    }
                  </strong>
                </span>

                <span>
                  <small>
                    Source
                  </small>

                  <strong>
                    {
                      booking.source ||
                      'admin'
                    }
                  </strong>
                </span>

                <span>
                  <small>
                    Dibuat
                  </small>

                  <strong>
                    {
                      formatDateTime(
                        booking.createdAt,
                      )
                    }
                  </strong>
                </span>

                <span>
                  <small>
                    Update
                  </small>

                  <strong>
                    {
                      formatDateTime(
                        booking.updatedAt ||
                        booking
                          .clientRequestUpdatedAt,
                      )
                    }
                  </strong>
                </span>
              </section>
            </section>
          ) : null}

          {activeTab ===
          'messages' ? (
            <section
              aria-labelledby="booking-detail-tab-messages"
              className="booking-detail-drawer-panel is-messages"
              id="booking-detail-panel-messages"
              role="tabpanel"
            >
              {isLinkedClientBooking &&
              communicationUser?.uid ? (
                <BookingConversationPanel
                  booking={booking}
                  role="admin"
                  user={
                    communicationUser
                  }
                />
              ) : (
                <div className="booking-detail-drawer-empty">
                  <MessageCircle
                    size={25}
                  />

                  <strong>
                    Percakapan belum tersedia
                  </strong>

                  <p>
                    {isLinkedClientBooking
                      ? 'Akun admin belum siap untuk membuka percakapan.'
                      : 'Booking manual tidak terhubung ke akun client.'}
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {activeTab ===
          'payment' ? (
            <section
              aria-labelledby="booking-detail-tab-payment"
              className="booking-detail-drawer-panel"
              id="booking-detail-panel-payment"
              role="tabpanel"
            >
              <div className="booking-detail-drawer-payment-summary">
                <MoneyStat
                  label="Total"
                  tone="total"
                  value={
                    billingTotal
                  }
                />

                <MoneyStat
                  label="Terbayar"
                  tone="paid"
                  value={
                    paidAmount
                  }
                />

                <MoneyStat
                  label="Sisa"
                  tone={
                    outstandingAmount >
                    0
                      ? 'outstanding'
                      : 'paid'
                  }
                  value={
                    outstandingAmount
                  }
                />
              </div>

              <section className="booking-detail-drawer-payment-state">
                <span>
                  Status Pembayaran
                </span>

                <strong>
                  {
                    PAYMENT_STATUS_LABELS[
                      paymentStatus
                    ] ||
                    paymentStatus
                  }
                </strong>
              </section>

              <section className="booking-detail-drawer-history">
                <header>
                  <div>
                    <ReceiptText
                      size={16}
                    />

                    <strong>
                      Riwayat Pembayaran
                    </strong>
                  </div>

                  <span>
                    {
                      paymentHistory.length
                    }
                  </span>
                </header>

                {paymentHistory.length ? (
                  <div className="booking-detail-drawer-payment-list">
                    {paymentHistory.map(
                      (
                        payment,
                        index,
                      ) => (
                        <article
                          key={
                            payment?.id ||
                            'payment-' +
                              index
                          }
                        >
                          <div>
                            <strong>
                              {
                                formatRupiah(
                                  payment
                                    ?.amount,
                                )
                              }
                            </strong>

                            <span>
                              {
                                getPaymentMethodLabel(
                                  payment
                                    ?.method,
                                )
                              }
                            </span>
                          </div>

                          <small>
                            {
                              formatDateTime(
                                payment
                                  ?.createdAt ||
                                payment
                                  ?.date,
                              )
                            }
                          </small>

                          <p>
                            {
                              payment
                                ?.note ||
                              payment
                                ?.source ||
                              'Pembayaran booking'
                            }
                          </p>

                          {payment
                            ?.proofUrl ? (
                            <a
                              href={
                                payment
                                  .proofUrl
                              }
                              rel="noreferrer"
                              target="_blank"
                            >
                              Lihat bukti
                            </a>
                          ) : null}
                        </article>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="booking-detail-drawer-empty is-compact">
                    <CreditCard
                      size={22}
                    />

                    <strong>
                      Belum ada pembayaran
                    </strong>

                    <p>
                      Riwayat pembayaran booking ini masih kosong.
                    </p>
                  </div>
                )}
              </section>
            </section>
          ) : null}

          {activeTab ===
          'activity' ? (
            <section
              aria-labelledby="booking-detail-tab-activity"
              className="booking-detail-drawer-panel"
              id="booking-detail-panel-activity"
              role="tabpanel"
            >
              <div className="booking-detail-drawer-activity-note">
                Timeline ini diturunkan dari metadata booking, request, pesan terakhir, dan payment history yang sudah tersimpan. Ini belum merupakan audit log permanen.
              </div>

              {activity.length ? (
                <ol className="booking-detail-drawer-activity">
                  {activity.map(
                    (item) => (
                      <li
                        className={
                          'is-' +
                          item.tone
                        }
                        key={
                          item.id +
                          item.at
                        }
                      >
                        <span className="booking-detail-drawer-activity-dot" />

                        <div>
                          <strong>
                            {
                              item.title
                            }
                          </strong>

                          <p>
                            {
                              item.detail
                            }
                          </p>

                          <time
                            dateTime={
                              item.at
                            }
                          >
                            {
                              formatDateTime(
                                item.at,
                              )
                            }
                          </time>
                        </div>
                      </li>
                    ),
                  )}
                </ol>
              ) : (
                <div className="booking-detail-drawer-empty">
                  <History
                    size={24}
                  />

                  <strong>
                    Belum ada timeline
                  </strong>

                  <p>
                    Metadata aktivitas booking ini belum cukup untuk membentuk timeline.
                  </p>
                </div>
              )}
            </section>
          ) : null}
        </div>

        <footer className="booking-detail-drawer-actions">
          {isClientRequest &&
          requestStatus ===
            'submitted' ? (
            <>
              <button
                className="is-positive"
                disabled={
                  isUpdatingRequest
                }
                type="button"
                onClick={() =>
                  updateRequestStatus(
                    'confirmed',
                  )
                }
              >
                <CheckCircle2
                  size={15}
                />

                {isUpdatingRequest
                  ? 'Menyimpan...'
                  : 'Konfirmasi'}
              </button>

              <button
                className="is-negative"
                disabled={
                  isUpdatingRequest
                }
                type="button"
                onClick={() =>
                  updateRequestStatus(
                    'rejected',
                  )
                }
              >
                <XCircle
                  size={15}
                />

                Tolak
              </button>
            </>
          ) : null}

          {isClientRequest &&
          requestStatus ===
            'cancellation_requested' ? (
            <>
              <button
                className="is-positive"
                disabled={
                  isUpdatingRequest
                }
                type="button"
                onClick={() =>
                  updateRequestStatus(
                    'cancelled',
                  )
                }
              >
                <CheckCircle2
                  size={15}
                />

                {isUpdatingRequest
                  ? 'Menyimpan...'
                  : 'Setujui Batal'}
              </button>

              <button
                className="is-negative"
                disabled={
                  isUpdatingRequest
                }
                type="button"
                onClick={() =>
                  updateRequestStatus(
                    'confirmed',
                  )
                }
              >
                <XCircle
                  size={15}
                />

                Pertahankan
              </button>
            </>
          ) : null}

          <span className="booking-detail-drawer-action-spacer" />

          {onEdit ? (
            <button
              className="is-edit"
              type="button"
              onClick={() =>
                onEdit(booking)
              }
            >
              <Edit3
                size={15}
              />

              Edit Booking
            </button>
          ) : null}

          <button
            type="button"
            onClick={
              closeDrawer
            }
          >
            Tutup
          </button>
        </footer>
      </aside>
    </div>
  );
}
