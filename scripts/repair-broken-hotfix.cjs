const fs = require('fs');
const path = require('path');

const target = path.join(
  process.cwd(),
  'scripts',
  'fix-calendar-booking-save.cjs',
);

if (!fs.existsSync(target)) {
  console.error(
    '❌ fix-calendar-booking-save.cjs tidak ditemukan.',
  );

  process.exit(1);
}

let source = fs.readFileSync(
  target,
  'utf8',
);

const pattern =
  /`resolveBookingCustomerIdentity\(\r?\n\s*booking,\r?\n\s*bookings\r?\n\s*\)`/g;

const matches =
  source.match(pattern) || [];

console.log(
  `Found ${matches.length} broken nested template literal.`,
);

if (matches.length !== 1) {
  console.error(
    '❌ Expected exactly 1 broken block.',
  );

  process.exit(1);
}

source = source.replace(
  pattern,
  '"resolveBookingCustomerIdentity(\\n        booking,\\n        bookings\\n      )"',
);

fs.writeFileSync(
  target,
  source,
  'utf8',
);

console.log(
  '✅ Broken nested template literal repaired.',
);