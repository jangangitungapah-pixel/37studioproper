import {
  CalendarCheck2,
  CreditCard,
  MessageCircle,
} from 'lucide-react';
import '../../styles/modules/client-navigation-v2.css';

export default function ClientBookingsHub({
  bookingCount,
  bookingsContent,
  paymentsContent,
  pendingPaymentCount,
  section,
  setSection,
  unreadCount,
}) {
  return (
    <section
      className="client-bookings-hub client-bookings-hub-overhaul"
      aria-labelledby="client-bookings-title"
    >
      <header className="client-bookings-overview">
        <div className="client-navigation-page-heading">
          <span>
            Your Studio Activity
          </span>

          <h2 id="client-bookings-title">
            Bookings
          </h2>

          <p>
            Request, jadwal, percakapan admin, dan pembayaran tersusun dalam satu workspace.
          </p>
        </div>

        <div className="client-bookings-overview-stats">
          <div>
            <CalendarCheck2
              size={17}
            />

            <span>
              <small>
                Total
              </small>

              <strong>
                {
                  bookingCount
                }
              </strong>
            </span>
          </div>

          <div>
            <MessageCircle
              size={17}
            />

            <span>
              <small>
                Pesan baru
              </small>

              <strong>
                {
                  unreadCount
                }
              </strong>
            </span>
          </div>

          <div>
            <CreditCard
              size={17}
            />

            <span>
              <small>
                Bukti pending
              </small>

              <strong>
                {
                  pendingPaymentCount
                }
              </strong>
            </span>
          </div>
        </div>
      </header>

      <div
        className="client-bookings-hub-tabs"
        role="tablist"
        aria-label="Booking sections"
      >
        <button
          aria-selected={
            section ===
            'bookings'
          }
          className={
            section ===
            'bookings'
              ? 'is-active'
              : ''
          }
          role="tab"
          type="button"
          onClick={() =>
            setSection(
              'bookings',
            )
          }
        >
          <CalendarCheck2
            size={16}
          />

          <span>
            My Bookings
          </span>

          {unreadCount ? (
            <b>
              {
                unreadCount
              }
            </b>
          ) : null}
        </button>

        <button
          aria-selected={
            section ===
            'payments'
          }
          className={
            section ===
            'payments'
              ? 'is-active'
              : ''
          }
          role="tab"
          type="button"
          onClick={() =>
            setSection(
              'payments',
            )
          }
        >
          <CreditCard
            size={16}
          />

          <span>
            Payments
          </span>

          {pendingPaymentCount ? (
            <b>
              {
                pendingPaymentCount
              }
            </b>
          ) : null}
        </button>
      </div>

      <div className="client-bookings-hub-content">
        {section ===
        'payments'
          ? paymentsContent
          : bookingsContent}
      </div>
    </section>
  );
}
