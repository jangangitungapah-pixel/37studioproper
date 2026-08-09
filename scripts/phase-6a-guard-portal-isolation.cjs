const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const FILES = {
  permissions: path.join(
    ROOT,
    'src',
    'utils',
    'adminPermissions.js',
  ),

  adminPage: path.join(
    ROOT,
    'src',
    'pages',
    'AdminPage.jsx',
  ),

  loginPage: path.join(
    ROOT,
    'src',
    'pages',
    'LoginPage.jsx',
  ),

  guardPage: path.join(
    ROOT,
    'src',
    'pages',
    'guard',
    'GuardAttendancePage.jsx',
  ),

  rules: path.join(
    ROOT,
    'firestore.rules',
  ),

  test: path.join(
    ROOT,
    'scripts',
    'guard-portal-isolation-contract-test.mjs',
  ),

  packageJson: path.join(
    ROOT,
    'package.json',
  ),
};

const staged = new Map();

function fail(message) {
  console.error('');
  console.error(
    '[phase-6a] ' +
      message,
  );
  console.error('');

  process.exit(1);
}

function normalize(value) {
  return String(value)
    .replace(/\r\n/g, '\n');
}

function read(file) {
  if (staged.has(file)) {
    return staged.get(file);
  }

  if (!fs.existsSync(file)) {
    fail(
      'File tidak ditemukan: ' +
        path.relative(
          ROOT,
          file,
        ),
    );
  }

  return normalize(
    fs.readFileSync(
      file,
      'utf8',
    ),
  );
}

function stage(
  file,
  content,
) {
  staged.set(
    file,
    normalize(content),
  );
}

function countOccurrences(
  source,
  needle,
) {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let cursor = 0;

  while (true) {
    const index =
      source.indexOf(
        needle,
        cursor,
      );

    if (index < 0) {
      return count;
    }

    count += 1;

    cursor =
      index +
      needle.length;
  }
}

function replaceOnce(
  file,
  before,
  after,
  label,
) {
  const source =
    read(file);

  if (
    !source.includes(before) &&
    source.includes(after)
  ) {
    console.log(
      '[phase-6a] Already applied: ' +
        label,
    );

    return;
  }

  const count =
    countOccurrences(
      source,
      before,
    );

  if (count !== 1) {
    fail(
      label +
        ': expected 1 anchor, found ' +
        count,
    );
  }

  stage(
    file,
    source.replace(
      before,
      after,
    ),
  );

  console.log(
    '[phase-6a] Updated: ' +
      label,
  );
}

function replaceRange(
  file,
  startMarker,
  endMarker,
  replacement,
  label,
) {
  const source =
    read(file);

  const start =
    source.indexOf(
      startMarker,
    );

  const end =
    source.indexOf(
      endMarker,
      start >= 0
        ? start
        : 0,
    );

  if (
    start < 0 ||
    end < 0 ||
    end <= start
  ) {
    fail(
      label +
        ': range markers tidak ditemukan.',
    );
  }

  stage(
    file,
    source.slice(
      0,
      start,
    ) +
      replacement +
      source.slice(
        end,
      ),
  );

  console.log(
    '[phase-6a] Updated: ' +
      label,
  );
}

function stageNewFile(
  file,
  content,
) {
  const normalized =
    normalize(content);

  if (fs.existsSync(file)) {
    const existing =
      normalize(
        fs.readFileSync(
          file,
          'utf8',
        ),
      );

    if (
      existing ===
      normalized
    ) {
      console.log(
        '[phase-6a] Already correct: ' +
          path.relative(
            ROOT,
            file,
          ),
      );

      return;
    }

    fail(
      path.relative(
        ROOT,
        file,
      ) +
        ' sudah ada dengan isi berbeda.',
    );
  }

  stage(
    file,
    normalized,
  );

  console.log(
    '[phase-6a] Prepared: ' +
      path.relative(
        ROOT,
        file,
      ),
  );
}

/**
 * ============================================================
 * BASELINE
 * ============================================================
 */

if (
  !read(
    FILES.packageJson,
  ).includes(
    'refund-lifecycle-contract-test.mjs',
  )
) {
  fail(
    'Phase 5D belum menjadi baseline.',
  );
}

if (
  !read(
    FILES.permissions,
  ).includes(
    "export const guardPortalPermissionKeys = ['schedule', 'customers', 'billing', 'inventory'];",
  )
) {
  fail(
    'Expected legacy guard admin permissions tidak ditemukan.',
  );
}

if (
  !read(
    FILES.guardPage,
  ).includes(
    'subscribeOperatorFeeEntries',
  )
) {
  fail(
    'Expected guard fee subscription baseline tidak ditemukan.',
  );
}

if (
  !read(
    FILES.rules,
  ).includes(
    'guardCreatesOwnAttendance',
  )
) {
  fail(
    'Guard attendance Firestore foundation tidak ditemukan.',
  );
}

/**
 * ============================================================
 * 1. STUDIO GUARD GETS ZERO ADMIN PAGE PERMISSIONS
 * ============================================================
 */

replaceOnce(
  FILES.permissions,

  "export const guardPortalPermissionKeys = ['schedule', 'customers', 'billing', 'inventory'];",

  'export const guardPortalPermissionKeys = [];',

  'guard admin permissions -> zero',
);

/**
 * Existing persisted permission flags remain compatibility data.
 *
 * normalizeAdminPermissionsForRole() already masks every key not present
 * in guardPortalPermissionKeys, so an existing guard document with old
 * schedule/billing flags immediately becomes zero-access in the UI.
 *
 * No destructive user-document migration required.
 */

/**
 * ============================================================
 * 2. FIRESTORE ADMIN PERMISSION CHECK EXCLUDES STUDIO GUARD
 * ============================================================
 */

replaceOnce(
  FILES.rules,

  [
    '    function hasPermission(page) {',
    '      return isOwner() || (',
    '        isApproved() &&',
    '        getUserData().permissions is map &&',
    '        getUserData().permissions[page] == true',
    '      );',
    '    }',
  ].join('\n'),

  [
    '    function hasPermission(page) {',
    '      return isOwner() || (',
    '        isApprovedAdmin() &&',
    '        getUserData().permissions is map &&',
    '        getUserData().permissions[page] == true',
    '      );',
    '    }',
  ].join('\n'),

  'Firestore admin permission boundary',
);

/**
 * ============================================================
 * 3. BIND NEW ATTENDANCE TO ASSIGNED GUARD IDENTITY
 * ============================================================
 */

const guardIdentityHelper = [
  '    function getCurrentGuardPersonId() {',
  '      let account = getUserData();',
  '',
  '      return (',
  "        'guardId' in account &&",
  '        account.guardId is string &&',
  '        account.guardId.size() > 0',
  '      )',
  '        ? account.guardId',
  '        : request.auth.uid;',
  '    }',
  '',
].join('\n');

replaceOnce(
  FILES.rules,

  '    function guardCreatesOwnAttendance(data) {',

  guardIdentityHelper +
    '    function guardCreatesOwnAttendance(data) {',

  'guard assigned identity helper',
);

replaceOnce(
  FILES.rules,

  [
    '      return isStudioGuardAccount() &&',
    '        data.guardUid == request.auth.uid &&',
    "        data.status == 'pending_approval' &&",
  ].join('\n'),

  [
    '      return isStudioGuardAccount() &&',
    '        data.guardUid == request.auth.uid &&',
    '        data.guardPersonId == getCurrentGuardPersonId() &&',
    "        data.status == 'pending_approval' &&",
  ].join('\n'),

  'bind new attendance to guardId',
);

/**
 * ============================================================
 * 4. ADMIN SHELL REDIRECTS STUDIO GUARD
 * ============================================================
 */

replaceOnce(
  FILES.adminPage,

  "import { PORTAL_ACCESS } from '../utils/accountRoles.js';",

  "import { ACCOUNT_ROLES, PORTAL_ACCESS } from '../utils/accountRoles.js';",

  'AdminPage guard role import',
);

replaceOnce(
  FILES.adminPage,

  `  if (authState.user?.access === PORTAL_ACCESS.WRONG_PORTAL_CLIENT) {`,

  `  if (
    authState.user?.role ===
    ACCOUNT_ROLES.STUDIO_GUARD
  ) {
    return (
      <Navigate
        to="/guard/attendance"
        replace
      />
    );
  }

  if (authState.user?.access === PORTAL_ACCESS.WRONG_PORTAL_CLIENT) {`,

  'Admin shell guard redirect',
);

/**
 * ============================================================
 * 5. GENERIC LOGIN ROUTES STUDIO GUARD TO GUARD PORTAL
 * ============================================================
 */

replaceOnce(
  FILES.loginPage,

  "import { PORTAL_ACCESS } from '../utils/accountRoles.js';",

  "import { ACCOUNT_ROLES, PORTAL_ACCESS } from '../utils/accountRoles.js';",

  'Login guard role import',
);

replaceOnce(
  FILES.loginPage,

  `        const access = authState.user?.access;

        if ([PORTAL_ACCESS.ALLOWED, PORTAL_ACCESS.ADMIN_PENDING].includes(access)) {`,

  `        const access = authState.user?.access;

        if (
          authState.user?.role ===
          ACCOUNT_ROLES.STUDIO_GUARD
        ) {
          navigate(
            '/guard/attendance',
            {
              replace:
                true,
            },
          );

          return;
        }

        if ([PORTAL_ACCESS.ALLOWED, PORTAL_ACCESS.ADMIN_PENDING].includes(access)) {`,

  'generic login -> guard portal',
);

/**
 * ============================================================
 * 6. GUARD PAGE: REMOVE OPERATOR FEE DATA ACCESS
 * ============================================================
 */

replaceOnce(
  FILES.guardPage,

  "import { subscribeOperatorFeeEntries } from '../../services/operatorFeeRepository.js';\n",

  '',

  'remove guard Operator Fee subscription import',
);

replaceOnce(
  FILES.guardPage,

  [
    '  UserRound,',
    '  XCircle,',
    '  Calendar,',
    '  DollarSign,',
    '  TrendingUp,',
    '  Briefcase,',
  ].join('\n'),

  [
    '  XCircle,',
    '  Calendar,',
    '  Briefcase,',
  ].join('\n'),

  'remove guard finance-only icons',
);

replaceOnce(
  FILES.guardPage,

  [
    'import {',
    '  OPERATOR_FEE_PERSON_ROLES,',
    '  useOperatorFeeSettings,',
    "} from '../../settings/operatorFeeSettings.js';",
  ].join('\n'),

  "import { useOperatorFeeSettings } from '../../settings/operatorFeeSettings.js';",

  'remove guard fee role helper import',
);

replaceRange(
  FILES.guardPage,

  'function getGuardPeople(settings) {',

  'async function readGuardAccount(user) {',

  '',

  'remove selectable guard people helper',
);

replaceOnce(
  FILES.guardPage,

  '  const [selectedGuardPersonId, setSelectedGuardPersonId] = useState(\'\');\n',

  '',

  'remove selectable guard identity state',
);

replaceOnce(
  FILES.guardPage,

  '  const [feeEntries, setFeeEntries] = useState([]);\n  const [selectedSessionForBreakdown, setSelectedSessionForBreakdown] = useState(null);\n',

  '',

  'remove guard finance state',
);

replaceOnce(
  FILES.guardPage,

  '  const guardOptions = useMemo(() => getGuardPeople(settings), [settings]);\n\n',

  '',

  'remove selectable guard options',
);

/**
 * Remove the effect that subscribes operator-fee entries.
 */
replaceRange(
  FILES.guardPage,

  `  useEffect(() => {
    const isAllowedGuard = guardAccount && (guardAccount.role === STUDIO_GUARD_ROLE || (guardAccount.role === 'admin' && guardAccount.isGuard === true));
    if (!authUser?.uid || !isAllowedGuard || guardAccount?.status !== 'approved') {
      return () => {};
    }

    return subscribeOperatorFeeEntries(`,

  '  const currentSession = useMemo(',

  '  const currentSession = useMemo(',

  'remove guard Operator Fee realtime subscription',
);

/**
 * ============================================================
 * 7. ATTENDANCE-ONLY MONTHLY STATS
 * ============================================================
 */

const attendanceStats = `  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthSessions = sessions.filter((session) => {
      const sessionDate = new Date(session.date);

      return (
        sessionDate.getMonth() === currentMonth &&
        sessionDate.getFullYear() === currentYear
      );
    });

    const approved = thisMonthSessions.filter(
      (session) =>
        session.approvalStatus ===
        GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED
    );

    const pending = thisMonthSessions.filter(
      (session) =>
        session.approvalStatus ===
        GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING
    );

    const totalHours = approved.reduce(
      (total, session) =>
        total +
        (Number(session.durationHours) || 0),
      0,
    );

    return {
      approvedDays:
        approved.length,

      pending:
        pending.length,

      totalHours:
        totalHours.toFixed(1),
    };
  }, [sessions]);

`;

replaceRange(
  FILES.guardPage,

  '  const stats = useMemo(() => {',

  '  const recentSessions = useMemo(',

  attendanceStats +
    '  const recentSessions = useMemo(',

  'guard statistics -> attendance only',
);

/**
 * ============================================================
 * 8. BIND UI PROFILE TO ACCOUNT guardId
 * ============================================================
 */

const assignedIdentity = `  const assignedGuardPersonId =
    guardAccount?.guardId ||
    authUser?.uid ||
    '';

  const selectedGuardPerson = useMemo(() => {
    const assignedPerson =
      settings.people.find(
        (person) =>
          person.id ===
          assignedGuardPersonId,
      );

    if (assignedPerson) {
      return assignedPerson;
    }

    return {
      defaultPaymentMethod:
        'cash',

      id:
        assignedGuardPersonId,

      name:
        authUser?.displayName ||
        guardAccount?.displayName ||
        authUser?.email ||
        'Penjaga Studio',
    };
  }, [
    assignedGuardPersonId,
    authUser?.displayName,
    authUser?.email,
    guardAccount?.displayName,
    settings.people,
  ]);

`;

replaceRange(
  FILES.guardPage,

  '  const visibleGuardOptions = useMemo(() => {',

  '  const isAllowedGuard = guardAccount &&',

  assignedIdentity +
    '  const isAllowedGuard = guardAccount &&',

  'guard profile -> assigned account identity',
);

/**
 * ============================================================
 * 9. ATTENDANCE-ONLY COPY
 * ============================================================
 */

replaceOnce(
  FILES.guardPage,

  '            <small>Absensi harian untuk validasi fee dan uang makan.</small>',

  '            <small>Clock-in, clock-out, dan riwayat kehadiran penjaga.</small>',

  'guard portal attendance-only hero',
);

replaceOnce(
  FILES.guardPage,

  `                <div className="guard-stat-item">
                  <span className="guard-stat-icon"><Calendar size={14} /></span>
                  <div className="guard-stat-content">
                    <small>Kehadiran (Bulan Ini)</small>
                    <strong>{stats.count} Hari</strong>
                  </div>
                </div>
                <div className="guard-stat-item">
                  <span className="guard-stat-icon"><Clock3 size={14} /></span>
                  <div className="guard-stat-content">
                    <small>Total Jam Jaga</small>
                    <strong>{stats.totalHours} Jam</strong>
                  </div>
                </div>
                <div className="guard-stat-item is-highlight">
                  <span className="guard-stat-icon"><DollarSign size={14} /></span>
                  <div className="guard-stat-content">
                    <small>Estimasi Pendapatan</small>
                    <strong>{formatCurrency(stats.totalEarnings)}</strong>
                  </div>
                </div>`,

  `                <div className="guard-stat-item">
                  <span className="guard-stat-icon"><Calendar size={14} /></span>
                  <div className="guard-stat-content">
                    <small>Approved Bulan Ini</small>
                    <strong>{stats.approvedDays} Hari</strong>
                  </div>
                </div>
                <div className="guard-stat-item">
                  <span className="guard-stat-icon"><Clock3 size={14} /></span>
                  <div className="guard-stat-content">
                    <small>Total Jam Jaga</small>
                    <strong>{stats.totalHours} Jam</strong>
                  </div>
                </div>
                <div className="guard-stat-item is-highlight">
                  <span className="guard-stat-icon"><Clock3 size={14} /></span>
                  <div className="guard-stat-content">
                    <small>Menunggu Approval</small>
                    <strong>{stats.pending}</strong>
                  </div>
                </div>`,

  'guard monthly finance stats -> attendance stats',
);

/**
 * ============================================================
 * 10. REMOVE PROFILE SELECTOR
 * ============================================================
 */

replaceRange(
  FILES.guardPage,

  `                    <label className="guard-input-label">
                      <span>PILIH PROFIL SHIFT</span>`,

  `                    <label className="guard-input-label">
                      <span>CATATAN SHIFT (OPSIONAL)</span>`,

  `                    <label className="guard-input-label">
                      <span>PROFIL PENJAGA</span>
                      <input
                        className="guard-select"
                        disabled
                        readOnly
                        value={selectedGuardPerson.name}
                      />
                    </label>

                    <label className="guard-input-label">
                      <span>CATATAN SHIFT (OPSIONAL)</span>`,

  'guard profile selector -> locked identity',
);

replaceOnce(
  FILES.guardPage,

  '                    disabled={isBusy || !effectiveGuardPersonId}',

  '                    disabled={isBusy || !selectedGuardPerson?.id}',

  'check-in uses assigned profile',
);

/**
 * ============================================================
 * 11. HISTORY IS READ-ONLY ATTENDANCE
 * ============================================================
 */

replaceOnce(
  FILES.guardPage,

  '<TrendingUp size={16} style={{ color: \'var(--auth-accent)\' }} />',

  '<Calendar size={16} style={{ color: \'var(--auth-accent)\' }} />',

  'history attendance icon',
);

const oldHistoryOpening = [
  '                    <button',
  '                      className={`guard-history-card-item is-status-${getApprovalTone(session.approvalStatus)}`}',
  '                      key={session.id}',
  '                      type="button"',
  '                      onClick={() => setSelectedSessionForBreakdown(session)}',
  '                    >',
].join('\n');

const newHistoryOpening = [
  '                    <article',
  "                      className={'guard-history-card-item is-status-' + getApprovalTone(session.approvalStatus)}",
  '                      key={session.id}',
  '                    >',
].join('\n');

replaceOnce(
  FILES.guardPage,

  oldHistoryOpening,

  newHistoryOpening,

  'attendance history becomes read-only',
);

replaceOnce(
  FILES.guardPage,

  `                            <span className="history-breakdown-hint">Detail Komisi &rarr;</span>`,

  '',

  'remove commission breakdown hint',
);

replaceOnce(
  FILES.guardPage,

  `                      </div>
                    </button>
                  ))`,

  `                      </div>
                    </article>
                  ))`,

  'close read-only attendance history item',
);

/**
 * ============================================================
 * 12. CHECKOUT COPY NO LONGER REFERENCES COMMISSION DATA
 * ============================================================
 */

replaceOnce(
  FILES.guardPage,

  `                ⚠️ <strong>Perhatian:</strong> Komisi booking yang terjadi <em>setelah</em> Anda selesai jaga tetap akan terhitung selama booking masih terdaftar di tanggal jaga Anda hari ini.`,

  `                ℹ️ <strong>Catatan:</strong> Setelah selesai jaga, durasi shift dikunci dan status approval tetap dapat ditinjau oleh owner.`,

  'checkout attendance-only information',
);

/**
 * ============================================================
 * 13. REMOVE COMMISSION BREAKDOWN MODAL
 * ============================================================
 */

replaceRange(
  FILES.guardPage,

  '\n\n      {selectedSessionForBreakdown ?',

  '\n    </main>',

  '',

  'remove guard commission breakdown modal',
);

/**
 * ============================================================
 * 14. CONTRACT TEST
 * ============================================================
 */

const testSource = `import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

import {
  adminPermissionPages,
  guardPortalPermissionKeys,
  hasAdminPagePermission,
  normalizeAdminPermissionsForRole,
} from '../src/utils/adminPermissions.js';

const legacyGuardPermissions =
  adminPermissionPages.reduce(
    (permissions, page) => ({
      ...permissions,
      [page.key]:
        true,
    }),
    {},
  );

const normalizedGuardPermissions =
  normalizeAdminPermissionsForRole(
    legacyGuardPermissions,
    'studio_guard',
  );

assert.deepEqual(
  guardPortalPermissionKeys,
  [],
  'studio_guard must not own admin-page permissions.',
);

assert.equal(
  Object.values(
    normalizedGuardPermissions,
  ).every(
    (value) =>
      value === false,
  ),
  true,
  'Legacy persisted guard permission flags must become inert in UI permission normalization.',
);

for (
  const page
  of adminPermissionPages
) {
  assert.equal(
    hasAdminPagePermission(
      {
        permissions:
          legacyGuardPermissions,

        role:
          'studio_guard',

        status:
          'approved',
      },

      page.key,
    ),

    false,

    'studio_guard must not access admin page: ' +
      page.key,
  );
}

const adminSource =
  readFileSync(
    resolve(
      'src/pages/AdminPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  adminSource.includes(
    'ACCOUNT_ROLES.STUDIO_GUARD',
  ),
  true,
);

assert.equal(
  adminSource.includes(
    'to="/guard/attendance"',
  ),
  true,
  'Direct /admin access must redirect studio_guard to guard portal.',
);

const loginSource =
  readFileSync(
    resolve(
      'src/pages/LoginPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  loginSource.includes(
    "authState.user?.role ===\\n          ACCOUNT_ROLES.STUDIO_GUARD",
  ),
  true,
);

assert.equal(
  loginSource.includes(
    "navigate(\\n            '/guard/attendance'",
  ),
  true,
  'Generic login must route studio_guard to attendance.',
);

const guardSource =
  readFileSync(
    resolve(
      'src/pages/guard/GuardAttendancePage.jsx',
    ),
    'utf8',
  );

for (
  const forbidden
  of [
    'subscribeOperatorFeeEntries',
    'feeEntries',
    'selectedSessionForBreakdown',
    'Estimasi Pendapatan',
    'Detail Komisi',
    'Komisi booking',
    'PILIH PROFIL SHIFT',
  ]
) {
  assert.equal(
    guardSource.includes(
      forbidden,
    ),
    false,
    'Attendance-only guard page must not contain: ' +
      forbidden,
  );
}

for (
  const required
  of [
    'assignedGuardPersonId',
    'guardAccount?.guardId',
    'PROFIL PENJAGA',
    'Approved Bulan Ini',
    'Menunggu Approval',
    'Clock-in, clock-out, dan riwayat kehadiran penjaga.',
  ]
) {
  assert.equal(
    guardSource.includes(
      required,
    ),
    true,
    'Guard attendance page missing isolation contract: ' +
      required,
  );
}

const rulesSource =
  readFileSync(
    resolve(
      'firestore.rules',
    ),
    'utf8',
  );

assert.equal(
  rulesSource.includes(
    'function hasPermission(page) {\\n      return isOwner() || (\\n        isApprovedAdmin() &&',
  ),
  true,
  'Admin data permissions must only accept owner/approved admin.',
);

assert.equal(
  rulesSource.includes(
    'function getCurrentGuardPersonId()',
  ),
  true,
);

assert.equal(
  rulesSource.includes(
    'data.guardPersonId == getCurrentGuardPersonId()',
  ),
  true,
  'New guard attendance must be bound to the authenticated guard identity.',
);

assert.equal(
  rulesSource.includes(
    'allow read: if canManageGuardAttendance() || (\\n        isStudioGuardAccount() &&\\n        resource.data.guardUid == request.auth.uid',
  ),
  true,
  'Guard must only read own attendance unless account is an attendance admin.',
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
    'refund-lifecycle-contract-test.mjs',
  ),
  true,
  'Phase 5D gate must remain.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'guard-portal-isolation-contract-test.mjs',
  ),
  true,
  'Phase 6A gate must be registered.',
);

process.stdout.write(
  '✅ Guard Portal Isolation contract passed.\\n',
);
`;

stageNewFile(
  FILES.test,
  testSource,
);

/**
 * ============================================================
 * 15. PACKAGE TEST PIPELINE
 * ============================================================
 */

let packageJson;

try {
  packageJson =
    JSON.parse(
      read(
        FILES.packageJson,
      ),
    );
} catch (error) {
  fail(
    'package.json invalid: ' +
      error.message,
  );
}

const phase5d =
  'node scripts/refund-lifecycle-contract-test.mjs';

const phase6a =
  'node scripts/guard-portal-isolation-contract-test.mjs';

const commands =
  packageJson
    .scripts
    .test
    .split('&&')
    .map(
      (command) =>
        command.trim(),
    )
    .filter(Boolean);

if (
  !commands.includes(
    phase5d,
  )
) {
  fail(
    'Phase 5D contract hilang dari npm test.',
  );
}

if (
  !commands.includes(
    phase6a,
  )
) {
  packageJson.scripts.test =
    [
      ...commands,
      phase6a,
    ].join(
      ' && ',
    );

  stage(
    FILES.packageJson,
    JSON.stringify(
      packageJson,
      null,
      2,
    ) +
      '\n',
  );
}

/**
 * ============================================================
 * FINAL VALIDATION
 * ============================================================
 */

const nextPermissions =
  read(
    FILES.permissions,
  );

if (
  !nextPermissions.includes(
    'export const guardPortalPermissionKeys = [];',
  )
) {
  fail(
    'Guard masih memiliki admin permission keys.',
  );
}

const nextRules =
  read(
    FILES.rules,
  );

for (
  const required
  of [
    'isApprovedAdmin() &&',
    'function getCurrentGuardPersonId()',
    'data.guardPersonId == getCurrentGuardPersonId()',
  ]
) {
  if (
    !nextRules.includes(
      required,
    )
  ) {
    fail(
      'Firestore guard isolation kehilangan: ' +
        required,
    );
  }
}

const nextAdmin =
  read(
    FILES.adminPage,
  );

if (
  !nextAdmin.includes(
    'ACCOUNT_ROLES.STUDIO_GUARD',
  ) ||
  !nextAdmin.includes(
    'to="/guard/attendance"',
  )
) {
  fail(
    'Admin shell belum mengisolasi studio_guard.',
  );
}

const nextLogin =
  read(
    FILES.loginPage,
  );

if (
  !nextLogin.includes(
    'ACCOUNT_ROLES.STUDIO_GUARD',
  ) ||
  !nextLogin.includes(
    "'/guard/attendance'",
  )
) {
  fail(
    'Generic login belum mengarahkan studio_guard ke guard portal.',
  );
}

const nextGuard =
  read(
    FILES.guardPage,
  );

for (
  const forbidden
  of [
    'subscribeOperatorFeeEntries',
    'feeEntries',
    'selectedSessionForBreakdown',
    'Estimasi Pendapatan',
    'Detail Komisi',
    'PILIH PROFIL SHIFT',
  ]
) {
  if (
    nextGuard.includes(
      forbidden,
    )
  ) {
    fail(
      'Guard attendance masih memiliki non-attendance surface: ' +
        forbidden,
    );
  }
}

for (
  const required
  of [
    'assignedGuardPersonId',
    'guardAccount?.guardId',
    'PROFIL PENJAGA',
  ]
) {
  if (
    !nextGuard.includes(
      required,
    )
  ) {
    fail(
      'Guard identity binding kehilangan: ' +
        required,
    );
  }
}

/**
 * ============================================================
 * WRITE
 * ============================================================
 */

for (
  const [
    file,
    content,
  ]
  of staged.entries()
) {
  fs.mkdirSync(
    path.dirname(
      file,
    ),
    {
      recursive:
        true,
    },
  );

  fs.writeFileSync(
    file,
    content,
    'utf8',
  );

  console.log(
    '[phase-6a] Written: ' +
      path.relative(
        ROOT,
        file,
      ),
  );
}

console.log('');
console.log(
  '✅ Phase 6A Guard Portal Isolation prepared.',
);
console.log('');
console.log('studio_guard boundary:');
console.log('  Admin shell = BLOCKED / redirected');
console.log('  Schedule = BLOCKED');
console.log('  Customers = BLOCKED');
console.log('  Billing = BLOCKED');
console.log('  Bookkeeping = BLOCKED');
console.log('  Operator Fee = BLOCKED');
console.log('  Inventory = BLOCKED');
console.log('');
console.log('Allowed:');
console.log('  /guard/attendance');
console.log('  own attendance history');
console.log('  own clock-in');
console.log('  own clock-out');
console.log('');
console.log('Identity binding:');
console.log('  guardUid = auth.uid');
console.log('  guardPersonId = account.guardId || auth.uid');
console.log('');
console.log('Existing legacy guard permission flags are inert.');
console.log('No destructive user migration.');
console.log('');
console.log('Firestore rules changed: deploy required after push.');