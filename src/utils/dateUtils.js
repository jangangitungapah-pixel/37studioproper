/**
 * dateUtils.js — Centralized date formatting & utility functions.
 * Menggantikan duplikasi fungsi tanggal yang tersebar di 5+ file.
 */

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAYS_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Dapatkan Date object dari nilai ISO string atau Date. Kembalikan null jika tidak valid. */
function safeDate(value) {
  if (!value) return null;
  const str = String(value);
  const d = new Date(str.includes('T') ? str : str + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format tanggal ke "12 Jun 2026".
 * @param {string|Date} value
 * @returns {string}
 */
export function formatDate(value) {
  const d = safeDate(value);
  if (!d) return '-';
  return d.getDate() + ' ' + MONTHS_SHORT_ID[d.getMonth()] + ' ' + d.getFullYear();
}

/**
 * Format tanggal ke "12 Januari 2026".
 * @param {string|Date} value
 * @returns {string}
 */
export function formatDateLong(value) {
  const d = safeDate(value);
  if (!d) return '-';
  return d.getDate() + ' ' + MONTHS_ID[d.getMonth()] + ' ' + d.getFullYear();
}

/**
 * Format tanggal thermal: "12/06/2026".
 * @param {string|Date} value
 * @returns {string}
 */
export function formatShortDate(value) {
  const d = safeDate(value);
  if (!d) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

/**
 * Format tanggal + waktu ke "12 Jun 2026, 14:00".
 * @param {string|Date} value
 * @returns {string}
 */
export function formatDateTime(value) {
  const d = safeDate(value);
  if (!d) return '-';
  return formatDate(value) + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/**
 * Konversi Date object ke ISO date string "YYYY-MM-DD".
 * @param {Date} date
 * @returns {string}
 */
export function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

/**
 * Dapatkan ISO date string untuk hari ini "YYYY-MM-DD".
 * @returns {string}
 */
export function getTodayIsoDate() {
  return toIsoDate(new Date());
}

/**
 * Cek apakah dua tanggal adalah hari yang sama.
 * @param {Date} a
 * @param {Date} b
 * @returns {boolean}
 */
export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/**
 * Cek apakah nilai tanggal ada dalam range tertentu.
 * @param {string} value - ISO date string atau ISO datetime
 * @param {'today'|'month'|'year'|'all'} range
 * @returns {boolean}
 */
export function isDateInRange(value, range) {
  if (range === 'all') return true;
  const d = safeDate(value);
  if (!d) return false;
  const now = new Date();
  if (range === 'today') return isSameDay(d, now);
  if (range === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (range === 'year') return d.getFullYear() === now.getFullYear();
  return true;
}

/**
 * Tambahkan sejumlah hari ke Date object.
 * @param {Date} date
 * @param {number} amount
 * @returns {Date}
 */
export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

/**
 * Tambahkan sejumlah bulan ke Date object (set hari ke 1).
 * @param {Date} date
 * @param {number} amount
 * @returns {Date}
 */
export function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

/**
 * Kembalikan Date tanpa komponen waktu (awal hari).
 * @param {Date} date
 * @returns {Date}
 */
export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Kembalikan jumlah hari dalam bulan dari Date.
 * @param {Date} date
 * @returns {number}
 */
export function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Kembalikan awal minggu (Senin) dari Date.
 * @param {Date} date
 * @returns {Date}
 */
export function getWeekStart(date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(date), diff);
}

// Re-export nama-nama hari dan bulan untuk komponen kalender
export { MONTHS_ID, MONTHS_SHORT_ID, DAYS_ID, DAYS_SHORT_ID };
