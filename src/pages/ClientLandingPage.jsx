import '../styles/routes/client.css';
import '../styles/client-landing.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useScroll,
} from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Disc3,
  Headphones,
  MapPin,
  Menu,
  MessageCircle,
  Mic2,
  Music2,
  Phone,
  ShieldCheck,
  Sliders,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { NumberTicker } from '../components/magicui/number-ticker.jsx';
import StudioSelect from '../components/ui/StudioSelect.jsx';
import StudioAtmosphereShowcase from '../components/landing/StudioAtmosphereShowcase.jsx';
import StudioVibeAudioControl from '../components/landing/StudioVibeAudioControl.jsx';
import LandingFaqSection from '../components/landing/LandingFaqSection.jsx';
import {
  BOOKING_PROCESS_STEPS,
  CREATIVE_AUDIENCES,
  SERVICE_METADATA_BY_KEY,
  STUDIO_HERO_PHOTO,
  buildLandingFaqItems,
  buildWhatsAppHref,
  cleanStudioInfoValue,
  formatHourClock,
  formatHourRange,
  formatIndonesianDateLabel,
  formatOperationalHoursLabel,
  formatStartHourOptionLabel,
  getFormattedPaymentTermsList,
  getOccupiedHoursForDate,
} from '../components/landing/landingData.js';
import { businessHours, durationOptions } from '../constants/scheduleConfig.js';
import { firebaseAuth, isFirebaseConfigured } from '../lib/firebase.js';
import { accountRoleRepository } from '../services/accountRoleRepository.js';
import { adminBookingRepository } from '../services/adminBookingRepository.js';
import { useInvoiceSettings } from '../settings/invoiceSettings.js';
import {
  formatRupiah,
  getPackageOptions,
  getRecordingTypeOptions,
  getSessionOptions,
  isRecordingSessionId,
  resolveBookingPricing,
  usePricingSettings,
} from '../settings/pricingSettings.js';
import {
  formatBankAccountNumber,
  getStudioPaymentTerms,
  mergeStudioSettingsIntoInvoiceSettings,
  resolveLandingAtmosphereSpots,
  resolveLandingExtraGalleryItems,
  resolveLandingHeroMedia,
  useStudioSettings,
} from '../settings/studioSettings.js';
import { BOOKING_REQUEST_STATUS_META } from '../domain/booking/bookingStatus.js';
import { getBookingRequestStatus } from '../domain/booking/bookingSelectors.js';
import { isAdminPortalAccount, isClientAccount } from '../utils/accountRoles.js';
import { getLocalDateKey } from '../utils/publicBookingSelection.js';

function getServiceIcon(sessionKey) {
  switch (String(sessionKey || '').toLowerCase()) {
    case 'rehearsal':
      return Music2;
    case 'recording':
      return Mic2;
    case 'mixing':
      return Sliders;
    case 'mastering':
      return Disc3;
    default:
      return Headphones;
  }
}

export default function ClientLandingPage() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  const pricingSettings = usePricingSettings();
  const invoiceSettings = useInvoiceSettings();
  const studioSettings = useStudioSettings();

  const resolvedStudioInfo = useMemo(
    () => mergeStudioSettingsIntoInvoiceSettings(invoiceSettings, studioSettings),
    [invoiceSettings, studioSettings],
  );
  const studioName = cleanStudioInfoValue(resolvedStudioInfo.studioName) || '37 Music Studio';
  const studioAddress = cleanStudioInfoValue(resolvedStudioInfo.address);
  const studioPhone = cleanStudioInfoValue(resolvedStudioInfo.phone);
  const studioBankName = cleanStudioInfoValue(resolvedStudioInfo.bankName);
  const studioQrisLabel = cleanStudioInfoValue(resolvedStudioInfo.qrisLabel);
  const paymentTermsList = useMemo(
    () => getFormattedPaymentTermsList(getStudioPaymentTerms(studioSettings)),
    [studioSettings],
  );
  const heroMedia = useMemo(
    () => resolveLandingHeroMedia(studioSettings),
    [studioSettings],
  );
  const atmosphereSpots = useMemo(
    () => resolveLandingAtmosphereSpots(studioSettings),
    [studioSettings],
  );
  const extraGalleryPhotos = useMemo(
    () => resolveLandingExtraGalleryItems(studioSettings),
    [studioSettings],
  );
  const whatsappHref = useMemo(
    () => buildWhatsAppHref(studioName, studioPhone),
    [studioName, studioPhone],
  );

  const sessionOptions = useMemo(
    () => getSessionOptions(pricingSettings),
    [pricingSettings],
  );
  const recordingTypeOptions = useMemo(
    () => getRecordingTypeOptions(pricingSettings),
    [pricingSettings],
  );
  const packageOptions = useMemo(
    () => getPackageOptions(pricingSettings),
    [pricingSettings],
  );
  const hasPackages = packageOptions.length > 0;

  const todayKey = useMemo(() => getLocalDateKey(), []);
  const startHours = useMemo(
    () =>
      Array.isArray(businessHours)
        ? businessHours
          .map((item) => Number(item?.start ?? item?.key ?? item?.value))
          .filter(Number.isFinite)
        : [],
    [],
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [isHeaderElevated, setIsHeaderElevated] = useState(false);
  const [showMobileStickyCta, setShowMobileStickyCta] = useState(false);

  const [plannerMode, setPlannerMode] = useState('regular');
  const [selectedService, setSelectedService] = useState(() => sessionOptions[0]?.key || 'rehearsal');
  const [selectedPackageId, setSelectedPackageId] = useState(() => packageOptions[0]?.key || 'none');
  const [selectedRecordingTypeId, setSelectedRecordingTypeId] = useState(
    () => recordingTypeOptions[0]?.key || 'none',
  );
  const [date, setDate] = useState(() => todayKey);
  const [startHour, setStartHour] = useState(() => String(startHours[0] ?? 10));
  const [duration, setDuration] = useState('2');
  const [bookingSelectionError, setBookingSelectionError] = useState('');

  const [publicSlots, setPublicSlots] = useState([]);
  const [publicSlotsLoaded, setPublicSlotsLoaded] = useState(false);

  const [authUser, setAuthUser] = useState(null);
  const [accountIdentity, setAccountIdentity] = useState(null);
  const [userBookings, setUserBookings] = useState([]);

  const menuButtonRef = useRef(null);
  const plannerSectionRef = useRef(null);
  const hasUserPickedHourRef = useRef(false);

  const activeServiceKey = useMemo(() => {
    if (sessionOptions.some((item) => item.key === selectedService)) {
      return selectedService;
    }
    return sessionOptions[0]?.key || 'rehearsal';
  }, [selectedService, sessionOptions]);

  const activePackageId = useMemo(() => {
    if (!hasPackages) return 'none';
    if (packageOptions.some((item) => item.key === selectedPackageId)) {
      return selectedPackageId;
    }
    return packageOptions[0]?.key || 'none';
  }, [hasPackages, packageOptions, selectedPackageId]);

  const activeRecordingTypeId = useMemo(() => {
    if (recordingTypeOptions.some((item) => item.key === selectedRecordingTypeId)) {
      return selectedRecordingTypeId;
    }
    return recordingTypeOptions[0]?.key || 'none';
  }, [recordingTypeOptions, selectedRecordingTypeId]);

  const isPackageMode = plannerMode === 'package' && hasPackages;
  const isRecordingSelected = !isPackageMode && isRecordingSessionId(activeServiceKey);
  const showRecordingTypeSelect = isRecordingSelected && recordingTypeOptions.length > 0;
  const isRecordingCustomRate = isRecordingSelected && recordingTypeOptions.length === 0;

  const estimatedPricing = useMemo(
    () =>
      resolveBookingPricing({
        customDurationHours: 0,
        durationHours: Math.max(1, Number(duration) || 1),
        packageId: isPackageMode ? activePackageId : 'none',
        paymentStatus: 'pending',
        pricingSettings,
        recordingTypeId: showRecordingTypeSelect ? activeRecordingTypeId : 'none',
        sessionId: activeServiceKey,
      }),
    [
      activePackageId,
      activeRecordingTypeId,
      activeServiceKey,
      duration,
      isPackageMode,
      pricingSettings,
      showRecordingTypeSelect,
    ],
  );

  const startingHourlyPrice = useMemo(() => {
    const pricedSessions = sessionOptions
      .map((item) => Number(item.pricePerHour ?? item.price ?? 0))
      .filter((amount) => Number.isFinite(amount) && amount > 0);
    if (pricedSessions.length > 0) {
      return Math.min(...pricedSessions);
    }
    return 100000;
  }, [sessionOptions]);

  const todayOccupiedHours = useMemo(
    () => getOccupiedHoursForDate(publicSlots, todayKey),
    [publicSlots, todayKey],
  );
  const selectedDateOccupiedHours = useMemo(
    () => getOccupiedHoursForDate(publicSlots, date),
    [publicSlots, date],
  );

  const todayAvailableCount = useMemo(
    () => Math.max(0, startHours.length - todayOccupiedHours.size),
    [startHours.length, todayOccupiedHours],
  );
  const selectedDateAvailableCount = useMemo(
    () => Math.max(0, startHours.length - selectedDateOccupiedHours.size),
    [startHours.length, selectedDateOccupiedHours],
  );

  const startHourSelectOptions = useMemo(
    () =>
      startHours.map((hour) => ({
        key: String(hour),
        label: formatStartHourOptionLabel(hour, selectedDateOccupiedHours.has(hour)),
      })),
    [selectedDateOccupiedHours, startHours],
  );

  const regularDurationOptions = useMemo(
    () =>
      durationOptions
        .filter((item) => Number(item.key ?? item.value) > 0)
        .map((item) => ({
          key: String(item.key ?? item.value),
          label: item.label,
        })),
    [],
  );

  const faqItems = useMemo(
    () =>
      buildLandingFaqItems({
        studioName,
        resolvedContact: resolvedStudioInfo,
        pricingSettings,
        sessionOptions,
        packageOptions,
      }),
    [packageOptions, pricingSettings, resolvedStudioInfo, sessionOptions, studioName],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function handleScroll() {
      const y = window.scrollY || 0;
      setIsHeaderElevated(y > 24);
      setShowMobileStickyCta(y > 320);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen || typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return undefined;
    }

    const horizonDate = new Date();
    horizonDate.setDate(horizonDate.getDate() + 14);
    const endDate = getLocalDateKey(horizonDate);

    return adminBookingRepository.subscribeClientCalendarSlots(
      {
        startDate: todayKey,
        endDate,
        limitCount: 250,
      },
      (slots) => {
        const nextSlots = Array.isArray(slots) ? slots : [];
        setPublicSlots(nextSlots);
        setPublicSlotsLoaded(true);

        if (!hasUserPickedHourRef.current) {
          const occupiedToday = getOccupiedHoursForDate(nextSlots, todayKey);
          const firstOpenHour = startHours.find((hour) => !occupiedToday.has(hour));
          if (firstOpenHour !== undefined) {
            setStartHour((prev) => (occupiedToday.has(Number(prev)) ? String(firstOpenHour) : prev));
          }
        }
      },
      () => {
        setPublicSlots([]);
        setPublicSlotsLoaded(false);
      },
    );
  }, [startHours, todayKey]);

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      return undefined;
    }

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setAuthUser(nextUser || null);
      if (!nextUser) {
        setAccountIdentity(null);
        setUserBookings([]);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !authUser?.uid) {
      return undefined;
    }

    return accountRoleRepository.subscribeAccountIdentity(
      authUser,
      (identity) => {
        setAccountIdentity(identity || null);
        if (!isClientAccount(identity)) {
          setUserBookings([]);
        }
      },
      () => {
        setAccountIdentity(null);
        setUserBookings([]);
      },
    );
  }, [authUser]);

  useEffect(() => {
    if (!isFirebaseConfigured || !authUser?.uid || !isClientAccount(accountIdentity)) {
      return undefined;
    }

    return adminBookingRepository.subscribeClientBookingsForUser(
      authUser,
      (bookings) => {
        setUserBookings(Array.isArray(bookings) ? bookings : []);
      },
      () => {
        setUserBookings([]);
      },
    );
  }, [accountIdentity, authUser]);

  function handleNavigationLinkClick(event) {
    const href = event.currentTarget?.getAttribute('href') || '';
    setMenuOpen(false);
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }

    if (href.startsWith('#')) {
      event.preventDefault();
      const target = document.getElementById(href.slice(1));
      if (target) {
        if (window.location.hash !== href) {
          window.history.pushState(null, '', href);
        }
        target.scrollIntoView({
          behavior: shouldReduceMotion ? 'auto' : 'smooth',
          block: 'start',
        });
        target.focus({ preventScroll: true });
      }
      return;
    }

    if (href.startsWith('/')) {
      event.preventDefault();
      navigate(href);
    }
  }

  function handleModeChange(mode) {
    if (mode === 'package' && !hasPackages) return;
    setPlannerMode(mode);
    setBookingSelectionError('');
  }

  function handleServiceShortcut(sessionKey) {
    setPlannerMode('regular');
    setSelectedService(sessionKey);
    setBookingSelectionError('');
    const plannerEl = plannerSectionRef.current || document.getElementById('pricelist');
    if (plannerEl) {
      plannerEl.scrollIntoView({
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      plannerEl.focus({ preventScroll: true });
    }
  }

  function handlePackageShortcut(packageKey) {
    if (!hasPackages) return;
    setPlannerMode('package');
    setSelectedPackageId(packageKey);
    setBookingSelectionError('');
    const plannerEl = plannerSectionRef.current || document.getElementById('pricelist');
    if (plannerEl) {
      plannerEl.scrollIntoView({
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      plannerEl.focus({ preventScroll: true });
    }
  }

  function handlePlannerSubmit(event) {
    event.preventDefault();

    if (!date || !startHour) {
      setBookingSelectionError('Pilih tanggal dan jam mulai terlebih dahulu sebelum melanjutkan.');
      return;
    }

    setBookingSelectionError('');
    const params = new URLSearchParams();
    params.set('date', date);
    params.set('startHour', startHour);
    navigate('/book?' + params.toString());
  }

  const sectionMotionProps = shouldReduceMotion
    ? {}
    : {
      initial: { opacity: 1, y: 12 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, amount: 0.02 },
      transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
    };

  const activeRoleIsClient = isClientAccount(accountIdentity);
  const activeRoleIsStaff = isAdminPortalAccount(accountIdentity);
  const operationalWindowLabel = formatOperationalHoursLabel();
  const formattedBankNumber = cleanStudioInfoValue(
    formatBankAccountNumber(resolvedStudioInfo.bankAccountNumber),
  );
  const paymentChannelSummary = [studioBankName, formattedBankNumber, studioQrisLabel]
    .filter(Boolean)
    .join(' · ');

  const selectedStartNumeric = Number(startHour);
  const selectedEndNumeric =
    selectedStartNumeric + Math.max(1, Number(estimatedPricing.durationHours || duration || 1));
  const selectedTimeWindowLabel = formatHourRange(selectedStartNumeric, selectedEndNumeric);
  const activeServiceOption =
    sessionOptions.find((item) => item.key === activeServiceKey) || sessionOptions[0];
  const activePackageOption =
    packageOptions.find((item) => item.key === activePackageId) || packageOptions[0];

  const recentClientBookings = useMemo(() => {
    if (!Array.isArray(userBookings) || userBookings.length === 0) return [];
    return [...userBookings]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 3);
  }, [userBookings]);

  return (
    <div className="client-landing-page">
      <a href="#main-content" className="client-landing-skip-link">
        Lewati ke konten utama
      </a>

      <motion.div
        aria-hidden="true"
        className="client-landing-scroll-progress"
        style={{ scaleX: shouldReduceMotion ? 0 : scrollYProgress }}
      />

      <header
        className={`client-landing-header${isHeaderElevated ? ' is-elevated' : ''}`}
      >
        <div className="client-landing-header-inner">
          <a href="#top" className="client-landing-brand" onClick={handleNavigationLinkClick}>
            <span className="client-landing-brand-badge" aria-hidden="true">
              37
            </span>
            <span className="client-landing-brand-text">
              <strong className="client-landing-brand-wordmark">STUDIO</strong>
              <span>{studioName}</span>
            </span>
          </a>

          <div className="client-landing-header-actions">
            <a
              href="/book"
              className="client-landing-header-quick-cta"
              onClick={handleNavigationLinkClick}
            >
              Cek Slot
            </a>

            <button
              ref={menuButtonRef}
              type="button"
              className="client-landing-menu-button"
              aria-controls="client-landing-navigation"
              aria-expanded={menuOpen ? 'true' : 'false'}
              aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              <span>{menuOpen ? 'Tutup' : 'Menu'}</span>
            </button>
          </div>

          <AnimatePresence>
            {menuOpen ? (
              <motion.button
                key="nav-backdrop"
                type="button"
                aria-label="Tutup menu navigasi"
                className="client-landing-menu-backdrop"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setMenuOpen(false)}
              />
            ) : null}
          </AnimatePresence>

          <nav
            id="client-landing-navigation"
            aria-label="Navigasi utama"
            className={`client-landing-nav${menuOpen ? ' is-open' : ''}`}
          >
            <div className="client-landing-nav-links">
              <a
                href="#services"
                className="client-landing-nav-link"
                onClick={handleNavigationLinkClick}
              >
                Studio & Layanan
              </a>
              <a
                href="#atmosphere"
                className="client-landing-nav-link"
                onClick={handleNavigationLinkClick}
              >
                Suasana
              </a>
              <a
                href="#pricelist"
                className="client-landing-nav-link"
                onClick={handleNavigationLinkClick}
              >
                Estimasi Harga
              </a>
              <a
                href="#faq"
                className="client-landing-nav-link"
                onClick={handleNavigationLinkClick}
              >
                FAQ
              </a>
              <a
                href="#location"
                className="client-landing-nav-link"
                onClick={handleNavigationLinkClick}
              >
                Kontak
              </a>
              <a href="/book" className="client-landing-nav-link" onClick={handleNavigationLinkClick}>Booking Slot</a>
            </div>

            <div className="client-landing-nav-utilities">
              <a
                href={
                  activeRoleIsStaff
                    ? '/admin'
                    : activeRoleIsClient
                      ? '/client/portal'
                      : '/client/login'
                }
                className="client-landing-nav-portal"
                onClick={handleNavigationLinkClick}
              >
                <UserRound size={15} aria-hidden="true" />
                <span>
                  {activeRoleIsStaff
                    ? 'Admin Workspace'
                    : activeRoleIsClient
                      ? 'Client Portal'
                      : 'Masuk Client'}
                </span>
              </a>
            </div>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section id="top" className="client-landing-hero" aria-labelledby="hero-headline">
          <div className="client-landing-hero-backdrop" aria-hidden="true" />

          <div className="client-landing-container client-landing-hero-grid">
            <motion.div
              className="client-landing-hero-copy"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="client-landing-hero-pills">
                <span className="client-landing-status-pill">
                  <span className="client-landing-status-dot" aria-hidden="true" />
                  Buka Setiap Hari · {operationalWindowLabel}
                </span>
                {studioAddress ? (
                  <span className="client-landing-address-pill">
                    <MapPin size={13} aria-hidden="true" />
                    {studioAddress}
                  </span>
                ) : null}
              </div>

              <h1 id="hero-headline" className="client-landing-hero-title">
                Ruang musik untuk{' '}
                <span className="client-landing-title-accent">latih, rekam,</span>{' '}
                dan matangkan karya.
              </h1>

              <p className="client-landing-hero-subtitle">
                Dari latihan band rutin hingga sesi recording, mixing, dan mastering.
                Cek slot kosong secara langsung tanpa wajib login, hitung estimasi biaya,
                lalu kunci jadwal studio dalam hitungan detik.
              </p>

              <div className="client-landing-hero-cta-group">
                <a href="/book" className="client-landing-button is-primary">
                  <span>Cek Jadwal &amp; Booking</span>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>

                <a
                  href="#services"
                  className="client-landing-button is-ghost"
                  onClick={handleNavigationLinkClick}
                >
                  <span>Lihat Layanan &amp; Tarif</span>
                </a>
              </div>

              <div className="client-landing-hero-metrics" aria-label="Ringkasan informasi studio">
                <div className="client-landing-metric-card">
                  <span className="client-landing-metric-label">Tarif Sesi Mulai</span>
                  <strong className="client-landing-metric-value">
                    Rp{' '}
                    <NumberTicker
                      value={startingHourlyPrice}
                      className="client-landing-metric-ticker"
                    />
                    <span>/jam</span>
                  </strong>
                </div>

                <div className="client-landing-metric-card">
                  <span className="client-landing-metric-label">Ketersediaan Hari Ini</span>
                  <strong className="client-landing-metric-value">
                    {publicSlotsLoaded
                      ? `${todayAvailableCount} dari ${startHours.length} jam`
                      : `${startHours.length} blok jam/hari`}
                  </strong>
                </div>

                <div className="client-landing-metric-card">
                  <span className="client-landing-metric-label">Akses Kalender Publik</span>
                  <strong className="client-landing-metric-value">
                    {activeRoleIsClient ? 'Client Portal Siap' : 'Cek Tanpa Login'}
                  </strong>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="client-landing-hero-stage"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.985, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.48, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="client-landing-hero-frame">
                <img
                  src={heroMedia.url || STUDIO_HERO_PHOTO}
                  alt={heroMedia.alt || `Suasana ruang utama ${studioName} dengan meja kontrol, monitor studio, akustik kayu, dan sudut instrumen`}
                  fetchPriority="high"
                  decoding="async"
                  style={{
                    objectPosition: heroMedia.objectPosition || '50% 48%',
                  }}
                />
                <div className="client-landing-hero-frame-scrim" aria-hidden="true" />

                <div className="client-landing-hero-frame-hud">
                  <div className="client-landing-hero-hud-badge">
                    <Clock3 size={14} aria-hidden="true" />
                    <span>
                      {publicSlotsLoaded
                        ? `Hari ini: ${todayAvailableCount} jam terbuka`
                        : `Operasional ${operationalWindowLabel}`}
                    </span>
                  </div>

                  <a
                    href="#pricelist"
                    onClick={handleNavigationLinkClick}
                    className="client-landing-hero-hud-link"
                  >
                    <span>Hitung Estimasi</span>
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </div>
              </div>

              <StudioVibeAudioControl />
            </motion.div>
          </div>
        </section>

        <motion.section
          className="client-landing-intro"
          aria-labelledby="intro-heading"
          {...sectionMotionProps}
        >
          <div className="client-landing-container">
            <div className="client-landing-section-head">
              <span className="client-landing-kicker">
                <Sparkles size={14} aria-hidden="true" />
                Untuk Semua Kebutuhan Kreatif
              </span>
              <h2 id="intro-heading">
                Dirancang nyaman untuk sesi serius maupun latihan santai.
              </h2>
              <p>
                Baik untuk band yang mengejar kekompakan, solois yang menyiapkan materi baru,
                maupun kreator dan komunitas musik yang butuh jadwal pasti tanpa miskomunikasi.
              </p>
            </div>

            <div className="client-landing-audience-grid">
              {CREATIVE_AUDIENCES.map((segment, index) => (
                <article key={segment.key} className="client-landing-audience-card">
                  <div className="client-landing-audience-meta">
                    <span className="client-landing-audience-index">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="client-landing-audience-eyebrow">{segment.eyebrow}</span>
                  </div>
                  <h3>{segment.title}</h3>
                  <p>{segment.description}</p>
                </article>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          id="services"
          tabIndex={-1}
          className="client-landing-services"
          aria-labelledby="services-heading"
          {...sectionMotionProps}
        >
          <div className="client-landing-container">
            <div className="client-landing-section-head is-split">
              <div>
                <span className="client-landing-kicker">
                  <Music2 size={14} aria-hidden="true" />
                  Layanan &amp; Tarif Aktif
                </span>
                <h2 id="services-heading">
                  Pilih sesi yang sesuai tahap karyamu.
                </h2>
              </div>

              <p>
                Seluruh jenis sesi dan tarif ditarik langsung dari pengaturan harga studio aktif.
                Klik salah satu layanan untuk mengisi estimator secara instan.
              </p>
            </div>

            <div className="client-landing-services-grid">
              {sessionOptions.map((option) => {
                const IconComponent = getServiceIcon(option.key);
                const meta = SERVICE_METADATA_BY_KEY[option.key] || {
                  tag: 'Layanan Studio',
                  badge: 'Tersedia',
                  summary: option.description || 'Layanan studio terjadwal sesuai kebutuhan sesi Anda.',
                  suitability: 'Sesi terjadwal via kalender publik.',
                };
                const rawHourlyPrice = Number(option.pricePerHour ?? option.price ?? 0);
                const hasFixedRate = Number.isFinite(rawHourlyPrice) && rawHourlyPrice > 0;
                const isSelected = !isPackageMode && activeServiceKey === option.key;

                return (
                  <article
                    key={option.key}
                    className={`client-landing-service-card${isSelected ? ' is-selected' : ''}`}
                  >
                    <div className="client-landing-service-top">
                      <span className="client-landing-service-icon" aria-hidden="true">
                        <IconComponent size={20} />
                      </span>
                      <span className="client-landing-service-badge">{meta.tag}</span>
                    </div>

                    <div className="client-landing-service-body">
                      <h3>{option.label}</h3>
                      <p className="client-landing-service-desc">
                        {option.description || meta.summary}
                      </p>
                      <p className="client-landing-service-fit">{meta.suitability}</p>
                    </div>

                    <div className="client-landing-service-footer">
                      <div className="client-landing-service-rate">
                        {hasFixedRate ? (
                          <>
                            <strong>{formatRupiah(rawHourlyPrice)}</strong>
                            <span>/ jam</span>
                          </>
                        ) : (
                          <strong>
                            {isRecordingSessionId(option.key) && recordingTypeOptions.length > 0
                              ? `${recordingTypeOptions.length} tipe tersedia`
                              : 'Sesuai proyek'}
                          </strong>
                        )}
                      </div>

                      <button
                        type="button"
                        className="client-landing-service-cta"
                        aria-label={`Pilih ${option.label} dan lihat estimasi harga`}
                        onClick={() => handleServiceShortcut(option.key)}
                      >
                        <span>Hitung Estimasi</span>
                        <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {hasPackages ? (
              <div className="client-landing-packages-shelf" aria-label="Pilihan paket studio">
                <div className="client-landing-packages-head">
                  <h3>Paket Studio Tersedia</h3>
                  <span>Opsi paket terstruktur dengan durasi dan tarif bundling</span>
                </div>

                <div className="client-landing-packages-list">
                  {packageOptions.map((pkg) => (
                    <button
                      key={pkg.key}
                      type="button"
                      className={`client-landing-package-pill${isPackageMode && activePackageId === pkg.key ? ' is-active' : ''}`}
                      onClick={() => handlePackageShortcut(pkg.key)}
                    >
                      <div>
                        <strong>{pkg.label}</strong>
                        <span>
                          {pkg.durationHours ? `${pkg.durationHours} jam · ` : ''}
                          {formatRupiah(pkg.price || 0)}
                        </span>
                      </div>
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </motion.section>

        <div className="client-landing-atmosphere-wrap">
          <div className="client-landing-container">
            <StudioAtmosphereShowcase
              studioName={studioName}
              spots={atmosphereSpots}
              extraPhotos={extraGalleryPhotos}
            />
          </div>
        </div>

        <motion.section
          id="pricelist"
          ref={plannerSectionRef}
          tabIndex={-1}
          className="client-landing-planner"
          aria-labelledby="planner-heading"
          {...sectionMotionProps}
        >
          <div className="client-landing-container">
            <div className="client-landing-planner-header">
              <div>
                <span className="client-landing-kicker">
                  <CalendarDays size={14} aria-hidden="true" />
                  Estimator &amp; Handoff Jadwal
                </span>
                <h2 id="planner-heading">Simulasikan biaya &amp; langsung kunci tanggalmu.</h2>
              </div>

              <div className="client-landing-mode-tabs" role="group" aria-label="Mode estimasi">
                <button
                  type="button"
                  aria-pressed={plannerMode === 'regular' ? 'true' : 'false'}
                  className={`client-landing-mode-tab${plannerMode === 'regular' ? ' is-active' : ''}`}
                  onClick={() => handleModeChange('regular')}
                >
                  Sewa Reguler
                </button>
                <button
                  type="button"
                  disabled={!hasPackages}
                  aria-pressed={plannerMode === 'package' ? 'true' : 'false'}
                  className={`client-landing-mode-tab${plannerMode === 'package' ? ' is-active' : ''}`}
                  onClick={() => handleModeChange('package')}
                >
                  {hasPackages ? 'Pilih Paket' : 'Paket Belum Aktif'}
                </button>
              </div>
            </div>

            <div className="client-landing-planner-workbench">
              <div className="client-landing-planner-card">
                <form
                  className="client-landing-planner-form"
                  onSubmit={handlePlannerSubmit}
                  noValidate
                >
                  <div className="client-landing-form-row">
                    {isPackageMode ? (
                      <div className="client-landing-field">
                        <StudioSelect
                          label="Pilih Paket"
                          selectedKey={activePackageId}
                          onChange={setSelectedPackageId}
                          options={packageOptions.map((item) => ({
                            key: item.key,
                            label: `${item.label} (${formatRupiah(item.price || 0)})`,
                          }))}
                          sheetTitle="Pilih Paket Studio"
                        />
                      </div>
                    ) : (
                      <div className="client-landing-field">
                        <StudioSelect
                          label="Jenis Layanan"
                          selectedKey={activeServiceKey}
                          onChange={(nextValue) => {
                            setSelectedService(nextValue);
                            setBookingSelectionError('');
                          }}
                          options={sessionOptions.map((item) => ({
                            key: item.key,
                            label: item.label,
                          }))}
                          sheetTitle="Pilih Layanan Studio"
                        />
                      </div>
                    )}

                    {!isPackageMode ? (
                      <div className="client-landing-field">
                        <StudioSelect
                          label="Durasi Sesi"
                          selectedKey={duration}
                          onChange={setDuration}
                          options={regularDurationOptions}
                          sheetTitle="Pilih Durasi Sesi"
                        />
                      </div>
                    ) : null}
                  </div>

                  {showRecordingTypeSelect ? (
                    <div className="client-landing-field">
                      <StudioSelect
                        label="Tipe Recording"
                        selectedKey={activeRecordingTypeId}
                        onChange={setSelectedRecordingTypeId}
                        options={recordingTypeOptions.map((item) => ({
                          key: item.key,
                          label: `${item.label} (${formatRupiah(item.price || 0)})`,
                        }))}
                        sheetTitle="Pilih Tipe Recording"
                      />
                    </div>
                  ) : null}

                  <div className="client-landing-form-row">
                    <div className="client-landing-field">
                      <div className="client-landing-date-shell">
                        <label htmlFor="landing-booking-date" className="client-landing-date-label">
                          Tanggal Sesi
                        </label>
                        <input
                          id="landing-booking-date"
                          type="date"
                          min={todayKey}
                          value={date}
                          onChange={(event) => {
                            setDate(event.target.value);
                            setBookingSelectionError('');
                          }}
                          className="client-landing-date-input"
                        />
                      </div>
                    </div>

                    <div className="client-landing-field">
                      <StudioSelect
                        label="Jam mulai"
                        selectedKey={startHour}
                        onChange={(nextHour) => {
                          hasUserPickedHourRef.current = true;
                          setStartHour(nextHour);
                          setBookingSelectionError('');
                        }}
                        options={startHourSelectOptions}
                        sheetTitle="Pilih Jam Mulai"
                      />
                    </div>
                  </div>

                  {bookingSelectionError ? (
                    <div role="alert" className="client-landing-selection-error">
                      {bookingSelectionError}
                    </div>
                  ) : null}

                  <div className="client-landing-handoff-preview">
                    <div className="client-landing-handoff-main">
                      <div className="client-landing-handoff-summary">
                        <span className="client-landing-handoff-label">Ringkasan Pilihanmu</span>
                        <strong>
                          {isPackageMode
                            ? activePackageOption?.label || 'Paket Studio'
                            : activeServiceOption?.label || 'Sesi Studio'}
                          {' · '}
                          {formatIndonesianDateLabel(date)}
                        </strong>
                        <span className="client-landing-handoff-slot">{selectedTimeWindowLabel}</span>
                      </div>

                      <div className="client-landing-handoff-price">
                        <span>Estimasi Tagihan</span>
                        {isRecordingCustomRate ? (
                          <strong className="is-custom">Dikonfirmasi Admin</strong>
                        ) : (
                          <strong>{formatRupiah(estimatedPricing.total || 0)}</strong>
                        )}
                        {estimatedPricing.discountAmount > 0 ? (
                          <small className="client-landing-discount-badge">
                            Sudah termasuk hemat {formatRupiah(estimatedPricing.discountAmount)}
                          </small>
                        ) : null}
                      </div>
                    </div>

                    <div className="client-landing-handoff-notes">
                      <p className="client-landing-handoff-subcopy">
                        Tanggal dan jam diteruskan ke kalender publik.
                      </p>
                      <p className="client-landing-planner-note">
                        Layanan dan durasi dipilih setelah masuk ke akun client.
                      </p>
                    </div>
                  </div>

                  <div className="client-landing-planner-actions">
                    <button type="submit" className="client-landing-button is-primary is-full">
                      <span>PILIH SLOT TERSEDIA</span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                </form>
              </div>

              <aside
                className="client-landing-availability-card"
                aria-label="Ketersediaan slot studio pada tanggal terpilih"
              >
                <div className="client-landing-availability-top">
                  <div>
                    <span className="client-landing-kicker">
                      <Clock3 size={14} aria-hidden="true" />
                      Slot Tanggal Terpilih
                    </span>
                    <h3>{formatIndonesianDateLabel(date)}</h3>
                  </div>

                  <span className="client-landing-availability-pill">
                    {publicSlotsLoaded
                      ? `${selectedDateAvailableCount} jam terbuka`
                      : `Buka ${operationalWindowLabel}`}
                  </span>
                </div>

                <div className="client-landing-availability-legend" aria-hidden="true">
                  <span>
                    <i className="is-open" />
                    Tersedia
                  </span>
                  <span>
                    <i className="is-active" />
                    Dipilih
                  </span>
                  <span>
                    <i className="is-busy" />
                    Terisi
                  </span>
                </div>

                <div className="client-landing-hour-grid" role="group" aria-label="Pilih jam mulai cepat">
                  {startHours.map((hour) => {
                    const isOccupied = selectedDateOccupiedHours.has(hour);
                    const isChosen = String(hour) === String(startHour);
                    return (
                      <button
                        key={hour}
                        type="button"
                        disabled={isOccupied}
                        onClick={() => {
                          hasUserPickedHourRef.current = true;
                          setStartHour(String(hour));
                          setBookingSelectionError('');
                        }}
                        className={`client-landing-hour-chip${isChosen ? ' is-selected' : ''}${isOccupied ? ' is-occupied' : ''}`}
                      >
                        <strong>{formatHourClock(hour)}</strong>
                        <span>{isOccupied ? 'Terisi' : isChosen ? 'Dipilih' : 'Tersedia'}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="client-landing-availability-footer">
                  <div>
                    <strong>Lihat Kalender Lengkap 7 Hari</strong>
                    <span>Bandingkan jadwal minggu ini atau bulan ini langsung di /book.</span>
                  </div>
                  <a
                    href="/book"
                    className="client-landing-text-link"
                    onClick={handleNavigationLinkClick}
                  >
                    <span>Buka /book</span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </a>
                </div>
              </aside>
            </div>
          </div>
        </motion.section>

        <motion.section
          id="process"
          tabIndex={-1}
          className="client-landing-process"
          aria-labelledby="process-heading"
          {...sectionMotionProps}
        >
          <div className="client-landing-container">
            <div className="client-landing-section-head">
              <span className="client-landing-kicker">
                <CheckCircle2 size={14} aria-hidden="true" />
                Alur Booking Tanpa Ribet
              </span>
              <h2 id="process-heading">Tiga langkah dari cek slot sampai siap masuk studio.</h2>
            </div>

            <div className="client-landing-process-grid">
              {BOOKING_PROCESS_STEPS.map((item) => (
                <article key={item.step} className="client-landing-process-card">
                  <span className="client-landing-process-step">{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          id="client-space"
          tabIndex={-1}
          className="client-landing-client-space"
          aria-labelledby="client-space-heading"
          {...sectionMotionProps}
        >
          <div className="client-landing-container">
            <div className="client-landing-portal-showcase">
              <div className="client-landing-portal-copy">
                <span className="client-landing-kicker">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Client Workspace
                </span>
                <h2 id="client-space-heading">
                  {activeRoleIsClient
                    ? `Halo kembali, ${accountIdentity?.displayName || authUser?.displayName || 'Client Studio'}.`
                    : 'Kelola seluruh jadwal, invoice, dan konfirmasi sesi dari satu portal.'}
                </h2>
                <p>
                  {activeRoleIsClient
                    ? 'Akun client Anda sedang aktif. Pantau jadwal terbaru di bawah atau masuk ke Client Portal untuk detail pembayaran dan penjadwalan.'
                    : 'Anda dapat melihat jadwal studio tanpa login. Saat ingin mengajukan booking, masuk ke akun client agar seluruh histori sesi, invoice, dan unggah bukti pembayaran tercatat rapi.'}
                </p>

                <div className="client-landing-portal-actions">
                  <a
                    href={
                      activeRoleIsStaff
                        ? '/admin'
                        : activeRoleIsClient
                          ? '/client/portal'
                          : '/client/login'
                    }
                    className="client-landing-button is-primary"
                    onClick={handleNavigationLinkClick}
                  >
                    <span>
                      {activeRoleIsStaff
                        ? 'Buka Admin Dashboard'
                        : activeRoleIsClient
                          ? 'Buka Client Portal'
                          : 'Masuk / Daftar Client'}
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </a>

                  <a
                    href="/book"
                    className="client-landing-button is-outline"
                    onClick={handleNavigationLinkClick}
                  >
                    <span>Cek Kalender Publik</span>
                  </a>
                </div>
              </div>

              <div className="client-landing-portal-card">
                {activeRoleIsClient ? (
                  <div className="client-landing-booking-preview">
                    <div className="client-landing-booking-preview-head">
                      <strong>Riwayat Sesi Terkini</strong>
                      <span>{recentClientBookings.length} booking terhubung</span>
                    </div>

                    {recentClientBookings.length > 0 ? (
                      <ul className="client-landing-booking-list">
                        {recentClientBookings.map((booking) => {
                          const reqMeta =
                            BOOKING_REQUEST_STATUS_META[getBookingRequestStatus(booking)] || {
                              label: 'Tercatat',
                            };
                          return (
                            <li key={booking.id} className="client-landing-booking-item">
                              <div>
                                <strong>{booking.sessionLabel || booking.serviceType || 'Sesi Studio'}</strong>
                                <span>
                                  {formatIndonesianDateLabel(booking.date)} · {formatHourClock(booking.startHour)} WIB
                                </span>
                              </div>
                              <span className="client-landing-booking-status">{reqMeta.label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="client-landing-portal-empty">
                        Belum ada booking tercatat pada akun ini. Pilih slot dari kalender publik untuk mengajukan sesi pertama Anda.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="client-landing-portal-features">
                    <div className="client-landing-portal-feature-item">
                      <CalendarDays size={18} aria-hidden="true" />
                      <div>
                        <strong>Kalender Pribadi &amp; Status Request</strong>
                        <span>Pantau persetujuan admin dan perubahan slot secara langsung.</span>
                      </div>
                    </div>

                    <div className="client-landing-portal-feature-item">
                      <ShieldCheck size={18} aria-hidden="true" />
                      <div>
                        <strong>Invoice &amp; Upload Bukti Pembayaran</strong>
                        <span>Simpan rincian DP maupun pelunasan tanpa perlu mencari chat lama.</span>
                      </div>
                    </div>

                    <div className="client-landing-portal-feature-item">
                      <Clock3 size={18} aria-hidden="true" />
                      <div>
                        <strong>Pilihan Tanggal &amp; Jam Tetap Tersimpan</strong>
                        <span>Slot yang dipilih di landing page langsung diteruskan saat login.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        <div className="client-landing-faq-wrap">
          <div className="client-landing-container">
            <LandingFaqSection items={faqItems} />
          </div>
        </div>

        <motion.section
          id="location"
          tabIndex={-1}
          className="client-landing-location"
          aria-labelledby="location-heading"
          {...sectionMotionProps}
        >
          <div className="client-landing-container">
            <div className="client-landing-location-grid">
              <div className="client-landing-location-card">
                <span className="client-landing-kicker">
                  <MapPin size={14} aria-hidden="true" />
                  Lokasi &amp; Kontak Studio
                </span>
                <h2 id="location-heading">Kunjungi atau hubungi tim {studioName}.</h2>
                <p>
                  Informasi operasional, alamat, dan kanal kontak di bawah bersumber langsung dari
                  pengaturan studio aktif.
                </p>

                <dl className="client-landing-info-list">
                  <div>
                    <dt>Jam Operasional</dt>
                    <dd>Setiap hari · {operationalWindowLabel}</dd>
                  </div>

                  <div>
                    <dt>Alamat Studio</dt>
                    <dd>
                      {studioAddress || 'Detail alamat lengkap tersedia pada konfirmasi booking dan pengaturan studio.'}
                    </dd>
                  </div>

                  <div>
                    <dt>Kontak / WhatsApp</dt>
                    <dd>{studioPhone || 'Tersedia setelah konfirmasi booking atau melalui Client Portal.'}</dd>
                  </div>

                  {paymentChannelSummary ? (
                    <div>
                      <dt>Kanal Pembayaran Resmi</dt>
                      <dd>{paymentChannelSummary}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="client-landing-location-actions">
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="client-landing-button is-primary"
                    >
                      <MessageCircle size={16} aria-hidden="true" />
                      <span>Tanya Admin via WhatsApp</span>
                    </a>
                  ) : null}

                  <a
                    href="/book"
                    className={`client-landing-button ${whatsappHref ? 'is-outline' : 'is-primary'}`}
                    onClick={handleNavigationLinkClick}
                  >
                    <span>Lihat Kalender Studio</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </a>
                </div>
              </div>

              <div className="client-landing-policy-card">
                <span className="client-landing-policy-label">Ketentuan Booking &amp; Pembayaran</span>
                <h3>Transparan sejak sebelum sesi dimulai</h3>
                <ul className="client-landing-policy-list">
                  {paymentTermsList.map((term) => (
                    <li key={term}>{term}</li>
                  ))}
                </ul>

                <div className="client-landing-policy-meta">
                  <span>
                    <Phone size={15} aria-hidden="true" />
                    Konfirmasi &amp; bantuan terhubung dengan dashboard studio
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          className="client-landing-final-cta"
          aria-labelledby="final-cta-heading"
          {...sectionMotionProps}
        >
          <div className="client-landing-container">
            <div className="client-landing-final-cta-banner">
              <div className="client-landing-final-cta-copy">
                <span className="client-landing-kicker is-on-dark">Siap Masuk Sesi?</span>
                <h2 id="final-cta-heading">Kunci slot latihan atau rekaman Anda sekarang.</h2>
                <p>
                  Lihat ketersediaan real-time di kalender publik dan lanjutkan pengajuan dalam alur
                  yang rapi.
                </p>
              </div>

              <div className="client-landing-final-cta-actions">
                <a
                  href="/book"
                  className="client-landing-button is-primary is-large"
                  onClick={handleNavigationLinkClick}
                >
                  <span>Buka Kalender Publik</span>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a
                  href="/client/login"
                  className="client-landing-button is-ghost-dark"
                  onClick={handleNavigationLinkClick}
                >
                  <span>Client Portal</span>
                </a>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="client-landing-footer">
        <div className="client-landing-container client-landing-footer-grid">
          <div className="client-landing-footer-brand">
            <div className="client-landing-brand is-footer">
              <span className="client-landing-brand-badge" aria-hidden="true">
                37
              </span>
              <span className="client-landing-brand-text">
                <strong className="client-landing-brand-wordmark">STUDIO</strong>
                <span>{studioName}</span>
              </span>
            </div>
            <p>
              Platform penjadwalan publik dan workspace sesi musik untuk rehearsal, recording, mixing,
              dan mastering.
            </p>
          </div>

          <div className="client-landing-footer-col">
            <h4>Navigasi</h4>
            <ul>
              <li>
                <a href="#services" onClick={handleNavigationLinkClick}>
                  Layanan &amp; Tarif
                </a>
              </li>
              <li>
                <a href="#atmosphere" onClick={handleNavigationLinkClick}>
                  Pratinjau Ruang
                </a>
              </li>
              <li>
                <a href="#pricelist" onClick={handleNavigationLinkClick}>
                  Estimator Harga
                </a>
              </li>
              <li>
                <a href="#faq" onClick={handleNavigationLinkClick}>
                  FAQ Studio
                </a>
              </li>
            </ul>
          </div>

          <div className="client-landing-footer-col">
            <h4>Akses Booking</h4>
            <ul>
              <li>
                <a href="/book" onClick={handleNavigationLinkClick}>
                  Kalender Publik (/book)
                </a>
              </li>
              <li>
                <a href="/client/login" onClick={handleNavigationLinkClick}>
                  Masuk Client
                </a>
              </li>
              <li>
                <a href="/client/portal" onClick={handleNavigationLinkClick}>
                  Client Portal
                </a>
              </li>
              {whatsappHref ? (
                <li>
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    WhatsApp Studio
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          <div className="client-landing-footer-col">
            <h4>Jam Buka</h4>
            <p className="client-landing-footer-hours">
              Setiap Hari
              <br />
              {operationalWindowLabel}
            </p>
          </div>
        </div>

        <div className="client-landing-container client-landing-footer-bottom">
          <p>
            © {new Date().getFullYear()} {studioName}. Seluruh jadwal &amp; tarif mengacu pada
            pengaturan studio aktif.
          </p>
        </div>
      </footer>

      <div
        className={`client-landing-mobile-cta${showMobileStickyCta ? ' is-visible' : ''}`}
      >
        <div className="client-landing-mobile-cta-copy">
          <span>Mulai Rp {formatRupiah(startingHourlyPrice).replace(/^Rp\s*/, '')}/jam</span>
          <strong>
            {publicSlotsLoaded ? `${todayAvailableCount} jam kosong hari ini` : operationalWindowLabel}
          </strong>
        </div>

        <a
          href="/book"
          className="client-landing-button is-primary is-compact"
          onClick={handleNavigationLinkClick}
        >
          <span>Cek Jadwal</span>
          <ArrowRight size={15} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
