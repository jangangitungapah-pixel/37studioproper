/**
 * bookingStatusUtils.js — Fungsi terpusat untuk normalisasi status booking.
 * Menggantikan implementasi berbeda-beda di BillingPage, ClientPortalPage, adminBookingRepository.
 */

import {
  CANCELLED_STATUSES,
  OPEN_STATUSES,
  STATUS_LABELS,
  STATUS_CLASSES,
} from '../constants/bookingConstants.js';

/**
 * Dapatkan raw status string dari booking.
 * @param {object} booking
 * @returns {string}
 */
export function getBookingStatus(booking) {
  return (booking?.paymentStatus || booking?.status || 'pending').toLowerCase();
}

/**
 * Normalisasi status booking — mempertimbangkan paymentHistory jika ada.
 * Ini adalah single source of truth untuk logika status billing.
 * @param {object} booking
 * @returns {string}
 */
export function normalizeBookingStatus(booking) {
  const rawStatus = getBookingStatus(booking);

  if (rawStatus === 'void' || booking?.voidedAt) return 'void';

  const total = Number(booking?.total || booking?.subtotal || booking?.invoiceAmount || 0) || 0;
  const history = Array.isArray(booking?.paymentHistory) ? booking.paymentHistory : [];
  const historyTotal = history.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);

  if (historyTotal > 0 && total > 0) {
    return historyTotal >= total ? 'lunas' : 'dp';
  }

  return rawStatus || 'pending';
}

/**
 * Dapatkan label display untuk status booking.
 * @param {string} status
 * @returns {string}
 */
export function getStatusLabel(status) {
  return STATUS_LABELS[status?.toLowerCase()] || status || 'Pending';
}

/**
 * Dapatkan CSS class name untuk status booking.
 * @param {string} status
 * @returns {string}
 */
export function getStatusClass(status) {
  return STATUS_CLASSES[status?.toLowerCase()] || 'is-pending';
}

/**
 * Cek apakah booking dibatalkan/void.
 * @param {object} booking
 * @returns {boolean}
 */
export function isBookingCancelled(booking) {
  const status = getBookingStatus(booking);
  return CANCELLED_STATUSES.includes(status) || Boolean(booking?.voidedAt);
}

/**
 * Cek apakah booking masih memiliki tagihan terbuka (pending atau DP).
 * @param {object} booking
 * @returns {boolean}
 */
export function isBookingOpen(booking) {
  const status = normalizeBookingStatus(booking);
  return OPEN_STATUSES.includes(status);
}

/**
 * Normalisasi nomor HP Indonesia ke format E.164 tanpa '+'.
 * Contoh: "08123456789" → "628123456789"
 * @param {string} value
 * @returns {string}
 */
export function normalizeClientPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

/**
 * Format nomor HP untuk ditampilkan (misal: "0812 3456 789").
 * @param {string} value
 * @returns {string}
 */
export function formatClientPhoneLabel(value) {
  const phoneKey = normalizeClientPhone(value);
  if (!phoneKey) return '-';
  if (phoneKey.startsWith('62')) {
    return ('0' + phoneKey.slice(2)).replace(/(\d{4})(\d{4})(\d+)/, '$1 $2 $3');
  }
  return phoneKey;
}

/**
 * Dapatkan href WhatsApp untuk kirim reminder ke customer.
 * @param {string} phone
 * @param {string} message
 * @returns {string}
 */
export function buildWhatsAppHref(phone, message) {
  const phoneKey = normalizeClientPhone(phone);
  if (!phoneKey || !message) return '';
  return 'https://wa.me/' + phoneKey + '?text=' + encodeURIComponent(message);
}
