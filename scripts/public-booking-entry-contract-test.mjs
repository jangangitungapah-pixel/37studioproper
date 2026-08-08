import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

import {
  buildClientBookingResumePath,
  getSafeClientNextPath,
  isBookingStartOccupied,
  parseClientBookingResume,
} from '../src/utils/clientBookingHandoff.js';

const resumePath =
  buildClientBookingResumePath({
    date:
      '2026-08-10',
    startHour:
      14,
  });

assert.equal(
  resumePath,
  '/client/portal?bookDate=2026-08-10&bookStart=14',
);

assert.deepEqual(
  parseClientBookingResume(
    '?bookDate=2026-08-10&bookStart=14',
  ),
  {
    date:
      '2026-08-10',
    startHour:
      14,
  },
);

assert.equal(
  parseClientBookingResume(
    '?bookDate=invalid&bookStart=14',
  ),
  null,
);

assert.equal(
  getSafeClientNextPath(
    '?next=' +
      encodeURIComponent(
        resumePath,
      ),
  ),
  resumePath,
);

assert.equal(
  getSafeClientNextPath(
    '?next=' +
      encodeURIComponent(
        'https://example.com',
      ),
  ),
  '/client/portal',
);

assert.equal(
  getSafeClientNextPath(
    '?next=' +
      encodeURIComponent(
        '/admin/settings',
      ),
  ),
  '/client/portal',
);

assert.equal(
  isBookingStartOccupied(
    [
      {
        date:
          '2026-08-10',
        startHour:
          14,
        durationHours:
          2,
      },
    ],
    '2026-08-10',
    15,
  ),
  true,
);

assert.equal(
  isBookingStartOccupied(
    [
      {
        date:
          '2026-08-10',
        startHour:
          14,
        durationHours:
          2,
      },
    ],
    '2026-08-10',
    16,
  ),
  false,
);

const appSource =
  readFileSync(
    resolve(
      'src/App.jsx',
    ),
    'utf8',
  );

assert.equal(
  appSource.includes(
    "const PublicBookingPage = lazy(() => import('./pages/PublicBookingPage.jsx'));",
  ),
  true,
);

assert.equal(
  appSource.includes(
    '<Route path="/book" element={<PublicBookingPage />} />',
  ),
  true,
);

const publicPageSource =
  readFileSync(
    resolve(
      'src/pages/PublicBookingPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  publicPageSource.includes(
    'subscribeClientCalendarSlots(',
  ),
  true,
  'Public booking page must read the public-safe availability mirror.',
);

assert.equal(
  publicPageSource.includes(
    'buildClientBookingResumePath',
  ),
  true,
);

for (
  const forbidden
  of [
    'createClientBookingRequest',
    'bookingCommunicationRepository',
    'paymentProofRepository',
    'writeBatch',
    'setDoc(',
  ]
) {
  assert.equal(
    publicPageSource.includes(
      forbidden,
    ),
    false,
    'Public /book must never write private booking data before authentication: ' +
      forbidden,
  );
}

const loginSource =
  readFileSync(
    resolve(
      'src/pages/ClientLoginPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  loginSource.includes(
    'getSafeClientNextPath',
  ),
  true,
);

assert.equal(
  loginSource.includes(
    'navigate(clientNextPath, { replace: true });',
  ),
  true,
);

const portalSource =
  readFileSync(
    resolve(
      'src/pages/ClientPortalPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  portalSource.includes(
    'parseClientBookingResume(location.search)',
  ),
  true,
);

assert.equal(
  portalSource.includes(
    'calendarSlotsReady',
  ),
  true,
);

assert.equal(
  portalSource.includes(
    'isBookingStartOccupied(calendarSlots, resume.date, resume.startHour)',
  ),
  true,
);

assert.equal(
  portalSource.includes(
    'setIsSimulatorOpen(true);',
  ),
  true,
);

assert.equal(
  portalSource.includes(
    'createClientBookingRequest(currentUser',
  ),
  true,
  'Final booking submit must remain inside authenticated Client Portal.',
);

const landingSource =
  readFileSync(
    resolve(
      'src/pages/ClientLandingPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  landingSource.includes(
    '<a href="/book" className="client-landing-nav-link">Booking Slot</a>',
  ),
  true,
);

assert.equal(
  landingSource.includes(
    '<a href="/book" className="client-landing-button is-primary">',
  ),
  true,
);

const rulesSource =
  readFileSync(
    resolve(
      'firestore.rules',
    ),
    'utf8',
  );

const publicSlotStart =
  rulesSource.indexOf(
    'match /clientCalendarSlots/{slotId}',
  );

const publicSlotEnd =
  rulesSource.indexOf(
    'function validCustomer(',
    publicSlotStart,
  );

const publicSlotRules =
  rulesSource.slice(
    publicSlotStart,
    publicSlotEnd,
  );

assert.equal(
  publicSlotRules.includes(
    'allow read: if true;',
  ),
  true,
  'Public availability mirror must be readable before login.',
);

assert.equal(
  publicSlotRules.includes(
    'allow create, update: if isApproved()',
  ),
  true,
  'Public users must never gain write access to availability mirror.',
);

assert.equal(
  rulesSource.includes(
    "data.keys().hasOnly(['bookingId', 'date', 'durationHours', 'sessionLabel', 'startHour', 'status', 'title', 'updatedAt'])",
  ),
  true,
  'Public slot mirror must remain restricted to generic safe fields.',
);

const cssSource =
  readFileSync(
    resolve(
      'src/styles/public-booking.css',
    ),
    'utf8',
  );

assert.equal(
  cssSource.includes(
    '.public-booking-page',
  ),
  true,
);

assert.equal(
  cssSource.includes(
    '.public-booking-hours',
  ),
  true,
);

const packageJson =
  JSON.parse(
    readFileSync(
      resolve(
        'package.json',
      ),
      'utf8',
    ),
  );

assert.equal(
  packageJson.scripts.test.includes(
    'all-bookings-command-center-contract-test.mjs',
  ),
  true,
  'Phase 3D gate must remain.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'public-booking-entry-contract-test.mjs',
  ),
  true,
  'Phase 4A gate must be present.',
);

process.stdout.write(
  '✅ Public Booking Entry & Auth Resume contract passed.\n',
);
