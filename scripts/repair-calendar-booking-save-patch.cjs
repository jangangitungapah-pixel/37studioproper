const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const TARGET = path.join(
  ROOT,
  'scripts',
  'fix-calendar-booking-save.cjs',
);

function fail(message) {
  console.error('');
  console.error(`[repair] ${message}`);
  console.error('');
  process.exit(1);
}

if (!fs.existsSync(TARGET)) {
  fail(
    'scripts/fix-calendar-booking-save.cjs tidak ditemukan.',
  );
}

let source = fs
  .readFileSync(
    TARGET,
    'utf8',
  )
  .replace(/\r\n/g, '\n');

const broken = "    `resolveBookingCustomerIdentity(\n        booking,\n        bookings\n      )`,";

const fixed =
  '    "resolveBookingCustomerIdentity(\\n        booking,\\n        bookings\\n      )",';

const count =
  source.split(broken).length - 1;

if (count === 0) {
  if (source.includes(fixed)) {
    console.log(
      '✅ Patch script sudah diperbaiki sebelumnya.',
    );

    process.exit(0);
  }

  fail(
    'Broken nested template literal tidak ditemukan.',
  );
}

if (count !== 1) {
  fail(
    `Expected 1 broken template literal, found ${count}.`,
  );
}

source =
  source.replace(
    broken,
    fixed,
  );

if (source.includes(broken)) {
  fail(
    'Broken template literal masih tersisa.',
  );
}

if (!source.includes(fixed)) {
  fail(
    'Replacement tidak berhasil dipasang.',
  );
}

fs.writeFileSync(
  TARGET,
  source,
  'utf8',
);

console.log('');
console.log(
  '✅ fix-calendar-booking-save.cjs repaired.',
);
console.log(
  'Nested backtick di regression test sudah dihilangkan.',
);
console.log('');