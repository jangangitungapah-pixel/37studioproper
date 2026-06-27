import { Search, CalendarDays, Copy } from 'lucide-react';
import { formatRupiah } from '../../settings/pricingSettings.js';
import { getBookingRequestStatusMeta } from '../../services/bookingCommunicationRepository.js';
import { statusFilters } from '../../pages/admin/scheduleConfig.js';

function getStatusLabel(status) {
  return statusFilters.find((item) => item.key === status)?.label || status;
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
  getBookingStatus,
  copyText
}) {
  return (
    <div className="client-history-tab" style={{ gap: '12px' }}>
      <div className="client-history-heading">
        <div>
          <span>Booking</span>
          <h3>Riwayat Saya</h3>
        </div>
        <strong>{filteredHistoryBookings.length} data</strong>
      </div>

      <div className="client-history-tools" style={{ gap: '6px' }}>
        <label className="client-history-search">
          <Search size={14} />
          <input 
            value={historyQuery} 
            onChange={(event) => setHistoryQuery(event.target.value)} 
            placeholder="Cari kode, layanan, tanggal..." 
          />
        </label>
        <div className="client-history-filters" aria-label="Filter riwayat booking">
          {historyFilterOptions.map((option) => (
            <button 
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
          <CalendarDays size={24} style={{ color: 'var(--auth-text-muted)', opacity: 0.4 }} />
          <strong>Belum ada riwayat booking</strong>
          <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--auth-text-muted)' }}>Anda belum pernah memesan jadwal sesi latihan atau rekaman.</p>
        </div>
      ) : filteredHistoryBookings.length === 0 ? (
        <div className="client-history-empty">
          <Search size={20} style={{ color: 'var(--auth-text-muted)', opacity: 0.4 }} />
          <strong>Booking tidak ditemukan</strong>
          <span>Coba ubah kata pencarian atau filter status.</span>
        </div>
      ) : (
        <div className="client-history-list" style={{ gap: '6px' }}>
          {filteredHistoryBookings.map((booking) => {
            const status = getBookingStatus(booking);
            const isVoid = status === 'void' || status === 'cancelled';
            
            const getStatusBadgeTone = (statusStr) => {
              const cleanStatus = statusStr.toLowerCase();
              if (cleanStatus === 'lunas') return 'success';
              if (cleanStatus === 'dp') return 'warning';
              if (cleanStatus === 'void' || cleanStatus === 'cancelled') return 'muted';
              return 'warning';
            };

            const startHourNum = Number(booking.startHour || 0);
            const durationNum = Number(booking.durationHours || booking.duration || 1);
            const endHourNum = startHourNum + durationNum;
            const timeString = `${String(startHourNum).padStart(2, '0')}.00 - ${String(endHourNum).padStart(2, '0')}.00 WIB`;

            return (
              <article
                key={booking.id}
                onClick={() => handleBookingBlockClick(booking)}
                className={`client-history-card ${isVoid ? 'is-void' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '10px 12px',
                  background: 'var(--studio-surface-1)',
                  border: '1px solid var(--studio-border)',
                  borderRadius: 'var(--studio-radius-lg)',
                  cursor: 'pointer',
                  opacity: isVoid ? 0.55 : 1
                }}
              >
                {/* Left Part: Title & Code */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {booking.sessionLabel || booking.packageLabel || booking.title || 'Sesi Studio'}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="client-booking-code" style={{ fontSize: '9px', padding: '1px 4px', background: 'var(--studio-surface-2)', border: '1px solid var(--studio-border)', borderRadius: '4px', color: 'var(--studio-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                      {booking.bookingCode || 'BKG'}
                      <button
                        type="button"
                        aria-label="Salin kode booking"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--studio-text-muted)' }}
                        onClick={(event) => {
                          event.stopPropagation();
                          copyText(booking.bookingCode || booking.bookingId || booking.id, 'Kode booking disalin.');
                        }}
                      >
                        <Copy size={9} />
                      </button>
                    </span>
                    {booking.lastMessageSenderRole === 'admin' && booking.lastMessageReadByClient === false ? (
                      <span className="client-message-new" style={{ fontSize: '8px', padding: '1px 4px', background: 'var(--auth-accent-soft)', color: 'var(--auth-accent)', border: '1px solid color-mix(in srgb, var(--auth-accent) 30%, var(--studio-border))', borderRadius: '4px', fontWeight: '700', textTransform: 'uppercase' }}>NEW</span>
                    ) : null}
                  </div>
                </div>

                {/* Middle-Right Part: Waktu & Tanggal (Stacked, Font Mikro) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px', flexShrink: 0, textAlign: 'right', minWidth: '76px' }}>
                  <span style={{ fontSize: '10px', color: '#fff', fontWeight: '700' }}>
                    {new Date(`${booking.date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--studio-text-muted)' }}>
                    {String(startHourNum).padStart(2, '0')}.00-{String(endHourNum).padStart(2, '0')}.00 ({durationNum}j)
                  </span>
                </div>

                {/* Far Right Part: Status Pill & Price */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0, minWidth: '74px' }}>
                  <span className={`client-request-badge is-${getStatusBadgeTone(status)}`} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {getStatusLabel(status)}
                  </span>
                  <strong style={{ fontSize: '11px', color: 'var(--studio-text-strong)', fontWeight: '800' }}>
                    {formatRupiah(booking.total || 0)}
                  </strong>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
