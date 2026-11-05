import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path) { return readFileSync(resolve(path), 'utf8'); }
const adminPage = read('src/pages/AdminPage.jsx');
const adminBottomNav = read('src/components/admin/AdminBottomNav.jsx');
const adminCss = read('src/styles/modules/admin-shell.css');
const clientPage = read('src/pages/ClientPortalPage.jsx');
const clientCss = read('src/styles/modules/client-portal-overhaul.css');
const guardPage = read('src/pages/guard/GuardAttendancePage.jsx');
const guardCss = read('src/styles/modules/guard-portal.css');
const landingPage = read('src/pages/ClientLandingPage.jsx');
const themePreferences = read('src/theme/themePreferences.js');

assert.match(adminPage, /className="admin-shell-skip-link" href="#admin-workspace-content"/);
assert.match(adminPage, /id="admin-workspace-content"\s+tabIndex=\{-1\}/);
assert.match(adminBottomNav, /matchMedia\(\s*'\(min-width: 900px\)'\s*\)/);
assert.match(adminBottomNav, /if \(desktopMedia\.matches\)\s*\{\s*setIsMoreMenuOpen\(false\)/);
assert.match(adminCss, /\.admin-shell-skip-link:focus-visible/);
assert.match(adminCss, /@media \(forced-colors: active\)/);

assert.match(clientPage, /className="client-portal-skip-link" href="#client-portal-main"/);
assert.match(clientPage, /id="client-portal-main"\s+tabIndex=\{-1\}/);
for (const tab of ['home', 'book', 'bookings', 'account']) {
  const marker = "aria-current={activeTab === '" + tab + "' ? 'page' : undefined}";
  assert.ok(clientPage.includes(marker), 'Client desktop nav current-page marker missing: ' + tab);
}
assert.match(clientPage, /<nav className="client-bottom-nav" aria-label="Navigasi client">/);
assert.match(clientCss, /\.client-portal-skip-link:focus-visible/);

assert.match(guardPage, /className="guard-portal-skip-link" href="#guard-portal-content"/);
assert.match(guardPage, /id="guard-portal-content"\s+tabIndex=\{-1\}/);
assert.match(guardPage, /aria-label="Buka Admin Portal"[\s\S]*?className="guard-portal-topbar-link"/);
const guardMobileBlock = guardCss.split('@media (max-width: 640px)')[1]?.split('@media')[0] || '';
assert.doesNotMatch(guardMobileBlock, /\.guard-portal-topbar-link\s*,/);
assert.match(guardCss, /\.guard-portal-skip-link:focus-visible/);

assert.match(landingPage, /id="client-landing-navigation"/);
assert.match(landingPage, /aria-controls="client-landing-navigation"/);
assert.ok(landingPage.includes('href="/book" className="client-landing-nav-link" onClick={() => setIsMenuOpen(false)}>Booking Slot</a>'));

for (const preference of ['DARK', 'LIGHT', 'SYSTEM']) {
  assert.ok(themePreferences.includes('  ' + preference + ':'));
}
assert.match(themePreferences, /getInitialThemePreference/);
const pkg = JSON.parse(read('package.json'));
assert.ok(pkg.scripts.test.includes('node scripts/global-shell-navigation-contract-test.mjs'));
console.log('global-shell-navigation-contract-test: PASS');
