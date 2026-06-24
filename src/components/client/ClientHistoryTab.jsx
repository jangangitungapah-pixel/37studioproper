import { Search, CalendarDays, Clock, Copy } from 'lucide-react';
import { formatRupiah } from '../../settings/pricingSettings.js';
import { getBookingRequestStatusMeta } from '../../services/bookingCommunicationRepository.js';

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
    <div className="client-history-tab space-y-5">
      <div className="client-history-heading">
        <div><span>Booking</span><h3>Riwayat saya</h3></div>
        <strong>{filteredHistoryBookings.length} data</strong>
      </div>

      <div className="client-history-tools">
        <label className="client-history-search">
          <Search size={15} />
          <input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Cari kode, layanan, atau tanggal" />
        </label>
        <div className="client-history-filters" aria-label="Filter riwayat booking">
          {historyFilterOptions.map((option) => (
            <button className={historyFilter === option.key ? 'is-active' : ''} key={option.key} type="button" onClick={() => setHistoryFilter(option.key)}>{option.label}</button>
          ))}
        </div>
      </div>
      
      {userBookings.length === 0 ? (
        <div className="client-history-empty">
          <CalendarDays size={28} className="mx-auto text-white/20 mb-2" />
          <strong>Belum ada riwayat booking</strong>
          <p className="text-xs max-w-xs mx-auto">Anda belum pernah memesan jadwal sesi latihan atau rekaman.</p>
        </div>
      ) : filteredHistoryBookings.length === 0 ? (
        <div className="client-history-empty">
          <Search size={22} />
          <strong>Booking tidak ditemukan</strong>
          <span>Coba ubah kata pencarian atau filter status.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredHistoryBookings.map((booking) => {
            const status = getBookingStatus(booking);
            const isVoid = status === 'void' || status === 'cancelled';
            
            const getStatusBadgeClass = (statusStr) => {
              const cleanStatus = statusStr.toLowerCase();
              if (cleanStatus === 'lunas') return 'bg-green-500/10 text-green-400 border border-green-500/20';
              if (cleanStatus === 'dp') return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
              if (cleanStatus === 'void' || cleanStatus === 'cancelled') return 'bg-white/5 text-white/40 border border-white/10';
              return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
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
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="client-booking-code text-[10px] text-[var(--ui-text-muted)] font-semibold tracking-wider bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                      {booking.bookingCode || booking.bookingId || 'BKG'}
                      <button
                        type="button"
                        aria-label="Salin kode booking"
                        onClick={(event) => {
                          event.stopPropagation();
                          copyText(booking.bookingCode || booking.bookingId || booking.id, 'Kode booking disalin.');
                        }}
                      >
                        <Copy size={11} />
                      </button>
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${getStatusBadgeClass(status)}`}>
                      {status === 'void' ? 'Void' : status === 'cancelled' ? 'Canceled' : status}
                    </span>
                    {getBookingRequestStatusMeta(booking) ? (
                      <span className={`client-request-badge is-${getBookingRequestStatusMeta(booking).tone}`}>
                        {getBookingRequestStatusMeta(booking).label}
                      </span>
                    ) : null}
                    {booking.lastMessageSenderRole === 'admin' && booking.lastMessageReadByClient === false ? <span className="client-message-new">Pesan baru</span> : null}
                  </div>

                  <h4 className="text-base font-bold text-white leading-tight">
                    {booking.sessionLabel || booking.packageLabel || booking.title || 'Sesi Selesai'}
                  </h4>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ui-text-muted)]">
                    <span className="flex items-center gap-1">
                      <CalendarDays size={13} className="text-[#ff8a2a]" />
                      <span>{new Date(`${booking.date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-[#ff8a2a]" />
                      <span>{timeString} ({durationNum} Jam)</span>
                    </span>
                  </div>
                </div>

                <div className="sm:text-right flex sm:flex-col justify-between items-center sm:items-end gap-2 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0 shrink-0">
                  <span className="text-xs text-[var(--ui-text-muted)]">Estimasi Total</span>
                  <strong className="text-base text-white">{formatRupiah(booking.total || booking.subtotal || 0)}</strong>
                  {status === 'dp' && booking.dpAmount > 0 && (
                    <span className="text-[10px] text-orange-400 font-medium">
                      Sisa: {formatRupiah((booking.total || 0) - booking.dpAmount)}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
