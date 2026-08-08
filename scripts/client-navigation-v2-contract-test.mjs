import assert from 'node:assert/strict';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

function count(
  source,
  value,
) {
  return (
    source.split(
      value,
    ).length - 1
  );
}

const portalSource =
  readFileSync(
    resolve(
      'src/pages/ClientPortalPage.jsx',
    ),
    'utf8',
  );

const dashboardSource =
  readFileSync(
    resolve(
      'src/components/client/ClientDashboardTab.jsx',
    ),
    'utf8',
  );

const bookingsHubSource =
  readFileSync(
    resolve(
      'src/components/client/ClientBookingsHub.jsx',
    ),
    'utf8',
  );

const accountSource =
  readFileSync(
    resolve(
      'src/components/client/ClientAccountTab.jsx',
    ),
    'utf8',
  );

const cssSource =
  readFileSync(
    resolve(
      'src/styles/modules/client-navigation-v2.css',
    ),
    'utf8',
  );

assert.equal(
  portalSource.includes(
    "useState('home')",
  ),
  true,
);

for (
  const tab
  of [
    'home',
    'book',
    'bookings',
    'account',
  ]
) {
  assert.equal(
    portalSource.includes(
      "activeTab === '" +
        tab +
        "'",
    ),
    true,
    'Missing Client Navigation V2 tab: ' +
      tab,
  );
}

for (
  const legacy
  of [
    "activeTab === 'dashboard'",
    "activeTab === 'calendar'",
    "activeTab === 'history'",
    "activeTab === 'billing'",
  ]
) {
  assert.equal(
    portalSource.includes(
      legacy,
    ),
    false,
    'Legacy portal render state must be removed: ' +
      legacy,
  );
}

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
    'Missing bottom navigation label: ' +
      label,
  );
}

assert.equal(
  portalSource.includes(
    '<ClientBookingsHub',
  ),
  true,
);

assert.equal(
  portalSource.includes(
    '<ClientAccountTab',
  ),
  true,
);

assert.equal(
  portalSource.includes(
    "setBookingsSection('payments');",
  ),
  true,
  'Payments must remain reachable through Bookings hub.',
);

assert.equal(
  portalSource.includes(
    "setActiveTab('book');",
  ),
  true,
  'Public booking resume must open authenticated Book.',
);

assert.equal(
  portalSource.includes(
    "setActiveTab('bookings');",
  ),
  true,
  'View Booking must open Bookings.',
);

assert.equal(
  count(
    portalSource,
    'createClientBookingRequest(currentUser',
  ),
  1,
  'ClientPortalPage must remain the single booking write owner.',
);

assert.equal(
  dashboardSource.includes(
    'setActiveTab(',
  ),
  false,
  'Dashboard must use semantic navigation callbacks.',
);

for (
  const callback
  of [
    'onOpenBook',
    'onOpenBookings',
    'onOpenPayments',
  ]
) {
  assert.equal(
    dashboardSource.includes(
      callback,
    ),
    true,
  );
}

assert.equal(
  bookingsHubSource.includes(
    'My Bookings',
  ),
  true,
);

assert.equal(
  bookingsHubSource.includes(
    'Payments',
  ),
  true,
);

assert.equal(
  bookingsHubSource.includes(
    'createClientBookingRequest',
  ),
  false,
);

assert.equal(
  accountSource.includes(
    'Payments',
  ),
  true,
);

assert.equal(
  accountSource.includes(
    'Keluar dari akun',
  ),
  true,
);

for (
  const forbidden
  of [
    'createClientBookingRequest',
    'updateManualBooking',
    'writeBatch',
    'setDoc(',
  ]
) {
  assert.equal(
    accountSource.includes(
      forbidden,
    ),
    false,
    'Account UI must remain read/navigation only: ' +
      forbidden,
  );
}

assert.equal(
  cssSource.includes(
    '.client-bookings-hub',
  ),
  true,
);

assert.equal(
  cssSource.includes(
    '.client-account-tab',
  ),
  true,
);

assert.equal(
  existsSync(
    resolve(
      'scripts/fix-phase-4a-resume-effect-lint.cjs',
    ),
  ),
  false,
  'Temporary Phase 4A lint repair script must be cleaned.',
);

assert.equal(
  existsSync(
    resolve(
      'scripts/fix-phase-4a-multiline-contract.cjs',
    ),
  ),
  false,
  'Temporary Phase 4A contract repair script must be cleaned.',
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
    'unified-client-booking-wizard-contract-test.mjs',
  ),
  true,
  'Phase 4B gate must remain.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'client-navigation-v2-contract-test.mjs',
  ),
  true,
  'Phase 4C gate must be present.',
);

process.stdout.write(
  '✅ Client Navigation V2 contract passed.\n',
);
