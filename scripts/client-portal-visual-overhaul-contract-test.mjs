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

const appSource =
  read(
    'src/App.jsx',
  );

const clientSpatialRouteSource =
  read(
    'src/components/client/ClientSpatialRoute.jsx',
  );

const loginSource =
  read(
    'src/pages/ClientLoginPage.jsx',
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

const historySource =
  read(
    'src/components/client/ClientHistoryTab.jsx',
  );

const billingSource =
  read(
    'src/components/client/ClientBillingTab.jsx',
  );

const cssSource =
  read(
    'src/styles/modules/client-portal-overhaul.css',
  );

const clientRouteCssSource =
  read(
    'src/styles/routes/client.css',
  );

const loginCssSource =
  read(
    'src/styles/client-auth.css',
  );

assert.equal(
  portalSource.includes(
    "import '../styles/modules/client-portal-overhaul.css';",
  ),
  true,
);

for (const clientRouteContract of [
  '<ClientSpatialRoute>',
  '<ClientLoginPage />',
  '<ClientPortalPage />',
]) {
  assert.equal(
    appSource.includes(clientRouteContract),
    true,
    'Client routes must use their isolated spatial boundary: ' + clientRouteContract,
  );
}

for (const sharedFoundationContract of [
  '<ThemeProvider>',
  '<SpatialUiProvider>',
]) {
  assert.equal(
    clientSpatialRouteSource.includes(sharedFoundationContract),
    true,
    'Client route boundary must consume the Admin Portal spatial/theme foundation: ' + sharedFoundationContract,
  );
}

assert.equal(
  clientRouteCssSource.includes(
    "@import '../spatial-foundation.css';",
  ),
  true,
  'Client routes must load the same spatial token foundation as the Admin portal.',
);

for (const sharedTokenContract of [
  'var(--studio-env)',
  'var(--studio-canvas)',
  'var(--studio-radius-large)',
  'var(--studio-shadow-surface)',
]) {
  assert.equal(
    cssSource.includes(sharedTokenContract),
    true,
    'Client workspace must use the Admin Portal spatial token: ' + sharedTokenContract,
  );
}

for (const gatewayContract of [
  'grid-template-columns: minmax(0,1.12fr) minmax(390px,.88fr)',
  'var(--studio-shadow-floating)',
  '@media (max-width:900px)',
]) {
  assert.equal(
    loginCssSource.includes(gatewayContract),
    true,
    'Client login must stay aligned with the Admin access gateway: ' + gatewayContract,
  );
}

for (const clientLoginContract of [
  'client-auth-frame',
  'client-auth-story-status',
  'client-auth-story-points',
  'client-auth-footer',
]) {
  assert.equal(
    loginSource.includes(clientLoginContract),
    true,
    'Client login is missing the shared spatial gateway experience: ' + clientLoginContract,
  );
}

assert.equal(
  loginSource.includes('client-auth-story-image'),
  false,
  'Client login must use the admin spatial composition instead of a competing photo treatment.',
);

for (const portalShellContract of [
  'client-header-profile',
  'client-portal-mobile-heading',
  'client-view-stage',
  'client-detail-invoice',
  'client-detail-modal-actions',
  'client-proof-file-field',
]) {
  assert.equal(
    portalSource.includes(portalShellContract),
    true,
    'Client portal is missing the v3 workspace contract: ' + portalShellContract,
  );
}

assert.equal(
  portalSource.includes('className="p-5 rounded-xl'),
  false,
  'Client detail invoice must not depend on unowned utility classes.',
);

assert.equal(
  historySource.includes('style={{'),
  false,
  'Booking history must use the shared client design system instead of inline style objects.',
);

assert.equal(
  billingSource.includes('style={{'),
  false,
  'Client billing must use the shared client design system instead of inline style objects.',
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
    '--client-shell-width: 1540px',
  ),
  true,
  'Desktop shell must be capped to a readable workspace width.',
);

for (const cssContract of [
  '--client-rail-width: 228px',
  '.client-portal-mobile-heading',
  '.client-detail-invoice',
  '.client-payment-layout',
  '@media (max-width: 899px)',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert.equal(
    cssSource.includes(cssContract),
    true,
    'Missing Client Portal v3 CSS contract: ' + cssContract,
  );
}

assert.equal(
  cssSource.includes(
    '.client-desktop-nav',
  ),
  true,
);

assert.equal(
  cssSource.includes(
    'grid-template-columns: 68px repeat(var(--client-book-days), minmax(112px, 1fr))',
  ),
  true,
  'Desktop booking board must render a time column plus every visible day.',
);

assert.equal(
  cssSource.includes(
    '.client-booking-board-scroll { max-height: min(62svh, 570px)',
  ),
  true,
  'Mobile calendar must keep one spatial week board inside a bounded viewport.',
);

for (const calendarSpatialContract of [
  'client-booking-calendar-shell',
  'client-calendar-booking-block',
  'getBookingBlockPlacement',
  'client-booking-mobile-context',
]) {
  assert.equal(
    calendarSource.includes(calendarSpatialContract) || cssSource.includes(calendarSpatialContract),
    true,
    'Missing spatial calendar contract: ' + calendarSpatialContract,
  );
}

assert.equal(
  calendarSource.includes('client-booking-mobile-slots'),
  false,
  'Mobile must not flatten the week calendar into an excessively long slot-card list.',
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
