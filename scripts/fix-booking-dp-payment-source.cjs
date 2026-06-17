const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STAMP = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

const BOOKING_FORM_FILE = 'src/components/schedule/BookingFormModal.jsx';

function fail(message) {
  console.error('\n❌ ' + message);
  process.exit(1);
}

function abs(file) {
  return path.join(ROOT, file);
}

function read(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) fail('File tidak ditemukan: ' + file);
  return fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
}

function backup(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) return;
  fs.copyFileSync(target, target + '.bak-' + STAMP);
}

function writeIfChanged(file, content) {
  const target = abs(file);
  const normalized = content.replace(/\r\n/g, '\n').trimEnd() + '\n';
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';

  if (current === normalized) {
    console.log('↔️  Tidak berubah: ' + file);
    return false;
  }

  backup(file);
  fs.writeFileSync(target, normalized, 'utf8');
  console.log('✍️  Ditulis: ' + file);
  return true;
}

function replaceOnce(text, find, replacement, label) {
  if (!text.includes(find)) fail('Anchor tidak ditemukan: ' + label);
  return text.replace(find, replacement);
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function findFunctionRange(text, functionName) {
  const signatures = [
    'function ' + functionName + '(',
    'async function ' + functionName + '(',
  ];

  let start = -1;

  for (const signature of signatures) {
    const index = text.indexOf(signature);

    if (index !== -1 && (start === -1 || index < start)) {
      start = index;
    }
  }

  if (start === -1) return null;

  const braceStart = text.indexOf('{', start);
  if (braceStart === -1) fail('Brace pembuka tidak ditemukan: ' + functionName);

  let depth = 0;
  let end = -1;

  for (let index = braceStart; index < text.length; index += 1) {
    const char = text[index];

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      end = index + 1;
      break;
    }
  }

  if (end === -1) fail('Brace penutup tidak ditemukan: ' + functionName);

  while (text[end] === '\n') end += 1;

  return { start, end };
}

function replaceFunctionByName(text, functionName, replacement) {
  const range = findFunctionRange(text, functionName);

  if (!range) fail('Function tidak ditemukan: ' + functionName);

  return text.slice(0, range.start) + replacement.trimEnd() + '\n\n' + text.slice(range.end);
}

function main() {
  let text = read(BOOKING_FORM_FILE);

  const requiredAnchors = [
    'function parseRupiahInput(value)',
    'function getInitialPaidAmount(',
    'function buildInitialPaymentHistory(',
    'async function handleSubmit(event)',
    'const cleanBandName = form.bandName.trim();',
    'dpAmount: parseRupiahInput(form.dpAmount),',
  ];

  for (const anchor of requiredAnchors) {
    if (!text.includes(anchor)) fail('Anchor BookingFormModal tidak ditemukan: ' + anchor);
  }

  text = replaceFunctionByName(
    text,
    'getInitialPaidAmount',
    `function getInitialPaidAmount(paymentStatus, totals, requestedDpAmount = 0) {
  const safeTotal = Number(totals.total) || 0;
  const safeRequestedDp = Number(requestedDpAmount) || 0;

  if (paymentStatus === 'lunas') return safeTotal;

  if (paymentStatus === 'dp') {
    return Math.min(safeTotal || safeRequestedDp, safeRequestedDp);
  }

  return 0;
}`
  );

  if (!text.includes('function isInitialBookingPayment(payment)')) {
    text = replaceOnce(
      text,
      'function buildInitialPaymentHistory({ bookingId, editingBooking, form, now, requestedDpAmount, totals }) {',
      `function isInitialBookingPayment(payment) {
  const source = String(payment?.source || '');
  const id = String(payment?.id || '');

  return source === 'booking-form' || source === 'legacy-booking-payment' || id === 'legacy-payment';
}

function buildInitialPaymentHistory({ bookingId, editingBooking, form, now, requestedDpAmount, totals }) {`,
      'insert isInitialBookingPayment helper'
    );
  }

  text = replaceFunctionByName(
    text,
    'buildInitialPaymentHistory',
    `function buildInitialPaymentHistory({ bookingId, editingBooking, form, now, requestedDpAmount, totals }) {
  const existingPaymentHistory = getExistingPaymentHistory(editingBooking);
  const preservedPayments = existingPaymentHistory.filter((payment) => !isInitialBookingPayment(payment));
  const initialPaidAmount = getInitialPaidAmount(form.paymentStatus, totals, requestedDpAmount);

  if (!initialPaidAmount) return preservedPayments;

  const previousInitialPayment = existingPaymentHistory.find(isInitialBookingPayment);

  return [
    {
      amount: initialPaidAmount,
      createdAt: previousInitialPayment?.createdAt || now,
      date: previousInitialPayment?.date || getTodayIsoDate(),
      id: previousInitialPayment?.id || makePaymentRecordId(),
      method: form.paymentMethod || previousInitialPayment?.method || 'cash',
      note: form.paymentStatus === 'lunas' ? 'Pembayaran awal dari booking form' : 'DP awal dari booking form',
      source: 'booking-form',
      bookingId,
    },
    ...preservedPayments,
  ];
}`
  );

  if (!text.includes('const requestedDpAmount = parseRupiahInput(form.dpAmount);\n\n    if (!cleanName')) {
    text = replaceOnce(
      text,
      `    const cleanBandName = form.bandName.trim();

    if (!cleanName`,
      `    const cleanBandName = form.bandName.trim();
    const requestedDpAmount = parseRupiahInput(form.dpAmount);

    if (!cleanName`,
      'move requestedDpAmount near validation'
    );
  }

  text = text.replace(
    `    if (form.paymentStatus === 'dp' && !totals.dpAmount) {`,
    `    if (form.paymentStatus === 'dp' && !requestedDpAmount) {`
  );

  text = text.replace(
    `    const now = new Date().toISOString();
    const requestedDpAmount = parseRupiahInput(form.dpAmount);
    const paymentHistory = buildInitialPaymentHistory({`,
    `    const now = new Date().toISOString();
    const paymentHistory = buildInitialPaymentHistory({`
  );

  if (countOccurrences(text, 'const requestedDpAmount = parseRupiahInput(form.dpAmount);') !== 1) {
    fail('Jumlah requestedDpAmount tidak valid.');
  }

  if (text.includes('if (form.paymentStatus === \'dp\' && !totals.dpAmount)')) {
    fail('Validasi DP masih memakai totals.dpAmount.');
  }

  if (text.includes('if (existingPaymentHistory.length) return existingPaymentHistory;')) {
    fail('Payment history lama masih dipakai mentah-mentah.');
  }

  const checks = [
    'function isInitialBookingPayment(payment)',
    'const preservedPayments = existingPaymentHistory.filter((payment) => !isInitialBookingPayment(payment));',
    'amount: initialPaidAmount',
    'source: \'booking-form\'',
    'if (form.paymentStatus === \'dp\' && !requestedDpAmount)',
    'dpAmount: parseRupiahInput(form.dpAmount),',
  ];

  for (const needle of checks) {
    if (!text.includes(needle)) fail('Verifikasi gagal: ' + needle);
  }

  writeIfChanged(BOOKING_FORM_FILE, text);

  console.log('\n✅ DP booking sekarang pakai nominal form sebagai sumber utama.');
  console.log('💰 Record booking-form lama akan diganti, jadi DP 50.000 tidak nyangkut jadi 47.000 lagi.');
}

main();