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
        <h1 id="next-session-title" style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--auth-text-muted)', margin: '0 0 6px' }}>Sesi berikutnya</h1>
        {upcomingBooking ? (
          <article className="client-next-booking">
            <div className="client-next-booking-header">
              <span className="client-next-icon"><Volume2 size={16} /></span>
              <span className="client-next-content">
                <strong>{upcomingBooking.sessionLabel || upcomingBooking.packageLabel || upcomingBooking.title || 'Sesi Studio'}</strong>
                <span style={{ fontSize: '10px', color: 'var(--auth-text-muted)' }}>
                  <CalendarDays size={11} style={{ marginRight: '3px' }} />
                  {new Date(`${upcomingBooking.date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                  <span style={{ margin: '0 4px' }}>•</span>
                  <Clock size={11} style={{ marginRight: '3px' }} />
                  {String(upcomingBooking.startHour).padStart(2, '0')}.00 WIB ({upcomingBooking.durationHours}j)
                </span>
              </span>
              <span className={`client-payment-state is-${getBookingStatus(upcomingBooking)}`} style={{ fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>
                {getStatusLabel(getBookingStatus(upcomingBooking))}
              </span>
            </div>
            <div className="client-next-actions">
              <button type="button" onClick={() => downloadCalendarEvent(upcomingBooking)}>
                <CalendarPlus size={12} />
                <span>Kalender</span>
              </button>
              <button type="button" onClick={() => handleBookingBlockClick(upcomingBooking)}>
                <span>Detail</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </article>
        ) : (
          <div className="client-empty-next">
            <CalendarDays size={18} style={{ color: 'var(--auth-text-muted)' }} />
            <div>
              <strong>Belum ada sesi mendatang</strong>
              <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--auth-text-muted)' }}>Pilih jadwal yang cocok untuk sesi berikutnya.</p>
            </div>
          </div>
        )}
      </section>

      <button className="client-primary-booking" type="button" onClick={() => setActiveTab('calendar')}>
        <CalendarDays size={16} />
        <span>Booking Jadwal Baru</span>
      </button>

      {stats.unpaidAmount > 0 && (
        <button className="client-billing-prompt" type="button" onClick={() => setActiveTab('billing')}>
          <span className="client-billing-prompt-left">
            <span className="client-billing-prompt-icon"><CreditCard size={16} /></span>
            <span className="client-billing-prompt-info">
              <small>Sisa tagihan</small>
              <strong>{formatRupiah(stats.unpaidAmount)}</strong>
            </span>
          </span>
          <span className="client-billing-action">
            <span>Bayar</span>
            <ChevronRight size={14} />
          </span>
        </button>
      )}

      <div className="client-summary-strip">
        <div>
          <CalendarDays size={16} />
          <strong>{stats.totalBookings}</strong>
          <span>booking</span>
        </div>
        <div>
          <Clock size={16} />
          <strong>{stats.totalDuration}</strong>
          <span>jam studio</span>
        </div>
      </div>

      {recentBookings.length > 0 && (
        <section className="client-recent-section">
          <div className="client-section-heading" style={{ marginBottom: '6px' }}>
            <h2>Booking terbaru</h2>
            <button type="button" onClick={() => setActiveTab('history')}>Lihat semua</button>
          </div>
          <div className="client-recent-list">
            {recentBookings.map((booking) => (
              <button 
                className={`client-recent-row ${booking.lastMessageSenderRole === 'admin' && booking.lastMessageReadByClient === false ? 'has-unread-message' : ''}`}
                type="button" 
                key={booking.id} 
                onClick={() => handleBookingBlockClick(booking)}
              >
                <span className="client-recent-info-left">
                  <span className="client-recent-icon"><Volume2 size={13} /></span>
                  <span className="client-recent-text">
                    <strong>{booking.sessionLabel || booking.packageLabel || booking.title || 'Sesi Studio'}</strong>
                    <small>
                      {new Date(`${booking.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • {String(booking.startHour).padStart(2, '0')}.00 WIB
                    </small>
                  </span>
                </span>
                <span className="client-recent-right">
                  {booking.lastMessageSenderRole === 'admin' && booking.lastMessageReadByClient === false ? (
                    <i className="client-unread-dot" aria-label="Pesan baru dari admin" />
                  ) : null}
                  <ChevronRight size={14} style={{ color: 'var(--auth-text-muted)' }} />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="client-help-tools" aria-label="Bantuan client" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noopener noreferrer" className="client-recent-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', textDecoration: 'none' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <MessageCircle size={14} style={{ color: 'var(--auth-accent)' }} />
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <strong style={{ color: '#fff', fontSize: '11px', fontWeight: '700' }}>Hubungi Admin</strong>
              <small style={{ color: 'var(--auth-text-muted)', fontSize: '9px' }}>Tanya jadwal/booking</small>
            </span>
          </span>
          <ChevronRight size={13} style={{ color: 'var(--auth-text-muted)' }} />
        </a>
        <a href={studioMapsUrl} target="_blank" rel="noopener noreferrer" className="client-recent-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', textDecoration: 'none' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <MapPin size={14} style={{ color: 'var(--auth-accent)' }} />
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <strong style={{ color: '#fff', fontSize: '11px', fontWeight: '700' }}>Lokasi Studio</strong>
              <small style={{ color: 'var(--auth-text-muted)', fontSize: '9px' }}>Buka petunjuk arah</small>
            </span>
          </span>
          <ChevronRight size={13} style={{ color: 'var(--auth-text-muted)' }} />
        </a>
      </section>
    </div>
  );
}
