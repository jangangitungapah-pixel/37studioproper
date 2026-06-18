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
import { collection, query, where, or, orderBy, onSnapshot } from 'firebase/firestore';
import { firebaseAuth, firestoreDb } from '../lib/firebase.js';
import '../styles/admin-auth.css';

export default function ClientLandingPage() {
  const pricingSettings = usePricingSettings();
  const invoiceSettings = useInvoiceSettings();

  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(firebaseAuth));
  const [userBookings, setUserBookings] = useState([]);

  // Form states for simulator (will be filled as soon as auth state resolves)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Client Auth Check
  useEffect(() => {
    if (!firebaseAuth) return;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        setCurrentUser(null);
      } else {
        setCurrentUser(user);
        
        // Auto pre-fill
        if (user.displayName) {
          setName(user.displayName);
        }
        if (user.phoneNumber) {
          const raw = user.phoneNumber.replace(/^\+/, '');
          setPhone(raw);
        }
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Real-time Booking History for Client
  useEffect(() => {
    if (!currentUser || !firestoreDb) return;

    const emailQueryStr = currentUser.email || '___no_email___';
    const phoneQueryStr = currentUser.phoneNumber || '___no_phone___';
    const phoneNormalized = phoneQueryStr.replace(/^\+/, '');

    const bookingsRef = collection(firestoreDb, 'bookings');
    const q = query(
      bookingsRef,
      or(
        where('email', '==', emailQueryStr),
        where('phone', '==', phoneQueryStr),
        where('phone', '==', phoneNormalized),
        where('customerPhoneKey', '==', phoneNormalized)
      ),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const bookingsList = [];
        snapshot.forEach((docSnap) => {
          bookingsList.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        setUserBookings(bookingsList);
      },
      (err) => {
        console.error('Error fetching client booking history:', err);
      }
    );

    return unsubscribe;
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
      return selectedPkg ? Number(selectedPkg.durationHours) : 2;
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
    const timeString = `${String(startHourNum).padStart(2, '0')}.00 - ${String(endHourNum).padStart(2, '0')}.00 WIB`;

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
⏰ *Waktu* : ${timeString} (${actualDuration} Jam)
💰 *Estimasi Total* : ${formatRupiah(pricingBreakdown.total)}

Apakah slot jadwal tersebut masih tersedia? Terima kasih!`;

    return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`;
  }, [name, phone, sessionType, packageId, recordingTypeId, date, startHour, actualDuration, pricingBreakdown, invoiceSettings, whatsappPhone, pricingSettings.packages, sessionOptions, recordingTypeOptions]);

  // Dynamic lists mapping icons to service cards
  const serviceCards = [
    {
      id: 'rehearsal',
      title: 'Studio Rehearsal',
      icon: <Music className="text-[var(--ui-accent)] w-6 h-6" />,
      desc: 'Latihan band reguler dengan instrumen premium standar konser dan akustik ruang berpresisi tinggi.',
      tags: ['DW Drums', 'Marshall & Fender Amplifiers', 'Vocal Monitors']
    },
    {
      id: 'recording',
      title: 'Professional Recording',
      icon: <Mic className="text-[var(--ui-accent)] w-6 h-6" />,
      desc: 'Layanan tracking rekaman multi-track dengan vocal booth kedap suara tinggi dan mikrofon berkelas studio dunia.',
      tags: ['Multi-track', 'Condenser Mics', 'Acoustic Isolation']
    },
    {
      id: 'mixing',
      title: 'Mixing & Mastering',
      icon: <Sliders className="text-[var(--ui-accent)] w-6 h-6" />,
      desc: 'Poles karya musik Anda dengan engineer handal untuk karakter sound lebar, punchy, dan siap rilis di platform digital.',
      tags: ['Industry Standard plugins', 'Balanced Mastering', 'Digital Release Ready']
    }
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050506] flex items-center justify-center font-sans">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#ff8a2a]/10 to-transparent pointer-events-none blur-[120px]" />
        <div className="flex flex-col items-center gap-4 z-10">
          <LoaderCircle className="animate-spin text-[#ff8a2a]" size={36} />
          <p className="text-sm text-[#f7f3ec]/60 tracking-wider">Memuat portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-container min-h-screen bg-[#050506] text-[var(--ui-text-main)] overflow-x-hidden">
      {/* Background radial glow effect */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#ff8a2a]/10 to-transparent pointer-events-none blur-[120px]" />
      
      {/* Header / Navbar */}
      <header className="relative w-full max-w-6xl mx-auto px-4 py-5 flex items-center justify-between border-b border-[var(--ui-border)] z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--ui-accent-strong)] to-[var(--ui-accent)] flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Volume2 className="text-white w-5 h-5" />
          </div>
          <span className="font-semibold text-lg tracking-wider text-white">37 MUSIC</span>
        </div>
        
        <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--ui-text-muted)] font-medium">
          <a href="#services" className="hover:text-white transition-colors">Fasilitas</a>
          <a href="#pricelist" className="hover:text-white transition-colors">Harga</a>
          <a href="#booking" className="hover:text-white transition-colors">Booking Slot</a>
          <a href="#location" className="hover:text-white transition-colors">Lokasi</a>
        </nav>

        <div className="flex items-center gap-4">
          {currentUser ? (
            <>
              <button 
                onClick={() => navigate('/client/portal')}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-[var(--ui-accent-strong)] to-[var(--ui-accent)] hover:opacity-90 text-white text-xs font-bold tracking-wider flex items-center gap-1.5 shadow-lg shadow-orange-500/10 transition-all hover:scale-[1.02]"
              >
                <span>Portal Saya</span>
                <ArrowRight size={13} />
              </button>
              <button 
                onClick={handleLogout}
                className="px-3 py-2 rounded-full bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-white/70 hover:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="Keluar Portal"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </>
          ) : (
            <button 
              onClick={() => navigate('/client/login')}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-[var(--ui-accent-strong)] to-[var(--ui-accent)] hover:opacity-90 text-white text-xs font-bold tracking-wider flex items-center gap-1.5 shadow-lg shadow-orange-500/10 transition-all hover:scale-[1.02]"
            >
              <span>Masuk Portal</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative w-full max-w-6xl mx-auto px-4 pt-12 pb-20 z-10">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Slogan and details */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] text-xs text-[var(--ui-accent)] font-semibold tracking-wide">
              <Sparkles size={12} className="animate-pulse" />
              <span>Premium Music Studio in Town</span>
            </div>
            
            <h1 
              className="text-5xl md:text-7xl text-white leading-tight font-normal tracking-wide drop-shadow-md select-none"
              style={{ fontFamily: "'RetroFloral', sans-serif" }}
            >
              Elevate <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--ui-accent)] via-orange-400 to-amber-500">Your Sound</span>
            </h1>
            
            <p className="text-base md:text-lg text-[var(--ui-text-muted)] max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Mainkan musik dengan fasilitas bintang lima. {invoiceSettings.studioName || '37 Music Studio'} hadir dengan instrumen legendaris, ruangan akustik terkalibrasi, dan kualitas rekaman berstandar internasional.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
              <a 
                href="#booking" 
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-[var(--ui-accent-strong)] to-[var(--ui-accent)] text-white font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-orange-600/30 hover:shadow-orange-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>PESAN JADWAL SEKARANG</span>
                <ArrowRight size={16} />
              </a>
              <a 
                href="#pricelist" 
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-[var(--ui-surface-soft)] hover:bg-[var(--ui-control)] text-white border border-[var(--ui-border)] font-bold text-sm tracking-wider flex items-center justify-center gap-2 hover:border-[var(--ui-border-strong)] transition-all"
              >
                <span>LIHAT DAFTAR HARGA</span>
              </a>
            </div>
          </div>

          {/* Banner Graphic Showcase */}
          <div className="lg:col-span-5 relative w-full aspect-[4/3] sm:aspect-video lg:aspect-square rounded-2xl overflow-hidden border border-[var(--ui-border)] shadow-2xl shadow-black/80">
            <img 
              src="/images/studio_hero_banner.png" 
              alt="37 Studio Banner Showcase" 
              className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-700 ease-out"
              loading="eager"
            />
            {/* Glass decoration overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050506]/90 via-[#050506]/20 to-transparent" />
            
            <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[var(--ui-bg-elevated)] backdrop-blur-md border border-[var(--ui-border)] flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--ui-text-muted)] uppercase tracking-wider font-semibold">Ready to Jam?</p>
                <h3 className="text-sm text-white font-bold">10.00 - 23.00 WIB</h3>
              </div>
              <div className="flex items-center gap-1 text-[var(--ui-accent)] font-semibold text-xs bg-[var(--ui-accent-soft)] px-2.5 py-1.5 rounded-lg border border-[var(--ui-accent-strong)]/20">
                <Flame size={12} />
                <span>Slot Terbatas</span>
              </div>
            </div>
          </div>
        </section>

        {/* Brand specs section */}
        <section id="services" className="pt-24 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs text-[var(--ui-accent)] uppercase tracking-[0.2em] font-bold">FASILITAS STUDIO</h2>
            <h3 className="text-2xl md:text-4xl text-white font-bold">Kualitas Premium Tanpa Kompromi</h3>
            <p className="text-sm text-[var(--ui-text-muted)] max-w-md mx-auto">
              Setiap sudut ruang didesain khusus oleh audio engineer berpengalaman untuk menghasilkan sound terbaik.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {serviceCards.map((service) => (
              <div 
                key={service.id}
                className="p-6 rounded-2xl bg-[var(--ui-surface-card)] border border-[var(--ui-border)] hover:border-[var(--ui-border-strong)] transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] flex items-center justify-center group-hover:bg-[var(--ui-accent-soft)] group-hover:border-[var(--ui-accent-strong)]/30 transition-colors">
                    {service.icon}
                  </div>
                  <h4 className="text-lg text-white font-bold">{service.title}</h4>
                  <p className="text-sm text-[var(--ui-text-muted)] leading-relaxed">{service.desc}</p>
                </div>
                
                <div className="mt-6 pt-4 border-t border-[var(--ui-border)] flex flex-wrap gap-2">
                  {service.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] text-white/90 bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Lists */}
        <section id="pricelist" className="pt-24 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs text-[var(--ui-accent)] uppercase tracking-[0.2em] font-bold">DAFTAR HARGA</h2>
            <h3 className="text-2xl md:text-4xl text-white font-bold">Investasi Terbaik Karya Musik Anda</h3>
            <p className="text-sm text-[var(--ui-text-muted)] max-w-md mx-auto">
              Tarif transparan dengan opsi sewa per jam atau paket hemat khusus.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Standard Sessions */}
            <div className="p-8 rounded-2xl bg-[var(--ui-surface-card)] border border-[var(--ui-border)] flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-6">
                <div>
                  <h4 className="text-xl text-white font-bold">Sewa Per Jam</h4>
                  <p className="text-xs text-[var(--ui-text-muted)] mt-1">Fleksibel untuk latihan santai atau mixing mandiri.</p>
                </div>
                
                <div className="space-y-4 border-t border-[var(--ui-border)] pt-4">
                  {displayedSessionOptions.map((item) => (
                    <div key={item.key} className="flex justify-between items-center text-sm">
                      <div>
                        <p className="text-white font-semibold">{item.label}</p>
                        <p className="text-[11px] text-[var(--ui-text-muted)]">{item.description}</p>
                      </div>
                      <span className="text-[var(--ui-accent)] font-bold">
                        {formatRupiah(item.price)}
                        <span className="text-[10px] text-[var(--ui-text-muted)] font-normal">
                          {item.isRecordingType ? ` / ${item.durationHours}jam` : '/jam'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-8">
                <a href="#booking" className="w-full py-3 rounded-xl bg-[var(--ui-surface-soft)] hover:bg-[var(--ui-control)] border border-[var(--ui-border)] text-white text-xs font-bold tracking-wide flex items-center justify-center gap-1 transition-colors">
                  <span>HITUNG BIAYA SESI</span>
                  <ChevronRight size={14} />
                </a>
              </div>
            </div>

            {/* Packages Card (Featured) */}
            <div className="p-8 rounded-2xl bg-[var(--ui-surface-card)] border-2 border-[var(--ui-accent)] flex flex-col justify-between relative overflow-hidden shadow-xl shadow-orange-500/5">
              <div className="absolute top-0 right-0 bg-[var(--ui-accent)] text-black text-[10px] uppercase font-black px-4 py-1.5 rounded-bl-xl tracking-wider">
                Rekomendasi
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-xl text-white font-bold">Paket Studio Hemat</h4>
                  <p className="text-xs text-[var(--ui-text-muted)] mt-1">Pilihan hemat untuk sesi latihan panjang atau rekaman demo.</p>
                </div>
                
                <div className="space-y-4 border-t border-white/10 pt-4">
                  {packageOptions.length > 0 ? (
                    packageOptions.map((pkg) => (
                      <div key={pkg.key} className="flex justify-between items-start text-sm">
                        <div className="max-w-[70%]">
                          <p className="text-white font-bold">{pkg.label}</p>
                          <p className="text-[11px] text-[var(--ui-text-muted)] leading-relaxed mt-0.5">{pkg.detail || pkg.description}</p>
                        </div>
                        <span className="text-[var(--ui-accent)] font-bold shrink-0">{formatRupiah(pkg.price)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-[var(--ui-text-muted)]">
                      Belum ada paket khusus saat ini. Hubungi kami untuk penawaran kustom.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <a href="#booking" className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--ui-accent-strong)] to-[var(--ui-accent)] text-white text-xs font-bold tracking-wide flex items-center justify-center gap-1 transition-transform hover:scale-[1.01]">
                  <span>PILIH PAKET SEKARANG</span>
                  <ChevronRight size={14} />
                </a>
              </div>
            </div>

            {/* Recording Types */}
            <div className="p-8 rounded-2xl bg-[var(--ui-surface-card)] border border-[var(--ui-border)] flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-6">
                <div>
                  <h4 className="text-xl text-white font-bold">Paket Rekaman (Recording)</h4>
                  <p className="text-xs text-[var(--ui-text-muted)] mt-1">Paket khusus berdasarkan waktu tracking vokal atau instrumen.</p>
                </div>
                
                <div className="space-y-4 border-t border-[var(--ui-border)] pt-4">
                  {recordingTypeOptions.length > 0 ? (
                    recordingTypeOptions.map((item) => (
                      <div key={item.key} className="flex justify-between items-center text-sm">
                        <div>
                          <p className="text-white font-semibold">{item.label}</p>
                        </div>
                        <span className="text-[var(--ui-accent)] font-bold shrink-0">{formatRupiah(item.price)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-[var(--ui-text-muted)]">
                      Layanan recording menggunakan tarif flat reguler Rp 150.000/jam.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <a href="#booking" className="w-full py-3 rounded-xl bg-[var(--ui-surface-soft)] hover:bg-[var(--ui-control)] border border-[var(--ui-border)] text-white text-xs font-bold tracking-wide flex items-center justify-center gap-1 transition-colors">
                  <span>PESAN LAYANAN RECORDING</span>
                  <ChevronRight size={14} />
                </a>
              </div>
            </div>
          </div>

          {/* Active Promo Notice */}
          {discountOptions.length > 0 && (
            <div className="p-4 rounded-xl bg-[var(--ui-accent-soft)] border border-[var(--ui-accent-strong)]/20 flex items-start gap-3 max-w-2xl mx-auto">
              <Info className="text-[var(--ui-accent)] shrink-0 w-5 h-5 mt-0.5" />
              <div>
                <h5 className="text-sm text-white font-bold">Promo Diskon Aktif!</h5>
                <div className="text-xs text-[var(--ui-text-muted)] space-y-1 mt-1">
                  {discountOptions.map((disc) => (
                    <p key={disc.key}>
                      • Potongan harga senilai <strong className="text-white">{formatRupiah(disc.nominal)}</strong> untuk sesi <strong className="text-white">{disc.description.split(' • ')[1]}</strong> minimal sewa <strong className="text-white">{disc.description.split(' • ')[0]}</strong>.
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Interactive Booking Section */}
        <section id="booking" className="pt-24 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs text-[var(--ui-accent)] uppercase tracking-[0.2em] font-bold">PESAN JADWAL</h2>
            <h3 className="text-2xl md:text-4xl text-white font-bold">Booking Kalkulator & Konfirmasi Instan</h3>
            <p className="text-sm text-[var(--ui-text-muted)] max-w-md mx-auto">
              Simulasikan jadwal dan biaya latihan Anda, lalu konfirmasikan langsung ke admin via WhatsApp untuk validasi instan.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Input Form Column */}
            <div className="md:col-span-7 p-6 rounded-2xl bg-[var(--ui-surface-card)] border border-[var(--ui-border)] space-y-5">
              <h4 className="text-base text-white font-bold flex items-center gap-2 border-b border-[var(--ui-border)] pb-3">
                <Calendar size={18} className="text-[var(--ui-accent)]" />
                <span>Isi Rincian Sesi Anda</span>
              </h4>

              <div className="space-y-4 text-sm">
                {/* Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1.5 block">
                    <span className="text-xs text-[var(--ui-text-muted)] font-medium">Nama Anda / Band</span>
                    <input 
                      type="text" 
                      placeholder="Masukkan nama..."
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] focus:border-[var(--ui-accent)] outline-none text-white transition-colors"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5 block">
                    <span className="text-xs text-[var(--ui-text-muted)] font-medium flex items-center justify-between">
                      <span>Nomor WhatsApp</span>
                      {currentUser?.phoneNumber && <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wider">Terverifikasi</span>}
                    </span>
                    <input 
                      type="tel" 
                      placeholder="Contoh: 081234..."
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] focus:border-[var(--ui-accent)] outline-none text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={Boolean(currentUser?.phoneNumber)}
                    />
                  </label>
                </div>

                {/* Booking Mode Switch: Package vs Sessions */}
                <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-[var(--ui-surface-soft)] border border-[var(--ui-border)]">
                  <button
                    type="button"
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${packageId === 'none' ? 'bg-[#ff8a2a] text-black shadow-md' : 'text-[var(--ui-text-muted)] hover:text-white'}`}
                    onClick={() => {
                      setPackageId('none');
                      setSessionType('rehearsal');
                    }}
                  >
                    Sewa Reguler
                  </button>
                  <button
                    type="button"
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${packageId !== 'none' ? 'bg-[#ff8a2a] text-black shadow-md' : 'text-[var(--ui-text-muted)] hover:text-white'}`}
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
                  <div className="space-y-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1.5 block">
                    <span className="text-xs text-[var(--ui-text-muted)] font-medium">Tanggal Booking</span>
                    <input 
                      type="date"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] focus:border-[var(--ui-accent)] outline-none text-white transition-colors"
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

                {/* Duration Picker (Only active for non-package selections) */}
                {packageId === 'none' && recordingTypeId === 'none' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StudioSelect
                      label="Durasi Sewa"
                      options={durationOptions}
                      selectedKey={duration}
                      onChange={setDuration}
                    />
                    
                    {duration === 'custom' && (
                      <label className="space-y-1.5 block">
                        <span className="text-xs text-[var(--ui-text-muted)] font-medium">Durasi Kustom (Jam)</span>
                        <input 
                          type="number"
                          placeholder="Jumlah jam..."
                          min={1}
                          max={24}
                          className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] focus:border-[var(--ui-accent)] outline-none text-white transition-colors"
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
            <div className="md:col-span-5 p-6 rounded-2xl bg-[var(--ui-surface-card)] border border-[var(--ui-border)] space-y-6 flex flex-col justify-between h-full relative">
              <div className="space-y-4">
                <h4 className="text-base text-white font-bold flex items-center gap-2 border-b border-[var(--ui-border)] pb-3">
                  <Check size={18} className="text-[var(--ui-accent)]" />
                  <span>Rincian Biaya</span>
                </h4>
                
                <div className="space-y-3 text-xs text-[var(--ui-text-muted)]">
                  <div className="flex justify-between">
                    <span>Layanan Sesi:</span>
                    <span className="text-white font-semibold">
                      {packageId !== 'none' 
                        ? (packageOptions.find(p => p.key === packageId)?.label || 'Paket')
                        : (sessionOptions.find(s => s.key === sessionType)?.label || sessionType)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Durasi:</span>
                    <span className="text-white font-semibold">{actualDuration} Jam</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="text-white font-semibold">{formatRupiah(pricingBreakdown.subtotal)}</span>
                  </div>

                  {pricingBreakdown.discountAmount > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Promo Potongan:</span>
                      <span>-{formatRupiah(pricingBreakdown.discountAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-[var(--ui-border)] pt-3 text-sm font-bold text-white">
                    <span>Total Estimasi:</span>
                    <span className="text-[var(--ui-accent)]">{formatRupiah(pricingBreakdown.total)}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] space-y-2 text-xs text-[var(--ui-text-muted)] leading-relaxed">
                  <div className="flex items-center gap-1.5 text-white font-bold text-[11px] mb-1">
                    <Info size={12} className="text-[var(--ui-accent)]" />
                    <span>Langkah Mudah Booking:</span>
                  </div>
                  <p>1. Lengkapi formulir di sebelah kiri.</p>
                  <p>2. Periksa detail rincian biaya di atas.</p>
                  <p>3. Klik tombol WhatsApp untuk mengirim detail booking.</p>
                  <p>4. Admin studio akan mengonfirmasi slot & pembayaran.</p>
                </div>
              </div>

              <div className="pt-6">
                <a 
                  href={whatsappUrl}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-4 rounded-xl bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-green-500/10 transition-transform active:scale-[0.98]"
                >
                  <Phone size={14} />
                  <span>KIRIM JADWAL VIA WHATSAPP</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Booking History Section */}
        <section id="history" className="pt-24 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-xs text-[var(--ui-accent)] uppercase tracking-[0.2em] font-bold">RIWAYAT BOOKING</h2>
            <h3 className="text-2xl md:text-4xl text-white font-bold">Jadwal Sesi Anda</h3>
            <p className="text-sm text-[var(--ui-text-muted)] max-w-md mx-auto">
              Semua riwayat pemesanan studio yang terhubung dengan akun Anda.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
            {currentUser && (
              <div className="p-4 rounded-xl bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <span className="text-[var(--ui-text-muted)] text-xs text-center sm:text-left">
                  Anda sedang masuk. Untuk melihat riwayat lengkap, sisa tagihan, dan jadwal kalender aktif:
                </span>
                <button
                  onClick={() => navigate('/client/portal')}
                  className="px-4 py-2 rounded-lg bg-[var(--ui-accent)] text-black font-bold text-xs flex items-center gap-1.5 hover:opacity-90 transition-all shrink-0 shadow-md shadow-orange-500/10"
                >
                  <span>Buka Portal Saya</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
            {!currentUser ? (
              <div className="p-8 text-center rounded-2xl bg-[var(--ui-surface-card)] border border-[var(--ui-border)] text-[var(--ui-text-muted)] text-sm space-y-3 relative overflow-hidden">
                {/* Ambient glow decoration */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[120px] rounded-full bg-[var(--ui-accent)]/5 filter blur-[40px] pointer-events-none" />
                <CalendarDays size={28} className="mx-auto text-white/25 mb-1" />
                <strong className="text-white">Ingin melihat riwayat booking Anda?</strong>
                <p className="text-xs max-w-xs mx-auto text-[var(--ui-text-muted)]">Masuk ke Portal Client untuk melihat jadwal sesi latihan atau rekaman aktif Anda secara langsung.</p>
                <button
                  onClick={() => navigate('/client/login')}
                  className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all mt-2"
                >
                  <span>Masuk Portal</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            ) : userBookings.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[var(--ui-surface-card)] border border-[var(--ui-border)] text-[var(--ui-text-muted)] text-sm space-y-2">
                <CalendarDays size={28} className="mx-auto text-white/25 mb-2" />
                <strong>Belum ada riwayat booking</strong>
                <p className="text-xs max-w-xs mx-auto">Silakan lakukan simulasi di kalkulator atas lalu kirim jadwal ke admin studio via WhatsApp.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {userBookings.map((booking) => {
                  const status = booking.paymentStatus || booking.status || 'pending';
                  const isVoid = status === 'void' || status === 'cancelled';
                  
                  // Helper function to format status badge class
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
                      className={`relative overflow-hidden p-5 rounded-2xl backdrop-blur-md bg-white/[0.02] border border-white/5 hover:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all duration-300 ${isVoid ? 'opacity-50' : ''}`}
                    >
                      {/* Spatial ambient glow for each booking row */}
                      {!isVoid && (
                        <div className={`absolute top-0 right-0 w-[80px] h-[80px] rounded-full filter blur-[40px] opacity-[0.04] pointer-events-none ${status === 'lunas' ? 'bg-green-500' : status === 'dp' ? 'bg-orange-500' : 'bg-amber-500'}`} />
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--ui-text-muted)] font-semibold tracking-wider bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                            {booking.bookingCode || booking.bookingId || 'BKG'}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${getStatusBadgeClass(status)}`}>
                            {status === 'void' ? 'Void' : status === 'cancelled' ? 'Canceled' : status}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-white leading-tight">
                          {booking.sessionLabel || booking.packageLabel || booking.title || 'Sesi Selesai'}
                        </h4>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ui-text-muted)]">
                          <span className="flex items-center gap-1">
                            <CalendarDays size={13} className="text-[#ff8a2a]" />
                            <span>{new Date(booking.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={13} className="text-[#ff8a2a]" />
                            <span>{timeString} ({durationNum} Jam)</span>
                          </span>
                        </div>
                      </div>

                      <div className="sm:text-right flex sm:flex-col justify-between items-center sm:items-end gap-2 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0 shrink-0">
                        <span className="text-xs text-[var(--ui-text-muted)]">Total Biaya</span>
                        <strong className="text-base text-white">{formatRupiah(booking.total || booking.subtotal || 0)}</strong>
                        {status === 'dp' && booking.dpAmount > 0 && (
                          <span className="text-[10px] text-orange-400 font-medium">
                            DP: {formatRupiah(booking.dpAmount)} (Sisa: {formatRupiah((booking.total || 0) - booking.dpAmount)})
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
        <section id="location" className="pt-24 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs text-[var(--ui-accent)] uppercase tracking-[0.2em] font-bold">KONTAK & LOKASI</h2>
            <h3 className="text-2xl md:text-4xl text-white font-bold">Kunjungi Studio Kami</h3>
            <p className="text-sm text-[var(--ui-text-muted)] max-w-md mx-auto">
              Silakan datang langsung atau hubungi kontak kami jika memerlukan bantuan kustom.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Info Cards */}
            <div className="p-6 rounded-2xl bg-[var(--ui-surface-card)] border border-[var(--ui-border)] flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] flex items-center justify-center shrink-0">
                    <MapPin className="text-[var(--ui-accent)] w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm text-white font-bold">Alamat Studio</h4>
                    <p className="text-xs text-[var(--ui-text-muted)] leading-relaxed mt-1">
                      {invoiceSettings.address || 'Alamat studio belum diatur.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] flex items-center justify-center shrink-0">
                    <Phone className="text-[var(--ui-accent)] w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm text-white font-bold">Telepon / WhatsApp</h4>
                    <p className="text-xs text-[var(--ui-text-muted)] leading-relaxed mt-1">
                      {invoiceSettings.phone || 'Kontak studio belum diatur.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] flex items-center justify-center shrink-0">
                    <Shield className="text-[var(--ui-accent)] w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm text-white font-bold">Sistem Verifikasi Aman</h4>
                    <p className="text-xs text-[var(--ui-text-muted)] leading-relaxed mt-1">
                      Setiap pemesanan akan dicatat di basis data kami dan dikonfirmasi langsung oleh tim admin.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] flex items-center justify-between text-xs text-[var(--ui-text-muted)]">
                <span>Punya pertanyaan khusus?</span>
                <a 
                  href={`https://wa.me/${whatsappPhone}?text=Halo%2037%20Music%20Studio%2C%20saya%20ingin%20bertanya%20mengenai...`} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ui-accent)] font-semibold flex items-center gap-1 hover:underline"
                >
                  <span>Tanya Admin</span>
                  <ChevronRight size={12} />
                </a>
              </div>
            </div>

            {/* Visual branding container */}
            <div className="p-6 rounded-2xl bg-[var(--ui-surface-card)] border border-[var(--ui-border)] flex flex-col justify-center items-center text-center space-y-4 relative overflow-hidden">
              {/* Subtle background overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[var(--ui-accent-soft)] via-transparent to-transparent opacity-30 pointer-events-none" />
              
              <div className="w-16 h-16 rounded-full bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] flex items-center justify-center shadow-lg shadow-orange-500/5">
                <Volume2 className="text-[var(--ui-accent)] w-8 h-8" />
              </div>
              
              <h4 className="text-lg text-white font-bold">{invoiceSettings.studioName || '37 Music Studio'}</h4>
              <p className="text-xs text-[var(--ui-text-muted)] max-w-xs leading-relaxed">
                Kami berkomitmen memberikan pengalaman bermusik terbaik untuk Anda. Silakan hubungi kami untuk informasi kerja sama, event, atau paket rekaman album.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Elegant minimalist footer */}
      <footer className="w-full border-t border-[var(--ui-border)] bg-[#030304]">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--ui-text-muted)] gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[var(--ui-accent)] flex items-center justify-center text-black font-extrabold text-[10px]">37</div>
            <span className="font-semibold text-white">37 Music Studio</span>
          </div>
          <p>© {new Date().getFullYear()} {invoiceSettings.studioName || '37 Music Studio'}. All rights reserved.</p>
          <p className="text-[10px]">Built for Musicians.</p>
        </div>
      </footer>
    </div>
  );
}
