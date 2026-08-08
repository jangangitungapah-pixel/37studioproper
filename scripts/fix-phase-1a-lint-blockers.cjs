const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const TEST_FILE = path.join(
  ROOT,
  'scripts',
  'booking-lifecycle-regression-test.mjs',
);

const SETTINGS_FILE = path.join(
  ROOT,
  'src',
  'pages',
  'admin',
  'SettingsPage.jsx',
);

const GUARD_FILE = path.join(
  ROOT,
  'src',
  'pages',
  'guard',
  'GuardAttendancePage.jsx',
);

function fail(message) {
  console.error(`[fix-phase-1a] ${message}`);
  process.exit(1);
}

function editFile(filePath, editor) {
  if (!fs.existsSync(filePath)) {
    fail(`File tidak ditemukan: ${path.relative(ROOT, filePath)}`);
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const normalized = original.replace(/\r\n/g, '\n');

  const nextNormalized = editor(normalized);

  if (typeof nextNormalized !== 'string') {
    fail(`Editor tidak menghasilkan string: ${path.relative(ROOT, filePath)}`);
  }

  if (nextNormalized === normalized) {
    console.log(
      `[fix-phase-1a] No change: ${path.relative(ROOT, filePath)}`,
    );
    return;
  }

  const output =
    eol === '\r\n'
      ? nextNormalized.replace(/\n/g, '\r\n')
      : nextNormalized;

  fs.writeFileSync(filePath, output, 'utf8');

  console.log(
    `[fix-phase-1a] Updated: ${path.relative(ROOT, filePath)}`,
  );
}

/**
 * FIX 1
 * Regression test dijalankan Node secara langsung.
 * ESLint config project tidak mendefinisikan global console untuk file ini,
 * jadi gunakan process.stdout.write.
 */
editFile(TEST_FILE, (content) => {
  const oldLine =
    "console.log('✅ Booking lifecycle regression test passed.');";

  const newLine =
    "process.stdout.write('✅ Booking lifecycle regression test passed.\\n');";

  if (content.includes(newLine)) {
    return content;
  }

  if (!content.includes(oldLine)) {
    fail(
      'Tidak menemukan console.log regression test yang diharapkan.',
    );
  }

  return content.replace(oldLine, newLine);
});

/**
 * FIX 2
 * SettingsPage memakai defaultGuardPortalPermissions di grantAllPermissions(),
 * tetapi symbol tersebut belum di-import.
 */
editFile(SETTINGS_FILE, (content) => {
  if (
    content.includes(
      'defaultGuardPortalPermissions,',
    )
  ) {
    return content;
  }

  const oldImport = [
    'import {',
    '  countEnabledAdminPermissions,',
    '  defaultAdminPermissions,',
    '  getAssignablePermissionPages,',
    '  isOwnerAdminUser,',
    '  normalizeAdminPermissionsForRole,',
    "} from '../../utils/adminPermissions.js';",
  ].join('\n');

  const newImport = [
    'import {',
    '  countEnabledAdminPermissions,',
    '  defaultAdminPermissions,',
    '  defaultGuardPortalPermissions,',
    '  getAssignablePermissionPages,',
    '  isOwnerAdminUser,',
    '  normalizeAdminPermissionsForRole,',
    "} from '../../utils/adminPermissions.js';",
  ].join('\n');

  if (!content.includes(oldImport)) {
    fail(
      'Import adminPermissions di SettingsPage tidak cocok dengan baseline yang diaudit.',
    );
  }

  return content.replace(oldImport, newImport);
});

/**
 * FIX 3
 * Hindari setState sinkron di body useEffect.
 *
 * Timer pertama dijadwalkan melalui setTimeout(0), kemudian diperbarui
 * setiap satu detik. Saat currentSession hilang, UI active-shift juga tidak
 * dirender sehingga tidak perlu reset state sinkron ke 00:00:00.
 */
editFile(GUARD_FILE, (content) => {
  const oldEffect = [
    '  useEffect(() => {',
    '    if (!currentSession?.clockInAt) {',
    "      setElapsedTime('00:00:00');",
    '      return () => {};',
    '    }',
    '',
    '    const calculateElapsed = () => {',
    '      const start = new Date(currentSession.clockInAt).getTime();',
    '      const now = Date.now();',
    '      const diff = Math.max(0, now - start);',
    '',
    '      const hours = Math.floor(diff / 3600000);',
    '      const minutes = Math.floor((diff % 3600000) / 60000);',
    '      const seconds = Math.floor((diff % 60000) / 1000);',
    '',
    "      const pad = (num) => String(num).padStart(2, '0');",
    '      setElapsedTime(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);',
    '    };',
    '',
    '    calculateElapsed();',
    '    const interval = setInterval(calculateElapsed, 1000);',
    '',
    '    return () => clearInterval(interval);',
    '  }, [currentSession?.clockInAt]);',
  ].join('\n');

  const newEffect = [
    '  useEffect(() => {',
    '    if (!currentSession?.clockInAt) {',
    '      return undefined;',
    '    }',
    '',
    '    const calculateElapsed = () => {',
    '      const start = new Date(currentSession.clockInAt).getTime();',
    '      const now = Date.now();',
    '      const diff = Math.max(0, now - start);',
    '',
    '      const hours = Math.floor(diff / 3600000);',
    '      const minutes = Math.floor((diff % 3600000) / 60000);',
    '      const seconds = Math.floor((diff % 60000) / 1000);',
    '',
    "      const pad = (num) => String(num).padStart(2, '0');",
    '      setElapsedTime(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);',
    '    };',
    '',
    '    const initialTickId = window.setTimeout(calculateElapsed, 0);',
    '    const intervalId = window.setInterval(calculateElapsed, 1000);',
    '',
    '    return () => {',
    '      window.clearTimeout(initialTickId);',
    '      window.clearInterval(intervalId);',
    '    };',
    '  }, [currentSession?.clockInAt]);',
  ].join('\n');

  if (content.includes(newEffect)) {
    return content;
  }

  if (!content.includes(oldEffect)) {
    fail(
      'Effect elapsed-time GuardAttendancePage tidak cocok dengan baseline yang diaudit.',
    );
  }

  return content.replace(oldEffect, newEffect);
});

console.log('');
console.log('✅ Phase 1A lint blockers fixed.');
console.log('   - regression test console lint fixed');
console.log('   - Settings guard permission import restored');
console.log('   - Guard timer effect made React lint-safe');