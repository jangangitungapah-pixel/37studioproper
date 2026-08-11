import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
} from 'radix-ui';
import {
  CalendarDays,
  Check,
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
} from '../../pages/admin/scheduleConfig.js';
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
  editingBooking,
  initialSlot,
  isOpen,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() => createInitialForm(initialSlot, editingBooking));
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
      setError('');
      setIsSaving(false);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [editingBooking, initialSlot, isOpen]);

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

  if (!isOpen) return null;

  function updateField(field) {
    return (event) => {
      const nextValue = field === 'dpAmount'
        ? normalizeMoneyInputValue(event.target.value)
        : event.target.value;

      setForm((current) => ({
        ...current,
        [field]: nextValue,
      }));

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

      if (error) setError('');
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSaving) return;

    const cleanName = form.name.trim();
    const cleanPhone = form.phone.trim();
    const cleanBandName = form.bandName.trim();
    const requestedDpAmount = parseRupiahInput(form.dpAmount);

    if (!cleanName || !cleanPhone || !form.date || !form.startHour) {
      setError('Nama, No HP, tanggal, dan jam wajib diisi.');
      return;
    }

    if (isRecordingSessionSelected && !recordingTypeOptions.length) {
      setError('Recording Type belum tersedia. Tambahkan harga Recording Type di Settings terlebih dahulu.');
      return;
    }

    if (isRecordingSessionSelected && activeRecordingTypeKey === 'none') {
      setError('Pilih Tipe Recording terlebih dahulu.');
      return;
    }

    if (!isNoDurationPackageSelected && !totals.durationHours) {
      setError('Durasi booking harus lebih dari 0 jam.');
      return;
    }

    if (form.paymentStatus === 'dp' && !requestedDpAmount) {
      setError('Nominal DP wajib diisi jika status pembayaran DP.');
      return;
    }

    const startHourNumber = Number(form.startHour);
    const hourOption = getSelectedOption(businessHours, form.startHour);
    const sessionLabel = totals.packageItem?.label || totals.recordingType?.label || totals.session?.label || 'Session';
    const bookingId = editingBooking?.id || makeBookingId();
    const now = new Date().toISOString();
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
      });
    } catch (saveError) {
      console.error(
        'Booking form save failed:',
        saveError
      );

      setError(
        'Booking belum berhasil disimpan. Coba kembali.'
      );

      return;
    } finally {
      setIsSaving(false);
    }

    if (didSave === false) {
      return;
    }

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

  const bookingReadinessLabel =
    isBookingReady
      ? 'Siap disimpan'
      : incompleteStepCount +
        ' langkah belum lengkap';

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
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="booking-modal-backdrop"
        />

        <Dialog.Content
          className="booking-modal-panel"
          data-booking-modal-ui="ui-3b-guided"
        >
          <header className="booking-modal-head">
            <div className="booking-modal-heading">
              <span className="booking-modal-kicker">
                {editingBooking
                  ? 'Edit calendar booking'
                  : 'New calendar booking'}
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
                  Lengkapi empat langkah utama.
                  Ringkasan dan tagihan akan diperbarui otomatis.
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
                  <span>Progress form</span>
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
            <div className="booking-form-layout">
              <div className="booking-form-fields">
                <section
                  aria-labelledby="booking-section-customer"
                  className={
                    'booking-form-section ' +
                    (
                      customerStepComplete
                        ? 'is-complete'
                        : 'is-pending'
                    )
                  }
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
                          ? 'Customer lengkap'
                          : 'Nama & No HP wajib'}
                      </small>
                    </div>
                  </header>

                  <div className="booking-form-section-grid">
                    <StudioTextField
                      autoComplete="name"
                      className="booking-field-span-2"
                      icon={UserRound}
                      id="booking-name"
                      label="Nama"
                      placeholder="Nama customer"
                      required
                      value={form.name}
                      onChange={updateField('name')}
                    />

                    <StudioTextField
                      autoComplete="organization"
                      icon={UsersRound}
                      id="booking-band-name"
                      label="Nama Band"
                      placeholder="Nama band / project"
                      value={form.bandName}
                      onChange={updateField('bandName')}
                    />

                    <StudioTextField
                      autoComplete="tel"
                      icon={Phone}
                      id="booking-phone"
                      inputMode="tel"
                      label="No HP"
                      placeholder="08xxxxxxxxxx"
                      required
                      value={form.phone}
                      onChange={updateField('phone')}
                    />
                  </div>
                </section>

                <section
                  aria-labelledby="booking-section-service"
                  className={
                    'booking-form-section ' +
                    (
                      serviceStepComplete
                        ? 'is-complete'
                        : 'is-pending'
                    )
                  }
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
                          ? 'Layanan siap'
                          : 'Pilih layanan'}
                      </small>
                    </div>
                  </header>

                  <div className="booking-form-section-grid">
                    <StudioSelect
                      className="booking-field-span-2"
                      inlineList
                      label="Paket"
                      options={packageOptions}
                      selectedKey={form.packageId}
                      onChange={updateValue('packageId')}
                    />

                    <StudioSelect
                      inlineList
                      disabled={isPackageSelected}
                      label="Tipe Session"
                      options={sessionTypeOptions}
                      selectedKey={form.sessionType}
                      onChange={updateValue('sessionType')}
                    />

                    {shouldShowRecordingType ? (
                      <StudioSelect
                        inlineList
                        label="Tipe Recording"
                        options={recordingTypeOptions}
                        selectedKey={activeRecordingTypeKey}
                        onChange={updateValue('recordingTypeId')}
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="booking-form-empty-cell"
                      />
                    )}
                  </div>

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
                  className={
                    'booking-form-section ' +
                    (
                      slotStepComplete
                        ? 'is-complete'
                        : 'is-pending'
                    )
                  }
                  data-booking-step="slot"
                >
                  <header className="booking-form-section-head">
                    <span
                      aria-hidden="true"
                      className="booking-form-step-index"
                    >
                      {slotStepComplete ? (
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
                        {slotStepComplete
                          ? 'Slot siap'
                          : 'Atur jadwal'}
                      </small>
                    </div>
                  </header>

                  <div className="booking-form-section-grid is-slot-grid">
                    <StudioTextField
                      icon={CalendarDays}
                      id="booking-date"
                      label="Tanggal"
                      required
                      type="date"
                      value={form.date}
                      onChange={updateField('date')}
                    />

                    <StudioSelect
                      inlineList
                      label="Jam Mulai"
                      options={businessHours}
                      selectedKey={form.startHour}
                      onChange={updateValue('startHour')}
                    />

                    <StudioSelect
                      inlineList
                      disabled={
                        isPackageSelected ||
                        isRecordingSessionSelected
                      }
                      label="Durasi"
                      options={durationOptions}
                      selectedKey={form.duration}
                      onChange={updateValue('duration')}
                    />

                    {form.duration === 'custom' &&
                    !isPackageSelected &&
                    !isRecordingSessionSelected ? (
                      <StudioTextField
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
                </section>

                <section
                  aria-labelledby="booking-section-payment"
                  className={
                    'booking-form-section ' +
                    (
                      paymentStepComplete
                        ? 'is-complete'
                        : 'is-pending'
                    )
                  }
                  data-booking-step="payment"
                >
                  <header className="booking-form-section-head">
                    <span
                      aria-hidden="true"
                      className="booking-form-step-index"
                    >
                      {paymentStepComplete ? (
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
                          ? 'Pembayaran siap'
                          : 'Lengkapi pembayaran'}
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
                      inlineList
                      label="Payment Status"
                      options={paymentStatusOptions}
                      selectedKey={form.paymentStatus}
                      onChange={updateValue('paymentStatus')}
                    />

                    {form.paymentStatus !== 'pending' ? (
                      <StudioSelect
                        inlineList
                        label="Metode Bayar"
                        options={paymentMethodOptions}
                        selectedKey={form.paymentMethod}
                        onChange={updateValue('paymentMethod')}
                      />
                    ) : null}

                    {form.paymentStatus === 'dp' ? (
                      <StudioTextField
                        className="booking-field-span-2"
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
                    ) : null}
                  </div>
                </section>
              </div>

              <aside
                aria-label="Ringkasan booking"
                className="booking-form-summary"
              >
                <section
                  className={
                    'booking-summary-readiness ' +
                    (
                      isBookingReady
                        ? 'is-ready'
                        : ''
                    )
                  }
                >
                  <span className="booking-summary-readiness-icon">
                    {isBookingReady ? (
                      <Check
                        size={15}
                        strokeWidth={2.6}
                      />
                    ) : (
                      completedStepCount
                    )}
                  </span>

                  <div>
                    <small>Booking readiness</small>
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
                    Live booking quote
                  </span>

                  <strong>
                    {formatRupiah(
                      totals.invoiceAmount,
                    )}
                  </strong>

                  <small>
                    tagihan tersisa
                  </small>
                </section>

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
                      {activeTimeLabel}
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
                  Tagihan
                </span>

                <strong>
                  {formatRupiah(
                    totals.invoiceAmount,
                  )}
                </strong>

                <small
                  className={
                    isBookingReady
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
