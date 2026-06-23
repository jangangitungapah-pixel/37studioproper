import { CalendarDays, ChevronRight, Clock, CreditCard, MapPin, MessageCircle, Volume2, CalendarPlus } from 'lucide-react';
import { formatRupiah } from '../../settings/pricingSettings.js';
import { statusFilters } from '../../pages/admin/scheduleConfig.js';

function getBookingStatus(booking) {
  return booking.paymentStatus || booking.status || 'pending';
}

function getStatusLabel(status) {
  return statusFilters.find((item) => item.key === status)?.label || status;
}

export default function ClientDashboardTab({
  upcomingBooking,
  stats,
  recentBookings,
  whatsappPhone,
  studioMapsUrl,
  setActiveTab,
  handleBookingBlockClick,
  downloadCalendarEvent
}) {
  return (
    <div className="client-dashboard">
      <section className="client-next-section" aria-labelledby="next-session-title">
        <h1 id="next-session-title">Sesi berikutnya</h1>
        {upcomingBooking ? (
          <article className="client-next-booking">
            <span className="client-next-icon"><Volume2 size={22} /></span>
            <span className="client-next-content">
              <strong>{upcomingBooking.sessionLabel || upcomingBooking.packageLabel || upcomingBooking.title || 'Sesi Studio'}</strong>
              <span><CalendarDays size={15} />{new Date(`${upcomingBooking.date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <span><Clock size={15} />{String(upcomingBooking.startHour).padStart(2, '0')}.00 - {String(Number(upcomingBooking.startHour) + (Number(upcomingBooking.durationHours) || 1)).padStart(2, '0')}.00 WIB</span>
              <span className={`client-payment-state is-${getBookingStatus(upcomingBooking)}`}><CreditCard size={15} />{getStatusLabel(getBookingStatus(upcomingBooking))}</span>
            </span>
            <div className="client-next-actions">
              <button type="button" onClick={() => downloadCalendarEvent(upcomingBooking)}><CalendarPlus size={14} />Tambah ke kalender</button>
              <button type="button" onClick={() => handleBookingBlockClick(upcomingBooking)}>Lihat detail <ChevronRight size={14} /></button>
            </div>
          </article>
        ) : (
          <div className="client-empty-next">
            <CalendarDays size={24} />
            <div><strong>Belum ada sesi mendatang</strong><span>Pilih jadwal yang cocok untuk sesi berikutnya.</span></div>
          </div>
        )}
      </section>

      <button className="client-primary-booking" type="button" onClick={() => setActiveTab('calendar')}>
        <CalendarDays size={20} /> Booking jadwal
      </button>

      {stats.unpaidAmount > 0 && (
        <button className="client-billing-prompt" type="button" onClick={() => setActiveTab('billing')}>
          <span><CreditCard size={20} /></span>
          <span><small>Sisa tagihan</small><strong>{formatRupiah(stats.unpaidAmount)}</strong></span>
          <span className="client-billing-action">Lihat tagihan <ChevronRight size={15} /></span>
        </button>
      )}

      <div className="client-summary-strip">
        <div><CalendarDays size={21} /><strong>{stats.totalBookings}</strong><span>booking</span></div>
        <div><Clock size={21} /><strong>{stats.totalDuration}</strong><span>jam studio</span></div>
      </div>

      {recentBookings.length > 0 && (
        <section className="client-recent-section">
          <div className="client-section-heading"><h2>Booking terbaru</h2><button type="button" onClick={() => setActiveTab('history')}>Lihat semua</button></div>
          <div className="client-recent-list">
            {recentBookings.map((booking) => (
              <button className={booking.lastMessageSenderRole === 'admin' && booking.lastMessageReadByClient === false ? 'has-unread-message' : ''} type="button" key={booking.id} onClick={() => handleBookingBlockClick(booking)}>
                <span className="client-recent-icon"><Volume2 size={17} /></span>
                <span><strong>{booking.sessionLabel || booking.packageLabel || booking.title || 'Sesi Studio'}</strong><small>{new Date(`${booking.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · {String(booking.startHour).padStart(2, '0')}.00 WIB</small></span>
                {booking.lastMessageSenderRole === 'admin' && booking.lastMessageReadByClient === false ? <i className="client-unread-dot" aria-label="Pesan baru dari admin" /> : null}
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="client-help-tools" aria-label="Bantuan client">
        <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={16} /><span><strong>Hubungi admin</strong><small>Tanya jadwal atau booking</small></span><ChevronRight size={15} />
        </a>
        <a href={studioMapsUrl} target="_blank" rel="noopener noreferrer">
          <MapPin size={16} /><span><strong>Lokasi studio</strong><small>Buka petunjuk arah</small></span><ChevronRight size={15} />
        </a>
      </section>
    </div>
  );
}
