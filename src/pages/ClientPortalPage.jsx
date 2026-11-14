import { lazy, Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  CalendarDays,
  ClipboardList,
  UserRound,
  LogOut,
  Receipt,
  CalendarPlus,
  Copy,
  Check,
  Landmark,
  MessageCircle,
  Moon,
  CreditCard,
  Sun,
  Bell,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase.js';
import { createRepositoryRequestId } from '../lib/firestoreRepositoryFoundation.js';
import {
  BOOKING_PAYMENT_STATUS_META,
  BOOKING_SESSION_STATUS_META,
} from '../domain/booking/bookingStatus.js';
import { adminBookingRepository } from '../services/adminBookingRepository.js';
import { notificationEventRepository } from '../services/notificationEventRepository.js';
import {
  getBookingPaymentStatus,
  getBookingRequestStatus,
  getBookingSessionStatus,
  getLegacyBookingPaymentStatus,
  isBookingCancelled,
  isBookingPaymentOpen,
} from '../domain/booking/bookingSelectors.js';
import { syncClientCustomerProfile } from '../services/clientProfileRepository.js';
import { accountRoleRepository } from '../services/accountRoleRepository.js';
import { PORTAL_ACCESS } from '../utils/accountRoles.js';
import {
  isBookingStartOccupied,
  parseClientBookingResume,
} from '../utils/clientBookingHandoff.js';
import {
  getBookingOutstandingAmount,
} from '../utils/bookingPaymentUtils.js';
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
  formatBankAccountNumber,
  getStudioPaymentTerms,
  useStudioSettings,
} from '../settings/studioSettings.js';
import {
  buildPaymentProofPayload,
  getPaymentProofStatusLabel,
  paymentProofCategoryOptions,
  paymentProofMethodOptions,
  paymentProofRepository,
} from '../services/paymentProofRepository.js';
import { businessHours, statusFilters } from '../constants/scheduleConfig.js';
import BookingConversationPanel from '../components/booking/BookingConversationPanel.jsx';
import ClientDashboardTab from '../components/client/ClientDashboardTab.jsx';
import ClientCalendarTab from '../components/client/ClientCalendarTab.jsx';
import ClientHistoryTab from '../components/client/ClientHistoryTab.jsx';
import ClientBookingWizard from '../components/client/ClientBookingWizard.jsx';
import ClientBillingTab from '../components/client/ClientBillingTab.jsx';
import ClientBookingsHub from '../components/client/ClientBookingsHub.jsx';
import ClientAccountTab from '../components/client/ClientAccountTab.jsx';
import ClientNotificationsPanel from '../components/client/ClientNotificationsPanel.jsx';
import {
  createClientAiContext,
} from '../utils/roleAiContext.js';
import { useTheme } from '../theme/ThemeProvider.jsx';

import '../styles/routes/client.css';
import '../styles/modules/client-portal-overhaul.css';

const RoleAiAssistant = lazy(() => import('../components/ai/RoleAiAssistant.jsx'));

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
  return getLegacyBookingPaymentStatus(booking);
}
function getStatusLabel(status) {
  return statusFilters.find((item) => item.key === status)?.label || status;
}
function getClientBookingLifecycleSteps(booking) {
  const reqStatus = getBookingRequestStatus(booking);
  const payStatus = getBookingPaymentStatus(booking);
  const sessStatus = getBookingSessionStatus(booking);
  const isCancelledState = ['rejected', 'cancelled'].includes(reqStatus) || ['cancelled', 'void'].includes(payStatus) || sessStatus === 'cancelled';

  const step2State = isCancelledState
    ? 'is-cancelled'
    : reqStatus === 'confirmed'
      ? 'is-done'
      : 'is-current';

  const step3State = isCancelledState
    ? 'is-cancelled'
    : payStatus === 'paid'
      ? 'is-done'
      : reqStatus === 'confirmed'
        ? 'is-current'
        : 'is-upcoming';

  const step4State = isCancelledState
    ? 'is-cancelled'
    : sessStatus === 'completed'
      ? 'is-done'
      : sessStatus === 'active' || (reqStatus === 'confirmed' && payStatus === 'paid')
        ? 'is-current'
        : 'is-upcoming';

  return [
    { key: 'request', num: '1', label: 'Request Terkirim', state: 'is-done' },
    { key: 'confirm', num: '2', label: reqStatus === 'confirmed' ? 'Terkonfirmasi' : isCancelledState ? 'Dibatalkan' : 'Review Admin', state: step2State },
    { key: 'payment', num: '3', label: payStatus === 'paid' ? 'Lunas' : payStatus === 'partial' ? 'DP Tercatat' : 'Pembayaran', state: step3State },
    { key: 'session', num: '4', label: sessStatus === 'completed' ? 'Sesi Selesai' : 'Sesi Studio', state: step4State },
  ];
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

      // exclude cancelled / inactive bookings through canonical selectors
      const isCancelled = isBookingCancelled(booking);

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

export default function ClientPortalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const pricingSettings = usePricingSettings();
  const invoiceSettings = useInvoiceSettings();
  const studioSettings = useStudioSettings();
  const transferAccountNumber = studioSettings.bankAccountNumber || defaultStudioSettings.bankAccountNumber;
  const studioPaymentTerms = useMemo(() => getStudioPaymentTerms(studioSettings), [studioSettings]);

  // Authentication & Loading States
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(firebaseAuth));

  // Tab State
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'book' | 'bookings' | 'account'
  const [bookingsSection, setBookingsSection] = useState('bookings'); // 'bookings' | 'payments'

  // Booking Data State
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(Boolean(firebaseAuth));
  const [bookingsError, setBookingsError] = useState('');
  const [bookingsRetryVersion, setBookingsRetryVersion] = useState(0);
  const [calendarSlots, setCalendarSlots] = useState([]);
  const [calendarSlotsReady, setCalendarSlotsReady] = useState(false);
  const [calendarSlotsLoading, setCalendarSlotsLoading] = useState(Boolean(firebaseAuth));
  const [calendarSlotsError, setCalendarSlotsError] = useState('');
  const [calendarRetryVersion, setCalendarRetryVersion] = useState(0);
  const [paymentProofsLoading, setPaymentProofsLoading] = useState(Boolean(firebaseAuth));
  const [paymentProofsError, setPaymentProofsError] = useState('');
  const [paymentProofsRetryVersion, setPaymentProofsRetryVersion] = useState(0);
  const [clientNotifications, setClientNotifications] = useState([]);
  const [clientNotificationsLoading, setClientNotificationsLoading] = useState(Boolean(firebaseAuth));
  const [clientNotificationsError, setClientNotificationsError] = useState('');
  const [clientNotificationsRetryVersion, setClientNotificationsRetryVersion] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const publicBookingResumeKeyRef = useRef('');
  const clientBookingRequestIdentityRef = useRef(null);
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
  const [proofReference, setProofReference] = useState('');
  const [proofPayerName, setProofPayerName] = useState('');
  const [proofRequestId, setProofRequestId] = useState(() => createRepositoryRequestId());
  const [proofNote, setProofNote] = useState('');
  const [simProofEnabled, setSimProofEnabled] = useState(false);
  const [simProofCategory, setSimProofCategory] = useState('dp');
  const [simProofMethod, setSimProofMethod] = useState('transfer');
  const [simProofAmount, setSimProofAmount] = useState('');
  const [simProofReference, setSimProofReference] = useState('');
  const [simProofPayerName, setSimProofPayerName] = useState('');
  const [simProofRequestId, setSimProofRequestId] = useState(() => createRepositoryRequestId());
  const [simProofNote, setSimProofNote] = useState('');

  function retryClientBookings() {
    setBookings([]);
    setBookingsLoading(true);
    setBookingsError('');
    setBookingsRetryVersion((value) => value + 1);
  }

  function retryCalendarSlots() {
    setCalendarSlots([]);
    setCalendarSlotsReady(false);
    setCalendarSlotsLoading(true);
    setCalendarSlotsError('');
    setCalendarRetryVersion((value) => value + 1);
  }

  function retryPaymentProofs() {
    setPaymentProofs([]);
    setPaymentProofsLoading(true);
    setPaymentProofsError('');
    setPaymentProofsRetryVersion((value) => value + 1);
  }

  function retryClientNotifications() {
    setClientNotifications([]);
    setClientNotificationsLoading(true);
    setClientNotificationsError('');
    setClientNotificationsRetryVersion((value) => value + 1);
  }

  // Calendar parameters (default to clean 1-day view on compact mobile viewports)
  const [calendarViewMode, setCalendarViewMode] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches ? 'day' : 'week'
  )); // 'day' | 'week' | 'month'
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
  const [simCustomerName, setSimCustomerName] = useState('');
  const [simCustomerPhone, setSimCustomerPhone] = useState('');

  // Client Check Auth
  useEffect(() => {
    if (!firebaseAuth) return;
    let checkSequence = 0;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      const currentSequence = ++checkSequence;
      // Clear the previous account's data before resolving a new auth session.
      // This prevents a brief cross-account display during token/account changes.
      setAuthLoading(true);
      setCurrentUser(null);
      setBookings([]);
      setBookingsLoading(Boolean(user));
      setBookingsError('');
      setCalendarSlots([]);
      setCalendarSlotsReady(false);
      setCalendarSlotsLoading(Boolean(user));
      setCalendarSlotsError('');
      setPaymentProofs([]);
      setPaymentProofsLoading(Boolean(user));
      setPaymentProofsError('');
      setClientNotifications([]);
      setClientNotificationsLoading(Boolean(user));
      setClientNotificationsError('');
      setSelectedBookingDetail(null);
      setIsNotificationsOpen(false);

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
    return () => {
      checkSequence += 1;
      unsubscribe();
    };
  }, [navigate]);

  // Load client-owned bookings from Firestore with an explicit retryable state.
  useEffect(() => {
    if (!currentUser) return undefined;

    let active = true;
    let unsubscribe;

    try {
      unsubscribe = adminBookingRepository.subscribeClientBookingsForUser(
        currentUser,
        (data) => {
          if (!active) return;
          setBookings(data);
          setBookingsLoading(false);
          setBookingsError('');
        },
        (err) => {
          console.error('Gagal mengambil booking client:', err);
          if (!active) return;
          setBookingsLoading(false);
          setBookingsError('Data booking belum dapat dimuat. Periksa koneksi lalu coba lagi.');
        }
      );
    } catch (error) {
      console.error('Gagal memasang subscription booking client:', error);
      Promise.resolve().then(() => {
        if (!active) return;
        setBookingsLoading(false);
        setBookingsError('Data booking belum dapat dimuat. Periksa koneksi lalu coba lagi.');
      });
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [currentUser, bookingsRetryVersion]);

  // Availability is actionable only after the public-safe slot mirror emits a snapshot.
  useEffect(() => {
    if (!currentUser) return undefined;

    let active = true;
    let unsubscribe;

    try {
      unsubscribe = adminBookingRepository.subscribeClientCalendarSlots(
        (data) => {
          if (!active) return;
          setCalendarSlots(data);
          setCalendarSlotsReady(true);
          setCalendarSlotsLoading(false);
          setCalendarSlotsError('');
        },
        (err) => {
          console.error('Gagal mengambil slot calendar client:', err);
          if (!active) return;
          setCalendarSlotsReady(false);
          setCalendarSlotsLoading(false);
          setCalendarSlotsError('Ketersediaan jadwal belum dapat diverifikasi. Slot booking dinonaktifkan sampai data berhasil dimuat.');
        }
      );
    } catch (error) {
      console.error('Gagal memasang subscription slot calendar client:', error);
      Promise.resolve().then(() => {
        if (!active) return;
        setCalendarSlotsReady(false);
        setCalendarSlotsLoading(false);
        setCalendarSlotsError('Ketersediaan jadwal belum dapat diverifikasi. Slot booking dinonaktifkan sampai data berhasil dimuat.');
      });
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [currentUser, calendarRetryVersion]);

  // Resume a slot selected from the public /book entry after authentication.
  useEffect(() => {
    if (!currentUser || !calendarSlotsReady) return;

    const resume = parseClientBookingResume(location.search);
    if (!resume) return;

    const resumeKey = resume.date + ':' + String(resume.startHour);

    if (publicBookingResumeKeyRef.current === resumeKey) return;

    const hasValidBusinessHour = businessHours.some(
      (hour) => Number(hour.start) === Number(resume.startHour)
    );

    const resumeDate = new Date(resume.date + 'T00:00:00');
    const isResumeDateValid = !Number.isNaN(resumeDate.getTime());
    const isResumeOccupied =
      isResumeDateValid &&
      isBookingStartOccupied(
        calendarSlots,
        resume.date,
        resume.startHour
      );

    /**
     * Defer the UI state transition out of the synchronous effect body.
     * This keeps the effect responsible for reacting to the external
     * URL/auth/Firestore handoff without causing cascading renders.
     */
    const resumeTimer = window.setTimeout(() => {
      if (publicBookingResumeKeyRef.current === resumeKey) return;

      publicBookingResumeKeyRef.current = resumeKey;

      if (!hasValidBusinessHour) {
        setActionFeedback('Jam booking yang dipilih sudah tidak valid. Silakan pilih ulang dari kalender.');
        setActiveTab('book');
        navigate('/client/portal', { replace: true });
        return;
      }

      if (!isResumeDateValid || isResumeOccupied) {
        setActionFeedback('Slot yang dipilih sudah terisi. Silakan pilih jadwal lain.');
        setActiveTab('book');

        if (isResumeDateValid) {
          setCalendarSelectedDate(startOfDay(resumeDate));
        }

        navigate('/client/portal', { replace: true });
        return;
      }

      setCalendarSelectedDate(startOfDay(resumeDate));
      setActiveTab('book');
      setSimulatorDate(resume.date);
      setSimulatorStartHour(String(resume.startHour));
      setSimSessionType('rehearsal');
      setSimPackageId('none');
      setSimRecordingTypeId('none');
      setSimDuration('2');
      setSimCustomDuration('');
      setSimCustomerName(currentUser.displayName || currentUser.email?.split('@')[0] || '');
      setSimCustomerPhone(currentUser.phoneNumber || '');
      setSimProofEnabled(false);
      setSimProofCategory('dp');
      setSimProofMethod('transfer');
      setSimProofAmount('');
      setSimProofNote('');
      setIsSimulatorOpen(true);
      navigate('/client/portal', { replace: true });
    }, 0);

    return () => {
      window.clearTimeout(resumeTimer);
    };
  }, [
    calendarSlots,
    calendarSlotsReady,
    currentUser,
    location.search,
    navigate,
  ]);

  // Load payment proofs belonging to the authenticated client.
  useEffect(() => {
    if (!currentUser) return undefined;

    let active = true;
    let unsubscribe;

    try {
      unsubscribe = paymentProofRepository.subscribeClientPaymentProofs(
        currentUser,
        (data) => {
          if (!active) return;
          setPaymentProofs(data);
          setPaymentProofsLoading(false);
          setPaymentProofsError('');
        },
        (err) => {
          console.error('Gagal mengambil bukti pembayaran client:', err);
          if (!active) return;
          setPaymentProofsLoading(false);
          setPaymentProofsError('Riwayat bukti pembayaran belum dapat dimuat. Coba ulang tanpa mengirim bukti baru.');
        }
      );
    } catch (error) {
      console.error('Gagal memasang subscription bukti pembayaran client:', error);
      Promise.resolve().then(() => {
        if (!active) return;
        setPaymentProofsLoading(false);
        setPaymentProofsError('Riwayat bukti pembayaran belum dapat dimuat. Coba ulang tanpa mengirim bukti baru.');
      });
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [currentUser, paymentProofsRetryVersion]);

  // Client notifications are an immutable, recipient-scoped activity feed.
  useEffect(() => {
    if (!currentUser) return undefined;

    let active = true;
    let unsubscribe;

    try {
      unsubscribe = notificationEventRepository.subscribeClientNotificationEvents(
        currentUser,
        (events) => {
          if (!active) return;
          setClientNotifications(events);
          setClientNotificationsLoading(false);
          setClientNotificationsError('');
        },
        (err) => {
          console.error('Gagal mengambil notifikasi client:', err);
          if (!active) return;
          setClientNotificationsLoading(false);
          setClientNotificationsError('Aktivitas belum dapat dimuat. Periksa koneksi lalu coba lagi.');
        }
      );
    } catch (error) {
      console.error('Gagal memasang subscription notifikasi client:', error);
      Promise.resolve().then(() => {
        if (!active) return;
        setClientNotificationsLoading(false);
        setClientNotificationsError('Aktivitas belum dapat dimuat. Periksa koneksi lalu coba lagi.');
      });
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [currentUser, clientNotificationsRetryVersion]);

  useEffect(() => {
    if (!isNotificationsOpen) return undefined;

    function handleNotificationEscape(event) {
      if (event.key === 'Escape') setIsNotificationsOpen(false);
    }

    window.addEventListener('keydown', handleNotificationEscape);
    return () => window.removeEventListener('keydown', handleNotificationEscape);
  }, [isNotificationsOpen]);

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

  // Notification destinations are resolved only against the already-scoped
  // client booking query; arbitrary event URLs are never navigated to.
  useEffect(() => {
    const bookingId = new URLSearchParams(location.search).get('bookingId');
    if (!bookingId || !currentUser || bookingsLoading || bookingsError) return undefined;

    let active = true;
    const resolveNotificationBooking = window.setTimeout(() => {
      if (!active) return;

      const ownedBooking = userBookings.find((booking) => booking.id === bookingId);
      if (ownedBooking) {
        setBookingsSection('bookings');
        setActiveTab('bookings');
        setSelectedBookingDetail(ownedBooking);
      } else {
        setActionFeedback('Booking dari notifikasi tidak tersedia di data akun ini.');
      }

      navigate('/client/portal', { replace: true });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(resolveNotificationBooking);
    };
  }, [bookingsError, bookingsLoading, currentUser, location.search, navigate, userBookings]);

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

    const completedBookings = userBookings.filter((booking) => {
      const paymentStatus = getBookingPaymentStatus(booking);

      return (
        !isBookingCancelled(booking) &&
        ['partial', 'paid'].includes(paymentStatus)
      );
    }).length;

    const totalDuration = userBookings.reduce((sum, booking) => {
      if (isBookingCancelled(booking)) return sum;

      return (
        sum +
        (Number(booking.durationHours) ||
          Number(booking.duration) ||
          0)
      );
    }, 0);

    const unpaidAmount = userBookings.reduce((sum, booking) => {
      if (isBookingCancelled(booking)) return sum;

      return sum + getBookingOutstandingAmount(booking);
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
    return userBookings.filter(
      (booking) =>
        !isBookingCancelled(booking) &&
        isBookingPaymentOpen(booking)
    );
  }, [userBookings]);

  const upcomingBooking = useMemo(() => {
    const now = new Date();

    return userBookings
      .filter((booking) => {
        if (isBookingCancelled(booking)) return false;
        if (getBookingSessionStatus(booking, { now }) !== 'upcoming') return false;
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

  const clientActionBadgeCount = bookingsLoading || bookingsError || paymentProofsLoading || paymentProofsError
    ? null
    : unreadAdminMessages + pendingPaymentProofs.length;

  const clientAiContext = useMemo(
    () => createClientAiContext({
      activeTab,
      bookings: userBookings,
      pendingPaymentProofs: pendingPaymentProofs.length,
      stats,
      upcomingBooking,
    }),
    [activeTab, pendingPaymentProofs.length, stats, upcomingBooking, userBookings],
  );

  const filteredHistoryBookings = useMemo(() => {
    const normalizedQuery = historyQuery.trim().toLowerCase();
    const now = new Date();

    return userBookings.filter((booking) => {
      const sessionStatus = getBookingSessionStatus(booking, { now });
      const cancelled = isBookingCancelled(booking);
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
        return bookingDate >= now && sessionStatus === 'upcoming' && !cancelled;
      }
      if (historyFilter === 'unpaid') return isBookingPaymentOpen(booking) && !cancelled;
      if (historyFilter === 'completed') {
        return bookingDate < now && ['completed', 'no_show'].includes(sessionStatus) && !cancelled;
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

  // Visual status label tones
  function getProofTone(status) {
    if (status === 'approved') return 'is-approved';
    if (status === 'rejected') return 'is-rejected';
    return 'is-pending';
  }

  function getDefaultProofAmount(booking, category = 'dp') {
    const outstanding = getBookingOutstandingAmount(booking);
    if (category === 'pelunasan') return outstanding;
    return Math.min(outstanding || 50000, Math.max(50000, Number(booking?.dpAmount || 50000) || 50000));
  }

  function resetStandaloneProofForm() {
    setProofCategory('dp');
    setProofMethod('transfer');
    setProofAmount('');
    setProofReference('');
    setProofPayerName('');
    setProofRequestId(createRepositoryRequestId());
    setProofNote('');
  }

  function resetSimulatorProofForm() {
    setSimProofEnabled(false);
    setSimProofCategory('dp');
    setSimProofMethod('transfer');
    setSimProofAmount('');
    setSimProofReference('');
    setSimProofPayerName('');
    setSimProofRequestId(createRepositoryRequestId());
    setSimProofNote('');
  }

  function openPaymentProofModal(booking, initialCategory) {
    if (paymentProofsLoading || paymentProofsError) {
      setActionFeedback('Status bukti pembayaran belum dapat diverifikasi. Muat ulang data sebelum mengirim bukti.');
      window.setTimeout(() => setActionFeedback(''), 5200);
      return;
    }

    const status = getBookingPaymentStatus(booking);
    const nextCategory = initialCategory || (status === 'partial' ? 'pelunasan' : 'dp');

    setSelectedProofBooking(booking);
    setProofCategory(nextCategory);
    setProofMethod('transfer');
    setProofAmount(String(getDefaultProofAmount(booking, nextCategory)));
    setProofReference('');
    setProofPayerName('');
    setProofRequestId(createRepositoryRequestId());
    setProofNote('');
  }

  function closePaymentProofModal() {
    if (isSubmittingProof) return;
    setSelectedProofBooking(null);
    resetStandaloneProofForm();
  }

  async function submitProofForBooking({ amount, booking, category, clientNote, method, payerName, requestId, transactionReference }) {
    if (!currentUser) throw new Error('Client wajib login untuk mengirim referensi pembayaran.');
    const payload = buildPaymentProofPayload({
      booking,
      clientUser: currentUser,
      requestId,
      form: { amount, category, clientNote, method, payerName, transactionReference },
    });
    return paymentProofRepository.submitPaymentProof(payload);
  }

  async function submitStandalonePaymentProof() {
    if (!selectedProofBooking || isSubmittingProof) return;

    if (paymentProofsLoading || paymentProofsError) {
      setActionFeedback('Status bukti pembayaran belum dapat diverifikasi. Muat ulang data sebelum mengirim bukti.');
      window.setTimeout(() => setActionFeedback(''), 5200);
      return;
    }

    setIsSubmittingProof(true);
    setActionFeedback('');

    try {
      await submitProofForBooking({
        amount: Number(proofAmount),
        booking: selectedProofBooking,
        category: proofCategory,
        clientNote: proofNote,
        method: proofMethod,
        payerName: proofPayerName,
        requestId: proofRequestId,
        transactionReference: proofReference,
      });

      setSelectedProofBooking(null);
      resetStandaloneProofForm();
      toast.success('Referensi pembayaran berhasil dikirim. Menunggu review admin.');
      setActionFeedback('Referensi pembayaran berhasil dikirim. Menunggu review admin.');
      window.setTimeout(() => setActionFeedback(''), 4200);
    } catch (error) {
      console.error('Gagal mengirim referensi pembayaran:', error);
      toast.error(error?.message || 'Referensi pembayaran gagal dikirim.');
      setActionFeedback(error?.message || 'Referensi pembayaran gagal dikirim.');
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
    if (!currentUser || !simulatorDate || isSubmittingRequest) return null;

    if (!calendarSlotsReady || calendarSlotsError || bookingsLoading || bookingsError) {
      setActionFeedback('Data jadwal belum siap atau belum dapat diverifikasi. Muat ulang data sebelum mengirim booking.');
      window.setTimeout(() => setActionFeedback(''), 5200);
      return null;
    }

    if (isBookingStartOccupied(calendarSlots, simulatorDate, Number(simulatorStartHour))) {
      setIsSimulatorOpen(false);
      setActiveTab('book');
      setActionFeedback('Slot ini baru saja terisi. Pilih jadwal lain yang masih tersedia.');
      window.setTimeout(() => setActionFeedback(''), 5200);
      return null;
    }

    if (!simCustomerName.trim()) {
      setActionFeedback('Nama pelanggan wajib diisi.');
      window.setTimeout(() => setActionFeedback(''), 3600);
      return null;
    }

    if (!simCustomerPhone.trim()) {
      setActionFeedback('Nomor HP / WhatsApp wajib diisi.');
      window.setTimeout(() => setActionFeedback(''), 3600);
      return null;
    }

    if (simProofEnabled && String(simProofReference || '').trim().length < 4) {
      setActionFeedback('Nomor referensi transaksi minimal 4 karakter sebelum booking dikirim.');
      window.setTimeout(() => setActionFeedback(''), 4200);
      return null;
    }

    const duplicateRequest = userBookings.find((booking) => {
      const requestStatus = getBookingRequestStatus(booking);
      const sameDate = booking.date === simulatorDate;
      const sameStart = Number(booking.startHour) === Number(simulatorStartHour);

      return sameDate && sameStart && requestStatus === 'submitted';
    });

    if (duplicateRequest) {
      setActionFeedback('Request untuk slot ini sudah pernah dikirim. Silakan cek Riwayat.');
      window.setTimeout(() => setActionFeedback(''), 3600);
      return null;
    }

    const selectedPackage = packageOptions.find((item) => item.key === simPackageId);
    const selectedSession = sessionOptions.find((item) => item.key === simSessionType);
    const selectedRecording = recordingTypeOptions.find((item) => item.key === simRecordingTypeId);
    const isRecordingRequest = simPackageId === 'none' && isRecordingSessionId(simSessionType);
    const sessionLabel =
      selectedPackage?.label ||
      selectedRecording?.label?.split(' • ')[0] ||
      selectedSession?.label ||
      'Sesi Studio';

    if (isRecordingRequest && !selectedRecording) {
      setActionFeedback('Pilih jenis recording terlebih dahulu. Harga Recording diambil dari Recording Type.');
      window.setTimeout(() => setActionFeedback(''), 4200);
      return null;
    }

    const requestPayload = {
      customer: simCustomerName.trim(),
      phone: simCustomerPhone.trim(),
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
      startTimeLabel: String(simulatorStartHour).padStart(2, '0') + '.00',
      durationHours: actualDuration,
      subtotal: pricingBreakdown.subtotal,
      discountAmount: pricingBreakdown.discountAmount,
      appliedDiscounts: pricingBreakdown.appliedDiscounts,
      total: pricingBreakdown.total,
    };
    const requestFingerprint = JSON.stringify({
      clientUid: currentUser.uid,
      ...requestPayload,
    });
    const previousRequestIdentity = clientBookingRequestIdentityRef.current;
    const previousRequestBooking = previousRequestIdentity
      ? userBookings.find((booking) => booking.id === previousRequestIdentity.id)
      : null;
    const previousRequestStatus = previousRequestBooking
      ? getBookingRequestStatus(previousRequestBooking)
      : '';
    const previousRequestWasRejected = ['rejected', 'cancelled'].includes(previousRequestStatus);

    if (
      previousRequestIdentity?.pendingRecovery &&
      previousRequestIdentity.fingerprint !== requestFingerprint &&
      !previousRequestWasRejected
    ) {
      setActionFeedback('Permintaan sebelumnya belum dapat dipastikan tersimpan atau tidak. Kirim ulang dengan data yang sama terlebih dahulu agar tidak membuat permintaan booking duplikat.');
      window.setTimeout(() => setActionFeedback(''), 5200);
      return null;
    }

    const requestIdentity =
      !previousRequestIdentity ||
      previousRequestIdentity.fingerprint !== requestFingerprint ||
      previousRequestWasRejected
        ? {
            id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : 'client-' + Date.now() + '-' + Math.random().toString(16).slice(2),
            fingerprint: requestFingerprint,
            pendingRecovery: false,
            committed: false,
          }
        : previousRequestIdentity;
    clientBookingRequestIdentityRef.current = requestIdentity;

    setIsSubmittingRequest(true);
    setActionFeedback('');

    try {
      await accountRoleRepository.ensureAccountIdentity(currentUser, 'client');

      let createdBooking = null;

      try {
        createdBooking = await adminBookingRepository.createClientBookingRequest(currentUser, {
          ...requestPayload,
          requestId: requestIdentity.id,
        });
        clientBookingRequestIdentityRef.current = {
          ...requestIdentity,
          pendingRecovery: false,
          committed: true,
        };

        if (simProofEnabled) {
          if (String(simProofReference || '').trim().length < 4) {
            throw new Error('Request tersimpan, tetapi nomor referensi transaksi belum lengkap.');
          }

          await submitProofForBooking({
            amount: Number(
              simProofAmount ||
                getDefaultProofAmount(
                  createdBooking,
                  simProofCategory,
                ),
            ),
            booking: createdBooking,
            category: simProofCategory,
            clientNote: simProofNote,
            method: simProofMethod,
            payerName: simProofPayerName,
            requestId: simProofRequestId + ':' + createdBooking.id,
            transactionReference: simProofReference,
          });
        }
      } catch (innerError) {
        if (createdBooking) {
          const warning =
            innerError?.message ||
            'Request tersimpan, tetapi referensi pembayaran gagal dikirim.';

          resetSimulatorProofForm();

          return {
            booking: createdBooking,
            warning,
          };
        }

        throw innerError;
      }

      resetSimulatorProofForm();
      toast.success('Request booking berhasil dikirim ke admin.');

      return {
        booking: createdBooking,
        warning: '',
      };
    } catch (error) {
      if (clientBookingRequestIdentityRef.current?.id === requestIdentity.id) {
        clientBookingRequestIdentityRef.current = {
          ...requestIdentity,
          pendingRecovery: true,
        };
      }
      const errorCode = error?.code || error?.name || 'unknown';
      const errorMessage = error?.message || String(error || 'Unknown error');

      console.error('Gagal mengirim booking request:', {
        code: errorCode,
        message: errorMessage,
        user: currentUser
          ? {
              uid: currentUser.uid,
              email: currentUser.email,
              phoneNumber: currentUser.phoneNumber,
            }
          : null,
        payload: {
          date: simulatorDate,
          durationHours: actualDuration,
          startHour: Number(simulatorStartHour),
          total: pricingBreakdown.total,
          email: currentUser?.email || '',
          uid: currentUser?.uid || '',
        },
      });

      const friendlyMessage =
        errorCode === 'permission-denied'
          ? 'Request ditolak oleh rules database. Deploy Firestore rules terbaru lalu coba lagi.'
          : 'Permintaan booking gagal disimpan. Silakan coba lagi.';

      toast.error(friendlyMessage);
      setActionFeedback(friendlyMessage);
      window.setTimeout(() => setActionFeedback(''), 5200);

      return null;
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  // Billing WhatsApp redirect
  const getBookingWhatsAppUrl = (booking) => {
    const studioName = studioSettings.studioName || invoiceSettings.studioName || defaultStudioSettings.studioName;
    const amountToPay = getBookingPaymentStatus(booking) === 'partial'
      ? Math.max(0, (booking.total || 0) - (booking.paidAmount || booking.dpAmount || 0))
      : (booking.total || 0);

    const text = `Halo *${studioName}*, saya ingin melakukan pelunasan tagihan booking berikut:

📌 *Kode Booking* : ${booking.bookingCode || booking.id}
👤 *Nama* : ${currentUser?.displayName || 'Pelanggan'}
📅 *Tanggal Sesi* : ${booking.date}
⏰ *Jam* : ${String(booking.startHour).padStart(2, '0')}.00
💰 *Sisa Tagihan* : ${formatRupiah(amountToPay)}

Saya sudah melakukan transfer. Berikut bukti transfer pembayarannya.`;

    return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`;
  };

  const getBookingSupportUrl = (booking) => {
    const studioName = studioSettings.studioName || invoiceSettings.studioName || defaultStudioSettings.studioName;
    const bookingCode = booking.bookingCode || booking.id || '-';
    const text = `Halo *${studioName}*, saya ingin meminta bantuan terkait booking berikut:\n\n📌 *Kode Booking* : ${bookingCode}\n📅 *Tanggal* : ${booking.date}\n⏰ *Jam* : ${String(booking.startHour).padStart(2, '0')}.00 WIB\n\nHonor bantuan Anda. Terima kasih!`;

    return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`;
  };

  const showActionFeedback = (message) => {
    setActionFeedback(message);
    toast(message);
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

  const handleSlotClick = (slot) => {
    if (!calendarSlotsReady || calendarSlotsError) {
      showActionFeedback(
        calendarSlotsError
          ? 'Jadwal belum dapat diverifikasi. Coba muat ulang sebelum memilih slot.'
          : 'Sedang memuat ketersediaan jadwal. Silakan tunggu sebentar.'
      );
      return;
    }

    setSimulatorDate(slot.date);
    setSimulatorStartHour(slot.startHour);
    setSimSessionType('rehearsal');
    setSimPackageId('none');
    setSimRecordingTypeId('none');
    setSimDuration('2');
    setSimCustomDuration('');
    setSimCustomerName(currentUser?.displayName || currentUser?.email?.split('@')[0] || '');
    setSimCustomerPhone(currentUser?.phoneNumber || '');
    resetSimulatorProofForm();
    setIsSimulatorOpen(true);
  };

  const handleBookingBlockClick = (booking) => {
    setSelectedBookingDetail(booking);
  };

  function handleClientNotificationOpen(event) {
    setIsNotificationsOpen(false);
    const booking = userBookings.find((item) => item.id === event?.bookingId);

    if (!booking) {
      showActionFeedback('Booking terkait tidak tersedia di data akun ini.');
      return;
    }

    setBookingsSection('bookings');
    setActiveTab('bookings');
    setSelectedBookingDetail(booking);
  }

  function handleCreatedBookingView(booking) {
    setIsSimulatorOpen(false);
    setBookingsSection('bookings');
    setActiveTab('bookings');
    setSelectedBookingDetail(booking);
  }

  async function requestCancellation(booking) {
    if (!currentUser || getBookingRequestStatus(booking) === 'cancellation_requested') return;
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
      <div className="client-portal-loading theme-container" role="status" aria-live="polite">
        <span className="client-portal-loading-mark">37</span>
        <div>
          <LoaderCircleWrapper className="client-portal-loading-spinner" size={20} />
          <p>Membuka workspace Anda</p>
        </div>
      </div>
    );
  }

  return (
    <div className="client-portal-page theme-container">
      <a className="client-portal-skip-link" href="#client-portal-main">
        Lewati navigasi client
      </a>
      {/* Background Radial Glow */}
      <div className="client-portal-bg-glow" aria-hidden="true" />
      
      {/* Client Portal application header */}
      <header className="client-portal-header">
        <div className="client-header-identity">
          <div className="client-header-mark">
            37
          </div>

          <div className="client-header-copy">
            <h1>37 Music Studio</h1>
            <p>Client workspace</p>
          </div>
        </div>

        <nav
          className="client-desktop-nav"
          aria-label="Navigasi client desktop"
        >
          <span className="client-desktop-nav-label">Workspace</span>
          <button
            aria-current={activeTab === 'home' ? 'page' : undefined}
            className={activeTab === 'home' ? 'is-active' : ''}
            type="button"
            onClick={() => setActiveTab('home')}
          >
            <Home size={16} />
            <span>Home</span>
          </button>

          <button
            aria-current={activeTab === 'book' ? 'page' : undefined}
            className={activeTab === 'book' ? 'is-active' : ''}
            type="button"
            onClick={() => setActiveTab('book')}
          >
            <CalendarDays size={16} />
            <span>Book</span>
          </button>

          <button
            aria-current={activeTab === 'bookings' ? 'page' : undefined}
            className={activeTab === 'bookings' ? 'is-active' : ''}
            type="button"
            onClick={() => {
              setBookingsSection('bookings');
              setActiveTab('bookings');
            }}
          >
            <ClipboardList size={16} />
            <span>Bookings</span>

            {clientActionBadgeCount > 0 ? (
              <b>
                {clientActionBadgeCount}
              </b>
            ) : null}
          </button>

          <button
            aria-current={activeTab === 'account' ? 'page' : undefined}
            className={activeTab === 'account' ? 'is-active' : ''}
            type="button"
            onClick={() => setActiveTab('account')}
          >
            <UserRound size={16} />
            <span>Account</span>
          </button>
        </nav>

        <div className="client-header-actions">
          <button
            aria-controls="client-notifications-panel"
            aria-expanded={isNotificationsOpen}
            aria-label={isNotificationsOpen ? 'Tutup notifikasi' : 'Buka notifikasi'}
            className="client-notifications-trigger"
            onClick={() => setIsNotificationsOpen((open) => !open)}
            type="button"
          >
            <Bell size={17} aria-hidden="true" />
            {!clientNotificationsLoading && !clientNotificationsError && clientNotifications.length > 0 ? (
              <span className="client-notifications-dot" aria-hidden="true" />
            ) : null}
          </button>
          <div className="client-header-profile">
            <span>{(currentUser?.displayName || currentUser?.email || 'C').slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Client'}</strong>
              <small>Client aktif</small>
            </div>
          </div>

          <button
            className="client-theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Gunakan tema terang' : 'Gunakan tema gelap'}
            aria-pressed={isDark}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            onClick={handleLogout}
            className="client-logout-button"
            title="Keluar dari portal"
            aria-label="Keluar dari portal"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {isNotificationsOpen ? (
        <ClientNotificationsPanel
          events={clientNotifications}
          error={clientNotificationsError}
          isLoading={clientNotificationsLoading}
          onClose={() => setIsNotificationsOpen(false)}
          onOpenBooking={handleClientNotificationOpen}
          onRetry={retryClientNotifications}
        />
      ) : null}

      {/* Client Navigation V2 content */}
      <main
        className="client-portal-main"
        data-view={activeTab}
        id="client-portal-main"
        tabIndex={-1}
      >
        <header className="client-portal-mobile-heading">
          <span className="client-header-mark">37</span>
          <div>
            <small>
              {activeTab === 'home'
                ? 'Overview · 37 Music Studio'
                : activeTab === 'book'
                  ? 'Jadwal Studio · 37 Music Studio'
                  : activeTab === 'bookings'
                    ? 'Riwayat & Bayar · 37 Music Studio'
                    : 'Akun Saya · 37 Music Studio'}
            </small>
            <strong>Halo, {currentUser?.displayName?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'Client'}</strong>
          </div>
          <div className="client-portal-mobile-actions">
            <button
              aria-controls="client-notifications-panel"
              aria-expanded={isNotificationsOpen}
              aria-label={isNotificationsOpen ? 'Tutup notifikasi' : 'Buka notifikasi'}
              className="client-notifications-trigger"
              onClick={() => setIsNotificationsOpen((open) => !open)}
              type="button"
            >
              <Bell size={17} aria-hidden="true" />
              {!clientNotificationsLoading && !clientNotificationsError && clientNotifications.length > 0 ? (
                <span className="client-notifications-dot" aria-hidden="true" />
              ) : null}
            </button>
            <button
              className="client-theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Gunakan tema terang' : 'Gunakan tema gelap'}
              aria-pressed={isDark}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              className="client-logout-button"
              type="button"
              onClick={handleLogout}
              aria-label="Keluar dari portal"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="client-data-status-group">
          {bookingsLoading ? (
            <p className="client-data-status" role="status">Memuat data booking…</p>
          ) : null}
          {bookingsError ? (
            <div className="client-data-status is-error" role="alert">
              <span>{bookingsError}</span>
              <button onClick={retryClientBookings} type="button">Coba lagi</button>
            </div>
          ) : null}
          {activeTab === 'bookings' && bookingsSection === 'payments' && paymentProofsLoading ? (
            <p className="client-data-status" role="status">Memuat riwayat bukti pembayaran…</p>
          ) : null}
          {activeTab === 'bookings' && bookingsSection === 'payments' && paymentProofsError ? (
            <div className="client-data-status is-error" role="alert">
              <span>{paymentProofsError}</span>
              <button onClick={retryPaymentProofs} type="button">Coba lagi</button>
            </div>
          ) : null}
        </div>

        <div className="client-view-stage" key={activeTab}>
        {activeTab === 'home' && (
          <ClientDashboardTab
            clientName={currentUser?.displayName?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'Client'}
            upcomingBooking={upcomingBooking}
            stats={stats}
            recentBookings={recentBookings}
            whatsappPhone={whatsappPhone}
            studioMapsUrl={studioMapsUrl}
            onOpenBook={() => setActiveTab('book')}
            onOpenBookings={() => {
              setBookingsSection('bookings');
              setActiveTab('bookings');
            }}
            onOpenPayments={() => {
              setBookingsSection('payments');
              setActiveTab('bookings');
            }}
            handleBookingBlockClick={handleBookingBlockClick}
            downloadCalendarEvent={downloadCalendarEvent}
            bookingsLoading={bookingsLoading}
            bookingsError={bookingsError}
          />
        )}

        {activeTab === 'book' && (
          <ClientCalendarTab
            calendarSelectedDate={calendarSelectedDate}
            calendarViewMode={calendarViewMode}
            setCalendarSelectedDate={setCalendarSelectedDate}
            setCalendarViewMode={setCalendarViewMode}
            visibleDays={visibleDays}
            businessHours={businessHours}
            calendarSlotsReady={calendarSlotsReady}
            calendarSlotsLoading={calendarSlotsLoading}
            calendarSlotsError={calendarSlotsError}
            onRetryCalendarSlots={retryCalendarSlots}
            handleSlotClick={handleSlotClick}
            bookingBlocks={bookingBlocks}
            handleBookingBlockClick={handleBookingBlockClick}
            getStatusLabel={getStatusLabel}
            shiftDate={shiftDate}
            startOfDay={startOfDay}
            formatRangeLabel={formatRangeLabel}
            monthNames={monthNames}
            toIsoDate={toIsoDate}
            isSameDay={isSameDay}
            dayNames={dayNames}
          />
        )}

        {activeTab === 'bookings' && (
          <ClientBookingsHub
            bookingCount={bookingsLoading || bookingsError ? '—' : userBookings.length}
            section={bookingsSection}
            setSection={setBookingsSection}
            unreadCount={bookingsLoading || bookingsError ? null : unreadAdminMessages}
            pendingPaymentCount={paymentProofsLoading || paymentProofsError ? null : pendingPaymentProofs.length}
            bookingsContent={(
              <ClientHistoryTab
                filteredHistoryBookings={filteredHistoryBookings}
                userBookings={userBookings}
                historyQuery={historyQuery}
                setHistoryQuery={setHistoryQuery}
                historyFilter={historyFilter}
                setHistoryFilter={setHistoryFilter}
                historyFilterOptions={historyFilterOptions}
                handleBookingBlockClick={handleBookingBlockClick}
                copyText={copyText}
                bookingsLoading={bookingsLoading}
                bookingsError={bookingsError}
              />
            )}
            paymentsContent={(
              <ClientBillingTab
                stats={stats}
                unpaidBookings={unpaidBookings}
                getLatestPaymentProof={getLatestPaymentProof}
                getProofTone={getProofTone}
                openPaymentProofModal={openPaymentProofModal}
                getBookingWhatsAppUrl={getBookingWhatsAppUrl}
                studioSettings={studioSettings}
                transferAccountNumber={transferAccountNumber}
                studioPaymentTerms={studioPaymentTerms}
                copyText={copyText}
                paymentProofsLoading={paymentProofsLoading}
                paymentProofsError={paymentProofsError}
                bookingsLoading={bookingsLoading}
                bookingsError={bookingsError}
              />
            )}
          />
        )}

        {activeTab === 'account' && (
          <ClientAccountTab
            currentUser={currentUser}
            isDark={isDark}
            stats={stats}
            whatsappPhone={whatsappPhone}
            studioMapsUrl={studioMapsUrl}
            onLogout={handleLogout}
            onToggleTheme={toggleTheme}
            onOpenPayments={() => {
              setBookingsSection('payments');
              setActiveTab('bookings');
            }}
            statsUnavailable={bookingsLoading || Boolean(bookingsError)}
          />
        )}
        </div>
      </main>

      {/* Client Navigation V2 bottom bar */}
      <nav className="client-bottom-nav" aria-label="Navigasi client">
        <div>
          <button
            onClick={() => setActiveTab('home')}
            className={'client-bottom-item ' + (activeTab === 'home' ? 'is-active' : '')}
            aria-current={activeTab === 'home' ? 'page' : undefined}
          >
            <Home size={18} />
            <span>Home</span>
          </button>

          <button
            onClick={() => setActiveTab('book')}
            className={'client-bottom-item ' + (activeTab === 'book' ? 'is-active' : '')}
            aria-current={activeTab === 'book' ? 'page' : undefined}
          >
            <CalendarDays size={18} />
            <span>Book</span>
          </button>

          <button
            onClick={() => {
              setBookingsSection('bookings');
              setActiveTab('bookings');
            }}
            className={'client-bottom-item ' + (activeTab === 'bookings' ? 'is-active' : '')}
            aria-current={activeTab === 'bookings' ? 'page' : undefined}
          >
            <ClipboardList size={18} />
            <span>Bookings</span>
            {clientActionBadgeCount > 0 ? (
              <b className="client-nav-badge">
                {clientActionBadgeCount}
              </b>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={'client-bottom-item ' + (activeTab === 'account' ? 'is-active' : '')}
            aria-current={activeTab === 'account' ? 'page' : undefined}
          >
            <UserRound size={18} />
            <span>Account</span>
          </button>
        </div>
      </nav>

      {/* Unified authenticated booking wizard */ }
      {isSimulatorOpen ? (
        <ClientBookingWizard
          actualDuration={actualDuration}
          customerName={simCustomerName}
          customerPhone={simCustomerPhone}
          customDuration={simCustomDuration}
          date={simulatorDate}
          duration={simDuration}
          getSupportUrl={getBookingSupportUrl}
          isSubmitting={isSubmittingRequest}
          onClose={() => setIsSimulatorOpen(false)}
          onPackageChange={handlePackageChange}
          onSessionTypeChange={handleSessionTypeChange}
          onSubmit={submitBookingRequest}
          onViewBooking={handleCreatedBookingView}
          packageId={simPackageId}
          packageOptions={packageOptions}
          pricingBreakdown={pricingBreakdown}
          proofAmount={simProofAmount}
          proofCategory={simProofCategory}
          proofEnabled={simProofEnabled}
          proofPayerName={simProofPayerName}
          proofReference={simProofReference}
          proofMethod={simProofMethod}
          proofNote={simProofNote}
          recordingTypeId={simRecordingTypeId}
          recordingTypeOptions={recordingTypeOptions}
          sessionOptions={sessionOptions}
          sessionType={simSessionType}
          setCustomerName={setSimCustomerName}
          setCustomerPhone={setSimCustomerPhone}
          setCustomDuration={setSimCustomDuration}
          setDuration={setSimDuration}
          setProofAmount={setSimProofAmount}
          setProofCategory={setSimProofCategory}
          setProofEnabled={setSimProofEnabled}
          setProofPayerName={setSimProofPayerName}
          setProofReference={setSimProofReference}
          setProofMethod={setSimProofMethod}
          setProofNote={setSimProofNote}
          setRecordingTypeId={setSimRecordingTypeId}
          startHour={simulatorStartHour}
        />
      ) : null}

      {/* Booking Detail Modal (To view invoices, receipts, and DP breakdown) */}
      {selectedBookingDetail && (
        <div className="client-detail-modal-backdrop">
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="client-detail-modal"
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="client-detail-modal-head">
              <h3 className="client-detail-modal-title">
                <Receipt size={18} />
                <span>Detail Invoice Booking</span>
              </h3>
              <button
                aria-label="Tutup detail booking"
                className="client-detail-close-icon"
                type="button"
                onClick={() => setSelectedBookingDetail(null)}
              >
                <X size={16} />
              </button>
            </div>

            <ol aria-label="Progres status booking" className="client-detail-lifecycle-stepper">
              {getClientBookingLifecycleSteps(selectedBookingDetail).map((item) => (
                <li className={item.state} key={item.key}>
                  <span>{item.num}</span>
                  <small>{item.label}</small>
                </li>
              ))}
            </ol>

            {getBookingRequestStatusMeta(selectedBookingDetail) ? (
              <section className={'client-request-state is-' + getBookingRequestStatusMeta(selectedBookingDetail).tone}>
                <span>Status request</span>
                <strong>{getBookingRequestStatusMeta(selectedBookingDetail).label}</strong>
                {selectedBookingDetail.adminResponseNote ? <small>{selectedBookingDetail.adminResponseNote}</small> : null}
              </section>
            ) : null}

            {(() => {
              const paymentMeta = BOOKING_PAYMENT_STATUS_META[getBookingPaymentStatus(selectedBookingDetail)];
              const sessionMeta = BOOKING_SESSION_STATUS_META[getBookingSessionStatus(selectedBookingDetail)];

              return (
                <>
                  {paymentMeta ? (
                    <section className={'client-request-state is-' + paymentMeta.tone}>
                      <span>Status pembayaran</span>
                      <strong>{paymentMeta.label}</strong>
                    </section>
                  ) : null}
                  {sessionMeta ? (
                    <section className={'client-request-state is-' + sessionMeta.tone}>
                      <span>Status sesi</span>
                      <strong>{sessionMeta.label}</strong>
                    </section>
                  ) : null}
                </>
              );
            })()}

            {paymentProofsLoading || paymentProofsError ? (
              <section className="client-request-state is-attention" role={paymentProofsError ? 'alert' : 'status'}>
                <span>Status bukti pembayaran</span>
                <strong>{paymentProofsLoading ? 'Memuat status bukti…' : 'Status bukti belum dapat diperiksa'}</strong>
                {paymentProofsError ? (
                  <button type="button" onClick={retryPaymentProofs}>
                    Coba lagi
                  </button>
                ) : null}
              </section>
            ) : getLatestPaymentProof(selectedBookingDetail) ? (
              <section className={'client-payment-proof-detail ' + getProofTone(getLatestPaymentProof(selectedBookingDetail).status)}>
                <span>Status bukti pembayaran</span>
                <strong>{getPaymentProofStatusLabel(getLatestPaymentProof(selectedBookingDetail).status)}</strong>
                <small>
                  {getLatestPaymentProof(selectedBookingDetail).category === 'pelunasan' ? 'Pelunasan' : 'DP'} • {formatRupiah(getLatestPaymentProof(selectedBookingDetail).amount)}
                </small>
              </section>
            ) : null}

            <section className="client-detail-invoice" aria-label="Rincian invoice">
              <header className="client-detail-invoice-header">
                <div>
                  <h4>{studioSettings.studioName || invoiceSettings.studioName || defaultStudioSettings.studioName}</h4>
                  <p>{invoiceSettings.address || 'Alamat Studio'}</p>
                </div>
                <div>
                  <span>Invoice</span>
                  <strong>{selectedBookingDetail.invoiceNumber || 'INV-00000'}</strong>
                  <button className="client-copy-code" type="button" onClick={() => copyText(selectedBookingDetail.bookingCode || selectedBookingDetail.id, 'Kode booking disalin.')}>
                    <Copy size={11} /> Salin kode
                  </button>
                </div>
              </header>

              <div className="client-detail-invoice-meta">
                <div>
                  <span>Tanggal sesi</span>
                  <strong>{selectedBookingDetail.date}</strong>
                </div>
                <div>
                  <span>Jam studio</span>
                  <strong>
                    {String(selectedBookingDetail.startHour).padStart(2, '0')}.00 WIB ({selectedBookingDetail.durationHours} Jam)
                  </strong>
                </div>
                <div>
                  <span>Layanan</span>
                  <strong>
                    {selectedBookingDetail.sessionLabel || selectedBookingDetail.packageLabel || selectedBookingDetail.title || 'Studio Rehearsal'}
                  </strong>
                </div>
              </div>

              <div className="client-detail-invoice-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatRupiah(selectedBookingDetail.subtotal || selectedBookingDetail.total)}</strong>
                </div>
                {selectedBookingDetail.discountAmount > 0 && (
                  <div className="is-discount">
                    <span>Potongan promo</span>
                    <strong>-{formatRupiah(selectedBookingDetail.discountAmount)}</strong>
                  </div>
                )}
                <div className="is-total">
                  <span>Total harga</span>
                  <strong>{formatRupiah(selectedBookingDetail.total)}</strong>
                </div>

                <div className="client-detail-payment-balance">
                  <div>
                    <span>Uang muka (DP)</span>
                    <strong>{formatRupiah(selectedBookingDetail.dpAmount || 0)}</strong>
                  </div>
                  <div>
                    <span>Sisa tagihan</span>
                    <strong className={getBookingStatus(selectedBookingDetail) === 'lunas' ? 'is-paid' : 'is-open'}>
                      {getBookingPaymentStatus(selectedBookingDetail) === 'paid'
                        ? 'Lunas'
                        : formatRupiah(Math.max(0, (selectedBookingDetail.total || 0) - (selectedBookingDetail.dpAmount || 0)))}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            {selectedBookingDetail.clientUid ? (
              <BookingConversationPanel
                key={`${currentUser.uid}:${selectedBookingDetail.id}`}
                booking={selectedBookingDetail}
                role="client"
                user={currentUser}
              />
            ) : null}

            <div className="client-detail-utilities">
              <button type="button" onClick={() => downloadCalendarEvent(selectedBookingDetail)}><CalendarPlus size={13} />Kalender</button>
              <a href={getBookingSupportUrl(selectedBookingDetail)} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} />Bantuan booking</a>
              {['submitted', 'confirmed'].includes(getBookingRequestStatus(selectedBookingDetail)) ? (
                <button className="is-danger" type="button" onClick={() => requestCancellation(selectedBookingDetail)}>Minta batal</button>
              ) : null}
            </div>

            {!paymentProofsLoading && !paymentProofsError && isBookingPaymentOpen(selectedBookingDetail) ? (
              <section aria-label="Rekening transfer studio" className="client-detail-bank-box">
                <div>
                  <span>
                    <Landmark size={14} aria-hidden="true" />
                    {' '}
                    {studioSettings.bankName || defaultStudioSettings.bankName}
                  </span>
                  <strong>{formatBankAccountNumber(transferAccountNumber)}</strong>
                  <small>a.n. {studioSettings.bankAccountHolder || defaultStudioSettings.bankAccountHolder}</small>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(transferAccountNumber, 'Nomor rekening disalin.')}
                >
                  <Copy size={13} /> Salin Rekening
                </button>
              </section>
            ) : null}

            <div className="client-detail-modal-actions">
              <button
                type="button"
                onClick={() => setSelectedBookingDetail(null)}
                className="is-secondary"
              >
                Tutup
              </button>

              {!paymentProofsLoading && !paymentProofsError && isBookingPaymentOpen(selectedBookingDetail) && (
                <button
                  type="button"
                  onClick={() => {
                    openPaymentProofModal(selectedBookingDetail);
                    setSelectedBookingDetail(null);
                  }}
                  className="is-primary"
                >
                  <CreditCard size={14} />
                  <span>Kirim Referensi</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {selectedProofBooking ? (
        <div className="client-proof-modal-backdrop" role="presentation">
          <section className="client-proof-modal" role="dialog" aria-modal="true" aria-label="Kirim referensi pembayaran">
            <header>
              <span><CreditCard size={16} />Referensi Pembayaran</span>
              <button aria-label="Tutup referensi pembayaran" type="button" onClick={closePaymentProofModal}>
                <X size={17} />
              </button>
            </header>

            <div className="client-proof-modal-booking">
              <CreditCard size={16} />
              <span>
                <strong>{selectedProofBooking.sessionLabel || selectedProofBooking.packageLabel || selectedProofBooking.title || 'Sesi Studio'}</strong>
                <small>{selectedProofBooking.date} • {String(selectedProofBooking.startHour).padStart(2, '0')}.00 WIB</small>
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

              <label className="client-proof-reference-field">
                <span>No. referensi / kode transaksi</span>
                <input
                  autoComplete="off"
                  maxLength={120}
                  placeholder="Masukkan nomor referensi dari bank atau QRIS"
                  required
                  value={proofReference}
                  onChange={(event) => setProofReference(event.target.value)}
                />
              </label>
              <label className="client-proof-payer-field">
                <span>Nama pemilik rekening / pengirim</span>
                <input
                  autoComplete="name"
                  maxLength={120}
                  placeholder="Nama sesuai rekening pengirim"
                  value={proofPayerName}
                  onChange={(event) => setProofPayerName(event.target.value)}
                />
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
              <button
                type="button"
                onClick={submitStandalonePaymentProof}
                disabled={isSubmittingProof || proofReference.trim().length < 4 || paymentProofsLoading || Boolean(paymentProofsError)}
              >
                {isSubmittingProof ? 'Mengirim...' : paymentProofsLoading ? 'Memuat status...' : paymentProofsError ? 'Status belum tersedia' : 'Kirim Referensi'}
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

      {currentUser ? (
        <Suspense fallback={null}>
          <RoleAiAssistant
            context={clientAiContext}
            role="client"
            surface={activeTab}
            user={currentUser}
          />
        </Suspense>
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
