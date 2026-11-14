import { businessHours } from '../../constants/scheduleConfig.js';
import {
  LANDING_HERO_DEFAULT_URL,
  LANDING_MEDIA_SPOT_DEFAULTS,
  getStudioPaymentTerms,
  normalizeStudioPhoneForWhatsApp,
} from '../../settings/studioSettings.js';

export const STUDIO_HERO_PHOTO = LANDING_HERO_DEFAULT_URL;

export const CREATIVE_AUDIENCES = [
  {
    key: 'band',
    eyebrow: 'Band & Grup Musik',
    title: 'Latihan rutin yang fokus',
    description:
      'Ruang kontrol dan sesi studio terjadwal per jam tanpa bertabrakan jadwal dengan grup lain.',
  },
  {
    key: 'solo',
    eyebrow: 'Solo Artist & Vokal',
    title: 'Take vokal hingga produksi',
    description:
      'Dari sesi latihan vokal hingga recording, mixing, dan mastering yang rapi dalam satu tempat.',
  },
  {
    key: 'creator',
    eyebrow: 'Content Creator',
    title: 'Live session & rekaman konten',
    description:
      'Atur waktu sesi yang pasti di kalender publik supaya tim produksi Anda bisa langsung eksekusi.',
  },
  {
    key: 'community',
    eyebrow: 'Pelajar & Komunitas',
    title: 'Booking jelas tanpa ribet',
    description:
      'Cek ketersediaan jam dan estimasi biaya lebih dulu sebelum mengirim pengajuan sesi.',
  },
];

export const STUDIO_FRAME_SPOTS = LANDING_MEDIA_SPOT_DEFAULTS.map((spot) => ({
  id: spot.slotKey,
  badge: spot.badge,
  title: spot.title,
  caption: spot.caption,
  objectPosition: spot.objectPosition,
  transformOrigin: spot.transformOrigin,
  scale: spot.scale,
  featured: spot.featured,
}));

export const STUDIO_READINESS_POINTS = [
  'Kalender publik real-time memperlihatkan slot terisi dan kosong sebelum Anda login.',
  'Operasional terjadwal setiap hari pukul 10.00—23.00 WIB per blok jam.',
  'Seluruh status pengajuan, rincian tagihan, dan unggah bukti pembayaran terpantau di Client Portal.',
];

export const SERVICE_METADATA_BY_KEY = {
  rehearsal: {
    tag: 'Latihan Penuh',
    badge: 'Paling sering dipilih',
    summary: 'Sesi latihan band atau ensemble dengan penjadwalan blok per jam dan estimasi tarif langsung.',
    suitability: 'Latihan rutin, persiapan panggung, dan jamming terstruktur.',
  },
  recording: {
    tag: 'Produksi Studio',
    badge: 'Sesi Rekaman',
    summary: 'Perekaman instrumen maupun vokal dengan alur slot studio yang bisa dijadwalkan terlebih dahulu.',
    suitability: 'Rekaman single, demo lagu, hingga sesi live take.',
  },
  mixing: {
    tag: 'Post-Production',
    badge: 'Penyempurnaan Audio',
    summary: 'Penyeimbangan level instrumen, ruang frekuensi, dan dinamika agar materi lagu terdengar solid.',
    suitability: 'Materi multitrack yang siap diseimbangkan.',
  },
  mastering: {
    tag: 'Final Release',
    badge: 'Tahap Akhir',
    summary: 'Sentuhan akhir konsistensi loudness dan kejelasan karakter audio sebelum lagu dirilis.',
    suitability: 'Lagu siap edar untuk platform streaming atau arsip rilis.',
  },
};

export const BOOKING_PROCESS_STEPS = [
  {
    step: '01',
    title: 'Cek Jadwal & Estimasi Lebih Dulu',
    description:
      'Pilih tanggal dan jam di estimator ini atau buka kalender publik tanpa wajib login untuk memastikan slot kosong.',
  },
  {
    step: '02',
    title: 'Login Client Saat Mengajukan Slot',
    description:
      'Masuk dengan Google atau OTP HP hanya ketika siap mengirim booking. Tanggal dan jam pilihanmu tetap terbawa otomatis.',
  },
  {
    step: '03',
    title: 'Pantau Konfirmasi & Tagihan di Portal',
    description:
      'Lihat status konfirmasi admin, rincian DP/lunas, serta riwayat sesi studio Anda kapan saja melalui Client Portal.',
  },
];

export function formatHourClock(hourValue) {
  const numeric = Number(hourValue);
  if (!Number.isFinite(numeric)) return '00.00';
  return `${String(numeric).padStart(2, '0')}.00`;
}

export function formatHourRange(startHour, endHour = Number(startHour) + 1) {
  return `${formatHourClock(startHour)}—${formatHourClock(endHour)} WIB`;
}

export function formatStartHourOptionLabel(hourValue, isOccupied = false) {
  const start = Number(hourValue);
  const base = `${formatHourClock(start)}-${formatHourClock(start + 1)} WIB`;
  return isOccupied ? `${base} (Terisi)` : base;
}

function getBusinessStartHoursList() {
  if (!Array.isArray(businessHours)) {
    return Array.from({ length: 13 }, (_, index) => 10 + index);
  }
  const parsed = businessHours
    .map((item) => Number(item?.start ?? item?.key ?? item?.value))
    .filter(Number.isFinite);
  return parsed.length > 0 ? parsed : Array.from({ length: 13 }, (_, index) => 10 + index);
}

export function formatOperationalHoursLabel() {
  const hoursList = getBusinessStartHoursList();
  const start = hoursList[0] ?? 10;
  const end = (hoursList[hoursList.length - 1] ?? 22) + 1;
  return `${formatHourClock(start)}—${formatHourClock(end)} WIB`;
}

export function formatIndonesianDateLabel(dateKey) {
  const raw = String(dateKey || '').trim();
  if (!raw) return 'Belum dipilih';

  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw;

  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function getOccupiedHoursForDate(calendarSlots = [], targetDateKey = '') {
  const occupied = new Set();
  const normalizedTarget = String(targetDateKey || '').trim();

  if (!normalizedTarget || !Array.isArray(calendarSlots)) {
    return occupied;
  }

  const slotHours = getBusinessStartHoursList();
  const maxCloseHour = (slotHours[slotHours.length - 1] ?? 22) + 1;

  calendarSlots.forEach((slot) => {
    if (!slot) return;
    const slotDate = String(slot.date || slot.dayKey || '').trim();
    if (slotDate !== normalizedTarget) return;

    const status = String(slot.requestStatus || slot.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'rejected' || status === 'void') {
      return;
    }

    const start = Number(slot.startHour);
    if (!Number.isFinite(start)) return;

    const rawDuration = Number(slot.durationHours ?? slot.duration ?? slot.spanRows);
    const rawEnd = Number(slot.endHour);
    const computedEnd =
      Number.isFinite(rawEnd) && rawEnd > start
        ? rawEnd
        : start + Math.max(1, Number.isFinite(rawDuration) ? Math.ceil(rawDuration) : 1);

    slotHours.forEach((hour) => {
      if (hour >= start && hour < Math.min(maxCloseHour, computedEnd)) {
        occupied.add(hour);
      }
    });
  });

  return occupied;
}

export function cleanStudioInfoValue(value) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '-' || normalized === '--') {
    return '';
  }
  return normalized;
}

export function buildWhatsAppHref(studioName, phoneRaw) {
  const cleanPhone = cleanStudioInfoValue(phoneRaw);
  const normalized = normalizeStudioPhoneForWhatsApp(cleanPhone);
  if (!normalized) return '';
  const message = encodeURIComponent(
    `Halo ${studioName || '37 Music Studio'}, saya ingin menanyakan jadwal dan layanan studio.`,
  );
  return `https://wa.me/${normalized}?text=${message}`;
}

function cleanPolicyClause(clause) {
  return String(clause || '')
    .trim()
    .replace(/\.(?=[A-Za-z0-9])/g, '. ')
    .replace(/,(?=[A-Za-z0-9])/g, ', ')
    .replace(/\.,/g, '.')
    .replace(/\s+/g, ' ')
    .replace(/[,;:\s]+$/, '');
}

export function getFormattedPaymentTermsList(value) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/(?:\r?\n|(?<=[.])\s*(?=[A-Z]))/)
      .filter(Boolean);

  const flattened = rawItems
    .flatMap((item) =>
      String(item || '')
        .replace(/([a-z0-9])\.,(?=[A-Z])/g, '$1.\n')
        .replace(/([a-z0-9])\.(?=[A-Z])/g, '$1.\n')
        .replace(/,(?=[A-Z][a-z]+\s+(?:dapat|wajib|harus|dilakukan|pembatalan))/g, '.\n')
        .split(/\n+/),
    )
    .map(cleanPolicyClause)
    .filter(Boolean)
    .map((line) => (/[.!?]$/.test(line) ? line : `${line}.`));

  return flattened;
}

export function formatReadablePolicyCopy(value) {
  return getFormattedPaymentTermsList(value).join(' ');
}

export function buildLandingFaqItems({
  studioName,
  resolvedContact,
  pricingSettings,
  sessionOptions = [],
  packageOptions = [],
}) {
  const operationalWindow = formatOperationalHoursLabel();
  const activePaymentTerms = formatReadablePolicyCopy(getStudioPaymentTerms(resolvedContact));
  const serviceListText = sessionOptions.map((item) => item.label).join(', ') || 'Rehearsal, Recording, Mixing, Mastering';
  const discounts = Array.isArray(pricingSettings?.discounts)
    ? pricingSettings.discounts.filter((rule) => rule && rule.enabled !== false)
    : [];

  const bankName = cleanStudioInfoValue(resolvedContact?.bankName);
  const bankAcc = cleanStudioInfoValue(resolvedContact?.bankAccountNumber);
  const bankHolder = cleanStudioInfoValue(resolvedContact?.bankAccountHolder);
  const bankSummary = [bankName, bankAcc].filter(Boolean).join(' · ');
  const qrisSummary =
    cleanStudioInfoValue(resolvedContact?.qrisLabel) ||
    cleanStudioInfoValue(resolvedContact?.qrisNote);

  const pricingNotes = [];
  pricingNotes.push(`Layanan aktif saat ini mencakup ${serviceListText}.`);
  if (packageOptions.length > 0) {
    pricingNotes.push(`Tersedia ${packageOptions.length} pilihan paket studio yang dapat langsung dipilih di estimator.`);
  }
  if (discounts.length > 0) {
    pricingNotes.push('Potongan harga otomatis dihitung di estimator ketika memenuhi ketentuan aturan tarif studio.');
  }

  const paymentParts = [activePaymentTerms];
  if (bankSummary) {
    paymentParts.push(`Rekening tercantum di studio: ${bankSummary}${bankHolder ? ` (${bankHolder})` : ''}.`);
  }
  if (qrisSummary) {
    paymentParts.push(`QRIS studio: ${qrisSummary}.`);
  }

  return [
    {
      id: 'booking-without-login',
      question: 'Apakah saya harus membuat akun dulu hanya untuk mengecek jadwal kosong?',
      answer:
        'Tidak perlu. Anda dapat menelusuri kalender publik dan menghitung estimasi biaya langsung dari halaman ini atau /book. Login akun client (Google atau OTP HP) hanya diminta saat Anda siap mengajukan slot agar status dan tagihan tersimpan aman.',
    },
    {
      id: 'operational-hours',
      question: `Jam operasional ${studioName} buka dari pukul berapa?`,
      answer: `Operasional studio dibuka setiap hari pada pukul ${operationalWindow} dengan sistem pemilihan slot per blok jam mulai dari 10.00 WIB hingga slot terakhir 22.00—23.00 WIB.`,
    },
    {
      id: 'pricing-and-packages',
      question: 'Bagaimana perhitungan tarif layanan, paket, dan recording?',
      answer: `${pricingNotes.join(' ')} Untuk layanan Recording tanpa paket jam tetap, Anda tetap dapat memilih tanggal dan jam terlebih dahulu untuk kemudian dikonfirmasi admin sesuai kebutuhan proyek.`,
    },
    {
      id: 'payment-and-dp',
      question: 'Bagaimana kebijakan pembayaran dan konfirmasi DP?',
      answer: paymentParts.filter(Boolean).join(' '),
    },
    {
      id: 'portal-tracking',
      question: 'Di mana saya memantau status booking atau mengunggah bukti pembayaran?',
      answer:
        'Setelah mengajukan booking, seluruh jadwal aktif, riwayat sesi, invoice, serta unggah bukti transfer atau QRIS dapat dipantau langsung melalui Client Portal di /client/portal.',
    },
  ];
}
