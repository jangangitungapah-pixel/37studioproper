import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path) {
  return readFileSync(resolve(path), 'utf8');
}

const adminLogin = read('src/pages/LoginPage.jsx');
const clientLogin = read('src/pages/ClientLoginPage.jsx');
const publicBooking = read('src/pages/PublicBookingPage.jsx');
const landing = read('src/pages/ClientLandingPage.jsx');
const adminCss = read('src/styles/modules/auth.css');
const clientCss = read('src/styles/client-auth.css');
const publicCss = read('src/styles/public-booking.css');
const landingCss = read('src/styles/client-landing.css');
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  'adminAuthRepository.subscribeAdminAuth',
  'adminAuthRepository.signInAdmin',
  'adminAuthRepository.signInWithGoogle',
  'adminAuthRepository.handleRedirectResult',
  'sanitizePortalRedirect',
  'PORTAL_ACCESS.WRONG_PORTAL_CLIENT',
  'data-auth-network-state="offline"',
  'aria-busy={isSubmitting}',
]) {
  assert.ok(adminLogin.includes(marker), 'Admin / Guard login marker missing: ' + marker);
}

for (const marker of [
  "accountRoleRepository.resolvePortalAccount(user, 'client')",
  'getSafeClientNextPath(location.search)',
  'accountRoleRepository.cancelAdminRequestAndBecomeClient',
  'signInWithEmailAndPassword',
  'signInWithPopup',
  'AccountRoleDecisionDialog',
  'data-auth-network-state="offline"',
  'aria-busy={isSubmitting}',
]) {
  assert.ok(clientLogin.includes(marker), 'Client login role / UX marker missing: ' + marker);
}

for (const marker of [
  'subscribeClientCalendarSlots(',
  'isBookingStartOccupied(slots, selectedDate, startHour)',
  'isPastSlot(selectedDate, startHour)',
  'buildClientBookingResumePath({',
  "navigate('/client/login?next=' + encodeURIComponent(resumePath))",
  "isOnline ? 'Jadwal realtime' : 'Perangkat offline'",
  'public-booking-offline-notice',
]) {
  assert.ok(publicBooking.includes(marker), 'Public booking availability / offline marker missing: ' + marker);
}

for (const marker of [
  "params.set('date', date);",
  "params.set('startHour', startHour);",
  "navigate('/book?' + params.toString());",
  'Tanggal dan jam diteruskan ke kalender publik.',
  'Layanan dan durasi dipilih setelah masuk ke akun client.',
]) {
  assert.ok(landing.includes(marker), 'Landing booking handoff marker missing: ' + marker);
}

assert.ok(adminCss.includes('Admin Login inherits Light / Dark / System tokens'), 'Admin login must inherit active theme tokens.');
assert.ok(clientCss.includes('Reuse global semantic tokens so Light / Dark / System stay consistent.'), 'Client login must inherit active theme tokens.');
assert.doesNotMatch(clientCss, /color-scheme:\s*light|--studio-(?:bg-page|surface-1|text-strong|text-main|text-muted|accent):\s*#[\da-f]{3,8}/i, 'Client login must not pin the app to a light-only palette.');
assert.ok(clientCss.includes('.client-auth-alert.is-warning'), 'Client login offline state needs a semantic warning treatment.');
assert.ok(landingCss.includes('.client-landing-planner-note'), 'Landing must visually explain exactly which planner values are handed off.');
assert.ok(publicCss.includes('.public-booking-live.is-offline'), 'Public calendar live indicator must switch when offline.');
assert.ok(publicCss.includes('.public-booking-offline-notice'), 'Public booking must disclose when displayed availability may be stale.');
assert.ok(publicCss.includes('@media (max-width: 620px)'), 'Public booking mobile layout must remain scoped.');
assert.ok(publicCss.includes('@media (prefers-reduced-motion: reduce)'), 'Public booking must preserve reduced-motion support.');
assert.ok(clientCss.includes('@media (max-width:520px)'), 'Client login mobile layout must remain scoped.');
assert.ok(clientCss.includes('@media (prefers-reduced-motion:reduce)'), 'Client login must preserve reduced-motion support.');
assert.ok(packageJson.scripts.test.includes('node scripts/phase-3-auth-public-experience-contract-test.mjs'), 'Phase 3 contract must be part of npm test.');

process.stdout.write('phase-3-auth-public-experience-contract-test: PASS\n');
