import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(resolve('src/pages/admin/SettingsPage.jsx'), 'utf8');
const cssSource = readFileSync(resolve('src/styles/modules/settings.css'), 'utf8');
const customerCssSource = readFileSync(resolve('src/styles/modules/customer.css'), 'utf8');
const feePanelSource = readFileSync(resolve('src/components/settings/OperatorFeeSettingsPanel.jsx'), 'utf8');
const pricingSource = readFileSync(resolve('src/settings/pricingSettings.js'), 'utf8');
const studioSource = readFileSync(resolve('src/settings/studioSettings.js'), 'utf8');
const invoiceSource = readFileSync(resolve('src/settings/invoiceSettings.js'), 'utf8');
const feeSettingsSource = readFileSync(resolve('src/settings/operatorFeeSettings.js'), 'utf8');
const permissionSource = readFileSync(resolve('src/utils/adminPermissions.js'), 'utf8');
const accountSettingsSource = readFileSync(resolve('src/utils/accountSettings.js'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

for (const required of [
  'data-settings-ui="ui-12-spatial"',
  'settings-command-mobile',
  'settings-workspace-grid',
  'settings-navigation-panel',
  'settings-navigation-list',
  'settings-navigation-tab',
  'settings-navigation-safety',
  'settings-workspace-content',
  'settings-current-context',
  'getSettingsGroupLabel',
  "key: 'account'",
  "key: 'studio'",
  "key: 'pricing'",
  "key: 'invoice'",
  "key: 'fee-settings'",
  "key: 'user-settings'",
  "key: 'danger'",
  'data-account-settings-ui="ui-12a-control-center"',
  'settings-account-layout',
  'settings-account-overview',
  'settings-account-editor',
  'settings-account-health',
  'accountHealthPercent',
  'accountPendingChangeCount',
  'aria-labelledby="settings-current-page-title"',
  'id="settings-current-page-title"',
]) {
  assert.equal(pageSource.includes(required), true, 'UI-12 page contract missing: ' + required);
}

for (const required of [
  'savePricingSettings(settings)',
  'saveStudioSettings({',
  'saveInvoiceSettings({',
  'saveAccountSettingsPage',
  'adminAuthRepository.updateAdminProfile({',
  'buildPortalRoleTransitionPatch(',
  'normalizeAdminPermissionsForRole(',
  'writeBatch(firestoreDb)',
  'handleDangerZoneDeleteAllData',
  "const DANGER_ZONE_CONFIRM_TEXT = 'HAPUS DATA 37 STUDIO';",
  '<OperatorFeeSettingsPanel currentUser={currentUser} />',
  'resolveAccountPreferences(currentUser)',
  'savedAccountPreferences',
  'accountPreferencesIsDirty',
  'accountSettingsIsSaving',
  'accountProfileIsDirty',
  'accountProfileIsSaving',
  'defaultAccountPreferences',
]) {
  assert.equal(pageSource.includes(required), true, 'UI-12 preserved settings behavior missing: ' + required);
}

for (const required of [
  'saveOperatorFeeSettings(',
  'DEFAULT_OPERATOR_FEE_SETTINGS',
  'mealPerPersonPerDay',
  'Rules Fee Studio',
  'Crew Studio',
]) {
  assert.equal(feePanelSource.includes(required), true, 'UI-12 fee settings invariant missing: ' + required);
}

for (const [source, markers, label] of [
  [pricingSource, ['usePricingSettings', 'savePricingSettings', "doc(firestoreDb, 'settings', 'pricing')"], 'pricing'],
  [studioSource, ['useStudioSettings', 'saveStudioSettings', "doc(firestoreDb, 'settings', 'studio')"], 'studio'],
  [invoiceSource, ['useInvoiceSettings', 'saveInvoiceSettings', "doc(firestoreDb, 'settings', 'invoice')"], 'invoice'],
  [feeSettingsSource, ['useOperatorFeeSettings', 'saveOperatorFeeSettings'], 'operator fee'],
]) {
  for (const marker of markers) {
    assert.equal(source.includes(marker), true, 'UI-12 ' + label + ' settings source changed unexpectedly: ' + marker);
  }
}

for (const required of [
  'defaultAdminPermissions',
  'defaultGuardPortalPermissions',
  'normalizeAdminPermissionsForRole',
  'buildPortalRoleTransitionPatch',
]) {
  assert.equal(permissionSource.includes(required), true, 'UI-12 permission invariant missing: ' + required);
}

for (const required of [
  '/* UI-12 — Spatial Admin Settings Workspace */',
  ".settings-page[data-settings-ui='ui-12-spatial']",
  '.settings-editorial-header',
  '.settings-workspace-grid',
  '.settings-navigation-panel',
  '.settings-navigation-tab.is-active',
  '.settings-navigation-safety',
  '.settings-current-context',
  '.settings-owner-danger-zone',
  '.settings-invoice-actions-sticky',
  '@media (max-width: 767px)',
  '@media (max-width: 420px)',
  'prefers-reduced-motion: reduce',
  '@media (forced-colors: active)',
  '/* UI-12A — Mobile-First Account Control Center */',
  '/* UI-12A.1 — Compact Settings subpage context, shell owns the page title */',
  "[data-account-settings-ui='ui-12a-control-center']",
  '.settings-account-control-center',
  '.settings-account-layout',
  '.settings-account-health-track',
  '.settings-account-save-state.is-dirty',
  '.settings-security-check-grid',
  '.settings-prefs-summary-grid',
]) {
  assert.equal(cssSource.includes(required), true, 'UI-12 CSS contract missing: ' + required);
}

assert.equal(
  pageSource.includes('<header className="settings-editorial-header">'),
  false,
  'UI-12A.1 Settings must not render a second large page/subpage header beneath the Admin shell.',
);

assert.match(
  cssSource,
  />\s*\.settings-editorial-header\s*\{[\s\S]*?display:\s*none;/,
  'UI-12A.1 must defensively suppress the deprecated large subpage hero.',
);

assert.match(
  cssSource,
  /\.settings-workspace-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(228px,\s*0\.34fr\)\s*minmax\(0,\s*1fr\)/,
  'UI-12 desktop settings must use a navigation + workspace spatial composition.',
);

for (const typographyToken of [
  'font-size: 0.61rem;',
  'font-size: 0.74rem;',
  'font-weight: 500;',
]) {
  assert.equal(
    cssSource.includes(typographyToken),
    true,
    'UI-12A Settings typography missing Customer rhythm token: ' + typographyToken,
  );
  assert.equal(
    customerCssSource.replace(/\s+/g, ' ').includes(
      typographyToken.replace(/\s+/g, ' ')
    ),
    true,
    'UI-12A typography token must remain grounded in Customer CSS: ' + typographyToken,
  );
}

for (const [source, label] of [
  [cssSource, 'Settings'],
  [customerCssSource, 'Customer'],
]) {
  assert.match(
    source,
    /font-size:\s*clamp\(\s*1\.65rem,\s*3vw,\s*2\.35rem\s*\)/,
    'UI-12A ' + label + ' editorial title must share the 1.65–2.35rem scale.',
  );
}

assert.match(
  pageSource,
  /function resetAccountSettingsPage\(\)[\s\S]*?defaultAccountPreferences[\s\S]*?setAccountPreferences\(nextPreferences\)[\s\S]*?Tekan Simpan Preferensi/,
  'UI-12A reset must load a reversible draft before persistence.',
);

assert.match(
  accountSettingsSource,
  /readAccountPreferences\([\s\S]*?fallbackPreferences = defaultAccountPreferences[\s\S]*?normalizedFallback[\s\S]*?raw \? JSON\.parse\(raw\) : normalizedFallback/,
  'UI-12A account preferences must use local state first and cloud preferences as a normalized fallback.',
);

assert.match(
  pageSource,
  /disabled=\{!accountPreferencesIsDirty \|\| accountSettingsIsSaving\}/,
  'UI-12A preference save must expose dirty and saving state.',
);

assert.match(
  cssSource,
  /@media \(max-width: 767px\)[\s\S]*?\.settings-account-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
  'UI-12A account editor must collapse to one mobile-first column.',
);

assert.match(
  cssSource,
  /html\s*\[?\s*data-admin-theme-active='true'\s*\]?\s*\[?\s*data-theme='dark'\s*\]?[\s\S]*?\.settings-page\s*\[\s*data-settings-ui='ui-12-spatial'\s*\]/,
  'UI-12 must intentionally adapt the settings workspace for dark theme.',
);

assert.match(
  cssSource,
  /@media\s*\(max-width:\s*767px\)[\s\S]*?\.settings-navigation-panel\s*\{[\s\S]*?display:\s*none;/,
  'UI-12 mobile must replace the desktop settings map with the compact command selector.',
);

assert.match(
  cssSource,
  /\.settings-owner-danger-zone\s*\{[\s\S]*?--settings-danger|\.settings-owner-danger-zone\s*\{[\s\S]*?color-mix\(in srgb,\s*var\(--settings-danger\)/,
  'UI-12 danger zone must remain visually isolated.',
);

assert.equal(
  packageJson.scripts.test.includes('node scripts/admin-spatial-settings-workspace-contract-test.mjs'),
  true,
  'UI-12 contract must be registered in npm test.',
);

console.log('admin-spatial-settings-workspace-contract-test: PASS');
