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

export function getBookingCashReceivedAmount(
  booking,
) {
  return getBookingPaymentHistoryTotal(
    booking,
  );
}

export function getBookingRefundHistory(
  booking,
) {
  const rawHistory =
    Array.isArray(
      booking?.refundHistory,
    )
      ? booking.refundHistory
      : [];

  const validHistory =
    rawHistory.filter(
      (
        refund,
      ) =>
        toMoney(
          refund?.amount,
        ) > 0,
    );

  if (
    validHistory.length
  ) {
    return validHistory;
  }

  const legacyAmount =
    toMoney(
      booking?.refundedAmount,
    );

  if (
    legacyAmount <= 0
  ) {
    return [];
  }

  const refundDate =
    booking?.lastRefundAt ||
    booking?.refundCompletedAt ||
    booking?.updatedAt ||
    booking?.createdAt ||
    booking?.date ||
    '';

  return [
    {
      amount:
        legacyAmount,

      createdAt:
        refundDate,

      date:
        refundDate,

      id:
        'legacy_refund_' +
        (
          booking?.id ||
          booking?.bookingCode ||
          booking?.bookingId ||
          'booking'
        ),

      method:
        booking?.lastRefundMethod ||
        'other',

      reason:
        booking?.lastRefundReason ||
        'Refund legacy',

      source:
        'legacy-booking-refund',
    },
  ];
}

export function getBookingRefundedAmount(
  booking,
) {
  return getBookingRefundHistory(
    booking,
  ).reduce(
    (
      total,
      refund,
    ) =>
      total +
      toMoney(
        refund?.amount,
      ),
    0,
  );
}

export function getBookingRefundableAmount(
  booking,
) {
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
    return 0;
  }

  return Math.max(
    0,
    getBookingCashReceivedAmount(
      booking,
    ) -
      getBookingRefundedAmount(
        booking,
      ),
  );
}

export function getBookingRefundStatus(
  booking,
) {
  const canonicalStatus =
    getBookingPaymentStatus(
      booking,
    );

  if (
    canonicalStatus ===
    BOOKING_PAYMENT_STATUS.REFUNDED
  ) {
    return 'full';
  }

  const cashReceived =
    getBookingCashReceivedAmount(
      booking,
    );

  const refunded =
    getBookingRefundedAmount(
      booking,
    );

  if (
    cashReceived > 0 &&
    refunded >=
      cashReceived
  ) {
    return 'full';
  }

  if (
    refunded > 0
  ) {
    return 'partial';
  }

  return 'none';
}

export function getBookingFinanceSnapshot(
  booking,
) {
  const summary =
    getBookingPaymentSummary(
      booking,
    );

  const cashReceived =
    getBookingCashReceivedAmount(
      booking,
    );

  const cashRefunded =
    getBookingRefundedAmount(
      booking,
    );

  const refundStatus =
    getBookingRefundStatus(
      booking,
    );

  const refundable =
    getBookingRefundableAmount(
      booking,
    );

  return {
    cashReceived,

    cashRefunded,

    hasPayments:
      cashReceived > 0,

    hasRefunds:
      cashRefunded > 0,

    isOpen:
      summary.isOpen,

    isPaid:
      summary.status ===
      BOOKING_PAYMENT_STATUS.PAID,

    isRefunded:
      summary.status ===
        BOOKING_PAYMENT_STATUS.REFUNDED ||
      refundStatus ===
        'full',

    isVoid:
      summary.status ===
      BOOKING_PAYMENT_STATUS.VOID,

    netCashReceived:
      Math.max(
        0,
        cashReceived -
          cashRefunded,
      ),

    outstanding:
      summary.outstanding,

    paid:
      summary.paid,

    paymentHistory:
      summary.paymentHistory,

    refundable,

    refundHistory:
      getBookingRefundHistory(
        booking,
      ),

    refundStatus,

    status:
      summary.status,

    total:
      summary.total,
  };
}

export function canVoidBookingInvoice(
  booking,
) {
  const finance =
    getBookingFinanceSnapshot(
      booking,
    );

  if (
    finance.isVoid ||
    finance.isRefunded
  ) {
    return false;
  }

  return (
    finance.paid <= 0 &&
    finance.cashReceived <= 0
  );
}

export function canRefundBookingPayment(
  booking,
) {
  const finance =
    getBookingFinanceSnapshot(
      booking,
    );

  if (
    finance.isVoid ||
    finance.isRefunded
  ) {
    return false;
  }

  return (
    finance.cashReceived > 0 &&
    finance.refundable > 0
  );
}

export function assertBookingRefundCanApply(
  booking,
  refund,
) {
  const amount =
    toMoney(
      refund?.amount,
    );

  const reason =
    cleanPaymentText(
      refund?.reason,
    );

  if (
    amount <= 0
  ) {
    throw new Error(
      'Nominal refund wajib lebih dari 0.',
    );
  }

  if (
    reason.length < 4
  ) {
    throw new Error(
      'Alasan refund wajib diisi minimal 4 karakter.',
    );
  }

  const finance =
    getBookingFinanceSnapshot(
      booking,
    );

  if (
    finance.isVoid
  ) {
    throw new Error(
      'Invoice void tidak bisa direfund.',
    );
  }

  if (
    finance.isRefunded ||
    finance.refundStatus ===
      'full'
  ) {
    throw new Error(
      'Seluruh pembayaran invoice sudah direfund.',
    );
  }

  if (
    finance.cashReceived <= 0
  ) {
    throw new Error(
      'Invoice belum memiliki pembayaran yang bisa direfund.',
    );
  }

  if (
    finance.refundable <= 0
  ) {
    throw new Error(
      'Tidak ada saldo pembayaran yang bisa direfund.',
    );
  }

  if (
    amount >
    finance.refundable
  ) {
    throw new Error(
      'Nominal refund tidak boleh melebihi saldo pembayaran yang dapat direfund.',
    );
  }

  return {
    amount,
    reason,

    refundable:
      finance.refundable,
  };
}

export function buildBookingRefundPatch(
  booking,
  refund,
) {
  const validation =
    assertBookingRefundCanApply(
      booking,
      refund,
    );

  const now =
    refund?.createdAt ||
    new Date().toISOString();

  const normalizedRefund = {
    ...refund,

    amount:
      validation.amount,

    createdAt:
      now,

    date:
      refund?.date ||
      String(now).slice(
        0,
        10,
      ),

    id:
      refund?.id ||
      'refund_' +
        Date.now().toString(
          36,
        ),

    method:
      cleanPaymentText(
        refund?.method,
      ) ||
      'other',

    reason:
      validation.reason,

    source:
      refund?.source ||
      'admin-refund',
  };

  const refundHistory = [
    ...getBookingRefundHistory(
      booking,
    ),
    normalizedRefund,
  ];

  const refundedAmount =
    refundHistory.reduce(
      (
        total,
        item,
      ) =>
        total +
        toMoney(
          item?.amount,
        ),
      0,
    );

  const cashReceived =
    getBookingCashReceivedAmount(
      booking,
    );

  const isFullRefund =
    cashReceived > 0 &&
    refundedAmount >=
      cashReceived;

  const currentStatus =
    getBookingPaymentStatus(
      booking,
    );

  const paymentStatusBeforeRefund =
    booking?.paymentStatusBeforeRefund ||
    getLegacyWriteStatus(
      currentStatus,
    );

  const patch = {
    ...booking,

    lastRefundAt:
      normalizedRefund.createdAt,

    lastRefundMethod:
      normalizedRefund.method,

    lastRefundReason:
      normalizedRefund.reason,

    paymentStatusBeforeRefund,

    refundedAmount:

      refundedAmount,

    refundHistory,

    refundStatus:
      isFullRefund
        ? 'full'
        : 'partial',

    updatedAt:
      now,
  };

  if (
    isFullRefund
  ) {
    patch.invoiceAmount =
      0;

    patch.paymentStatus =
      'refunded';

    patch.refundCompletedAt =
      now;

    patch.status =
      'refunded';
  }

  return patch;
}

export function buildBookingIncomeTransactions(
  bookings,
) {
  const safeBookings =
    Array.isArray(
      bookings,
    )
      ? bookings
      : [];

  return safeBookings.flatMap(
    (
      booking,
    ) => {
      const bookingId =
        booking?.id ||
        booking?.bookingId ||
        booking?.bookingCode ||
        'unknown';

      return getBookingPaymentHistory(
        booking,
      )
        .filter(
          (
            payment,
          ) =>
            toMoney(
              payment?.amount,
            ) > 0,
        )
        .map(
          (
            payment,
            index,
          ) => {
            const paymentId =
              payment?.id ||
              payment?.proofId ||
              String(index);

            return {
              amount:
                toMoney(
                  payment?.amount,
                ),

              bookingId,

              customer:
                booking?.customer ||
                booking?.customerName ||
                booking?.name ||
                'Customer',

              date:
                payment?.date ||
                payment?.createdAt ||
                payment?.paidAt ||
                booking?.date ||
                booking?.createdAt ||
                '',

              id:
                'booking-' +
                bookingId +
                '-' +
                paymentId,

              invoiceNumber:
                booking?.invoiceNumber ||
                '',

              method:
                cleanPaymentText(
                  payment?.method ||
                  payment?.paymentMethod ||
                  booking?.lastPaymentMethod ||
                  booking?.paymentMethod ||
                  'other',
                ),

              note:
                booking?.invoiceNumber ||
                booking?.bookingCode ||
                'Pembayaran booking',

              source:
                'booking',

              title:
                'Booking - ' +
                (
                  booking?.customer ||
                  booking?.customerName ||
                  booking?.name ||
                  'Customer'
                ),

              type:
                'income',
            };
          },
        );
    },
  );
}

export function buildBookingRefundTransactions(
  bookings,
) {
  const safeBookings =
    Array.isArray(
      bookings,
    )
      ? bookings
      : [];

  return safeBookings.flatMap(
    (
      booking,
    ) => {
      const bookingId =
        booking?.id ||
        booking?.bookingId ||
        booking?.bookingCode ||
        'unknown';

      return getBookingRefundHistory(
        booking,
      ).map(
        (
          refund,
          index,
        ) => {
          const refundId =
            refund?.id ||
            String(index);

          return {
            amount:
              toMoney(
                refund?.amount,
              ),

            bookingId,

            customer:
              booking?.customer ||
              booking?.customerName ||
              booking?.name ||
              'Customer',

            date:
              refund?.date ||
              refund?.createdAt ||
              booking?.updatedAt ||
              booking?.date ||
              '',

            id:
              'booking-refund-' +
              bookingId +
              '-' +
              refundId,

            invoiceNumber:
              booking?.invoiceNumber ||
              '',

            method:
              cleanPaymentText(
                refund?.method ||
                'other',
              ),

            note:
              cleanPaymentText(
                refund?.reason,
              ) ||
              booking?.invoiceNumber ||
              booking?.bookingCode ||
              'Refund booking',

            source:
              'booking-refund',

            title:
              'Refund - ' +
              (
                booking?.customer ||
                booking?.customerName ||
                booking?.name ||
                'Customer'
              ),

            type:
              'expense',
          };
        },
      );
    },
  );
}

export function buildBookingFinanceTransactions(
  bookings,
) {
  return [
    ...buildBookingIncomeTransactions(
      bookings,
    ),

    ...buildBookingRefundTransactions(
      bookings,
    ),
  ];
}

export function getBookingFinanceTotals(
  bookings,
) {
  const safeBookings =
    Array.isArray(
      bookings,
    )
      ? bookings
      : [];

  return safeBookings.reduce(
    (
      totals,
      booking,
    ) => {
      const finance =
        getBookingFinanceSnapshot(
          booking,
        );

      totals.totalBookings +=
        1;

      totals.cashReceived +=
        finance.cashReceived;

      totals.cashRefunded +=
        finance.cashRefunded;

      totals.netCashReceived +=
        finance.netCashReceived;

      totals.outstanding +=
        finance.outstanding;

      if (
        !finance.isVoid
      ) {
        totals.grossBilled +=
          finance.total;
      }

      if (
        finance.isOpen
      ) {
        totals.openInvoices +=
          1;
      }

      if (
        finance.isPaid
      ) {
        totals.paidInvoices +=
          1;
      }

      if (
        finance.isVoid
      ) {
        totals.voidInvoices +=
          1;
      }

      if (
        finance.isRefunded
      ) {
        totals.refundedInvoices +=
          1;
      }

      if (
        finance.refundStatus ===
        'partial'
      ) {
        totals.partialRefundInvoices +=
          1;
      }

      return totals;
    },
    {
      cashReceived:
        0,

      cashRefunded:
        0,

      grossBilled:
        0,

      netCashReceived:
        0,

      openInvoices:
        0,

      outstanding:
        0,

      paidInvoices:
        0,

      partialRefundInvoices:
        0,

      refundedInvoices:
        0,

      totalBookings:
        0,

      voidInvoices:
        0,
    },
  );
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

  if (
    summary.status ===
    BOOKING_PAYMENT_STATUS.REFUNDED
  ) {
    throw new Error(
      'Invoice refund tidak bisa di-void.',
    );
  }

  if (
    summary.paid > 0 ||
    getBookingPaymentHistoryTotal(
      booking,
    ) > 0
  ) {
    throw new Error(
      'Invoice yang sudah memiliki pembayaran tidak bisa di-void. Gunakan refund.',
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
