import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Music,
  Phone,
  Shield,
  Volume2,
  MapPin,
  Sparkles,
  ArrowRight,
  Check,
  Mic,
  Sliders,
  ChevronRight,
  Flame,
  Info,
  LogOut,
  CalendarDays,
  Clock,
  LoaderCircle
} from 'lucide-react';
import {
  usePricingSettings,
  formatRupiah,
  resolveBookingPricing,
  getSessionOptions,
  getRecordingTypeOptions,
  getPackageOptions,
  getDiscountOptions
} from '../settings/pricingSettings.js';
import { useInvoiceSettings } from '../settings/invoiceSettings.js';
import { businessHours, durationOptions } from './admin/scheduleConfig.js';
import StudioSelect from '../components/ui/StudioSelect.jsx';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase.js';
import { adminBookingRepository } from '../services/adminBookingRepository.js';
import { syncClientCustomerProfile } from '../services/clientProfileRepository.js';
import { accountRoleRepository } from '../services/accountRoleRepository.js';
import { PORTAL_ACCESS } from '../utils/accountRoles.js';
import '../styles/admin-auth.css';
import '../styles/client-landing.css';

export default function ClientLandingPage() {
  const pricingSettings = usePricingSettings();
  const invoiceSettings = useInvoiceSettings();

  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(firebaseAuth));
  const [userBookings, setUserBookings] = useState([]);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState('');

  // Form states for simulator (will be filled as soon as auth state resolves)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Client Auth Check
  useEffect(() => {
    if (!firebaseAuth) return;
    let checkSequence = 0;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
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
        
        // Auto pre-fill
        if (user.displayName) {
          setName(user.displayName);
        }
        if (user.phoneNumber) {
          const raw = user.phoneNumber.replace(/^\+/, '');
          setPhone(raw);
        }
      } catch (error) {
        console.error('Gagal memeriksa role akun di landing client:', error);
        if (currentSequence === checkSequence) setCurrentUser(null);
      } finally {
        if (currentSequence === checkSequence) setAuthLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Real-time Booking History for Client
  useEffect(() => {
    if (!currentUser) return;

    return adminBookingRepository.subscribeClientBookingsForUser(
      currentUser,
      (bookingsList) => setUserBookings(bookingsList),
      (err) => {
        console.error('Error fetching client booking history:', err);
      }
    );
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await signOut(firebaseAuth);
      navigate('/client/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Pricing options derived from settings
  const sessionOptions = useMemo(() => getSessionOptions(pricingSettings), [pricingSettings]);
  const recordingTypeOptions = useMemo(() => getRecordingTypeOptions(pricingSettings), [pricingSettings]);
  const packageOptions = useMemo(() => getPackageOptions(pricingSettings), [pricingSettings]);
  const discountOptions = useMemo(() => getDiscountOptions(pricingSettings), [pricingSettings]);

  const startHourOptions = useMemo(() => {
    return businessHours.map((hour) => ({
      key: hour.key,
      label: hour.rangeLabel,
      description: 'Jam mulai sesi'
    }));
  }, []);

  const finalRecordingTypeOptions = useMemo(() => {
    return [
      { key: 'none', label: 'Sewa Flat Per Jam', description: 'Tarif reguler per jam' },
      ...recordingTypeOptions
    ];
  }, [recordingTypeOptions]);

  const displayedSessionOptions = useMemo(() => {
    if (recordingTypeOptions.length > 0) {
      const list = [];
      for (const item of sessionOptions) {
        if (item.key === 'recording') {
          recordingTypeOptions.forEach(recType => {
            list.push({
              key: recType.key,
              label: recType.label,
              description: `Sesi rekaman durasi ${recType.durationHours} jam`,
              price: recType.price,
              isRecordingType: true,
              durationHours: recType.durationHours
            });
          });
        } else {
          list.push(item);
        }
      }
      return list;
    }
    return sessionOptions;
  }, [sessionOptions, recordingTypeOptions]);

  const [sessionType, setSessionType] = useState('rehearsal');
  const [packageId, setPackageId] = useState('none');
  const [recordingTypeId, setRecordingTypeId] = useState('none');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [startHour, setStartHour] = useState('10');
  const [duration, setDuration] = useState('2');
  const [customDuration, setCustomDuration] = useState('');

  // Normalize WhatsApp phone number
  const whatsappPhone = useMemo(() => {
    const rawPhone = invoiceSettings.phone || '';
    let cleaned = rawPhone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }
    return cleaned || '628123456789'; // fallback number
  }, [invoiceSettings.phone]);

  // Handle auto-reset of details when mode switches
  const handleSessionTypeChange = (val) => {
    setSessionType(val);
    setPackageId('none');
    setRecordingTypeId('none');
  };

  const handlePackageChange = (val) => {
    setPackageId(val);
    if (val !== 'none') {
      setSessionType('rehearsal'); // Reset session type to default or ignore
      setRecordingTypeId('none');
    }
  };

  // Determine actual duration hours
  const actualDuration = useMemo(() => {
    if (packageId !== 'none') {
      const selectedPkg = pricingSettings.packages?.find(p => p.id === packageId);
      return selectedPkg ? Math.max(0, Number(selectedPkg.durationHours) || 0) : 0;
    }
    if (duration === 'custom') {
      return Math.max(1, Number(customDuration) || 1);
    }
    return Number(duration) || 2;
  }, [packageId, duration, customDuration, pricingSettings.packages]);

  // Resolve pricing via utility
  const pricingBreakdown = useMemo(() => {
    return resolveBookingPricing({
      customDurationHours: duration === 'custom' ? Number(customDuration) : 0,
      durationHours: Number(duration) || 0,
      packageId,
      paymentStatus: 'pending',
      dpAmount: 0,
      pricingSettings,
      recordingTypeId,
      sessionId: sessionType,
    });
  }, [sessionType, packageId, recordingTypeId, duration, customDuration, pricingSettings]);

  // Pre-filled WhatsApp message generator
  const whatsappUrl = useMemo(() => {
    const studioName = invoiceSettings.studioName || '37 Music Studio';
    const formattedDate = date ? new Date(date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const startHourNum = Number(startHour);
    const endHourNum = startHourNum + actualDuration;
    const timeString = actualDuration
      ? `${String(startHourNum).padStart(2, '0')}.00 - ${String(endHourNum).padStart(2, '0')}.00 WIB`
      : 'Tanpa jadwal studio utama';

    const selectedService = packageId !== 'none'
      ? (() => {
      const pkg = pricingSettings.packages?.find(p => p.id === packageId);
        return `Paket: ${pkg?.name || 'Paket Studio'}`;
      })()
      : (() => {
      const sess = sessionOptions.find(s => s.key === sessionType);
      const sub = recordingTypeId !== 'none' ? ` (${recordingTypeOptions.find(r => r.key === recordingTypeId)?.label.split(' • ')[0] || ''})` : '';
        return `Sesi: ${sess?.label || sessionType}${sub}`;
      })();

    const text = `Halo *${studioName}*, saya ingin booking slot studio:

👤 *Nama Pelanggan* : ${name || '(Belum diisi)'}
📞 *Nomor HP* : ${phone || '(Belum diisi)'}
🎤 *Layanan* : ${selectedService}
📅 *Tanggal* : ${formattedDate || date}
⏰ *Waktu* : ${actualDuration ? timeString + ' (' + actualDuration + ' Jam)' : timeString}
💰 *Estimasi Total* : ${formatRupiah(pricingBreakdown.total)}

Apakah slot jadwal tersebut masih tersedia? Terima kasih!`;

    return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`;
  }, [name, phone, sessionType, packageId, recordingTypeId, date, startHour, actualDuration, pricingBreakdown, invoiceSettings, whatsappPhone, pricingSettings.packages, sessionOptions, recordingTypeOptions]);

  async function handleBookingAction(event) {
    if (!currentUser) return;

    event.preventDefault();
    if (isSubmittingRequest) return;

    const contactWindow = window.open('about:blank', '_blank');
    if (contactWindow) contactWindow.opener = null;
    const selectedPackage = packageOptions.find((item) => item.key === packageId);
    const selectedSession = sessionOptions.find((item) => item.key === sessionType);
    const selectedRecording = recordingTypeOptions.find((item) => item.key === recordingTypeId);
    const sessionLabel = selectedPackage?.label || selectedRecording?.label?.split(' • ')[0] || selectedSession?.label || 'Sesi Studio';

    setIsSubmittingRequest(true);
    setBookingFeedback('');

    try {
      await adminBookingRepository.createClientBookingRequest(currentUser, {
        customer: name || currentUser.displayName || 'Client',
        phone: phone || currentUser.phoneNumber || '',
        packageId,
        packageLabel: selectedPackage?.label || '',
        pricingMode: pricingBreakdown.mode,
        sessionType: selectedPackage ? 'package' : sessionType,
        sessionLabel,
        recordingTypeId: recordingTypeId === 'none' ? '' : recordingTypeId,
        recordingTypeLabel: selectedRecording?.label || '',
        title: sessionLabel,
        date,
        startHour: Number(startHour),
        startTimeLabel: `${String(startHour).padStart(2, '0')}.00`,
        durationHours: actualDuration,
        subtotal: pricingBreakdown.subtotal,
        discountAmount: pricingBreakdown.discountAmount,
        appliedDiscounts: pricingBreakdown.appliedDiscounts,
        total: pricingBreakdown.total,
      });

      setBookingFeedback('Permintaan tersimpan dan sudah masuk ke dashboard admin.');
      if (contactWindow) contactWindow.location.replace(whatsappUrl);
    } catch (error) {
      if (contactWindow) contactWindow.close();
      console.error('Gagal menyimpan booking request:', error);
      setBookingFeedback('Gagal menyimpan permintaan. Silakan coba lagi.');
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  // Dynamic lists mapping icons to service cards
  const serviceCards = [
    {
      id: 'rehearsal',
      title: 'Studio Rehearsal',
      icon: <Music className="text-[var(--ui-accent)] w-5 h-5" />,
      desc: 'Latihan band dengan instrumen premium siap pakai.',
      tags: ['Latihan', 'Band', 'Rehearsal']
    },
    {
      id: 'recording',
      title: 'Professional Recording',
      icon: <Mic className="text-[var(--ui-accent)] w-5 h-5" />,
      desc: 'Tracking rekaman jernih untuk vokal dan instrumen.',
      tags: ['Vokal', 'Instrumen', 'Tracking']
    },
    {
      id: 'mixing',
      title: 'Mixing & Mastering',
      icon: <Sliders className="text-[var(--ui-accent)] w-5 h-5" />,
      desc: 'Finalisasi audio profesional agar lagu siap rilis.',
      tags: ['Mixing', 'Mastering', 'Release']
    }
  ];

  if (authLoading) {
    return (
      <div className="client-landing-loading theme-container">
        <div className="client-landing-bg-glow" aria-hidden="true" />
        <div className="client-landing-loading-card">
          <LoaderCircle className="client-landing-spin" size={32} />
          <p>Memuat portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="client-landing-page theme-container">
      {/* Background radial glow effect */}
      <div className="client-landing-bg-glow" aria-hidden="true" />
      
      {/* Header / Navbar */}
      <header className="client-landing-header">
        <div className="client-landing-brand">
          <div className="client-landing-brand-mark">
            <Volume2 size={16} />
          </div>
          <span className="client-landing-brand-text">37 MUSIC</span>
        </div>
        
        <nav className="client-landing-nav">
          <a href="#services" className="client-landing-nav-link">Fasilitas</a>
          <a href="#pricelist" className="client-landing-nav-link">Harga</a>
          <a href="#booking" className="client-landing-nav-link">Booking Slot</a>
          <a href="#location" className="client-landing-nav-link">Lokasi</a>
        </nav>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <>
              <button 
                onClick={() => navigate('/client/portal')}
                className="client-landing-top-action is-primary"
              >
                <span>Portal Saya</span>
                <ArrowRight size={12} />
              </button>
              <button 
                onClick={handleLogout}
                className="client-landing-top-action is-secondary"
                title="Keluar Portal"
              >
                <LogOut size={12} />
              </button>
            </>
          ) : (
            <button 
              onClick={() => navigate('/client/login')}
              className="client-landing-top-action is-primary"
            >
              <span>Masuk Portal</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </header>
 
      {/* Hero Section */}
      <main className="client-landing-main">
        <section className="client-landing-hero">
          <div className="client-landing-hero-copy">
            <div className="client-landing-kicker">
              <Sparkles size={11} className="animate-pulse" />
              <span>Studio Musik Premium</span>
            </div>
            
            <h1 className="client-landing-hero-title">
              Sewa Studio Musik. <br />
              <span className="client-landing-hero-accent">Booking Instan.</span>
            </h1>
            
            <p className="client-landing-hero-text">
              Pilih layanan latihan atau rekaman, hitung estimasi biaya secara otomatis, dan amankan slot jadwal Anda langsung via WhatsApp.
            </p>

            <div className="client-landing-hero-actions">
              <a href="#booking" className="client-landing-button is-primary">
                <span>PESAN JADWAL</span>
                <ArrowRight size={14} />
              </a>
              <a href="#pricelist" className="client-landing-button">
                <span>LIHAT HARGA</span>
              </a>
            </div>
          </div>

          {/* Banner Graphic Showcase for Tablet/Desktop */}
          <div className="client-landing-hero-visual">
            <img 
              src="/images/studio_hero_banner.png" 
              alt="37 Studio Banner Showcase" 
              className="client-landing-hero-image"
              loading="eager"
            />
            <div className="client-landing-hero-overlay" aria-hidden="true" />
            
            <div className="client-landing-hours-card">
              <div>
                <p>Jam Operasional</p>
                <h3>10.00 - 23.00 WIB</h3>
              </div>
              <div>
                <Flame size={11} />
                <span>Booking Slot</span>
              </div>
            </div>
          </div>
        </section>

        {/* Facilities Section */}
        <section id="services" className="space-y-4">
          <div>
            <h2>FASILITAS STUDIO</h2>
            <h3>Pilih Kebutuhan Sesi Anda</h3>
          </div>

          <div className="client-landing-services-scroll">
            {serviceCards.map((service) => (
              <div 
                key={service.id}
                style={{
                  background: 'var(--studio-surface-1)',
                  border: '1px solid var(--studio-border)',
                  borderRadius: 'var(--studio-radius-lg)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--studio-radius-md)',
                    background: 'var(--studio-surface-2)',
                    border: '1px solid var(--studio-border)',
                    display: 'grid',
                    placeItems: 'center'
                  }}>
                    {service.icon}
                  </div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--studio-text-strong)' }}>{service.title}</h4>
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--studio-text-muted)', lineHeight: '1.4' }}>{service.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--studio-border)' }}>
                  {service.tags.map((tag, i) => (
                    <span key={i} style={{ fontSize: '9px', color: 'var(--studio-text-main)', background: 'var(--studio-surface-2)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--studio-border)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Lists */}
        <section id="pricelist" className="space-y-6">
          <div>
            <h2>DAFTAR HARGA</h2>
            <h3>Estimasi Biaya Transparan</h3>
          </div>

          <div className="client-landing-pricing-scroll">
            {/* Sewa Per Jam */}
            <div style={{
              background: 'var(--studio-surface-1)',
              border: '1px solid var(--studio-border)',
              borderRadius: 'var(--studio-radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--studio-text-strong)' }}>Sewa Per Jam</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--studio-text-muted)' }}>Sewa flat regular untuk latihan band harian.</p>
                </div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--studio-border)', paddingTop: '10px' }}>
                  {displayedSessionOptions
                    .filter((item) => item.key === 'rehearsal' || item.key === 'mixing')
                    .map((item) => (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: '700', color: 'var(--studio-text-strong)' }}>{item.label}</p>
                          <p style={{ margin: 0, fontSize: '10px', color: 'var(--studio-text-muted)' }}>{item.description}</p>
                        </div>
                        <span style={{ color: 'var(--studio-accent)', fontWeight: '800' }}>
                          {formatRupiah(item.price)}
                          <span style={{ fontSize: '9px', fontWeight: 'normal', color: 'var(--studio-text-muted)' }}>
                            {item.isRecordingType ? `/${item.durationHours}j` : '/jam'}
                          </span>
                        </span>
                      </div>
                    ))}
                </div>
              </div>
              <a href="#booking" style={{
                marginTop: '16px',
                minHeight: '36px',
                background: 'var(--studio-surface-2)',
                border: '1px solid var(--studio-border)',
                borderRadius: 'var(--studio-radius-md)',
                color: 'var(--studio-text-strong)',
                fontSize: '11px',
                fontWeight: '700',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}>
                <span>Hitung Biaya Sesi</span>
                <ChevronRight size={12} />
              </a>
            </div>

            {/* Paket Hemat */}
            <div style={{
              background: 'var(--studio-surface-1)',
              border: '2px solid var(--studio-accent)',
              borderRadius: 'var(--studio-radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                background: 'var(--studio-accent)',
                color: '#000',
                fontSize: '9px',
                fontWeight: '900',
                padding: '2px 8px',
                borderBottomLeftRadius: 'var(--studio-radius-md)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Hemat
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--studio-text-strong)' }}>Paket Hemat</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--studio-text-muted)' }}>Pilihan ideal untuk durasi latihan panjang.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--studio-border)', paddingTop: '10px' }}>
                  {packageOptions.length > 0 ? (
                    packageOptions.slice(0, 2).map((pkg) => (
                      <div key={pkg.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '12px' }}>
                        <div style={{ maxWidth: '70%' }}>
                          <p style={{ margin: 0, fontWeight: '700', color: 'var(--studio-text-strong)' }}>{pkg.label}</p>
                          <p style={{ margin: '1px 0 0', fontSize: '10px', color: 'var(--studio-text-muted)' }}>{pkg.detail || pkg.description}</p>
                        </div>
                        <span style={{ color: 'var(--studio-accent)', fontWeight: '800', flexShrink: 0 }}>{formatRupiah(pkg.price)}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '11px', color: 'var(--studio-text-muted)' }}>
                      Belum ada paket khusus saat ini.
                    </div>
                  )}
                </div>
              </div>
              <a href="#booking" style={{
                marginTop: '16px',
                minHeight: '36px',
                background: 'linear-gradient(135deg, var(--studio-accent), var(--studio-accent-strong))',
                borderRadius: 'var(--studio-radius-md)',
                color: 'var(--studio-text-inverse)',
                fontSize: '11px',
                fontWeight: '700',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}>
                <span>Pilih Paket Hemat</span>
                <ChevronRight size={12} />
              </a>
            </div>

            {/* Recording */}
            <div style={{
              background: 'var(--studio-surface-1)',
              border: '1px solid var(--studio-border)',
              borderRadius: 'var(--studio-radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--studio-text-strong)' }}>Layanan Rekaman</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--studio-text-muted)' }}>Paket khusus berdasar jam tracking instrument.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--studio-border)', paddingTop: '10px' }}>
                  {recordingTypeOptions.length > 0 ? (
                    recordingTypeOptions.slice(0, 2).map((item) => (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <p style={{ margin: 0, fontWeight: '700', color: 'var(--studio-text-strong)' }}>{item.label}</p>
                        <span style={{ color: 'var(--studio-accent)', fontWeight: '800', flexShrink: 0 }}>{formatRupiah(item.price)}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '11px', color: 'var(--studio-text-muted)' }}>
                      Tarif reguler Flat Rp 150.000/jam.
                    </div>
                  )}
                </div>
              </div>
              <a href="#booking" style={{
                marginTop: '16px',
                minHeight: '36px',
                background: 'var(--studio-surface-2)',
                border: '1px solid var(--studio-border)',
                borderRadius: 'var(--studio-radius-md)',
                color: 'var(--studio-text-strong)',
                fontSize: '11px',
                fontWeight: '700',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}>
                <span>Pesan Recording</span>
                <ChevronRight size={12} />
              </a>
            </div>
          </div>

          {/* Active Promo Notice */}
          {discountOptions.length > 0 && (
            <div style={{
              padding: '12px',
              borderRadius: 'var(--studio-radius-md)',
              background: 'var(--ui-accent-bg)',
              border: '1px solid var(--studio-border)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              maxWidth: '600px',
              margin: '12px auto 0'
            }}>
              <Info className="shrink-0 w-4 h-4 mt-0.5" style={{ color: 'var(--studio-accent)' }} />
              <div>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: 'var(--studio-text-strong)' }}>Promo Diskon Aktif!</h5>
                <div style={{ fontSize: '11px', color: 'var(--studio-text-muted)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {discountOptions.map((disc) => (
                    <p key={disc.key} style={{ margin: 0 }}>
                      • Potongan harga <strong style={{ color: 'var(--studio-text-strong)' }}>{formatRupiah(disc.nominal)}</strong> untuk sesi <strong style={{ color: 'var(--studio-text-strong)' }}>{disc.description.split(' • ')[1] || ''}</strong> minimal sewa <strong style={{ color: 'var(--studio-text-strong)' }}>{disc.description.split(' • ')[0] || ''}</strong>.
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Interactive Booking Section */}
        <section id="booking" className="space-y-6">
          <div>
            <h2>PESAN JADWAL</h2>
            <h3>Request Booking Online</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="md:grid-cols-12">
            {/* Input Form Column */}
            <div style={{
              background: 'var(--studio-surface-1)',
              border: '1px solid var(--studio-border)',
              borderRadius: 'var(--studio-radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }} className="md:col-span-7">
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--studio-text-strong)', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--studio-border)', paddingBottom: '8px' }}>
                <Calendar size={16} style={{ color: 'var(--studio-accent)' }} />
                <span>Rincian Sesi</span>
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Name & Phone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }} className="sm:grid-cols-2">
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--studio-text-muted)' }}>NAMA ANDA / BAND</span>
                    <input 
                      type="text" 
                      placeholder="Masukkan nama..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 'var(--studio-radius-sm)',
                        background: 'var(--studio-surface-2)',
                        border: '1px solid var(--studio-border)',
                        color: '#fff',
                        outline: 'none'
                      }}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--studio-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>NOMOR WHATSAPP</span>
                      {currentUser?.phoneNumber && <span style={{ color: 'var(--studio-success)', fontSize: '8px', fontWeight: '900' }}>VERIFIED</span>}
                    </span>
                    <input 
                      type="tel" 
                      placeholder="Contoh: 081234..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 'var(--studio-radius-sm)',
                        background: 'var(--studio-surface-2)',
                        border: '1px solid var(--studio-border)',
                        color: '#fff',
                        outline: 'none'
                      }}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={Boolean(currentUser?.phoneNumber)}
                    />
                  </label>
                </div>

                {/* Booking Mode Switch: Package vs Sessions */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                  padding: '4px',
                  borderRadius: 'var(--studio-radius-md)',
                  background: 'var(--studio-surface-2)',
                  border: '1px solid var(--studio-border)'
                }}>
                  <button
                    type="button"
                    style={{
                      padding: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: 'var(--studio-radius-sm)',
                      border: 'none',
                      cursor: 'pointer',
                      background: packageId === 'none' ? 'var(--studio-accent)' : 'transparent',
                      color: packageId === 'none' ? '#000' : 'var(--studio-text-muted)'
                    }}
                    onClick={() => {
                      setPackageId('none');
                      setSessionType('rehearsal');
                    }}
                  >
                    Sewa Reguler
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: 'var(--studio-radius-sm)',
                      border: 'none',
                      cursor: 'pointer',
                      background: packageId !== 'none' ? 'var(--studio-accent)' : 'transparent',
                      color: packageId !== 'none' ? '#000' : 'var(--studio-text-muted)'
                    }}
                    onClick={() => {
                      if (packageOptions.length > 0) {
                        handlePackageChange(packageOptions[0].key);
                      } else {
                        alert('Belum ada paket kustom yang terdaftar.');
                      }
                    }}
                  >
                    Pilihan Paket
                  </button>
                </div>

                {/* Conditional dropdown selections */}
                {packageId !== 'none' ? (
                  <StudioSelect
                    label="Pilihan Paket Hemat"
                    options={packageOptions}
                    selectedKey={packageId}
                    onChange={handlePackageChange}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <StudioSelect
                      label="Pilih Layanan Studio"
                      options={sessionOptions}
                      selectedKey={sessionType}
                      onChange={handleSessionTypeChange}
                    />

                    {sessionType === 'recording' && recordingTypeOptions.length > 0 && (
                      <StudioSelect
                        label="Pilihan Jenis Recording"
                        options={finalRecordingTypeOptions}
                        selectedKey={recordingTypeId}
                        onChange={setRecordingTypeId}
                      />
                    )}
                  </div>
                )}

                {/* Date and Time Selector */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }} className="sm:grid-cols-2">
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--studio-text-muted)' }}>TANGGAL BOOKING</span>
                    <input 
                      type="date"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 'var(--studio-radius-sm)',
                        background: 'var(--studio-surface-2)',
                        border: '1px solid var(--studio-border)',
                        color: '#fff',
                        outline: 'none'
                      }}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  
                  <StudioSelect
                    label="Mulai Jam"
                    options={startHourOptions}
                    selectedKey={startHour}
                    onChange={setStartHour}
                  />
                </div>

                {/* Duration Picker (Only active for reguler sessions) */}
                {packageId === 'none' && recordingTypeId === 'none' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }} className="sm:grid-cols-2">
                    <StudioSelect
                      label="Durasi Sewa"
                      options={durationOptions}
                      selectedKey={duration}
                      onChange={setDuration}
                    />
                    
                    {duration === 'custom' && (
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--studio-text-muted)' }}>DURASI KUSTOM (JAM)</span>
                        <input 
                          type="number"
                          placeholder="Jumlah jam..."
                          min={1}
                          max={24}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 'var(--studio-radius-sm)',
                            background: 'var(--studio-surface-2)',
                            border: '1px solid var(--studio-border)',
                            color: '#fff',
                            outline: 'none'
                          }}
                          value={customDuration}
                          onChange={(e) => setCustomDuration(e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Calculations Summary and Actions */}
            <div style={{
              background: 'var(--studio-surface-1)',
              border: '1px solid var(--studio-border)',
              borderRadius: 'var(--studio-radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }} className="md:col-span-5">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--studio-text-strong)', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--studio-border)', paddingBottom: '8px' }}>
                  <Check size={16} style={{ color: 'var(--studio-accent)' }} />
                  <span>Rincian Biaya</span>
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--studio-text-muted)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Layanan Sesi:</span>
                    <span style={{ color: '#fff', fontWeight: '600' }}>
                      {packageId !== 'none' 
                        ? (packageOptions.find(p => p.key === packageId)?.label || 'Paket')
                        : (sessionOptions.find(s => s.key === sessionType)?.label || sessionType)}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Durasi:</span>
                    <span style={{ color: '#fff', fontWeight: '600' }}>{actualDuration} Jam</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal:</span>
                    <span style={{ color: '#fff', fontWeight: '600' }}>{formatRupiah(pricingBreakdown.subtotal)}</span>
                  </div>

                  {pricingBreakdown.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--studio-success)' }}>
                      <span>Promo Potongan:</span>
                      <span>-{formatRupiah(pricingBreakdown.discountAmount)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--studio-border)', paddingTop: '8px', fontSize: '13px', fontWeight: '800', color: '#fff' }}>
                    <span>Total Estimasi:</span>
                    <span style={{ color: 'var(--studio-accent)' }}>{formatRupiah(pricingBreakdown.total)}</span>
                  </div>
                </div>

                <div style={{
                  padding: '10px',
                  borderRadius: 'var(--studio-radius-md)',
                  background: 'var(--studio-surface-2)',
                  border: '1px solid var(--studio-border)',
                  fontSize: '11px',
                  color: 'var(--studio-text-muted)',
                  lineHeight: '1.4',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', fontWeight: '700', fontSize: '11px', marginBottom: '2px' }}>
                    <Info size={11} style={{ color: 'var(--studio-accent)' }} />
                    <span>Langkah Mudah Booking:</span>
                  </div>
                  <p style={{ margin: 0 }}>1. Lengkapi formulir rincian sesi.</p>
                  <p style={{ margin: 0 }}>2. Cek total estimasi biaya di atas.</p>
                  <p style={{ margin: 0 }}>3. Klik tombol WhatsApp untuk booking.</p>
                </div>
              </div>

              <div style={{ paddingTop: '16px' }}>
                <a 
                  href={whatsappUrl}
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={handleBookingAction}
                  aria-disabled={isSubmittingRequest}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    borderRadius: 'var(--studio-radius-md)',
                    background: '#2ecc71',
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: '12px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Phone size={13} />
                  <span>{isSubmittingRequest ? 'MENYIMPAN REQUEST...' : currentUser ? 'KIRIM REQUEST + WHATSAPP' : 'KIRIM JADWAL VIA WHATSAPP'}</span>
                </a>
                {bookingFeedback ? (
                  <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: '11px', color: 'var(--studio-text-muted)' }} role="status">{bookingFeedback}</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* Booking History Section */}
        <section id="history" className="space-y-6">
          <div>
            <h2>RIWAYAT BOOKING</h2>
            <h3>Jadwal Sesi Anda</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentUser && (
              <div style={{
                padding: '12px',
                borderRadius: 'var(--studio-radius-md)',
                background: 'var(--studio-surface-1)',
                border: '1px solid var(--studio-border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                fontSize: '12px'
              }} className="sm:flex-row">
                <span style={{ color: 'var(--studio-text-muted)', textAlign: 'center' }} className="sm:text-left">
                  Anda sedang masuk. Untuk melihat riwayat lengkap, sisa tagihan, dan kalender:
                </span>
                <button
                  onClick={() => navigate('/client/portal')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--studio-radius-sm)',
                    background: 'var(--studio-accent)',
                    color: '#000',
                    fontWeight: '800',
                    fontSize: '11px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0
                  }}
                >
                  <span>Buka Portal Saya</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            )}
            
            {!currentUser ? (
              <div style={{
                padding: '24px 16px',
                textAlign: 'center',
                borderRadius: 'var(--studio-radius-lg)',
                background: 'var(--studio-surface-1)',
                border: '1px solid var(--studio-border)',
                color: 'var(--studio-text-muted)',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CalendarDays size={24} style={{ color: 'var(--studio-text-muted)', opacity: 0.4 }} />
                <strong style={{ color: '#fff', fontSize: '13px' }}>Ingin melihat riwayat booking Anda?</strong>
                <p style={{ margin: 0, maxWidth: '280px', lineHeight: '1.4' }}>Masuk ke Portal Client untuk melihat jadwal sesi latihan atau rekaman aktif Anda.</p>
                <button
                  onClick={() => navigate('/client/login')}
                  style={{
                    marginTop: '4px',
                    padding: '8px 16px',
                    borderRadius: 'var(--studio-radius-full)',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>Masuk Portal</span>
                  <ChevronRight size={12} />
                </button>
              </div>
            ) : userBookings.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                borderRadius: 'var(--studio-radius-lg)',
                background: 'var(--studio-surface-1)',
                border: '1px solid var(--studio-border)',
                color: 'var(--studio-text-muted)',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CalendarDays size={24} style={{ color: 'var(--studio-text-muted)', opacity: 0.4 }} />
                <strong style={{ color: '#fff', fontSize: '13px' }}>Belum ada riwayat booking</strong>
                <p style={{ margin: 0, maxWidth: '280px', lineHeight: '1.4' }}>Silakan lakukan simulasi di kalkulator atas lalu kirim jadwal ke admin studio via WhatsApp.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {userBookings.map((booking) => {
                  const status = booking.paymentStatus || booking.status || 'pending';
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
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--studio-radius-lg)',
                        background: 'var(--studio-surface-1)',
                        border: '1px solid var(--studio-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        opacity: isVoid ? 0.5 : 1
                      }}
                      className="sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--studio-text-muted)', background: 'var(--studio-surface-2)', border: '1px solid var(--studio-border)', padding: '2px 6px', borderRadius: '4px' }}>
                            {booking.bookingCode || booking.bookingId || 'BKG'}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${getStatusBadgeClass(status)}`}>
                            {status === 'void' ? 'Void' : status === 'cancelled' ? 'Canceled' : status}
                          </span>
                        </div>

                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#fff' }}>
                          {booking.sessionLabel || booking.packageLabel || booking.title || 'Sesi Selesai'}
                        </h4>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: 'var(--studio-text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CalendarDays size={12} style={{ color: 'var(--studio-accent)' }} />
                            <span>{new Date(booking.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} style={{ color: 'var(--studio-accent)' }} />
                            <span>{timeString} ({durationNum} Jam)</span>
                          </span>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid var(--studio-border)',
                        paddingTop: '8px',
                        fontSize: '11px'
                      }} className="sm:border-t-0 sm:pt-0 sm:flex-col sm:items-end sm:gap-1">
                        <span style={{ color: 'var(--studio-text-muted)' }}>Total Biaya</span>
                        <strong style={{ fontSize: '13px', color: '#fff', fontWeight: '800' }}>{formatRupiah(booking.total || booking.subtotal || 0)}</strong>
                        {status === 'dp' && booking.dpAmount > 0 && (
                          <span style={{ fontSize: '9px', color: 'var(--studio-accent)', fontWeight: '700' }}>
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
        </section>

        {/* Location & Contacts */}
        <section id="location" className="space-y-6">
          <div>
            <h2>KONTAK & LOKASI</h2>
            <h3>Kunjungi Studio Kami</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="md:grid-cols-2">
            <div style={{
              background: 'var(--studio-surface-1)',
              border: '1px solid var(--studio-border)',
              borderRadius: 'var(--studio-radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--studio-radius-sm)',
                    background: 'var(--studio-surface-2)',
                    border: '1px solid var(--studio-border)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}>
                    <MapPin size={16} style={{ color: 'var(--studio-accent)' }} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#fff' }}>Alamat Studio</h4>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--studio-text-muted)', lineHeight: '1.4' }}>
                      {invoiceSettings.address || 'Alamat studio belum diatur.'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--studio-radius-sm)',
                    background: 'var(--studio-surface-2)',
                    border: '1px solid var(--studio-border)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}>
                    <Phone size={16} style={{ color: 'var(--studio-accent)' }} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#fff' }}>Telepon / WhatsApp</h4>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--studio-text-muted)', lineHeight: '1.4' }}>
                      {invoiceSettings.phone || 'Kontak studio belum diatur.'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--studio-radius-sm)',
                    background: 'var(--studio-surface-2)',
                    border: '1px solid var(--studio-border)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}>
                    <Shield size={16} style={{ color: 'var(--studio-accent)' }} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#fff' }}>Sistem Verifikasi Aman</h4>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--studio-text-muted)', lineHeight: '1.4' }}>
                      Pemesanan dicatat di basis data kami dan dikonfirmasi langsung oleh tim admin.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{
                padding: '10px',
                borderRadius: 'var(--studio-radius-md)',
                background: 'var(--studio-surface-2)',
                border: '1px solid var(--studio-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--studio-text-muted)'
              }}>
                <span>Punya pertanyaan khusus?</span>
                <a 
                  href={`https://wa.me/${whatsappPhone}?text=Halo%2037%20Music%20Studio%2C%20saya%20ingin%20bertanya%20mengenai...`} 
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--studio-accent)',
                    fontWeight: '700',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <span>Tanya Admin</span>
                  <ChevronRight size={12} />
                </a>
              </div>
            </div>

            {/* Visual branding container */}
            <div style={{
              background: 'var(--studio-surface-1)',
              border: '1px solid var(--studio-border)',
              borderRadius: 'var(--studio-radius-lg)',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              gap: '12px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--studio-surface-2)',
                border: '1px solid var(--studio-border)',
                display: 'grid',
                placeItems: 'center'
              }}>
                <Volume2 size={24} style={{ color: 'var(--studio-accent)' }} />
              </div>
              
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#fff' }}>{invoiceSettings.studioName || '37 Music Studio'}</h4>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--studio-text-muted)', maxWidth: '260px', lineHeight: '1.5' }}>
                Kami berkomitmen memberikan pengalaman bermusik terbaik untuk Anda. Silakan hubungi kami untuk kerja sama event, rental instrument, atau album recording.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Elegant minimalist footer */}
      <footer style={{ borderTop: '1px solid var(--studio-border)', background: '#050506', padding: '16px 0' }}>
        <div style={{
          width: '100%',
          maxWidth: '1020px',
          margin: '0 auto',
          paddingInline: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          fontSize: '11px',
          color: 'var(--studio-text-muted)'
        }} className="sm:flex-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'var(--studio-accent)', color: '#000', display: 'grid', placeItems: 'center', fontWeight: '900', fontSize: '9px' }}>37</div>
            <span style={{ fontWeight: '700', color: '#fff' }}>37 Music Studio</span>
          </div>
          <p style={{ margin: 0 }}>© {new Date().getFullYear()} {invoiceSettings.studioName || '37 Music Studio'}. All rights reserved.</p>
          <p style={{ margin: 0, fontSize: '9px' }}>Built for Musicians.</p>
        </div>
      </footer>
    </div>
  );
}

