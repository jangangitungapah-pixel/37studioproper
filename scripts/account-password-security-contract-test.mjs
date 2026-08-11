import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const authSource = readFileSync(
  resolve('src/services/adminAuthRepository.js'),
  'utf8'
);
const settingsSource = readFileSync(
  resolve('src/pages/admin/SettingsPage.jsx'),
  'utf8'
);
const cssSource = readFileSync(
  resolve('src/styles/modules/settings.css'),
  'utf8'
);
const packageJson = JSON.parse(
  readFileSync(resolve('package.json'), 'utf8')
);

for (const marker of [
  'EmailAuthProvider',
  'linkWithCredential',
  'reauthenticateWithCredential',
  'reauthenticateWithPopup',
  'updatePassword',
  'getFirebaseUserProviderIds',
  'providerIds',
  'getAdminPasswordErrorMessage',
  'changeAdminPassword',
]) {
  assert.equal(
    authSource.includes(marker),
    true,
    'Account password auth marker missing: ' + marker
  );
}

assert.match(
  authSource,
  /hasGoogleProvider[\s\S]*?reauthenticateWithPopup[\s\S]*?hasPasswordProvider[\s\S]*?updatePassword/,
  'Google-linked accounts must re-authenticate with Google before updating an existing password.'
);

assert.match(
  authSource,
  /EmailAuthProvider\.credential\([\s\S]*?cleanEmail[\s\S]*?cleanNewPassword[\s\S]*?linkWithCredential/,
  'Google-only accounts must link email/password credentials to the same Firebase user.'
);

assert.match(
  authSource,
  /hasPasswordProvider\s*&&\s*cleanCurrentPassword[\s\S]*?reauthenticateWithCredential[\s\S]*?updatePassword/,
  'Existing password credentials must support current-password re-authentication before updating.'
);

assert.match(
  authSource,
  /if\s*\(hasGoogleProvider\)[\s\S]*?reauthenticateWithPopup/,
  'Google-linked accounts must support Google re-authentication.'
);

for (const marker of [
  'getAccountProviderIds',
  'accountSecurityProviderIds',
  'accountHasGoogleProvider',
  'accountHasPasswordProvider',
  'accountNeedsCurrentPassword',
  'saveAccountPasswordPage',
  'account-password-current',
  'account-password-new',
  'account-password-confirm',
  'Verifikasi Google & Buat Password',
  'Verifikasi Google & Ganti',
  'Kirim Email Reset',
  'getAccountPasswordStrength',
  'accountPasswordStrength',
  'accountPasswordConfirmationMatches',
  'accountPasswordCanSubmit',
  'accountPasswordResetIsSending',
  'settings-password-checks',
]) {
  assert.equal(
    settingsSource.includes(marker),
    true,
    'Account password Settings marker missing: ' + marker
  );
}

assert.match(
  settingsSource,
  /accountHasPasswordProvider\s*\?[\s\S]*?account-password-current[\s\S]*?required=\{accountNeedsCurrentPassword\}/,
  'Current password must be shown for password-linked accounts and required only when Google fallback is unavailable.'
);

assert.equal(
  settingsSource.includes('onClick={sendPasswordResetPage}'),
  true,
  'Password reset email must remain available as a fallback.'
);

assert.equal(
  settingsSource.includes('disabled={!accountPasswordCanSubmit}'),
  true,
  'Password submit must remain disabled until required client-side checks pass.'
);

assert.match(
  settingsSource,
  /if \(accountPasswordResetIsSending\) return;[\s\S]*?setAccountPasswordResetIsSending\(true\)[\s\S]*?finally[\s\S]*?setAccountPasswordResetIsSending\(false\)/,
  'Password reset email must guard against duplicate sends.'
);

for (const marker of [
  'ACCOUNT PASSWORD SECURITY',
  '.settings-password-provider-note',
  '.settings-password-form-grid',
  '.settings-password-message.is-success',
  '.settings-password-message.is-error',
  '@media (max-width: 767px)',
  '@media (forced-colors: active)',
  'UI-12A — Mobile-First Account Control Center',
  '.settings-password-strength',
  '.settings-password-strength-track',
  '.settings-password-checks',
]) {
  assert.equal(
    cssSource.includes(marker),
    true,
    'Account password CSS marker missing: ' + marker
  );
}

assert.equal(
  /localStorage\.setItem\([^)]*currentPassword/.test(authSource),
  false,
  'Password security flow must never persist the current password to localStorage.'
);

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/account-password-security-contract-test.mjs'
  ),
  true,
  'Password security contract must be registered in npm test.'
);

console.log('account-password-security-contract-test: PASS');
