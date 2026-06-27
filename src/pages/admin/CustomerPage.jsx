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
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import StudioTextField from '../../components/ui/StudioTextField.jsx';
import PaginationControls from '../../components/ui/PaginationControls.jsx';
import { ADMIN_LIST_PAGE_SIZE, getPaginationSlice } from '../../utils/pagination.js';
import { adminBookingRepository } from '../../services/adminBookingRepository.js';
import { adminCustomerRepository } from '../../services/adminCustomerRepository.js';

const MANUAL_CUSTOMERS_STORAGE_KEY = '37musicstudio.customers.manual.v1';

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

const activityFilterOptions = [
  { key: 'all', label: 'Semua', description: 'Semua aktivitas booking' },
  { key: 'rehearsal', label: 'Latihan', description: 'Aktivitas rehearsal' },
  { key: 'recording', label: 'Recording', description: 'Aktivitas recording' },
  { key: 'pending', label: 'Pending', description: 'Booking belum dibayar' },
  { key: 'dp', label: 'DP', description: 'Booking sudah DP' },
  { key: 'lunas', label: 'Lunas', description: 'Booking sudah lunas' },
];

const followUpFilterOptions = [
  { key: 'all', label: 'Semua', description: 'Semua customer yang perlu perhatian' },
  { key: 'unpaid', label: 'Pending / DP', description: 'Ada tagihan outstanding' },
  { key: 'pending', label: 'Pending', description: 'Belum ada pembayaran' },
  { key: 'dp', label: 'DP', description: 'Sudah DP tapi belum lunas' },
  { key: 'manual', label: 'Manual Follow-up', description: 'Ditandai follow-up / watchlist' },
  { key: 'duplicate', label: 'Nomor Ganda', description: 'Nomor WA terduplikasi' },
  { key: 'idle', label: 'Lama Tidak Booking', description: 'Tidak ada activity lebih dari 30 hari' },
];

const followUpTemplateOptions = [
  { key: 'payment', label: 'Tagihan / DP', description: 'Template untuk pending atau DP' },
  { key: 'booking', label: 'Follow-up Booking', description: 'Template ajakan booking ulang' },
  { key: 'comeback', label: 'Comeback', description: 'Template customer lama' },
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

// Check recording type
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

// Check rehearsal type
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

function getBookingActivityKind(booking) {
  if (isRecordingBooking(booking)) return 'recording';
  if (isRehearsalBooking(booking)) return 'rehearsal';

  return 'other';
}

function getBookingActivityKindLabel(booking) {
  const kind = getBookingActivityKind(booking);

  if (kind === 'recording') return 'Recording';
  if (kind === 'rehearsal') return 'Latihan';

  return 'Session';
}

function getBookingTimeLabel(booking) {
  const rawHour = booking?.startHour || booking?.hour || '';

  if (!rawHour) return 'Jam belum diisi';

  const numericHour = Number(rawHour);
  const hourLabel = Number.isFinite(numericHour)
    ? String(numericHour).padStart(2, '0') + ':00'
    : String(rawHour);

  const duration = Number(booking?.duration || booking?.customDuration || 0);

  if (!duration) return hourLabel;

  return hourLabel + ' • ' + duration + ' jam';
}

function getBookingPriceLabel(booking) {
  const value = Number(booking?.invoiceAmount || booking?.total || booking?.subtotal || 0);

  return value > 0 ? formatMoney(value) : '-';
}

function getBookingActivityId(booking, index) {
  return booking?.id || [
    booking?.date || 'no-date',
    booking?.bandName || booking?.title || 'activity',
    index,
  ].join('-');
}

function getBookingMonthLabel(booking) {
  const rawDate = booking?.date || booking?.createdAt || '';
  const date = new Date(String(rawDate).includes('T') ? rawDate : String(rawDate) + 'T00:00:00');

  if (Number.isNaN(date.getTime())) return 'Tanpa tanggal';

  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function filterCustomerActivities(bookings = [], activeFilter = 'all') {
  return bookings.filter((booking) => {
    const status = getBookingStatus(booking);
    const kind = getBookingActivityKind(booking);

    if (activeFilter === 'all') return true;
    if (activeFilter === 'recording') return kind === 'recording';
    if (activeFilter === 'rehearsal') return kind === 'rehearsal';

    return status === activeFilter;
  });
}

function groupCustomerActivities(bookings = []) {
  return bookings.reduce((groups, booking, index) => {
    const monthLabel = getBookingMonthLabel(booking);
    const currentGroup = groups[groups.length - 1];

    if (!currentGroup || currentGroup.label !== monthLabel) {
      groups.push({
        label: monthLabel,
        items: [],
      });
    }

    groups[groups.length - 1].items.push({
      booking,
      id: getBookingActivityId(booking, index),
    });

    return groups;
  }, []);
}

function isCustomerIdle(customer) {
  if (!customer?.latestActivityValue || !customer?.totalBookings) return false;

  const dayMs = 24 * 60 * 60 * 1000;
  return Date.now() - customer.latestActivityValue > 30 * dayMs;
}

function getCustomerListTone(customer) {
  if (customer.hasOpenPayment || customer.followUpStatus === 'watchlist') return 'is-warning';
  if (customer.followUpStatus === 'vip' || customer.paidBookings > 0) return 'is-paid';
  if (customer.hasDuplicatePhone) return 'is-duplicate';
  if (isCustomerIdle(customer)) return 'is-idle';

  return 'is-neutral';
}

function getCustomerFollowUpScore(customer) {
  let score = 0;

  if (customer.pendingBookings > 0) score += 80;
  if (customer.dpBookings > 0) score += 64;
  if (customer.openInvoiceAmount > 0) score += Math.min(40, Math.floor(customer.openInvoiceAmount / 50000));
  if (customer.followUpStatus === 'watchlist') score += 48;
  if (customer.followUpStatus === 'follow-up') score += 42;
  if (customer.hasDuplicatePhone) score += 24;
  if (isCustomerIdle(customer)) score += 18;

  return score;
}

function matchesCustomerFollowUpFilter(customer, activeFilter) {
  if (activeFilter === 'all') {
    return (
      customer.hasOpenPayment ||
      customer.followUpStatus === 'follow-up' ||
      customer.followUpStatus === 'watchlist' ||
      customer.hasDuplicatePhone ||
      isCustomerIdle(customer)
    );
  }

  if (activeFilter === 'unpaid') return customer.hasOpenPayment;
  if (activeFilter === 'pending') return customer.pendingBookings > 0;
  if (activeFilter === 'dp') return customer.dpBookings > 0;
  if (activeFilter === 'manual') return customer.followUpStatus === 'follow-up' || customer.followUpStatus === 'watchlist';
  if (activeFilter === 'duplicate') return customer.hasDuplicatePhone;
  if (activeFilter === 'idle') return isCustomerIdle(customer);

  return false;
}

function getCustomerFollowUpCandidates(customers, activeFilter) {
  return customers
    .filter((customer) => matchesCustomerFollowUpFilter(customer, activeFilter))
    .slice()
    .sort((first, second) => {
      const scoreDiff = getCustomerFollowUpScore(second) - getCustomerFollowUpScore(first);
      if (scoreDiff) return scoreDiff;

      return second.latestActivityValue - first.latestActivityValue;
    });
}

function getCustomerFollowUpMessage(customer, templateKey) {
  const name = customer?.name || 'kak';
  const outstanding = customer?.openInvoiceAmount ? formatMoney(customer.openInvoiceAmount) : '';
  const lastActivity = customer?.latestActivityAt ? formatDate(customer.latestActivityAt) : 'sebelumnya';

  if (templateKey === 'booking') {
    return 'Halo kak ' + name + ', kami dari 37 Music Studio. Kami mau follow-up jadwal booking kakak. Kalau ingin latihan atau recording lagi, kami bisa bantu cek slot yang tersedia.';
  }

  if (templateKey === 'comeback') {
    return 'Halo kak ' + name + ', kami dari 37 Music Studio. Terakhir ada activity booking sekitar ' + lastActivity + '. Kalau mau main atau recording lagi, kami siap bantu carikan slot yang enak.';
  }

  if (customer?.hasOpenPayment) {
    return 'Halo kak ' + name + ', kami dari 37 Music Studio. Untuk data booking kakak masih ada status pending/DP' + (outstanding ? ' dengan estimasi outstanding ' + outstanding : '') + '. Boleh kami bantu follow-up pembayarannya ya kak?';
  }

  return 'Halo kak ' + name + ', kami dari 37 Music Studio. Kami mau follow-up data booking kakak. Kabari kami ya kak kalau butuh bantuan jadwal atau informasi studio.';
}

function getCustomerFollowUpWhatsappHref(customer, templateKey) {
  const links = getCustomerActionLinks(customer);
  if (!links.whatsappHref) return '';

  return links.whatsappHref + '?text=' + encodeURIComponent(getCustomerFollowUpMessage(customer, templateKey));
}

function getFollowUpOutstandingTotal(customers) {
  return customers.reduce((sum, customer) => sum + (Number(customer.openInvoiceAmount) || 0), 0);
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

/* ==========================================================================
   COMPONENT: CUSTOMER HERO (Compact Strip)
   ========================================================================== */
function CustomerHero({ customers }) {
  const topCustomer = getTopCustomer(customers);
  const followUpCustomers = customers.filter((customer) => customer.hasOpenPayment);
  const openAmount = followUpCustomers.reduce((sum, customer) => sum + customer.openInvoiceAmount, 0);

  return (
    <section className="customer-hero-strip" aria-label="Ringkasan customer">
      <div className="hero-strip-item">
        <UsersRound size={14} className="hero-strip-icon" />
        <span className="hero-strip-text">
          <strong>{customers.length}</strong> Customer
        </span>
      </div>

      <div className="hero-strip-item">
        <Trophy size={14} className="hero-strip-icon" />
        <span className="hero-strip-text">
          Top: <strong>{topCustomer ? topCustomer.name : '-'}</strong>
        </span>
      </div>

      <div className="hero-strip-item">
        <CreditCard size={14} className="hero-strip-icon" />
        <span className="hero-strip-text">
          Follow-up: <strong>{followUpCustomers.length}</strong> ({openAmount ? formatMoney(openAmount) : 'Lunas'})
        </span>
      </div>
    </section>
  );
}

/* ==========================================================================
   COMPONENT: CUSTOMER FORM MODAL
   ========================================================================== */
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

  async function handleSubmit(event) {
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

    try {
      if (editingCustomer || exactCustomer) {
        await adminCustomerRepository.updateManualCustomer(nextCustomer);
      } else {
        await adminCustomerRepository.createManualCustomer(nextCustomer);
      }
      onClose();
    } catch (err) {
      console.error('Gagal menyimpan customer ke Firestore:', err);
      setError('Gagal menyimpan data ke Firestore. Periksa koneksi internet Anda.');
    }
  }

  return (
    <div className="customer-modal-backdrop" role="presentation" onMouseDown={handleBackdropClick}>
      <section className="customer-modal-panel customer-booking-size-panel" role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
        <header className="customer-modal-head">
          <div>
            <p>Customer Form</p>
            <h2 id="customer-form-title">{editingCustomer ? 'Edit Customer' : 'Tambah Customer'}</h2>
          </div>

          <button className="booking-modal-close" type="button" aria-label="Tutup form customer" onClick={onClose}>
            <X size={18} />
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
                inlineList
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
                placeholder="Contoh: sering booking malam, prefer studio A..."
                value={form.notes}
                onChange={updateField('notes')}
              />
            </label>
          </div>

          {error ? <p className="booking-form-error" role="alert">{error}</p> : null}

          <footer className="booking-form-actions">
            <button className="booking-button is-secondary" type="button" onClick={onClose}>Batal</button>
            <button className="booking-button is-primary" type="submit">{editingCustomer ? 'Update' : 'Simpan'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

/* ==========================================================================
   COMPONENT: CUSTOMER TOOLBAR (Compact Interface)
   ========================================================================== */
function CustomerToolbar({ activeFilter, onAddCustomer, onFilterChange, onSearchChange, searchText }) {
  return (
    <section className="customer-toolbar-compact" aria-label="Customer toolbar">
      <div className="customer-search-shell-compact">
        <Search size={14} aria-hidden="true" />
        <input
          aria-label="Cari customer"
          placeholder="Cari nama, nomor, band..."
          type="search"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="customer-filter-select-compact">
        <StudioSelect
          label="Filter"
          options={filterOptions}
          selectedKey={activeFilter}
          onChange={onFilterChange}
        />
      </div>

      <button className="customer-add-btn-compact" type="button" onClick={onAddCustomer} title="Tambah Customer">
        <Plus size={16} />
      </button>
    </section>
  );
}

/* ==========================================================================
   COMPONENT: CUSTOMER TABLE (High Density Compact Row)
   ========================================================================== */
function CustomerTable({ customers, followUpTemplate, onEditCustomer, onOpenCustomer }) {
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
    <section className="customer-table-shell" aria-label="Customer list">
      <div className="customer-unified-list-head">
        <span>
          <small>Customer List</small>
          <strong>{customers.length} customer</strong>
        </span>
        <em>Action pakai template Follow-up Center</em>
      </div>

      <div className="customer-table-body">
        {customers.map((customer) => {
          const topBand = customer.bands[0];
          const links = getCustomerActionLinks(customer);
          const whatsappHref = getCustomerFollowUpWhatsappHref(customer, followUpTemplate);
          
          const subtitleItems = [
            formatPhoneLabel(customer.phone || customer.phoneKey),
            topBand ? topBand.name : customer.aliasLabel,
            customer.latestActivityAt ? formatDate(customer.latestActivityAt) : '',
          ].filter(Boolean);

          const metaValue = customer.openInvoiceAmount
            ? formatMoney(customer.openInvoiceAmount)
            : '';

          return (
            <article className="customer-list-row-compact" key={customer.id}>
              {/* Left clickable area */}
              <div 
                className="customer-list-main-compact" 
                role="button"
                tabIndex={0}
                onClick={() => onOpenCustomer(customer)}
                onKeyDown={(e) => { if (e.key === 'Enter') onOpenCustomer(customer); }}
              >
                <div className="customer-list-row1">
                  <span className="customer-name-wrap">
                    <strong className="customer-name-text">{customer.name}</strong>
                    {customer.hasDuplicatePhone && (
                      <span className="customer-badge-duplicate">Ganda</span>
                    )}
                    <span className={'customer-status-badge ' + getCustomerListTone(customer)}>
                      {getCustomerStatusLabel(customer)}
                    </span>
                  </span>
                  {metaValue && <span className="customer-meta-outstanding">{metaValue}</span>}
                </div>

                <div className="customer-list-row2">
                  <span className="customer-subtitle-text">
                    {subtitleItems.join(' • ')}
                  </span>
                  <span className="customer-meta-bookings">
                    {customer.totalBookings} booking • {customer.paidBookings} lunas
                  </span>
                </div>
              </div>

              {/* Right quick actions */}
              <div className="customer-list-actions-compact" aria-label={'Aksi customer ' + customer.name}>
                {whatsappHref ? (
                  <a
                    aria-label={'WhatsApp ' + customer.name}
                    className="action-icon-btn is-whatsapp"
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    title="WhatsApp"
                  >
                    <WhatsAppIcon size={14} />
                  </a>
                ) : null}

                {links.callHref ? (
                  <a aria-label={'Telepon ' + customer.name} className="action-icon-btn" href={links.callHref} title="Telepon">
                    <PhoneCall size={14} />
                  </a>
                ) : null}

                <button aria-label={'Edit customer ' + customer.name} className="action-icon-btn" title="Edit" type="button" onClick={() => onEditCustomer(customer)}>
                  <Pencil size={14} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ==========================================================================
   COMPONENT: CUSTOMER FOLLOW-UP CENTER (Collapsible & Functional)
   ========================================================================== */
function CustomerFollowUpCenter({
  activeFilter,
  activeTemplate,
  customers,
  onFilterChange,
  onTemplateChange,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const candidates = getCustomerFollowUpCandidates(customers, activeFilter);
  const totalOutstanding = getFollowUpOutstandingTotal(candidates);
  const unpaidCount = candidates.filter((customer) => customer.hasOpenPayment).length;

  return (
    <section className="customer-followup-center" aria-label="Follow-up center">
      <header 
        className="customer-followup-head" 
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => { if (e.key === 'Enter') setIsExpanded(!isExpanded); }}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
          <span className="customer-followup-orb" aria-hidden="true">
            <PhoneCall size={14} />
          </span>

          <span className="customer-followup-title">
            <small>Follow-up Center</small>
            <strong>Template & prioritas</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="customer-followup-total">
            {candidates.length} target
          </span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </header>

      {isExpanded && (
        <div className="customer-followup-body">
          <div className="customer-followup-controls">
            <div className="customer-followup-select">
              <StudioSelect
                label="Target"
                options={followUpFilterOptions}
                selectedKey={activeFilter}
                onChange={onFilterChange}
              />
            </div>

            <div className="customer-followup-select">
              <StudioSelect
                label="Template"
                options={followUpTemplateOptions}
                selectedKey={activeTemplate}
                onChange={onTemplateChange}
              />
            </div>
          </div>

          <div className="customer-followup-summary-grid">
            <article>
              <small>Outstanding</small>
              <strong>{formatMoney(totalOutstanding)}</strong>
            </article>
            <article>
              <small>Pending / DP</small>
              <strong>{unpaidCount}</strong>
            </article>
            <article>
              <small>Template WA</small>
              <strong>{followUpTemplateOptions.find((item) => item.key === activeTemplate)?.label || 'Tagihan'}</strong>
            </article>
          </div>

          <p className="customer-followup-hint">
            Aksi WhatsApp pada Customer List akan langsung mengirim pesan dengan template di atas.
          </p>
        </div>
      )}
    </section>
  );
}

/* ==========================================================================
   COMPONENT: CUSTOMER ACTIVITY TIMELINE (Clean flat listing)
   ========================================================================== */
function CustomerActivityTimeline({
  activeFilter,
  activityGroups,
  expandedActivityId,
  onFilterChange,
  onToggleActivity,
  totalActivities,
}) {
  return (
    <div className="info-section-compact customer-activity-card">
      <div className="timeline-header-compact">
        <h3>Activity Timeline</h3>
        <span className="customer-followup-total">
          {totalActivities} act
        </span>
      </div>

      <div className="customer-activity-toolbar-compact">
        <StudioSelect
          label="Aktivitas"
          options={activityFilterOptions}
          selectedKey={activeFilter}
          onChange={onFilterChange}
        />
      </div>

      {activityGroups.length ? (
        <div className="customer-timeline-list-compact">
          {activityGroups.map((group) => (
            <section className="customer-timeline-group-compact" key={group.label}>
              <strong className="customer-timeline-month-compact">{group.label}</strong>

              <div className="customer-timeline-items-compact">
                {group.items.map(({ booking, id }) => {
                  const status = getBookingStatus(booking);
                  const isExpanded = expandedActivityId === id;

                  return (
                    <article className={isExpanded ? 'customer-timeline-row-compact is-expanded' : 'customer-timeline-row-compact'} key={id}>
                      <button
                        aria-expanded={isExpanded}
                        className="customer-timeline-btn-trigger"
                        type="button"
                        onClick={() => onToggleActivity(id)}
                      >
                        <span className="timeline-col-date">
                          <strong>{formatDate(booking.date || booking.createdAt)}</strong>
                          <small>{getBookingTimeLabel(booking)}</small>
                        </span>

                        <span className="timeline-col-main">
                          <b>{booking.bandName || booking.title || 'Tanpa nama band'}</b>
                          <small>{getBookingActivityKindLabel(booking)} • {booking.sessionLabel || booking.packageLabel || 'Session'}</small>
                        </span>

                        <em className={'customer-mini-status is-' + status}>
                          {status}
                        </em>
                      </button>

                      {isExpanded && (
                        <div className="customer-timeline-expanded-compact">
                          <span>
                            <small>Harga / Tagihan</small>
                            <strong>{getBookingPriceLabel(booking)}</strong>
                          </span>
                          <span>
                            <small>Payment</small>
                            <strong>{status}</strong>
                          </span>
                          <span>
                            <small>Durasi</small>
                            <strong>{booking.duration || booking.customDuration || '-'} jam</strong>
                          </span>
                          <span>
                            <small>Customer</small>
                            <strong>{getBookingName(booking)}</strong>
                          </span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="no-data-text">Belum ada activity.</p>
      )}
    </div>
  );
}

/* ==========================================================================
   COMPONENT: CUSTOMER DETAIL (Flat Flat Details)
   ========================================================================== */
function CustomerDetail({ customer, customers, onBack, onEditCustomer, onMergeDuplicate, onOpenCustomer }) {
  const [activeActivityFilter, setActiveActivityFilter] = useState('all');
  const [expandedActivityId, setExpandedActivityId] = useState('');

  if (!customer) {
    return (
      <section className="customer-empty-state">
        <AlertCircle size={24} />
        <strong>Customer tidak ditemukan</strong>
        <span>Data mungkin belum tersinkron atau sudah berubah.</span>
        <button className="booking-button is-primary" type="button" onClick={onBack}>Kembali</button>
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

  const activityItems = filterCustomerActivities(customer.bookings, activeActivityFilter);
  const activityGroups = groupCustomerActivities(activityItems);

  return (
    <section className="customer-detail-page" aria-labelledby="customer-detail-title">
      {/* Header compact */}
      <div className="customer-detail-header-compact">
        <button className="customer-detail-back-btn" type="button" onClick={onBack} aria-label="Kembali ke list">
          <ArrowLeft size={16} />
        </button>

        <div className="customer-detail-title-compact">
          <h2 id="customer-detail-title">{customer.name}</h2>
          <span>{formatPhoneLabel(customer.phone || customer.phoneKey)}</span>
        </div>

        <span className={'customer-status-badge ' + getCustomerStatusClass(customer)}>
          {getCustomerStatusLabel(customer)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="customer-detail-actions-compact">
        {links.whatsappHref ? (
          <a
            aria-label={'Chat WhatsApp ' + customer.name}
            className="detail-action-btn is-whatsapp"
            href={links.whatsappHref}
            target="_blank"
            rel="noreferrer"
          >
            <WhatsAppIcon size={14} /> WhatsApp
          </a>
        ) : null}

        {links.callHref ? (
          <a
            aria-label={'Telepon ' + customer.name}
            className="detail-action-btn"
            href={links.callHref}
          >
            <PhoneCall size={14} /> Telepon
          </a>
        ) : null}

        <button
          aria-label={'Edit customer ' + customer.name}
          className="detail-action-btn"
          type="button"
          onClick={() => onEditCustomer(customer)}
        >
          <Pencil size={14} /> Edit
        </button>
      </div>

      {/* Notes section if any */}
      {customer.notes ? (
        <section className="customer-note-card">
          <strong>Catatan</strong>
          <p>{customer.notes}</p>
        </section>
      ) : null}

      {/* Alert Outstanding */}
      {customer.hasOpenPayment ? (
        <section className="customer-payment-alert" role="status">
          <AlertCircle size={14} />
          <span>
            {openBookings.length} booking pending/DP • {formatMoney(customer.openInvoiceAmount)} outstanding.
          </span>
        </section>
      ) : null}

      {/* Alert Duplicate Matches */}
      {duplicateCustomers.length ? (
        <section className="customer-duplicate-card">
          <header>
            <AlertCircle size={14} />
            <span>Kemungkinan Duplicate</span>
          </header>

          <div className="customer-duplicate-list">
            {duplicateCustomers.map((duplicate) => (
              <div className="customer-duplicate-item" key={duplicate.id}>
                <button type="button" onClick={() => onOpenCustomer(duplicate)}>
                  <strong>{duplicate.name}</strong>
                  <small>{duplicate.totalBookings} booking • {formatPhoneLabel(duplicate.phone || duplicate.phoneKey)}</small>
                </button>

                <button type="button" onClick={() => onMergeDuplicate(duplicate, customer)}>
                  Merge
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Stats bar */}
      <div className="customer-detail-stats-bar">
        <div className="stat-item-compact">
          <small>Booking</small>
          <strong>{customer.totalBookings}</strong>
        </div>
        <div className="stat-item-compact">
          <small>Lunas</small>
          <strong>{customer.paidBookings}</strong>
        </div>
        <div className="stat-item-compact">
          <small>Record</small>
          <strong>{customer.recordingBookings}</strong>
        </div>
        <div className="stat-item-compact">
          <small>Latihan</small>
          <strong>{customer.rehearsalBookings}</strong>
        </div>
      </div>

      {/* High density flat data grid */}
      <div className="customer-detail-info-grid">
        {/* Bands */}
        <div className="info-section-compact">
          <h3>Breakdown Band / Project</h3>
          <div className="customer-band-list-compact">
            {customer.bands.length ? customer.bands.map((band) => (
              <span className="customer-band-chip-compact" key={band.name}>
                <strong>{band.name}</strong>
                <em>{band.count}x</em>
              </span>
            )) : <p className="no-data-text">Belum ada data band.</p>}
          </div>
        </div>

        {/* Contacts */}
        <div className="info-section-compact">
          <h3>Detail Kontak</h3>
          <div className="customer-contact-sheet">
            <div className="contact-row">
              <span className="contact-label">WhatsApp</span>
              <strong className="contact-value">{formatPhoneLabel(customer.phone || customer.phoneKey)}</strong>
            </div>
            <div className="contact-row">
              <span className="contact-label">Email</span>
              <strong className="contact-value">{customer.email || '-'}</strong>
            </div>
            <div className="contact-row">
              <span className="contact-label">Instagram</span>
              <strong className="contact-value">{customer.instagram ? '@' + customer.instagram : '-'}</strong>
            </div>
            <div className="contact-row">
              <span className="contact-label">Status CRM</span>
              <strong className="contact-value">{getFollowUpLabel(customer.followUpStatus)}</strong>
            </div>
          </div>
        </div>

        {/* Payment stats */}
        <div className="info-section-compact">
          <h3>Status Keuangan</h3>
          <div className="customer-contact-sheet">
            <div className="contact-row">
              <span className="contact-label">Pending / DP</span>
              <strong className="contact-value">{customer.pendingBookings} pending • {customer.dpBookings} DP</strong>
            </div>
            <div className="contact-row">
              <span className="contact-label">Outstanding</span>
              <strong className="contact-value">{formatMoney(customer.openInvoiceAmount)}</strong>
            </div>
            <div className="contact-row">
              <span className="contact-label">Total Omset</span>
              <strong className="contact-value">{formatMoney(customer.totalPaidValue)}</strong>
            </div>
            <div className="contact-row">
              <span className="contact-label">Sering Main</span>
              <strong className="contact-value">{topBand ? topBand.name : '-'}</strong>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <CustomerActivityTimeline
          activeFilter={activeActivityFilter}
          activityGroups={activityGroups}
          expandedActivityId={expandedActivityId}
          totalActivities={activityItems.length}
          onFilterChange={(nextFilter) => {
            setActiveActivityFilter(nextFilter);
            setExpandedActivityId('');
          }}
          onToggleActivity={(activityId) => {
            setExpandedActivityId((current) => (current === activityId ? '' : activityId));
          }}
        />
      </div>
    </section>
  );
}

/* ==========================================================================
   MAIN COMPONENT: CUSTOMER PAGE
   ========================================================================== */
export default function CustomerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [manualCustomers, setManualCustomers] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [customerPage, setCustomerPage] = useState(1);
  const [followUpFilter, setFollowUpFilter] = useState('all');
  const [followUpTemplate, setFollowUpTemplate] = useState('payment');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const local = readManualCustomers();
    if (local && local.length > 0) {
      adminCustomerRepository.migrateLocalCustomersToFirestore(local)
        .catch((err) => console.error('Gagal migrasi customer lokal:', err));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = adminCustomerRepository.subscribeManualCustomers(
      { limitCount: 150 },
      (data) => setManualCustomers(data),
      (error) => {
        console.error('Gagal memuat customer dari Firestore:', error);
        setToast({
          title: 'Gagal Memuat',
          message: 'Koneksi Firestore terganggu. Data customer mungkin tidak mutakhir.',
        });
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = adminBookingRepository.subscribeManualBookings(
      { limitCount: 150 },
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

  const paginatedCustomers = useMemo(
    () => getPaginationSlice(filteredCustomers, customerPage, ADMIN_LIST_PAGE_SIZE),
    [customerPage, filteredCustomers]
  );

  const detailId = getCustomerRouteId(location.pathname);
  const selectedCustomer = detailId ? customers.find((customer) => customer.id === detailId) : null;

  function handleCustomerFilterChange(nextFilter) {
    setActiveFilter(nextFilter);
    setCustomerPage(1);
  }

  function handleCustomerSearchChange(nextSearchText) {
    setSearchText(nextSearchText);
    setCustomerPage(1);
  }

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
        '?\n\nBooking milik duplicate akan diarahkan ke customer ini.'
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

      await adminCustomerRepository.deleteManualCustomer(sourceCustomer.id);

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
        onFilterChange={handleCustomerFilterChange}
        onSearchChange={handleCustomerSearchChange}
      />

      <CustomerFollowUpCenter
        activeFilter={followUpFilter}
        activeTemplate={followUpTemplate}
        customers={customers}
        onFilterChange={setFollowUpFilter}
        onTemplateChange={setFollowUpTemplate}
      />

      <CustomerTable
        customers={paginatedCustomers}
        followUpTemplate={followUpTemplate}
        onEditCustomer={openCustomerForm}
        onOpenCustomer={openCustomer}
      />

      <PaginationControls
        label="customer"
        page={customerPage}
        pageSize={ADMIN_LIST_PAGE_SIZE}
        totalItems={filteredCustomers.length}
        onPageChange={setCustomerPage}
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
