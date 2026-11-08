import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
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
import { getLocalDateKey } from '../utils/publicBookingSelection.js';
import StudioSelect from '../components/ui/StudioSelect.jsx';
import { NumberTicker } from '../components/magicui/number-ticker.jsx';
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
    sessionKey: 'rehearsal',
    title: 'Latihan tanpa kehilangan momentum.',
  },
  {
    description: 'Tracking vokal dan instrumen dalam ruang yang dirancang agar setiap detail tetap terdengar.',
    icon: Mic2,
    index: '02',
    label: 'Recording',
    sessionKey: 'recording',
    title: 'Tangkap performa terbaik Anda.',
  },
  {
    description: 'Mixing dan mastering untuk membawa materi mentah menjadi karya yang siap diperdengarkan.',
    icon: SlidersHorizontal,
    index: '03',
    label: 'Post production',
    sessionKey: 'mixing',
    title: 'Buat karya terasa selesai.',
  },
];

const formatTickerRupiah = (value) => formatRupiah(Math.round(value));

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
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scrollProgress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  const sectionRevealProps = shouldReduceMotion ? { initial: false } : {
    initial: { opacity: 0, y: 26 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.16 },
    transition: { duration: 0.58, ease: [0.16, 1, 0.3, 1] },
  };
  const interactionMotionProps = shouldReduceMotion ? {} : {
    whileHover: { y: -2 },
    whileTap: { scale: 0.985 },
    transition: { type: 'spring', stiffness: 440, damping: 26 },
  };
  const pricingSettings = usePricingSettings();
  const invoiceSettings = useInvoiceSettings();

  const [authLoading, setAuthLoading] = useState(() => Boolean(firebaseAuth));
  const [currentUser, setCurrentUser] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [bookingSelectionError, setBookingSelectionError] = useState('');
  const [plannerMode, setPlannerMode] = useState('regular');
  const [sessionType, setSessionType] = useState('rehearsal');
  const [recordingTypeId, setRecordingTypeId] = useState('none');
  const [packageId, setPackageId] = useState('none');
  const [date, setDate] = useState(() => getLocalDateKey(new Date()));
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
      setAuthLoading(true);
      setUserBookings([]);

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
    const updateHeaderState = () => setIsHeaderScrolled(window.scrollY > 24);
    updateHeaderState();
    window.addEventListener('scroll', updateHeaderState, { passive: true });
    return () => window.removeEventListener('scroll', updateHeaderState);
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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  const sessionOptions = useMemo(() => getSessionOptions(pricingSettings), [pricingSettings]);
  const recordingTypeOptions = useMemo(() => getRecordingTypeOptions(pricingSettings), [pricingSettings]);
  const packageOptions = useMemo(() => getPackageOptions(pricingSettings), [pricingSettings]);

  const startHourOptions = useMemo(() => businessHours.map((hour) => ({
    description: 'Jam mulai sesi',
    key: hour.key,
    label: hour.rangeLabel,
  })), []);
  const minBookableDate = getLocalDateKey(new Date());
  const hasPackages = packageOptions.length > 0;
  const selectedStartHour = startHourOptions.find((option) => String(option.key) === String(startHour));
  const isCustomDurationValid = duration !== 'custom' || (customDuration.trim() !== '' && Number.isInteger(Number(customDuration)) && Number(customDuration) >= 1);

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
    if (sessionType === 'recording' && recordingTypeId !== 'none') {
      const selectedRecordingType = recordingTypeOptions.find((item) => item.key === recordingTypeId);
      return Math.max(0, Number(selectedRecordingType?.durationHours) || 0);
    }
    if (duration === 'custom') {
      const parsedDuration = Number(customDuration);
      return Number.isInteger(parsedDuration) && parsedDuration >= 1 ? parsedDuration : 0;
    }
    return Number(duration) || 2;
  }, [customDuration, duration, packageId, plannerMode, pricingSettings.packages, recordingTypeId, recordingTypeOptions, sessionType]);
  const isPriceEstimateReady = plannerMode === 'package'
    ? hasPackages && packageId !== 'none'
    : sessionType === 'recording'
      ? recordingTypeId !== 'none' && recordingTypeOptions.some((item) => item.key === recordingTypeId)
      : isCustomDurationValid;

  const pricingBreakdown = useMemo(() => resolveBookingPricing({
    customDurationHours: duration === 'custom' && isCustomDurationValid ? Number(customDuration) : 0,
    dpAmount: 0,
    durationHours: Number(duration) || 0,
    packageId: plannerMode === 'package' ? packageId : 'none',
    paymentStatus: 'pending',
    pricingSettings,
    recordingTypeId,
    sessionId: sessionType,
  }), [customDuration, duration, isCustomDurationValid, packageId, plannerMode, pricingSettings, recordingTypeId, sessionType]);

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
    setBookingSelectionError('');

    if (selected?.isRecordingType) {
      setSessionType('recording');
      setRecordingTypeId(value);
      return;
    }

    setSessionType(value);
    setRecordingTypeId('none');
  }

  function handleServiceShortcut(sessionKey) {
    setPlannerMode('regular');
    setBookingSelectionError('');
    if (sessionKey === 'recording') {
      setSessionType('recording');
      setRecordingTypeId(recordingTypeOptions[0]?.key || 'none');
    } else {
      const matchingSession = sessionOptions.find((option) => option.key === sessionKey);
      if (!matchingSession) return;
      setSessionType(matchingSession.key);
      setRecordingTypeId('none');
    }
    document.getElementById('pricelist')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function handlePlannerMode(mode) {
    if (mode === 'package' && !hasPackages) return;
    setBookingSelectionError('');
    setPlannerMode(mode);

    if (mode === 'regular') setPackageId('none');
    if (mode === 'package' && packageId === 'none' && packageOptions[0]?.key) {
      setPackageId(packageOptions[0].key);
    }
  }

  function handleBookingAction(event) {
    event.preventDefault();
    const selectedDate = new Date(date + 'T00:00:00');
    const isValidDate = !Number.isNaN(selectedDate.getTime()) && getLocalDateKey(selectedDate) === date && date >= minBookableDate;
    const isValidHour = businessHours.some((hour) => String(hour.key) === String(startHour));
    if (!isValidDate) {
      setBookingSelectionError('Pilih tanggal yang valid mulai hari ini.');
      return;
    }
    if (!isValidHour) {
      setBookingSelectionError('Pilih jam mulai yang tersedia.');
      return;
    }
    setBookingSelectionError('');
    const params = new URLSearchParams();
    params.set('date', date);
    params.set('startHour', startHour);

    navigate('/book?' + params.toString());
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

  function handleNavigationLinkClick(event) {
    const href = event.currentTarget.getAttribute('href') || '';
    setIsMenuOpen(false);

    if (!href.startsWith('#')) return;

    const target = document.getElementById(href.slice(1));
    if (!target) return;

    window.requestAnimationFrame(() => {
      if (target.isConnected) target.focus({ preventScroll: true });
    });
  }

  return (
    <motion.div className="client-landing-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: shouldReduceMotion ? 0 : 0.28 }}>
      <motion.div aria-hidden="true" className="client-landing-scroll-progress" style={{ scaleX: shouldReduceMotion ? 0 : scrollProgress }} />
      <a className="client-landing-skip-link" href="#main-content">Lewati ke konten</a>

      <motion.header className={'client-landing-header' + (isHeaderScrolled ? ' is-scrolled' : '')}>
        <a className="client-landing-brand" href="#top" aria-label="37 Music Studio, kembali ke atas">
          <span className="client-landing-brand-mark">37</span>
          <span className="client-landing-brand-lockup">
            <strong>Music Studio</strong>
            <small>Rehearse · Record · Release</small>
          </span>
        </a>

        <nav
          aria-label="Navigasi utama"
          className={`client-landing-nav ${isMenuOpen ? 'is-open' : ''}`}
          id="client-landing-navigation"
        >
          <a href="#services" className="client-landing-nav-link" onClick={handleNavigationLinkClick}>Studio</a>
          <a href="#pricelist" className="client-landing-nav-link" onClick={handleNavigationLinkClick}>Harga</a>
          <a href="/book" className="client-landing-nav-link" onClick={handleNavigationLinkClick}>Booking Slot</a>
          <a href="#location" className="client-landing-nav-link" onClick={handleNavigationLinkClick}>Lokasi</a>
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

          <motion.button
            aria-controls="client-landing-navigation"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
            className="client-landing-menu-button"
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            {...interactionMotionProps}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </motion.button>
        </div>
      </motion.header>
      <AnimatePresence>
        {isMenuOpen ? <motion.button aria-label="Tutup navigasi" className="client-landing-menu-backdrop" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMenuOpen(false)} /> : null}
      </AnimatePresence>

      <main id="main-content">
        <motion.section className="client-landing-hero" id="top" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}>
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
        </motion.section>

        <motion.section className="client-landing-intro" {...sectionRevealProps} aria-labelledby="client-intro-title">
          <div className="client-landing-section-index">The studio</div>
          <div>
            <h2 id="client-intro-title">Datang membawa ide.<br />Pulang membawa progres.</h2>
          </div>
          <p>
            Dari latihan pertama sampai final master, setiap sesi dibuat sederhana: pilih kebutuhan, temukan slot, lalu fokus bermusik.
          </p>
        </motion.section>

        <motion.section className="client-landing-services" {...sectionRevealProps} id="services" tabIndex={-1} aria-labelledby="client-services-title">
          <header className="client-landing-section-heading">
            <span>01 / Services</span>
            <h2 id="client-services-title">Satu ruang.<br />Tiga cara berkarya.</h2>
          </header>

          <div className="client-landing-service-list">
            {SERVICE_STORIES.map(({ description, icon: Icon, index, label, sessionKey, title }) => (
              <motion.article className="client-landing-service" key={label} whileHover={shouldReduceMotion ? undefined : { x: 5 }} transition={{ duration: 0.2 }}>
                <span className="client-landing-service-number">{index}</span>
                <span className="client-landing-service-icon"><Icon size={22} /></span>
                <div>
                  <small>{label}</small>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <motion.button aria-label={'Pilih ' + label + ' dan lihat estimasi harga'} className="client-landing-service-action" type="button" onClick={() => handleServiceShortcut(sessionKey)} {...interactionMotionProps}>
                  <ArrowRight size={19} aria-hidden="true" />
                </motion.button>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section className="client-landing-planner" {...sectionRevealProps} id="pricelist" tabIndex={-1} aria-labelledby="client-planner-title">
          <div className="client-landing-planner-story">
            <span>02 / Plan your session</span>
            <h2 id="client-planner-title">Harga transparan sebelum Anda datang.</h2>
            <p>Pilih format sesi untuk melihat estimasi. Slot dan total akhir dikonfirmasi di alur booking.</p>

            <div className="client-landing-starting-price">
              <small>Mulai dari</small>
              <strong><NumberTicker value={startingPrice} formatter={formatTickerRupiah} duration={shouldReduceMotion ? 0 : 0.52} /></strong>
              <span>/ jam</span>
            </div>

            <ul className="client-landing-proof-list">
              <li><Check size={16} /> Tidak ada biaya tersembunyi</li>
              <li><Check size={16} /> Slot diperiksa realtime</li>
              <li><Check size={16} /> Konfirmasi tercatat di portal</li>
            </ul>
          </div>

          <motion.form className="client-landing-planner-form" onSubmit={handleBookingAction} {...(shouldReduceMotion ? {} : { whileHover: { y: -2 }, transition: { duration: 0.2 } })}>
            <div className="client-landing-segmented" aria-label="Mode harga">
              <button
                aria-pressed={plannerMode === 'regular'}
                className={plannerMode === 'regular' ? 'is-active' : ''}
                type="button"
                onClick={() => handlePlannerMode('regular')}
              >
                Sewa reguler
              </button>
              <button
                aria-pressed={plannerMode === 'package'}
                className={plannerMode === 'package' ? 'is-active' : ''}
                disabled={!hasPackages}
                title={hasPackages ? undefined : 'Paket belum tersedia'}
                type="button"
                onClick={() => handlePlannerMode('package')}
              >
                Pilih paket
              </button>
            </div>
            {!hasPackages ? <p className="client-landing-mode-note">Paket sesi belum tersedia saat ini. Anda tetap bisa melihat estimasi sewa reguler.</p> : null}

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
                <input min={minBookableDate} type="date" value={date} onChange={(event) => { setDate(event.target.value); setBookingSelectionError(''); }} />
              </label>

              <div className="client-landing-field">
                <StudioSelect
                  label="Jam mulai"
                  options={startHourOptions}
                  selectedKey={startHour}
                  onChange={(value) => { setStartHour(value); setBookingSelectionError(''); }}
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
                  <input aria-invalid={!isCustomDurationValid} min="1" step="1" type="number" value={customDuration} onChange={(event) => { setCustomDuration(event.target.value); setBookingSelectionError(''); }} />
                  {!isCustomDurationValid ? <small className="client-landing-field-error">Masukkan durasi minimal 1 jam.</small> : null}
                </label>
              ) : null}
            </div>

            <div className="client-landing-estimate">
              <div>
                <small>Estimasi {actualDuration ? `· ${actualDuration} jam` : ''}</small>
                {isPriceEstimateReady
                  ? <strong><NumberTicker value={pricingBreakdown.total} formatter={formatTickerRupiah} duration={shouldReduceMotion ? 0 : 0.48} /></strong>
                  : <strong className="client-landing-estimate-pending">{sessionType === 'recording' ? 'Pilih tipe recording' : 'Masukkan durasi'}</strong>}
              </div>
              {pricingBreakdown.discountAmount > 0 ? (
                <span>Hemat {formatRupiah(pricingBreakdown.discountAmount)}</span>
              ) : (
                <span>Belum termasuk add-on</span>
              )}
            </div>

            <motion.div className="client-landing-handoff-preview">
              <CalendarDays size={18} aria-hidden="true" />
              <div>
                <small>Jadwal yang akan diteruskan</small>
                <strong>{formatPublicDate(date)} · {selectedStartHour?.label || 'Pilih jam mulai'}</strong>
                <p>Layanan dan durasi dipilih setelah Anda masuk, supaya detail request tercatat di akun yang benar.</p>
              </div>
            </motion.div>
            <AnimatePresence initial={false}>
              {bookingSelectionError ? <motion.p className="client-landing-selection-error" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{bookingSelectionError}</motion.p> : null}
            </AnimatePresence>
            <motion.button className="client-landing-planner-submit" type="submit" {...interactionMotionProps}>
              PILIH SLOT TERSEDIA
              <ArrowRight size={18} aria-hidden="true" />
            </motion.button>
            <p className="client-landing-planner-note">
              Tanggal dan jam diteruskan ke kalender publik. Layanan dan durasi dipilih setelah masuk ke akun client.
            </p>
          </motion.form>
        </motion.section>

        <motion.section className="client-landing-process" {...sectionRevealProps} aria-labelledby="client-process-title">
          <header className="client-landing-section-heading is-light">
            <span>03 / How it works</span>
            <h2 id="client-process-title">Dari ide ke sesi<br />dalam tiga langkah.</h2>
          </header>

          <ol className="client-landing-process-list">
            <li><span>01</span><strong>Pilih waktu</strong><p>Lihat kalender publik dan temukan slot yang masih tersedia.</p></li>
            <li><span>02</span><strong>Kirim request</strong><p>Masuk atau buat akun untuk mengunci detail permintaan booking.</p></li>
            <li><span>03</span><strong>Datang & berkarya</strong><p>Pantau konfirmasi, pembayaran, dan detail sesi dari Portal Client.</p></li>
          </ol>
        </motion.section>

        <motion.section className="client-landing-client-space" {...sectionRevealProps} id="history" aria-labelledby="client-space-title">
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
        </motion.section>

        <motion.section className="client-landing-location" {...sectionRevealProps} id="location" tabIndex={-1} aria-labelledby="client-location-title">
          <div className="client-landing-location-heading">
            <span>05 / Visit</span>
            <h2 id="client-location-title">Temukan ruang<br />untuk sesi berikutnya.</h2>
          </div>

          <div className="client-landing-location-details">
            <div><MapPin size={19} /><span><small>Studio</small><strong>{studioAddress}</strong></span></div>
            <div><MessageCircle size={19} /><span><small>Kontak</small><strong>{studioPhone}</strong></span></div>
            <div><Clock3 size={19} /><span><small>Jam operasional</small><strong>Setiap hari · 10.00—23.00 WIB</strong></span></div>
          </div>
        </motion.section>

        <motion.section className="client-landing-final-cta" {...sectionRevealProps} aria-labelledby="client-final-title">
          <Volume2 size={28} aria-hidden="true" />
          <p>{studioName}</p>
          <h2 id="client-final-title">Sesi yang bagus dimulai<br />dari slot yang tepat.</h2>
          <a className="client-landing-final-action" href="/book">
            Mulai booking
            <ArrowRight size={20} aria-hidden="true" />
          </a>
        </motion.section>
      </main>

      <footer className="client-landing-footer">
        <div className="client-landing-brand is-footer">
          <span className="client-landing-brand-mark">37</span>
          <span className="client-landing-brand-lockup"><strong>Music Studio</strong><small>Built for musicians</small></span>
        </div>
        <p>© {new Date().getFullYear()} {studioName}. All rights reserved.</p>
        <a href="#top">Kembali ke atas <ArrowRight size={15} /></a>
      </footer>
      <motion.div className="client-landing-mobile-cta">
        <div><small>Mulai dari</small><strong><NumberTicker value={startingPrice} formatter={formatTickerRupiah} duration={shouldReduceMotion ? 0 : 0.5} /></strong></div>
        <motion.a href="#pricelist" {...interactionMotionProps}>Atur jadwal <ArrowRight size={16} aria-hidden="true" /></motion.a>
      </motion.div>
    </motion.div>
  );
}
