import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

function read(
  file,
) {
  return readFileSync(
    resolve(
      file,
    ),
    'utf8',
  );
}

function count(
  source,
  needle,
) {
  return (
    source.split(
      needle,
    ).length - 1
  );
}

const portalSource =
  read(
    'src/pages/ClientPortalPage.jsx',
  );

const dashboardSource =
  read(
    'src/components/client/ClientDashboardTab.jsx',
  );

const calendarSource =
  read(
    'src/components/client/ClientCalendarTab.jsx',
  );

const bookingsSource =
  read(
    'src/components/client/ClientBookingsHub.jsx',
  );

const accountSource =
  read(
    'src/components/client/ClientAccountTab.jsx',
  );

const cssSource =
  read(
    'src/styles/modules/client-portal-overhaul.css',
  );

assert.equal(
  portalSource.includes(
    "import '../styles/modules/client-portal-overhaul.css';",
  ),
  true,
);

assert.equal(
  portalSource.includes(
    'client-desktop-nav',
  ),
  true,
  'Desktop portal must expose a real application navigation bar.',
);

for (
  const label
  of [
    '<span>Home</span>',
    '<span>Book</span>',
    '<span>Bookings</span>',
    '<span>Account</span>',
  ]
) {
  assert.equal(
    portalSource.includes(
      label,
    ),
    true,
  );
}

assert.equal(
  count(
    portalSource,
    'createClientBookingRequest(currentUser',
  ),
  1,
  'Visual overhaul must not alter booking write ownership.',
);

assert.equal(
  dashboardSource.includes(
    'client-home-grid',
  ),
  true,
);

assert.equal(
  dashboardSource.includes(
    'client-home-lower-grid',
  ),
  true,
);

assert.equal(
  dashboardSource.includes(
    'Mulai dalam 3 langkah.',
  ),
  true,
  'Empty Home must provide useful onboarding instead of dead space.',
);

assert.equal(
  calendarSource.includes(
    'client-booking-board-grid',
  ),
  true,
);

assert.equal(
  calendarSource.includes(
    'schedule-row-fragment',
  ),
  false,
  'Broken legacy grid wrapper must be removed.',
);

assert.equal(
  calendarSource.includes(
    'schedule-grid',
  ),
  false,
  'Client booking UI must no longer depend on admin schedule grid CSS.',
);

assert.equal(
  calendarSource.includes(
    '<Fragment',
  ),
  true,
  'Desktop calendar rows must expose direct grid children.',
);

assert.equal(
  calendarSource.includes(
    'getBlockForSlot',
  ),
  true,
  'Booking board must preserve occupied-slot detection.',
);

assert.equal(
  calendarSource.includes(
    'handleSlotClick',
  ),
  true,
);

assert.equal(
  calendarSource.includes(
    'handleBookingBlockClick',
  ),
  true,
);

assert.equal(
  bookingsSource.includes(
    'client-bookings-overview-stats',
  ),
  true,
);

assert.equal(
  bookingsSource.includes(
    'bookingCount',
  ),
  true,
);

assert.equal(
  accountSource.includes(
    'client-account-layout',
  ),
  true,
);

assert.equal(
  accountSource.includes(
    'client-account-secondary-column',
  ),
  true,
);

assert.equal(
  cssSource.includes(
    '--client-shell-width: 1360px',
  ),
  true,
  'Desktop shell must use available screen width.',
);

assert.equal(
  cssSource.includes(
    '.client-desktop-nav',
  ),
  true,
);

assert.equal(
  cssSource.includes(
    '.client-booking-board-grid',
  ),
  true,
);

assert.equal(
  cssSource.includes(
    '.client-portal-page .client-bottom-nav',
  ),
  true,
  'Bottom navigation must be removable on desktop.',
);

const packageJson =
  JSON.parse(
    read(
      'package.json',
    ),
  );

assert.equal(
  packageJson.scripts.test.includes(
    'client-navigation-v2-contract-test.mjs',
  ),
  true,
  'Phase 4C contract must remain.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'client-portal-visual-overhaul-contract-test.mjs',
  ),
  true,
  'Phase 4D visual contract must be registered.',
);

process.stdout.write(
  '✅ Client Portal Visual Overhaul contract passed.\n',
);
