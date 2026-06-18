import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  Calendar,
  History,
  CreditCard,
  LogOut,
  User,
  Sparkles,
  Clock,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  AlertCircle,
  Phone,
  Clock3,
  Info,
  Volume2,
  Receipt
} from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase.js';
import { adminBookingRepository } from '../services/adminBookingRepository.js';
import {
  usePricingSettings,
  formatRupiah,
  resolveBookingPricing,
  getSessionOptions,
  getRecordingTypeOptions,
  getPackageOptions
} from '../settings/pricingSettings.js';
import { useInvoiceSettings } from '../settings/invoiceSettings.js';
import { businessHours, durationOptions, statusFilters } from './admin/scheduleConfig.js';
import StudioSelect from '../components/ui/StudioSelect.jsx';
import '../styles/admin-auth.css';

// Simple Calendar Helper Functions (aligned with admin SchedulePage)
const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const shortMonthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];
const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}
function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}
function getWeekStart(date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(date), diff);
}
function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
function isSameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}
function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}
function formatRangeLabel(date, viewMode) {
  if (viewMode === 'day') {
    return dayNames[date.getDay()] + ', ' + date.getDate() + ' ' + monthNames[date.getMonth()] + ' ' + date.getFullYear();
  }
  if (viewMode === 'week') {
    const start = getWeekStart(date);
    const end = addDays(start, 6);
    return start.getDate() + ' ' + shortMonthNames[start.getMonth()] + ' - ' + end.getDate() + ' ' + shortMonthNames[end.getMonth()] + ' ' + end.getFullYear();
  }
  return monthNames[date.getMonth()] + ' ' + date.getFullYear();
}
function getVisibleDays(date, viewMode) {
  if (viewMode === 'day') return [startOfDay(date)];
  if (viewMode === 'week') {
    const weekStart = getWeekStart(date);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }
  return Array.from({ length: getDaysInMonth(date) }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index + 1));
}
function shiftDate(date, viewMode, direction) {
  if (viewMode === 'day') return addDays(date, direction);
  if (viewMode === 'week') return addDays(date, direction * 7);
  return addMonths(date, direction);
}
function getGridTemplate(viewMode, visibleDayCount) {
  if (viewMode === 'day') return '112px minmax(280px, 1fr)';
  if (viewMode === 'week') return '112px repeat(' + visibleDayCount + ', minmax(126px, 1fr))';
  return '112px repeat(' + visibleDayCount + ', minmax(92px, 1fr))';
}
function getSlotSpanRows(booking, startIndex) {
  const duration = Math.max(1, Math.ceil(Number(booking.durationHours) || 1));
  const availableRows = businessHours.length - startIndex;
  return Math.max(1, Math.min(duration, availableRows));
}
function getBookingStatus(booking) {
  return booking.paymentStatus || booking.status || 'pending';
}
function getStatusLabel(status) {
  return statusFilters.find((item) => item.key === status)?.label || status;
}
function formatShortCurrency(value) {
  const safeValue = Math.max(0, Number(value) || 0);
  if (safeValue >= 1000000) {
    const millionValue = safeValue / 1000000;
    return 'Rp ' + millionValue.toFixed(millionValue % 1 === 0 ? 0 : 1).replace('.', ',') + 'jt';
  }
  if (safeValue >= 1000) {
    return 'Rp ' + Math.round(safeValue / 1000) + 'rb';
  }
  return 'Rp ' + safeValue;
}

// Block lane solver (identical to admin layout logic)
function getVisibleBookingBlocks(bookings, visibleDays) {
  const visibleDayKeys = visibleDays.map(toIsoDate);
  const activeStatuses = ['pending', 'dp', 'lunas']; // show all reserved/occupied slots

  const rawBlocks = bookings
    .map((booking) => {
      const status = getBookingStatus(booking);
      const dayIndex = visibleDayKeys.indexOf(booking.date);
      const startHour = Number(booking.startHour);
      const startIndex = businessHours.findIndex((hour) => Number(hour.start) === startHour);

      // exclude cancelled / inactive bookings
      const bookingStatusLower = (booking.paymentStatus || booking.status || 'pending').toLowerCase();
      const isCancelled = ['cancelled', 'canceled', 'void', 'deleted'].includes(bookingStatusLower);

      if (dayIndex === -1 || startIndex === -1 || isCancelled || !activeStatuses.includes(status)) {
        return null;
      }

      const spanRows = getSlotSpanRows(booking, startIndex);
      const rowStart = startIndex + 2;
      const endIndex = startIndex + spanRows;

      return {
        booking,
        dayIndex,
        dayKey: booking.date,
        endIndex,
        rowStart,
        spanRows,
        startIndex,
        status,
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      if (first.dayIndex !== second.dayIndex) return first.dayIndex - second.dayIndex;
      if (first.startIndex !== second.startIndex) return first.startIndex - second.startIndex;
      return second.spanRows - first.spanRows;
    });

  const blocksByDay = rawBlocks.reduce((groups, block) => {
    groups[block.dayKey] = groups[block.dayKey] || [];
    groups[block.dayKey].push(block);
    return groups;
  }, {});

  Object.values(blocksByDay).forEach((dayBlocks) => {
    const laneEnds = [];
    dayBlocks.forEach((block) => {
      let laneIndex = laneEnds.findIndex((endIndex) => endIndex <= block.startIndex);
      if (laneIndex === -1) {
        laneIndex = laneEnds.length;
        laneEnds.push(block.endIndex);
      } else {
        laneEnds[laneIndex] = block.endIndex;
      }
      block.laneIndex = laneIndex;
    });
    dayBlocks.forEach((block) => {
      const overlappingBlocks = dayBlocks.filter(
        (candidate) =>
          candidate.startIndex < block.endIndex &&
          candidate.endIndex > block.startIndex
      );
      const maxLaneIndex = overlappingBlocks.reduce(
        (maxLane, candidate) => Math.max(maxLane, candidate.laneIndex || 0),
        block.laneIndex || 0
      );
      block.laneCount = maxLaneIndex + 1;
    });
  });

  return rawBlocks;
}

function getBookingBlockStyle(block) {
  const style = {
    gridColumn: String(block.dayIndex + 2),
    gridRow: String(block.rowStart) + ' / span ' + String(block.spanRows),
  };
  if (block.laneCount > 1) {
    const laneWidth = 100 / block.laneCount;
    style.width = 'calc(' + laneWidth.toFixed(4) + '% - 8px)';
    style.marginLeft = 'calc(' + (laneWidth * block.laneIndex).toFixed(4) + '% + 5px)';
    style.marginRight = '3px';
  }
  return style;
}

// Calendar Booking Block for Client Portal
function ClientCalendarBookingBlock({ block, onBookingClick, isOwn }) {
  const booking = block.booking;
  const title = isOwn ? (booking.title || booking.sessionLabel || 'Sesi Latihan') : 'Terisi';
  const customerName = isOwn ? (booking.customer || 'Saya') : 'Terjadwal';
  const statusLabel = isOwn ? getStatusLabel(block.status) : '';
  const startHourNum = Number(booking.startHour);
  const durationNum = Number(booking.durationHours) || block.spanRows;
  const startLabel = String(startHourNum).padStart(2, '0') + '.00';
  const durationLabel = durationNum + 'j';
  const priceLabel = isOwn ? formatShortCurrency(booking.total || booking.subtotal || 0) : '';

  return (
    <button
      aria-label={isOwn ? `Booking ${customerName} ${startLabel} ${durationLabel}` : 'Slot Terisi'}
      className={`schedule-booking-block ${isOwn ? 'is-' + block.status : 'is-occupied-other'}`}
      style={getBookingBlockStyle(block)}
      type="button"
      onClick={isOwn ? () => onBookingClick(booking) : undefined}
      disabled={!isOwn}
    >
      <span className="schedule-booking-glow" aria-hidden="true" />
      <span className="schedule-booking-topline">
        <strong>{customerName}</strong>
        {isOwn && <em>{statusLabel}</em>}
      </span>
      <span className="schedule-booking-title">{title}</span>
      <span className="schedule-booking-meta">
        <span>{startLabel} • {durationLabel}</span>
        {isOwn && <b>{priceLabel}</b>}
      </span>
    </button>
  );
}

export default function ClientPortalPage() {
  const navigate = useNavigate();
  const pricingSettings = usePricingSettings();
  const invoiceSettings = useInvoiceSettings();

  // Authentication & Loading States
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(firebaseAuth));

  // Tab State
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'calendar' | 'history' | 'billing'

  // Booking Data State
  const [bookings, setBookings] = useState([]);
  const [calendarSlots, setCalendarSlots] = useState([]);
  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null);

  // Calendar parameters
  const [calendarViewMode, setCalendarViewMode] = useState('week'); // 'day' | 'week' | 'month'
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => startOfDay(new Date()));

  // Interactive booking form simulator inside calendar
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorDate, setSimulatorDate] = useState('');
  const [simulatorStartHour, setSimulatorStartHour] = useState('10');
  const [simSessionType, setSimSessionType] = useState('rehearsal');
  const [simPackageId, setSimPackageId] = useState('none');
  const [simRecordingTypeId, setSimRecordingTypeId] = useState('none');
  const [simDuration, setSimDuration] = useState('2');
  const [simCustomDuration, setSimCustomDuration] = useState('');

  // Client Check Auth
  useEffect(() => {
    if (!firebaseAuth) return;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        navigate('/client/login', { replace: true });
      } else {
        setCurrentUser(user);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  // Load client-owned bookings from Firestore
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = adminBookingRepository.subscribeClientBookingsForUser(
      currentUser,
      (data) => setBookings(data),
      (err) => console.error('Gagal mengambil booking client:', err)
    );
    return unsubscribe;
  }, [currentUser]);

  // Load public-safe occupied slots mirrored from admin schedule
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = adminBookingRepository.subscribeClientCalendarSlots(
      (data) => setCalendarSlots(data),
      (err) => console.error('Gagal mengambil slot calendar client:', err)
    );
    return unsubscribe;
  }, [currentUser]);

  // Filter Bookings belonging to Current Client
  const userBookings = useMemo(() => {
    if (!currentUser) return [];
    const emailStr = (currentUser.email || '').toLowerCase();
    const phoneStr = currentUser.phoneNumber || '';
    const phoneNormalized = phoneStr.replace(/^\+/, '');

    return bookings.filter((b) => {
      const bEmail = (b.email || '').toLowerCase();
      const bPhone = (b.phone || '').replace(/^\+/, '');
      const bPhoneKey = (b.customerPhoneKey || '').replace(/^\+/, '');

      return (
        (emailStr && bEmail === emailStr) ||
        (phoneNormalized && bPhone === phoneNormalized) ||
        (phoneNormalized && bPhoneKey === phoneNormalized)
      );
    });
  }, [bookings, currentUser]);

  const calendarBookings = useMemo(() => {
    const ownBookingsById = new Map(
      userBookings
        .filter((booking) => booking.id)
        .map((booking) => [
          booking.id,
          {
            ...booking,
            isOwnClientBooking: true,
          },
        ])
    );

    const mergedSlotIds = new Set();

    const mergedSlots = calendarSlots.map((slot) => {
      const bookingId = slot.bookingId || slot.id;
      const ownBooking = ownBookingsById.get(bookingId);

      mergedSlotIds.add(bookingId);

      if (ownBooking) {
        return {
          ...slot,
          ...ownBooking,
          bookingId,
          id: ownBooking.id,
          isOwnClientBooking: true,
        };
      }

      return {
        ...slot,
        bookingId,
        id: slot.id || bookingId,
        isPublicClientSlot: true,
      };
    });

    userBookings.forEach((booking) => {
      if (booking.id && !mergedSlotIds.has(booking.id)) {
        mergedSlots.push({
          ...booking,
          bookingId: booking.id,
          isOwnClientBooking: true,
        });
      }
    });

    return mergedSlots;
  }, [calendarSlots, userBookings]);

  // Dashboard Stats Calculations
  const stats = useMemo(() => {
    const totalBookings = userBookings.length;

    // completed = lunas or dp status, non-cancelled
    const completedBookings = userBookings.filter((b) => {
      const status = (b.paymentStatus || b.status || 'pending').toLowerCase();
      return (status === 'lunas' || status === 'dp');
    }).length;

    // sum active completed hours
    const totalDuration = userBookings.reduce((sum, b) => {
      const status = (b.paymentStatus || b.status || 'pending').toLowerCase();
      if (['cancelled', 'canceled', 'void', 'deleted'].includes(status)) return sum;
      return sum + (Number(b.durationHours) || Number(b.duration) || 0);
    }, 0);

    // unpaid outstanding amount
    const unpaidAmount = userBookings.reduce((sum, b) => {
      const status = (b.paymentStatus || b.status || 'pending').toLowerCase();
      if (['cancelled', 'canceled', 'void', 'deleted', 'lunas'].includes(status)) return sum;
      if (status === 'dp') {
        return sum + Math.max(0, (Number(b.total) || 0) - (Number(b.dpAmount) || 0));
      }
      return sum + (Number(b.total) || 0);
    }, 0);

    return {
      totalBookings,
      completedBookings,
      totalDuration,
      unpaidAmount
    };
  }, [userBookings]);

  // Unpaid bookings list
  const unpaidBookings = useMemo(() => {
    return userBookings.filter((b) => {
      const status = (b.paymentStatus || b.status || 'pending').toLowerCase();
      if (['cancelled', 'canceled', 'void', 'deleted', 'lunas'].includes(status)) return false;
      return true;
    });
  }, [userBookings]);

  const handleLogout = async () => {
    try {
      await signOut(firebaseAuth);
      navigate('/client', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Pricing Options derived from settings
  const sessionOptions = useMemo(() => getSessionOptions(pricingSettings), [pricingSettings]);
  const recordingTypeOptions = useMemo(() => getRecordingTypeOptions(pricingSettings), [pricingSettings]);
  const packageOptions = useMemo(() => getPackageOptions(pricingSettings), [pricingSettings]);

  const finalRecordingTypeOptions = useMemo(() => {
    return [
      { key: 'none', label: 'Sewa Flat Per Jam', description: 'Tarif reguler per jam' },
      ...recordingTypeOptions
    ];
  }, [recordingTypeOptions]);

  const handleSessionTypeChange = (val) => {
    setSimSessionType(val);
    setSimPackageId('none');
    setSimRecordingTypeId('none');
  };

  const handlePackageChange = (val) => {
    setSimPackageId(val);
    if (val !== 'none') {
      setSimSessionType('rehearsal');
      setSimRecordingTypeId('none');
    }
  };

  // Determine actual duration hours
  const actualDuration = useMemo(() => {
    if (simPackageId !== 'none') {
      const selectedPkg = pricingSettings.packages?.find(p => p.id === simPackageId);
      return selectedPkg ? Number(selectedPkg.durationHours) : 2;
    }
    if (simDuration === 'custom') {
      return Math.max(1, Number(simCustomDuration) || 1);
    }
    return Number(simDuration) || 2;
  }, [simPackageId, simDuration, simCustomDuration, pricingSettings.packages]);

  // Resolve pricing via utility
  const pricingBreakdown = useMemo(() => {
    return resolveBookingPricing({
      customDurationHours: simDuration === 'custom' ? Number(simCustomDuration) : 0,
      durationHours: Number(simDuration) || 0,
      packageId: simPackageId,
      paymentStatus: 'pending',
      dpAmount: 0,
      pricingSettings,
      recordingTypeId: simRecordingTypeId,
      sessionId: simSessionType,
    });
  }, [simSessionType, simPackageId, simRecordingTypeId, simDuration, simCustomDuration, pricingSettings]);

  // WhatsApp phone normalization
  const whatsappPhone = useMemo(() => {
    const rawPhone = invoiceSettings.phone || '';
    let cleaned = rawPhone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }
    return cleaned || '628123456789';
  }, [invoiceSettings.phone]);

  // Pre-filled WhatsApp message generator
  const whatsappUrl = useMemo(() => {
    const studioName = invoiceSettings.studioName || '37 Music Studio';
    const formattedDate = simulatorDate ? new Date(simulatorDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const startHourNum = Number(simulatorStartHour);
    const endHourNum = startHourNum + actualDuration;
    const timeString = `${String(startHourNum).padStart(2, '0')}.00 - ${String(endHourNum).padStart(2, '0')}.00 WIB`;

    const selectedService = simPackageId !== 'none'
      ? (() => {
          const pkg = pricingSettings.packages?.find(p => p.id === simPackageId);
          return `Paket: ${pkg?.name || 'Paket Studio'}`;
        })()
      : (() => {
          const sess = sessionOptions.find(s => s.key === simSessionType);
          const sub = simRecordingTypeId !== 'none' ? ` (${recordingTypeOptions.find(r => r.key === simRecordingTypeId)?.label.split(' • ')[0] || ''})` : '';
          return `Sesi: ${sess?.label || simSessionType}${sub}`;
        })();

    const clientName = currentUser?.displayName || 'Pelanggan';
    const clientPhone = currentUser?.phoneNumber || '';

    const text = `Halo *${studioName}*, saya ingin booking slot studio via Client Portal:

👤 *Nama Pelanggan* : ${clientName}
📞 *Nomor HP* : ${clientPhone || '(Via Google/Email)'}
🎤 *Layanan* : ${selectedService}
📅 *Tanggal* : ${formattedDate || simulatorDate}
⏰ *Waktu* : ${timeString} (${actualDuration} Jam)
💰 *Estimasi Total* : ${formatRupiah(pricingBreakdown.total)}

Apakah slot jadwal tersebut masih tersedia? Terima kasih!`;

    return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`;
  }, [currentUser, simulatorDate, simulatorStartHour, actualDuration, simPackageId, simSessionType, simRecordingTypeId, pricingBreakdown, invoiceSettings, whatsappPhone, pricingSettings.packages, sessionOptions, recordingTypeOptions]);

  // Billing WhatsApp redirect
  const getBookingWhatsAppUrl = (booking) => {
    const studioName = invoiceSettings.studioName || '37 Music Studio';
    const amountToPay = booking.paymentStatus === 'dp'
      ? Math.max(0, (booking.total || 0) - (booking.dpAmount || 0))
      : (booking.total || 0);

    const text = `Halo *${studioName}*, saya ingin melakukan pelunasan tagihan booking berikut:

📝 *Kode Booking* : ${booking.bookingCode || booking.id}
👤 *Nama* : ${currentUser?.displayName || 'Pelanggan'}
📅 *Tanggal Sesi* : ${booking.date}
⏰ *Jam* : ${String(booking.startHour).padStart(2, '0')}.00
💰 *Sisa Tagihan* : ${formatRupiah(amountToPay)}

Saya sudah melakukan transfer. Berikut bukti transfer pembayarannya.`;

    return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`;
  };

  // Calendar rendering parameters
  const visibleDays = useMemo(() => getVisibleDays(calendarSelectedDate, calendarViewMode), [calendarSelectedDate, calendarViewMode]);
  const bookingBlocks = useMemo(() => getVisibleBookingBlocks(calendarBookings, visibleDays), [calendarBookings, visibleDays]);
  const gridTemplateColumns = getGridTemplate(calendarViewMode, visibleDays.length);

  const handleSlotClick = (slot) => {
    setSimulatorDate(slot.date);
    setSimulatorStartHour(slot.startHour);
    setSimSessionType('rehearsal');
    setSimPackageId('none');
    setSimRecordingTypeId('none');
    setSimDuration('2');
    setSimCustomDuration('');
    setIsSimulatorOpen(true);
  };

  const handleBookingBlockClick = (booking) => {
    setSelectedBookingDetail(booking);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050506] flex items-center justify-center font-sans">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#ff8a2a]/10 to-transparent pointer-events-none blur-[120px]" />
        <div className="flex flex-col items-center gap-4 z-10">
          <LoaderCircleWrapper className="animate-spin text-[#ff8a2a]" size={36} />
          <p className="text-sm text-[#f7f3ec]/60 tracking-wider">Membuka portal client...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-container min-h-screen bg-[#050506] text-[var(--ui-text-main)] pb-24 overflow-x-hidden font-sans relative">
      {/* Background Radial Glow */}
      <div className="absolute top-0 left-0 w-full h-[450px] bg-gradient-to-b from-[#ff8a2a]/8 to-transparent pointer-events-none blur-[110px]" />

      {/* Dynamic Style Override Inject for Occupied Slots */}
      <style>{`
        .schedule-booking-block.is-occupied-other {
          border-color: rgba(255, 255, 255, 0.05) !important;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.01), rgba(255, 255, 255, 0.02)) !important;
          color: rgba(255, 255, 255, 0.22) !important;
          cursor: not-allowed !important;
          box-shadow: none !important;
        }
        .schedule-booking-block.is-occupied-other::before {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .schedule-booking-block.is-occupied-other .schedule-booking-glow {
          display: none !important;
        }
        .schedule-booking-block.is-occupied-other strong {
          color: rgba(255, 255, 255, 0.25) !important;
          font-weight: 400 !important;
        }
        .schedule-booking-block.is-occupied-other .schedule-booking-title {
          color: rgba(255, 255, 255, 0.15) !important;
        }
      `}</style>

      {/* Header Profile Area */}
      <header className="relative w-full max-w-4xl mx-auto px-4 pt-6 pb-2 flex items-center justify-between border-b border-white/5 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--ui-accent-strong)] to-[var(--ui-accent)] flex items-center justify-center">
            <Volume2 className="text-white w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-wider text-white">37 PORTAL</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-[var(--ui-text-muted)] font-semibold">Aktif</span>
            <span className="text-xs text-white max-w-[120px] truncate">{currentUser?.displayName || currentUser?.email || 'User'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Log Out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Area based on Tab Selection */}
      <main className="w-full max-w-4xl mx-auto px-4 py-6 relative z-10 min-h-[60vh]">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Spatial Ambient Greeting Card */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden flex flex-col gap-3 shadow-xl">
              <div className="absolute top-0 right-0 w-[140px] h-[140px] rounded-full bg-[var(--ui-accent)]/5 filter blur-[35px] pointer-events-none" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <User size={18} className="text-[var(--ui-ui-accent)]" />
                </div>
                <div>
                  <h3 className="text-xs text-[var(--ui-text-muted)] tracking-wider">Selamat Datang</h3>
                  <h2 className="text-lg text-white font-bold">{currentUser?.displayName || 'Pelanggan Setia'}</h2>
                </div>
              </div>
              <p className="text-xs text-[var(--ui-text-muted)] leading-relaxed">
                Kelola aktivitas latihan dan rekaman Anda di {invoiceSettings.studioName || '37 Music Studio'} secara transparan dan mudah lewat portal khusus client ini.
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1.5">
                <span className="text-[10px] uppercase text-[var(--ui-text-muted)] tracking-wider font-semibold">Total Booking</span>
                <strong className="text-2xl text-white">{stats.totalBookings} <span className="text-xs font-normal text-[var(--ui-text-muted)]">kali</span></strong>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1.5">
                <span className="text-[10px] uppercase text-[var(--ui-text-muted)] tracking-wider font-semibold">Sesi Latihan</span>
                <strong className="text-2xl text-white">{stats.completedBookings} <span className="text-xs font-normal text-[var(--ui-text-muted)]">sesi</span></strong>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1.5">
                <span className="text-[10px] uppercase text-[var(--ui-text-muted)] tracking-wider font-semibold">Total Durasi</span>
                <strong className="text-2xl text-white">{stats.totalDuration} <span className="text-xs font-normal text-[var(--ui-text-muted)]">jam</span></strong>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1.5">
                <span className="text-[10px] uppercase text-[var(--ui-text-muted)] tracking-wider font-semibold font-bold text-orange-400">Sisa Tagihan</span>
                <strong className="text-xl text-white truncate">{formatRupiah(stats.unpaidAmount)}</strong>
              </div>
            </div>

            {/* Warning Alert outstanding tagihan */}
            {stats.unpaidAmount > 0 && (
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex items-start gap-3 relative overflow-hidden shadow-lg shadow-red-950/10">
                <AlertCircle className="text-red-400 w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="text-xs text-white font-bold">Menunggu Pembayaran Sisa Tagihan</h4>
                  <p className="text-[11px] text-[var(--ui-text-muted)] leading-relaxed">
                    Anda memiliki total tagihan tertunda sebesar <strong className="text-white">{formatRupiah(stats.unpaidAmount)}</strong> pada {unpaidBookings.length} booking. Harap lakukan pelunasan untuk kelancaran sesi.
                  </p>
                  <button
                    onClick={() => setActiveTab('billing')}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span>Bayar Sekarang</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Quick Action: Search Slots */}
            <div 
              onClick={() => setActiveTab('calendar')}
              className="p-5 rounded-2xl bg-gradient-to-r from-orange-600/10 to-amber-600/5 hover:from-orange-600/15 border border-orange-500/15 hover:border-orange-500/20 flex justify-between items-center cursor-pointer transition-all hover:scale-[1.01] group"
            >
              <div className="space-y-1">
                <h4 className="text-sm text-white font-bold flex items-center gap-1.5">
                  <Sparkles size={14} className="text-orange-400" />
                  <span>Cari Slot Jadwal Kosong</span>
                </h4>
                <p className="text-xs text-[var(--ui-text-muted)]">Lihat grid kalender interaktif untuk memilih slot waktu latihan terbaik Anda.</p>
              </div>
              <ChevronRight size={18} className="text-orange-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-5">
            {/* Calendar Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-xl">
              {/* Left Side: Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCalendarSelectedDate(shiftDate(calendarSelectedDate, calendarViewMode, -1))}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCalendarSelectedDate(startOfDay(new Date()))}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-colors"
                >
                  Hari Ini
                </button>
                <button
                  onClick={() => setCalendarSelectedDate(shiftDate(calendarSelectedDate, calendarViewMode, 1))}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Title Date */}
              <strong className="text-sm text-white font-semibold">
                {formatRangeLabel(calendarSelectedDate, calendarViewMode)}
              </strong>

              {/* View Modes */}
              <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 self-start sm:self-auto">
                {['day', 'week', 'month'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCalendarViewMode(mode)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${calendarViewMode === mode ? 'bg-[#ff8a2a] text-black shadow-md' : 'text-white/60 hover:text-white'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Helper Hint */}
            <div className="text-[11px] text-[var(--ui-text-muted)] flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#ff8a2a]/30 border border-[#ff8a2a]/50" />
                <span>Booking Anda</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-white/5 border border-white/10" />
                <span>Terisi (Sesi Lain)</span>
              </span>
              <span className="flex items-center gap-1.5 text-white/70">
                <span className="font-semibold text-orange-400">+</span>
                <span>Klik sel kosong untuk pesan</span>
              </span>
            </div>

            {/* Calendar Grid Section */}
            <div className="schedule-grid-shell rounded-2xl border border-white/5 overflow-hidden">
              <div className="schedule-grid-scroll">
                <div
                  className={`schedule-grid schedule-grid--${calendarViewMode}`}
                  style={{ gridTemplateColumns }}
                >
                  {/* Corner Cell */}
                  <div className="schedule-grid-corner" style={{ gridColumn: '1', gridRow: '1' }}>
                    <span>{calendarViewMode === 'month' ? monthNames[calendarSelectedDate.getMonth()] : 'Jam'}</span>
                  </div>

                  {/* Day Columns Head */}
                  {visibleDays.map((day, dayIndex) => {
                    const dayIso = toIsoDate(day);
                    const isToday = isSameDay(day, startOfDay(new Date()));
                    const dayHeadClassName = `schedule-day-head ${isToday ? 'is-today' : ''}`;

                    return (
                      <div
                        className={dayHeadClassName}
                        key={dayIso}
                        style={{ gridColumn: String(dayIndex + 2), gridRow: '1' }}
                      >
                        <span>{dayNames[day.getDay()]}</span>
                        <strong>{day.getDate()}</strong>
                      </div>
                    );
                  })}

                  {/* Grid Rows / Cells */}
                  {businessHours.map((hour, hourIndex) => (
                    <div className="schedule-row-fragment" key={hour.key}>
                      <div
                        className="schedule-time-cell"
                        style={{ gridColumn: '1', gridRow: String(hourIndex + 2) }}
                      >
                        <Clock3 size={12} aria-hidden="true" />
                        <span>{hour.rangeLabel}</span>
                      </div>

                      {visibleDays.map((day, dayIndex) => {
                        const cellKey = toIsoDate(day) + '-' + hour.key;
                        return (
                          <div
                            className="schedule-slot-cell"
                            key={cellKey}
                            style={{ gridColumn: String(dayIndex + 2), gridRow: String(hourIndex + 2) }}
                          >
                            <button
                              aria-label={`Pesan slot ${toIsoDate(day)} jam ${hour.label}`}
                              className="schedule-slot-button"
                              type="button"
                              onClick={() => handleSlotClick({ date: toIsoDate(day), startHour: String(hour.start) })}
                            >
                              <span className="schedule-slot-add-hint" aria-hidden="true">+</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Booking Blocks Overlay */}
                  {bookingBlocks.map((block) => {
                    const isOwn = Boolean(block.booking.isOwnClientBooking);

                    return (
                      <ClientCalendarBookingBlock
                        block={block}
                        key={block.booking.id || block.dayKey + '-' + block.startIndex + '-' + block.booking.customer}
                        onBookingClick={handleBookingBlockClick}
                        isOwn={isOwn}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-white tracking-wider">Riwayat Booking Saya</h3>
            
            {userBookings.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white/[0.01] border border-white/5 text-[var(--ui-text-muted)] text-sm space-y-2">
                <CalendarDays size={28} className="mx-auto text-white/20 mb-2" />
                <strong>Belum ada riwayat booking</strong>
                <p className="text-xs max-w-xs mx-auto">Anda belum pernah memesan jadwal sesi latihan atau rekaman.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {userBookings.map((booking) => {
                  const status = getBookingStatus(booking);
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
                      onClick={() => handleBookingBlockClick(booking)}
                      className={`relative overflow-hidden p-5 rounded-2xl backdrop-blur-md bg-white/[0.02] border border-white/5 hover:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer transition-all duration-300 ${isVoid ? 'opacity-55' : ''}`}
                    >
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
                        <span className="text-xs text-[var(--ui-text-muted)]">Estimasi Total</span>
                        <strong className="text-base text-white">{formatRupiah(booking.total || booking.subtotal || 0)}</strong>
                        {status === 'dp' && booking.dpAmount > 0 && (
                          <span className="text-[10px] text-orange-400 font-medium">
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
        )}

        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Outstanding balance header */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-[140px] h-[140px] rounded-full bg-orange-500/5 filter blur-[35px] pointer-events-none" />
              <span className="text-[11px] uppercase tracking-wider text-[var(--ui-text-muted)] font-semibold">Total Sisa Tagihan Aktif</span>
              <strong className="text-3xl text-white font-bold">{formatRupiah(stats.unpaidAmount)}</strong>
              <p className="text-xs text-[var(--ui-text-muted)] leading-relaxed mt-1">
                Silakan lakukan transfer sesuai sisa tagihan di bawah, lalu kirim bukti pembayaran ke admin studio via WhatsApp untuk konfirmasi instan.
              </p>
            </div>

            {/* List of unpaid bookings */}
            {unpaidBookings.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-wider text-[var(--ui-text-muted)] font-semibold">Daftar Tagihan Pending / DP</h4>
                <div className="space-y-3">
                  {unpaidBookings.map((b) => {
                    const status = getBookingStatus(b);
                    const amountToPay = status === 'dp'
                      ? Math.max(0, (b.total || 0) - (b.dpAmount || 0))
                      : (b.total || 0);

                    return (
                      <div key={b.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase tracking-wider bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[var(--ui-text-muted)]">
                            {b.bookingCode || 'BKG'}
                          </span>
                          <h5 className="text-sm text-white font-bold">{b.sessionLabel || b.packageLabel || b.title || 'Sesi Latihan'}</h5>
                          <p className="text-[11px] text-[var(--ui-text-muted)]">{b.date} • {b.startHour}.00 WIB ({b.durationHours} Jam)</p>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-[var(--ui-text-muted)] block">Harus Dibayar</span>
                            <strong className="text-sm text-orange-400">{formatRupiah(amountToPay)}</strong>
                          </div>
                          <a
                            href={getBookingWhatsAppUrl(b)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-[#2ecc71] hover:bg-[#27ae60] text-white text-[11px] font-bold flex items-center gap-1 hover:scale-[1.01] transition-transform"
                          >
                            <Phone size={11} />
                            <span>Kirim Bukti WA</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment instructions */}
            <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/5 space-y-4">
              <h4 className="text-xs uppercase tracking-wider text-white font-bold flex items-center gap-1.5">
                <Receipt size={14} className="text-[#ff8a2a]" />
                <span>Informasi Rekening Studio</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-[var(--ui-text-muted)] uppercase block">Bank BCA</span>
                  <strong className="text-base text-white tracking-wide">3728 - 9028 - 22</strong>
                  <span className="text-[11px] text-[var(--ui-text-muted)] block mt-1">A/N: 37 MUSIC STUDIO</span>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-[var(--ui-text-muted)] uppercase block">Metode QRIS</span>
                  <strong className="text-sm text-white">Scan di kasir studio</strong>
                  <span className="text-[11px] text-[var(--ui-text-muted)] block mt-1">Mendukung GoPay, OVO, ShopeePay</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-orange-500/5 border border-orange-500/10 text-[11px] text-[var(--ui-text-muted)] leading-relaxed space-y-1">
                <div className="flex items-center gap-1 text-white font-bold mb-1">
                  <Info size={12} className="text-orange-400" />
                  <span>Ketentuan Pembayaran:</span>
                </div>
                <p>• DP minimal sebesar Rp 50.000 diperlukan untuk mengunci slot jika melakukan booking jarak jauh.</p>
                <p>• Pelunasan dapat dilakukan langsung di studio sebelum latihan dimulai.</p>
                <p>• Pembatalan sesi &lt; 24 jam menyebabkan DP hangus.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Elegant glassmorphic bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-black/60 backdrop-blur-xl border-t border-white/10 py-2.5 pb-safe-bottom">
        <div className="max-w-md mx-auto px-6 flex items-center justify-between">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1.5 transition-colors relative ${activeTab === 'dashboard' ? 'text-[#ff8a2a]' : 'text-white/40 hover:text-white/70'}`}
          >
            {activeTab === 'dashboard' && <span className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-[#ff8a2a] shadow-lg shadow-orange-500/50" />}
            <Home size={18} />
            <span className="text-[10px] font-semibold">Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center gap-1.5 transition-colors relative ${activeTab === 'calendar' ? 'text-[#ff8a2a]' : 'text-white/40 hover:text-white/70'}`}
          >
            {activeTab === 'calendar' && <span className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-[#ff8a2a] shadow-lg shadow-orange-500/50" />}
            <Calendar size={18} />
            <span className="text-[10px] font-semibold">Jadwal</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1.5 transition-colors relative ${activeTab === 'history' ? 'text-[#ff8a2a]' : 'text-white/40 hover:text-white/70'}`}
          >
            {activeTab === 'history' && <span className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-[#ff8a2a] shadow-lg shadow-orange-500/50" />}
            <History size={18} />
            <span className="text-[10px] font-semibold">Riwayat</span>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`flex flex-col items-center gap-1.5 transition-colors relative ${activeTab === 'billing' ? 'text-[#ff8a2a]' : 'text-white/40 hover:text-white/70'}`}
          >
            {activeTab === 'billing' && <span className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-[#ff8a2a] shadow-lg shadow-orange-500/50" />}
            <CreditCard size={18} />
            <span className="text-[10px] font-semibold">Tagihan</span>
          </button>
        </div>
      </nav>

      {/* Booking Simulator Modal (Interactive request booking from Empty Slot) */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0f0f12] border border-white/10 space-y-4 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <h3 className="text-base text-white font-bold flex items-center gap-2 border-b border-white/5 pb-3">
              <CalendarDays size={18} className="text-[#ff8a2a]" />
              <span>Simulasi Booking Baru</span>
            </h3>

            <div className="space-y-4 text-xs">
              {/* Selected Slot Information */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-[var(--ui-text-muted)] space-y-1">
                <p>Tanggal Terpilih: <strong className="text-white">{simulatorDate}</strong></p>
                <p>Mulai Jam: <strong className="text-white">{simulatorStartHour}.00 WIB</strong></p>
              </div>

              {/* Selector Mode */}
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-white/5 border border-white/5">
                <button
                  type="button"
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${simPackageId === 'none' ? 'bg-[#ff8a2a] text-black shadow-md' : 'text-[var(--ui-text-muted)] hover:text-white'}`}
                  onClick={() => {
                    setSimPackageId('none');
                    setSimSessionType('rehearsal');
                  }}
                >
                  Sewa Reguler
                </button>
                <button
                  type="button"
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${simPackageId !== 'none' ? 'bg-[#ff8a2a] text-black shadow-md' : 'text-[var(--ui-text-muted)] hover:text-white'}`}
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
              {simPackageId !== 'none' ? (
                <StudioSelect
                  label="Pilihan Paket Hemat"
                  options={packageOptions}
                  selectedKey={simPackageId}
                  onChange={handlePackageChange}
                />
              ) : (
                <div className="space-y-3">
                  <StudioSelect
                    label="Pilih Layanan Studio"
                    options={sessionOptions}
                    selectedKey={simSessionType}
                    onChange={handleSessionTypeChange}
                  />

                  {simSessionType === 'recording' && recordingTypeOptions.length > 0 && (
                    <StudioSelect
                      label="Pilihan Jenis Recording"
                      options={finalRecordingTypeOptions}
                      selectedKey={simRecordingTypeId}
                      onChange={setSimRecordingTypeId}
                    />
                  )}
                </div>
              )}

              {/* Duration Picker (Only active for non-package selections) */}
              {simPackageId === 'none' && simRecordingTypeId === 'none' && (
                <div className="grid grid-cols-2 gap-3">
                  <StudioSelect
                    label="Durasi Sewa"
                    options={durationOptions}
                    selectedKey={simDuration}
                    onChange={setSimDuration}
                  />
                  
                  {simDuration === 'custom' && (
                    <label className="space-y-1 block">
                      <span className="text-[10px] text-[var(--ui-text-muted)] font-medium">Durasi Kustom (Jam)</span>
                      <input 
                        type="number"
                        placeholder="Jam..."
                        min={1}
                        max={24}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none text-white focus:border-[#ff8a2a]"
                        value={simCustomDuration}
                        onChange={(e) => setSimCustomDuration(e.target.value)}
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Cost Summary Breakdown */}
              <div className="space-y-2 border-t border-white/5 pt-3">
                <h4 className="font-bold text-white">Rincian Estimasi</h4>
                <div className="space-y-1.5 text-[11px] text-[var(--ui-text-muted)]">
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
                      <span>Diskon:</span>
                      <span>-{formatRupiah(pricingBreakdown.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-white/5 pt-1.5 text-xs font-bold text-white">
                    <span>Total Estimasi:</span>
                    <span className="text-[#ff8a2a]">{formatRupiah(pricingBreakdown.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsSimulatorOpen(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-colors"
              >
                Kembali
              </button>
              <a 
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsSimulatorOpen(false)}
                className="flex-[2] py-3 rounded-xl bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xl transition-transform active:scale-[0.98]"
              >
                <Phone size={13} />
                <span>Pesan via WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Booking Detail Modal (To view invoices, receipts, and DP breakdown) */}
      {selectedBookingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0f0f12] border border-white/10 space-y-4 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <h3 className="text-base text-white font-bold flex items-center gap-2 border-b border-white/5 pb-3">
              <Receipt size={18} className="text-[#ff8a2a]" />
              <span>Detail Invoice Booking</span>
            </h3>

            {/* Visual Invoice Sheet */}
            <div className="p-5 rounded-xl bg-white/[0.01] border border-white/5 space-y-4 text-xs font-sans">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">{invoiceSettings.studioName || '37 Music Studio'}</h4>
                  <p className="text-[10px] text-[var(--ui-text-muted)] leading-relaxed max-w-[180px]">{invoiceSettings.address || 'Alamat Studio'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[var(--ui-text-muted)] block">Invoice No:</span>
                  <strong className="text-white text-xs tracking-wide">{selectedBookingDetail.invoiceNumber || 'INV-00000'}</strong>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3 space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--ui-text-muted)]">Tanggal Sesi:</span>
                  <span className="text-white font-semibold">{selectedBookingDetail.date}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--ui-text-muted)]">Jam Latihan:</span>
                  <span className="text-white font-semibold">
                    {String(selectedBookingDetail.startHour).padStart(2, '0')}.00 WIB ({selectedBookingDetail.durationHours} Jam)
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--ui-text-muted)]">Layanan Sesi:</span>
                  <span className="text-white font-semibold">
                    {selectedBookingDetail.sessionLabel || selectedBookingDetail.packageLabel || selectedBookingDetail.title || 'Studio Rehearsal'}
                  </span>
                </div>
              </div>

              {/* Receipt Totals */}
              <div className="border-t border-white/5 pt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--ui-text-muted)]">Subtotal:</span>
                  <span className="text-white font-semibold">{formatRupiah(selectedBookingDetail.subtotal || selectedBookingDetail.total)}</span>
                </div>
                {selectedBookingDetail.discountAmount > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Potongan Promo:</span>
                    <span>-{formatRupiah(selectedBookingDetail.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-white border-t border-white/5 pt-2">
                  <span>Total Harga:</span>
                  <span className="text-[#ff8a2a]">{formatRupiah(selectedBookingDetail.total)}</span>
                </div>

                {/* DP / Balance Details */}
                <div className="bg-white/5 p-2.5 rounded-lg space-y-1 text-[11px] mt-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--ui-text-muted)]">Uang Muka (DP):</span>
                    <span className="text-white font-semibold">{formatRupiah(selectedBookingDetail.dpAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1 mt-1 text-white font-bold">
                    <span>Sisa Tagihan:</span>
                    <span className={getBookingStatus(selectedBookingDetail) === 'lunas' ? 'text-green-400' : 'text-orange-400'}>
                      {getBookingStatus(selectedBookingDetail) === 'lunas'
                        ? 'Lunas / Selesai'
                        : formatRupiah(Math.max(0, (selectedBookingDetail.total || 0) - (selectedBookingDetail.dpAmount || 0)))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBookingDetail(null)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-colors"
              >
                Tutup Invoice
              </button>

              {getBookingStatus(selectedBookingDetail) !== 'lunas' && !['cancelled', 'canceled', 'void', 'deleted'].includes(getBookingStatus(selectedBookingDetail).toLowerCase()) && (
                <a
                  href={getBookingWhatsAppUrl(selectedBookingDetail)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSelectedBookingDetail(null)}
                  className="flex-1 py-3 rounded-xl bg-[#2ecc71] hover:bg-[#27ae60] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xl transition-all"
                >
                  <Phone size={12} />
                  <span>Kirim Bukti WA</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline fallback wrappers to resolve lucide icons cleanly without breaking builds
function LoaderCircleWrapper({ className, size }) {
  return (
    <svg 
      className={className} 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
