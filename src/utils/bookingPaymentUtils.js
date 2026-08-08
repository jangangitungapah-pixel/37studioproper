import {
  BOOKING_PAYMENT_STATUS,
} from '../domain/booking/bookingStatus.js';
import {
  getBookingPaymentStatus,
} from '../domain/booking/bookingSelectors.js';

const LEGACY_PAYMENT_WRITE_STATUS =
  Object.freeze({
    [BOOKING_PAYMENT_STATUS.UNPAID]:
      'pending',
    [BOOKING_PAYMENT_STATUS.PARTIAL]:
      'dp',
    [BOOKING_PAYMENT_STATUS.PAID]:
      'lunas',
    [BOOKING_PAYMENT_STATUS.REFUNDED]:
      'refunded',
    [BOOKING_PAYMENT_STATUS.VOID]:
      'void',
  });

export function cleanPaymentText(
  value,
) {
  return String(
    value || '',
  ).trim();
}

export function cleanPaymentLower(
  value,
) {
  return cleanPaymentText(
    value,
  ).toLowerCase();
}

function toMoney(
  value,
) {
  const number =
    Number(
      value,
    );

  return (
    Number.isFinite(number)
      ? Math.max(
          0,
          number,
        )
      : 0
  );
}

function getLegacyWriteStatus(
  canonicalStatus,
) {
  return (
    LEGACY_PAYMENT_WRITE_STATUS[
      canonicalStatus
    ] ||
    'pending'
  );
}

export function getBookingBillingTotal(
  booking,
) {
  return toMoney(
    booking?.total ||
    booking?.subtotal ||
    booking?.invoiceAmount ||
    0,
  );
}

export function getBookingDpAmount(
  booking,
) {
  return toMoney(
    booking?.dpAmount,
  );
}

export function getBookingPaymentHistory(
  booking,
) {
  const rawHistory =
    Array.isArray(
      booking?.paymentHistory,
    )
      ? booking.paymentHistory
      : [];

  if (
    rawHistory.length
  ) {
    return rawHistory;
  }

  const status =
    getBookingPaymentStatus(
      booking,
    );

  if (
    status ===
      BOOKING_PAYMENT_STATUS.VOID ||
    status ===
      BOOKING_PAYMENT_STATUS.REFUNDED
  ) {
    return [];
  }

  const total =
    getBookingBillingTotal(
      booking,
    );

  const partialAmount =
    Math.max(
      getBookingDpAmount(
        booking,
      ),
      toMoney(
        booking?.paidAmount,
      ),
    );

  const legacyPaidAmount =
    status ===
    BOOKING_PAYMENT_STATUS.PAID
      ? total
      : status ===
          BOOKING_PAYMENT_STATUS.PARTIAL
        ? partialAmount
        : 0;

  if (
    !legacyPaidAmount
  ) {
    return [];
  }

  const paymentDate =
    booking?.lastPaymentAt ||
    booking?.createdAt ||
    booking?.date ||
    new Date().toISOString();

  return [
    {
      amount:
        legacyPaidAmount,
      createdAt:
        paymentDate,
      date:
        paymentDate,
      id:
        'legacy_' +
        (
          booking?.id ||
          booking?.bookingCode ||
          booking?.bookingId ||
          Date.now().toString(
            36,
          )
        ),
      method:
        booking?.lastPaymentMethod ||
        booking?.paymentMethod ||
        'other',
      note:
        status ===
        BOOKING_PAYMENT_STATUS.PAID
          ? 'Pembayaran awal dari booking form'
          : 'DP awal dari booking form',
      source:
        'legacy-booking-payment',
    },
  ];
}

export function getBookingPaymentHistoryTotal(
  booking,
) {
  return getBookingPaymentHistory(
    booking,
  ).reduce(
    (
      sum,
      payment,
    ) =>
      sum +
      toMoney(
        payment?.amount,
      ),
    0,
  );
}

export function getBookingPaidAmount(
  booking,
) {
  const total =
    getBookingBillingTotal(
      booking,
    );

  const historyTotal =
    getBookingPaymentHistoryTotal(
      booking,
    );

  const status =
    getBookingPaymentStatus(
      booking,
    );

  if (
    historyTotal > 0
  ) {
    return Math.min(
      total ||
        historyTotal,
      historyTotal,
    );
  }

  if (
    status ===
    BOOKING_PAYMENT_STATUS.PAID
  ) {
    return total;
  }

  if (
    status ===
    BOOKING_PAYMENT_STATUS.PARTIAL
  ) {
    return Math.min(
      total ||
        Infinity,
      Math.max(
        getBookingDpAmount(
          booking,
        ),
        toMoney(
          booking?.paidAmount,
        ),
      ),
    );
  }

  return 0;
}

export function getBookingOutstandingAmount(
  booking,
) {
  const status =
    getBookingPaymentStatus(
      booking,
    );

  if (
    status ===
      BOOKING_PAYMENT_STATUS.PAID ||
    status ===
      BOOKING_PAYMENT_STATUS.REFUNDED ||
    status ===
      BOOKING_PAYMENT_STATUS.VOID
  ) {
    return 0;
  }

  const total =
    getBookingBillingTotal(
      booking,
    );

  const paid =
    getBookingPaidAmount(
      booking,
    );

  const calculated =
    Math.max(
      0,
      total -
        paid,
    );

  return Math.max(
    0,
    Number(
      booking?.invoiceAmount ||
      calculated,
    ) ||
      0,
  );
}

export function getBookingPaymentSummary(
  booking,
) {
  const status =
    getBookingPaymentStatus(
      booking,
    );

  const total =
    getBookingBillingTotal(
      booking,
    );

  const paid =
    getBookingPaidAmount(
      booking,
    );

  const outstanding =
    getBookingOutstandingAmount(
      booking,
    );

  return {
    isOpen:
      status ===
        BOOKING_PAYMENT_STATUS.UNPAID ||
      status ===
        BOOKING_PAYMENT_STATUS.PARTIAL,

    outstanding,
    paid,

    paymentHistory:
      getBookingPaymentHistory(
        booking,
      ),

    status,
    total,
  };
}

export function assertBookingPaymentCanApply(
  booking,
  payment,
) {
  const amount =
    toMoney(
      payment?.amount,
    );

  if (
    amount <= 0
  ) {
    throw new Error(
      'Nominal pembayaran wajib lebih dari 0.',
    );
  }

  const summary =
    getBookingPaymentSummary(
      booking,
    );

  if (
    summary.status ===
      BOOKING_PAYMENT_STATUS.VOID
  ) {
    throw new Error(
      'Pembayaran tidak bisa dicatat untuk invoice void.',
    );
  }

  if (
    summary.status ===
      BOOKING_PAYMENT_STATUS.REFUNDED
  ) {
    throw new Error(
      'Pembayaran tidak bisa dicatat untuk invoice refund.',
    );
  }

  if (
    summary.status ===
      BOOKING_PAYMENT_STATUS.PAID ||
    summary.outstanding <= 0
  ) {
    throw new Error(
      'Invoice sudah lunas.',
    );
  }

  if (
    amount >
    summary.outstanding
  ) {
    throw new Error(
      'Nominal pembayaran tidak boleh melebihi sisa tagihan.',
    );
  }

  return {
    amount,
    outstanding:
      summary.outstanding,
  };
}

export function buildBookingPaymentPatch(
  booking,
  payment,
) {
  const validation =
    assertBookingPaymentCanApply(
      booking,
      payment,
    );

  const normalizedPayment = {
    ...payment,
    amount:
      validation.amount,
  };

  const paymentHistory = [
    ...getBookingPaymentHistory(
      booking,
    ),
    normalizedPayment,
  ];

  const totalPaid =
    paymentHistory.reduce(
      (
        sum,
        item,
      ) =>
        sum +
        toMoney(
          item?.amount,
        ),
      0,
    );

  const total =
    getBookingBillingTotal(
      booking,
    );

  const invoiceAmount =
    Math.max(
      0,
      total -
        totalPaid,
    );

  const canonicalStatus =
    invoiceAmount <= 0
      ? BOOKING_PAYMENT_STATUS.PAID
      : BOOKING_PAYMENT_STATUS.PARTIAL;

  const legacyStatus =
    getLegacyWriteStatus(
      canonicalStatus,
    );

  return {
    ...booking,

    dpAmount:
      canonicalStatus ===
      BOOKING_PAYMENT_STATUS.PARTIAL
        ? totalPaid
        : 0,

    invoiceAmount,

    lastPaymentAt:
      normalizedPayment.createdAt ||
      new Date().toISOString(),

    lastPaymentMethod:
      normalizedPayment.method ||
      'other',

    paidAmount:
      Math.min(
        total ||
          totalPaid,
        totalPaid,
      ),

    paymentHistory,

    /**
     * Compatibility write:
     * existing Firestore documents remain legacy-compatible.
     * Canonical consumers read through getBookingPaymentStatus().
     */
    paymentStatus:
      legacyStatus,

    status:
      legacyStatus,

    updatedAt:
      new Date().toISOString(),
  };
}

export function buildBookingVoidPatch(
  booking,
  reason,
  options = {},
) {
  const cleanReason =
    cleanPaymentText(
      reason,
    );

  if (
    cleanReason.length < 4
  ) {
    throw new Error(
      'Alasan void wajib diisi minimal 4 karakter.',
    );
  }

  const summary =
    getBookingPaymentSummary(
      booking,
    );

  if (
    summary.status ===
    BOOKING_PAYMENT_STATUS.VOID
  ) {
    throw new Error(
      'Invoice sudah void.',
    );
  }

  const now =
    options.now ||
    new Date().toISOString();

  return {
    ...booking,

    invoiceAmount:
      0,

    paymentStatus:
      'void',

    previousInvoiceAmount:
      summary.outstanding,

    previousPaymentStatus:
      getLegacyWriteStatus(
        summary.status,
      ),

    status:
      'void',

    updatedAt:
      now,

    voidReason:
      cleanReason,

    voidedAt:
      now,
  };
}

export function buildPaymentFromProof(
  proof,
  overrides = {},
) {
  const now =
    new Date().toISOString();

  return {
    amount:
      toMoney(
        proof?.amount,
      ),

    category:
      proof?.category ||
      'dp',

    createdAt:
      overrides.createdAt ||
      now,

    date:
      overrides.date ||
      now.slice(
        0,
        10,
      ),

    id:
      overrides.id ||
      'pay_' +
        (
          proof?.id ||
          Date.now().toString(
            36,
          )
        ),

    method:
      proof?.method ||
      'transfer',

    note:
      overrides.note ||
      proof?.clientNote ||
      'Bukti pembayaran client',

    proofId:
      proof?.id ||
      '',

    proofPublicId:
      proof?.proofPublicId ||
      '',

    proofUrl:
      proof?.proofUrl ||
      '',

    source:
      'client-payment-proof',
  };
}
