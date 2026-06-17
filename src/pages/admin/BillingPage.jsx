import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  CreditCard,
  Download,
  PhoneCall,
  Printer,
  Search,
  Share2,
  X,
} from 'lucide-react';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import PaginationControls from '../../components/ui/PaginationControls.jsx';
import { ADMIN_LIST_PAGE_SIZE, getPaginationSlice } from '../../utils/pagination.js';
import { adminBookingRepository, createBookingCode, createInvoiceNumber } from '../../services/adminBookingRepository.js';
import { defaultInvoiceSettings, useInvoiceSettings } from '../../settings/invoiceSettings.js';

const billingFilterOptions = [
  { key: 'all', label: 'Semua', description: 'Semua aktivitas booking' },
  { key: 'open', label: 'Belum Lunas', description: 'Pending dan DP' },
  { key: 'pending', label: 'Pending', description: 'Belum ada pembayaran' },
  { key: 'dp', label: 'DP', description: 'Sudah DP, belum lunas' },
  { key: 'lunas', label: 'Lunas', description: 'Sudah selesai' },
  { key: 'void', label: 'Void', description: 'Invoice dibatalkan' },
];

const paymentMethodOptions = [
  { key: 'cash', label: 'Cash', description: 'Pembayaran tunai' },
  { key: 'transfer', label: 'Transfer', description: 'Transfer bank' },
  { key: 'qris', label: 'QRIS', description: 'QRIS / e-wallet' },
  { key: 'other', label: 'Lainnya', description: 'Metode lain' },
];

const cashRangeOptions = [
  { key: 'today', label: 'Hari Ini', description: 'Kas masuk hari ini' },
  { key: 'month', label: 'Bulan Ini', description: 'Kas masuk bulan ini' },
  { key: 'year', label: 'Tahun Ini', description: 'Kas masuk tahun ini' },
  { key: 'all', label: 'Semua', description: 'Semua kas masuk' },
];

function cleanText(value) {
  return String(value || '').trim();
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function formatMoney(value) {
  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Math.max(0, Number(value) || 0));
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(String(value).includes('T') ? value : String(value) + 'T00:00:00');

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatThermalDate(value) {
  if (!value) return '-';

  const date = new Date(String(value).includes('T') ? value : String(value) + 'T00:00:00');

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

function isSameIsoDay(value, isoDate) {
  if (!value || !isoDate) return false;

  const date = new Date(String(value).includes('T') ? value : String(value) + 'T00:00:00');

  if (Number.isNaN(date.getTime())) return false;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day === isoDate;
}

function getDateFromValue(value) {
  if (!value) return null;

  const date = new Date(String(value).includes('T') ? value : String(value) + 'T00:00:00');

  return Number.isNaN(date.getTime()) ? null : date;
}

function isPaymentInCashRange(value, range) {
  if (range === 'all') return true;
  if (range === 'today') return isSameIsoDay(value, getTodayIsoDate());

  const paymentDate = getDateFromValue(value);
  const now = new Date();

  if (!paymentDate) return false;

  if (range === 'month') {
    return paymentDate.getFullYear() === now.getFullYear() && paymentDate.getMonth() === now.getMonth();
  }

  if (range === 'year') {
    return paymentDate.getFullYear() === now.getFullYear();
  }

  return true;
}

function getCashRangeLabel(range) {
  return cashRangeOptions.find((item) => item.key === range)?.label || 'Hari Ini';
}

function formatHour(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) return String(value || '-');

  const hour = Math.floor(numeric);
  const minute = Math.round((numeric - hour) * 60);

  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

function getDurationHours(booking) {
  const duration = Number(booking?.durationHours || booking?.duration || booking?.customDuration || 1);

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

function getTimeRange(booking) {
  const start = Number(booking?.startHour);

  if (!Number.isFinite(start)) return booking?.startTimeLabel || '-';

  return formatHour(start) + ' - ' + formatHour(start + getDurationHours(booking));
}

function getPaymentMethodLabel(method) {
  return paymentMethodOptions.find((item) => item.key === method)?.label || 'Lainnya';
}

function getPaymentHistory(booking) {
  const rawHistory = Array.isArray(booking?.paymentHistory) ? booking.paymentHistory : [];

  if (rawHistory.length) return rawHistory;

  const status = cleanLower(booking?.paymentStatus || booking?.status || 'pending');

  if (status === 'void' || booking?.voidedAt) return [];

  const total = getBillingTotal(booking);
  const dpAmount = getDpAmount(booking);
  const legacyPaidAmount = status === 'lunas' ? total : status === 'dp' ? dpAmount : 0;

  if (!legacyPaidAmount) return [];

  const paymentDate = booking?.lastPaymentAt || booking?.createdAt || booking?.date || getTodayIsoDate();

  return [
    {
      amount: legacyPaidAmount,
      createdAt: paymentDate,
      date: paymentDate,
      id: 'legacy_' + (booking?.id || getBookingDisplayCode(booking)),
      method: booking?.lastPaymentMethod || booking?.paymentMethod || 'other',
      note: status === 'lunas' ? 'Pembayaran awal dari booking form' : 'DP awal dari booking form',
      source: 'legacy-booking-payment',
    },
  ];
}

function getPaymentHistoryTotal(booking) {
  return getPaymentHistory(booking).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

function getBookingDisplayCode(booking) {
  return booking?.bookingCode || booking?.bookingId || createBookingCode(booking, booking?.id);
}

function getInvoiceDisplayNumber(booking) {
  return booking?.invoiceNumber || createInvoiceNumber(booking, booking?.id);
}

function getBillingTotal(booking) {
  return Number(booking?.total || booking?.subtotal || booking?.invoiceAmount || 0) || 0;
}

function getDpAmount(booking) {
  return Number(booking?.dpAmount || 0) || 0;
}

function normalizeStatus(booking) {
  const rawStatus = cleanLower(booking?.paymentStatus || booking?.status || 'pending');

  if (rawStatus === 'void' || booking?.voidedAt) return 'void';

  const total = getBillingTotal(booking);
  const historyTotal = getPaymentHistoryTotal(booking);

  if (historyTotal > 0 && total > 0) {
    return historyTotal >= total ? 'lunas' : 'dp';
  }

  return rawStatus || 'pending';
}

function getPaidAmount(booking) {
  const total = getBillingTotal(booking);
  const historyTotal = getPaymentHistoryTotal(booking);
  const rawStatus = cleanLower(booking?.paymentStatus || booking?.status || 'pending');

  if (historyTotal > 0) return Math.min(total || historyTotal, historyTotal);
  if (rawStatus === 'lunas') return total;
  if (rawStatus === 'dp') return getDpAmount(booking);

  return 0;
}

function getOutstandingAmount(booking) {
  const status = normalizeStatus(booking);
  const total = getBillingTotal(booking);
  const paid = getPaidAmount(booking);

  if (status === 'lunas' || status === 'void') return 0;

  return Math.max(0, Number(booking?.invoiceAmount || total - paid) || 0);
}

function getStatusLabel(status) {
  if (status === 'lunas') return 'Lunas';
  if (status === 'dp') return 'DP';
  if (status === 'void') return 'Void';

  return 'Pending';
}

function getStatusClass(booking) {
  const status = normalizeStatus(booking);

  if (status === 'lunas') return 'is-lunas';
  if (status === 'dp') return 'is-dp';
  if (status === 'void') return 'is-void';

  return 'is-pending';
}

function isOpenBilling(booking) {
  const status = normalizeStatus(booking);

  return status === 'pending' || status === 'dp';
}

function getCustomerPhoneKey(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;

  return digits;
}

function getCustomerPhoneLabel(value) {
  const phoneKey = getCustomerPhoneKey(value);

  if (!phoneKey) return '-';
  if (phoneKey.startsWith('62')) return ('0' + phoneKey.slice(2)).replace(/(\d{4})(\d{4})(\d+)/, '$1 $2 $3');

  return phoneKey;
}

function getReminderMessage(booking, settings = defaultInvoiceSettings) {
  const customer = booking?.customer || 'kak';
  const invoiceNumber = getInvoiceDisplayNumber(booking);
  const outstanding = formatMoney(getOutstandingAmount(booking));
  const bookingDate = formatDate(booking?.date);
  const status = getStatusLabel(normalizeStatus(booking));

  return (
    'Halo kak ' +
    customer +
    ', kami dari ' +
    (settings.studioName || defaultInvoiceSettings.studioName) +
    '. Reminder untuk invoice ' +
    invoiceNumber +
    ' tanggal booking ' +
    bookingDate +
    '. Status pembayaran saat ini ' +
    status +
    ' dengan sisa tagihan ' +
    outstanding +
    '. Terima kasih kak.'
  );
}

function getReminderHref(booking, settings = defaultInvoiceSettings) {
  if (!isOpenBilling(booking)) return '';

  const phoneKey = getCustomerPhoneKey(booking?.phone);

  if (!phoneKey) return '';

  return 'https://wa.me/' + phoneKey + '?text=' + encodeURIComponent(getReminderMessage(booking, settings));
}

function getShareText(booking, settings = defaultInvoiceSettings) {
  const status = normalizeStatus(booking);
  const lines = [
    settings.studioName || defaultInvoiceSettings.studioName,
    'Invoice: ' + getInvoiceDisplayNumber(booking),
    'Booking ID: ' + getBookingDisplayCode(booking),
    'Customer: ' + (booking?.customer || '-'),
    'Tanggal: ' + formatDate(booking?.date),
    'Jam: ' + getTimeRange(booking),
    'Status: ' + getStatusLabel(status),
    'Total: ' + formatMoney(getBillingTotal(booking)),
    'Dibayar: ' + formatMoney(getPaidAmount(booking)),
    'Sisa: ' + formatMoney(getOutstandingAmount(booking)),
  ];

  if (status === 'void' && booking?.voidReason) {
    lines.push('Alasan void: ' + booking.voidReason);
  }

  return lines.join('\n');
}

function getBillingStats(bookings) {
  return bookings.reduce(
    (stats, booking) => {
      const status = normalizeStatus(booking);

      stats.total += 1;
      stats.outstanding += getOutstandingAmount(booking);

      if (status === 'void') {
        stats.void += 1;
        return stats;
      }

      stats.totalAmount += getBillingTotal(booking);

      if (status === 'lunas') stats.paid += 1;
      if (isOpenBilling(booking)) stats.open += 1;

      return stats;
    },
    {
      open: 0,
      outstanding: 0,
      paid: 0,
      total: 0,
      totalAmount: 0,
      void: 0,
    }
  );
}

function getCashStats(bookings, range = 'today') {
  return bookings.reduce(
    (stats, booking) => {
      getPaymentHistory(booking).forEach((payment) => {
        const paymentDate = payment.date || payment.createdAt;

        if (!isPaymentInCashRange(paymentDate, range)) return;

        const amount = Number(payment.amount) || 0;
        const method = payment.method || 'other';

        stats.total += amount;
        stats.count += 1;
        stats.byMethod[method] = (stats.byMethod[method] || 0) + amount;
      });

      return stats;
    },
    {
      byMethod: {
        cash: 0,
        transfer: 0,
        qris: 0,
        other: 0,
      },
      count: 0,
      total: 0,
    }
  );
}

function BillingHero({ bookings }) {
  const stats = getBillingStats(bookings);

  return (
    <section className="billing-hero-grid" aria-label="Ringkasan billing">
      <article className="billing-hero-card">
        <span><CreditCard size={17} /></span>
        <small>Outstanding</small>
        <strong>{formatMoney(stats.outstanding)}</strong>
        <em>{stats.open} invoice belum lunas</em>
      </article>

      <article className="billing-hero-card">
        <span><CheckCircle2 size={17} /></span>
        <small>Lunas</small>
        <strong>{stats.paid}</strong>
        <em>{formatMoney(stats.totalAmount)} total transaksi</em>
      </article>

      <article className="billing-hero-card">
        <span><AlertCircle size={17} /></span>
        <small>Aktivitas</small>
        <strong>{stats.total}</strong>
        <em>{stats.void} invoice void</em>
      </article>
    </section>
  );
}

function BillingCashSummary({ activeRange, bookings, onRangeChange }) {
  const stats = getCashStats(bookings, activeRange);

  return (
    <section className="billing-cash-summary" aria-label="Kas masuk">
      <header>
        <div>
          <small>Kas Masuk {getCashRangeLabel(activeRange)}</small>
          <strong>{formatMoney(stats.total)}</strong>
          <span>{stats.count} pembayaran tercatat</span>
        </div>

        <div className="billing-cash-range">
          <StudioSelect
            label="Periode"
            options={cashRangeOptions}
            selectedKey={activeRange}
            onChange={onRangeChange}
          />
        </div>
      </header>

      <div className="billing-cash-grid">
        <article><small>Cash</small><strong>{formatMoney(stats.byMethod.cash)}</strong></article>
        <article><small>Transfer</small><strong>{formatMoney(stats.byMethod.transfer)}</strong></article>
        <article><small>QRIS</small><strong>{formatMoney(stats.byMethod.qris)}</strong></article>
        <article><small>Lainnya</small><strong>{formatMoney(stats.byMethod.other)}</strong></article>
      </div>
    </section>
  );
}

function BillingToolbar({ activeFilter, onFilterChange, onSearchChange, searchText }) {
  return (
    <section className="billing-toolbar" aria-label="Billing toolbar">
      <div className="billing-search-shell">
        <Search size={17} aria-hidden="true" />
        <input
          aria-label="Cari billing"
          placeholder="Cari customer, invoice, booking ID..."
          type="search"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="billing-filter-select">
        <StudioSelect
          label="Status"
          options={billingFilterOptions}
          selectedKey={activeFilter}
          onChange={onFilterChange}
        />
      </div>
    </section>
  );
}

function BillingReminderQueue({ bookings, invoiceSettings, onOpenInvoice, onRecordPayment }) {
  const openBookings = bookings.filter(isOpenBilling).slice(0, 4);

  return (
    <section className="billing-reminder-card" aria-label="Reminder tagihan">
      <header>
        <span><PhoneCall size={16} /></span>
        <div>
          <small>Reminder Tagihan</small>
          <strong>{openBookings.length ? 'Perlu follow-up' : 'Tagihan aman'}</strong>
        </div>
      </header>

      {openBookings.length ? (
        <div className="billing-reminder-list">
          {openBookings.map((booking) => {
            const reminderHref = getReminderHref(booking, invoiceSettings);

            return (
              <article className="billing-reminder-row" key={booking.id}>
                <button type="button" onClick={() => onOpenInvoice(booking)}>
                  <strong>{booking.customer || '-'}</strong>
                  <small>{getInvoiceDisplayNumber(booking)} • {formatDate(booking.date)}</small>
                </button>

                <em>{formatMoney(getOutstandingAmount(booking))}</em>

                <span>
                  {reminderHref ? (
                    <a href={reminderHref} target="_blank" rel="noreferrer" title="Reminder WhatsApp">
                      WA
                    </a>
                  ) : null}

                  <button type="button" onClick={() => onRecordPayment(booking)}>
                    Bayar
                  </button>
                </span>
              </article>
            );
          })}
        </div>
      ) : (
        <p>Tidak ada invoice pending atau DP. Mesin kas lagi tenang.</p>
      )}
    </section>
  );
}

function BillingList({ bookings, invoiceSettings, onOpenInvoice, onRecordPayment, onVoidInvoice }) {
  if (!bookings.length) {
    return (
      <section className="billing-empty-state">
        <CreditCard size={24} />
        <strong>Belum ada data billing</strong>
        <span>Data billing akan muncul otomatis dari aktivitas booking di Schedule.</span>
      </section>
    );
  }

  return (
    <section className="billing-list" aria-label="Daftar billing">
      {bookings.map((booking) => {
        const status = normalizeStatus(booking);
        const reminderHref = getReminderHref(booking, invoiceSettings);

        return (
          <article className={status === 'void' ? 'billing-row is-void' : 'billing-row'} key={booking.id}>
            <button className="billing-row-main" type="button" onClick={() => onOpenInvoice(booking)}>
              <span>
                <small>{getBookingDisplayCode(booking)}</small>
                <strong>{booking.customer || '-'}</strong>
                <em>{booking.bandName || booking.title || booking.sessionLabel || 'Session'} • {formatDate(booking.date)}</em>
              </span>

              <b className={'billing-status-pill ' + getStatusClass(booking)}>
                {getStatusLabel(status)}
              </b>
            </button>

            <div className="billing-row-money">
              <span>
                <small>Total</small>
                <strong>{formatMoney(getBillingTotal(booking))}</strong>
              </span>
              <span>
                <small>Dibayar</small>
                <strong>{formatMoney(getPaidAmount(booking))}</strong>
              </span>
              <span>
                <small>Sisa</small>
                <strong>{formatMoney(getOutstandingAmount(booking))}</strong>
              </span>
            </div>

            {status === 'void' && booking.voidReason ? (
              <p className="billing-void-note">Void: {booking.voidReason}</p>
            ) : null}

            <div className="billing-row-actions">
              {reminderHref ? (
                <a href={reminderHref} target="_blank" rel="noreferrer">
                  Reminder
                </a>
              ) : null}

              <button type="button" onClick={() => onOpenInvoice(booking)}>
                Invoice
              </button>

              {status !== 'lunas' && status !== 'void' ? (
                <button className="is-primary" type="button" onClick={() => onRecordPayment(booking)}>
                  Bayar
                </button>
              ) : null}

              {status !== 'void' ? (
                <button className="is-danger" type="button" onClick={() => onVoidInvoice(booking)}>
                  Void
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ThermalInvoice({ booking, settings }) {
  const bookingCode = getBookingDisplayCode(booking);
  const invoiceNumber = getInvoiceDisplayNumber(booking);
  const status = normalizeStatus(booking);
  const studioName = settings.studioName || defaultInvoiceSettings.studioName;
  const subtitle = settings.subtitle || defaultInvoiceSettings.subtitle;

  return (
    <section
      className={status === 'void' ? 'billing-thermal-receipt is-void' : 'billing-thermal-receipt'}
      data-paper={settings.paperSize || '80mm'}
      aria-label="Invoice thermal"
    >
      <header>
        <strong>{studioName}</strong>
        <span>{subtitle}</span>
        <span>{invoiceNumber}</span>
        {settings.address ? <span>{settings.address}</span> : null}
        {settings.phone ? <span>{settings.phone}</span> : null}
      </header>

      {status === 'void' ? <div className="billing-thermal-void">VOID</div> : null}

      <div className="billing-thermal-divider" />

      <div className="billing-thermal-lines">
        <span><b>Booking ID</b><em>{bookingCode}</em></span>
        <span><b>Tanggal</b><em>{formatThermalDate(booking.date)}</em></span>
        <span><b>Jam</b><em>{getTimeRange(booking)}</em></span>
        <span><b>Customer</b><em>{booking.customer || '-'}</em></span>
        <span><b>No HP</b><em>{getCustomerPhoneLabel(booking.phone)}</em></span>
        <span><b>Band</b><em>{booking.bandName || '-'}</em></span>
      </div>

      <div className="billing-thermal-divider" />

      <div className="billing-thermal-items">
        <span>
          <b>{booking.sessionLabel || booking.packageLabel || 'Booking Studio'}</b>
          <em>{getDurationHours(booking)} jam</em>
        </span>
        <strong>{formatMoney(getBillingTotal(booking))}</strong>
      </div>

      <div className="billing-thermal-divider" />

      <div className="billing-thermal-totals">
        <span><b>Subtotal</b><em>{formatMoney(Number(booking.subtotal || booking.total || 0))}</em></span>
        <span><b>Diskon</b><em>{formatMoney(Number(booking.discountAmount || 0))}</em></span>
        <span><b>Total</b><em>{formatMoney(getBillingTotal(booking))}</em></span>
        <span><b>Dibayar</b><em>{formatMoney(getPaidAmount(booking))}</em></span>
        <span><b>Sisa</b><em>{formatMoney(getOutstandingAmount(booking))}</em></span>
        <span><b>Status</b><em>{getStatusLabel(status)}</em></span>
      </div>

      {status === 'void' && booking.voidReason ? (
        <>
          <div className="billing-thermal-divider" />
          <div className="billing-thermal-note">
            <b>Alasan Void</b>
            <span>{booking.voidReason}</span>
          </div>
        </>
      ) : null}

      {getPaymentHistory(booking).length ? (
        <>
          <div className="billing-thermal-divider" />

          <div className="billing-thermal-payments">
            <b>Riwayat Bayar</b>
            {getPaymentHistory(booking).map((payment) => (
              <span key={payment.id || payment.createdAt}>
                <em>{formatThermalDate(payment.date || payment.createdAt)} • {getPaymentMethodLabel(payment.method)}</em>
                <strong>{formatMoney(payment.amount)}</strong>
              </span>
            ))}
          </div>
        </>
      ) : null}

      <div className="billing-thermal-divider" />

      <footer>
        <span>{settings.footer || defaultInvoiceSettings.footer}</span>
        <span>{studioName}</span>
      </footer>
    </section>
  );
}

function InvoiceModal({ booking, invoiceSettings, onClose, onPrint, onRecordPayment, onShare, onVoidInvoice }) {
  if (!booking) return null;

  const reminderHref = getReminderHref(booking, invoiceSettings);
  const status = normalizeStatus(booking);

  return (
    <div className="billing-invoice-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="billing-invoice-panel" role="dialog" aria-modal="true" aria-labelledby="billing-invoice-title">
        <header className="billing-invoice-head">
          <div>
            <p>Invoice Digital</p>
            <h2 id="billing-invoice-title">{getInvoiceDisplayNumber(booking)}</h2>
          </div>

          <button type="button" aria-label="Tutup invoice" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="billing-invoice-body">
          <ThermalInvoice booking={booking} settings={invoiceSettings} />
        </div>

        <footer className="billing-invoice-actions">
          {reminderHref ? (
            <a href={reminderHref} target="_blank" rel="noreferrer">
              Reminder
            </a>
          ) : null}

          <button type="button" onClick={() => onShare(booking)}>
            <Share2 size={15} />
            Share
          </button>

          <button type="button" onClick={() => onPrint(booking)}>
            <Download size={15} />
            PDF
          </button>

          <button type="button" onClick={() => onPrint(booking)}>
            <Printer size={15} />
            Print
          </button>

          {status !== 'lunas' && status !== 'void' ? (
            <button className="is-primary" type="button" onClick={() => onRecordPayment(booking)}>
              Bayar
            </button>
          ) : null}

          {status !== 'void' ? (
            <button className="is-danger" type="button" onClick={() => onVoidInvoice(booking)}>
              <Ban size={15} />
              Void
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function PaymentRecordModal({ booking, onClose, onSubmit }) {
  const outstanding = getOutstandingAmount(booking);
  const [form, setForm] = useState(() => ({
    amount: String(outstanding || ''),
    date: getTodayIsoDate(),
    method: 'cash',
    note: '',
  }));
  const [error, setError] = useState('');

  if (!booking) return null;

  function updateField(field) {
    return (event) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));

      if (error) setError('');
    };
  }

  function updateValue(field) {
    return (nextValue) => {
      setForm((current) => ({
        ...current,
        [field]: nextValue,
      }));

      if (error) setError('');
    };
  }

  function handleSubmit(event) {
    event.preventDefault();

    const amount = Number(String(form.amount).replace(/[^0-9.]/g, ''));

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Nominal pembayaran wajib lebih dari 0.');
      return;
    }

    if (amount > outstanding) {
      setError('Nominal pembayaran tidak boleh melebihi sisa tagihan.');
      return;
    }

    onSubmit(booking, {
      amount,
      createdAt: new Date().toISOString(),
      date: form.date || getTodayIsoDate(),
      id: 'pay_' + Date.now().toString(36),
      method: form.method || 'other',
      note: form.note.trim(),
    });
  }

  return (
    <div className="billing-payment-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="billing-payment-panel" role="dialog" aria-modal="true" aria-labelledby="billing-payment-title">
        <header className="billing-payment-head">
          <div>
            <p>Catat Pembayaran</p>
            <h2 id="billing-payment-title">{booking.customer || 'Customer'}</h2>
            <span>Sisa tagihan {formatMoney(outstanding)}</span>
          </div>

          <button type="button" aria-label="Tutup pembayaran" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <form className="billing-payment-form" onSubmit={handleSubmit} noValidate>
          <label>
            <span>Nominal Bayar</span>
            <input
              inputMode="numeric"
              placeholder="Contoh: 120000"
              value={form.amount}
              onChange={updateField('amount')}
            />
          </label>

          <StudioSelect
            label="Metode"
            options={paymentMethodOptions}
            selectedKey={form.method}
            onChange={updateValue('method')}
          />

          <label>
            <span>Tanggal Bayar</span>
            <input
              type="date"
              value={form.date}
              onChange={updateField('date')}
            />
          </label>

          <label>
            <span>Catatan</span>
            <textarea
              placeholder="Opsional, contoh: transfer BCA, QRIS, cash di studio..."
              value={form.note}
              onChange={updateField('note')}
            />
          </label>

          {error ? <p className="billing-payment-error" role="alert">{error}</p> : null}

          <footer>
            <button type="button" onClick={onClose}>Batal</button>
            <button className="is-primary" type="submit">Simpan Pembayaran</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function VoidInvoiceModal({ booking, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!booking) return null;

  function handleSubmit(event) {
    event.preventDefault();

    const cleanReason = reason.trim();

    if (cleanReason.length < 4) {
      setError('Alasan void wajib diisi minimal 4 karakter.');
      return;
    }

    onSubmit(booking, cleanReason);
  }

  return (
    <div className="billing-payment-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="billing-payment-panel billing-void-panel" role="dialog" aria-modal="true" aria-labelledby="billing-void-title">
        <header className="billing-payment-head">
          <div>
            <p>Void Invoice</p>
            <h2 id="billing-void-title">{getInvoiceDisplayNumber(booking)}</h2>
            <span>Invoice akan dibatalkan, bukan dihapus.</span>
          </div>

          <button type="button" aria-label="Tutup void invoice" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <form className="billing-payment-form" onSubmit={handleSubmit} noValidate>
          <label>
            <span>Alasan Void</span>
            <textarea
              placeholder="Contoh: salah input jadwal, customer batal, invoice duplikat..."
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (error) setError('');
              }}
            />
          </label>

          {error ? <p className="billing-payment-error" role="alert">{error}</p> : null}

          <footer>
            <button type="button" onClick={onClose}>Batal</button>
            <button className="is-danger" type="submit">Void Invoice</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function BillingPage() {
  const [bookings, setBookings] = useState([]);
  const [activeFilter, setActiveFilter] = useState('open');
  const [activeCashRange, setActiveCashRange] = useState('today');
  const [billingPage, setBillingPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedPaymentBooking, setSelectedPaymentBooking] = useState(null);
  const [selectedVoidBooking, setSelectedVoidBooking] = useState(null);
  const invoiceSettings = useInvoiceSettings();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const unsubscribe = adminBookingRepository.subscribeManualBookings(
      (data) => setBookings(data),
      (error) => {
        console.error('Gagal memuat billing:', error);
        setToast({
          title: 'Billing belum tersinkron',
          message: 'Data booking belum bisa dimuat dari Firestore.',
        });
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!toast) return undefined;

    const timerId = window.setTimeout(() => setToast(null), 4200);

    return () => window.clearTimeout(timerId);
  }, [toast]);

  const filteredBookings = useMemo(() => {
    const queryText = searchText.trim().toLowerCase();

    return bookings
      .filter((booking) => {
        const status = normalizeStatus(booking);
        const matchesFilter =
          activeFilter === 'all' ||
          (activeFilter === 'open' && isOpenBilling(booking)) ||
          status === activeFilter;

        const haystack = [
          booking.customer,
          booking.phone,
          booking.bandName,
          booking.title,
          booking.sessionLabel,
          booking.packageLabel,
          getBookingDisplayCode(booking),
          getInvoiceDisplayNumber(booking),
        ].join(' ').toLowerCase();

        const matchesSearch = !queryText || haystack.includes(queryText);

        return matchesFilter && matchesSearch;
      })
      .sort((first, second) => {
        const firstDate = new Date(String(first.date || first.createdAt || '')).getTime() || 0;
        const secondDate = new Date(String(second.date || second.createdAt || '')).getTime() || 0;

        return secondDate - firstDate;
      });
  }, [activeFilter, bookings, searchText]);

  const paginatedBookings = useMemo(
    () => getPaginationSlice(filteredBookings, billingPage, ADMIN_LIST_PAGE_SIZE),
    [billingPage, filteredBookings]
  );

  function handleBillingFilterChange(nextFilter) {
    setActiveFilter(nextFilter);
    setBillingPage(1);
  }

  function handleBillingSearchChange(nextSearchText) {
    setSearchText(nextSearchText);
    setBillingPage(1);
  }

  async function recordPayment(booking, payment) {
    if (normalizeStatus(booking) === 'void') {
      setToast({
        title: 'Invoice sudah void',
        message: 'Pembayaran tidak bisa dicatat untuk invoice void.',
      });
      return;
    }

    try {
      const paymentHistory = [...getPaymentHistory(booking), payment];
      const totalPaid = paymentHistory.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const total = getBillingTotal(booking);
      const invoiceAmount = Math.max(0, total - totalPaid);
      const nextStatus = invoiceAmount <= 0 ? 'lunas' : totalPaid > 0 ? 'dp' : 'pending';
      const nextBooking = {
        ...booking,
        dpAmount: nextStatus === 'dp' ? totalPaid : 0,
        invoiceAmount,
        lastPaymentAt: payment.createdAt,
        lastPaymentMethod: payment.method,
        paidAmount: Math.min(total || totalPaid, totalPaid),
        paymentHistory,
        paymentStatus: nextStatus,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };

      await adminBookingRepository.updateManualBooking(nextBooking);
      setSelectedBooking((current) => (current?.id === booking.id ? nextBooking : current));
      setSelectedPaymentBooking(null);
      setToast({
        title: nextStatus === 'lunas' ? 'Pembayaran lunas' : 'Pembayaran tercatat',
        message: (booking.customer || 'Booking') + ' membayar ' + formatMoney(payment.amount) + ' via ' + getPaymentMethodLabel(payment.method) + '.',
      });
    } catch (error) {
      console.error('Gagal mencatat pembayaran:', error);
      setToast({
        title: 'Pembayaran gagal',
        message: 'Pembayaran belum berhasil disimpan.',
      });
    }
  }

  async function voidInvoice(booking, reason) {
    try {
      const nextBooking = {
        ...booking,
        invoiceAmount: 0,
        paymentStatus: 'void',
        previousInvoiceAmount: getOutstandingAmount(booking),
        previousPaymentStatus: normalizeStatus(booking),
        status: 'void',
        updatedAt: new Date().toISOString(),
        voidReason: reason,
        voidedAt: new Date().toISOString(),
      };

      await adminBookingRepository.updateManualBooking(nextBooking);
      setSelectedBooking((current) => (current?.id === booking.id ? nextBooking : current));
      setSelectedVoidBooking(null);
      setToast({
        title: 'Invoice void',
        message: getInvoiceDisplayNumber(booking) + ' sudah dibatalkan.',
      });
    } catch (error) {
      console.error('Gagal void invoice:', error);
      setToast({
        title: 'Void gagal',
        message: 'Invoice belum berhasil dibatalkan.',
      });
    }
  }

  function printInvoice(booking) {
    setSelectedBooking(booking);

    window.requestAnimationFrame(() => {
      window.print();
    });
  }

  async function shareInvoice(booking) {
    const text = getShareText(booking, invoiceSettings);

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          text,
          title: getInvoiceDisplayNumber(booking),
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setToast({
          title: 'Invoice disalin',
          message: 'Detail invoice sudah disalin ke clipboard.',
        });
      } else {
        window.alert(text);
      }
    } catch (error) {
      console.error('Gagal share invoice:', error);
      setToast({
        title: 'Share dibatalkan',
        message: 'Invoice belum dibagikan.',
      });
    }
  }

  return (
    <section className="billing-page" aria-labelledby="billing-page-title">
      <div className="billing-page-title">
        <p>Billing / POS</p>
        <h2 id="billing-page-title">Pembayaran</h2>
      </div>

      <BillingHero bookings={bookings} />

      <BillingCashSummary
        activeRange={activeCashRange}
        bookings={bookings}
        onRangeChange={setActiveCashRange}
      />

      <BillingToolbar
        activeFilter={activeFilter}
        searchText={searchText}
        onFilterChange={handleBillingFilterChange}
        onSearchChange={handleBillingSearchChange}
      />

      <BillingReminderQueue
        bookings={bookings}
        invoiceSettings={invoiceSettings}
        onOpenInvoice={setSelectedBooking}
        onRecordPayment={setSelectedPaymentBooking}
      />

      <BillingList
        bookings={paginatedBookings}
        invoiceSettings={invoiceSettings}
        onOpenInvoice={setSelectedBooking}
        onRecordPayment={setSelectedPaymentBooking}
        onVoidInvoice={setSelectedVoidBooking}
      />

      <PaginationControls
        label="billing"
        page={billingPage}
        pageSize={ADMIN_LIST_PAGE_SIZE}
        totalItems={filteredBookings.length}
        onPageChange={setBillingPage}
      />

      <InvoiceModal
        booking={selectedBooking}
        invoiceSettings={invoiceSettings}
        onClose={() => setSelectedBooking(null)}
        onPrint={printInvoice}
        onRecordPayment={setSelectedPaymentBooking}
        onShare={shareInvoice}
        onVoidInvoice={setSelectedVoidBooking}
      />

      <PaymentRecordModal
        key={selectedPaymentBooking?.id || 'empty-payment'}
        booking={selectedPaymentBooking}
        onClose={() => setSelectedPaymentBooking(null)}
        onSubmit={recordPayment}
      />

      <VoidInvoiceModal
        key={selectedVoidBooking?.id || 'empty-void'}
        booking={selectedVoidBooking}
        onClose={() => setSelectedVoidBooking(null)}
        onSubmit={voidInvoice}
      />

      {toast ? (
        <aside className="schedule-toast is-warning" role="status" aria-live="polite">
          <span className="schedule-toast-orb" aria-hidden="true" />
          <span className="schedule-toast-copy">
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </span>
          <button
            aria-label="Tutup notifikasi"
            className="schedule-toast-close"
            type="button"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </aside>
      ) : null}
    </section>
  );
}
