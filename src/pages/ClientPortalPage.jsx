import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  Calendar,
  History,
  CreditCard,
  LogOut,
  CalendarDays,
  Phone,
  Receipt,
  CalendarPlus,
  Copy,
  Check,
  MessageCircle,
  UploadCloud,
  Image,
  X
} from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase.js';
import { adminBookingRepository } from '../services/adminBookingRepository.js';
import { syncClientCustomerProfile } from '../services/clientProfileRepository.js';
import { accountRoleRepository } from '../services/accountRoleRepository.js';
import { PORTAL_ACCESS } from '../utils/accountRoles.js';
import {
  bookingCommunicationRepository,
  getBookingRequestStatusMeta,
} from '../services/bookingCommunicationRepository.js';
import {
  usePricingSettings,
  formatRupiah,
  resolveBookingPricing,
  isRecordingSessionId,
  getSessionOptions,
  getRecordingTypeOptions,
  getPackageOptions
} from '../settings/pricingSettings.js';
import { useInvoiceSettings } from '../settings/invoiceSettings.js';
import {
  defaultStudioSettings,
  getStudioPaymentTerms,
  useStudioSettings,
} from '../settings/studioSettings.js';
import { uploadPaymentProofFile } from '../services/cloudinaryUploadService.js';
import {
  buildPaymentProofPayload,
  getPaymentProofStatusLabel,
  paymentProofCategoryOptions,
  paymentProofMethodOptions,
  paymentProofRepository,
} from '../services/paymentProofRepository.js';
import { businessHours, durationOptions, statusFilters } from './admin/scheduleConfig.js';
import StudioSelect from '../components/ui/StudioSelect.jsx';
import BookingConversationPanel from '../components/booking/BookingConversationPanel.jsx';
import ClientDashboardTab from '../components/client/ClientDashboardTab.jsx';
import ClientCalendarTab from '../components/client/ClientCalendarTab.jsx';
import ClientHistoryTab from '../components/client/ClientHistoryTab.jsx';
import ClientBillingTab from '../components/client/ClientBillingTab.jsx';




import '../styles/admin-auth.css';
import '../styles/client-portal.css';

// Simple Calendar Helper Functions (aligned with admin SchedulePage)
const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const shortMonthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];
const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const historyFilterOptions = [
  { key: 'all', label: 'Semua' },
  { key: 'upcoming', label: 'Mendatang' },
  { key: 'unpaid', label: 'Belum lunas' },
  { key: 'completed', label: 'Selesai' },
];

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
  if (viewMode === 'day') return '70px minmax(220px, 1fr)';
  if (viewMode === 'week') return '70px repeat(' + visibleDayCount + ', minmax(94px, 1fr))';
  return '70px repeat(' + visibleDayCount + ', minmax(68px, 1fr))';
}
function getSlotSpanRows(booking, startIndex) {
  const duration = Math.max(1, Math.ceil(Number(booking.durationHours) || 1));
  const availableRows = businessHours.length - startIndex;
  return Math.max(1, Math.min(duration, availableRows));
}

function isNoDurationPackageBooking(booking) {
  const hasPackage = Boolean(booking?.packageId && booking.packageId !== 'none') || booking?.pricingMode === 'package';

  return hasPackage && Number(booking?.durationHours || booking?.duration || 0) <= 0;
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

      if (dayIndex === -1 || startIndex === -1 || isCancelled || isNoDurationPackageBooking(booking) || !activeStatuses.includes(status)) {
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
        <span>{startLabel} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {durationLabel}</span>
        {isOwn && <b>{priceLabel}</b>}
      </span>
    </button>
  );
}

export default function ClientPortalPage() {
  const navigate = useNavigate();
  const pricingSettings = usePricingSettings();
  const invoiceSettings = useInvoiceSettings();
  const studioSettings = useStudioSettings();
  const transferAccountNumber = studioSettings.bankAccountNumber || defaultStudioSettings.bankAccountNumber;
  const studioPaymentTerms = useMemo(() => getStudioPaymentTerms(studioSettings), [studioSettings]);

  // Authentication & Loading States
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(firebaseAuth));

  // Tab State
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'calendar' | 'history' | 'billing'

  // Booking Data State
  const [bookings, setBookings] = useState([]);
  const [calendarSlots, setCalendarSlots] = useState([]);
  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [actionFeedback, setActionFeedback] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [paymentProofs, setPaymentProofs] = useState([]);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [selectedProofBooking, setSelectedProofBooking] = useState(null);
  const [proofCategory, setProofCategory] = useState('dp');
  const [proofMethod, setProofMethod] = useState('transfer');
  const [proofAmount, setProofAmount] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [proofNote, setProofNote] = useState('');
  const [simProofEnabled, setSimProofEnabled] = useState(false);
  const [simProofCategory, setSimProofCategory] = useState('dp');
  const [simProofMethod, setSimProofMethod] = useState('transfer');
  const [simProofAmount, setSimProofAmount] = useState('');
  const [simProofFile, setSimProofFile] = useState(null);
  const [simProofNote, setSimProofNote] = useState('');

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
    let checkSequence = 0;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      const currentSequence = ++checkSequence;
      if (!user) {
        navigate('/client/login', { replace: true });
        setAuthLoading(false);
        return;
      }

      try {
        const result = await accountRoleRepository.resolvePortalAccount(user, 'client');
        if (currentSequence !== checkSequence) return;

        if (result.access !== PORTAL_ACCESS.ALLOWED) {
          setCurrentUser(null);
          navigate('/client/login', { replace: true });
          return;
        }

        setCurrentUser(user);
        try {
          await syncClientCustomerProfile(user);
        } catch (profileError) {
          console.error('Akses client valid, tetapi profil customer belum tersinkron:', profileError);
        }
      } catch (error) {
        console.error('Gagal memeriksa akses Portal Client:', error);
        if (currentSequence === checkSequence) {
          setCurrentUser(null);
          navigate('/client/login', { replace: true });
        }
      } finally {
        if (currentSequence === checkSequence) setAuthLoading(false);
      }
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

  // Load payment proofs submitted by current client
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = paymentProofRepository.subscribeClientPaymentProofs(
      currentUser,
      (data) => setPaymentProofs(data),
      (err) => console.error('Gagal mengambil bukti pembayaran client:', err)
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
        (b.clientUid && b.clientUid === currentUser.uid) ||
        (emailStr && bEmail === emailStr) ||
        (phoneNormalized && bPhone === phoneNormalized) ||
        (phoneNormalized && bPhoneKey === phoneNormalized)
      );
    });
  }, [bookings, currentUser]);

  const unreadAdminMessages = useMemo(
    () => userBookings.filter((booking) => booking.lastMessageSenderRole === 'admin' && booking.lastMessageReadByClient === false).length,
    [userBookings]
  );

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

  const upcomingBooking = useMemo(() => {
    const now = new Date();

    return userBookings
      .filter((booking) => {
        const status = getBookingStatus(booking).toLowerCase();
        if (['cancelled', 'canceled', 'void', 'deleted'].includes(status)) return false;
        const bookingDate = new Date(`${booking.date}T${String(booking.startHour || 0).padStart(2, '0')}:00:00`);
        return bookingDate >= now;
      })
      .toSorted((first, second) => {
        const firstDate = new Date(`${first.date}T${String(first.startHour || 0).padStart(2, '0')}:00:00`);
        const secondDate = new Date(`${second.date}T${String(second.startHour || 0).padStart(2, '0')}:00:00`);
        return firstDate - secondDate;
      })[0] || null;
  }, [userBookings]);

  const recentBookings = useMemo(() => userBookings.slice(0, 3), [userBookings]);

  const paymentProofsByBookingId = useMemo(() => {
    return paymentProofs.reduce((groups, proof) => {
      if (!proof.bookingId) return groups;

      if (!groups.has(proof.bookingId)) {
        groups.set(proof.bookingId, []);
      }

      groups.get(proof.bookingId).push(proof);

      return groups;
    }, new Map());
  }, [paymentProofs]);

  const pendingPaymentProofs = useMemo(
    () => paymentProofs.filter((proof) => proof.status === 'pending'),
    [paymentProofs]
  );

  const filteredHistoryBookings = useMemo(() => {
    const normalizedQuery = historyQuery.trim().toLowerCase();
    const now = new Date();

    return userBookings.filter((booking) => {
      const status = getBookingStatus(booking).toLowerCase();
      const bookingDate = new Date(`${booking.date}T${String(booking.startHour || 0).padStart(2, '0')}:00:00`);
      const matchesQuery = !normalizedQuery || [
        booking.bookingCode,
        booking.bookingId,
        booking.sessionLabel,
        booking.packageLabel,
        booking.title,
        booking.date,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));

      if (!matchesQuery) return false;
      if (historyFilter === 'upcoming') {
        return bookingDate >= now && !['cancelled', 'canceled', 'void', 'deleted'].includes(status);
      }
      if (historyFilter === 'unpaid') return status === 'pending' || status === 'dp';
      if (historyFilter === 'completed') {
        return bookingDate < now && !['cancelled', 'canceled', 'void', 'deleted'].includes(status);
      }
      return true;
    });
  }, [historyFilter, historyQuery, userBookings]);

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



  const handleSessionTypeChange = (val) => {
    setSimSessionType(val);
    setSimPackageId('none');
    setSimRecordingTypeId(isRecordingSessionId(val) ? recordingTypeOptions[0]?.key || 'none' : 'none');
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
      return selectedPkg ? Math.max(0, Number(selectedPkg.durationHours) || 0) : 0;
    }
    if (simPackageId === 'none' && isRecordingSessionId(simSessionType)) {
      const selectedRecording = recordingTypeOptions.find((item) => item.key === simRecordingTypeId);
      return selectedRecording ? Number(selectedRecording.durationHours) || 0 : 0;
    }

    if (simDuration === 'custom') {
      return Math.max(1, Number(simCustomDuration) || 1);
    }
    return Number(simDuration) || 2;
  }, [simPackageId, simSessionType, simRecordingTypeId, simDuration, simCustomDuration, pricingSettings.packages, recordingTypeOptions]);

  // Resolve pricing via utility
  const pricingBreakdown = useMemo(() => {
    return resolveBookingPricing({
      customDurationHours: simDuration === 'custom' ? Number(simCustomDuration) : 0,
      durationHours: Number(simDuration) || 0,
      packageId: simPackageId,
      paymentStatus: 'pending',
      dpAmount: 0,
      pricingSettings,
      recordingTypeId: isRecordingSessionId(simSessionType) ? simRecordingTypeId : 'none',
      sessionId: simSessionType,
    });
  }, [simSessionType, simPackageId, simRecordingTypeId, simDuration, simCustomDuration, pricingSettings]);

  function getBookingPaymentProofs(booking) {
    if (!booking?.id) return [];

    return paymentProofsByBookingId.get(booking.id) || [];
  }

  function getLatestPaymentProof(booking) {
    return getBookingPaymentProofs(booking)[0] || null;
  }

  function getProofTone(status) {
    if (status === 'approved') return 'is-approved';
    if (status === 'rejected') return 'is-rejected';
    return 'is-pending';
  }

  function getOutstandingAmountForBooking(booking) {
    const status = getBookingStatus(booking).toLowerCase();
    const total = Number(booking?.total || booking?.subtotal || 0) || 0;
    const paidAmount = Number(booking?.paidAmount || booking?.dpAmount || 0) || 0;

    if (status === 'lunas') return 0;
    if (status === 'dp') return Math.max(0, total - paidAmount);

    return total;
  }

  function getDefaultProofAmount(booking, category = 'dp') {
    const outstanding = getOutstandingAmountForBooking(booking);

    if (category === 'pelunasan') return outstanding;

    return Math.min(outstanding || 50000, Math.max(50000, Number(booking?.dpAmount || 50000) || 50000));
  }

  function resetStandaloneProofForm() {
    setProofCategory('dp');
    setProofMethod('transfer');
    setProofAmount('');
    setProofFile(null);
    setProofNote('');
  }

  function resetSimulatorProofForm() {
    setSimProofEnabled(false);
    setSimProofCategory('dp');
    setSimProofMethod('transfer');
    setSimProofAmount('');
    setSimProofFile(null);
    setSimProofNote('');
  }

  function openPaymentProofModal(booking, initialCategory) {
    const status = getBookingStatus(booking).toLowerCase();
    const nextCategory = initialCategory || (status === 'dp' ? 'pelunasan' : 'dp');

    setSelectedProofBooking(booking);
    setProofCategory(nextCategory);
    setProofMethod('transfer');
    setProofAmount(String(getDefaultProofAmount(booking, nextCategory)));
    setProofFile(null);
    setProofNote('');
  }

  function closePaymentProofModal() {
    if (isSubmittingProof) return;

    setSelectedProofBooking(null);
    resetStandaloneProofForm();
  }

  async function submitProofForBooking({ amount, booking, category, clientNote, file, method }) {
    if (!currentUser) {
      throw new Error('Client wajib login untuk upload bukti pembayaran.');
    }

    if (!file) {
      throw new Error('Pilih file bukti pembayaran terlebih dahulu.');
    }

    const uploadResult = await uploadPaymentProofFile(file, {
      bookingId: booking.id,
      category,
      clientUid: currentUser.uid,
    });

    const payload = buildPaymentProofPayload({
      booking,
      clientUser: currentUser,
      file,
      form: {
        amount,
        category,
        clientNote,
        method,
      },
      uploadResult,
    });

    return paymentProofRepository.submitPaymentProof(payload);
  }

  async function submitStandalonePaymentProof() {
    if (!selectedProofBooking || isSubmittingProof) return;

    setIsSubmittingProof(true);
    setActionFeedback('');

    try {
      await submitProofForBooking({
        amount: Number(proofAmount),
        booking: selectedProofBooking,
        category: proofCategory,
        clientNote: proofNote,
        file: proofFile,
        method: proofMethod,
      });

      closePaymentProofModal();
      setActionFeedback('Bukti pembayaran berhasil dikirim. Menunggu review admin.');
      window.setTimeout(() => setActionFeedback(''), 4200);
    } catch (error) {
      console.error('Gagal upload bukti pembayaran:', error);
      setActionFeedback(error?.message || 'Bukti pembayaran gagal dikirim.');
      window.setTimeout(() => setActionFeedback(''), 5200);
    } finally {
      setIsSubmittingProof(false);
    }
  }

  // WhatsApp phone normalization
  const whatsappPhone = useMemo(() => {
    const rawPhone = studioSettings.studioPhone || invoiceSettings.phone || '';
    let cleaned = rawPhone.replace(/\D/g, '');
    if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    if (cleaned.startsWith('8')) cleaned = '62' + cleaned;
    return cleaned || '628123456789';
  }, [invoiceSettings.phone, studioSettings.studioPhone]);

  async function submitBookingRequest() {
    if (!currentUser || !simulatorDate || isSubmittingRequest) return;

    const duplicateRequest = userBookings.find((booking) => {
      const requestStatus = String(booking.bookingRequestStatus || '').toLowerCase();
      const sameDate = booking.date === simulatorDate;
      const sameStart = Number(booking.startHour) === Number(simulatorStartHour);

      return sameDate && sameStart && requestStatus === 'submitted';
    });

    if (duplicateRequest) {
      setIsSimulatorOpen(false);
      setActiveTab('history');
      setActionFeedback('Request untuk slot ini sudah pernah dikirim. Silakan cek Riwayat.');
      window.setTimeout(() => setActionFeedback(''), 3600);
      return;
    }

    const selectedPackage = packageOptions.find((item) => item.key === simPackageId);
    const selectedSession = sessionOptions.find((item) => item.key === simSessionType);
    const selectedRecording = recordingTypeOptions.find((item) => item.key === simRecordingTypeId);
    const isRecordingRequest = simPackageId === 'none' && isRecordingSessionId(simSessionType);
    const sessionLabel = selectedPackage?.label || selectedRecording?.label?.split(' ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ')[0] || selectedSession?.label || 'Sesi Studio';

    if (isRecordingRequest && !selectedRecording) {
      setActionFeedback('Pilih jenis recording terlebih dahulu. Harga Recording diambil dari Recording Type.');
      window.setTimeout(() => setActionFeedback(''), 4200);
      return;
    }

    setIsSubmittingRequest(true);
    setActionFeedback('');

    try {
      await accountRoleRepository.ensureAccountIdentity(currentUser, 'client');

      let createdBooking = null;

      try {
        createdBooking = await adminBookingRepository.createClientBookingRequest(currentUser, {
          customer: currentUser.displayName || currentUser.email?.split('@')[0] || 'Client',
          phone: currentUser.phoneNumber || '',
          packageId: simPackageId,
          packageLabel: selectedPackage?.label || '',
          pricingMode: pricingBreakdown.mode,
          sessionType: selectedPackage ? 'package' : simSessionType,
          sessionLabel,
          recordingTypeId: simRecordingTypeId === 'none' ? '' : simRecordingTypeId,
          recordingTypeLabel: selectedRecording?.label || '',
          title: sessionLabel,
          date: simulatorDate,
          startHour: Number(simulatorStartHour),
          startTimeLabel: `${String(simulatorStartHour).padStart(2, '0')}.00`,
          durationHours: actualDuration,
          subtotal: pricingBreakdown.subtotal,
          discountAmount: pricingBreakdown.discountAmount,
          appliedDiscounts: pricingBreakdown.appliedDiscounts,
          total: pricingBreakdown.total,
        });

        if (simProofEnabled) {
          if (!simProofFile) {
            throw new Error('Request tersimpan, tetapi bukti pembayaran belum dipilih.');
          }

          await submitProofForBooking({
            amount: Number(simProofAmount || getDefaultProofAmount(createdBooking, simProofCategory)),
            booking: createdBooking,
            category: simProofCategory,
            clientNote: simProofNote,
            file: simProofFile,
            method: simProofMethod,
          });
        }
      } catch (innerError) {
        if (createdBooking) {
          setIsSimulatorOpen(false);
          setActiveTab('history');
          setActionFeedback(innerError?.message || 'Request tersimpan, tetapi bukti pembayaran gagal dikirim.');
          window.setTimeout(() => setActionFeedback(''), 5200);
          return;
        }

        throw innerError;
      }

      resetSimulatorProofForm();
      setIsSimulatorOpen(false);
      setActiveTab('history');
      setActionFeedback(simProofEnabled
        ? 'Request booking dan bukti pembayaran berhasil dikirim. Menunggu review admin.'
        : 'Request booking berhasil dikirim ke admin. Statusnya bisa dipantau di Riwayat.'
      );
      window.setTimeout(() => setActionFeedback(''), 4200);
    } catch (error) {
      const errorCode = error?.code || error?.name || 'unknown';
      const errorMessage = error?.message || String(error || 'Unknown error');

      console.error('Gagal mengirim booking request:', {
        code: errorCode,
        message: errorMessage,
        user: currentUser ? {
          uid: currentUser.uid,
          email: currentUser.email,
          phoneNumber: currentUser.phoneNumber,
        } : null,
        payload: {
          date: simulatorDate,
          durationHours: actualDuration,
          startHour: Number(simulatorStartHour),
          total: pricingBreakdown.total,
          email: currentUser?.email || '',
          uid: currentUser?.uid || '',
        },
      });

      const friendlyMessage = errorCode === 'permission-denied'
        ? 'Request ditolak oleh rules database. Deploy Firestore rules terbaru lalu coba lagi.'
        : 'Permintaan booking gagal disimpan. Silakan coba lagi.';

      setActionFeedback(friendlyMessage);
      window.setTimeout(() => setActionFeedback(''), 5200);
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  // Billing WhatsApp redirect
  const getBookingWhatsAppUrl = (booking) => {
    const studioName = studioSettings.studioName || invoiceSettings.studioName || defaultStudioSettings.studioName;
    const amountToPay = booking.paymentStatus === 'dp'
      ? Math.max(0, (booking.total || 0) - (booking.dpAmount || 0))
      : (booking.total || 0);

    const text = `Halo *${studioName}*, saya ingin melakukan pelunasan tagihan booking berikut:

ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â *Kode Booking* : ${booking.bookingCode || booking.id}
ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â¤ *Nama* : ${currentUser?.displayName || 'Pelanggan'}
ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦ *Tanggal Sesi* : ${booking.date}
ÃƒÂ¢Ã‚ÂÃ‚Â° *Jam* : ${String(booking.startHour).padStart(2, '0')}.00
ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â° *Sisa Tagihan* : ${formatRupiah(amountToPay)}

Saya sudah melakukan transfer. Berikut bukti transfer pembayarannya.`;

    return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`;
  };

  const getBookingSupportUrl = (booking) => {
    const studioName = studioSettings.studioName || invoiceSettings.studioName || defaultStudioSettings.studioName;
    const bookingCode = booking.bookingCode || booking.id || '-';
    const text = `Halo *${studioName}*, saya ingin meminta bantuan terkait booking berikut:\n\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â *Kode Booking* : ${bookingCode}\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦ *Tanggal* : ${booking.date}\nÃƒÂ¢Ã‚ÂÃ‚Â° *Jam* : ${String(booking.startHour).padStart(2, '0')}.00 WIB\n\nMohon bantuannya. Terima kasih!`;

    return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`;
  };

  const showActionFeedback = (message) => {
    setActionFeedback(message);
    window.setTimeout(() => setActionFeedback(''), 2400);
  };

  const copyText = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(String(value || ''));
      showActionFeedback(successMessage);
    } catch {
      showActionFeedback('Tidak dapat menyalin. Silakan salin manual.');
    }
  };

  const downloadCalendarEvent = (booking) => {
    const startHour = Number(booking.startHour) || 0;
    const duration = Number(booking.durationHours || booking.duration) || 1;
    const startDate = new Date(`${booking.date}T${String(startHour).padStart(2, '0')}:00:00`);
    const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);
    const title = booking.sessionLabel || booking.packageLabel || booking.title || 'Sesi Studio';
    const bookingCode = booking.bookingCode || booking.id || '-';
    const escapeCalendarText = (value) => String(value || '').replaceAll('\\', '\\\\').replaceAll(',', '\\,').replaceAll(';', '\\;').replaceAll('\n', '\\n');
    const formatCalendarDate = (date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
      'T',
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      '00',
    ].join('');
    const calendarContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//37 Music Studio//Client Portal//ID',
      'BEGIN:VEVENT',
      `UID:${escapeCalendarText(booking.id || bookingCode)}@37musicstudio`,
      `DTSTART:${formatCalendarDate(startDate)}`,
      `DTEND:${formatCalendarDate(endDate)}`,
      `SUMMARY:${escapeCalendarText(title + ' - 37 Music Studio')}`,
      `DESCRIPTION:${escapeCalendarText('Kode booking: ' + bookingCode)}`,
      `LOCATION:${escapeCalendarText(invoiceSettings.address || studioSettings.studioName || invoiceSettings.studioName || defaultStudioSettings.studioName)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const calendarBlob = new Blob([calendarContent], { type: 'text/calendar;charset=utf-8' });
    const calendarUrl = URL.createObjectURL(calendarBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = calendarUrl;
    downloadLink.download = `booking-${bookingCode}.ics`;
    downloadLink.click();
    window.setTimeout(() => URL.revokeObjectURL(calendarUrl), 1000);
    showActionFeedback('Sesi ditambahkan ke file kalender.');
  };

  const studioMapsUrl = useMemo(() => {
    const destination = [invoiceSettings.studioName, invoiceSettings.address].filter(Boolean).join(' ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination || '37 Music Studio')}`;
  }, [invoiceSettings.address, invoiceSettings.studioName]);

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
    resetSimulatorProofForm();
    setIsSimulatorOpen(true);
  };

  const handleBookingBlockClick = (booking) => {
    setSelectedBookingDetail(booking);
  };

  async function requestCancellation(booking) {
    if (!currentUser || booking.bookingRequestStatus === 'cancellation_requested') return;
    const shouldContinue = window.confirm('Kirim permintaan pembatalan ke admin? Slot belum dibatalkan sampai admin menyetujuinya.');
    if (!shouldContinue) return;

    try {
      await bookingCommunicationRepository.requestBookingCancellation({ booking, user: currentUser });
      setSelectedBookingDetail((current) => current?.id === booking.id
        ? { ...current, bookingRequestStatus: 'cancellation_requested' }
        : current);
      showActionFeedback('Permintaan pembatalan dikirim ke admin.');
    } catch (error) {
      console.error('Gagal meminta pembatalan booking:', error);
      showActionFeedback('Permintaan pembatalan belum berhasil dikirim.');
    }
  }

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
    <div className="client-portal-page theme-container">
      {/* Background Radial Glow */}
      <div className="client-portal-bg-glow" aria-hidden="true" />
      {/* Header Profile Area */}
      <header className="client-portal-header relative w-full max-w-4xl mx-auto z-10">
        <div className="client-header-copy">
          <p>Client Portal</p>
          <h1>Halo, {currentUser?.displayName?.split(' ')[0] || 'Client'}</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="client-logout-button"
            title="Keluar dari portal"
            aria-label="Keluar dari portal"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Area based on Tab Selection */}
      <main className="client-portal-main">
        {activeTab === 'dashboard' && (
          <ClientDashboardTab
            upcomingBooking={upcomingBooking}
            stats={stats}
            recentBookings={recentBookings}
            whatsappPhone={whatsappPhone}
            studioMapsUrl={studioMapsUrl}
            setActiveTab={setActiveTab}
            handleBookingBlockClick={handleBookingBlockClick}
            downloadCalendarEvent={downloadCalendarEvent}
          />
        )}

        {activeTab === 'calendar' && (
          <ClientCalendarTab
            calendarSelectedDate={calendarSelectedDate}
            calendarViewMode={calendarViewMode}
            setCalendarSelectedDate={setCalendarSelectedDate}
            setCalendarViewMode={setCalendarViewMode}
            gridTemplateColumns={gridTemplateColumns}
            visibleDays={visibleDays}
            businessHours={businessHours}
            handleSlotClick={handleSlotClick}
            bookingBlocks={bookingBlocks}
            handleBookingBlockClick={handleBookingBlockClick}
            getStatusLabel={getStatusLabel}
            ClientCalendarBookingBlock={ClientCalendarBookingBlock}
            shiftDate={shiftDate}
            startOfDay={startOfDay}
            formatRangeLabel={formatRangeLabel}
            monthNames={monthNames}
            toIsoDate={toIsoDate}
            isSameDay={isSameDay}
            dayNames={dayNames}
          />
        )}

        {activeTab === 'history' && (
          <ClientHistoryTab
            filteredHistoryBookings={filteredHistoryBookings}
            userBookings={userBookings}
            historyQuery={historyQuery}
            setHistoryQuery={setHistoryQuery}
            historyFilter={historyFilter}
            setHistoryFilter={setHistoryFilter}
            historyFilterOptions={historyFilterOptions}
            handleBookingBlockClick={handleBookingBlockClick}
            getBookingStatus={getBookingStatus}
            copyText={copyText}
          />
        )}
        {activeTab === 'billing' && (
          <ClientBillingTab
            stats={stats}
            unpaidBookings={unpaidBookings}
            getBookingStatus={getBookingStatus}
            getLatestPaymentProof={getLatestPaymentProof}
            getProofTone={getProofTone}
            openPaymentProofModal={openPaymentProofModal}
            getBookingWhatsAppUrl={getBookingWhatsAppUrl}
            studioSettings={studioSettings}
            transferAccountNumber={transferAccountNumber}
            studioPaymentTerms={studioPaymentTerms}
            copyText={copyText}
          />
        )}


      </main>

      {/* Elegant glassmorphic bottom navigation bar */}
      <nav className="client-bottom-nav" aria-label="Navigasi client">
        <div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`client-bottom-item ${activeTab === 'dashboard' ? 'is-active' : ''}`}
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          >
            <Home size={18} />
            <span>Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`client-bottom-item ${activeTab === 'calendar' ? 'is-active' : ''}`}
            aria-current={activeTab === 'calendar' ? 'page' : undefined}
          >
            <Calendar size={18} />
            <span>Jadwal</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`client-bottom-item ${activeTab === 'history' ? 'is-active' : ''}`}
            aria-current={activeTab === 'history' ? 'page' : undefined}
          >
            <History size={18} />
            <span>Riwayat</span>
            {unreadAdminMessages ? <b className="client-nav-badge">{unreadAdminMessages}</b> : null}
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`client-bottom-item ${activeTab === 'billing' ? 'is-active' : ''}`}
            aria-current={activeTab === 'billing' ? 'page' : undefined}
          >
            <CreditCard size={18} />
            <span>Tagihan</span>
            {pendingPaymentProofs.length ? <b className="client-nav-badge">{pendingPaymentProofs.length}</b> : null}
          </button>
        </div>
      </nav>

      {/* Booking Simulator Modal (Interactive request booking from Empty Slot) */}
      {isSimulatorOpen && (
        <div className="client-booking-modal-backdrop">
          <div className="client-booking-modal">
            <h3 className="client-booking-modal-title">
              <CalendarDays size={18} className="text-[#ff8a2a]" />
              <span>Simulasi Booking Baru</span>
            </h3>

            <div className="client-booking-modal-body">
              {/* Selected Slot Information */}
              <div className="client-booking-slot-summary">
                <p>Tanggal Terpilih: <strong className="text-white">{simulatorDate}</strong></p>
                <p>Mulai Jam: <strong className="text-white">{simulatorStartHour}.00 WIB</strong></p>
              </div>

              {/* Selector Mode */}
              <div className="client-booking-mode">
                <button
                  type="button"
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${simPackageId === 'none' ? 'bg-[#ff8a2a] text-black shadow-md' : 'text-[var(--ui-text-muted)] hover:text-white'}`}
                  onClick={() => {
                    setSimPackageId('none');
                    setSimSessionType('rehearsal');
                    setSimRecordingTypeId('none');
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

              <div className="client-booking-fields">
                {/* Conditional dropdown selections */}
                {simPackageId !== 'none' ? (
                  <StudioSelect
                    label="Pilihan Paket Hemat"
                    options={packageOptions}
                    selectedKey={simPackageId}
                    onChange={handlePackageChange}
                  />
                ) : (
                  <div className="client-booking-service-fields">
                    <StudioSelect
                      label="Pilih Layanan Studio"
                      options={sessionOptions}
                      selectedKey={simSessionType}
                      onChange={handleSessionTypeChange}
                    />

                    {isRecordingSessionId(simSessionType) && recordingTypeOptions.length > 0 && (
                      <StudioSelect
                        label="Pilihan Jenis Recording"
                        options={recordingTypeOptions}
                        selectedKey={simRecordingTypeId}
                        onChange={setSimRecordingTypeId}
                      />
                    )}

                    {isRecordingSessionId(simSessionType) && !recordingTypeOptions.length ? (
                      <p className="text-[11px] leading-relaxed text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                        Belum ada Recording Type. Hubungi admin untuk menentukan paket recording.
                      </p>
                    ) : null}
                  </div>
                )}

                {/* Duration Picker (Only active for non-package selections) */}
                {simPackageId === 'none' && !isRecordingSessionId(simSessionType) && (
                  <div className="client-booking-duration-fields">
                    <StudioSelect
                      label="Durasi Sewa"
                      options={durationOptions}
                      selectedKey={simDuration}
                      onChange={setSimDuration}
                    />

                    {simDuration === 'custom' && (
                      <label className="client-booking-custom-duration space-y-1 block">
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
              </div>

              {/* Cost Summary Breakdown */}
              <div className="client-booking-estimate">
                <h4 className="font-bold text-white">Rincian Estimasi</h4>
                <div className="space-y-1.5 text-[11px] text-[var(--ui-text-muted)]">
                  <div className="flex justify-between">
                    <span>Durasi:</span>
                    <span className="text-white font-semibold">{actualDuration ? actualDuration + ' Jam' : 'Tanpa durasi studio'}</span>
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

              <div className="client-proof-inline-panel">
                <label className="client-proof-toggle">
                  <input
                    checked={simProofEnabled}
                    type="checkbox"
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSimProofEnabled(checked);
                      if (checked && !simProofAmount) {
                        setSimProofAmount(String(simProofCategory === 'pelunasan'
                          ? pricingBreakdown.total
                          : Math.min(pricingBreakdown.total || 50000, 50000)
                        ));
                      }
                    }}
                  />
                  <span>
                    <strong>Bayar DP / pelunasan sekarang</strong>
                    <small>Upload bukti, status akan pending sampai admin review.</small>
                  </span>
                </label>

                {simProofEnabled ? (
                  <div className="client-proof-form-grid">
                    <label>
                      <span>Kategori</span>
                      <select
                        value={simProofCategory}
                        onChange={(event) => {
                          const nextCategory = event.target.value;
                          setSimProofCategory(nextCategory);
                          setSimProofAmount(String(nextCategory === 'pelunasan'
                            ? pricingBreakdown.total
                            : Math.min(pricingBreakdown.total || 50000, 50000)
                          ));
                        }}
                      >
                        {paymentProofCategoryOptions.map((option) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Metode</span>
                      <select value={simProofMethod} onChange={(event) => setSimProofMethod(event.target.value)}>
                        {paymentProofMethodOptions.map((option) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Nominal</span>
                      <input
                        inputMode="numeric"
                        min="1"
                        type="number"
                        value={simProofAmount}
                        onChange={(event) => setSimProofAmount(event.target.value)}
                      />
                    </label>

                    <label className="client-proof-file-field">
                      <span>File Bukti</span>
                      <input
                        accept="image/*"
                        type="file"
                        onChange={(event) => setSimProofFile(event.target.files?.[0] || null)}
                      />
                      <small>{simProofFile ? simProofFile.name : 'JPG, PNG, WEBP maks 8 MB'}</small>
                    </label>

                    <label className="client-proof-note-field">
                      <span>Catatan</span>
                      <textarea
                        value={simProofNote}
                        placeholder="Opsional. Contoh: Transfer dari BCA a/n Team Mabes."
                        onChange={(event) => setSimProofNote(event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="client-booking-actions">
              <button
                type="button"
                onClick={() => setIsSimulatorOpen(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-colors"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={submitBookingRequest}
                disabled={isSubmittingRequest}
                className="flex-[2] py-3 rounded-xl bg-[#2ecc71] hover:bg-[#27ae60] disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xl transition-transform active:scale-[0.98]"
              >
                <Phone size={13} />
                <span>{isSubmittingRequest ? 'Mengirim...' : 'Kirim Request'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Detail Modal (To view invoices, receipts, and DP breakdown) */}
      {selectedBookingDetail && (
        <div className="client-detail-modal-backdrop">
          <div className="client-detail-modal">
            <h3 className="client-detail-modal-title">
              <Receipt size={18} className="text-[#ff8a2a]" />
              <span>Detail Invoice Booking</span>
            </h3>

            {getBookingRequestStatusMeta(selectedBookingDetail) ? (
              <section className={'client-request-state is-' + getBookingRequestStatusMeta(selectedBookingDetail).tone}>
                <span>Status request</span>
                <strong>{getBookingRequestStatusMeta(selectedBookingDetail).label}</strong>
                {selectedBookingDetail.adminResponseNote ? <small>{selectedBookingDetail.adminResponseNote}</small> : null}
              </section>
            ) : null}

            {getLatestPaymentProof(selectedBookingDetail) ? (
              <section className={'client-payment-proof-detail ' + getProofTone(getLatestPaymentProof(selectedBookingDetail).status)}>
                <span>Status bukti pembayaran</span>
                <strong>{getPaymentProofStatusLabel(getLatestPaymentProof(selectedBookingDetail).status)}</strong>
                <small>
                  {getLatestPaymentProof(selectedBookingDetail).category === 'pelunasan' ? 'Pelunasan' : 'DP'} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {formatRupiah(getLatestPaymentProof(selectedBookingDetail).amount)}
                </small>
              </section>
            ) : null}

            {/* Visual Invoice Sheet */}
            <div className="p-5 rounded-xl bg-white/[0.01] border border-white/5 space-y-4 text-xs font-sans">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">{studioSettings.studioName || invoiceSettings.studioName || defaultStudioSettings.studioName}</h4>
                  <p className="text-[10px] text-[var(--ui-text-muted)] leading-relaxed max-w-[180px]">{invoiceSettings.address || 'Alamat Studio'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[var(--ui-text-muted)] block">Invoice No:</span>
                  <strong className="text-white text-xs tracking-wide">{selectedBookingDetail.invoiceNumber || 'INV-00000'}</strong>
                  <button className="client-copy-code" type="button" onClick={() => copyText(selectedBookingDetail.bookingCode || selectedBookingDetail.id, 'Kode booking disalin.')}>
                    <Copy size={11} /> Salin kode
                  </button>
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

            {selectedBookingDetail.clientUid ? (
              <BookingConversationPanel
                booking={selectedBookingDetail}
                role="client"
                user={currentUser}
              />
            ) : null}

            <div className="client-detail-utilities">
              <button type="button" onClick={() => downloadCalendarEvent(selectedBookingDetail)}><CalendarPlus size={13} />Kalender</button>
              <a href={getBookingSupportUrl(selectedBookingDetail)} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} />Bantuan booking</a>
              {['submitted', 'confirmed'].includes(selectedBookingDetail.bookingRequestStatus) ? (
                <button className="is-danger" type="button" onClick={() => requestCancellation(selectedBookingDetail)}>Minta batal</button>
              ) : null}
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
                <button
                  type="button"
                  onClick={() => {
                    openPaymentProofModal(selectedBookingDetail);
                    setSelectedBookingDetail(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-[#2ecc71] hover:bg-[#27ae60] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xl transition-all"
                >
                  <UploadCloud size={12} />
                  <span>Upload Bukti</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedProofBooking ? (
        <div className="client-proof-modal-backdrop" role="presentation">
          <section className="client-proof-modal" role="dialog" aria-modal="true" aria-label="Upload bukti pembayaran">
            <header>
              <span><UploadCloud size={16} />Upload Bukti</span>
              <button aria-label="Tutup upload bukti" type="button" onClick={closePaymentProofModal}>
                <X size={17} />
              </button>
            </header>

            <div className="client-proof-modal-booking">
              <Image size={16} />
              <span>
                <strong>{selectedProofBooking.sessionLabel || selectedProofBooking.packageLabel || selectedProofBooking.title || 'Sesi Studio'}</strong>
                <small>{selectedProofBooking.date} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {String(selectedProofBooking.startHour).padStart(2, '0')}.00 WIB</small>
              </span>
            </div>

            <div className="client-proof-modal-grid">
              <label>
                <span>Kategori Pembayaran</span>
                <select
                  value={proofCategory}
                  onChange={(event) => {
                    const nextCategory = event.target.value;
                    setProofCategory(nextCategory);
                    setProofAmount(String(getDefaultProofAmount(selectedProofBooking, nextCategory)));
                  }}
                >
                  {paymentProofCategoryOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Metode</span>
                <select value={proofMethod} onChange={(event) => setProofMethod(event.target.value)}>
                  {paymentProofMethodOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Nominal</span>
                <input
                  inputMode="numeric"
                  min="1"
                  type="number"
                  value={proofAmount}
                  onChange={(event) => setProofAmount(event.target.value)}
                />
              </label>

              <label className="client-proof-file-field">
                <span>File Bukti</span>
                <input
                  accept="image/*"
                  type="file"
                  onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                />
                <small>{proofFile ? proofFile.name : 'JPG, PNG, WEBP maks 8 MB'}</small>
              </label>

              <label className="client-proof-note-field">
                <span>Catatan Client</span>
                <textarea
                  placeholder="Opsional. Contoh: Transfer dari BCA a/n Team Mabes."
                  value={proofNote}
                  onChange={(event) => setProofNote(event.target.value)}
                />
              </label>
            </div>

            <footer>
              <button type="button" onClick={closePaymentProofModal} disabled={isSubmittingProof}>
                Batal
              </button>
              <button type="button" onClick={submitStandalonePaymentProof} disabled={isSubmittingProof || !proofFile}>
                {isSubmittingProof ? 'Mengirim...' : 'Submit Bukti'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {actionFeedback ? (
        <div className="client-action-feedback" role="status" aria-live="polite">
          <Check size={15} />{actionFeedback}
        </div>
      ) : null}
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









