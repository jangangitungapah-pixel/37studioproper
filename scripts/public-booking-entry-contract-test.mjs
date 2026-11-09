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
import {
  getLocalDateKey,
  parsePublicBookingSelection,
} from '../src/utils/publicBookingSelection.js';

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
  getLocalDateKey(new Date(2026, 9, 29, 12)),
  '2026-10-29',
  'Date-only defaults must use local calendar time instead of UTC.',
);
assert.deepEqual(
  parsePublicBookingSelection('?date=2026-11-02&startHour=10', '2026-10-29'),
  { date: '2026-11-02', startHour: 10, dateWindowOffset: 0 },
);
assert.deepEqual(
  parsePublicBookingSelection('?date=2026-11-19&startHour=22', '2026-10-29'),
  { date: '2026-11-19', startHour: 22, dateWindowOffset: 3 },
);
assert.deepEqual(
  parsePublicBookingSelection('?date=2026-02-31&startHour=10', '2026-10-29'),
  { date: '2026-10-29', startHour: null, dateWindowOffset: 0 },
);
assert.deepEqual(
  parsePublicBookingSelection('?date=2026-10-28&startHour=10', '2026-10-29'),
  { date: '2026-10-29', startHour: null, dateWindowOffset: 0 },
);
assert.equal(
  parsePublicBookingSelection('?date=2026-11-02&startHour=10.5', '2026-10-29').startHour,
  null,
);
assert.equal(
  parsePublicBookingSelection('?date=2026-11-02&startHour=', '2026-10-29').startHour,
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
    '<Route path="/book" element={<ThemePreferenceScope><PublicBookingPage /></ThemePreferenceScope>} />',
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

const aiAssistantSource =
  readFileSync(
    resolve(
      'src/components/ai/RoleAiAssistant.jsx',
    ),
    'utf8',
  );

assert.ok(
  publicPageSource.includes('className="public-booking-intro-aside"'),
  'Public Booking AI launcher must live in the page intro layout rather than a floating viewport layer.',
);
assert.match(
  publicPageSource,
  /className="public-booking-intro-aside"[\s\S]*?surface="public-booking"[\s\S]*?className="public-booking-workspace"/,
  'Public Booking AI launcher must be placed before the calendar workspace.',
);
assert.ok(
  aiAssistantSource.includes('data-ai-surface={surface}'),
  'Role AI Assistant must expose its surface for layout-specific behavior.',
);
assert.ok(
  aiAssistantSource.includes('className="role-ai-assistant"'),
  'Role AI Assistant root must retain its stable layout class.',
);

assert.equal(
  publicPageSource.includes('subscribeClientCalendarSlots('),
  true,
  'Public booking page must read the public-safe availability mirror.',
);
assert.match(
  publicPageSource,
  /const hasAvailabilityData = !isLoading && !loadError;/,
  'Public availability must remain unverified until the subscription succeeds.',
);
assert.match(
  publicPageSource,
  /available: hasAvailabilityData && !occupied && !past/,
  'Loading and error states must never fabricate available slots.',
);
assert.match(
  publicPageSource,
  /availabilityStatus: isLoading \? 'loading' : loadError \? 'error' : 'ready'/,
  'AI context must receive the availability lifecycle state.',
);
assert.match(
  publicPageSource,
  /availableStartHours: hasAvailabilityData[\s\S]*?: \[\]/,
  'AI context must not receive slot suggestions before availability is verified.',
);
assert.match(
  publicPageSource,
  /Status tidak diketahui/,
  'An unavailable calendar must not display an available-slot count.',
);
assert.match(
  publicPageSource,
  /loadError\s*\?\s*'Status jadwal tidak diketahui'[\s\S]*?isLoading\s*\?\s*'Memeriksa jadwal'[\s\S]*?:\s*'Jadwal realtime'/,
  'The public header must only claim realtime after availability subscription succeeds.',
);
assert.match(
  publicPageSource,
  /loadError\s*\?\s*<Info[\s\S]*?isLoading[\s\S]*?<LoaderCircle/,
  'The public header indicator must visually distinguish error and loading states.',
);
assert.match(
  publicPageSource,
  /Jadwal belum terverifikasi\. Pilihan ini belum dapat dikirim\./,
  'The summary must explain that an unverified slot cannot be submitted.',
);
assert.ok(
  publicPageSource.includes("className={`public-booking-summary ${canContinue ? 'is-ready' : 'is-pending'}`}") ,
  'The mobile summary must distinguish actionable and pending booking states.',
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

const adminBookingRepositorySource =
  readFileSync(
    resolve(
      'src/services/adminBookingRepository.js',
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
    'const resumeTimer = window.setTimeout(',
  ),
  true,
  'Auth-resume state changes must be deferred outside the synchronous effect body.',
);

assert.equal(
  portalSource.includes(
    'window.clearTimeout(resumeTimer)',
  ),
  true,
  'Deferred auth-resume work must be cancellable during effect cleanup.',
);

assert.equal(
  /isBookingStartOccupied\(\s*calendarSlots,\s*resume\.date,\s*resume\.startHour\s*\)/.test(
    portalSource,
  ),
  true,
  'Auth-resume must re-check selected slot occupancy after login.',
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
assert.match(
  portalSource,
  /const clientBookingRequestIdentityRef = useRef\(null\)/,
  'Client booking retries must retain one stable request identity.',
);
assert.match(
  portalSource,
  /const requestFingerprint = JSON\.stringify\(/,
  'Client booking request identity must be tied to the submitted payload.',
);
assert.match(
  portalSource,
  /requestId: requestIdentity\.id/,
  'Client booking submission must pass the stable request ID to the repository.',
);
assert.match(
  portalSource,
  /previousRequestIdentity\?\.pendingRecovery/,
  'An uncertain commit must require retrying the same payload before starting a different request.',
);
assert.match(
  adminBookingRepositorySource,
  /const requestedBookingId = String\(booking\.requestId \|\| ''\)\.trim\(\)/,
  'The repository must preserve a validated request ID supplied for idempotent retry.',
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
    '<a href="/book" className="client-landing-nav-link" onClick={handleNavigationLinkClick}>Booking Slot</a>',
  ),
  true,
  'Public booking navigation must use the focus-aware menu close handler.',
);

assert.match(
  landingSource,
  /function handleNavigationLinkClick\(event\)[\s\S]*?target\.focus\(\{ preventScroll: true \}\)/,
  'In-page navigation must move focus to its destination section.',
);

assert.match(
  landingSource,
  /if \(event\.key !== 'Escape'\) return;[\s\S]*?menuButtonRef\.current\?\.focus\(\)/,
  'Escape from an open mobile navigation must restore focus to its trigger.',
);

assert.equal(
  landingSource.includes(
    '<a href="/book" className="client-landing-button is-primary">',
  ),
  true,
);

assert.equal(
  landingSource.includes("navigate('/book?' + params.toString());"),
  true,
  'Planner selection must be passed to the public booking calendar.',
);
assert.equal(
  landingSource.includes("new Date().toISOString().split('T')[0]"),
  false,
  'Landing date defaults must not rely on UTC date conversion.',
);
assert.equal(
  publicPageSource.includes('parsePublicBookingSelection(location.search, todayKey)'),
  true,
  'Public booking must initialize calendar from planner query parameters.',
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
    'allow create, update: if isApprovedScheduleAdmin()',
  ),
  true,
  'Public users must never gain write access to availability mirror.',
);

assert.equal(
  publicSlotRules.includes('bookingCalendarSlotMatchesAfter'),
  true,
  'Calendar mirror writes must be paired with the matching booking transaction.',
);

assert.match(
  publicSlotRules,
  /allow delete: if \([\s\S]*isApprovedScheduleAdmin\(\)[\s\S]*\) \|\| financeVoidScheduleSlotDeleteAllowed\(slotId\);/,
  'Availability mirrors may be removed by schedule admins or by the paired, guarded finance-void operation.',
);
assert.match(
  rulesSource,
  /function financeVoidScheduleSlotDeleteAllowed\(bookingId\)[\s\S]*?isApprovedAdmin\(\)[\s\S]*?hasPermission\('billing'\)[\s\S]*?lastFinanceAction == 'void'[\s\S]*?financeBookingVoidScheduleMatchesAfter/,
  'Finance slot deletion must be restricted to an approved Billing admin and the paired invoice-void transaction.',
);

const publicSlotValidatorStart = rulesSource.indexOf(
  'function validCalendarSlot(data)',
);
const publicSlotValidatorEnd = rulesSource.indexOf(
  'function bookingIsScheduleBlocking(data)',
  publicSlotValidatorStart,
);
const publicSlotValidatorSource = rulesSource.slice(
  publicSlotValidatorStart,
  publicSlotValidatorEnd,
);
assert.match(
  publicSlotValidatorSource,
  /data\.keys\(\)\.hasOnly\(\[\s*'bookingId',\s*'date',\s*'durationHours',\s*'sessionLabel',\s*'startHour',\s*'status',\s*'title',\s*'updatedAt'\s*\]\)[\s\S]*?validString\(data\.title,\s*1,\s*80\)/,
  'Public slot mirror must remain restricted to generic safe fields.',
);
const calendarSlotFieldsStart = rulesSource.indexOf(
  'function bookingCalendarSlotFieldsMatchAfter',
);
const calendarSlotFieldsEnd = rulesSource.indexOf(
  'function bookingCalendarSlotMatchesAfter',
  calendarSlotFieldsStart,
);
const calendarSlotFieldsSource = rulesSource.slice(
  calendarSlotFieldsStart,
  calendarSlotFieldsEnd,
);
assert.match(
  calendarSlotFieldsSource,
  /slotAfter\.bookingId == bookingId[\s\S]*?slotAfter\.date == data\.date[\s\S]*?slotAfter\.durationHours == data\.durationHours[\s\S]*?slotAfter\.startHour == data\.startHour[\s\S]*?slotAfter\.sessionLabel == data\.sessionLabel[\s\S]*?slotAfter\.status == data\.paymentStatus[\s\S]*?slotAfter\.updatedAt == data\.updatedAt/,
  'Public slot metadata must remain fully paired with the booking fields.',
);
const calendarSlotPairingStart = rulesSource.indexOf(
  'function bookingCalendarSlotMatchesAfter',
);
const calendarSlotPairingEnd = rulesSource.indexOf(
  'function bookingSlotStateMatchesAfter',
  calendarSlotPairingStart,
);
const calendarSlotPairingSource = rulesSource.slice(
  calendarSlotPairingStart,
  calendarSlotPairingEnd,
);
assert.match(
  calendarSlotPairingSource,
  /bookingCalendarSlotFieldsMatchAfter\(bookingId, data\)[\s\S]*?bookingScheduleDayMatchesAfter\(data\.date, bookingId, data\.updatedAt\)/,
  'Slot rules must pair full slot fields with the matching schedule-day revision.',
);
assert.match(
  rulesSource,
  /function bookingManualCreateCompanionsAfter\(bookingId, data\)[\s\S]*?slotAfter\.bookingId == bookingId[\s\S]*?dayAfter\.lastBookingId == bookingId/,
  'Booking create must confirm both slot and day companions without repeating the full slot validator.',
);

const cssSource =
  readFileSync(
    resolve(
      'src/styles/public-booking.css',
    ),
    'utf8',
  );

assert.ok(
  cssSource.includes('.public-booking-summary.is-pending {'),
  'The disabled mobile booking summary must return to normal document flow.',
);
assert.ok(
  cssSource.includes('.public-booking-summary.is-pending .public-booking-summary-hint'),
  'The mobile pending summary must keep its availability explanation visible.',
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
