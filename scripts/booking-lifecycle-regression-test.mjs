import assert from 'node:assert/strict';

import {
  buildBookingPaymentPatch,
  buildPaymentFromProof,
  getBookingBillingTotal,
  getBookingDpAmount,
  getBookingOutstandingAmount,
  getBookingPaidAmount,
  getBookingPaymentHistory,
  getBookingPaymentHistoryTotal,
} from '../src/utils/bookingPaymentUtils.js';

import {
  paymentStatusOptions,
  statusFilters,
} from '../src/constants/scheduleConfig.js';

function makeBooking(overrides = {}) {
  return {
    id: 'booking-regression-001',
    bookingCode: 'BKG-20260808-TEST1',
    customer: 'Regression Customer',
    date: '2026-08-08',
    total: 600000,
    paymentHistory: [],
    paymentStatus: 'pending',
    status: 'pending',
    ...overrides,
  };
}

function makePayment(overrides = {}) {
  return {
    id: 'pay-regression-001',
    amount: 250000,
    method: 'transfer',
    createdAt: '2026-08-08T12:00:00.000Z',
    date: '2026-08-08',
    note: 'Regression payment',
    source: 'regression-test',
    ...overrides,
  };
}

/**
 * Contract 1
 *
 * Legacy payment vocabulary masih harus tersedia sampai seluruh consumer
 * selesai dipindahkan ke canonical domain model.
 */
{
  assert.deepEqual(
    paymentStatusOptions.map((item) => item.key),
    ['pending', 'dp', 'lunas'],
    'Legacy paymentStatusOptions berubah sebelum compatibility migration selesai.',
  );

  assert.deepEqual(
    statusFilters.map((item) => item.key),
    ['pending', 'dp', 'lunas'],
    'Legacy schedule status filters berubah sebelum compatibility migration selesai.',
  );
}

/**
 * Contract 2
 *
 * Booking pending belum mempunyai pembayaran.
 */
{
  const booking = makeBooking();

  assert.equal(
    getBookingBillingTotal(booking),
    600000,
    'Total billing booking pending harus tetap Rp600.000.',
  );

  assert.equal(
    getBookingDpAmount(booking),
    0,
    'Booking pending tidak boleh mempunyai DP.',
  );

  assert.equal(
    getBookingPaidAmount(booking),
    0,
    'Booking pending tidak boleh dianggap sudah bayar.',
  );

  assert.equal(
    getBookingOutstandingAmount(booking),
    600000,
    'Outstanding booking pending harus sama dengan total invoice.',
  );

  assert.deepEqual(
    getBookingPaymentHistory(booking),
    [],
    'Booking pending tanpa pembayaran harus memiliki history kosong.',
  );
}

/**
 * Contract 3
 *
 * Data legacy paymentStatus=dp harus tetap dapat dibaca walaupun belum
 * mempunyai paymentHistory modern.
 */
{
  const booking = makeBooking({
    paymentStatus: 'dp',
    status: 'dp',
    dpAmount: 200000,
  });

  const history = getBookingPaymentHistory(booking);

  assert.equal(
    history.length,
    1,
    'Legacy DP harus disintesis menjadi satu payment history.',
  );

  assert.equal(
    history[0].amount,
    200000,
    'Nominal synthetic legacy DP salah.',
  );

  assert.equal(
    history[0].source,
    'legacy-booking-payment',
    'Synthetic legacy DP harus memiliki source yang dapat dilacak.',
  );

  assert.equal(
    getBookingPaidAmount(booking),
    200000,
    'Paid amount legacy DP salah.',
  );

  assert.equal(
    getBookingOutstandingAmount(booking),
    400000,
    'Outstanding legacy DP salah.',
  );
}

/**
 * Contract 4
 *
 * Legacy lunas harus tetap dianggap paid penuh walaupun paymentHistory
 * belum tersedia.
 */
{
  const booking = makeBooking({
    paymentStatus: 'lunas',
    status: 'lunas',
  });

  const history = getBookingPaymentHistory(booking);

  assert.equal(
    history.length,
    1,
    'Legacy lunas harus memiliki synthetic payment history.',
  );

  assert.equal(
    history[0].amount,
    600000,
    'Synthetic legacy full payment harus sama dengan total booking.',
  );

  assert.equal(
    getBookingPaidAmount(booking),
    600000,
    'Legacy lunas harus dianggap paid penuh.',
  );

  assert.equal(
    getBookingOutstandingAmount(booking),
    0,
    'Legacy lunas tidak boleh mempunyai outstanding.',
  );
}

/**
 * Contract 5
 *
 * paymentHistory modern menjadi sumber nominal pembayaran ketika tersedia.
 */
{
  const booking = makeBooking({
    paymentStatus: 'dp',
    status: 'dp',
    dpAmount: 100000,
    invoiceAmount: 400000,
    paymentHistory: [
      {
        id: 'pay-history-1',
        amount: 150000,
        method: 'transfer',
        createdAt: '2026-08-08T10:00:00.000Z',
      },
      {
        id: 'pay-history-2',
        amount: 50000,
        method: 'cash',
        createdAt: '2026-08-08T11:00:00.000Z',
      },
    ],
  });

  assert.equal(
    getBookingPaymentHistoryTotal(booking),
    200000,
    'Total payment history modern salah.',
  );

  assert.equal(
    getBookingPaidAmount(booking),
    200000,
    'Paid amount harus mengikuti payment history modern.',
  );

  assert.equal(
    getBookingOutstandingAmount(booking),
    400000,
    'Outstanding harus mengikuti invoiceAmount yang tersisa.',
  );
}

/**
 * Contract 6
 *
 * Pembayaran pertama sebagian harus mengubah booking menjadi DP,
 * menambah history, dan menghitung outstanding.
 */
{
  const booking = makeBooking();
  const payment = makePayment();

  const nextBooking = buildBookingPaymentPatch(booking, payment);

  assert.notEqual(
    nextBooking,
    booking,
    'Payment patch tidak boleh memutasi object booking asli.',
  );

  assert.equal(
    booking.paymentHistory.length,
    0,
    'Object booking asli termutasi oleh buildBookingPaymentPatch.',
  );

  assert.equal(
    nextBooking.paymentStatus,
    'dp',
    'Pembayaran sebagian harus menghasilkan legacy paymentStatus=dp.',
  );

  assert.equal(
    nextBooking.status,
    'dp',
    'Legacy status harus tetap sinkron selama compatibility phase.',
  );

  assert.equal(
    nextBooking.dpAmount,
    250000,
    'DP amount setelah pembayaran pertama salah.',
  );

  assert.equal(
    nextBooking.paidAmount,
    250000,
    'Paid amount setelah pembayaran pertama salah.',
  );

  assert.equal(
    nextBooking.invoiceAmount,
    350000,
    'Outstanding invoice setelah pembayaran pertama salah.',
  );

  assert.equal(
    nextBooking.paymentHistory.length,
    1,
    'Payment pertama harus masuk paymentHistory.',
  );

  assert.equal(
    nextBooking.paymentHistory[0].id,
    'pay-regression-001',
    'Payment history kehilangan payment identity.',
  );
}

/**
 * Contract 7
 *
 * Pelunasan setelah DP harus mempertahankan history lama dan menutup invoice.
 */
{
  const initialBooking = makeBooking();

  const partialBooking = buildBookingPaymentPatch(
    initialBooking,
    makePayment({
      id: 'pay-partial',
      amount: 250000,
    }),
  );

  const paidBooking = buildBookingPaymentPatch(
    partialBooking,
    makePayment({
      id: 'pay-final',
      amount: 350000,
      method: 'cash',
      createdAt: '2026-08-08T15:00:00.000Z',
    }),
  );

  assert.equal(
    paidBooking.paymentStatus,
    'lunas',
    'Pelunasan penuh harus menghasilkan legacy paymentStatus=lunas.',
  );

  assert.equal(
    paidBooking.status,
    'lunas',
    'Legacy status harus sinkron dengan paymentStatus=lunas.',
  );

  assert.equal(
    paidBooking.paidAmount,
    600000,
    'Paid amount setelah lunas salah.',
  );

  assert.equal(
    paidBooking.invoiceAmount,
    0,
    'Invoice lunas harus memiliki outstanding 0.',
  );

  assert.equal(
    paidBooking.dpAmount,
    0,
    'DP amount harus kembali 0 setelah lunas.',
  );

  assert.equal(
    paidBooking.paymentHistory.length,
    2,
    'History DP dan pelunasan harus sama-sama dipertahankan.',
  );

  assert.deepEqual(
    paidBooking.paymentHistory.map((payment) => payment.id),
    ['pay-partial', 'pay-final'],
    'Urutan payment history berubah.',
  );
}

/**
 * Contract 8
 *
 * Invoice void tidak mempunyai outstanding.
 */
{
  const booking = makeBooking({
    paymentStatus: 'void',
    status: 'void',
    voidedAt: '2026-08-08T16:00:00.000Z',
  });

  assert.equal(
    getBookingOutstandingAmount(booking),
    0,
    'Invoice void tidak boleh mempunyai outstanding.',
  );

  assert.deepEqual(
    getBookingPaymentHistory(booking),
    [],
    'Invoice void tanpa real payment history tidak boleh membuat synthetic payment.',
  );
}

/**
 * Contract 9
 *
 * Payment yang berasal dari payment proof harus mempertahankan traceability
 * terhadap bukti yang disetujui.
 */
{
  const proof = {
    id: 'proof-regression-001',
    amount: 300000,
    category: 'dp',
    method: 'qris',
    clientNote: 'DP via QRIS',
    proofPublicId: 'cloudinary-proof-001',
    proofUrl: 'https://example.test/proof.jpg',
  };

  const payment = buildPaymentFromProof(proof, {
    id: 'pay-from-proof-001',
    createdAt: '2026-08-08T17:00:00.000Z',
    date: '2026-08-08',
    note: 'Approved by regression test',
  });

  assert.equal(
    payment.id,
    'pay-from-proof-001',
    'Payment proof conversion kehilangan payment id.',
  );

  assert.equal(
    payment.amount,
    300000,
    'Nominal payment proof conversion salah.',
  );

  assert.equal(
    payment.category,
    'dp',
    'Payment category dari proof berubah.',
  );

  assert.equal(
    payment.method,
    'qris',
    'Payment method dari proof berubah.',
  );

  assert.equal(
    payment.proofId,
    'proof-regression-001',
    'Payment harus menyimpan proofId.',
  );

  assert.equal(
    payment.proofPublicId,
    'cloudinary-proof-001',
    'Payment harus menyimpan proofPublicId.',
  );

  assert.equal(
    payment.proofUrl,
    'https://example.test/proof.jpg',
    'Payment harus menyimpan proofUrl.',
  );

  assert.equal(
    payment.source,
    'client-payment-proof',
    'Payment proof harus mempunyai source yang traceable.',
  );
}

/**
 * Contract 10
 *
 * Billing total tetap kompatibel dengan dokumen legacy yang menggunakan
 * subtotal atau invoiceAmount sebagai fallback.
 */
{
  assert.equal(
    getBookingBillingTotal({
      subtotal: 450000,
    }),
    450000,
    'Legacy subtotal fallback rusak.',
  );

  assert.equal(
    getBookingBillingTotal({
      invoiceAmount: 325000,
    }),
    325000,
    'Legacy invoiceAmount fallback rusak.',
  );
}

process.stdout.write('✅ Booking lifecycle regression test passed.\n');
