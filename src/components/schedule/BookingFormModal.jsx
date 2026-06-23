import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
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

function getRecordingSessionKey(sessionOptions) {
  return sessionOptions.find((item) => item.key === 'recording')?.key || 'recording';
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

  const recordingSessionKey = getRecordingSessionKey(sessionTypeOptions);
  const isPackageSelected = form.packageId !== 'none';
  const isNoDurationPackageSelected = isPackageSelected && Number(totals.durationHours || 0) <= 0;
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
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [editingBooking, initialSlot, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

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

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

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

    const didSave = await onSave({
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

    if (didSave === false) {
      return;
    }

    onClose();
  }

  return (
    <div
      className="booking-modal-backdrop"
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <section
        aria-labelledby="booking-form-title"
        aria-modal="true"
        className="booking-modal-panel"
        role="dialog"
      >
        <header className="booking-modal-head">
          <div>
            <p>{editingBooking ? 'Edit Booking' : 'Booking Form'}</p>
            <h2 id="booking-form-title">{editingBooking ? 'Edit Booking' : 'Tambah Booking'}</h2>
          </div>

          <button
            aria-label="Tutup form booking"
            className="booking-modal-close"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <form className="booking-form" onSubmit={handleSubmit} noValidate>
          <div className="booking-form-grid">
            <StudioTextField
              autoComplete="name"
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

            <StudioSelect
              inlineList
              label="Paket"
              options={packageOptions}
              selectedKey={form.packageId}
              onChange={updateValue('packageId')}
            />

            {isNoDurationPackageSelected ? (
              <p className="booking-price-note">
                Paket ini tidak memakai durasi studio utama. Jadwal tidak akan memblok kalender studio.
              </p>
            ) : null}

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
            ) : null}

            {isRecordingSessionSelected ? (
              <p className="booking-price-note">
                Harga dan durasi Recording mengikuti Tipe Recording. Tidak ada tarif Recording per jam.
              </p>
            ) : null}

            <StudioTextField
              icon={CalendarDays}
              id="booking-date"
              label="Date"
              required
              type="date"
              value={form.date}
              onChange={updateField('date')}
            />

            <StudioSelect
              inlineList
              label="Jam"
              options={businessHours}
              selectedKey={form.startHour}
              onChange={updateValue('startHour')}
            />

            <StudioSelect
              inlineList
              disabled={isPackageSelected || isRecordingSessionSelected}
              label="Durasi"
              options={durationOptions}
              selectedKey={form.duration}
              onChange={updateValue('duration')}
            />

            {form.duration === 'custom' && !isPackageSelected && !isRecordingSessionSelected ? (
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

            <StudioSelect
              inlineList
              label="Payment Status"
              options={paymentStatusOptions}
              selectedKey={form.paymentStatus}
              onChange={updateValue('paymentStatus')}
            />

            {form.paymentStatus === 'dp' ? (
              <StudioTextField
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

            {form.paymentStatus !== 'pending' ? (
              <StudioSelect
                inlineList
                label="Metode Bayar"
                options={paymentMethodOptions}
                selectedKey={form.paymentMethod}
                onChange={updateValue('paymentMethod')}
              />
            ) : null}
          </div>

          {totals.appliedDiscounts.length ? (
            <p className="booking-price-note">
              Discount aktif: {formatRupiah(totals.discountAmount)} untuk {totals.durationHours} jam {totals.session?.label}.
            </p>
          ) : null}

          {error ? (
            <p className="booking-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <section className="booking-detail-panel has-discount-row" aria-label="Detail pembayaran">
            <div>
              <span>Subtotal</span>
              <strong>{formatRupiah(totals.subtotal)}</strong>
            </div>
            <div>
              <span>Diskon</span>
              <strong>{totals.discountAmount ? '-' : ''}{formatRupiah(totals.discountAmount)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatRupiah(totals.total)}</strong>
            </div>
            <div>
              <span>DP</span>
              <strong>{formatRupiah(totals.dpAmount)}</strong>
            </div>
            <div>
              <span>Tagihan</span>
              <strong>{formatRupiah(totals.invoiceAmount)}</strong>
            </div>
          </section>

          <footer className="booking-form-actions">
            <button className="booking-button is-secondary" type="button" onClick={onClose}>
              Batal
            </button>
            <button className="booking-button is-primary" type="submit">
              {editingBooking ? 'Simpan Perubahan' : 'Simpan'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
