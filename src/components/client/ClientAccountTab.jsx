import {
  ChevronRight,
  CreditCard,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  UserRound,
} from 'lucide-react';
import {
  formatRupiah,
} from '../../settings/pricingSettings.js';
import '../../styles/modules/client-navigation-v2.css';

function getAccountName(
  currentUser,
) {
  return (
    currentUser?.displayName ||
    currentUser?.email?.split('@')?.[0] ||
    'Client'
  );
}

export default function ClientAccountTab({
  currentUser,
  onLogout,
  onOpenPayments,
  stats,
  studioMapsUrl,
  whatsappPhone,
}) {
  const accountName =
    getAccountName(
      currentUser,
    );

  return (
    <section
      className="client-account-tab"
      aria-labelledby="client-account-title"
    >
      <header className="client-navigation-page-heading">
        <span>
          Client Portal
        </span>

        <h2 id="client-account-title">
          Account
        </h2>

        <p>
          Informasi akun, bantuan studio, dan shortcut pembayaran.
        </p>
      </header>

      <article className="client-account-profile">
        <div className="client-account-avatar">
          <UserRound
            size={24}
          />
        </div>

        <div>
          <strong>
            {accountName}
          </strong>

          <span>
            Client 37 Music Studio
          </span>
        </div>
      </article>

      <section className="client-account-contact">
        <div>
          <Mail
            size={15}
          />

          <span>
            <small>
              Email
            </small>

            <strong>
              {
                currentUser?.email ||
                'Belum tersedia'
              }
            </strong>
          </span>
        </div>

        <div>
          <Phone
            size={15}
          />

          <span>
            <small>
              Nomor HP
            </small>

            <strong>
              {
                currentUser?.phoneNumber ||
                'Belum tersedia'
              }
            </strong>
          </span>
        </div>
      </section>

      <section className="client-account-summary">
        <div>
          <span>
            Total booking
          </span>

          <strong>
            {
              stats.totalBookings
            }
          </strong>
        </div>

        <div>
          <span>
            Jam studio
          </span>

          <strong>
            {
              stats.totalDuration
            }
          </strong>
        </div>

        <div>
          <span>
            Sisa tagihan
          </span>

          <strong>
            {
              formatRupiah(
                stats.unpaidAmount,
              )
            }
          </strong>
        </div>
      </section>

      <div className="client-account-actions">
        <button
          type="button"
          onClick={
            onOpenPayments
          }
        >
          <CreditCard
            size={16}
          />

          <span>
            <strong>
              Payments
            </strong>

            <small>
              Tagihan dan bukti pembayaran
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
            size={16}
          />

          <span>
            <strong>
              Hubungi Admin
            </strong>

            <small>
              Bantuan booking dan studio
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
            size={16}
          />

          <span>
            <strong>
              Lokasi Studio
            </strong>

            <small>
              Buka petunjuk arah
            </small>
          </span>

          <ChevronRight
            size={15}
          />
        </a>
      </div>

      <button
        className="client-account-logout"
        type="button"
        onClick={
          onLogout
        }
      >
        <LogOut
          size={15}
        />

        <span>
          Keluar dari akun
        </span>
      </button>
    </section>
  );
}
