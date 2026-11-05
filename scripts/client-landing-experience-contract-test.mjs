import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path) {
  return readFileSync(resolve(path), 'utf8');
}

const landing = read('src/pages/ClientLandingPage.jsx');
const landingCss = read('src/styles/client-landing.css');
const sharedCss = read('src/styles/modules/shared.css');
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  "from 'motion/react'",
  "from '../components/magicui/number-ticker.jsx'",
  'useReducedMotion()',
  'useScroll()',
  'AnimatePresence',
  'function handleServiceShortcut(sessionKey)',
  "if (mode === 'package' && !hasPackages) return;",
  'setUserBookings([]);',
  'bookingSelectionError',
  'client-landing-mobile-cta',
  'client-landing-handoff-preview',
]) {
  assert.ok(landing.includes(marker), 'Landing interaction marker missing: ' + marker);
}

for (const marker of [
  "params.set('date', date);",
  "params.set('startHour', startHour);",
  "navigate('/book?' + params.toString());",
  'Tanggal dan jam diteruskan ke kalender publik.',
  'Layanan dan durasi dipilih setelah masuk ke akun client.',
]) {
  assert.ok(landing.includes(marker), 'Public booking handoff contract missing: ' + marker);
}

assert.ok(landingCss.includes('.client-landing-scroll-progress'), 'Landing scroll feedback is missing.');
assert.ok(landingCss.includes('.client-landing-handoff-preview'), 'Planner handoff preview is missing.');
assert.ok(landingCss.includes('.client-landing-selection-error'), 'Planner validation feedback is missing.');
assert.ok(landingCss.includes('.client-landing-mobile-cta'), 'Mobile planner action is missing.');
assert.ok(landingCss.includes('@media (prefers-reduced-motion: reduce)'), 'Landing reduced-motion support is missing.');
assert.ok(sharedCss.includes('@keyframes studio-select-pop'), 'StudioSelect open animation is missing.');
assert.ok(sharedCss.includes('@media (prefers-reduced-motion: reduce)'), 'StudioSelect reduced-motion support is missing.');
assert.ok(packageJson.scripts.test.includes('node scripts/client-landing-experience-contract-test.mjs'), 'Landing UX contract must run in npm test.');

process.stdout.write('client-landing-experience-contract-test: PASS\\n');
