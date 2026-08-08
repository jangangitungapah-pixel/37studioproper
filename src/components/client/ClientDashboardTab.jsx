import {
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Clock,
  CreditCard,
  ListChecks,
  MapPin,
  MessageCircle,
  Volume2,
} from 'lucide-react';
import {
  formatRupiah,
} from '../../settings/pricingSettings.js';
import {
  statusFilters,
} from '../../pages/admin/scheduleConfig.js';
import {
  getLegacyBookingPaymentStatus,
} from '../../domain/booking/bookingSelectors.js';

function getBookingStatus(
  booking,
) {
  return getLegacyBookingPaymentStatus(
    booking,
  );
}

function getStatusLabel(
  status,
) {
  return (
    statusFilters.find(
      (item) =>
        item.key ===
        status,
    )?.label ||
    status
  );
}

function formatBookingDate(
  value,
) {
  const date =
    new Date(
      String(value) +
        'T00:00:00',
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value || '-';
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day:
        'numeric',
      month:
        'short',
      weekday:
        'short',
    },
  ).format(date);
}

export default function ClientDashboardTab({
  upcomingBooking,
  stats,
  recentBookings,
  whatsappPhone,
  studioMapsUrl,
  onOpenBook,
  onOpenBookings,
  onOpenPayments,
  handleBookingBlockClick,
  downloadCalendarEvent,
}) {
  return (
    <div className="client-home-dashboard">
      <header className="client-home-heading">
        <div>
          <span>
            Studio Overview
          </span>

          <h2>
            Semua yang Anda butuhkan,
            dalam satu dashboard.
          </h2>

          <p>
            Booking studio, pantau jadwal, cek pembayaran, dan hubungi admin tanpa berpindah aplikasi.
          </p>
        </div>

        <button
          className="client-home-book-button"
          type="button"
          onClick={
            onOpenBook
          }
        >
          <CalendarDays
            size={17}
          />

          <span>
            Book Studio
          </span>

          <ChevronRight
            size={15}
          />
        </button>
      </header>

      <div className="client-home-grid">
        <section className="client-home-session-panel">
          <div className="client-home-panel-label">
            <span>
              Next Session
            </span>

            {upcomingBooking ? (
              <span
                className={
                  'client-payment-state is-' +
                  getBookingStatus(
                    upcomingBooking,
                  )
                }
              >
                {
                  getStatusLabel(
                    getBookingStatus(
                      upcomingBooking,
                    ),
                  )
                }
              </span>
            ) : null}
          </div>

          {upcomingBooking ? (
            <>
              <div className="client-home-session-main">
                <div className="client-home-session-icon">
                  <Volume2
                    size={28}
                  />
                </div>

                <div>
                  <span>
                    Upcoming booking
                  </span>

                  <h3>
                    {
                      upcomingBooking.sessionLabel ||
                      upcomingBooking.packageLabel ||
                      upcomingBooking.title ||
                      'Sesi Studio'
                    }
                  </h3>

                  <div className="client-home-session-meta">
                    <span>
                      <CalendarDays
                        size={14}
                      />

                      {
                        formatBookingDate(
                          upcomingBooking.date,
                        )
                      }
                    </span>

                    <span>
                      <Clock
                        size={14}
                      />

                      {
                        String(
                          upcomingBooking.startHour,
                        ).padStart(
                          2,
                          '0',
                        )
                      }
                      .00 WIB
                    </span>

                    <span>
                      {
                        Number(
                          upcomingBooking.durationHours ||
                          upcomingBooking.duration ||
                          0,
                        )
                      }
                      {' jam'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="client-home-session-actions">
                <button
                  type="button"
                  onClick={() =>
                    downloadCalendarEvent(
                      upcomingBooking,
                    )
                  }
                >
                  <CalendarPlus
                    size={15}
                  />

                  Kalender
                </button>

                <button
                  className="is-primary"
                  type="button"
                  onClick={() =>
                    handleBookingBlockClick(
                      upcomingBooking,
                    )
                  }
                >
                  Lihat Detail

                  <ChevronRight
                    size={15}
                  />
                </button>
              </div>
            </>
          ) : (
            <div className="client-home-empty-session">
              <div className="client-home-empty-icon">
                <CalendarDays
                  size={30}
                />
              </div>

              <div>
                <span>
                  Kalender Anda masih kosong
                </span>

                <h3>
                  Belum ada sesi mendatang.
                </h3>

                <p>
                  Pilih slot yang tersedia dan kirim request booking pertama Anda.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  onOpenBook
                }
              >
                Pilih Jadwal

                <ChevronRight
                  size={15}
                />
              </button>
            </div>
          )}
        </section>

        <aside className="client-home-stats-panel">
          <div className="client-home-stat-card">
            <span>
              Total Booking
            </span>

            <strong>
              {
                stats.totalBookings
              }
            </strong>

            <small>
              seluruh request
            </small>
          </div>

          <div className="client-home-stat-card">
            <span>
              Studio Time
            </span>

            <strong>
              {
                stats.totalDuration
              }
              <b>
                {' '}jam
              </b>
            </strong>

            <small>
              total durasi
            </small>
          </div>

          <div className="client-home-stat-card is-payment">
            <span>
              Outstanding
            </span>

            <strong>
              {
                formatRupiah(
                  stats.unpaidAmount,
                )
              }
            </strong>

            <small>
              sisa pembayaran
            </small>
          </div>

          {stats.unpaidAmount > 0 ? (
            <button
              className="client-home-payment-cta"
              type="button"
              onClick={
                onOpenPayments
              }
            >
              <CreditCard
                size={15}
              />

              <span>
                Lihat Tagihan
              </span>

              <ChevronRight
                size={15}
              />
            </button>
          ) : (
            <div className="client-home-payment-clear">
              <CreditCard
                size={15}
              />

              Tidak ada tagihan aktif
            </div>
          )}
        </aside>
      </div>

      <div className="client-home-lower-grid">
        <section className="client-home-recent-panel">
          <header>
            <div>
              <span>
                Activity
              </span>

              <h3>
                Booking terbaru
              </h3>
            </div>

            <button
              type="button"
              onClick={
                onOpenBookings
              }
            >
              Lihat semua

              <ChevronRight
                size={14}
              />
            </button>
          </header>

          {recentBookings.length ? (
            <div className="client-home-recent-list">
              {recentBookings.map(
                (
                  booking,
                ) => (
                  <button
                    className="client-home-recent-item"
                    key={
                      booking.id
                    }
                    type="button"
                    onClick={() =>
                      handleBookingBlockClick(
                        booking,
                      )
                    }
                  >
                    <span className="client-home-recent-icon">
                      <Volume2
                        size={16}
                      />
                    </span>

                    <span className="client-home-recent-copy">
                      <strong>
                        {
                          booking.sessionLabel ||
                          booking.packageLabel ||
                          booking.title ||
                          'Sesi Studio'
                        }
                      </strong>

                      <small>
                        {
                          formatBookingDate(
                            booking.date,
                          )
                        }
                        {' · '}
                        {
                          String(
                            booking.startHour,
                          ).padStart(
                            2,
                            '0',
                          )
                        }
                        .00 WIB
                      </small>
                    </span>

                    <span
                      className={
                        'client-home-recent-status is-' +
                        getBookingStatus(
                          booking,
                        )
                      }
                    >
                      {
                        getStatusLabel(
                          getBookingStatus(
                            booking,
                          ),
                        )
                      }
                    </span>

                    <ChevronRight
                      size={15}
                    />
                  </button>
                ),
              )}
            </div>
          ) : (
            <div className="client-home-get-started">
              <span>
                First booking
              </span>

              <h4>
                Mulai dalam 3 langkah.
              </h4>

              <div>
                <p>
                  <b>
                    1
                  </b>
                  Pilih tanggal dan jam kosong.
                </p>

                <p>
                  <b>
                    2
                  </b>
                  Review layanan dan estimasi harga.
                </p>

                <p>
                  <b>
                    3
                  </b>
                  Admin mengonfirmasi request Anda.
                </p>
              </div>
            </div>
          )}
        </section>

        <aside className="client-home-quick-panel">
          <header>
            <span>
              Quick Access
            </span>

            <h3>
              Yang sering dipakai
            </h3>
          </header>

          <button
            type="button"
            onClick={
              onOpenBook
            }
          >
            <CalendarDays
              size={17}
            />

            <span>
              <strong>
                Book Studio
              </strong>

              <small>
                Cari slot kosong
              </small>
            </span>

            <ChevronRight
              size={15}
            />
          </button>

          <button
            type="button"
            onClick={
              onOpenBookings
            }
          >
            <ListChecks
              size={17}
            />

            <span>
              <strong>
                My Bookings
              </strong>

              <small>
                Request dan riwayat
              </small>
            </span>

            <ChevronRight
              size={15}
            />
          </button>

          <a
            href={
              'https://wa.me/' +
              whatsappPhone
            }
            rel="noopener noreferrer"
            target="_blank"
          >
            <MessageCircle
              size={17}
            />

            <span>
              <strong>
                Hubungi Admin
              </strong>

              <small>
                Bantuan cepat
              </small>
            </span>

            <ChevronRight
              size={15}
            />
          </a>

          <a
            href={
              studioMapsUrl
            }
            rel="noopener noreferrer"
            target="_blank"
          >
            <MapPin
              size={17}
            />

            <span>
              <strong>
                Lokasi Studio
              </strong>

              <small>
                Buka Maps
              </small>
            </span>

            <ChevronRight
              size={15}
            />
          </a>
        </aside>
      </div>
    </div>
  );
}
