import { useEffect } from 'react';
import {
  CalendarDays,
  Clock3,
  CreditCard,
  Phone,
  ReceiptText,
  Tag,
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

function getPaidAmount(booking, status) {
  if (status === 'dp') return booking?.dpAmount;
  if (status === 'lunas') return booking?.total;

  return 0;
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="booking-detail-v2-item">
      <span className="booking-detail-v2-icon">
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className="booking-detail-v2-copy">
        <small>{label}</small>
        <strong>{value || '-'}</strong>
      </span>
    </div>
  );
}

function MoneyItem({ label, value, tone }) {
  return (
    <div className={tone ? 'booking-detail-v2-money-item is-' + tone : 'booking-detail-v2-money-item'}>
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
      className="booking-detail-v2-backdrop"
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <section
        aria-labelledby="booking-detail-title"
        aria-modal="true"
        className="booking-detail-v2-panel"
        role="dialog"
      >
        <header className="booking-detail-v2-head">
          <div className="booking-detail-v2-heading">
            <p>Booking Detail</p>
            <h2 id="booking-detail-title">{title}</h2>
          </div>

          <button
            aria-label="Tutup detail booking"
            className="booking-detail-v2-close"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className={'booking-detail-v2-status is-' + status}>
          <span>Status pembayaran</span>
          <strong>{statusLabel}</strong>
        </div>

        <div className="booking-detail-v2-body">
          <section className="booking-detail-v2-hero">
            <div>
              <span>Customer</span>
              <h3>{booking.customer || '-'}</h3>
              <p>{booking.bandName || sessionLabel}</p>
            </div>

            {booking.phone ? (
              <a className="booking-detail-v2-phone" href={'tel:' + booking.phone}>
                <Phone size={15} />
                Hubungi
              </a>
            ) : null}
          </section>

          <section className="booking-detail-v2-section" aria-label="Informasi booking">
            <div className="booking-detail-v2-section-head">
              <UserRound size={16} aria-hidden="true" />
              <span>Informasi Booking</span>
            </div>

            <div className="booking-detail-v2-list">
              <DetailItem icon={UserRound} label="Nama Customer" value={booking.customer} />
              <DetailItem icon={UsersRound} label="Band / Project" value={booking.bandName || booking.title} />
              <DetailItem icon={Phone} label="No HP" value={booking.phone} />
              <DetailItem icon={CalendarDays} label="Tanggal" value={formatDateLabel(booking.date)} />
              <DetailItem icon={Clock3} label="Jam Booking" value={getBookingWindowLabel(booking)} />
              <DetailItem icon={Tag} label="Session / Paket" value={sessionLabel} />
            </div>
          </section>

          <section className="booking-detail-v2-section" aria-label="Ringkasan harga">
            <div className="booking-detail-v2-section-head">
              <ReceiptText size={16} aria-hidden="true" />
              <span>Ringkasan Harga</span>
            </div>

            <div className="booking-detail-v2-money">
              <MoneyItem label="Subtotal" value={booking.subtotal} />
              <MoneyItem label="Diskon" value={booking.discountAmount} tone="discount" />
              <MoneyItem label="Total" value={booking.total} tone="total" />
              <MoneyItem label={status === 'dp' ? 'DP Terbayar' : 'Terbayar'} value={paidAmount} />
              <MoneyItem label="Sisa Tagihan" value={invoiceAmount} tone={invoiceAmount > 0 ? 'warning' : 'paid'} />
            </div>
          </section>

          <section className="booking-detail-v2-section" aria-label="Metadata booking">
            <div className="booking-detail-v2-section-head">
              <CreditCard size={16} aria-hidden="true" />
              <span>Metadata</span>
            </div>

            <div className="booking-detail-v2-meta">
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

        <footer className="booking-detail-v2-actions">
          <button className="booking-detail-v2-button" type="button" onClick={onClose}>
            Tutup
          </button>
        </footer>
      </section>
    </div>
  );
}
