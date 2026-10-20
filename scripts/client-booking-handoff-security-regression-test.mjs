import assert from 'node:assert/strict';
import {
  isBookingStartOccupied,
  getSafeClientNextPath,
  parseClientBookingResume,
  buildClientBookingResumePath,
} from '../src/utils/clientBookingHandoff.js';

const validResume = buildClientBookingResumePath({
  date: '2026-11-02',
  startHour: 10,
});

assert.equal(
  validResume,
  '/client/portal?bookDate=2026-11-02&bookStart=10',
  'Resume path should preserve a valid requested date and start hour.',
);

assert.deepEqual(
  parseClientBookingResume('?bookDate=2026-11-02&bookStart=10'),
  { date: '2026-11-02', startHour: 10 },
);

assert.equal(
  parseClientBookingResume('?bookDate=2026-02-31&bookStart=10'),
  null,
  'Impossible calendar dates must not be accepted as a booking resume date.',
);

assert.equal(
  parseClientBookingResume('?bookDate=2026-02-28&bookStart=10.5'),
  null,
  'Start hours must be whole hour slots.',
);

assert.equal(
  parseClientBookingResume('?bookDate=2026-02-28&bookStart='),
  null,
  'Missing start hour must not be coerced to hour zero.',
);

assert.equal(
  getSafeClientNextPath('?next=%2Fclient%2Fportal%3Ftab%3Dbook'),
  '/client/portal?tab=book',
  'Allowed client portal path and query should be preserved.',
);

for (const next of [
  'https://evil.example/',
  '//evil.example/',
  '/admin',
  '/guard/attendance',
  '/client/portal/../../admin',
  '/book#javascript:alert(1)',
]) {
  assert.equal(
    getSafeClientNextPath('?next=' + encodeURIComponent(next)),
    '/client/portal',
    'Unsafe or non-canonical client next path must fall back to portal: ' + next,
  );
}

assert.equal(
  isBookingStartOccupied(
    [{ date: '2026-11-02', startHour: 10, durationHours: 2 }],
    '2026-11-02',
    11,
  ),
  true,
  'A start time inside an existing booking duration should be occupied.',
);

assert.equal(
  isBookingStartOccupied(
    [{ date: '2026-11-02', startHour: 10, durationHours: 2 }],
    '2026-11-02',
    12,
  ),
  false,
  'A start time at the end boundary should not be treated as overlapping.',
);

console.log('client booking handoff security regression: PASS');
