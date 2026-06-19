export function cleanPaymentText(value) {
  return String(value || '').trim();
}

export function cleanPaymentLower(value) {
  return cleanPaymentText(value).toLowerCase();
}

export function getBookingBillingTotal(booking) {
  return Number(booking?.total || booking?.subtotal || booking?.invoiceAmount || 0) || 0;
}

export function getBookingDpAmount(booking) {
  return Number(booking?.dpAmount || 0) || 0;
}

export function getBookingPaymentHistory(booking) {
  const rawHistory = Array.isArray(booking?.paymentHistory) ? booking.paymentHistory : [];

  if (rawHistory.length) return rawHistory;

  const status = cleanPaymentLower(booking?.paymentStatus || booking?.status || 'pending');

  if (status === 'void' || booking?.voidedAt) return [];

  const total = getBookingBillingTotal(booking);
  const dpAmount = getBookingDpAmount(booking);
  const legacyPaidAmount = status === 'lunas' ? total : status === 'dp' ? dpAmount : 0;

  if (!legacyPaidAmount) return [];

  const paymentDate = booking?.lastPaymentAt || booking?.createdAt || booking?.date || new Date().toISOString();

  return [
    {
      amount: legacyPaidAmount,
      createdAt: paymentDate,
      date: paymentDate,
      id: 'legacy_' + (booking?.id || booking?.bookingCode || booking?.bookingId || Date.now().toString(36)),
      method: booking?.lastPaymentMethod || booking?.paymentMethod || 'other',
      note: status === 'lunas' ? 'Pembayaran awal dari booking form' : 'DP awal dari booking form',
      source: 'legacy-booking-payment',
    },
  ];
}

export function getBookingPaymentHistoryTotal(booking) {
  return getBookingPaymentHistory(booking).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

export function getBookingPaidAmount(booking) {
  const total = getBookingBillingTotal(booking);
  const historyTotal = getBookingPaymentHistoryTotal(booking);
  const rawStatus = cleanPaymentLower(booking?.paymentStatus || booking?.status || 'pending');

  if (historyTotal > 0) return Math.min(total || historyTotal, historyTotal);
  if (rawStatus === 'lunas') return total;
  if (rawStatus === 'dp') return getBookingDpAmount(booking);

  return 0;
}

export function getBookingOutstandingAmount(booking) {
  const total = getBookingBillingTotal(booking);
  const paid = getBookingPaidAmount(booking);
  const status = cleanPaymentLower(booking?.paymentStatus || booking?.status || 'pending');

  if (status === 'lunas' || status === 'void') return 0;

  return Math.max(0, Number(booking?.invoiceAmount || total - paid) || 0);
}

export function buildBookingPaymentPatch(booking, payment) {
  const paymentHistory = [...getBookingPaymentHistory(booking), payment];
  const totalPaid = paymentHistory.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const total = getBookingBillingTotal(booking);
  const invoiceAmount = Math.max(0, total - totalPaid);
  const nextStatus = invoiceAmount <= 0 ? 'lunas' : totalPaid > 0 ? 'dp' : 'pending';

  return {
    ...booking,
    dpAmount: nextStatus === 'dp' ? totalPaid : 0,
    invoiceAmount,
    lastPaymentAt: payment.createdAt,
    lastPaymentMethod: payment.method,
    paidAmount: Math.min(total || totalPaid, totalPaid),
    paymentHistory,
    paymentStatus: nextStatus,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };
}

export function buildPaymentFromProof(proof, overrides = {}) {
  const now = new Date().toISOString();

  return {
    amount: Number(proof?.amount || 0),
    category: proof?.category || 'dp',
    createdAt: overrides.createdAt || now,
    date: overrides.date || now.slice(0, 10),
    id: overrides.id || 'pay_' + (proof?.id || Date.now().toString(36)),
    method: proof?.method || 'transfer',
    note: overrides.note || proof?.clientNote || 'Bukti pembayaran client',
    proofId: proof?.id || '',
    proofPublicId: proof?.proofPublicId || '',
    proofUrl: proof?.proofUrl || '',
    source: 'client-payment-proof',
  };
}
