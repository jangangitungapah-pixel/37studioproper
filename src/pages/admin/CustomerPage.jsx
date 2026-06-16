import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Mail,
  Music2,
  Phone,
  PhoneCall,
  Pencil,
  Plus,
  Search,
  Tag,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import StudioTextField from '../../components/ui/StudioTextField.jsx';
import { adminBookingRepository } from '../../services/adminBookingRepository.js';

const MANUAL_CUSTOMERS_STORAGE_KEY = '37musicstudio.customers.manual.v1';
const MANUAL_CUSTOMERS_EVENT = 'customer-manual-change';

const emptyCustomerForm = {
  name: '',
  phone: '',
  email: '',
  instagram: '',
  notes: '',
  followUpStatus: 'normal',
};

const filterOptions = [
  { key: 'all', label: 'Semua' },
  { key: 'unpaid', label: 'Pending / DP' },
  { key: 'paid', label: 'Sudah Lunas' },
  { key: 'recording', label: 'Recording' },
  { key: 'rehearsal', label: 'Latihan' },
  { key: 'duplicate', label: 'Nomor Ganda' },
];

const customerStatusOptions = [
  { key: 'normal', label: 'Normal', description: 'Tidak ada catatan khusus' },
  { key: 'follow-up', label: 'Follow-up', description: 'Perlu dihubungi lagi' },
  { key: 'vip', label: 'VIP / Loyal', description: 'Customer aktif dan potensial' },
  { key: 'watchlist', label: 'Perlu perhatian', description: 'Pantau sebelum booking berikutnya' },
];

function cleanText(value) {
  return String(value || '').trim();
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (!digits) return '';

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;

  return digits;
}

function formatPhoneLabel(value) {
  const phoneKey = normalizePhone(value);

  if (!phoneKey) return '-';

  if (phoneKey.startsWith('62')) {
    return ('0' + phoneKey.slice(2)).replace(/(\d{4})(\d{4})(\d+)/, '$1 $2 $3');
  }

  return phoneKey;
}

function hashString(value) {
  let hash = 0;
  const text = String(value || '');

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function slugName(value) {
  return cleanLower(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'customer';
}

function makeCustomerId(phoneKey, name, salt) {
  return 'cust_' + hashString((phoneKey || 'no-phone') + '|' + slugName(name) + '|' + cleanText(salt));
}

function getBookingStatus(booking) {
  return cleanLower(booking.paymentStatus || booking.status || 'pending');
}

function getBookingName(booking) {
  return cleanText(booking.customer || booking.name || 'Customer');
}

function getBookingBand(booking) {
  return cleanText(booking.bandName || booking.title || booking.sessionLabel || 'Tanpa nama band');
}

function isRecordingBooking(booking) {
  const haystack = [
    booking.sessionType,
    booking.sessionLabel,
    booking.recordingTypeLabel,
    booking.packageLabel,
    booking.title,
  ].map(cleanLower).join(' ');

  return haystack.includes('recording') || haystack.includes('rekam');
}

function isRehearsalBooking(booking) {
  const haystack = [
    booking.sessionType,
    booking.sessionLabel,
    booking.packageLabel,
    booking.title,
  ].map(cleanLower).join(' ');

  return haystack.includes('rehearsal') || haystack.includes('latihan');
}

function getDateValue(value) {
  const date = new Date(String(value || '').includes('T') ? value : String(value || '') + 'T00:00:00');

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
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

function formatMoney(value) {
  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Math.max(0, Number(value) || 0));
}

function WhatsAppIcon({ size = 15 }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.2 20.1l1.08-3.94A8.35 8.35 0 1 1 12.48 20a8.26 8.26 0 0 1-3.98-1.02L4.2 20.1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.85"
      />
      <path
        d="M9.16 8.15c-.18-.4-.37-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2.01 0 1.18.86 2.32.98 2.48.12.16 1.68 2.7 4.17 3.67 2.07.8 2.49.64 2.94.6.45-.04 1.45-.59 1.66-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28-.24-.12-1.45-.72-1.68-.8-.22-.08-.39-.12-.55.12-.16.24-.63.8-.77.96-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.52-1.3-.8-1.78Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getCustomerActionLinks(customer) {
  const phoneKey = normalizePhone(customer?.phone || customer?.phoneKey);

  return {
    callHref: phoneKey ? 'tel:+' + phoneKey : '',
    whatsappHref: phoneKey ? 'https://wa.me/' + phoneKey : '',
  };
}

function getFollowUpLabel(status) {
  return customerStatusOptions.find((item) => item.key === status)?.label || 'Normal';
}

function readManualCustomers() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(MANUAL_CUSTOMERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeManualCustomers(customers) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(MANUAL_CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
  window.dispatchEvent(new Event(MANUAL_CUSTOMERS_EVENT));
}

function subscribeManualCustomers(callback) {
  if (typeof window === 'undefined') return () => {};

  function handleChange() {
    callback(readManualCustomers());
  }

  callback(readManualCustomers());
  window.addEventListener(MANUAL_CUSTOMERS_EVENT, handleChange);
  window.addEventListener('storage', handleChange);

  return () => {
    window.removeEventListener(MANUAL_CUSTOMERS_EVENT, handleChange);
    window.removeEventListener('storage', handleChange);
  };
}

function buildCustomerDirectory(bookings, manualCustomers) {
  const map = new Map();

  function ensureCustomer(seed) {
    const phoneKey = normalizePhone(seed.phone || seed.phoneKey);
    const name = cleanText(seed.name || seed.customer || 'Customer');
    const id = seed.id || makeCustomerId(phoneKey, name, seed.createdAt || '');

    if (!map.has(id)) {
      map.set(id, {
        id,
        name,
        phone: seed.phone || phoneKey,
        phoneKey,
        email: cleanText(seed.email),
        instagram: cleanText(seed.instagram).replace(/^@+/, ''),
        source: seed.source || 'booking',
        notes: cleanText(seed.notes),
        followUpStatus: seed.followUpStatus || 'normal',
        aliases: new Set(name ? [name] : []),
        bookings: [],
        bookingIds: new Set(),
        bands: new Map(),
        totalBookings: 0,
        paidBookings: 0,
        pendingBookings: 0,
        dpBookings: 0,
        recordingBookings: 0,
        rehearsalBookings: 0,
        otherBookings: 0,
        openInvoiceAmount: 0,
        totalPaidValue: 0,
        latestActivityAt: '',
        latestActivityValue: 0,
      });
    }

    return map.get(id);
  }

  manualCustomers.forEach((customer) => {
    ensureCustomer({
      ...customer,
      id: customer.id || makeCustomerId(normalizePhone(customer.phone), customer.name, customer.createdAt),
      source: 'manual',
    });
  });

  bookings.forEach((booking) => {
    const phoneKey = normalizePhone(booking.phone);
    const customerName = getBookingName(booking);
    const fallbackId = makeCustomerId(phoneKey, customerName, '');
    const customer = ensureCustomer({
      id: booking.customerId || fallbackId,
      name: customerName,
      phone: booking.phone,
      phoneKey,
      source: 'booking',
    });

    const status = getBookingStatus(booking);
    const bandName = getBookingBand(booking);
    const dateValue = getDateValue(booking.date || booking.createdAt);

    customer.aliases.add(customerName);
    customer.bookings.push(booking);
    customer.bookingIds.add(booking.id || booking.createdAt || String(customer.totalBookings + 1));
    customer.totalBookings += 1;
    customer.bands.set(bandName, (customer.bands.get(bandName) || 0) + 1);

    if (status === 'lunas') {
      customer.paidBookings += 1;
      customer.totalPaidValue += Number(booking.total || booking.subtotal || 0) || 0;
    }

    if (status === 'pending') {
      customer.pendingBookings += 1;
      customer.openInvoiceAmount += Number(booking.invoiceAmount || booking.total || 0) || 0;
    }

    if (status === 'dp') {
      customer.dpBookings += 1;
      customer.openInvoiceAmount += Number(booking.invoiceAmount || 0) || 0;
    }

    if (isRecordingBooking(booking)) {
      customer.recordingBookings += 1;
    } else if (isRehearsalBooking(booking)) {
      customer.rehearsalBookings += 1;
    } else {
      customer.otherBookings += 1;
    }

    if (dateValue >= customer.latestActivityValue) {
      customer.latestActivityValue = dateValue;
      customer.latestActivityAt = booking.date || booking.createdAt || '';
    }
  });

  const customers = Array.from(map.values()).map((customer) => {
    const aliases = Array.from(customer.aliases).filter(Boolean);
    const bands = Array.from(customer.bands.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));

    return {
      ...customer,
      aliases,
      aliasLabel: aliases.length > 1 ? aliases.join(', ') : '',
      bands,
      bookings: customer.bookings.slice().sort((first, second) => getDateValue(second.date || second.createdAt) - getDateValue(first.date || first.createdAt)),
      bookingIds: Array.from(customer.bookingIds),
      hasOpenPayment: customer.pendingBookings > 0 || customer.dpBookings > 0,
      notes: cleanText(customer.notes),
      followUpStatus: customer.followUpStatus || 'normal',
    };
  });

  const phoneCounts = customers.reduce((counts, customer) => {
    if (!customer.phoneKey) return counts;
    counts[customer.phoneKey] = (counts[customer.phoneKey] || 0) + 1;
    return counts;
  }, {});

  return customers
    .map((customer) => ({
      ...customer,
      hasDuplicatePhone: customer.phoneKey ? phoneCounts[customer.phoneKey] > 1 : false,
    }))
    .sort((first, second) => {
      if (second.latestActivityValue !== first.latestActivityValue) return second.latestActivityValue - first.latestActivityValue;
      if (second.totalBookings !== first.totalBookings) return second.totalBookings - first.totalBookings;
      return first.name.localeCompare(second.name);
    });
}

function getTopCustomer(customers) {
  return customers
    .filter((customer) => customer.paidBookings > 0)
    .slice()
    .sort((first, second) => {
      if (second.paidBookings !== first.paidBookings) return second.paidBookings - first.paidBookings;
      if (second.totalBookings !== first.totalBookings) return second.totalBookings - first.totalBookings;
      return second.totalPaidValue - first.totalPaidValue;
    })[0] || null;
}

function getCustomerRouteId(pathname) {
  const prefix = '/admin/customers/';
  if (!pathname.startsWith(prefix)) return '';

  return decodeURIComponent(pathname.slice(prefix.length));
}

function getCustomerStatusLabel(customer) {
  if (customer.hasOpenPayment) return 'Perlu follow-up';
  if (customer.followUpStatus === 'follow-up') return 'Follow-up';
  if (customer.followUpStatus === 'vip') return 'VIP';
  if (customer.followUpStatus === 'watchlist') return 'Perlu perhatian';
  if (customer.paidBookings) return 'Lunas';
  return 'Normal';
}

function getCustomerStatusClass(customer) {
  if (customer.hasOpenPayment || customer.followUpStatus === 'follow-up' || customer.followUpStatus === 'watchlist') return 'is-warning';
  if (customer.followUpStatus === 'vip' || customer.paidBookings) return 'is-paid';
  return 'is-neutral';
}

function CustomerHero({ customers }) {
  const topCustomer = getTopCustomer(customers);
  const followUpCustomers = customers.filter((customer) => customer.hasOpenPayment);
  const openAmount = followUpCustomers.reduce((sum, customer) => sum + customer.openInvoiceAmount, 0);

  return (
    <section className="customer-hero-grid" aria-label="Ringkasan customer">
      <article className="customer-hero-card">
        <span className="customer-hero-icon"><UsersRound size={18} /></span>
        <span className="customer-hero-copy">
          <small>Jumlah Customer</small>
          <strong>{customers.length}</strong>
          <em>Database aktif studio</em>
        </span>
      </article>

      <article className="customer-hero-card">
        <span className="customer-hero-icon"><Trophy size={18} /></span>
        <span className="customer-hero-copy">
          <small>Top Customer</small>
          <strong>{topCustomer ? topCustomer.name : '-'}</strong>
          <em>{topCustomer ? topCustomer.paidBookings + ' booking lunas' : 'Belum ada data lunas'}</em>
        </span>
      </article>

      <article className="customer-hero-card">
        <span className="customer-hero-icon"><CreditCard size={18} /></span>
        <span className="customer-hero-copy">
          <small>Perlu Follow-up</small>
          <strong>{followUpCustomers.length}</strong>
          <em>{openAmount ? formatMoney(openAmount) + ' outstanding' : 'Tidak ada pending / DP'}</em>
        </span>
      </article>
    </section>
  );
}

function CustomerFormModal({ customers, editingCustomer, isOpen, onClose }) {
  const [form, setForm] = useState(emptyCustomerForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;

    const resetFrameId = window.requestAnimationFrame(() => {
      setForm({
        ...emptyCustomerForm,
        name: editingCustomer?.name || '',
        phone: editingCustomer?.phone || '',
        email: editingCustomer?.email || '',
        instagram: editingCustomer?.instagram || '',
        notes: editingCustomer?.notes || '',
        followUpStatus: editingCustomer?.followUpStatus || 'normal',
      });
      setError('');
    });

    return () => {
      window.cancelAnimationFrame(resetFrameId);
    };
  }, [editingCustomer, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) onClose();
  }

  function handleSubmit(event) {
    event.preventDefault();

    const cleanName = form.name.trim();
    const cleanPhone = form.phone.trim();
    const phoneKey = normalizePhone(cleanPhone);

    if (!cleanName || !phoneKey) {
      setError('Nama dan nomor telepon wajib diisi.');
      return;
    }

    const samePhoneCustomers = customers.filter((customer) => customer.phoneKey === phoneKey && customer.id !== editingCustomer?.id);
    const exactCustomer = samePhoneCustomers.find((customer) => cleanLower(customer.name) === cleanLower(cleanName));
    let customerId = editingCustomer?.id || exactCustomer?.id || makeCustomerId(phoneKey, cleanName, Date.now());

    if (!editingCustomer && !exactCustomer && samePhoneCustomers.length) {
      const shouldMerge = window.confirm(
        'Nomor WA ini sudah terdaftar atas nama ' +
          samePhoneCustomers[0].name +
          '.\n\nOK = update/gabung ke customer lama.\nCancel = buat customer baru dengan nomor yang sama.'
      );

      customerId = shouldMerge ? samePhoneCustomers[0].id : customerId;
    }

    const current = readManualCustomers();
    const nextCustomer = {
      id: customerId,
      name: cleanName,
      phone: cleanPhone,
      phoneKey,
      email: form.email.trim(),
      instagram: form.instagram.trim().replace(/^@+/, ''),
      notes: form.notes.trim(),
      followUpStatus: form.followUpStatus || 'normal',
      createdAt: editingCustomer?.createdAt || exactCustomer?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const exists = current.some((item) => item.id === customerId);
    const next = exists
      ? current.map((item) => (item.id === customerId ? { ...item, ...nextCustomer, createdAt: item.createdAt || nextCustomer.createdAt } : item))
      : [nextCustomer, ...current];

    writeManualCustomers(next);
    onClose();
  }

  return (
    <div className="customer-modal-backdrop" role="presentation" onMouseDown={handleBackdropClick}>
      <section className="customer-modal-panel" role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
        <header className="customer-modal-head">
          <div>
            <p>Customer Form</p>
            <h2 id="customer-form-title">{editingCustomer ? 'Edit Customer' : 'Tambah Customer'}</h2>
          </div>

          <button className="booking-modal-close" type="button" aria-label="Tutup form customer" onClick={onClose}>
            ×
          </button>
        </header>

        <form className="customer-form" onSubmit={handleSubmit} noValidate>
          <div className="customer-form-grid">
            <StudioTextField
              autoComplete="name"
              icon={UserRound}
              id="customer-name"
              label="Nama"
              placeholder="Nama customer"
              required
              value={form.name}
              onChange={updateField('name')}
            />

            <StudioTextField
              autoComplete="tel"
              icon={Phone}
              id="customer-phone"
              inputMode="tel"
              label="Nomor Telepon"
              placeholder="08xxxxxxxxxx"
              required
              value={form.phone}
              onChange={updateField('phone')}
            />

            <StudioTextField
              autoComplete="email"
              icon={Mail}
              id="customer-email"
              label="Email"
              placeholder="Opsional"
              type="email"
              value={form.email}
              onChange={updateField('email')}
            />

            <StudioTextField
              icon={Tag}
              id="customer-instagram"
              label="Instagram"
              placeholder="Opsional"
              value={form.instagram}
              onChange={updateField('instagram')}
            />

            <div className="customer-form-select">
              <StudioSelect
                label="Status"
                options={customerStatusOptions}
                selectedKey={form.followUpStatus}
                onChange={updateValue('followUpStatus')}
              />
            </div>

            <label className="customer-note-field" htmlFor="customer-notes">
              <span className="studio-field-head">
                <span>Catatan</span>
                <span className="studio-field-helper">Opsional</span>
              </span>
              <textarea
                id="customer-notes"
                placeholder="Contoh: sering booking malam, perlu follow-up DP, prefer studio A..."
                value={form.notes}
                onChange={updateField('notes')}
              />
            </label>
          </div>

          {error ? <p className="booking-form-error" role="alert">{error}</p> : null}

          <footer className="booking-form-actions">
            <button className="booking-button is-secondary" type="button" onClick={onClose}>Batal</button>
            <button className="booking-button is-primary" type="submit">{editingCustomer ? 'Update Customer' : 'Simpan Customer'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}


function CustomerToolbar({ activeFilter, onAddCustomer, onFilterChange, onSearchChange, searchText }) {
  return (
    <section className="customer-toolbar" aria-label="Customer toolbar">
      <div className="customer-search-shell">
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="Cari customer"
          placeholder="Cari nama, nomor, band..."
          type="search"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="customer-filter-studio-select">
        <StudioSelect
          label="Filter"
          options={filterOptions}
          selectedKey={activeFilter}
          onChange={onFilterChange}
        />
      </div>

      <button className="customer-add-button" type="button" onClick={onAddCustomer}>
        <Plus size={16} />
        Customer
      </button>
    </section>
  );
}

function CustomerTable({ customers, onEditCustomer, onOpenCustomer }) {
  if (!customers.length) {
    return (
      <section className="customer-empty-state">
        <UsersRound size={24} />
        <strong>Belum ada customer</strong>
        <span>Customer otomatis muncul dari booking baru atau bisa ditambahkan manual.</span>
      </section>
    );
  }

  return (
    <section className="customer-table-shell" aria-label="Customer table">
      <div className="customer-table-head">
        <span>Customer</span>
        <span>Kontak</span>
        <span>Booking</span>
        <span>Status</span>
        <span>Terakhir</span>
      </div>

      <div className="customer-table-body">
        {customers.map((customer) => {
          const topBand = customer.bands[0];
          const links = getCustomerActionLinks(customer);

          return (
            <article className="customer-table-row" key={customer.id}>
              <button className="customer-row-main-button" type="button" onClick={() => onOpenCustomer(customer)}>
                <span className="customer-main-cell">
                  <strong>{customer.name}</strong>
                  <small>{topBand ? topBand.name + ' • ' + topBand.count + 'x' : customer.aliasLabel || getFollowUpLabel(customer.followUpStatus)}</small>
                  {customer.hasDuplicatePhone ? <em>Nomor WA ganda</em> : null}
                </span>

                <span className="customer-contact-cell">
                  <strong>{formatPhoneLabel(customer.phone || customer.phoneKey)}</strong>
                  <small>{customer.email || customer.instagram || '-'}</small>
                </span>

                <span className="customer-number-cell">
                  <strong>{customer.totalBookings}</strong>
                  <small>{customer.paidBookings} lunas</small>
                </span>

                <span className={'customer-status-pill ' + getCustomerStatusClass(customer)}>
                  {getCustomerStatusLabel(customer)}
                </span>

                <span className="customer-date-cell">{formatDate(customer.latestActivityAt)}</span>
              </button>

              <span className="customer-row-actions" aria-label={'Aksi customer ' + customer.name}>
                {links.whatsappHref ? (
                  <a
                    aria-label={'Chat WhatsApp ' + customer.name}
                    href={links.whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    title="WhatsApp"
                  >
                    <WhatsAppIcon size={15} />
                  </a>
                ) : null}

                {links.callHref ? (
                  <a aria-label={'Telepon ' + customer.name} href={links.callHref} title="Telepon">
                    <PhoneCall size={15} />
                  </a>
                ) : null}

                <button
                  aria-label={'Edit customer ' + customer.name}
                  title="Edit customer"
                  type="button"
                  onClick={() => onEditCustomer(customer)}
                >
                  <Pencil size={15} />
                </button>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}


function CustomerDetail({ customer, customers, onBack, onEditCustomer, onMergeDuplicate, onOpenCustomer }) {
  if (!customer) {
    return (
      <section className="customer-empty-state">
        <AlertCircle size={24} />
        <strong>Customer tidak ditemukan</strong>
        <span>Data mungkin belum tersinkron atau sudah berubah.</span>
        <button className="customer-add-button" type="button" onClick={onBack}>Kembali</button>
      </section>
    );
  }

  const topBand = customer.bands[0];
  const links = getCustomerActionLinks(customer);
  const duplicateCustomers = customers.filter((item) => item.id !== customer.id && item.phoneKey && item.phoneKey === customer.phoneKey);
  const openBookings = customer.bookings.filter((booking) => {
    const status = getBookingStatus(booking);
    return status === 'pending' || status === 'dp';
  });

  return (
    <section className="customer-detail-page" aria-labelledby="customer-detail-title">
      <button className="customer-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Kembali
      </button>

      <section className="customer-detail-hero">
        <div className="customer-detail-avatar" aria-hidden="true">
          <UserRound size={28} />
        </div>

        <div className="customer-detail-title">
          <p>Detail Customer</p>
          <h2 id="customer-detail-title">{customer.name}</h2>
          <span>{formatPhoneLabel(customer.phone || customer.phoneKey)}</span>
        </div>

        <span className={'customer-status-pill ' + getCustomerStatusClass(customer)}>
          {getCustomerStatusLabel(customer)}
        </span>
      </section>

      <section className="customer-action-bar" aria-label="Aksi customer">
        {links.whatsappHref ? (
          <a
            aria-label={'Chat WhatsApp ' + customer.name}
            className="customer-action-button is-primary"
            href={links.whatsappHref}
            target="_blank"
            rel="noreferrer"
            title="WhatsApp"
          >
            <WhatsAppIcon size={16} />
          </a>
        ) : null}

        {links.callHref ? (
          <a
            aria-label={'Telepon ' + customer.name}
            className="customer-action-button"
            href={links.callHref}
            title="Telepon"
          >
            <PhoneCall size={16} />
          </a>
        ) : null}

        <button
            aria-label={'Edit customer ' + customer.name}
            className="customer-action-button"
            title="Edit customer"
            type="button"
            onClick={() => onEditCustomer(customer)}
          >
            <Pencil size={16} />
          </button>
      </section>

      {customer.notes ? (
        <section className="customer-note-card">
          <strong>Catatan</strong>
          <p>{customer.notes}</p>
        </section>
      ) : null}

      {customer.hasOpenPayment ? (
        <section className="customer-payment-alert" role="status">
          <AlertCircle size={18} />
          <span>
            Masih ada {openBookings.length} booking pending/DP • {formatMoney(customer.openInvoiceAmount)} outstanding.
          </span>
        </section>
      ) : null}

      {duplicateCustomers.length ? (
        <section className="customer-detail-card customer-duplicate-card">
          <header><AlertCircle size={16} /><span>Kemungkinan Duplicate</span></header>

          <div className="customer-duplicate-list">
            {duplicateCustomers.map((duplicate) => (
              <span className="customer-duplicate-item" key={duplicate.id}>
                <button type="button" onClick={() => onOpenCustomer(duplicate)}>
                  <strong>{duplicate.name}</strong>
                  <small>{duplicate.totalBookings} booking • {formatPhoneLabel(duplicate.phone || duplicate.phoneKey)}</small>
                </button>

                <button type="button" onClick={() => onMergeDuplicate(duplicate, customer)}>
                  Merge
                </button>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="customer-detail-stat-grid">
        <article><small>Total Booking</small><strong>{customer.totalBookings}</strong></article>
        <article><small>Booking Lunas</small><strong>{customer.paidBookings}</strong></article>
        <article><small>Recording</small><strong>{customer.recordingBookings}</strong></article>
        <article><small>Latihan</small><strong>{customer.rehearsalBookings}</strong></article>
      </section>

      <section className="customer-detail-grid">
        <article className="customer-detail-card">
          <header><Music2 size={16} /><span>Breakdown Band / Project</span></header>
          <div className="customer-band-list">
            {customer.bands.length ? customer.bands.map((band) => (
              <span className="customer-band-chip" key={band.name}>
                <strong>{band.name}</strong>
                <em>{band.count}x</em>
              </span>
            )) : <p>Belum ada data band.</p>}
          </div>
        </article>

        <article className="customer-detail-card">
          <header><CalendarDays size={16} /><span>Recent Activity</span></header>
          <div className="customer-activity-list">
            {customer.bookings.length ? customer.bookings.slice(0, 8).map((booking) => {
              const status = getBookingStatus(booking);

              return (
                <span className="customer-activity-item" key={booking.id || booking.createdAt}>
                  <b>{booking.bandName || booking.title || booking.sessionLabel || 'Booking'}</b>
                  <small>{formatDate(booking.date)} • {booking.sessionLabel || booking.packageLabel || 'Session'}</small>
                  <em className={'customer-mini-status is-' + status}>{status}</em>
                </span>
              );
            }) : <p>Belum ada activity booking.</p>}
          </div>
        </article>

        <article className="customer-detail-card">
          <header><Phone size={16} /><span>Kontak</span></header>
          <div className="customer-contact-list">
            <span><small>Nomor WA</small><strong>{formatPhoneLabel(customer.phone || customer.phoneKey)}</strong></span>
            <span><small>Email</small><strong>{customer.email || '-'}</strong></span>
            <span><small>Instagram</small><strong>{customer.instagram ? '@' + customer.instagram : '-'}</strong></span>
            <span><small>Status</small><strong>{getFollowUpLabel(customer.followUpStatus)}</strong></span>
          </div>
        </article>

        <article className="customer-detail-card">
          <header><CreditCard size={16} /><span>Status Pembayaran</span></header>
          <div className="customer-contact-list">
            <span><small>Pending</small><strong>{customer.pendingBookings}</strong></span>
            <span><small>DP</small><strong>{customer.dpBookings}</strong></span>
            <span><small>Outstanding</small><strong>{formatMoney(customer.openInvoiceAmount)}</strong></span>
            <span><small>Band paling sering</small><strong>{topBand ? topBand.name + ' (' + topBand.count + 'x)' : '-'}</strong></span>
          </div>
        </article>
      </section>
    </section>
  );
}


export default function CustomerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [manualCustomers, setManualCustomers] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => subscribeManualCustomers(setManualCustomers), []);

  useEffect(() => {
    const unsubscribe = adminBookingRepository.subscribeManualBookings(
      (data) => setBookings(data),
      (error) => {
        console.error('Gagal memuat booking untuk customer page:', error);
        setToast({
          title: 'Booking belum tersinkron',
          message: 'Customer manual tetap bisa dipakai, tapi activity booking belum termuat.',
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

  const customers = useMemo(
    () => buildCustomerDirectory(bookings, manualCustomers),
    [bookings, manualCustomers]
  );

  const filteredCustomers = useMemo(() => {
    const queryText = searchText.trim().toLowerCase();

    return customers.filter((customer) => {
      const haystack = [
        customer.name,
        customer.phone,
        customer.phoneKey,
        customer.email,
        customer.instagram,
        customer.aliasLabel,
        ...customer.bands.map((band) => band.name),
      ].join(' ').toLowerCase();

      const matchesSearch = !queryText || haystack.includes(queryText);
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'unpaid' && customer.hasOpenPayment) ||
        (activeFilter === 'paid' && customer.paidBookings > 0) ||
        (activeFilter === 'recording' && customer.recordingBookings > 0) ||
        (activeFilter === 'rehearsal' && customer.rehearsalBookings > 0) ||
        (activeFilter === 'duplicate' && customer.hasDuplicatePhone);

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, customers, searchText]);

  const detailId = getCustomerRouteId(location.pathname);
  const selectedCustomer = detailId ? customers.find((customer) => customer.id === detailId) : null;

  function openCustomerForm(customer = null) {
    setEditingCustomer(customer);
    setIsCustomerModalOpen(true);
  }

  function closeCustomerForm() {
    setIsCustomerModalOpen(false);
    setEditingCustomer(null);
  }

  function openCustomer(customer) {
    navigate('/admin/customers/' + encodeURIComponent(customer.id));
  }

  async function mergeDuplicateCustomer(sourceCustomer, targetCustomer) {
    const confirmed = window.confirm(
      'Gabungkan record ' +
        sourceCustomer.name +
        ' ke ' +
        targetCustomer.name +
        '?\\n\\nBooking milik duplicate akan diarahkan ke customer ini.'
    );

    if (!confirmed) return;

    try {
      const updatedAt = new Date().toISOString();

      await Promise.all(
        sourceCustomer.bookings.map((booking) =>
          adminBookingRepository.updateManualBooking({
            ...booking,
            customerId: targetCustomer.id,
            customerPhoneKey: targetCustomer.phoneKey,
            updatedAt,
          })
        )
      );

      const nextManualCustomers = readManualCustomers().filter((item) => item.id !== sourceCustomer.id);
      writeManualCustomers(nextManualCustomers);

      setToast({
        title: 'Duplicate digabung',
        message: sourceCustomer.name + ' sudah diarahkan ke ' + targetCustomer.name + '.',
      });
    } catch (error) {
      console.error('Gagal merge duplicate customer:', error);
      setToast({
        title: 'Merge gagal',
        message: 'Gagal menggabungkan duplicate customer. Coba ulangi lagi.',
      });
    }
  }

  if (detailId) {
    return (
      <CustomerDetail
        customer={selectedCustomer}
        customers={customers}
        onBack={() => navigate('/admin/customers')}
        onEditCustomer={openCustomerForm}
        onMergeDuplicate={mergeDuplicateCustomer}
        onOpenCustomer={openCustomer}
      />
    );
  }

  return (
    <section className="customer-page" aria-labelledby="customer-page-title">
      <div className="customer-page-title">
        <p>Customer CRM</p>
        <h2 id="customer-page-title">Customer</h2>
      </div>

      <CustomerHero customers={customers} />

      <CustomerToolbar
        activeFilter={activeFilter}
        searchText={searchText}
        onAddCustomer={() => openCustomerForm()}
        onFilterChange={setActiveFilter}
        onSearchChange={setSearchText}
      />

      <CustomerTable
        customers={filteredCustomers}
        onEditCustomer={openCustomerForm}
        onOpenCustomer={openCustomer}
      />

      <CustomerFormModal
        customers={customers}
        editingCustomer={editingCustomer}
        isOpen={isCustomerModalOpen}
        onClose={closeCustomerForm}
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
