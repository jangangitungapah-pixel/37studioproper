import { CalendarDays, ChevronRight, Clock3, Copy, Search, Volume2 } from 'lucide-react';
import { formatRupiah } from '../../settings/pricingSettings.js';
import {
  BOOKING_PAYMENT_STATUS_META,
  BOOKING_REQUEST_STATUS_META,
  BOOKING_SESSION_STATUS_META,
  getBookingPaymentStatus,
  getBookingRequestStatus,
  getBookingSessionStatus,
} from '../../domain/booking/bookingSelectors.js';


function formatBookingDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  }).format(date);
}

export default function ClientHistoryTab({
  filteredHistoryBookings,
  userBookings,
  historyQuery,
  setHistoryQuery,
  historyFilter,
  setHistoryFilter,
  historyFilterOptions,
  handleBookingBlockClick,
  copyText,
}) {
  return (
    <section className="client-history-tab" aria-labelledby="client-history-title">
      <header className="client-history-heading">
        <div>
          <span>Arsip sesi</span>
          <h3 id="client-history-title">Booking Anda</h3>
        </div>
        <strong>{filteredHistoryBookings.length} booking</strong>
      </header>

      <div className="client-history-tools">
        <label className="client-history-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Cari booking</span>
          <input
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="Cari kode, layanan, atau tanggal"
          />
        </label>

        <div className="client-history-filters" aria-label="Filter riwayat booking">
          {historyFilterOptions.map((option) => (
            <button
              aria-pressed={historyFilter === option.key}
              className={historyFilter === option.key ? 'is-active' : ''}
              key={option.key}
              type="button"
              onClick={() => setHistoryFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {userBookings.length === 0 ? (
        <div className="client-history-empty">
          <span><CalendarDays size={24} /></span>
          <strong>Belum ada booking</strong>
          <p>Pilih slot studio untuk memulai sesi pertama Anda.</p>
        </div>
      ) : filteredHistoryBookings.length === 0 ? (
        <div className="client-history-empty">
          <span><Search size={22} /></span>
          <strong>Booking tidak ditemukan</strong>
          <p>Coba ubah kata pencarian atau filter status.</p>
        </div>
      ) : (
        <div className="client-history-list">
          {filteredHistoryBookings.map((booking) => {
            const requestMeta = BOOKING_REQUEST_STATUS_META[getBookingRequestStatus(booking)] || { label: 'Belum tersedia', tone: 'neutral' };
            const paymentMeta = BOOKING_PAYMENT_STATUS_META[getBookingPaymentStatus(booking)] || { label: 'Belum tersedia', tone: 'neutral' };
            const sessionMeta = BOOKING_SESSION_STATUS_META[getBookingSessionStatus(booking)] || { label: 'Belum tersedia', tone: 'neutral' };
            const isVoid = ['cancelled', 'rejected', 'void'].includes(requestMeta.tone) || ['cancelled', 'void'].includes(paymentMeta.tone);
            const startHour = Number(booking.startHour || 0);
            const duration = Number(booking.durationHours || booking.duration || 1);
            const endHour = startHour + duration;
            const bookingCode = booking.bookingCode || booking.bookingId || booking.id;

            return (
              <article className={`client-history-card ${isVoid ? 'is-void' : ''}`} key={booking.id}>
                <button
                  className="client-history-card-main"
                  type="button"
                  onClick={() => handleBookingBlockClick(booking)}
                  aria-label={`Buka detail ${bookingCode}`}
                >
                  <span className="client-history-card-icon"><Volume2 size={17} /></span>
                  <span className="client-history-card-copy">
                    <strong>{booking.sessionLabel || booking.packageLabel || booking.title || 'Sesi Studio'}</strong>
                    <small><CalendarDays size={12} /> {formatBookingDate(booking.date)}</small>
                  </span>
                  <span className="client-history-card-time">
                    <small><Clock3 size={12} /> Waktu</small>
                    <strong>{String(startHour).padStart(2, '0')}.00–{String(endHour).padStart(2, '0')}</strong>
                  </span>
                  <span className="client-history-card-amount">
                    <span aria-label="Status request, pembayaran, dan sesi" className="client-history-status-list">
                      <small className={`client-history-status is-${requestMeta.tone}`}><b>Request</b>{requestMeta.label}</small>
                      <small className={`client-history-status is-${paymentMeta.tone}`}><b>Bayar</b>{paymentMeta.label}</small>
                      <small className={`client-history-status is-${sessionMeta.tone}`}><b>Sesi</b>{sessionMeta.label}</small>
                    </span>
                    <strong>{formatRupiah(booking.total || 0)}</strong>
                  </span>
                  <ChevronRight className="client-history-card-chevron" size={17} />
                </button>

                <button
                  className="client-history-copy"
                  type="button"
                  aria-label={`Salin kode booking ${bookingCode}`}
                  onClick={() => copyText(bookingCode, 'Kode booking disalin.')}
                >
                  <span>{bookingCode}</span>
                  <Copy size={12} />
                </button>

                {booking.lastMessageSenderRole === 'admin' && booking.lastMessageReadByClient === false ? (
                  <span className="client-message-new">Pesan baru</span>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
