import { useEffect } from 'react';
import {
  CalendarDays,
  Clock3,
  CreditCard,
  Phone,
  ReceiptText,
  Tag,
  UserRound,
  X,
} from 'lucide-react';

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

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

function getBookingWindowLabel(booking) {
  const startHour = Number(booking?.startHour) || 0;
  const endHour = startHour + getDurationHours(booking);

  return formatHourLabel(startHour) + ' - ' + formatHourLabel(endHour);
}

function getBookingStatus(booking) {
  return booking?.paymentStatus || booking?.status || 'pending';
}

function getPaidAmount(booking, status) {
  if (status === 'dp') return booking?.dpAmount;
  if (status === 'lunas') return booking?.total;

  return 0;
}

function CompactItem({ icon: Icon, label, value }) {
  return (
    <div className="booking-detail-compact-item">
      <span className="booking-detail-compact-icon">
        <Icon size={14} aria-hidden="true" />
      </span>
      <span className="booking-detail-compact-copy">
        <small>{label}</small>
        <strong>{value || '-'}</strong>
      </span>
    </div>
  );
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
}) {
  const status = getBookingStatus(booking);
  const statusLabel = statusLabelMap[status] || status;
  const title = booking?.title || booking?.bandName || booking?.sessionLabel || booking?.packageLabel || 'Detail Booking';
  const sessionLabel = booking?.packageLabel || booking?.recordingTypeLabel || booking?.sessionLabel || '-';
  const paidAmount = getPaidAmount(booking, status);
  const invoiceAmount = Number(booking?.invoiceAmount) || 0;

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

          <section className="booking-detail-compact-card" aria-label="Informasi booking">
            <div className="booking-detail-compact-section-title">
              <UserRound size={15} aria-hidden="true" />
              <span>Informasi Booking</span>
            </div>

            <div className="booking-detail-compact-grid">
              <CompactItem icon={Phone} label="No HP" value={booking.phone} />
              <CompactItem icon={CalendarDays} label="Tanggal" value={formatDateLabel(booking.date)} />
              <CompactItem icon={Clock3} label="Jam" value={getBookingWindowLabel(booking)} />
              <CompactItem icon={Tag} label="Session" value={sessionLabel} />
            </div>
          </section>

          <section className="booking-detail-compact-card" aria-label="Ringkasan harga">
            <div className="booking-detail-compact-section-title">
              <ReceiptText size={15} aria-hidden="true" />
              <span>Ringkasan Harga</span>
            </div>

            <div className="booking-detail-compact-money">
              <MoneyItem label="Subtotal" value={booking.subtotal} />
              <MoneyItem label="Diskon" value={booking.discountAmount} tone="discount" />
              <MoneyItem label="Total" value={booking.total} tone="total" />
              <MoneyItem label={status === 'dp' ? 'DP Terbayar' : 'Terbayar'} value={paidAmount} />
              <MoneyItem label="Sisa Tagihan" value={invoiceAmount} tone={invoiceAmount > 0 ? 'warning' : 'paid'} />
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
        </div>

        <footer className="booking-detail-compact-actions">
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
