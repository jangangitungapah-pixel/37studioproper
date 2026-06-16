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
  sessionTypeOptions,
} from '../../pages/admin/scheduleConfig.js';

const initialForm = {
  name: '',
  bandName: '',
  phone: '',
  sessionType: 'rehearsal',
  date: '',
  startHour: '10',
  duration: '1',
  customDuration: '',
  paymentStatus: 'pending',
  dpAmount: '',
};

function toCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));
}

function clampCurrency(value, max) {
  const numberValue = Math.max(0, Number(value) || 0);
  return Math.min(numberValue, Math.max(0, Number(max) || 0));
}

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

export default function BookingFormModal({
  initialSlot,
  isOpen,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() => createInitialForm(initialSlot));
  const [error, setError] = useState('');

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

  const totals = useMemo(() => {
    const session = getSelectedOption(sessionTypeOptions, form.sessionType);
    const durationHours = getDurationHours(form);
    const total = session.rate * durationHours;
    const dpAmount = form.paymentStatus === 'dp' ? clampCurrency(form.dpAmount, total) : 0;
    const paidAmount = form.paymentStatus === 'lunas' ? total : dpAmount;
    const invoiceAmount = Math.max(0, total - paidAmount);

    return {
      durationHours,
      total,
      dpAmount: form.paymentStatus === 'lunas' ? total : dpAmount,
      invoiceAmount,
      session,
    };
  }, [form]);

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

    onSave({
      id: makeBookingId(),
      customer: cleanName,
      bandName: cleanBandName,
      phone: cleanPhone,
      sessionType: form.sessionType,
      sessionLabel: totals.session.label,
      title: cleanBandName || totals.session.label,
      date: form.date,
      startHour: startHourNumber,
      startTimeLabel: hourOption.shortLabel || hourOption.label,
      durationHours: totals.durationHours,
      paymentStatus: form.paymentStatus,
      status: form.paymentStatus,
      total: totals.total,
      dpAmount: totals.dpAmount,
      invoiceAmount: totals.invoiceAmount,
      createdAt: new Date().toISOString(),
    });

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
              label="Tipe Session"
              options={sessionTypeOptions}
              selectedKey={form.sessionType}
              onChange={updateValue('sessionType')}
            />

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
              label="Durasi"
              options={durationOptions}
              selectedKey={form.duration}
              onChange={updateValue('duration')}
            />

            {form.duration === 'custom' ? (
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

          {error ? (
            <p className="booking-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <section className="booking-detail-panel" aria-label="Detail pembayaran">
            <div>
              <span>Total</span>
              <strong>{toCurrency(totals.total)}</strong>
            </div>
            <div>
              <span>DP</span>
              <strong>{toCurrency(totals.dpAmount)}</strong>
            </div>
            <div>
              <span>Tagihan</span>
              <strong>{toCurrency(totals.invoiceAmount)}</strong>
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
