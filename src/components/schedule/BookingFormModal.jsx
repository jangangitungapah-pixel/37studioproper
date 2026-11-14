import { useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/modules/booking.css';
import {
  Dialog,
} from 'radix-ui';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  Phone,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import StudioSelect from '../ui/StudioSelect.jsx';
import StudioTextField from '../ui/StudioTextField.jsx';
import {
  businessHours,
  durationOptions,
  paymentStatusOptions,
} from '../../constants/scheduleConfig.js';
import {
  formatRupiah,
  getPackageOptions,
  usePricingSettings,
  getRecordingTypeOptions,
  getSessionOptions,
  isRecordingSessionId,
  resolveBookingPricing,
} from '../../settings/pricingSettings.js';

const initialForm = {
  name: '',
  bandName: '',
  phone: '',
  packageId: 'none',
  sessionType: 'rehearsal',
  recordingTypeId: 'none',
  date: '',
  startHour: '10',
  duration: '1',
  customDuration: '',
  paymentStatus: 'pending',
  paymentMethod: 'cash',
  dpAmount: '',
};

const paymentMethodOptions = [
  { key: 'cash', label: 'Cash', description: 'Pembayaran tunai' },
  { key: 'transfer', label: 'Transfer', description: 'Transfer bank' },
  { key: 'qris', label: 'QRIS', description: 'QRIS / e-wallet' },
  { key: 'other', label: 'Lainnya', description: 'Metode lain' },
];

function makeBookingId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

function formatBookingModalDate(
  value,
) {
  const raw =
    String(
      value ||
        '',
    ).trim();

  if (
    !raw
  ) {
    return 'Tanggal belum dipilih';
  }

  const date =
    new Date(
      raw +
        'T00:00:00',
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return raw;
  }

  return date.toLocaleDateString(
    'id-ID',
    {
      day:
        'numeric',

      month:
        'short',

      weekday:
        'short',
    },
  );
}

function formatHourClock(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) return '-';

  const totalMinutes = Math.max(0, Math.round(numeric * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return String(hours).padStart(2, '0') + '.' + String(minutes).padStart(2, '0');
}

function getDurationFormValue(durationHours) {
  const normalizedDuration = String(Number(durationHours) || 1);
  const durationOption = durationOptions.find((option) => String(option.key) === normalizedDuration);

  return durationOption ? durationOption.key : 'custom';
}

function createInitialForm(initialSlot, editingBooking) {
  if (editingBooking) {
    const durationValue = getDurationFormValue(editingBooking.durationHours);
    const isPackageBooking = editingBooking.packageId && editingBooking.packageId !== 'none';

    return {
      ...initialForm,
      name: editingBooking.customer || '',
      bandName: editingBooking.bandName || '',
      phone: editingBooking.phone || '',
      packageId: editingBooking.packageId || 'none',
      sessionType: isPackageBooking ? initialForm.sessionType : editingBooking.sessionType || initialForm.sessionType,
      recordingTypeId: editingBooking.recordingTypeId || 'none',
      date: editingBooking.date || getTodayIsoDate(),
      startHour: String(editingBooking.startHour ?? '10'),
      duration: durationValue,
      customDuration: durationValue === 'custom' ? String(editingBooking.durationHours || '') : '',
      paymentStatus: editingBooking.paymentStatus || editingBooking.status || 'pending',
      paymentMethod: editingBooking.lastPaymentMethod || editingBooking.paymentMethod || editingBooking.paymentHistory?.[0]?.method || 'cash',
      dpAmount: editingBooking.dpAmount ? String(editingBooking.dpAmount) : '',
    };
  }

  return {
    ...initialForm,
    date: initialSlot?.date || getTodayIsoDate(),
    startHour: initialSlot?.startHour || '10',
  };
}

function getSelectedOption(options, key) {
  return options.find((option) => option.key === key) || options[0];
}

function parseRupiahInput(value) {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  if (/^\d+$/.test(raw)) {
    return Number(raw) || 0;
  }

  const digitsOnly = raw.replace(/\D/g, '');

  return Number(digitsOnly) || 0;
}

function normalizeMoneyInputValue(value) {
  const digitsOnly = String(value ?? '').replace(/\D/g, '');

  return digitsOnly.replace(/^0+(?=\d)/, '');
}

function getDurationHours(form) {
  if (form.duration === 'custom') {
    return Math.max(0, Number(form.customDuration) || 0);
  }

  return Math.max(0, Number(form.duration) || 0);
}

function makePaymentRecordId() {
  return 'pay_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 7);
}

function getExistingPaymentHistory(editingBooking) {
  return Array.isArray(editingBooking?.paymentHistory) ? editingBooking.paymentHistory : [];
}

function getInitialPaidAmount(paymentStatus, totals, requestedDpAmount = 0) {
  const safeTotal = Number(totals.total) || 0;
  const safeRequestedDp = Number(requestedDpAmount) || 0;

  if (paymentStatus === 'lunas') return safeTotal;

  if (paymentStatus === 'dp') {
    return Math.min(safeTotal || safeRequestedDp, safeRequestedDp);
  }

  return 0;
}

function isInitialBookingPayment(payment) {
  const source = String(payment?.source || '');
  const id = String(payment?.id || '');

  return source === 'booking-form' || source === 'legacy-booking-payment' || id === 'legacy-payment';
}

function buildInitialPaymentHistory({ bookingId, editingBooking, form, now, requestedDpAmount, totals }) {
  const existingPaymentHistory = getExistingPaymentHistory(editingBooking);
  const preservedPayments = existingPaymentHistory.filter((payment) => !isInitialBookingPayment(payment));
  const initialPaidAmount = getInitialPaidAmount(form.paymentStatus, totals, requestedDpAmount);

  if (!initialPaidAmount) return preservedPayments;

  const previousInitialPayment = existingPaymentHistory.find(isInitialBookingPayment);

  return [
    {
      amount: initialPaidAmount,
      createdAt: previousInitialPayment?.createdAt || now,
      date: previousInitialPayment?.date || getTodayIsoDate(),
      id: previousInitialPayment?.id || makePaymentRecordId(),
      method: form.paymentMethod || previousInitialPayment?.method || 'cash',
      note: form.paymentStatus === 'lunas' ? 'Pembayaran awal dari booking form' : 'DP awal dari booking form',
      source: 'booking-form',
      bookingId,
    },
    ...preservedPayments,
  ];
}

export default function BookingFormModal({
  checkSlotConflict = null,
  editingBooking,
  initialSlot,
  isOpen,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() => createInitialForm(initialSlot, editingBooking));
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [activeStepKey, setActiveStepKey] = useState('customer');
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const panelRef = useRef(null);
  const selectPortalRef = useRef(null);
  const bookingFormLayoutRef = useRef(null);
  const submissionIdentityRef = useRef(null);


  const pricingSettings = usePricingSettings();
  const sessionTypeOptions = useMemo(() => getSessionOptions(pricingSettings), [pricingSettings]);
  const recordingTypeOptions = useMemo(() => getRecordingTypeOptions(pricingSettings), [pricingSettings]);
  const packageOptions = useMemo(
    () => [
      { key: 'none', label: 'Tanpa Paket', description: 'Booking reguler' },
      ...getPackageOptions(pricingSettings),
    ],
    [pricingSettings]
  );

  const isPackageSelected = form.packageId !== 'none';
  const isRecordingSessionSelected = !isPackageSelected && isRecordingSessionId(form.sessionType);
  const activeRecordingTypeKey =
    form.recordingTypeId !== 'none'
      ? form.recordingTypeId
      : recordingTypeOptions[0]?.key || 'none';
  const shouldShowRecordingType =
    isRecordingSessionSelected &&
    recordingTypeOptions.length > 0;

  useEffect(() => {
    if (!isOpen) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      setForm(createInitialForm(initialSlot, editingBooking));
      setFieldErrors({});
      setActiveStepKey('customer');
      setIsSummaryExpanded(false);
      setError(
        editingBooking?.initialPaymentLedgerStatus === 'pending' && editingBooking?.initialPaymentIntent
          ? 'Pembayaran awal booking ini masih menunggu pencatatan ledger. Klik Simpan untuk memulihkan payment history dan ledger secara aman.'
          : ''
      );
      setIsSaving(false);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [editingBooking, initialSlot, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined;

    const viewport = window.visualViewport;
    let frameId = 0;

    function syncVisualViewportHeight() {
      const panelElement = panelRef.current;
      if (!panelElement) return;

      if (window.innerWidth >= 768) {
        panelElement.style.removeProperty('--booking-modal-vvh');
        return;
      }

      const nextHeight = viewport?.height || window.innerHeight || 0;
      if (nextHeight > 0) {
        panelElement.style.setProperty('--booking-modal-vvh', Math.round(nextHeight) + 'px');
      }
    }

    function scheduleSync() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(syncVisualViewportHeight);
    }

    const panelAtMount = panelRef.current;

    scheduleSync();
    viewport?.addEventListener('resize', scheduleSync);
    window.addEventListener('resize', scheduleSync);

    return () => {
      window.cancelAnimationFrame(frameId);
      viewport?.removeEventListener('resize', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      panelAtMount?.style.removeProperty('--booking-modal-vvh');
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const layoutElement = bookingFormLayoutRef.current;
    if (!layoutElement) return undefined;

    let frameId = 0;

    function syncActiveStepFromScroll() {
      const container = bookingFormLayoutRef.current;
      if (!container) return;

      const sections = Array.from(container.querySelectorAll('[data-booking-step]'));
      if (!sections.length) return;

      const containerRect = container.getBoundingClientRect();
      const pivotTop = containerRect.top + 88;
      let nextStep = sections[0].getAttribute('data-booking-step') || 'customer';

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= pivotTop && rect.bottom > containerRect.top + 36) {
          nextStep = section.getAttribute('data-booking-step') || nextStep;
        }
      }

      const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 18;
      if (nearBottom) {
        nextStep = sections[sections.length - 1].getAttribute('data-booking-step') || nextStep;
      }

      setActiveStepKey((current) => (current === nextStep ? current : nextStep));
    }

    function handleLayoutScroll() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(syncActiveStepFromScroll);
    }

    layoutElement.addEventListener('scroll', handleLayoutScroll, { passive: true });
    frameId = window.requestAnimationFrame(syncActiveStepFromScroll);

    return () => {
      window.cancelAnimationFrame(frameId);
      layoutElement.removeEventListener('scroll', handleLayoutScroll);
    };
  }, [isOpen]);

  const totals = useMemo(
    () =>
      resolveBookingPricing({
        customDurationHours: form.customDuration,
        durationHours: getDurationHours(form),
        packageId: form.packageId,
        paymentStatus: form.paymentStatus,
        dpAmount: parseRupiahInput(form.dpAmount),
        pricingSettings,
        recordingTypeId: shouldShowRecordingType ? activeRecordingTypeKey : 'none',
        sessionId: form.sessionType,
      }),
    [activeRecordingTypeKey, form, pricingSettings, shouldShowRecordingType]
  );

  const isNoDurationPackageSelected = isPackageSelected && Number(totals.durationHours || 0) <= 0;

  const slotConflictIssue = useMemo(() => {
    if (typeof checkSlotConflict !== 'function' || isNoDurationPackageSelected) {
      return null;
    }

    return checkSlotConflict({
      id: editingBooking?.id || '',
      date: form.date,
      startHour: Number(form.startHour),
      durationHours: totals.durationHours,
      packageId: form.packageId,
      pricingMode: totals.mode,
    });
  }, [checkSlotConflict, editingBooking?.id, form.date, form.packageId, form.startHour, isNoDurationPackageSelected, totals.durationHours, totals.mode]);

  const dpPresetAmounts = useMemo(() => {
    const total = Number(totals.total) || 0;
    if (total <= 0) return [];

    const candidates = [
      { key: 'dp-50k', label: 'Rp 50rb', amount: 50000 },
      { key: 'dp-half', label: '50%', amount: Math.round((total * 0.5) / 1000) * 1000 },
      { key: 'dp-100k', label: 'Rp 100rb', amount: 100000 },
    ].filter((preset, index, list) => (
      preset.amount > 0 &&
      preset.amount < total &&
      list.findIndex((item) => item.amount === preset.amount) === index
    ));

    return candidates;
  }, [totals.total]);

  if (!isOpen) return null;

  function clearValidationFor(fields) {
    setFieldErrors((current) => {
      if (!fields.some((key) => Boolean(current[key]))) return current;
      const next = { ...current };
      for (const key of fields) delete next[key];
      return next;
    });
  }

  function updateField(field) {
    return (event) => {
      const nextValue = field === 'dpAmount'
        ? normalizeMoneyInputValue(event.target.value)
        : event.target.value;

      setForm((current) => ({
        ...current,
        [field]: nextValue,
      }));

      clearValidationFor([field]);
      if (error) setError('');
    };
  }

  function updateValue(field) {
    return (nextValue) => {
      setForm((current) => {
        const next = {
          ...current,
          [field]: nextValue,
        };

        if (field === 'packageId') {
          if (nextValue !== 'none') {
            next.customDuration = '';
            next.recordingTypeId = 'none';
          } else {
            next.sessionType = sessionTypeOptions[0]?.key || 'rehearsal';
            next.duration = '1';
            next.recordingTypeId = 'none';
          }
        }

        if (field === 'sessionType') {
          next.recordingTypeId = isRecordingSessionId(nextValue) ? recordingTypeOptions[0]?.key || 'none' : 'none';
        }

        if (field === 'paymentStatus' && nextValue !== 'dp') {
          next.dpAmount = '';
        }

        if (field === 'duration' && nextValue !== 'custom') {
          next.customDuration = '';
        }

        return next;
      });

      clearValidationFor([field, 'customDuration', 'dpAmount', 'recordingTypeId']);
      if (error) setError('');
    };
  }

  function selectDpPreset(amount) {
    setForm((current) => ({
      ...current,
      dpAmount: String(amount),
    }));
    clearValidationFor(['dpAmount']);
    if (error) setError('');
  }

  function handleFormFocusCapture(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const sectionElement = target.closest('[data-booking-step]');
    const stepKey = sectionElement?.getAttribute('data-booking-step');
    if (stepKey) {
      setActiveStepKey((current) => (current === stepKey ? current : stepKey));
    }

    if (typeof window !== 'undefined' && window.innerWidth < 768 && target.tagName === 'INPUT') {
      const fieldContainer = target.closest('.studio-field') || target;
      const shouldReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(() => {
        fieldContainer.scrollIntoView?.({
          behavior: shouldReduceMotion ? 'auto' : 'smooth',
          block: 'center',
        });
      }, 120);
    }
  }

  function focusInvalidField(stepKey, fieldId, nextErrors, message) {
    setFieldErrors(nextErrors);
    setError(message);
    navigateToBookingStep(stepKey);

    if (fieldId && typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById(fieldId)?.focus({ preventScroll: true });
      }, 140);
    }
  }

  function requestClose() {
    if (!editingBooking && submissionIdentityRef.current?.pendingLedgerRecovery) {
      setError('Pencatatan pembayaran awal belum selesai. Selesaikan retry Simpan terlebih dahulu atau buka kembali booking pending dari Jadwal untuk memulihkan ledger.');
      return;
    }
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSaving) return;

    const cleanName = form.name.trim();
    const cleanPhone = form.phone.trim();
    const cleanBandName = form.bandName.trim();
    const requestedDpAmount = parseRupiahInput(form.dpAmount);

    if (!cleanName || !cleanPhone || !form.date || !form.startHour) {
      const nextErrors = {};
      if (!cleanName) nextErrors.name = 'Nama customer wajib diisi.';
      if (!cleanPhone) nextErrors.phone = 'No HP / WhatsApp wajib diisi.';
      if (!form.date) nextErrors.date = 'Tanggal booking wajib dipilih.';

      const firstStep = !cleanName || !cleanPhone ? 'customer' : 'slot';
      const firstId = !cleanName
        ? 'booking-name'
        : !cleanPhone
          ? 'booking-phone'
          : 'booking-date';

      focusInvalidField(firstStep, firstId, nextErrors, 'Nama, No HP, tanggal, dan jam wajib diisi.');
      return;
    }

    if (isRecordingSessionSelected && !recordingTypeOptions.length) {
      focusInvalidField(
        'service',
        null,
        { recordingTypeId: 'Tambahkan harga Recording Type di Settings terlebih dahulu.' },
        'Recording Type belum tersedia. Tambahkan harga Recording Type di Settings terlebih dahulu.'
      );
      return;
    }

    if (isRecordingSessionSelected && activeRecordingTypeKey === 'none') {
      focusInvalidField(
        'service',
        null,
        { recordingTypeId: 'Pilih Tipe Recording terlebih dahulu.' },
        'Pilih Tipe Recording terlebih dahulu.'
      );
      return;
    }

    if (!isNoDurationPackageSelected && !totals.durationHours) {
      focusInvalidField(
        'slot',
        form.duration === 'custom' ? 'booking-custom-duration' : null,
        form.duration === 'custom' ? { customDuration: 'Isi durasi lebih dari 0 jam.' } : {},
        'Durasi booking harus lebih dari 0 jam.'
      );
      return;
    }

    if (slotConflictIssue) {
      focusInvalidField('slot', 'booking-date', {}, slotConflictIssue.message);
      return;
    }

    if (form.paymentStatus === 'dp' && !requestedDpAmount) {
      focusInvalidField(
        'payment',
        'booking-dp-amount',
        { dpAmount: 'Nominal DP wajib diisi jika status pembayaran DP.' },
        'Nominal DP wajib diisi jika status pembayaran DP.'
      );
      return;
    }

    setFieldErrors({});

    const startHourNumber = Number(form.startHour);
    const hourOption = getSelectedOption(businessHours, form.startHour);
    const sessionLabel = totals.packageItem?.label || totals.recordingType?.label || totals.session?.label || 'Session';
    const submissionFingerprint = JSON.stringify({
      form,
      editingBookingId: editingBooking?.id || '',
      requestedDpAmount,
      total: totals.total,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      durationHours: totals.durationHours,
      pricingMode: totals.mode,
      sessionLabel,
      recordingTypeId: totals.recordingType?.key || '',
      appliedDiscounts: totals.appliedDiscounts,
    });
    const previousSubmission = submissionIdentityRef.current;
    if (previousSubmission?.pendingLedgerRecovery &&
        previousSubmission.fingerprint !== submissionFingerprint) {
      setError('Booking sudah tersimpan, tetapi ledger pembayaran awal masih perlu diselesaikan. Klik Simpan kembali tanpa mengubah isi formulir terlebih dahulu. Setelah berhasil, buka ulang form untuk mengubah booking.');
      return;
    }
    if (!previousSubmission || previousSubmission.fingerprint !== submissionFingerprint) {
      submissionIdentityRef.current = {
        fingerprint: submissionFingerprint,
        id: editingBooking?.id || makeBookingId(),
        createdAt: new Date().toISOString(),
        pendingLedgerRecovery: false,
      };
    }
    const submissionIdentity = submissionIdentityRef.current;
    const bookingId = submissionIdentity.id;
    const now = submissionIdentity.createdAt;
    const paymentHistory = buildInitialPaymentHistory({
      bookingId,
      editingBooking,
      form,
      now,
      requestedDpAmount,
      totals,
    });
    const paidAmount = paymentHistory.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const invoiceAmount = Math.max(0, Number(totals.total || 0) - paidAmount);
    const resolvedPaymentStatus =
      invoiceAmount <= 0 && Number(totals.total || 0) > 0
        ? 'lunas'
        : paidAmount > 0
          ? 'dp'
          : form.paymentStatus;
    const lastPayment = paymentHistory[paymentHistory.length - 1];

    let didSave;

    setIsSaving(true);

    try {
      didSave = await onSave({
      id: bookingId,
      customer: cleanName,
      bandName: cleanBandName,
      phone: cleanPhone,
      packageId: form.packageId,
      packageLabel: totals.packageItem?.label || '',
      pricingMode: totals.mode,
      sessionType: totals.packageItem ? 'package' : form.sessionType,
      sessionLabel,
      recordingTypeId: totals.recordingType?.key || '',
      recordingTypeLabel: totals.recordingType?.label || '',
      title: cleanBandName || sessionLabel,
      date: form.date,
      startHour: startHourNumber,
      startTimeLabel: hourOption.shortLabel || hourOption.label,
      durationHours: totals.durationHours,
      paymentMethod: form.paymentStatus === 'pending' ? '' : form.paymentMethod,
      paymentHistory,
      paidAmount,
      lastPaymentAt: lastPayment?.createdAt || editingBooking?.lastPaymentAt || '',
      lastPaymentMethod: lastPayment?.method || editingBooking?.lastPaymentMethod || '',
      paymentStatus: resolvedPaymentStatus,
      status: resolvedPaymentStatus,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      appliedDiscounts: totals.appliedDiscounts,
      total: totals.total,
      dpAmount: resolvedPaymentStatus === 'dp' ? paidAmount : 0,
      invoiceAmount,
      createdAt: editingBooking?.createdAt || now,
      updatedAt: editingBooking ? now : '',
      expectedUpdatedAt: editingBooking?.updatedAt || '',
      });
    } catch (saveError) {
      console.error(
        'Booking form save failed:',
        saveError
      );

      if (saveError?.code === 'booking_payment_ledger_pending') {
        submissionIdentityRef.current = {
          ...submissionIdentity,
          pendingLedgerRecovery: true,
        };
        setError(saveError.message);
      } else {
        setError(
          'Booking belum berhasil disimpan. Coba kembali.'
        );
      }

      return;
    } finally {
      setIsSaving(false);
    }

    if (didSave === false) {
      setError(
        slotConflictIssue?.message ||
          'Jadwal bentrok atau booking belum bisa disimpan. Periksa slot dan coba kembali.'
      );
      return;
    }

    submissionIdentityRef.current = null;
    onClose();
  }

  const selectedHourOption =
    getSelectedOption(
      businessHours,
      form.startHour,
    );

  const selectedPaymentStatus =
    getSelectedOption(
      paymentStatusOptions,
      form.paymentStatus,
    );

  const activeServiceLabel =
    totals.packageItem?.label ||
    totals.recordingType?.label ||
    totals.session?.label ||
    'Layanan belum dipilih';

  const activeDateLabel =
    formatBookingModalDate(
      form.date,
    );

  const activeTimeLabel =
    selectedHourOption?.shortLabel ||
    selectedHourOption?.label ||
    '-';

  const activeDurationLabel =
    isNoDurationPackageSelected
      ? 'Tanpa blok kalender'
      : (
          Number(
            totals.durationHours,
          ) ||
          0
        ) +
        ' jam';

  const slotStartHour = Number(form.startHour);
  const slotEndHour = slotStartHour + (Number(totals.durationHours) || 0);
  const slotTimeRangeLabel = isNoDurationPackageSelected
    ? 'Tanpa blok kalender'
    : Number.isFinite(slotStartHour) && Number(totals.durationHours) > 0
      ? formatHourClock(slotStartHour) + '–' + formatHourClock(slotEndHour) + ' WIB'
      : activeTimeLabel;

  const paymentStatusLabel =
    selectedPaymentStatus?.label ||
    form.paymentStatus;

  const customerStepComplete =
    Boolean(
      form.name.trim() &&
      form.phone.trim(),
    );

  const serviceStepComplete =
    Boolean(
      isPackageSelected ||
      (
        form.sessionType &&
        (
          !isRecordingSessionSelected ||
          (
            recordingTypeOptions.length > 0 &&
            activeRecordingTypeKey !== 'none'
          )
        )
      ),
    );

  const slotStepComplete =
    Boolean(
      form.date &&
      form.startHour &&
      !slotConflictIssue &&
      (
        isNoDurationPackageSelected ||
        Number(
          totals.durationHours,
        ) > 0
      ),
    );

  const paymentStepComplete =
    Boolean(
      form.paymentStatus === 'pending' ||
      form.paymentStatus === 'lunas' ||
      (
        form.paymentStatus === 'dp' &&
        parseRupiahInput(
          form.dpAmount,
        ) > 0
      ),
    );

  const bookingStepStates = [
    customerStepComplete,
    serviceStepComplete,
    slotStepComplete,
    paymentStepComplete,
  ];

  const hasCustomerError = Boolean(fieldErrors.name || fieldErrors.phone);
  const hasServiceError = Boolean(fieldErrors.recordingTypeId);
  const hasSlotError = Boolean(fieldErrors.date || fieldErrors.customDuration || slotConflictIssue);
  const hasPaymentError = Boolean(fieldErrors.dpAmount);

  const bookingStepItems = [
    {
      complete: bookingStepStates[0],
      hasError: hasCustomerError,
      key: 'customer',
      label: 'Customer',
    },
    {
      complete: bookingStepStates[1],
      hasError: hasServiceError,
      key: 'service',
      label: 'Layanan',
    },
    {
      complete: bookingStepStates[2],
      hasError: hasSlotError,
      key: 'slot',
      label: 'Slot',
    },
    {
      complete: bookingStepStates[3],
      hasError: hasPaymentError,
      key: 'payment',
      label: 'Bayar',
    },
  ];

  const nextBookingStepKey =
    bookingStepItems.find((
      item,
    ) => !item.complete)?.key ||
    '';

  const completedStepCount =
    bookingStepStates.filter(
      Boolean,
    ).length;

  const incompleteStepCount =
    bookingStepStates.length -
    completedStepCount;

  const isBookingReady =
    completedStepCount ===
    bookingStepStates.length;

  const nextIncompleteItem =
    bookingStepItems.find((item) => !item.complete) || null;

  const bookingReadinessLabel =
    slotConflictIssue
      ? 'Jadwal bentrok, cek slot'
      : isBookingReady
        ? 'Siap disimpan'
        : incompleteStepCount === 1 && nextIncompleteItem
          ? 'Lengkapi ' + nextIncompleteItem.label
          : incompleteStepCount + ' langkah perlu dilengkapi';

  function navigateToBookingStep(stepKey) {
    setActiveStepKey(stepKey);

    const target =
      bookingFormLayoutRef.current?.querySelector(
        '[data-booking-step="' +
          stepKey +
          '"]',
      );

    if (!target) return;

    const shouldReduceMotion =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

    target.scrollIntoView({
      behavior: shouldReduceMotion
        ? 'auto'
        : 'smooth',
      block: 'start',
    });

    window.requestAnimationFrame(() => {
      target
        .querySelector(
          'input, button:not([disabled])',
        )
        ?.focus({
          preventScroll: true,
        });
    });
  }

  return (
    <Dialog.Root
      modal={true}
      open={isOpen}
      onOpenChange={(
        nextOpen,
      ) => {
        if (
          !nextOpen
        ) {
          requestClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="booking-modal-backdrop"
        />

        <Dialog.Content
          className="booking-modal-panel"
          data-booking-modal-ui="ui-3c-mobile-first"
          ref={panelRef}
          onEscapeKeyDown={(event) => {
            if (selectPortalRef.current?.querySelector('.studio-select-list, .studio-select-sheet-layer')) {
              event.preventDefault();
            }
          }}
        >
          <header className="booking-modal-head">
            <div className="booking-modal-heading">
              <span className="booking-modal-kicker">
                {editingBooking
                  ? 'Perbarui booking kalender'
                  : 'Booking kalender baru'}
              </span>

              <Dialog.Title
                asChild
              >
                <h2 id="booking-form-title">
                  {editingBooking
                    ? 'Edit Booking'
                    : 'Tambah Booking'}
                </h2>
              </Dialog.Title>

              <Dialog.Description
                asChild
              >
                <p className="booking-modal-description">
                  Lengkapi data inti dalam empat langkah.
                  Ringkasan dan tagihan diperbarui otomatis.
                </p>
              </Dialog.Description>

              <div
                aria-label={
                  'Progress booking ' +
                  completedStepCount +
                  ' dari 4 langkah'
                }
                className="booking-modal-progress"
              >
                <div className="booking-modal-progress-copy">
                  <span>Progres form</span>
                  <strong>
                    {completedStepCount}/4 siap
                  </strong>
                </div>

                <div
                  aria-hidden="true"
                  className="booking-modal-progress-track"
                >
                  {bookingStepStates.map((
                    isComplete,
                    index,
                  ) => (
                    <span
                      className={
                        isComplete
                          ? 'is-complete'
                          : ''
                      }
                      key={'booking-step-' + index}
                    />
                  ))}
                </div>
              </div>
            </div>

            <Dialog.Close
              asChild
            >
              <button
                aria-label="Tutup form booking"
                className="booking-modal-close"
                type="button"
              >
                <X
                  aria-hidden="true"
                  size={18}
                  strokeWidth={2}
                />
              </button>
            </Dialog.Close>
          </header>

          <nav
            aria-label="Langkah Booking"
            className="booking-step-rail"
          >
            {bookingStepItems.map((
              item,
              index,
            ) => (
              <button
                aria-current={
                  item.key === activeStepKey
                    ? 'step'
                    : undefined
                }
                aria-label={
                  'Buka langkah ' +
                  (index + 1) +
                  ': ' +
                  item.label
                }
                className={[
                  'booking-step-jump',
                  item.complete
                    ? 'is-complete'
                    : '',
                  item.key === activeStepKey
                    ? 'is-viewing'
                    : '',
                  item.key === nextBookingStepKey
                    ? 'is-next'
                    : '',
                  item.hasError
                    ? 'has-error'
                    : '',
                ].filter(Boolean).join(' ')}
                key={item.key}
                type="button"
                onClick={() => {
                  navigateToBookingStep(
                    item.key,
                  );
                }}
              >
                <span aria-hidden="true">
                  {item.hasError ? (
                    '!'
                  ) : item.complete ? (
                    <Check
                      size={12}
                      strokeWidth={2.6}
                    />
                  ) : (
                    String(
                      index + 1,
                    ).padStart(
                      2,
                      '0',
                    )
                  )}
                </span>

                <strong>
                  {item.label}
                </strong>
              </button>
            ))}
          </nav>

          <form
            aria-busy={
              isSaving
            }
            className="booking-form"
            noValidate
            onSubmit={
              handleSubmit
            }
          >
            <div
              className="booking-form-layout"
              ref={bookingFormLayoutRef}
              onFocusCapture={handleFormFocusCapture}
            >
              <aside
                aria-label="Ringkasan booking"
                className="booking-form-summary"
                data-expanded={isSummaryExpanded ? 'true' : 'false'}
              >
                <div className="booking-summary-overview">
                  <section
                    className={[
                      'booking-summary-readiness',
                      isBookingReady ? 'is-ready' : '',
                      slotConflictIssue ? 'has-conflict' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="booking-summary-readiness-icon">
                      {slotConflictIssue ? (
                        <AlertTriangle
                          size={14}
                          strokeWidth={2.3}
                        />
                      ) : isBookingReady ? (
                        <Check
                          size={15}
                          strokeWidth={2.6}
                        />
                      ) : (
                        completedStepCount
                      )}
                    </span>

                    <div>
                      <small>Kesiapan booking</small>
                      <strong>
                        {bookingReadinessLabel}
                      </strong>
                    </div>

                    <em>
                      {completedStepCount}/4
                    </em>
                  </section>

                  <section className="booking-summary-hero">
                    <span>
                      Estimasi tagihan
                    </span>

                    <strong>
                      {formatRupiah(
                        totals.invoiceAmount,
                      )}
                    </strong>

                    <small>
                      {totals.invoiceAmount === 0 && Number(totals.total) > 0
                        ? 'sudah lunas'
                        : totals.dpAmount > 0
                          ? 'sisa setelah DP'
                          : 'tagihan tersisa'}
                    </small>
                  </section>
                </div>

                <button
                  aria-expanded={isSummaryExpanded}
                  className="booking-summary-toggle"
                  type="button"
                  onClick={() => setIsSummaryExpanded((current) => !current)}
                >
                  <span className="booking-summary-toggle-copy">
                    <strong>{activeServiceLabel}</strong>
                    <span>{activeDateLabel} · {slotTimeRangeLabel}</span>
                  </span>
                  <span className="booking-summary-toggle-pill">
                    <span>{isSummaryExpanded ? 'Tutup' : 'Rincian'}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={isSummaryExpanded ? 'is-open' : ''}
                      size={15}
                    />
                  </span>
                </button>

                <section className="booking-summary-slot">
                  <header>
                    <span>
                      Slot preview
                    </span>

                    <strong>
                      {activeServiceLabel}
                    </strong>
                  </header>

                  <div>
                    <span>
                      <CalendarDays
                        aria-hidden="true"
                        size={15}
                      />

                      <small>
                        Tanggal
                      </small>
                    </span>

                    <strong>
                      {activeDateLabel}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <Clock3
                        aria-hidden="true"
                        size={15}
                      />

                      <small>
                        Jam
                      </small>
                    </span>

                    <strong>
                      {slotTimeRangeLabel}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <Clock3
                        aria-hidden="true"
                        size={15}
                      />

                      <small>
                        Durasi
                      </small>
                    </span>

                    <strong>
                      {activeDurationLabel}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <CreditCard
                        aria-hidden="true"
                        size={15}
                      />

                      <small>
                        Status
                      </small>
                    </span>

                    <strong>
                      {paymentStatusLabel}
                    </strong>
                  </div>
                </section>

                <section
                  aria-label="Detail pembayaran"
                  className="booking-summary-money"
                >
                  <div>
                    <span>
                      Subtotal
                    </span>

                    <strong>
                      {formatRupiah(
                        totals.subtotal,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Diskon
                    </span>

                    <strong
                      className={
                        totals.discountAmount
                          ? 'is-discount'
                          : ''
                      }
                    >
                      {totals.discountAmount
                        ? '-'
                        : ''}
                      {formatRupiah(
                        totals.discountAmount,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Total
                    </span>

                    <strong>
                      {formatRupiah(
                        totals.total,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Dibayar / DP
                    </span>

                    <strong className="is-paid">
                      {formatRupiah(
                        totals.dpAmount,
                      )}
                    </strong>
                  </div>

                  <div className="is-total">
                    <span>
                      Tagihan
                    </span>

                    <strong>
                      {formatRupiah(
                        totals.invoiceAmount,
                      )}
                    </strong>
                  </div>
                </section>

                {totals.appliedDiscounts.length ? (
                  <p className="booking-summary-discount">
                    Discount aktif sebesar{' '}
                    <strong>
                      {formatRupiah(
                        totals.discountAmount,
                      )}
                    </strong>
                    {' '}untuk{' '}
                    {totals.durationHours}
                    {' '}jam{' '}
                    {totals.session?.label}.
                  </p>
                ) : null}
              </aside>

              <div className="booking-form-fields">
                <section
                  aria-labelledby="booking-section-customer"
                  className={[
                    'booking-form-section',
                    customerStepComplete ? 'is-complete' : 'is-pending',
                    hasCustomerError ? 'has-error' : '',
                  ].filter(Boolean).join(' ')}
                  data-booking-step="customer"
                >
                  <header className="booking-form-section-head">
                    <span
                      aria-hidden="true"
                      className="booking-form-step-index"
                    >
                      {customerStepComplete ? (
                        <Check
                          size={13}
                          strokeWidth={2.6}
                        />
                      ) : (
                        '01'
                      )}
                    </span>

                    <div>
                      <h3 id="booking-section-customer">
                        Customer
                      </h3>

                      <p>
                        Identitas utama pemakai slot studio.
                      </p>
                      <small className="booking-form-step-state">
                        {customerStepComplete
                          ? [form.name.trim(), form.phone.trim()].filter(Boolean).join(' · ')
                          : 'Nama & No HP wajib diisi'}
                      </small>
                    </div>
                  </header>

                  <div className="booking-form-section-grid">
                    <StudioTextField
                      autoComplete="name"
                      className="booking-field-span-2"
                      error={fieldErrors.name}
                      icon={UserRound}
                      id="booking-name"
                      label="Nama"
                      placeholder="Nama customer"
                      required
                      value={form.name}
                      onChange={updateField('name')}
                    />

                    <StudioTextField
                      autoComplete="tel"
                      error={fieldErrors.phone}
                      icon={Phone}
                      id="booking-phone"
                      inputMode="tel"
                      label="No HP"
                      placeholder="08xxxxxxxxxx"
                      required
                      value={form.phone}
                      onChange={updateField('phone')}
                    />

                    <StudioTextField
                      autoComplete="organization"
                      helper="Opsional"
                      icon={UsersRound}
                      id="booking-band-name"
                      label="Nama Band"
                      placeholder="Band / project"
                      value={form.bandName}
                      onChange={updateField('bandName')}
                    />
                  </div>
                </section>

                <section
                  aria-labelledby="booking-section-service"
                  className={[
                    'booking-form-section',
                    serviceStepComplete ? 'is-complete' : 'is-pending',
                    hasServiceError ? 'has-error' : '',
                  ].filter(Boolean).join(' ')}
                  data-booking-step="service"
                >
                  <header className="booking-form-section-head">
                    <span
                      aria-hidden="true"
                      className="booking-form-step-index"
                    >
                      {serviceStepComplete ? (
                        <Check
                          size={13}
                          strokeWidth={2.6}
                        />
                      ) : (
                        '02'
                      )}
                    </span>

                    <div>
                      <h3 id="booking-section-service">
                        Layanan Studio
                      </h3>

                      <p>
                        Paket atau session menentukan harga dan durasi.
                      </p>
                      <small className="booking-form-step-state">
                        {serviceStepComplete
                          ? activeServiceLabel
                          : 'Pilih layanan studio'}
                      </small>
                    </div>
                  </header>

                  <div className="booking-form-section-grid">
                    <StudioSelect
                      className="booking-field-span-2"
                      label="Paket"
                      mobileSheet
                      options={packageOptions}
                      portalContainer={selectPortalRef}
                      selectedKey={form.packageId}
                      sheetTitle="Pilih Paket Studio"
                      onChange={updateValue('packageId')}
                    />

                    <StudioSelect
                      className={!shouldShowRecordingType ? 'booking-field-span-2' : ''}
                      disabled={isPackageSelected}
                      label="Tipe Session"
                      mobileSheet
                      options={sessionTypeOptions}
                      portalContainer={selectPortalRef}
                      selectedKey={form.sessionType}
                      sheetTitle="Pilih Tipe Session"
                      onChange={updateValue('sessionType')}
                    />

                    {shouldShowRecordingType ? (
                      <StudioSelect
                        label="Tipe Recording"
                        mobileSheet
                        options={recordingTypeOptions}
                        portalContainer={selectPortalRef}
                        selectedKey={activeRecordingTypeKey}
                        sheetTitle="Pilih Tipe Recording"
                        onChange={updateValue('recordingTypeId')}
                      />
                    ) : null}
                  </div>

                  {fieldErrors.recordingTypeId ? (
                    <p className="booking-inline-error" role="alert">
                      {fieldErrors.recordingTypeId}
                    </p>
                  ) : null}

                  {isNoDurationPackageSelected ? (
                    <p className="booking-price-note">
                      Paket ini tidak memakai durasi studio utama.
                      Jadwal tidak akan memblok kalender studio.
                    </p>
                  ) : null}

                  {isRecordingSessionSelected ? (
                    <p className="booking-price-note">
                      Harga dan durasi Recording mengikuti Tipe Recording.
                      Tidak ada tarif Recording per jam.
                    </p>
                  ) : null}
                </section>

                <section
                  aria-labelledby="booking-section-slot"
                  className={[
                    'booking-form-section',
                    slotStepComplete ? 'is-complete' : 'is-pending',
                    hasSlotError ? 'has-error' : '',
                  ].filter(Boolean).join(' ')}
                  data-booking-step="slot"
                >
                  <header className="booking-form-section-head">
                    <span
                      aria-hidden="true"
                      className="booking-form-step-index"
                    >
                      {hasSlotError ? (
                        '!'
                      ) : slotStepComplete ? (
                        <Check
                          size={13}
                          strokeWidth={2.6}
                        />
                      ) : (
                        '03'
                      )}
                    </span>

                    <div>
                      <h3 id="booking-section-slot">
                        Slot Studio
                      </h3>

                      <p>
                        Tentukan tanggal, jam mulai, dan durasi.
                      </p>
                      <small className="booking-form-step-state">
                        {slotConflictIssue
                          ? slotConflictIssue.title
                          : slotStepComplete
                            ? activeDateLabel + ' · ' + slotTimeRangeLabel
                            : 'Atur tanggal & durasi'}
                      </small>
                    </div>
                  </header>

                  <div className="booking-form-section-grid is-slot-grid">
                    <StudioTextField
                      className="booking-field-span-2 booking-slot-date-field"
                      error={fieldErrors.date}
                      icon={CalendarDays}
                      id="booking-date"
                      label="Tanggal"
                      required
                      type="date"
                      value={form.date}
                      onChange={updateField('date')}
                    />

                    <StudioSelect
                      label="Jam Mulai"
                      mobileSheet
                      options={businessHours}
                      portalContainer={selectPortalRef}
                      selectedKey={form.startHour}
                      sheetTitle="Pilih Jam Mulai"
                      onChange={updateValue('startHour')}
                    />

                    <StudioSelect
                      disabled={
                        isPackageSelected ||
                        isRecordingSessionSelected
                      }
                      label="Durasi"
                      mobileSheet
                      options={durationOptions}
                      portalContainer={selectPortalRef}
                      selectedKey={form.duration}
                      sheetTitle="Pilih Durasi Sesi"
                      onChange={updateValue('duration')}
                    />

                    {form.duration === 'custom' &&
                    !isPackageSelected &&
                    !isRecordingSessionSelected ? (
                      <StudioTextField
                        className="booking-field-span-2"
                        error={fieldErrors.customDuration}
                        helper="Jam"
                        icon={Clock3}
                        id="booking-custom-duration"
                        inputMode="decimal"
                        label="Durasi Custom"
                        min="0.5"
                        placeholder="Contoh 1.5"
                        step="0.5"
                        type="number"
                        value={form.customDuration}
                        onChange={updateField('customDuration')}
                      />
                    ) : null}
                  </div>

                  <div
                    className={
                      'booking-slot-status ' +
                      (slotConflictIssue ? 'is-conflict' : 'is-available')
                    }
                    role={slotConflictIssue ? 'alert' : undefined}
                  >
                    {slotConflictIssue ? (
                      <>
                        <AlertTriangle aria-hidden="true" size={16} />
                        <div>
                          <strong>{slotConflictIssue.title}</strong>
                          <span>{slotConflictIssue.message}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true" className="booking-slot-status-dot" />
                        <div>
                          <strong>{slotTimeRangeLabel}</strong>
                          <span>
                            {isNoDurationPackageSelected
                              ? 'Tidak memakai blok jam kalender.'
                              : 'Slot tersedia pada kalender studio.'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                <section
                  aria-labelledby="booking-section-payment"
                  className={[
                    'booking-form-section',
                    paymentStepComplete ? 'is-complete' : 'is-pending',
                    hasPaymentError ? 'has-error' : '',
                  ].filter(Boolean).join(' ')}
                  data-booking-step="payment"
                >
                  <header className="booking-form-section-head">
                    <span
                      aria-hidden="true"
                      className="booking-form-step-index"
                    >
                      {hasPaymentError ? (
                        '!'
                      ) : paymentStepComplete ? (
                        <Check
                          size={13}
                          strokeWidth={2.6}
                        />
                      ) : (
                        '04'
                      )}
                    </span>

                    <div>
                      <h3 id="booking-section-payment">
                        Pembayaran
                      </h3>

                      <p>
                        Catat status dan pembayaran awal booking.
                      </p>
                      <small className="booking-form-step-state">
                        {paymentStepComplete
                          ? (
                              form.paymentStatus === 'dp' && totals.dpAmount > 0
                                ? 'DP ' + formatRupiah(totals.dpAmount)
                                : paymentStatusLabel
                            )
                          : 'Masukkan nominal DP'}
                      </small>
                    </div>
                  </header>

                  <div className="booking-form-section-grid is-payment-grid">
                    <StudioSelect
                      className={
                        form.paymentStatus === 'pending'
                          ? 'booking-field-span-2'
                          : ''
                      }
                      label="Payment Status"
                      mobileSheet
                      options={paymentStatusOptions}
                      portalContainer={selectPortalRef}
                      selectedKey={form.paymentStatus}
                      sheetTitle="Pilih Status Pembayaran"
                      onChange={updateValue('paymentStatus')}
                    />

                    {form.paymentStatus !== 'pending' ? (
                      <StudioSelect
                        label="Metode Bayar"
                        mobileSheet
                        options={paymentMethodOptions}
                        portalContainer={selectPortalRef}
                        selectedKey={form.paymentMethod}
                        sheetTitle="Pilih Metode Pembayaran"
                        onChange={updateValue('paymentMethod')}
                      />
                    ) : null}

                    {form.paymentStatus === 'dp' ? (
                      <div className="booking-dp-group booking-field-span-2">
                        <StudioTextField
                          error={fieldErrors.dpAmount}
                          helper="Rupiah"
                          icon={CreditCard}
                          id="booking-dp-amount"
                          inputMode="numeric"
                          label="Nominal DP"
                          min="0"
                          placeholder="Contoh 50000 atau 50.000"
                          type="text"
                          value={form.dpAmount}
                          onChange={updateField('dpAmount')}
                        />

                        {dpPresetAmounts.length ? (
                          <div aria-label="Pilih nominal DP cepat" className="booking-dp-presets">
                            {dpPresetAmounts.map((preset) => {
                              const isSelectedPreset = parseRupiahInput(form.dpAmount) === preset.amount;
                              return (
                                <button
                                  className={
                                    isSelectedPreset
                                      ? 'booking-dp-chip is-active'
                                      : 'booking-dp-chip'
                                  }
                                  key={preset.key}
                                  type="button"
                                  onClick={() => selectDpPreset(preset.amount)}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>

            </div>

            {error ? (
              <p
                className="booking-form-error booking-form-global-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <footer className="booking-form-actions">
              <div
                aria-label="Tagihan booking"
                className="booking-form-action-total"
              >
                <span>
                  {totals.invoiceAmount === 0 && Number(totals.total) > 0
                    ? 'Total lunas'
                    : totals.dpAmount > 0
                      ? 'Sisa tagihan'
                      : 'Tagihan'}
                </span>

                <strong>
                  {formatRupiah(
                    totals.invoiceAmount,
                  )}
                </strong>

                <small
                  className={
                    slotConflictIssue
                      ? 'is-conflict'
                      : isBookingReady
                        ? 'is-ready'
                        : ''
                  }
                >
                  {bookingReadinessLabel}
                </small>
              </div>

              <div className="booking-form-action-buttons">
                <Dialog.Close
                  asChild
                >
                  <button
                    className="booking-button is-secondary"
                    type="button"
                  >
                    Batal
                  </button>
                </Dialog.Close>

                <button
                  className="booking-button is-primary"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving
                    ? 'Menyimpan...'
                    : editingBooking
                      ? 'Simpan Perubahan'
                      : 'Simpan Booking'}
                </button>
              </div>
            </footer>
          </form>

          <div
            className="booking-modal-portal-root"
            ref={selectPortalRef}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
