/**
 * Canonical booking status contract.
 *
 * File ini mendefinisikan vocabulary domain resmi untuk booking 37 Studio.
 *
 * Penting:
 * - canonical status BELUM otomatis ditulis ke Firestore pada Phase 1B;
 * - data legacy tetap didukung;
 * - normalization legacy -> canonical dikerjakan pada Phase 1C;
 * - consumer UI dipindahkan ke selector canonical pada Phase 1D.
 */

export const BOOKING_STATUS_CONTRACT_VERSION = 1;

export const BOOKING_REQUEST_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  CANCELLATION_REQUESTED: 'cancellation_requested',
  CANCELLED: 'cancelled',
});

export const BOOKING_PAYMENT_STATUS = Object.freeze({
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
  REFUNDED: 'refunded',
  VOID: 'void',
});

export const BOOKING_SESSION_STATUS = Object.freeze({
  UPCOMING: 'upcoming',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
});

/**
 * Vocabulary pembayaran legacy yang saat ini masih tersimpan dan digunakan
 * oleh beberapa consumer aplikasi.
 *
 * Jangan hapus sampai compatibility migration selesai.
 */
export const LEGACY_PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  DP: 'dp',
  LUNAS: 'lunas',
  VOID: 'void',
});

/**
 * Mapping deklaratif legacy -> canonical.
 *
 * Mapping ini hanya mendefinisikan kontrak compatibility.
 * Logic normalisasi booking secara penuh dibuat terpisah di Phase 1C.
 */
export const LEGACY_PAYMENT_STATUS_MAP = Object.freeze({
  [LEGACY_PAYMENT_STATUS.PENDING]: BOOKING_PAYMENT_STATUS.UNPAID,
  [LEGACY_PAYMENT_STATUS.DP]: BOOKING_PAYMENT_STATUS.PARTIAL,
  [LEGACY_PAYMENT_STATUS.LUNAS]: BOOKING_PAYMENT_STATUS.PAID,
  [LEGACY_PAYMENT_STATUS.VOID]: BOOKING_PAYMENT_STATUS.VOID,
});

export const BOOKING_REQUEST_STATUSES = Object.freeze(
  Object.values(BOOKING_REQUEST_STATUS),
);

export const BOOKING_PAYMENT_STATUSES = Object.freeze(
  Object.values(BOOKING_PAYMENT_STATUS),
);

export const BOOKING_SESSION_STATUSES = Object.freeze(
  Object.values(BOOKING_SESSION_STATUS),
);

export const BOOKING_REQUEST_STATUS_META = Object.freeze({
  [BOOKING_REQUEST_STATUS.DRAFT]: Object.freeze({
    label: 'Draft',
    tone: 'neutral',
  }),

  [BOOKING_REQUEST_STATUS.SUBMITTED]: Object.freeze({
    label: 'Menunggu Konfirmasi',
    tone: 'pending',
  }),

  [BOOKING_REQUEST_STATUS.CONFIRMED]: Object.freeze({
    label: 'Dikonfirmasi',
    tone: 'confirmed',
  }),

  [BOOKING_REQUEST_STATUS.REJECTED]: Object.freeze({
    label: 'Ditolak',
    tone: 'rejected',
  }),

  [BOOKING_REQUEST_STATUS.CANCELLATION_REQUESTED]: Object.freeze({
    label: 'Meminta Pembatalan',
    tone: 'attention',
  }),

  [BOOKING_REQUEST_STATUS.CANCELLED]: Object.freeze({
    label: 'Dibatalkan',
    tone: 'cancelled',
  }),
});

export const BOOKING_PAYMENT_STATUS_META = Object.freeze({
  [BOOKING_PAYMENT_STATUS.UNPAID]: Object.freeze({
    label: 'Belum Bayar',
    tone: 'pending',
  }),

  [BOOKING_PAYMENT_STATUS.PARTIAL]: Object.freeze({
    label: 'Bayar Sebagian',
    tone: 'partial',
  }),

  [BOOKING_PAYMENT_STATUS.PAID]: Object.freeze({
    label: 'Lunas',
    tone: 'paid',
  }),

  [BOOKING_PAYMENT_STATUS.REFUNDED]: Object.freeze({
    label: 'Refund',
    tone: 'refunded',
  }),

  [BOOKING_PAYMENT_STATUS.VOID]: Object.freeze({
    label: 'Void',
    tone: 'void',
  }),
});

export const BOOKING_SESSION_STATUS_META = Object.freeze({
  [BOOKING_SESSION_STATUS.UPCOMING]: Object.freeze({
    label: 'Akan Datang',
    tone: 'upcoming',
  }),

  [BOOKING_SESSION_STATUS.IN_PROGRESS]: Object.freeze({
    label: 'Berlangsung',
    tone: 'active',
  }),

  [BOOKING_SESSION_STATUS.COMPLETED]: Object.freeze({
    label: 'Selesai',
    tone: 'completed',
  }),

  [BOOKING_SESSION_STATUS.NO_SHOW]: Object.freeze({
    label: 'Tidak Hadir',
    tone: 'no-show',
  }),

  [BOOKING_SESSION_STATUS.CANCELLED]: Object.freeze({
    label: 'Dibatalkan',
    tone: 'cancelled',
  }),
});

export function isBookingRequestStatus(value) {
  return BOOKING_REQUEST_STATUSES.includes(value);
}

export function isBookingPaymentStatus(value) {
  return BOOKING_PAYMENT_STATUSES.includes(value);
}

export function isBookingSessionStatus(value) {
  return BOOKING_SESSION_STATUSES.includes(value);
}
