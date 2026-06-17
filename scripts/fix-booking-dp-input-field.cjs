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

function removeBlockBetween(text, startNeedle, endNeedle, label) {
  const start = text.indexOf(startNeedle);

  if (start === -1) {
    console.log('↔️  Orphan block tidak ditemukan, skip: ' + label);
    return text;
  }

  const end = text.indexOf(endNeedle, start);

  if (end === -1) fail('End anchor tidak ditemukan untuk: ' + label);

  console.log('🧹 Menghapus orphan block: ' + label);

  return text.slice(0, start).trimEnd() + '\n\n' + text.slice(end);
}

function findFunctionRange(text, functionName) {
  const signature = 'function ' + functionName + '(';
  const start = text.indexOf(signature);

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

function replaceFunction(text, functionName, replacement) {
  const range = findFunctionRange(text, functionName);

  if (!range) fail('Function tidak ditemukan: ' + functionName);

  return text.slice(0, range.start) + replacement.trimEnd() + '\n\n' + text.slice(range.end);
}

function ensureHelperAfterParseRupiah(text) {
  if (text.includes('function normalizeMoneyInputValue(value)')) return text;

  return replaceOnce(
    text,
    `function parseRupiahInput(value) {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  if (/^\\d+$/.test(raw)) {
    return Number(raw) || 0;
  }

  const digitsOnly = raw.replace(/\\D/g, '');

  return Number(digitsOnly) || 0;
}

`,
    `function parseRupiahInput(value) {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  if (/^\\d+$/.test(raw)) {
    return Number(raw) || 0;
  }

  const digitsOnly = raw.replace(/\\D/g, '');

  return Number(digitsOnly) || 0;
}

function normalizeMoneyInputValue(value) {
  const digitsOnly = String(value ?? '').replace(/\\D/g, '');

  return digitsOnly.replace(/^0+(?=\\d)/, '');
}

`,
    'insert normalizeMoneyInputValue'
  );
}

function ensureInitialPaymentHelper(text) {
  if (text.includes('function isInitialBookingPayment(payment)')) return text;

  return replaceOnce(
    text,
    'function buildInitialPaymentHistory(',
    `function isInitialBookingPayment(payment) {
  const source = String(payment?.source || '');
  const id = String(payment?.id || '');

  return source === 'booking-form' || source === 'legacy-booking-payment' || id === 'legacy-payment';
}

function buildInitialPaymentHistory(`,
    'insert isInitialBookingPayment'
  );
}

function patchUpdateField(text) {
  const oldBlock = `  function updateField(field) {
    return (event) => {
      const nextValue = event.target.value;

      setForm((current) => ({
        ...current,
        [field]: nextValue,
      }));

      if (error) setError('');
    };
  }`;

  const newBlock = `  function updateField(field) {
    return (event) => {
      const nextValue = field === 'dpAmount'
        ? normalizeMoneyInputValue(event.target.value)
        : event.target.value;

      setForm((current) => ({
        ...current,
        [field]: nextValue,
      }));

      if (error) setError('');
    };
  }`;

  if (text.includes(newBlock)) return text;

  return replaceOnce(text, oldBlock, newBlock, 'updateField dpAmount sanitizer');
}

function patchDpField(text) {
  let next = text;

  next = next.replace(
    `                placeholder="Contoh 50000"`,
    `                placeholder="Contoh 50000 atau 50.000"`
  );

  next = next.replace(
    `                type="number"`,
    `                type="text"`
  );

  next = next.replace(
    /\n\s*step="1000"/g,
    ''
  );

  return next;
}

function main() {
  let text = read(BOOKING_FORM_FILE);

  const requiredAnchors = [
    'function parseRupiahInput(value)',
    'function getInitialPaidAmount(',
    'function buildInitialPaymentHistory(',
    'function updateField(field)',
    'async function handleSubmit(event)',
    'id="booking-dp-amount"',
  ];

  for (const anchor of requiredAnchors) {
    if (!text.includes(anchor)) fail('Anchor BookingFormModal tidak ditemukan: ' + anchor);
  }

  text = removeBlockBetween(
    text,
    '\n) {\n  const existingPaymentHistory = getExistingPaymentHistory(editingBooking);\n',
    '\nexport default function BookingFormModal',
    'duplicate old buildInitialPaymentHistory'
  );

  text = ensureHelperAfterParseRupiah(text);
  text = ensureInitialPaymentHelper(text);

  text = replaceFunction(
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

  text = replaceFunction(
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

  text = patchUpdateField(text);
  text = patchDpField(text);

  text = text.replace(/\n\s*const requestedDpAmount = parseRupiahInput\(form\.dpAmount\);\n/g, '\n');

  text = replaceOnce(
    text,
    `    const cleanBandName = form.bandName.trim();

    if (!cleanName`,
    `    const cleanBandName = form.bandName.trim();
    const requestedDpAmount = parseRupiahInput(form.dpAmount);

    if (!cleanName`,
    'requestedDpAmount near validation'
  );

  text = text.replace(
    `if (form.paymentStatus === 'dp' && !totals.dpAmount)`,
    `if (form.paymentStatus === 'dp' && !requestedDpAmount)`
  );

  text = text.replace(
    `dpAmount: form.dpAmount,`,
    `dpAmount: parseRupiahInput(form.dpAmount),`
  );

  if (!text.includes('requestedDpAmount,\n      totals,')) {
    text = replaceOnce(
      text,
      `      now,
      totals,`,
      `      now,
      requestedDpAmount,
      totals,`,
      'requestedDpAmount into payment history call'
    );
  }

  text = text.replace(/\n\s*if \(existingPaymentHistory\.length\) return existingPaymentHistory;\n/g, '\n');

  if (/^\) \{$/m.test(text)) {
    const badLines = text
      .split('\n')
      .map((line, index) => (line === ') {' ? index + 1 : null))
      .filter(Boolean);

    fail('Masih ada orphan top-level ") {" di line: ' + badLines.join(', '));
  }

  const checks = [
    'function normalizeMoneyInputValue(value)',
    "const nextValue = field === 'dpAmount'",
    'type="text"',
    'placeholder="Contoh 50000 atau 50.000"',
    'function isInitialBookingPayment(payment)',
    'const preservedPayments = existingPaymentHistory.filter((payment) => !isInitialBookingPayment(payment));',
    'const initialPaidAmount = getInitialPaidAmount(form.paymentStatus, totals, requestedDpAmount);',
    'const requestedDpAmount = parseRupiahInput(form.dpAmount);',
    "if (form.paymentStatus === 'dp' && !requestedDpAmount)",
    'dpAmount: parseRupiahInput(form.dpAmount),',
    'requestedDpAmount,\n      totals,',
  ];

  for (const needle of checks) {
    if (!text.includes(needle)) fail('Verifikasi gagal: ' + needle);
  }

  if (text.includes('if (existingPaymentHistory.length) return existingPaymentHistory;')) {
    fail('Early-return payment history lama masih ada.');
  }

  if (text.includes("if (form.paymentStatus === 'dp' && !totals.dpAmount)")) {
    fail('Validasi DP masih memakai totals.dpAmount.');
  }

  if (countOccurrences(text, 'const requestedDpAmount = parseRupiahInput(form.dpAmount);') !== 1) {
    fail('Jumlah requestedDpAmount tidak valid.');
  }

  if (countOccurrences(text, 'function buildInitialPaymentHistory(') !== 1) {
    fail('Jumlah buildInitialPaymentHistory tidak valid.');
  }

  writeIfChanged(BOOKING_FORM_FILE, text);

  console.log('\n✅ DP input field sudah distabilkan.');
  console.log('💰 Field DP sekarang text numeric tersanitasi, bukan native number.');
}

main();