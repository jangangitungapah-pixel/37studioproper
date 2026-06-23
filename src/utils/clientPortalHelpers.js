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
        <span>{startLabel} â€¢ {durationLabel}</span>
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
        if (result.success) {
          setAuthState({ isReady: true, isAuthenticated: true, user: result.user });
        } else {
          setAuthState({ isReady: true, isAuthenticated: false, user: null });
        }
      } catch (err) {
        if (currentSequence !== checkSequence) return;
        setAuthState({ isReady: true, isAuthenticated: false, user: null });
      } finally {
        if (currentSequence === checkSequence) {
          setAuthLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [firebaseAuth, navigate]);

  return { authState, authLoading };
}
