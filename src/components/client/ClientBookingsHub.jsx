import {
  CreditCard,
  ListChecks,
} from 'lucide-react';
import '../../styles/modules/client-navigation-v2.css';

export default function ClientBookingsHub({
  bookingsContent,
  paymentsContent,
  pendingPaymentCount,
  section,
  setSection,
  unreadCount,
}) {
  return (
    <section
      className="client-bookings-hub"
      aria-labelledby="client-bookings-title"
    >
      <header className="client-navigation-page-heading">
        <span>
          Client Portal
        </span>

        <h2 id="client-bookings-title">
          Bookings
        </h2>

        <p>
          Pantau request, jadwal, komunikasi, dan pembayaran booking Anda dari satu tempat.
        </p>
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
          <ListChecks
            size={15}
          />

          <span>
            My Bookings
          </span>

          {unreadCount ? (
            <b>
              {unreadCount}
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
            size={15}
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
