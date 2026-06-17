const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STAMP = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

const PERMISSION_UTIL_FILE = 'src/utils/adminPermissions.js';
const AUTH_REPOSITORY_FILE = 'src/services/adminAuthRepository.js';
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

function replaceRegexOnce(text, pattern, replacement, label) {
  if (!pattern.test(text)) fail('Pattern tidak ditemukan: ' + label);
  pattern.lastIndex = 0;
  return text.replace(pattern, replacement);
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
    if (index !== -1 && (start === -1 || index < start)) start = index;
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
  if (!user) return false;
  if (user.role === 'owner' || user.isOwner) return true;
  if (user.role) return false;

  return isOwnerEmail(user.email);
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

  if (!text.includes('role: isOwnerEmail ? \'owner\' : \'admin\',')) {
    text = replaceRegexOnce(
      text,
      /(\n\s*permissions:\s*defaultAdminPermissions,\n)(\s*status:\s*isOwnerEmail \? 'approved' : 'pending',)/,
      "$1            role: isOwnerEmail ? 'owner' : 'admin',\n$2",
      'new user role'
    );
  }

  if (!text.includes('const hasExplicitRole = Boolean(userData?.role);')) {
    text = replaceOnce(
      text,
      `          const userData = docSnap.exists() ? docSnap.data() : null;
          const isApproved = isOwnerEmail || (userData && userData.status === 'approved');`,
      `          const userData = docSnap.exists() ? docSnap.data() : null;
          const hasExplicitRole = Boolean(userData?.role);
          const isOwner = userData?.role === 'owner' || (!hasExplicitRole && isOwnerEmail);
          const isApproved = isOwner || (userData && userData.status === 'approved');`,
      'dynamic owner auth callback'
    );
  }

  if (!text.includes('role: userData?.role || (isOwner ? \'owner\' : \'admin\'),')) {
    text = replaceOnce(
      text,
      `              status: userData?.status || (isApproved ? 'approved' : 'pending'),
              permissions: normalizeAdminPermissions(userData?.permissions),
              isApproved`,
      `              status: userData?.status || (isApproved ? 'approved' : 'pending'),
              role: userData?.role || (isOwner ? 'owner' : 'admin'),
              isOwner,
              permissions: normalizeAdminPermissions(userData?.permissions),
              isApproved`,
      'auth user role payload'
    );
  }

  if (!text.includes('role: isOwnerEmail ? \'owner\' : \'admin\',\n                permissions: defaultAdminPermissions,')) {
    text = replaceRegexOnce(
      text,
      /(\n\s*status:\s*isOwnerEmail \? 'approved' : 'pending',\n)(\s*permissions:\s*defaultAdminPermissions,)/,
      "$1                role: isOwnerEmail ? 'owner' : 'admin',\n$2",
      'auth error fallback role'
    );
  }

  assertNoTopLevelOrphan(text, AUTH_REPOSITORY_FILE);
  writeIfChanged(AUTH_REPOSITORY_FILE, text);

  const result = read(AUTH_REPOSITORY_FILE);
  const checks = [
    "role: isOwnerEmail ? 'owner' : 'admin'",
    'const hasExplicitRole = Boolean(userData?.role);',
    'const isOwner = userData?.role === \'owner\' || (!hasExplicitRole && isOwnerEmail);',
    "role: userData?.role || (isOwner ? 'owner' : 'admin'),",
    'isOwner,',
  ];

  for (const needle of checks) {
    if (!result.includes(needle)) fail('Verifikasi adminAuthRepository gagal: ' + needle);
  }
}

function patchSettingsPage() {
  let text = read(SETTINGS_PAGE_FILE);

  if (!text.includes('Crown')) {
    text = replaceOnce(
      text,
      `import { Clipboard, Edit3, KeyRound, Mail, MonitorSmartphone, Phone, RefreshCcw, Save, ShieldCheck, SlidersHorizontal, Trash2, UserRound, X } from 'lucide-react';`,
      `import { Clipboard, Crown, Edit3, KeyRound, Mail, MonitorSmartphone, Phone, RefreshCcw, Save, ShieldCheck, SlidersHorizontal, Trash2, UserRound, X } from 'lucide-react';`,
      'Crown icon import'
    );
  }

  if (!text.includes('writeBatch')) {
    text = replaceOnce(
      text,
      `import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';`,
      `import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';`,
      'writeBatch import'
    );
  }

  if (!text.includes('isOwnerAdminUser')) {
    text = replaceOnce(
      text,
      `  defaultAdminPermissions,
  normalizeAdminPermissions,`,
      `  defaultAdminPermissions,
  isOwnerAdminUser,
  normalizeAdminPermissions,`,
      'isOwnerAdminUser import'
    );
  }

  text = replaceIfExists(
    text,
    `if (currentUser?.email?.toLowerCase() === 'marsicprod@gmail.com') {`,
    `if (isOwnerAdminUser(currentUser)) {`,
    'owner subpage check'
  );

  text = replaceIfExists(
    text,
    `if (activeSubpage !== 'approvals' || currentUser?.email?.toLowerCase() !== 'marsicprod@gmail.com') return;`,
    `if (activeSubpage !== 'approvals' || !isOwnerAdminUser(currentUser)) return;`,
    'approval subscribe owner check'
  );

  text = replaceIfExists(
    text,
    `          if (data.email?.toLowerCase() !== 'marsicprod@gmail.com') {
            list.push({ id: doc.id, ...data });
          }`,
    `          if (doc.id !== currentUser?.uid) {
            list.push({ id: doc.id, ...data });
          }`,
    'approval list excludes current owner'
  );

  if (!text.includes('async function transferOwnershipToUser(user)')) {
    text = insertAfterFunction(
      text,
      'savePermissionSettings',
      `  async function transferOwnershipToUser(user) {
    if (!user?.id) {
      setApprovalSettingsMessage('User tujuan belum dipilih.');
      return;
    }

    if (!currentUser?.uid) {
      setApprovalSettingsMessage('Owner aktif belum terbaca.');
      return;
    }

    if (user.id === currentUser.uid) {
      setApprovalSettingsMessage('Akun ini sudah menjadi owner aktif.');
      return;
    }

    const targetLabel = user.displayName || user.email || user.phoneNumber || 'user ini';
    const confirmed = window.confirm(
      'Transfer ownership ke ' + targetLabel + '?\\\\n\\\\nAkun owner saat ini akan berubah menjadi admin biasa.'
    );

    if (!confirmed) return;

    try {
      const now = new Date().toISOString();
      const batch = writeBatch(firestoreDb);

      batch.update(doc(firestoreDb, 'users', currentUser.uid), {
        role: 'admin',
        status: 'approved',
        permissions: defaultAdminPermissions,
        ownershipTransferredOutAt: now,
        updatedAt: now,
      });

      batch.update(doc(firestoreDb, 'users', user.id), {
        role: 'owner',
        status: 'approved',
        permissions: defaultAdminPermissions,
        ownershipTransferredInAt: now,
        updatedAt: now,
      });

      await batch.commit();

      setApprovalSettingsMessage('Ownership berhasil ditransfer ke ' + targetLabel + '.');
    } catch (err) {
      console.error('Gagal transfer ownership:', err);
      setApprovalSettingsMessage('Ownership belum berhasil ditransfer ke Firestore.');
    }
  }`
    );
  }

  if (!text.includes("user.role === 'owner' ? 'Owner'")) {
    text = replaceOnce(
      text,
      `{user.status !== 'approved' ? (`,
      `{user.role === 'owner' ? (
                      <span className="settings-owner-status-pill">
                        <Crown size={13} />
                        Owner
                      </span>
                    ) : user.status !== 'approved' ? (`,
      'owner status pill'
    );
  }

  if (!text.includes('transferOwnershipToUser(user)')) {
    text = replaceOnce(
      text,
      `                    <button
                      type="button"
                      onClick={() => openPermissionSettings(user)}`,
      `                    {user.role !== 'owner' ? (
                      <button
                        type="button"
                        onClick={() => transferOwnershipToUser(user)}
                        className="settings-mini-button settings-owner-transfer-button"
                        title="Transfer owner ke user ini"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 'auto' }}
                      >
                        <Crown size={13} />
                        Owner
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openPermissionSettings(user)}`,
      'transfer owner button'
    );
  }

  assertNoTopLevelOrphan(text, SETTINGS_PAGE_FILE);
  writeIfChanged(SETTINGS_PAGE_FILE, text);

  const result = read(SETTINGS_PAGE_FILE);
  const checks = [
    'Crown',
    'writeBatch',
    'isOwnerAdminUser',
    'async function transferOwnershipToUser(user)',
    'batch.update(doc(firestoreDb, \'users\', currentUser.uid)',
    "role: 'owner'",
    "role: 'admin'",
    'settings-owner-transfer-button',
    'settings-owner-status-pill',
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

    function getUserDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isBootstrapOwnerEmail() {
      return isSignedIn() &&
        request.auth.token.email != null &&
        request.auth.token.email.lower() == 'marsicprod@gmail.com';
    }

    function userHasExplicitRole() {
      return isSignedIn() && getUserDoc().keys().hasAny(['role']);
    }

    function isOwner() {
      return isSignedIn() && (
        getUserDoc().role == 'owner' ||
        (!userHasExplicitRole() && isBootstrapOwnerEmail())
      );
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
    'function isBootstrapOwnerEmail()',
    'function userHasExplicitRole()',
    "getUserDoc().role == 'owner'",
    '!userHasExplicitRole() && isBootstrapOwnerEmail()',
  ];

  for (const needle of checks) {
    if (!result.includes(needle)) fail('Verifikasi firestore.rules gagal: ' + needle);
  }
}

function patchCss() {
  let css = read(CSS_FILE);

  css = stripMarkerBlock(css, 'ADMIN OWNERSHIP TRANSFER');

  const patch = String.raw`
/* === ADMIN OWNERSHIP TRANSFER: START === */
.settings-owner-transfer-button {
  border-color: rgba(255, 196, 87, 0.34) !important;
  color: #ffd27a !important;
  background:
    linear-gradient(135deg, rgba(255, 196, 87, 0.12), rgba(255, 255, 255, 0.012)),
    var(--auth-bg-control) !important;
}

.settings-owner-transfer-button:hover {
  border-color: rgba(255, 196, 87, 0.62) !important;
}

.settings-owner-status-pill {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(255, 196, 87, 0.32);
  border-radius: 999px;
  padding: 0 10px;
  color: #ffd27a;
  background: rgba(255, 196, 87, 0.09);
  font-size: 0.68rem;
  font-weight: 680;
}

.settings-approval-actions {
  flex-wrap: wrap !important;
}

@media (max-width: 520px) {
  .settings-owner-transfer-button,
  .settings-owner-status-pill {
    flex: 1 1 auto;
    justify-content: center;
  }
}
/* === ADMIN OWNERSHIP TRANSFER: END === */
`;

  css = css.trimEnd() + '\n\n' + patch.trim() + '\n';

  writeIfChanged(CSS_FILE, css);

  const result = read(CSS_FILE);
  const checks = [
    'ADMIN OWNERSHIP TRANSFER: START',
    '.settings-owner-transfer-button',
    '.settings-owner-status-pill',
  ];

  for (const needle of checks) {
    if (!result.includes(needle)) fail('Verifikasi CSS gagal: ' + needle);
  }
}

function main() {
  writePermissionUtil();
  patchAuthRepository();
  patchSettingsPage();
  patchRules();
  patchCss();

  console.log('\n✅ PHASE SETTINGS 1E selesai.');
  console.log('👑 Ownership transfer sudah ditambahkan.');
  console.log('🔥 Transfer owner langsung update role di Firestore users/{uid}.');
  console.log('🛡️ Firestore rules sekarang pakai dynamic owner role, bukan email hardcoded saja.');
}

main();