import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const tokens = read('src/index.css');
const baseTokens = read('src/styles/modules/base.css');
const shared = read('src/styles/modules/shared.css');
const booking = read('src/styles/modules/booking.css');
const auth = read('src/styles/modules/auth.css');
const wizard = read('src/styles/modules/client-booking-wizard.css');
const guard = read('src/styles/modules/guard-attendance.css');
const app = read('src/App.jsx');
const themeProvider = read('src/theme/ThemeProvider.jsx');
const themeContext = read('src/theme/ThemePreferenceContext.jsx');
const publicThemeScope = read('src/theme/ThemePreferenceScope.jsx');
const browserSmoke = read('scripts/browser-responsive-smoke.mjs');

function luminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function mixHex(foreground, background, alpha) {
  const fg = [0, 2, 4].map((offset) => Number.parseInt(foreground.slice(offset + 1, offset + 3), 16));
  const bg = [0, 2, 4].map((offset) => Number.parseInt(background.slice(offset + 1, offset + 3), 16));
  const mixed = fg.map((value, index) => Math.round((value * alpha) + (bg[index] * (1 - alpha))));
  return '#' + mixed.map((value) => value.toString(16).padStart(2, '0')).join('');
}

function token(block, name) {
  const match = block.match(new RegExp(name + ':\\s*(#[0-9a-f]{6})', 'i'));
  assert.ok(match, 'Missing hex token ' + name);
  return match[1];
}

const rootStart = tokens.indexOf(':root {');
assert.ok(rootStart >= 0, 'Dark default theme token block must exist');
const rootEnd = tokens.indexOf('\\n}\\n\\n[data-theme=', rootStart);
assert.ok(rootEnd > rootStart, 'Dark default theme token block must be bounded');
const dark = tokens.slice(rootStart, rootEnd);

const lightStart = tokens.indexOf("[data-theme='light']");
assert.ok(lightStart >= 0, 'Light theme token block must exist');
const lightEnd = tokens.indexOf('\n}\n*', lightStart);
assert.ok(lightEnd > lightStart, 'Light theme token block must be bounded');
const light = tokens.slice(lightStart, lightEnd);

const darkTextSubtle = token(dark, '--studio-text-subtle');
const darkAccent = token(dark, '--studio-accent');
const darkAccentStrong = token(dark, '--studio-accent-strong');
const darkWarning = token(dark, '--studio-warning');
const darkInverseText = token(dark, '--studio-text-inverse');
const darkPage = token(dark, '--studio-bg-page');
const darkSurface1 = token(dark, '--studio-surface-1');
const darkSurface2 = token(dark, '--studio-surface-2');
const darkSurface3 = token(dark, '--studio-surface-3');
const darkAccentSoftBackground = mixHex(darkAccent, darkSurface2, 0.13);
const darkWarningSoftBackground = mixHex(darkWarning, darkSurface2, 0.16);
const darkInputBackground = mixHex(darkSurface1, darkSurface2, 0.86);

const lightAccentText = token(light, '--studio-accent-text');
const lightTextSubtle = token(light, '--studio-text-subtle');
const lightAccentStrong = token(light, '--studio-accent-strong');
const lightWarning = token(light, '--studio-warning');
const lightWarningSoft = token(light, '--studio-warning-soft');
const lightInverseText = token(light, '--studio-text-inverse');
const lightSurface2 = token(light, '--studio-surface-2');
const lightPage = token(light, '--studio-bg-page');
const lightAccent = token(light, '--studio-accent');
const accentSoftBackground = mixHex(lightAccent, lightSurface2, 0.13);
const lightSurface1 = token(light, '--studio-surface-1');
const lightSurface3 = token(light, '--studio-surface-3');
const lightShell = token(light, '--studio-bg-shell');
const lightInputBackground = mixHex(lightSurface1, lightSurface2, 0.86);


assert.ok(
  contrastRatio(lightAccentText, accentSoftBackground) >= 4.5,
  'Light booking price-note accent text must meet WCAG AA on accent-soft surface',
);
assert.ok(
  contrastRatio(lightWarning, lightWarningSoft) >= 4.5,
  'Light pending warning text must meet WCAG AA on warning-soft surface',
);
assert.ok(
  contrastRatio(lightInverseText, lightAccentStrong) >= 4.5,
  'Light primary button label must meet WCAG AA on accent-strong fill',
);
assert.ok(
  contrastRatio(lightTextSubtle, lightPage) >= 4.5,
  'Light subtle text must meet WCAG AA on page background',
);
assert.ok(
  contrastRatio(lightTextSubtle, lightSurface2) >= 4.5,
  'Light subtle text must meet WCAG AA on secondary surface',
);

assert.ok(
  contrastRatio(lightTextSubtle, lightSurface3) >= 4.5,
  'Light subtle text must meet WCAG AA on tertiary surface',
);
assert.ok(
  contrastRatio(lightTextSubtle, lightShell) >= 4.5,
  'Light subtle text must meet WCAG AA on shell background',
);
assert.ok(
  contrastRatio(lightTextSubtle, lightInputBackground) >= 4.5,
  'Light client auth input placeholder must meet WCAG AA on its blended control surface',
);
assert.ok(
  contrastRatio(darkAccent, darkAccentSoftBackground) >= 4.5,
  'Dark booking price-note accent text must meet WCAG AA on accent-soft surface',
);
assert.ok(
  contrastRatio(darkWarning, darkWarningSoftBackground) >= 4.5,
  'Dark pending warning text must meet WCAG AA on warning-soft surface',
);
assert.ok(
  contrastRatio(darkInverseText, darkAccentStrong) >= 4.5,
  'Dark primary button label must meet WCAG AA on accent-strong fill',
);
for (const [name, background] of [
  ['page', darkPage],
  ['primary surface', darkSurface1],
  ['secondary surface', darkSurface2],
  ['tertiary surface', darkSurface3],
  ['client auth input', darkInputBackground],
]) {
  assert.ok(
    contrastRatio(darkTextSubtle, background) >= 4.5,
    'Dark subtle text must meet WCAG AA on ' + name,
  );
}
assert.match(baseTokens, /--auth-text-subtle:\s*var\(--studio-text-subtle\)/);

assert.match(booking, /\.booking-price-note\s*\{[^}]*color:\s*var\(--studio-accent-text\)/s);
assert.match(booking, /\.booking-detail-compact-status\.is-pending strong\s*\{[^}]*color:\s*var\(--studio-warning\)/s);
assert.match(shared, /\[data-theme='light'\]\s+\.studio-button\.is-primary\s*\{/);
assert.match(auth, /\[data-theme='light'\]\s+\.auth-submit\s*\{/);

assert.match(
  wizard,
  /\.client-booking-wizard :where\(input, select, textarea, button\):focus-visible\s*\{[^}]*outline:\s*var\(--studio-focus-outline\)/s,
  'Client booking wizard controls must expose a keyboard-visible focus ring',
);
assert.match(
  guard,
  /\.guard-review-priority-link:focus-visible,[\s\S]*?outline:\s*var\(--studio-focus-outline\)/,
  'Admin Guard Attendance actions must expose keyboard-visible focus rings',
);
assert.match(
  auth,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.auth-spin\s*\{[^}]*animation:\s*none/s,
  'Authentication loading spinners must respect reduced motion',
);
assert.match(
  guard,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.pulse-dot,[\s\S]*?animation:\s*none !important/s,
  'Guard status pulses must respect reduced motion',
);
assert.match(
  guard,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.guard-attendance-approval-modal/,
  'Guard approval dialogs must be included in reduced-motion coverage',
);

assert.equal(app.includes('ThemeProvider'), false, 'Admin ThemeProvider must remain outside the root App.');
assert.match(app, /import ThemePreferenceScope from '\.\/theme\/ThemePreferenceScope\.jsx'/);
assert.match(app, /path="\/" element=\{<ThemePreferenceScope><ClientLandingPage \/><\/ThemePreferenceScope>\}/);
assert.match(app, /path="\/book" element=\{<ThemePreferenceScope><PublicBookingPage \/><\/ThemePreferenceScope>\}/);
assert.match(app, /path="\/client" element=\{<ThemePreferenceScope><ClientLandingPage \/><\/ThemePreferenceScope>\}/);
assert.match(themeProvider, /<ThemePreferenceContextProvider adminThemeActive>/);
assert.match(themeContext, /if \(adminThemeActive\)\s*\{\s*root\.dataset\.adminThemeActive = 'true';/);
assert.match(publicThemeScope, /<ThemePreferenceContextProvider>/);
for (const width of [360, 390, 430, 768, 900, 1024, 1280, 1440, 1920]) {
  assert.match(browserSmoke, new RegExp('width: ' + width + '\\b'), 'Responsive matrix missing ' + width + 'px');
}
for (const preference of ["name: 'light'", "name: 'dark'", "name: 'system'"]) {
  assert.ok(browserSmoke.includes(preference), 'Theme matrix missing ' + preference);
}
assert.match(browserSmoke, /page\.on\('console'/, 'Browser smoke must inspect console errors');
assert.match(browserSmoke, /page\.on\('requestfailed'/, 'Browser smoke must inspect failed requests');
assert.match(browserSmoke, /System theme follows OS Light\/Dark changes PASS/);

console.log('phase-9-accessibility-contract-test: PASS');
