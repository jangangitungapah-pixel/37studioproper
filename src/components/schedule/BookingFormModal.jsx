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
  getPricingSettings,
  getRecordingTypeOptions,
  getSessionOptions,
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
  dpAmount: '',
};

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

function createInitialForm(initialSlot) {
  return {
    ...initialForm,
    date: initialSlot?.date || getTodayIsoDate(),
    startHour: initialSlot?.startHour || '10',
  };
}

function getSelectedOption(options, key) {
  return options.find((option) => option.key === key) || options[0];
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

export default function BookingFormModal({
  initialSlot,
  isOpen,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() => createInitialForm(initialSlot));
  const [error, setError] = useState('');

  const pricingSettings = getPricingSettings();
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
  const activeRecordingTypeKey =
    form.recordingTypeId !== 'none'
      ? form.recordingTypeId
      : recordingTypeOptions[0]?.key || 'none';
  const shouldShowRecordingType =
    !isPackageSelected &&
    form.sessionType === recordingSessionKey &&
    recordingTypeOptions.length > 0;

  useEffect(() => {
    if (!isOpen) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      setForm(createInitialForm(initialSlot));
      setError('');
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [initialSlot, isOpen]);

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
        dpAmount: form.dpAmount,
        pricingSettings,
        recordingTypeId: shouldShowRecordingType ? activeRecordingTypeKey : 'none',
        sessionId: form.sessionType,
      }),
    [activeRecordingTypeKey, form, pricingSettings, shouldShowRecordingType]
  );

  if (!isOpen) return null;

  function updateField(field) {
    return (event) => {
      const nextValue = event.target.value;

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
          next.recordingTypeId = nextValue === recordingSessionKey ? recordingTypeOptions[0]?.key || 'none' : 'none';
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

  function handleSubmit(event) {
    event.preventDefault();

    const cleanName = form.name.trim();
    const cleanPhone = form.phone.trim();
    const cleanBandName = form.bandName.trim();

    if (!cleanName || !cleanPhone || !form.date || !form.startHour) {
      setError('Nama, No HP, tanggal, dan jam wajib diisi.');
      return;
    }

    if (!totals.durationHours) {
      setError('Durasi booking harus lebih dari 0 jam.');
      return;
    }

    if (form.paymentStatus === 'dp' && !totals.dpAmount) {
      setError('Nominal DP wajib diisi jika status pembayaran DP.');
      return;
    }

    const startHourNumber = Number(form.startHour);
    const hourOption = getSelectedOption(businessHours, form.startHour);
    const sessionLabel = totals.packageItem?.label || totals.recordingType?.label || totals.session?.label || 'Session';

    const didSave = onSave({
      id: makeBookingId(),
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
      paymentStatus: form.paymentStatus,
      status: form.paymentStatus,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      appliedDiscounts: totals.appliedDiscounts,
      total: totals.total,
      dpAmount: totals.dpAmount,
      invoiceAmount: totals.invoiceAmount,
      createdAt: new Date().toISOString(),
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
            <p>Booking Form</p>
            <h2 id="booking-form-title">Tambah Booking</h2>
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
              label="Paket"
              options={packageOptions}
              selectedKey={form.packageId}
              onChange={updateValue('packageId')}
            />

            <StudioSelect
              disabled={isPackageSelected}
              label="Tipe Session"
              options={sessionTypeOptions}
              selectedKey={form.sessionType}
              onChange={updateValue('sessionType')}
            />

            {shouldShowRecordingType ? (
              <StudioSelect
                label="Tipe Recording"
                options={recordingTypeOptions}
                selectedKey={activeRecordingTypeKey}
                onChange={updateValue('recordingTypeId')}
              />
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
              label="Jam"
              options={businessHours}
              selectedKey={form.startHour}
              onChange={updateValue('startHour')}
            />

            <StudioSelect
              disabled={isPackageSelected || Boolean(totals.recordingType)}
              label="Durasi"
              options={durationOptions}
              selectedKey={form.duration}
              onChange={updateValue('duration')}
            />

            {form.duration === 'custom' && !isPackageSelected && !totals.recordingType ? (
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
                placeholder="Contoh 50000"
                step="1000"
                type="number"
                value={form.dpAmount}
                onChange={updateField('dpAmount')}
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
              Simpan
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
