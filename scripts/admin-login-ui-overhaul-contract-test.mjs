import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

function read(filePath) {
  return readFileSync(
    resolve(filePath),
    'utf8',
  );
}

const loginSource =
  read(
    'src/pages/LoginPage.jsx',
  );

const clientLoginSource =
  read(
    'src/pages/ClientLoginPage.jsx',
  );

const cssSource =
  read(
    'src/styles/modules/auth.css',
  );

const packageJson =
  JSON.parse(
    read(
      'package.json',
    ),
  );

/*
 * Spatial Gateway markup.
 */
for (const required of [
  'data-admin-login-layout="spatial-gateway"',
  'className="admin-login-shell"',
  'className="admin-login-visual"',
  'className="auth-card admin-login-form-panel"',
  'Admin Access Gateway',
  'Guard Access Gateway',
  'Satu pintu masuk untuk seluruh operasi studio.',
  'admin-login-capability-grid',
  'Role-based secure workspace',
  'admin-login-method-tabs',
  'admin-login-primary-action',
  'admin-login-google',
  'admin-login-form-footer',
  'aria-selected={activeTab === \'email\'}',
  'aria-selected={activeTab === \'phone\'}',
]) {
  assert.equal(
    loginSource.includes(
      required,
    ),
    true,
    'Admin Login Spatial Gateway marker missing: ' +
      required,
  );
}

/*
 * Existing auth/security behavior must remain present.
 */
for (const required of [
  "searchParams.get('portal') === 'guard'",
  "startsWith('/guard')",
  'adminAuthRepository.subscribeAdminAuth',
  'adminAuthRepository.signInAdmin',
  'adminAuthRepository.sendPhoneOTP',
  'adminAuthRepository.signInWithGoogle',
  'adminAuthRepository.ensureCurrentAdminAccess',
  'adminAuthRepository.signOutAdmin',
  'RecaptchaVerifier',
  'AccountRoleDecisionDialog',
  '!guardIntent && authMode',
  "? 'Guard Portal'",
  "? 'Masuk Guard Portal'",
  'PORTAL_ACCESS.WRONG_PORTAL_CLIENT',
]) {
  assert.equal(
    loginSource.includes(
      required,
    ),
    true,
    'Admin Login auth invariant missing after UI overhaul: ' +
      required,
  );
}

assert.equal(
  /setRoleDecision\(\{ access: err\.access, identity: err\.identity \}\)/.test(
    loginSource,
  ),
  true,
  'Wrong-portal role decision flow must remain wired.',
);

assert.equal(
  loginSource.includes(
    "role = 'studio_guard'"
  ),
  false,
  'Admin Login must never assign studio_guard role.',
);

/*
 * Admin-only CSS scope.
 */
for (const required of [
  '/* >>> ADMIN LOGIN SPATIAL GATEWAY START */',
  '.auth-page[data-auth-surface="login"].admin-login-page',
  '.admin-login-shell',
  '.admin-login-visual',
  '.admin-login-form-panel.auth-card',
  '.admin-login-capability-grid',
  '@media (max-width: 900px)',
  '@media (max-width: 520px)',
  '@media (prefers-reduced-motion: reduce)',
  '/* <<< ADMIN LOGIN SPATIAL GATEWAY END */',
]) {
  assert.equal(
    cssSource.includes(
      required,
    ),
    true,
    'Admin Login scoped CSS marker missing: ' +
      required,
  );
}

assert.equal(
  clientLoginSource.includes(
    'admin-login-'
  ),
  false,
  'Admin Login overhaul must not leak markup namespace into ClientLoginPage.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/admin-login-ui-overhaul-contract-test.mjs'
  ),
  true,
  'Admin Login UI overhaul contract must be registered in npm test.',
);

console.log(
  'admin-login-ui-overhaul-contract-test: PASS',
);
