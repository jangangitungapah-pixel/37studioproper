const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const files = {
  guardPage: path.join(root, 'src/pages/guard/GuardAttendancePage.jsx'),
  authStyles: path.join(root, 'src/styles/admin-auth.css'),
  baselineContract: path.join(root, 'scripts/guard-portal-flow-baseline-contract-test.mjs'),
  ownerContract: path.join(root, 'scripts/guard-owner-oversight-contract-test.mjs'),
  packageJson: path.join(root, 'package.json'),
};

for (const [label, filePath] of Object.entries(files)) {
  if (label === 'ownerContract') continue;

  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} tidak ditemukan: ${filePath}`);
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function requireMarker(source, marker, label) {
  if (!source.includes(marker)) {
    throw new Error(`${label}: baseline marker tidak ditemukan: ${marker}`);
  }
}

function requireAbsent(source, marker, label) {
  if (source.includes(marker)) {
    throw new Error(`${label}: marker seharusnya belum ada: ${marker}`);
  }
}

function replaceExact(source, before, after, label) {
  const count = source.split(before).length - 1;

  if (count !== 1) {
    throw new Error(`${label}: expected 1 exact match, found ${count}`);
  }

  return source.replace(before, after);
}

let guardPage = read(files.guardPage);
let authStyles = read(files.authStyles);
let baselineContract = read(files.baselineContract);
const packageJson = JSON.parse(read(files.packageJson));

const ownerContractCommand =
  'node scripts/guard-owner-oversight-contract-test.mjs';

const alreadyApplied =
  guardPage.includes('guard-owner-oversight-card') &&
  guardPage.includes('Anda sedang melihat Guard Portal sebagai Owner') &&
  fs.existsSync(files.ownerContract) &&
  packageJson.scripts?.test?.includes(ownerContractCommand);

if (alreadyApplied) {
  console.log('GP-3 already applied.');
  process.exit(0);
}

/* ==========================================================================
   BASELINE VALIDATION — GP-2
   ========================================================================== */

for (const marker of [
  'adminAuthRepository.subscribeAdminAuth',
  'resolveGuardPortalAccess(guardAccount)',
  'GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL',
  'GUARD_PORTAL_ACCESS.LEGACY_GUARD_OPERATIONAL',
  'Memeriksa akses portal...',
  'Akun ini belum punya role Penjaga Studio approved.',
  'const assignedGuardPersonId =',
  'async function handleCheckIn()',
  'async function handleCheckOut()',
]) {
  requireMarker(
    guardPage,
    marker,
    'GuardAttendancePage.jsx',
  );
}

for (const marker of [
  'guard-owner-oversight-card',
  'isOwnerOversight',
  'Owner Mode',
  'Anda sedang melihat Guard Portal sebagai Owner',
]) {
  requireAbsent(
    guardPage,
    marker,
    'GuardAttendancePage.jsx',
  );
}

requireMarker(
  baselineContract,
  'GP-2 must not silently absorb Owner Oversight UI work.',
  'guard-portal-flow-baseline-contract-test.mjs',
);

if (!packageJson.scripts?.test) {
  throw new Error('package.json scripts.test tidak ditemukan.');
}

/* ==========================================================================
   OWNER ACCESS MODE
   ========================================================================== */

guardPage = replaceExact(
  guardPage,

`  const canUseGuardPage = Boolean(
    authUser?.uid &&
    [
      GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL,
      GUARD_PORTAL_ACCESS.LEGACY_GUARD_OPERATIONAL,
    ].includes(guardPortalAccess)
  );

  useEffect(() => {`,

`  const canUseGuardPage = Boolean(
    authUser?.uid &&
    [
      GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL,
      GUARD_PORTAL_ACCESS.LEGACY_GUARD_OPERATIONAL,
    ].includes(guardPortalAccess)
  );

  const isOwnerOversight = Boolean(
    authUser?.uid &&
    guardPortalAccess === GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT
  );

  useEffect(() => {`,

  'insert Owner Oversight access state',
);

/* ==========================================================================
   OWNER MUST NOT INHERIT A GUARD IDENTITY
   Keep the legacy UID fallback only inside operational Guard mode for now.
   GP-5 will remove the operational fallback completely.
   ========================================================================== */

guardPage = replaceExact(
  guardPage,

`  const assignedGuardPersonId =
    guardAccount?.guardId ||
    authUser?.uid ||
    '';`,

`  const assignedGuardPersonId =
    canUseGuardPage
      ? guardAccount?.guardId ||
        authUser?.uid ||
        ''
      : '';`,

  'scope guard identity to operational Guard mode',
);

/* ==========================================================================
   DEFENSE-IN-DEPTH MUTATION GUARDS
   Even if an action handler is triggered outside normal JSX rendering,
   Owner Oversight cannot call attendance mutation functions.
   ========================================================================== */

guardPage = replaceExact(
  guardPage,

`  async function handleCheckIn() {
    if (!authUser?.uid) {`,

`  async function handleCheckIn() {
    if (!canUseGuardPage) {
      setError(
        'Akses Guard operasional tidak aktif.'
      );
      return;
    }

    if (!authUser?.uid) {`,

  'protect check-in mutation',
);

guardPage = replaceExact(
  guardPage,

`  async function handleCheckOut() {
    if (!currentSession) {`,

`  async function handleCheckOut() {
    if (!canUseGuardPage) {
      setError(
        'Akses Guard operasional tidak aktif.'
      );
      return;
    }

    if (!currentSession) {`,

  'protect check-out mutation',
);

/* ==========================================================================
   PORTAL IDENTITY IN HERO
   ========================================================================== */

guardPage = replaceExact(
  guardPage,

`          <div className="guard-shift-brand">
            <span>37 Studio Guard</span>
            <h1>Absen Penjaga</h1>
            <small>Clock-in, clock-out, dan riwayat kehadiran penjaga.</small>
          </div>`,

`          <div className="guard-shift-brand">
            <span>37 Studio Guard</span>

            <div className="guard-shift-brand-title-row">
              <h1>
                {isOwnerOversight
                  ? 'Guard Portal'
                  : 'Absen Penjaga'}
              </h1>

              {isOwnerOversight ? (
                <span className="guard-owner-mode-badge">
                  Owner Mode
                </span>
              ) : null}
            </div>

            <small>
              {isOwnerOversight
                ? 'Pantau konteks Guard Portal tanpa membuat attendance.'
                : 'Clock-in, clock-out, dan riwayat kehadiran penjaga.'}
            </small>
          </div>`,

  'add Owner Mode portal identity',
);

/* ==========================================================================
   OWNER OVERSIGHT CARD
   ========================================================================== */

const ownerCard = `
        {isReady && authUser && isOwnerOversight ? (
          <section
            className="guard-shift-card guard-owner-oversight-card"
            aria-label="Owner Oversight Mode"
          >
            <div className="guard-owner-oversight-icon" aria-hidden="true">
              <ShieldCheck size={24} />
            </div>

            <div className="guard-owner-oversight-content">
              <div className="guard-owner-oversight-kicker">
                <span className="guard-owner-mode-badge">
                  Owner Mode
                </span>

                <span>
                  {isOnline ? 'Portal online' : 'Portal offline'}
                </span>
              </div>

              <div className="guard-owner-oversight-copy">
                <h2>
                  Anda sedang melihat Guard Portal sebagai Owner
                </h2>

                <p>
                  Mode Owner tidak membuat attendance. Gunakan akun Guard
                  untuk Clock In/Out.
                </p>
              </div>

              <div className="guard-owner-oversight-identity">
                <span>Account context</span>

                <strong>
                  Owner · {authUser.email || authUser.displayName || '37 Studio'}
                </strong>
              </div>

              <div className="guard-owner-oversight-actions">
                <a
                  className="guard-owner-action is-secondary"
                  href="/admin"
                >
                  <ShieldCheck size={15} />
                  Kembali ke Admin
                </a>

                <a
                  className="guard-owner-action is-primary"
                  href="/admin/operations/guard-attendance"
                >
                  <Calendar size={15} />
                  Buka Attendance Review
                </a>
              </div>

              <div className="guard-owner-oversight-note">
                <strong>Read-only oversight</strong>
                <span>
                  Clock In/Out hanya tersedia untuk akun Guard operasional
                  yang terhubung ke identitas crew.
                </span>
              </div>
            </div>
          </section>
        ) : null}

`;

guardPage = replaceExact(
  guardPage,

`        {isReady && authUser && !canUseGuardPage ? (`,

ownerCard +
`        {isReady && authUser && !canUseGuardPage && !isOwnerOversight ? (`,

  'insert Owner Oversight card and exclude Owner from generic lock',
);

/* ==========================================================================
   GP-3 STYLE BLOCK
   ========================================================================== */

const ownerStyleMarker =
  '/* >>> GP-3 OWNER OVERSIGHT MODE START */';

if (!authStyles.includes(ownerStyleMarker)) {
  authStyles += `

/* >>> GP-3 OWNER OVERSIGHT MODE START */
.guard-shift-brand-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.guard-shift-brand-title-row h1 {
  margin: 0;
}

.guard-owner-mode-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 4px 9px;
  border: 1px solid color-mix(in srgb, var(--auth-accent, #7c3aed) 38%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--auth-accent, #7c3aed) 12%, transparent);
  color: var(--auth-accent, #7c3aed);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
}

.guard-owner-oversight-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  overflow: hidden;
}

.guard-owner-oversight-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid color-mix(in srgb, var(--auth-accent, #7c3aed) 32%, transparent);
  border-radius: 13px;
  background: color-mix(in srgb, var(--auth-accent, #7c3aed) 10%, transparent);
  color: var(--auth-accent, #7c3aed);
}

.guard-owner-oversight-content {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.guard-owner-oversight-kicker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--studio-text-muted, #64748b);
  font-size: 11px;
  font-weight: 700;
}

.guard-owner-oversight-copy {
  display: grid;
  gap: 6px;
}

.guard-owner-oversight-copy h2,
.guard-owner-oversight-copy p {
  margin: 0;
}

.guard-owner-oversight-copy h2 {
  color: var(--studio-text-main, #0f172a);
  font-size: clamp(17px, 2vw, 22px);
  line-height: 1.25;
}

.guard-owner-oversight-copy p {
  max-width: 720px;
  color: var(--studio-text-muted, #64748b);
  font-size: 13px;
  line-height: 1.65;
}

.guard-owner-oversight-identity {
  display: grid;
  gap: 4px;
  padding: 11px 12px;
  border: 1px solid var(--studio-border, rgba(148, 163, 184, 0.24));
  border-radius: 10px;
  background: color-mix(in srgb, var(--studio-surface, #ffffff) 92%, transparent);
}

.guard-owner-oversight-identity span {
  color: var(--studio-text-muted, #64748b);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.guard-owner-oversight-identity strong {
  overflow: hidden;
  color: var(--studio-text-main, #0f172a);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.guard-owner-oversight-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.guard-owner-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 9px 13px;
  border: 1px solid transparent;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  text-decoration: none;
  transition:
    transform 140ms ease,
    border-color 140ms ease,
    background 140ms ease;
}

.guard-owner-action:hover {
  transform: translateY(-1px);
}

.guard-owner-action.is-primary {
  border-color: var(--auth-accent, #7c3aed);
  background: var(--auth-accent, #7c3aed);
  color: #fff;
}

.guard-owner-action.is-secondary {
  border-color: var(--studio-border, rgba(148, 163, 184, 0.3));
  background: var(--studio-surface, #fff);
  color: var(--studio-text-main, #0f172a);
}

.guard-owner-oversight-note {
  display: grid;
  gap: 3px;
  padding-top: 2px;
  color: var(--studio-text-muted, #64748b);
  font-size: 11px;
  line-height: 1.5;
}

.guard-owner-oversight-note strong {
  color: var(--studio-text-main, #0f172a);
  font-size: 11px;
}

@media (max-width: 640px) {
  .guard-owner-oversight-card {
    grid-template-columns: 1fr;
  }

  .guard-owner-oversight-icon {
    width: 40px;
    height: 40px;
  }

  .guard-owner-oversight-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .guard-owner-action {
    width: 100%;
  }
}
/* <<< GP-3 OWNER OVERSIGHT MODE END */
`;
}

/* ==========================================================================
   GP-2 BASELINE CONTRACT → GP-3 PROGRESSION
   ========================================================================== */

baselineContract = replaceExact(
  baselineContract,

`/*
 * Role-aware Owner UI intentionally remains GP-3 / GP-7.
 */
assert.equal(
  guardPageSource.includes(
    'Akun ini belum punya role Penjaga Studio approved.'
  ),

  true,

  'GP-2 must not silently absorb Owner Oversight UI work.'
);`,

`/*
 * GP-3 promotes Owner into an explicit read-only Guard Portal context.
 * Owner must not fall through the generic Guard locked state.
 */
for (
  const marker
  of [
    'isOwnerOversight',
    'GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT',
    'Owner Mode',
    'Anda sedang melihat Guard Portal sebagai Owner',
    'Mode Owner tidak membuat attendance.',
    'Kembali ke Admin',
    'Buka Attendance Review',
    '/admin/operations/guard-attendance',
  ]
) {
  assert.equal(
    guardPageSource.includes(
      marker
    ),

    true,

    'GP-3 Owner Oversight marker missing: ' +
      marker
  );
}

assert.equal(
  guardPageSource.includes(
    'isReady && authUser && !canUseGuardPage && !isOwnerOversight'
  ),

  true,

  'Owner Oversight must bypass the generic Guard locked state.'
);

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/guard-owner-oversight-contract-test.mjs'
  ),

  true,

  'GP-3 Owner Oversight contract must be registered.'
);`,

  'advance baseline contract to GP-3',
);

baselineContract = replaceExact(
  baselineContract,

`    'guard-identity-realtime-contract-test.mjs',
  ]`,

`    'guard-identity-realtime-contract-test.mjs',
    'guard-owner-oversight-contract-test.mjs',
  ]`,

  'register GP-3 contract in baseline contract list',
);

/* ==========================================================================
   GP-3 TARGETED OWNER OVERSIGHT CONTRACT
   ========================================================================== */

const ownerContract = `import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUSES,
  GUARD_PORTAL_ACCESS,
  resolveGuardPortalAccess,
} from '../src/utils/accountRoles.js';

function read(path) {
  return readFileSync(
    resolve(path),
    'utf8'
  );
}

const ownerIdentity = {
  role: ACCOUNT_ROLES.OWNER,
  status: ACCOUNT_STATUSES.APPROVED,
};

assert.equal(
  resolveGuardPortalAccess(
    ownerIdentity
  ),

  GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT,

  'Approved Owner must resolve to OWNER_OVERSIGHT.'
);

const guardSource =
  read(
    'src/pages/guard/GuardAttendancePage.jsx'
  );

const rulesSource =
  read(
    'firestore.rules'
  );

const packageJson =
  JSON.parse(
    read(
      'package.json'
    )
  );

for (
  const required
  of [
    'GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT',
    'isOwnerOversight',
    'Owner Mode',
    'Anda sedang melihat Guard Portal sebagai Owner',
    'Mode Owner tidak membuat attendance. Gunakan akun Guard',
    'Kembali ke Admin',
    'Buka Attendance Review',
    'href="/admin"',
    'href="/admin/operations/guard-attendance"',
    'Read-only oversight',
  ]
) {
  assert.equal(
    guardSource.includes(
      required
    ),

    true,

    'Owner Oversight UI marker missing: ' +
      required
  );
}

assert.equal(
  guardSource.includes(
    'isReady && authUser && !canUseGuardPage && !isOwnerOversight'
  ),

  true,

  'Owner must not render the generic Guard locked card.'
);

assert.match(
  guardSource,

  /const assignedGuardPersonId =[\\s\\S]*?canUseGuardPage[\\s\\S]*?guardAccount\\?\\.guardId/,

  'Owner context must not implicitly inherit a guard identity.'
);

const checkInHandler =
  guardSource.slice(
    guardSource.indexOf(
      'async function handleCheckIn()'
    ),
    guardSource.indexOf(
      'async function handleCheckOut()'
    )
  );

const checkOutHandler =
  guardSource.slice(
    guardSource.indexOf(
      'async function handleCheckOut()'
    ),
    guardSource.indexOf(
      'return (',
      guardSource.indexOf(
        'async function handleCheckOut()'
      )
    )
  );

assert.equal(
  checkInHandler.includes(
    'if (!canUseGuardPage)'
  ),

  true,

  'Check-in handler must fail closed outside operational Guard access.'
);

assert.equal(
  checkOutHandler.includes(
    'if (!canUseGuardPage)'
  ),

  true,

  'Check-out handler must fail closed outside operational Guard access.'
);

assert.equal(
  checkInHandler.includes(
    'createGuardAttendanceCheckIn'
  ),

  true,

  'Guard operational check-in lifecycle must remain present.'
);

assert.equal(
  checkOutHandler.includes(
    'closeGuardAttendanceSession'
  ),

  true,

  'Guard operational check-out lifecycle must remain present.'
);

const ownerCardIndex =
  guardSource.indexOf(
    'guard-owner-oversight-card'
  );

const operationalWorkspaceIndex =
  guardSource.indexOf(
    '{canUseGuardPage ? ('
  );

assert.equal(
  ownerCardIndex >= 0 &&
  operationalWorkspaceIndex > ownerCardIndex,

  true,

  'Owner Oversight must be a distinct state before the operational Guard workspace.'
);

/*
 * Firestore write isolation remains unchanged.
 * Owner review authority does not imply Owner check-in authority.
 */
assert.match(
  rulesSource,

  /function guardCreatesOwnAttendance\\(data, attendanceId\\) \\{\\s*return isStudioGuardAccount\\(\\)/,

  'Attendance create must remain studio-guard-only.'
);

assert.match(
  rulesSource,

  /allow create: if validGuardAttendanceSession\\(request\\.resource\\.data, attendanceId\\) &&\\s*guardCreatesOwnAttendance/,

  'Attendance create must continue routing through guardCreatesOwnAttendance.'
);

assert.match(
  rulesSource,

  /function guardClosesOwnAttendance\\(\\) \\{\\s*return isStudioGuardAccount\\(\\)/,

  'Attendance self-checkout must remain studio-guard-only.'
);

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/guard-owner-oversight-contract-test.mjs'
  ),

  true,

  'GP-3 Owner Oversight contract must be registered in npm test.'
);

console.log(
  'guard-owner-oversight-contract-test: PASS'
);
`;

/* ==========================================================================
   PACKAGE TEST REGISTRATION
   ========================================================================== */

if (!packageJson.scripts.test.includes(ownerContractCommand)) {
  packageJson.scripts.test =
    packageJson.scripts.test.trim() +
    ' && ' +
    ownerContractCommand;
}

/* ==========================================================================
   FINAL VALIDATION BEFORE WRITE
   ========================================================================== */

for (const marker of [
  'guard-owner-oversight-card',
  'GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT',
  'isOwnerOversight',
  'Owner Mode',
  'Anda sedang melihat Guard Portal sebagai Owner',
  'Mode Owner tidak membuat attendance.',
  'href="/admin"',
  'href="/admin/operations/guard-attendance"',
  'if (!canUseGuardPage)',
]) {
  requireMarker(
    guardPage,
    marker,
    'patched GuardAttendancePage.jsx',
  );
}

requireMarker(
  authStyles,
  ownerStyleMarker,
  'patched admin-auth.css',
);

requireMarker(
  baselineContract,
  'GP-3 Owner Oversight marker missing:',
  'patched baseline contract',
);

requireMarker(
  ownerContract,
  'guard-owner-oversight-contract-test: PASS',
  'GP-3 targeted contract',
);

/* ==========================================================================
   WRITE
   ========================================================================== */

write(
  files.guardPage,
  guardPage,
);

write(
  files.authStyles,
  authStyles,
);

write(
  files.baselineContract,
  baselineContract,
);

write(
  files.ownerContract,
  ownerContract,
);

write(
  files.packageJson,
  JSON.stringify(
    packageJson,
    null,
    2,
  ) + '\n',
);

console.log('');
console.log('GP-3 Owner Oversight Mode applied.');
console.log('- Owner now resolves to a dedicated Guard Portal oversight UI');
console.log('- Owner no longer falls through generic Guard locked state');
console.log('- Owner receives Admin and Attendance Review CTAs');
console.log('- Owner cannot inherit Guard identity while in oversight mode');
console.log('- Attendance mutation handlers now fail closed outside operational Guard access');
console.log('- Firestore rules and attendance lifecycle were not changed');
console.log('- GP-3 targeted contract registered in npm test');
console.log('');
