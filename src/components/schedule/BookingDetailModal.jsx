import { useEffect } from 'react';
import {
  CalendarDays,
  Clock3,
  CreditCard,
  PackageCheck,
  Phone,
  ReceiptText,
  UserRound,
  UsersRound,
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

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="booking-detail-row">
      <span className="booking-detail-row-icon">
        <Icon size={15} aria-hidden="true" />
      </span>
      <span>
        <small>{label}</small>
        <strong>{value || '-'}</strong>
      </span>
    </div>
  );
}

function MoneyRow({ label, value, tone }) {
  return (
    <div className={tone ? 'booking-detail-money-row is-' + tone : 'booking-detail-money-row'}>
      <span>{label}</span>
      <strong>{formatRupiah(value)}</strong>
    </div>
  );
}

export default function BookingDetailModal({
  booking,
  isOpen,
  onClose,
}) {
  const status = getBookingStatus(booking);
  const statusLabel = statusLabelMap[status] || status;
  const title = booking?.title || booking?.sessionLabel || booking?.packageLabel || 'Detail Booking';
  const sessionLabel = booking?.packageLabel || booking?.recordingTypeLabel || booking?.sessionLabel || '-';
  const hasPhone = Boolean(booking?.phone);

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
      className="booking-detail-backdrop"
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <section
        aria-labelledby="booking-detail-title"
        aria-modal="true"
        className="booking-detail-panel"
        role="dialog"
      >
        <header className="booking-detail-head">
          <div>
            <p>Booking Detail</p>
            <h2 id="booking-detail-title">{title}</h2>
          </div>

          <button
            aria-label="Tutup detail booking"
            className="booking-detail-close"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className={'booking-detail-status is-' + status}>
          <span>Status Pembayaran</span>
          <strong>{statusLabel}</strong>
        </div>

        <div className="booking-detail-body">
          <section className="booking-detail-card is-hero">
            <div>
              <span>Customer</span>
              <h3>{booking.customer || '-'}</h3>
              {booking.bandName ? <p>{booking.bandName}</p> : <p>{sessionLabel}</p>}
            </div>

            {hasPhone ? (
              <a className="booking-detail-phone" href={'tel:' + booking.phone}>
                <Phone size={15} />
                Hubungi
              </a>
            ) : null}
          </section>

          <section className="booking-detail-grid" aria-label="Informasi booking">
            <DetailRow icon={UserRound} label="Nama Customer" value={booking.customer} />
            <DetailRow icon={UsersRound} label="Band / Project" value={booking.bandName || booking.title} />
            <DetailRow icon={Phone} label="No HP" value={booking.phone} />
            <DetailRow icon={CalendarDays} label="Tanggal" value={formatDateLabel(booking.date)} />
            <DetailRow icon={Clock3} label="Jam Booking" value={getBookingWindowLabel(booking)} />
            <DetailRow icon={PackageCheck} label="Session / Paket" value={sessionLabel} />
          </section>

          <section className="booking-detail-card">
            <div className="booking-detail-section-head">
              <ReceiptText size={16} aria-hidden="true" />
              <span>Ringkasan Harga</span>
            </div>

            <div className="booking-detail-money">
              <MoneyRow label="Subtotal" value={booking.subtotal} />
              <MoneyRow label="Diskon" value={booking.discountAmount} tone="discount" />
              <MoneyRow label="Total" value={booking.total} tone="total" />
              <MoneyRow label={status === 'dp' ? 'DP Terbayar' : 'Terbayar'} value={status === 'dp' ? booking.dpAmount : booking.total} />
              <MoneyRow label="Sisa Tagihan" value={booking.invoiceAmount} tone={Number(booking.invoiceAmount) > 0 ? 'warning' : 'paid'} />
            </div>
          </section>

          <section className="booking-detail-card">
            <div className="booking-detail-section-head">
              <CreditCard size={16} aria-hidden="true" />
              <span>Metadata</span>
            </div>

            <div className="booking-detail-meta-list">
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
          </section>
        </div>

        <footer className="booking-detail-actions">
          <button className="booking-detail-button" type="button" onClick={onClose}>
            Tutup
          </button>
        </footer>
      </section>
    </div>
  );
}
