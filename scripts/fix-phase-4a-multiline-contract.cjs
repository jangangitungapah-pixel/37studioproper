const fs = require('fs');
const path = require('path');

const target = path.join(
  process.cwd(),
  'scripts',
  'public-booking-entry-contract-test.mjs',
);

if (!fs.existsSync(target)) {
  console.error(
    '❌ public-booking-entry-contract-test.mjs tidak ditemukan.',
  );

  process.exit(1);
}

let source = fs
  .readFileSync(
    target,
    'utf8',
  )
  .replace(/\r\n/g, '\n');

const before = [
  'assert.equal(',
  '  portalSource.includes(',
  "    'isBookingStartOccupied(calendarSlots, resume.date, resume.startHour)',",
  '  ),',
  '  true,',
  ');',
].join('\n');

const after = [
  'assert.equal(',
  '  /isBookingStartOccupied\\\\(\\\\s*calendarSlots,\\\\s*resume\\\\.date,\\\\s*resume\\\\.startHour\\\\s*\\\\)/.test(',
  '    portalSource,',
  '  ),',
  '  true,',
  "  'Auth-resume must re-check selected slot occupancy after login.',",
  ');',
].join('\n');

if (source.includes(after)) {
  console.log(
    '✅ Phase 4A multiline occupancy contract already repaired.',
  );

  process.exit(0);
}

const count =
  source.split(before).length - 1;

if (count !== 1) {
  console.error(
    `❌ Expected exactly 1 stale assertion, found ${count}.`,
  );

  process.exit(1);
}

source = source.replace(
  before,
  after,
);

fs.writeFileSync(
  target,
  source,
  'utf8',
);

console.log(
  '✅ Phase 4A multiline occupancy contract repaired.',
);