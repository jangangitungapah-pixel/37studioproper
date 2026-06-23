/**
 * bookingConstants.js — Status constants untuk booking.
 * Single source of truth untuk semua status strings yang digunakan di seluruh aplikasi.
 */

/** Status yang berarti booking dibatalkan/tidak valid */
export const CANCELLED_STATUSES = Object.freeze(['cancelled', 'canceled', 'void', 'deleted']);

/** Status yang berarti sudah lunas */
export const PAID_STATUSES = Object.freeze(['lunas']);

/** Status yang berarti ada tagihan terbuka (belum lunas) */
export const OPEN_STATUSES = Object.freeze(['pending', 'dp']);

/** Status aktif yang ditampilkan di kalender (bukan cancelled) */
export const ACTIVE_CALENDAR_STATUSES = Object.freeze(['pending', 'dp', 'lunas']);

/** Label display untuk setiap status */
export const STATUS_LABELS = Object.freeze({
  pending: 'Pending',
  dp: 'DP',
  lunas: 'Lunas',
  void: 'Void',
  cancelled: 'Dibatalkan',
  canceled: 'Dibatalkan',
  deleted: 'Dihapus',
});

/** CSS class untuk setiap status */
export const STATUS_CLASSES = Object.freeze({
  pending: 'is-pending',
  dp: 'is-dp',
  lunas: 'is-lunas',
  void: 'is-void',
  cancelled: 'is-void',
  canceled: 'is-void',
  deleted: 'is-void',
});
