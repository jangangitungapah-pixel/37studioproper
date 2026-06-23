/**
 * scheduleConfig.js — Konstanta konfigurasi jadwal studio.
 * Dipindahkan dari src/pages/admin/ ke src/constants/ karena digunakan
 * oleh beberapa halaman (SchedulePage, ClientPortalPage).
 */

export const viewModes = [
  { key: 'day', label: 'Day', description: 'Fokus satu tanggal' },
  { key: 'week', label: 'Week', description: 'Tujuh hari aktif' },
  { key: 'month', label: 'Month', description: 'Satu bulan penuh' },
];

export const statusFilters = [
  { key: 'pending', label: 'Pending', description: 'Belum konfirmasi', tone: 'pending' },
  { key: 'dp', label: 'DP', description: 'Sudah bayar DP', tone: 'dp' },
  { key: 'lunas', label: 'Lunas', description: 'Pembayaran selesai', tone: 'lunas' },
];

export const sessionTypeOptions = [
  { key: 'rehearsal', label: 'Rehearsal', description: 'Latihan studio', rate: 100000 },
  { key: 'recording', label: 'Recording', description: 'Tracking rekaman', rate: 150000 },
  { key: 'mixing', label: 'Mixing', description: 'Mixing audio', rate: 250000 },
  { key: 'mastering', label: 'Mastering', description: 'Final mastering', rate: 300000 },
];

export const durationOptions = [
  { key: '1', label: '1 Jam', description: '60 menit' },
  { key: '2', label: '2 Jam', description: '120 menit' },
  { key: '3', label: '3 Jam', description: '180 menit' },
  { key: '4', label: '4 Jam', description: '240 menit' },
  { key: '5', label: '5 Jam', description: '300 menit' },
  { key: '6', label: '6 Jam', description: '360 menit' },
  { key: 'custom', label: 'Custom', description: 'Durasi manual' },
];

export const paymentStatusOptions = [
  { key: 'pending', label: 'Pending', description: 'Belum ada pembayaran', tone: 'pending' },
  { key: 'dp', label: 'DP', description: 'Sudah bayar sebagian', tone: 'dp' },
  { key: 'lunas', label: 'Lunas', description: 'Sudah lunas', tone: 'lunas' },
];

export const businessHours = Array.from({ length: 13 }, (_, index) => {
  const start = index + 10;
  const end = start + 1;

  return {
    key: String(start),
    start,
    end,
    label: String(start).padStart(2, '0') + '.00',
    description: String(start).padStart(2, '0') + '.00-' + String(end).padStart(2, '0') + '.00',
    rangeLabel: String(start).padStart(2, '0') + '.00-' + String(end).padStart(2, '0') + '.00',
    shortLabel: String(start).padStart(2, '0') + '.00',
  };
});
