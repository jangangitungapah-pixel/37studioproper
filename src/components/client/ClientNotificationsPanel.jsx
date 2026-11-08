import { Bell, CalendarDays, X } from 'lucide-react';

function formatNotificationDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return 'Waktu tidak tersedia';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function ClientNotificationsPanel({
  events = [],
  isLoading = false,
  error = '',
  onRetry,
  onOpenBooking,
  onClose,
}) {
  return (
    <section
      aria-label="Notifikasi client"
      className="client-notifications-panel"
      id="client-notifications-panel"
      role="region"
    >
      <header className="client-notifications-panel-head">
        <div>
          <span><Bell size={15} aria-hidden="true" /> Aktivitas akun</span>
          <h2>Notifikasi</h2>
          <p>Pembaruan booking dan pembayaran yang ditujukan ke akun ini.</p>
        </div>
        <button
          aria-label="Tutup notifikasi"
          className="client-notifications-close"
          onClick={onClose}
          type="button"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </header>

      <div aria-busy={isLoading} aria-live="polite" className="client-notifications-panel-body">
        {isLoading ? (
          <p className="client-notifications-state" role="status">Memuat aktivitas terbaru…</p>
        ) : error ? (
          <div className="client-notifications-state is-error" role="alert">
            <strong>Notifikasi belum dapat dimuat.</strong>
            <span>{error}</span>
            <button onClick={onRetry} type="button">Coba lagi</button>
          </div>
        ) : events.length === 0 ? (
          <div className="client-notifications-state">
            <Bell size={22} aria-hidden="true" />
            <strong>Belum ada aktivitas</strong>
            <span>Pembaruan dari admin akan muncul di sini.</span>
          </div>
        ) : (
          <ol className="client-notifications-list">
            {events.map((event) => {
              const bookingCode = event.metadata?.bookingCode;
              const canOpenBooking = Boolean(event.bookingId);

              return (
                <li key={event.id}>
                  <article className="client-notification-item">
                    <div className="client-notification-item-meta">
                      <span>Tercatat</span>
                      <time dateTime={event.createdAt || undefined}>
                        {formatNotificationDate(event.createdAt)}
                      </time>
                    </div>
                    <h3>{event.title || 'Pembaruan aktivitas'}</h3>
                    <p>{event.message || 'Ada pembaruan terkait akun Anda.'}</p>
                    {bookingCode ? <small>Kode booking: {bookingCode}</small> : null}
                    {canOpenBooking ? (
                      <button
                        className="client-notification-open"
                        onClick={() => onOpenBooking(event)}
                        type="button"
                      >
                        <CalendarDays size={14} aria-hidden="true" />
                        Lihat booking
                      </button>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
