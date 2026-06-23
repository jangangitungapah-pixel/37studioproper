import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Phone,
  ReceiptText,
  X,
  XCircle,
} from 'lucide-react';
import { firebaseAuth } from '../../lib/firebase.js';
import { getBookingRequestStatusMeta } from '../../services/bookingCommunicationRepository.js';
import BookingConversationPanel from '../booking/BookingConversationPanel.jsx';

const statusLabelMap = {
  pending: 'Pending',
  dp: 'DP',
  lunas: 'Lunas',
};

function formatRupiah(value) {
  const numberValue = Math.max(0, Number(value) || 0);

  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(numberValue);
}

function formatDateLabel(dateText) {
  if (!dateText) return '-';

  const date = new Date(dateText + 'T00:00:00');

  if (Number.isNaN(date.getTime())) return dateText;

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatHourLabel(hourValue) {
  const safeHour = Number(hourValue) || 0;
  const wholeHour = Math.floor(safeHour);
  const minutes = Math.round((safeHour - wholeHour) * 60);

  return String(wholeHour).padStart(2, '0') + '.' + String(minutes).padStart(2, '0');
}

function getDurationHours(booking) {
  const duration = Number(booking?.durationHours);

  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function isNoDurationPackageBooking(booking) {
  const hasPackage = Boolean(booking?.packageId && booking.packageId !== 'none') || booking?.pricingMode === 'package';

  return hasPackage && Number(booking?.durationHours || booking?.duration || 0) <= 0;
}

function getBookingWindowLabel(booking) {
  const startHour = Number(booking?.startHour) || 0;
  const durationHours = getDurationHours(booking);

  if (isNoDurationPackageBooking(booking) || durationHours <= 0) {
    return formatHourLabel(startHour) + ' WIB · tanpa blok kalender';
  }

  const endHour = startHour + durationHours;

  return formatHourLabel(startHour) + ' - ' + formatHourLabel(endHour);
}

function getBookingStatus(booking) {
  return booking?.paymentStatus || booking?.status || 'pending';
}

function getPaymentHistoryTotal(booking) {
  const history = Array.isArray(booking?.paymentHistory) ? booking.paymentHistory : [];

  return history.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

function getInvoiceAmount(booking, paidAmount) {
  const total = Number(booking?.total || booking?.subtotal || 0) || 0;
  const storedInvoice = Number(booking?.invoiceAmount);

  if (total > 0 && paidAmount > 0) {
    return Math.max(0, total - paidAmount);
  }

  return Number.isFinite(storedInvoice) ? Math.max(0, storedInvoice) : 0;
}

function getPaidAmount(booking, status) {
  const historyTotal = getPaymentHistoryTotal(booking);

  if (historyTotal > 0) return historyTotal;
  if (status === 'dp') return booking?.dpAmount;
  if (status === 'lunas') return booking?.total;

  return 0;
}

function MoneyItem({ label, value, tone }) {
  return (
    <div className={tone ? 'booking-detail-compact-money-row is-' + tone : 'booking-detail-compact-money-row'}>
      <span>{label}</span>
      <strong>{formatRupiah(value)}</strong>
    </div>
  );
}

export default function BookingDetailModal({
  booking,
  isOpen,
  onClose,
  onEdit,
  onRequestStatusChange,
}) {
  const [isUpdatingRequest, setIsUpdatingRequest] = useState(false);
  const status = getBookingStatus(booking);
  const statusLabel = statusLabelMap[status] || status;
  const title = booking?.title || booking?.bandName || booking?.sessionLabel || booking?.packageLabel || 'Detail Booking';
  const sessionLabel = booking?.packageLabel || booking?.recordingTypeLabel || booking?.sessionLabel || '-';
  const paidAmount = getPaidAmount(booking, status);
  const invoiceAmount = getInvoiceAmount(booking, paidAmount);
  const requestStatus = getBookingRequestStatusMeta(booking);
  const noDurationPackage = isNoDurationPackageBooking(booking);
  const isClientRequest = booking?.source === 'clientPortal' && Boolean(booking?.clientUid);
  const isLinkedClientBooking = Boolean(booking?.clientUid);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !booking) return null;

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  async function updateRequestStatus(nextStatus) {
    if (!onRequestStatusChange || isUpdatingRequest) return;

    setIsUpdatingRequest(true);
    try {
      await onRequestStatusChange(booking, nextStatus);
    } finally {
      setIsUpdatingRequest(false);
    }
  }

  return (
    <div
      className="booking-detail-compact-backdrop"
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <section
        aria-labelledby="booking-detail-title"
        aria-modal="true"
        className="booking-detail-compact-panel"
        role="dialog"
      >
        <header className="booking-detail-compact-head">
          <div className="booking-detail-compact-heading">
            <p>Booking Detail</p>
            <h2 id="booking-detail-title">{title}</h2>
          </div>

          <button
            aria-label="Tutup detail booking"
            className="booking-detail-compact-close"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="booking-detail-compact-body">
          <section className="booking-detail-compact-summary">
            <div className="booking-detail-compact-customer">
              <span>Customer</span>
              <strong>{booking.customer || '-'}</strong>
              <small>{booking.bandName || sessionLabel}</small>
            </div>

            <div className={'booking-detail-compact-status is-' + status}>
              <span>Status</span>
              <strong>{statusLabel}</strong>
            </div>

            {booking.phone ? (
              <a className="booking-detail-compact-phone" href={'tel:' + booking.phone}>
                <Phone size={15} />
                Hubungi
              </a>
            ) : null}
          </section>

          {requestStatus ? (
            <section className={'booking-request-state is-' + requestStatus.tone} aria-label="Status request client">
              <span>Request Client</span>
              <strong>{requestStatus.label}</strong>
              {booking.adminResponseNote ? <small>{booking.adminResponseNote}</small> : null}
            </section>
          ) : null}

          <section className="booking-detail-compact-card is-slim" aria-label="Informasi booking">
            <div className="booking-detail-compact-quick-grid">
              <span>
                <small>No HP</small>
                <strong>{booking.phone || '-'}</strong>
              </span>
              <span>
                <small>Tanggal</small>
                <strong>{formatDateLabel(booking.date)}</strong>
              </span>
              <span>
                <small>Waktu</small>
                <strong>{getBookingWindowLabel(booking)}</strong>
              </span>
              <span>
                <small>Layanan</small>
                <strong>{sessionLabel}</strong>
              </span>
              {noDurationPackage ? (
                <span className="is-full is-highlight">
                  <small>Catatan</small>
                  <strong>Paket tanpa durasi studio, tidak memblok kalender.</strong>
                </span>
              ) : null}
            </div>
          </section>

          <section className="booking-detail-compact-card is-price-compact" aria-label="Ringkasan harga">
            <div className="booking-detail-compact-section-title">
              <ReceiptText size={15} aria-hidden="true" />
              <span>Harga</span>
            </div>

            <div className="booking-detail-compact-money is-compact">
              <MoneyItem label="Total" value={booking.total} tone="total" />
              <MoneyItem label="Terbayar" value={paidAmount} />
              <MoneyItem label="Sisa" value={invoiceAmount} tone={invoiceAmount > 0 ? 'warning' : 'paid'} />
            </div>
          </section>

          <details className="booking-detail-compact-meta">
            <summary>
              <CreditCard size={15} aria-hidden="true" />
              Metadata
            </summary>

            <div className="booking-detail-compact-meta-list">
              <span>
                <small>ID Booking</small>
                <strong>{booking.id || '-'}</strong>
              </span>
              <span>
                <small>Dibuat</small>
                <strong>{booking.createdAt ? new Date(booking.createdAt).toLocaleString('id-ID') : '-'}</strong>
              </span>
              <span>
                <small>Mode Harga</small>
                <strong>{booking.pricingMode || '-'}</strong>
              </span>
            </div>
          </details>

          {isLinkedClientBooking ? (
            <BookingConversationPanel
              booking={booking}
              role="admin"
              user={firebaseAuth?.currentUser}
            />
          ) : null}
        </div>

        <footer className="booking-detail-compact-actions">
          {isClientRequest && booking.bookingRequestStatus === 'submitted' ? (
            <>
              <button className="booking-detail-compact-button is-confirm" disabled={isUpdatingRequest} type="button" onClick={() => updateRequestStatus('confirmed')}>
                <CheckCircle2 size={15} /> Konfirmasi
              </button>
              <button className="booking-detail-compact-button is-reject" disabled={isUpdatingRequest} type="button" onClick={() => updateRequestStatus('rejected')}>
                <XCircle size={15} /> Tolak
              </button>
            </>
          ) : null}
          {isClientRequest && booking.bookingRequestStatus === 'cancellation_requested' ? (
            <>
              <button className="booking-detail-compact-button is-confirm" disabled={isUpdatingRequest} type="button" onClick={() => updateRequestStatus('cancelled')}>
                <CheckCircle2 size={15} /> Setujui Batal
              </button>
              <button className="booking-detail-compact-button is-reject" disabled={isUpdatingRequest} type="button" onClick={() => updateRequestStatus('confirmed')}>
                <XCircle size={15} /> Pertahankan
              </button>
            </>
          ) : null}
          <button className="booking-detail-compact-button is-edit" type="button" onClick={() => onEdit(booking)}>
            Edit Booking
          </button>
          <button className="booking-detail-compact-button" type="button" onClick={onClose}>
            Tutup
          </button>
        </footer>
      </section>
    </div>
  );
}
