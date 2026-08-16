import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Headphones,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Mic2,
  Music2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import {
  formatRupiah,
  getPackageOptions,
  getRecordingTypeOptions,
  getSessionOptions,
  resolveBookingPricing,
  usePricingSettings,
} from '../settings/pricingSettings.js';
import { useInvoiceSettings } from '../settings/invoiceSettings.js';
import { businessHours, durationOptions } from '../constants/scheduleConfig.js';
import StudioSelect from '../components/ui/StudioSelect.jsx';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase.js';
import { adminBookingRepository } from '../services/adminBookingRepository.js';
import { syncClientCustomerProfile } from '../services/clientProfileRepository.js';
import { accountRoleRepository } from '../services/accountRoleRepository.js';
import { PORTAL_ACCESS } from '../utils/accountRoles.js';
import '../styles/routes/client.css';
import '../styles/client-landing.css';

const SERVICE_STORIES = [
  {
    description: 'Full-band rehearsal dengan backline siap pakai dan ruang yang tetap nyaman untuk sesi panjang.',
    icon: Music2,
    index: '01',
    label: 'Rehearsal',
    title: 'Latihan tanpa kehilangan momentum.',
  },
  {
    description: 'Tracking vokal dan instrumen dalam ruang yang dirancang agar setiap detail tetap terdengar.',
    icon: Mic2,
    index: '02',
    label: 'Recording',
    title: 'Tangkap performa terbaik Anda.',
  },
  {
    description: 'Mixing dan mastering untuk membawa materi mentah menjadi karya yang siap diperdengarkan.',
    icon: SlidersHorizontal,
    index: '03',
    label: 'Post production',
    title: 'Buat karya terasa selesai.',
  },
];

function formatPublicDate(value) {
  if (!value) return 'Tanggal menyusul';

  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getBookingStatus(booking) {
  const status = String(booking?.requestStatus || booking?.status || 'submitted').toLowerCase();

  if (['confirmed', 'approved'].includes(status)) return { label: 'Dikonfirmasi', tone: 'success' };
  if (['cancelled', 'rejected'].includes(status)) return { label: 'Dibatalkan', tone: 'danger' };

  return { label: 'Menunggu', tone: 'warning' };
}

export default function ClientLandingPage() {
  const navigate = useNavigate();
  const pricingSettings = usePricingSettings();
  const invoiceSettings = useInvoiceSettings();

  const [authLoading, setAuthLoading] = useState(() => Boolean(firebaseAuth));
  const [currentUser, setCurrentUser] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [plannerMode, setPlannerMode] = useState('regular');
  const [sessionType, setSessionType] = useState('rehearsal');
  const [recordingTypeId, setRecordingTypeId] = useState('none');
  const [packageId, setPackageId] = useState('none');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startHour, setStartHour] = useState('10');
  const [duration, setDuration] = useState('2');
  const [customDuration, setCustomDuration] = useState('');

  useEffect(() => {
    if (!firebaseAuth) {
      return undefined;
    }

    let checkSequence = 0;

    return onAuthStateChanged(firebaseAuth, async (user) => {
      const currentSequence = ++checkSequence;

      if (!user) {
        setCurrentUser(null);
        setAuthLoading(false);
        return;
      }

      try {
        const result = await accountRoleRepository.resolvePortalAccount(user, 'client');
        if (currentSequence !== checkSequence) return;

        if (result.access !== PORTAL_ACCESS.ALLOWED) {
          setCurrentUser(null);
          return;
        }

        setCurrentUser(user);

        try {
          await syncClientCustomerProfile(user);
        } catch (profileError) {
          console.error('Role client valid, tetapi profil customer belum tersinkron:', profileError);
        }
      } catch (error) {
        console.error('Gagal memeriksa role akun di landing client:', error);
        if (currentSequence === checkSequence) setCurrentUser(null);
      } finally {
        if (currentSequence === checkSequence) setAuthLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;

    return adminBookingRepository.subscribeClientBookingsForUser(
      currentUser,
      (bookingsList) => setUserBookings(bookingsList),
      (error) => console.error('Error fetching client booking history:', error)
    );
  }, [currentUser]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen]);

  const sessionOptions = useMemo(() => getSessionOptions(pricingSettings), [pricingSettings]);
  const recordingTypeOptions = useMemo(() => getRecordingTypeOptions(pricingSettings), [pricingSettings]);
  const packageOptions = useMemo(() => getPackageOptions(pricingSettings), [pricingSettings]);

  const startHourOptions = useMemo(() => businessHours.map((hour) => ({
    description: 'Jam mulai sesi',
    key: hour.key,
    label: hour.rangeLabel,
  })), []);

  const displayedSessionOptions = useMemo(() => {
    const options = [];

    sessionOptions.forEach((session) => {
      if (session.key === 'recording' && recordingTypeOptions.length) {
        recordingTypeOptions.forEach((recordingType) => options.push({
          ...recordingType,
          description: `Recording · ${recordingType.durationHours || 1} jam`,
          isRecordingType: true,
        }));
        return;
      }

      options.push(session);
    });

    return options;
  }, [recordingTypeOptions, sessionOptions]);

  const selectedServiceKey = recordingTypeId !== 'none' ? recordingTypeId : sessionType;

  const actualDuration = useMemo(() => {
    if (plannerMode === 'package' && packageId !== 'none') {
      const selectedPackage = pricingSettings.packages?.find((item) => item.id === packageId);
      return Math.max(0, Number(selectedPackage?.durationHours) || 0);
    }

    if (duration === 'custom') return Math.max(1, Number(customDuration) || 1);
    return Number(duration) || 2;
  }, [customDuration, duration, packageId, plannerMode, pricingSettings.packages]);

  const pricingBreakdown = useMemo(() => resolveBookingPricing({
    customDurationHours: duration === 'custom' ? Number(customDuration) : 0,
    dpAmount: 0,
    durationHours: Number(duration) || 0,
    packageId: plannerMode === 'package' ? packageId : 'none',
    paymentStatus: 'pending',
    pricingSettings,
    recordingTypeId,
    sessionId: sessionType,
  }), [customDuration, duration, packageId, plannerMode, pricingSettings, recordingTypeId, sessionType]);

  const startingPrice = useMemo(() => {
    const prices = sessionOptions
      .map((option) => Number(option.price))
      .filter((price) => Number.isFinite(price) && price > 0);

    return prices.length ? Math.min(...prices) : 100000;
  }, [sessionOptions]);

  const latestBookings = useMemo(() => userBookings.slice(0, 3), [userBookings]);
  const studioName = invoiceSettings.studioName || '37 Music Studio';
  const studioAddress = invoiceSettings.address || 'Lokasi studio tersedia setelah konfirmasi booking.';
  const studioPhone = invoiceSettings.phone || 'Hubungi admin melalui portal booking.';

  function handleServiceChange(value) {
    const selected = displayedSessionOptions.find((option) => option.key === value);

    if (selected?.isRecordingType) {
      setSessionType('recording');
      setRecordingTypeId(value);
      return;
    }

    setSessionType(value);
    setRecordingTypeId('none');
  }

  function handlePlannerMode(mode) {
    setPlannerMode(mode);

    if (mode === 'regular') setPackageId('none');
    if (mode === 'package' && packageId === 'none' && packageOptions[0]?.key) {
      setPackageId(packageOptions[0].key);
    }
  }

  function handleBookingAction(event) {
    event.preventDefault();
    navigate('/book');
  }

  async function handleLogout() {
    if (!firebaseAuth) return;

    try {
      await signOut(firebaseAuth);
      navigate('/client/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  return (
    <div className="client-landing-page">
      <a className="client-landing-skip-link" href="#main-content">Lewati ke konten</a>

      <header className="client-landing-header">
        <a className="client-landing-brand" href="#top" aria-label="37 Music Studio, kembali ke atas">
          <span className="client-landing-brand-mark">37</span>
          <span className="client-landing-brand-lockup">
            <strong>Music Studio</strong>
            <small>Rehearse · Record · Release</small>
          </span>
        </a>

        <nav className={`client-landing-nav ${isMenuOpen ? 'is-open' : ''}`} aria-label="Navigasi utama">
          <a href="#services" className="client-landing-nav-link" onClick={() => setIsMenuOpen(false)}>Studio</a>
          <a href="#pricelist" className="client-landing-nav-link" onClick={() => setIsMenuOpen(false)}>Harga</a>
          <a href="/book" className="client-landing-nav-link">Booking Slot</a>
          <a href="#location" className="client-landing-nav-link" onClick={() => setIsMenuOpen(false)}>Lokasi</a>
        </nav>

        <div className="client-landing-header-actions">
          {currentUser ? (
            <>
              <button className="client-landing-header-link" type="button" onClick={() => navigate('/client/portal')}>
                Portal Saya
              </button>
              <button className="client-landing-icon-button" type="button" aria-label="Keluar akun" onClick={handleLogout}>
                <LogOut size={17} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              className="client-landing-header-link"
              disabled={authLoading}
              type="button"
              onClick={() => navigate('/client/login')}
            >
              {authLoading ? <LoaderCircle className="client-landing-spin" size={15} /> : <LogIn size={15} />}
              Masuk
            </button>
          )}

          <button
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
            className="client-landing-menu-button"
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <main id="main-content">
        <section className="client-landing-hero" id="top">
          <img
            alt="Control room 37 Music Studio dengan console, monitor, dan instrumen"
            className="client-landing-hero-image"
            src="/images/studio_hero_banner.png"
          />
          <div className="client-landing-hero-shade" aria-hidden="true" />

          <div className="client-landing-hero-content">
            <span className="client-landing-kicker"><Sparkles size={14} /> Bekasi · Open daily</span>
            <p className="client-landing-hero-brand">37 Music Studio</p>
            <h1>Ruang untuk suara yang serius.</h1>
            <p className="client-landing-hero-copy">
              Rehearsal, recording, mixing, dan mastering dalam satu studio yang siap mengikuti ritme karya Anda.
            </p>
            <div className="client-landing-hero-actions">
              <a href="/book" className="client-landing-button is-primary">
                Lihat slot kosong
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a className="client-landing-button is-quiet" href="#services">
                Jelajahi studio
                <ChevronRight size={17} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="client-landing-hero-meta" aria-label="Informasi studio">
            <span><Clock3 size={16} /> 10.00—23.00 WIB</span>
            <span><Headphones size={16} /> Rehearsal & recording</span>
            <span><ShieldCheck size={16} /> Booking terverifikasi</span>
          </div>
        </section>

        <section className="client-landing-intro" aria-labelledby="client-intro-title">
          <div className="client-landing-section-index">The studio</div>
          <div>
            <h2 id="client-intro-title">Datang membawa ide.<br />Pulang membawa progres.</h2>
          </div>
          <p>
            Dari latihan pertama sampai final master, setiap sesi dibuat sederhana: pilih kebutuhan, temukan slot, lalu fokus bermusik.
          </p>
        </section>

        <section className="client-landing-services" id="services" aria-labelledby="client-services-title">
          <header className="client-landing-section-heading">
            <span>01 / Services</span>
            <h2 id="client-services-title">Satu ruang.<br />Tiga cara berkarya.</h2>
          </header>

          <div className="client-landing-service-list">
            {SERVICE_STORIES.map(({ description, icon: Icon, index, label, title }) => (
              <article className="client-landing-service" key={label}>
                <span className="client-landing-service-number">{index}</span>
                <span className="client-landing-service-icon"><Icon size={22} /></span>
                <div>
                  <small>{label}</small>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <a href="#pricelist" aria-label={`Lihat estimasi harga ${label}`}>
                  <ArrowRight size={19} aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="client-landing-planner" id="pricelist" aria-labelledby="client-planner-title">
          <div className="client-landing-planner-story">
            <span>02 / Plan your session</span>
            <h2 id="client-planner-title">Harga transparan sebelum Anda datang.</h2>
            <p>Pilih format sesi untuk melihat estimasi. Slot dan total akhir dikonfirmasi di alur booking.</p>

            <div className="client-landing-starting-price">
              <small>Mulai dari</small>
              <strong>{formatRupiah(startingPrice)}</strong>
              <span>/ jam</span>
            </div>

            <ul className="client-landing-proof-list">
              <li><Check size={16} /> Tidak ada biaya tersembunyi</li>
              <li><Check size={16} /> Slot diperiksa realtime</li>
              <li><Check size={16} /> Konfirmasi tercatat di portal</li>
            </ul>
          </div>

          <form className="client-landing-planner-form" onSubmit={handleBookingAction}>
            <div className="client-landing-segmented" aria-label="Mode harga">
              <button
                className={plannerMode === 'regular' ? 'is-active' : ''}
                type="button"
                onClick={() => handlePlannerMode('regular')}
              >
                Sewa reguler
              </button>
              <button
                className={plannerMode === 'package' ? 'is-active' : ''}
                type="button"
                onClick={() => handlePlannerMode('package')}
              >
                Pilih paket
              </button>
            </div>

            <div className="client-landing-form-grid">
              {plannerMode === 'regular' ? (
                <div className="client-landing-field is-wide">
                  <StudioSelect
                    label="Layanan"
                    options={displayedSessionOptions}
                    selectedKey={selectedServiceKey}
                    onChange={handleServiceChange}
                  />
                </div>
              ) : (
                <div className="client-landing-field is-wide">
                  <StudioSelect
                    label="Paket sesi"
                    options={packageOptions}
                    selectedKey={packageId}
                    onChange={setPackageId}
                  />
                </div>
              )}

              <label className="client-landing-field">
                <span>Tanggal</span>
                <input min={new Date().toISOString().split('T')[0]} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>

              <div className="client-landing-field">
                <StudioSelect
                  label="Jam mulai"
                  options={startHourOptions}
                  selectedKey={startHour}
                  onChange={setStartHour}
                />
              </div>

              {plannerMode === 'regular' ? (
                <div className="client-landing-field is-wide">
                  <StudioSelect
                    label="Durasi"
                    options={durationOptions}
                    selectedKey={duration}
                    onChange={setDuration}
                  />
                </div>
              ) : null}

              {plannerMode === 'regular' && duration === 'custom' ? (
                <label className="client-landing-field is-wide">
                  <span>Durasi khusus</span>
                  <input min="1" step="1" type="number" value={customDuration} onChange={(event) => setCustomDuration(event.target.value)} />
                </label>
              ) : null}
            </div>

            <div className="client-landing-estimate">
              <div>
                <small>Estimasi {actualDuration ? `· ${actualDuration} jam` : ''}</small>
                <strong>{formatRupiah(pricingBreakdown.total)}</strong>
              </div>
              {pricingBreakdown.discountAmount > 0 ? (
                <span>Hemat {formatRupiah(pricingBreakdown.discountAmount)}</span>
              ) : (
                <span>Belum termasuk add-on</span>
              )}
            </div>

            <button className="client-landing-planner-submit" type="submit">
              PILIH SLOT TERSEDIA
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
        </section>

        <section className="client-landing-process" aria-labelledby="client-process-title">
          <header className="client-landing-section-heading is-light">
            <span>03 / How it works</span>
            <h2 id="client-process-title">Dari ide ke sesi<br />dalam tiga langkah.</h2>
          </header>

          <ol className="client-landing-process-list">
            <li><span>01</span><strong>Pilih waktu</strong><p>Lihat kalender publik dan temukan slot yang masih tersedia.</p></li>
            <li><span>02</span><strong>Kirim request</strong><p>Masuk atau buat akun untuk mengunci detail permintaan booking.</p></li>
            <li><span>03</span><strong>Datang & berkarya</strong><p>Pantau konfirmasi, pembayaran, dan detail sesi dari Portal Client.</p></li>
          </ol>
        </section>

        <section className="client-landing-client-space" id="history" aria-labelledby="client-space-title">
          <div>
            <span>04 / Your sessions</span>
            <h2 id="client-space-title">Semua sesi Anda, tetap mudah ditemukan.</h2>
            <p>Jadwal aktif, status request, dan riwayat booking tersimpan dalam satu Portal Client.</p>
            <button className="client-landing-text-action" type="button" onClick={() => navigate(currentUser ? '/client/portal' : '/client/login')}>
              {currentUser ? 'Buka Portal Saya' : 'Masuk ke Portal Client'}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="client-landing-session-preview">
            {currentUser && latestBookings.length ? latestBookings.map((booking) => {
              const status = getBookingStatus(booking);

              return (
                <button key={booking.id} type="button" onClick={() => navigate('/client/portal')}>
                  <span className={`client-landing-booking-status is-${status.tone}`}>{status.label}</span>
                  <strong>{booking.serviceName || booking.sessionName || booking.sessionType || 'Studio session'}</strong>
                  <small>{formatPublicDate(booking.date || booking.bookingDate)} · {booking.startTime || booking.startHour || 'Waktu menyusul'}</small>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              );
            }) : (
              <div className="client-landing-session-empty">
                <CalendarDays size={26} aria-hidden="true" />
                <strong>{currentUser ? 'Belum ada sesi aktif' : 'Portal siap saat Anda booking'}</strong>
                <p>{currentUser
                  ? 'Pilih slot pertama Anda dan semua detailnya akan muncul di sini.'
                  : 'Login hanya diperlukan saat Anda siap mengirim request booking.'}</p>
              </div>
            )}
          </div>
        </section>

        <section className="client-landing-location" id="location" aria-labelledby="client-location-title">
          <div className="client-landing-location-heading">
            <span>05 / Visit</span>
            <h2 id="client-location-title">Temukan ruang<br />untuk sesi berikutnya.</h2>
          </div>

          <div className="client-landing-location-details">
            <div><MapPin size={19} /><span><small>Studio</small><strong>{studioAddress}</strong></span></div>
            <div><MessageCircle size={19} /><span><small>Kontak</small><strong>{studioPhone}</strong></span></div>
            <div><Clock3 size={19} /><span><small>Jam operasional</small><strong>Setiap hari · 10.00—23.00 WIB</strong></span></div>
          </div>
        </section>

        <section className="client-landing-final-cta" aria-labelledby="client-final-title">
          <Volume2 size={28} aria-hidden="true" />
          <p>{studioName}</p>
          <h2 id="client-final-title">Sesi yang bagus dimulai<br />dari slot yang tepat.</h2>
          <a className="client-landing-final-action" href="/book">
            Mulai booking
            <ArrowRight size={20} aria-hidden="true" />
          </a>
        </section>
      </main>

      <footer className="client-landing-footer">
        <div className="client-landing-brand is-footer">
          <span className="client-landing-brand-mark">37</span>
          <span className="client-landing-brand-lockup"><strong>Music Studio</strong><small>Built for musicians</small></span>
        </div>
        <p>© {new Date().getFullYear()} {studioName}. All rights reserved.</p>
        <a href="#top">Kembali ke atas <ArrowRight size={15} /></a>
      </footer>
    </div>
  );
}
