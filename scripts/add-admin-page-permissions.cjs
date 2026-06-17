const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STAMP = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

const PERMISSION_UTIL_FILE = 'src/utils/adminPermissions.js';
const AUTH_REPOSITORY_FILE = 'src/services/adminAuthRepository.js';
const ADMIN_PAGE_FILE = 'src/pages/AdminPage.jsx';
const SETTINGS_PAGE_FILE = 'src/pages/admin/SettingsPage.jsx';
const CSS_FILE = 'src/styles/admin-auth.css';
const RULES_FILE = 'firestore.rules';

function fail(message) {
  console.error('\n❌ ' + message);
  process.exit(1);
}

function abs(file) {
  return path.join(ROOT, file);
}

function read(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) fail('File tidak ditemukan: ' + file);
  return fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
}

function backup(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) return;
  fs.copyFileSync(target, target + '.bak-' + STAMP);
}

function writeIfChanged(file, content) {
  const target = abs(file);
  const normalized = content.replace(/\r\n/g, '\n').trimEnd() + '\n';
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';

  if (current === normalized) {
    console.log('↔️  Tidak berubah: ' + file);
    return false;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  backup(file);
  fs.writeFileSync(target, normalized, 'utf8');
  console.log('✍️  Ditulis: ' + file);
  return true;
}

function replaceOnce(text, find, replacement, label) {
  if (!text.includes(find)) fail('Anchor tidak ditemukan: ' + label);
  return text.replace(find, replacement);
}

function replaceIfExists(text, find, replacement, label) {
  if (!text.includes(find)) {
    console.log('↔️  Anchor tidak ada, skip: ' + label);
    return text;
  }

  console.log('🔧 Patch: ' + label);
  return text.replace(find, replacement);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripMarkerBlock(text, markerName) {
  const start = '/* === ' + markerName + ': START === */';
  const end = '/* === ' + markerName + ': END === */';
  const pattern = new RegExp('\\n?' + escapeRegExp(start) + '[\\s\\S]*?' + escapeRegExp(end) + '\\n?', 'g');

  return text.replace(pattern, '\n');
}

function findFunctionRange(text, functionName) {
  const signatures = [
    'function ' + functionName + '(',
    'async function ' + functionName + '(',
    'export async function ' + functionName + '(',
  ];

  let start = -1;

  for (const signature of signatures) {
    const index = text.indexOf(signature);

    if (index !== -1 && (start === -1 || index < start)) {
      start = index;
    }
  }

  if (start === -1) return null;

  const parenStart = text.indexOf('(', start);
  if (parenStart === -1) fail('Paren pembuka tidak ditemukan: ' + functionName);

  let parenDepth = 0;
  let parenEnd = -1;

  for (let index = parenStart; index < text.length; index += 1) {
    const char = text[index];

    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth -= 1;

    if (parenDepth === 0) {
      parenEnd = index;
      break;
    }
  }

  if (parenEnd === -1) fail('Paren penutup tidak ditemukan: ' + functionName);

  const braceStart = text.indexOf('{', parenEnd);
  if (braceStart === -1) fail('Brace pembuka tidak ditemukan: ' + functionName);

  let depth = 0;
  let end = -1;

  for (let index = braceStart; index < text.length; index += 1) {
    const char = text[index];

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      end = index + 1;
      break;
    }
  }

  if (end === -1) fail('Brace penutup tidak ditemukan: ' + functionName);

  while (text[end] === '\n') end += 1;

  return { start, end };
}

function insertAfterFunction(text, functionName, snippet) {
  const range = findFunctionRange(text, functionName);

  if (!range) fail('Function tidak ditemukan untuk insert: ' + functionName);

  return text.slice(0, range.end) + snippet.trimEnd() + '\n\n' + text.slice(range.end);
}

function assertNoTopLevelOrphan(text, file) {
  if (/^\s*\) \{$/m.test(text)) {
    const badLines = text
      .split('\n')
      .map((line, index) => (line.trim() === ') {' ? index + 1 : null))
      .filter(Boolean);

    fail(file + ' masih punya orphan top-level ") {" di line: ' + badLines.join(', '));
  }
}

function writePermissionUtil() {
  const content = `export const OWNER_EMAIL = 'marsicprod@gmail.com';

export const adminPermissionPages = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Overview utama studio, chart, dan ringkasan lintas halaman.',
  },
  {
    key: 'schedule',
    label: 'Schedule',
    description: 'Kalender booking dan pengelolaan jadwal studio.',
  },
  {
    key: 'customers',
    label: 'Customer',
    description: 'CRM customer, detail pelanggan, dan riwayat booking.',
  },
  {
    key: 'billing',
    label: 'Billing',
    description: 'Invoice, pembayaran, DP, dan outstanding tagihan.',
  },
  {
    key: 'bookkeeping',
    label: 'Pembukuan',
    description: 'Cashflow, pemasukan manual, pengeluaran, dan laporan.',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Stock, asset studio, movement log, dan maintenance.',
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Pengaturan harga, invoice, account, dan approval admin.',
  },
];

export const defaultAdminPermissions = adminPermissionPages.reduce((result, page) => ({
  ...result,
  [page.key]: true,
}), {});

export function normalizeAdminPermissions(permissions, fallbackValue = true) {
  const source = permissions && typeof permissions === 'object' ? permissions : {};

  return adminPermissionPages.reduce((result, page) => ({
    ...result,
    [page.key]: typeof source[page.key] === 'boolean' ? source[page.key] : fallbackValue,
  }), {});
}

export function isOwnerEmail(email) {
  return String(email || '').trim().toLowerCase() === OWNER_EMAIL;
}

export function isOwnerAdminUser(user) {
  return isOwnerEmail(user?.email);
}

export function hasAdminPagePermission(user, pageKey) {
  if (!user) return true;
  if (isOwnerAdminUser(user)) return true;

  const permissions = user.permissions;

  if (!permissions) return true;

  return normalizeAdminPermissions(permissions, true)[pageKey] !== false;
}

export function countEnabledAdminPermissions(permissions) {
  return Object.values(normalizeAdminPermissions(permissions, true)).filter(Boolean).length;
}
`;

  writeIfChanged(PERMISSION_UTIL_FILE, content);
}

function patchAuthRepository() {
  let text = read(AUTH_REPOSITORY_FILE);

  if (!text.includes("from '../utils/adminPermissions.js';")) {
    text = replaceOnce(
      text,
      "import { sendNewUserNotificationEmail } from './emailService.js';",
      "import { sendNewUserNotificationEmail } from './emailService.js';\nimport { defaultAdminPermissions, normalizeAdminPermissions } from '../utils/adminPermissions.js';",
      'admin permissions import'
    );
  }

  if (!text.includes('permissions: defaultAdminPermissions,')) {
    text = replaceOnce(
      text,
      `             provider: user.providerData[0]?.providerId || 'unknown',
             status: isOwnerEmail ? 'approved' : 'pending',`,
      `             provider: user.providerData[0]?.providerId || 'unknown',
             permissions: defaultAdminPermissions,
             status: isOwnerEmail ? 'approved' : 'pending',`,
      'new user default permissions'
    );
  }

  text = replaceIfExists(
    text,
    `              status: userData?.status || (isApproved ? 'approved' : 'pending'),
              isApproved`,
    `              status: userData?.status || (isApproved ? 'approved' : 'pending'),
              permissions: normalizeAdminPermissions(userData?.permissions),
              isApproved`,
    'auth callback permissions'
  );

  text = replaceIfExists(
    text,
    `                status: isOwnerEmail ? 'approved' : 'pending',
                isApproved: isOwnerEmail`,
    `                status: isOwnerEmail ? 'approved' : 'pending',
                permissions: defaultAdminPermissions,
                isApproved: isOwnerEmail`,
    'auth error fallback permissions'
  );

  assertNoTopLevelOrphan(text, AUTH_REPOSITORY_FILE);
  writeIfChanged(AUTH_REPOSITORY_FILE, text);

  const result = read(AUTH_REPOSITORY_FILE);
  const checks = [
    'defaultAdminPermissions',
    'normalizeAdminPermissions',
    'permissions: defaultAdminPermissions',
    'permissions: normalizeAdminPermissions(userData?.permissions)',
  ];

  for (const needle of checks) {
    if (!result.includes(needle)) fail('Verifikasi adminAuthRepository gagal: ' + needle);
  }
}

function patchAdminPage() {
  let text = read(ADMIN_PAGE_FILE);

  if (!text.includes("from '../utils/adminPermissions.js';")) {
    text = replaceOnce(
      text,
      "import { getAccountDefaultLandingPath } from '../utils/accountSettings.js';",
      "import { getAccountDefaultLandingPath } from '../utils/accountSettings.js';\nimport { hasAdminPagePermission } from '../utils/adminPermissions.js';",
      'AdminPage permissions import'
    );
  }

  if (!text.includes('function getFirstPermittedNavItem(user)')) {
    text = replaceOnce(
      text,
      `function getInitialSidebarState() {`,
      `function getFirstPermittedNavItem(user) {
  return navItems.find((item) => hasAdminPagePermission(user, item.key)) || navItems[0];
}

function getPermittedDefaultLandingPath(user) {
  const preferredPath = getAccountDefaultLandingPath(user?.uid);
  const preferredItem = navItems.find((item) => item.path === preferredPath);

  if (preferredItem && hasAdminPagePermission(user, preferredItem.key)) {
    return preferredItem.path;
  }

  return getFirstPermittedNavItem(user).path;
}

function getInitialSidebarState() {`,
      'AdminPage permission helpers'
    );
  }

  if (!text.includes('const permittedNavItems = useMemo(')) {
    text = replaceOnce(
      text,
      `  const activeItem = routeItem || navItems[0];

  const mobilePrimaryNavItems = useMemo(
    () => navItems.filter((item) => mobilePrimaryNavKeys.includes(item.key)),
    []
  );

  const mobileMoreNavItems = useMemo(
    () => navItems.filter((item) => !mobilePrimaryNavKeys.includes(item.key)),
    []
  );

  const isMoreNavActive = mobileMoreNavItems.some((item) => item.key === activeItem.key);`,
      `  const permittedNavItems = useMemo(
    () => navItems.filter((item) => hasAdminPagePermission(authState.user, item.key)),
    [authState.user]
  );

  const isRoutePermitted = !routeItem || hasAdminPagePermission(authState.user, routeItem.key);
  const activeItem = isRoutePermitted ? (routeItem || getFirstPermittedNavItem(authState.user)) : getFirstPermittedNavItem(authState.user);

  const mobilePrimaryNavItems = useMemo(
    () => permittedNavItems.filter((item) => mobilePrimaryNavKeys.includes(item.key)),
    [permittedNavItems]
  );

  const mobileMoreNavItems = useMemo(
    () => permittedNavItems.filter((item) => !mobilePrimaryNavKeys.includes(item.key)),
    [permittedNavItems]
  );

  const isMoreNavActive = mobileMoreNavItems.some((item) => item.key === activeItem.key);`,
      'AdminPage permitted nav items'
    );
  }

  text = replaceIfExists(
    text,
    `  useEffect(() => {
    if (!authState.isReady || !authState.isAuthenticated) return;

    if (location.pathname === '/admin' || location.pathname === '/admin/' || !routeItem) {
      navigate(getAccountDefaultLandingPath(authState.user?.uid), { replace: true });
    }
  }, [location.pathname, navigate, routeItem, authState.isReady, authState.isAuthenticated, authState.user?.uid]);`,
    `  useEffect(() => {
    if (!authState.isReady || !authState.isAuthenticated) return;

    if (location.pathname === '/admin' || location.pathname === '/admin/' || !routeItem || !isRoutePermitted) {
      navigate(getPermittedDefaultLandingPath(authState.user), { replace: true });
    }
  }, [location.pathname, navigate, routeItem, isRoutePermitted, authState.isReady, authState.isAuthenticated, authState.user]);`,
    'AdminPage permission redirect'
  );

  text = replaceIfExists(
    text,
    `{navItems.map((item) => {`,
    `{permittedNavItems.map((item) => {`,
    'AdminPage desktop nav filtered'
  );

  assertNoTopLevelOrphan(text, ADMIN_PAGE_FILE);
  writeIfChanged(ADMIN_PAGE_FILE, text);

  const result = read(ADMIN_PAGE_FILE);
  const checks = [
    'hasAdminPagePermission',
    'function getFirstPermittedNavItem(user)',
    'function getPermittedDefaultLandingPath(user)',
    'const permittedNavItems = useMemo(',
    '!isRoutePermitted',
    '{permittedNavItems.map((item) => {',
  ];

  for (const needle of checks) {
    if (!result.includes(needle)) fail('Verifikasi AdminPage gagal: ' + needle);
  }
}

function insertApprovalsPermissionPanel(text) {
  if (text.includes('settings-permission-panel')) return text;

  const approvalsStart = text.indexOf("{activeSubpage === 'approvals' && (");
  if (approvalsStart === -1) fail('Block approvals tidak ditemukan.');

  const sectionEnd = text.indexOf(`        </section>
      )}`, approvalsStart);

  if (sectionEnd === -1) fail('Penutup approvals section tidak ditemukan.');

  const panel = `
          {approvalSettingsMessage ? (
            <p className="settings-invoice-message" role="status">{approvalSettingsMessage}</p>
          ) : null}

          {selectedPermissionUser ? (
            <div
              className="settings-permission-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closePermissionSettings();
              }}
            >
              <form className="settings-permission-panel" role="dialog" aria-modal="true" aria-labelledby="permission-panel-title" onSubmit={savePermissionSettings}>
                <header className="settings-permission-head">
                  <div>
                    <small>Permission Settings</small>
                    <h3 id="permission-panel-title">{selectedPermissionUser.displayName || selectedPermissionUser.email || 'Admin User'}</h3>
                    <span>{selectedPermissionUser.email || selectedPermissionUser.phoneNumber || selectedPermissionUser.id}</span>
                  </div>

                  <button type="button" aria-label="Tutup permission settings" onClick={closePermissionSettings}>
                    <X size={16} />
                  </button>
                </header>

                <div className="settings-permission-grid" aria-label="Daftar permission halaman admin">
                  {adminPermissionPages.map((page) => {
                    const enabled = Boolean(permissionDraft[page.key]);

                    return (
                      <button
                        className={enabled ? 'settings-permission-row is-enabled' : 'settings-permission-row'}
                        key={page.key}
                        type="button"
                        onClick={() => togglePermissionPage(page.key)}
                      >
                        <span className="settings-permission-toggle" aria-hidden="true">
                          {enabled ? '✓' : ''}
                        </span>

                        <span>
                          <strong>{page.label}</strong>
                          <small>{page.description}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <footer className="settings-permission-actions">
                  <button className="settings-mini-button is-ghost" type="button" onClick={grantAllPermissions}>
                    Full Access
                  </button>
                  <button className="settings-mini-button" type="button" onClick={closePermissionSettings}>
                    Batal
                  </button>
                  <button className="settings-mini-button is-primary" type="submit">
                    Simpan Permission
                  </button>
                </footer>
              </form>
            </div>
          ) : null}

`;

  return text.slice(0, sectionEnd) + panel + text.slice(sectionEnd);
}

function patchSettingsPage() {
  let text = read(SETTINGS_PAGE_FILE);

  if (!text.includes('SlidersHorizontal')) {
    text = replaceOnce(
      text,
      `import { Clipboard, Edit3, KeyRound, Mail, MonitorSmartphone, Phone, RefreshCcw, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react';`,
      `import { Clipboard, Edit3, KeyRound, Mail, MonitorSmartphone, Phone, RefreshCcw, Save, ShieldCheck, SlidersHorizontal, Trash2, UserRound, X } from 'lucide-react';`,
      'SettingsPage permission icons'
    );
  }

  if (!text.includes("from '../../utils/adminPermissions.js';")) {
    text = replaceOnce(
      text,
      `} from '../../utils/accountSettings.js';`,
      `} from '../../utils/accountSettings.js';
import {
  adminPermissionPages,
  countEnabledAdminPermissions,
  defaultAdminPermissions,
  normalizeAdminPermissions,
} from '../../utils/adminPermissions.js';`,
      'SettingsPage permission util imports'
    );
  }

  if (!text.includes('const [selectedPermissionUser, setSelectedPermissionUser] = useState(null);')) {
    text = replaceOnce(
      text,
      `  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);`,
      `  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedPermissionUser, setSelectedPermissionUser] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState(defaultAdminPermissions);
  const [approvalSettingsMessage, setApprovalSettingsMessage] = useState('');`,
      'SettingsPage permission state'
    );
  }

  text = replaceIfExists(
    text,
    `        await updateDoc(docRef, {
          status: 'approved',
          updatedAt: new Date().toISOString()
        });`,
    `        await updateDoc(docRef, {
          permissions: normalizeAdminPermissions(data.permissions),
          status: 'approved',
          updatedAt: new Date().toISOString()
        });`,
    'approve user keeps permissions'
  );

  if (!text.includes('function openPermissionSettings(user)')) {
    text = insertAfterFunction(
      text,
      'handleDeleteUser',
      `  function openPermissionSettings(user) {
    setSelectedPermissionUser(user);
    setPermissionDraft(normalizeAdminPermissions(user.permissions));
    setApprovalSettingsMessage('');
  }

  function closePermissionSettings() {
    setSelectedPermissionUser(null);
    setPermissionDraft(defaultAdminPermissions);
  }

  function togglePermissionPage(pageKey) {
    setPermissionDraft((current) => {
      const normalized = normalizeAdminPermissions(current);

      return {
        ...normalized,
        [pageKey]: !normalized[pageKey],
      };
    });

    if (approvalSettingsMessage) setApprovalSettingsMessage('');
  }

  function grantAllPermissions() {
    setPermissionDraft(defaultAdminPermissions);
    if (approvalSettingsMessage) setApprovalSettingsMessage('');
  }

  async function savePermissionSettings(event) {
    event.preventDefault();

    if (!selectedPermissionUser?.id) {
      setApprovalSettingsMessage('User belum dipilih.');
      return;
    }

    const normalized = normalizeAdminPermissions(permissionDraft);
    const enabledCount = countEnabledAdminPermissions(normalized);

    if (!enabledCount) {
      setApprovalSettingsMessage('Minimal aktifkan satu halaman untuk user ini.');
      return;
    }

    try {
      await updateDoc(doc(firestoreDb, 'users', selectedPermissionUser.id), {
        permissions: normalized,
        updatedAt: new Date().toISOString(),
      });

      setApprovalSettingsMessage('Permission ' + (selectedPermissionUser.displayName || selectedPermissionUser.email || 'user') + ' berhasil disimpan.');
      closePermissionSettings();
    } catch (err) {
      console.error('Gagal menyimpan permission user:', err);
      setApprovalSettingsMessage('Permission belum berhasil disimpan ke Firestore.');
    }
  }`
    );
  }

  if (!text.includes('openPermissionSettings(user)')) {
    text = replaceOnce(
      text,
      `                    <button 
                      type="button" 
                      onClick={() => handleDeleteUser(user.id)}`,
      `                    <button
                      type="button"
                      onClick={() => openPermissionSettings(user)}
                      className="settings-mini-button settings-permission-open-button"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 'auto' }}
                    >
                      <SlidersHorizontal size={13} />
                      Permission
                    </button>

                    <button 
                      type="button" 
                      onClick={() => handleDeleteUser(user.id)}`,
      'SettingsPage permission button per user'
    );
  }

  if (!text.includes('Akses halaman:')) {
    text = replaceOnce(
      text,
      `                      {user.phoneNumber && \`No HP: \${user.phoneNumber}\`}
                      {\` (\${user.provider})\`}`,
      `                      {user.phoneNumber && \`No HP: \${user.phoneNumber}\`}
                      {\` (\${user.provider})\`}
                      {' • Akses halaman: ' + countEnabledAdminPermissions(user.permissions) + '/' + adminPermissionPages.length}`,
      'SettingsPage user permission summary'
    );
  }

  text = insertApprovalsPermissionPanel(text);

  assertNoTopLevelOrphan(text, SETTINGS_PAGE_FILE);
  writeIfChanged(SETTINGS_PAGE_FILE, text);

  const result = read(SETTINGS_PAGE_FILE);
  const checks = [
    'adminPermissionPages',
    'normalizeAdminPermissions',
    'selectedPermissionUser',
    'function openPermissionSettings(user)',
    'function savePermissionSettings(event)',
    'onClick={() => openPermissionSettings(user)}',
    'settings-permission-panel',
    'settings-permission-row',
    'Akses halaman:',
  ];

  for (const needle of checks) {
    if (!result.includes(needle)) fail('Verifikasi SettingsPage gagal: ' + needle);
  }
}

function patchRules() {
  const content = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner() {
      return isSignedIn() && (
        request.auth.token.email != null &&
        request.auth.token.email.lower() == 'marsicprod@gmail.com'
      );
    }

    function getUserDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isApproved() {
      return isOwner() || (
        isSignedIn() && getUserDoc().status == 'approved'
      );
    }

    function hasPermission(page) {
      return isOwner() || (
        isApproved() && (
          getUserDoc().permissions == null ||
          getUserDoc().permissions[page] == true
        )
      );
    }

    function canAccessBookingData() {
      return hasPermission('dashboard') ||
        hasPermission('schedule') ||
        hasPermission('customers') ||
        hasPermission('billing');
    }

    function canAccessCustomerData() {
      return hasPermission('dashboard') ||
        hasPermission('customers');
    }

    function canAccessBookkeepingData() {
      return hasPermission('dashboard') ||
        hasPermission('bookkeeping');
    }

    function canAccessInventoryData() {
      return hasPermission('dashboard') ||
        hasPermission('inventory');
    }

    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isOwner());
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isOwner() || (
        isSignedIn() &&
        request.auth.uid == userId &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'updatedAt'])
      );
      allow delete: if isOwner();
    }

    match /bookings/{bookingId} {
      allow read, write: if isApproved() && canAccessBookingData();
    }

    match /customers/{customerId} {
      allow read, write: if isApproved() && canAccessCustomerData();
    }

    match /inventoryItems/{itemId} {
      allow read, write: if isApproved() && canAccessInventoryData();
    }

    match /inventoryMovements/{movementId} {
      allow read, write: if isApproved() && canAccessInventoryData();
    }

    match /bookkeepingEntries/{entryId} {
      allow read, write: if isApproved() && canAccessBookkeepingData();
    }

    match /settings/{settingId} {
      allow read: if isApproved();
      allow write: if isApproved() && hasPermission('settings');
    }

    match /mail/{mailId} {
      allow create: if isSignedIn();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`;

  writeIfChanged(RULES_FILE, content);

  const result = read(RULES_FILE);
  const checks = [
    'function hasPermission(page)',
    "hasPermission('schedule')",
    "hasPermission('bookkeeping')",
    "hasPermission('inventory')",
    "allow write: if isApproved() && hasPermission('settings');",
  ];

  for (const needle of checks) {
    if (!result.includes(needle)) fail('Verifikasi firestore.rules gagal: ' + needle);
  }
}

function patchCss() {
  let css = read(CSS_FILE);

  css = stripMarkerBlock(css, 'ADMIN USER PERMISSION SETTINGS');

  const patch = String.raw`
/* === ADMIN USER PERMISSION SETTINGS: START === */
.settings-permission-open-button {
  border-color: rgba(143, 183, 255, 0.28) !important;
  color: var(--auth-text-main) !important;
}

.settings-permission-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: end center;
  padding: 14px;
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(12px);
}

.settings-permission-panel {
  width: min(100%, 520px);
  max-height: min(82dvh, 720px);
  display: grid;
  gap: 12px;
  border: 1px solid var(--auth-border);
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.014)),
    var(--auth-bg-card);
  padding: 12px;
  overflow: auto;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.42);
}

.settings-permission-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.settings-permission-head div {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.settings-permission-head small {
  color: var(--auth-accent);
  font-size: 0.64rem;
  font-weight: 720;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.settings-permission-head h3 {
  margin: 0;
  color: var(--auth-text-strong);
  font-size: 1rem;
  font-weight: 560;
  letter-spacing: -0.03em;
}

.settings-permission-head span {
  overflow: hidden;
  color: var(--auth-text-muted);
  font-size: 0.72rem;
  text-overflow: ellipsis;
}

.settings-permission-head button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--auth-border);
  border-radius: 12px;
  background: var(--auth-bg-control);
  color: var(--auth-text-main);
  cursor: pointer;
}

.settings-permission-grid {
  display: grid;
  gap: 7px;
}

.settings-permission-row {
  width: 100%;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  border: 1px solid var(--auth-border);
  border-radius: 15px;
  background: var(--auth-bg-soft);
  padding: 9px;
  color: var(--auth-text-main);
  text-align: left;
  cursor: pointer;
}

.settings-permission-row.is-enabled {
  border-color: rgba(103, 232, 165, 0.28);
  background:
    linear-gradient(135deg, rgba(103, 232, 165, 0.08), rgba(255, 255, 255, 0.012)),
    var(--auth-bg-soft);
}

.settings-permission-toggle {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 1px solid var(--auth-border);
  border-radius: 999px;
  color: #67e8a5;
  background: var(--auth-bg-control);
  font-size: 0.72rem;
  font-weight: 800;
}

.settings-permission-row span:last-child {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.settings-permission-row strong {
  color: var(--auth-text-strong);
  font-size: 0.78rem;
  font-weight: 560;
}

.settings-permission-row small {
  color: var(--auth-text-muted);
  font-size: 0.66rem;
  line-height: 1.35;
}

.settings-permission-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.settings-permission-actions .is-primary {
  grid-column: 1 / -1;
}

@media (min-width: 768px) {
  .settings-permission-backdrop {
    place-items: center;
  }

  .settings-permission-panel {
    padding: 14px;
  }

  .settings-permission-actions {
    grid-template-columns: auto auto 1fr;
    justify-content: end;
  }

  .settings-permission-actions .is-primary {
    grid-column: auto;
  }
}
/* === ADMIN USER PERMISSION SETTINGS: END === */
`;

  css = css.trimEnd() + '\n\n' + patch.trim() + '\n';

  writeIfChanged(CSS_FILE, css);

  const result = read(CSS_FILE);
  const checks = [
    'ADMIN USER PERMISSION SETTINGS: START',
    '.settings-permission-panel',
    '.settings-permission-row',
    '.settings-permission-actions',
  ];

  for (const needle of checks) {
    if (!result.includes(needle)) fail('Verifikasi CSS gagal: ' + needle);
  }
}

function main() {
  writePermissionUtil();
  patchAuthRepository();
  patchAdminPage();
  patchSettingsPage();
  patchRules();
  patchCss();

  console.log('\n✅ PHASE SETTINGS 1D selesai.');
  console.log('🛡️ Permission Settings per user sudah ditambahkan.');
  console.log('🔥 Permission tersimpan realtime ke Firestore users/{uid}.permissions.');
  console.log('🧭 Admin shell otomatis memfilter menu berdasarkan permission.');
  console.log('🔐 Firestore rules ikut dipagari berdasarkan permission halaman.');
}

main();