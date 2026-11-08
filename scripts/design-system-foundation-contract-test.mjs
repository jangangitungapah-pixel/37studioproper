import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const tokens = read('src/index.css');
const shared = read('src/styles/modules/shared.css');
const modal = read('src/styles/modules/modal.css');
const packageJson = JSON.parse(read('package.json'));

for (const token of [
  '--studio-font-size-2xs:', '--studio-font-size-xs:', '--studio-font-size-sm:',
  '--studio-font-weight-semibold:', '--studio-leading-normal:', '--studio-tracking-tight:',
  '--studio-space-1:', '--studio-space-12:', '--studio-control-height-sm:',
  '--studio-control-height-md:', '--studio-control-height-lg:', '--studio-control-size-icon:',
  '--studio-control-radius:', '--studio-card-radius:', '--studio-dialog-radius:',
  '--studio-content-width:', '--studio-sidebar-width-expanded:',
  '--studio-focus-outline:', '--studio-focus-shadow:', '--studio-motion-fast:',
  '--studio-motion-normal:', '--studio-ease-standard:', '--studio-shadow-card-subtle:',
  '--studio-overlay-backdrop:', '--studio-chart-1:', '--studio-chart-6:',
]) {
  assert.equal(tokens.includes(token), true, 'Missing design token: ' + token);
}

const lightTheme = tokens.slice(tokens.indexOf("[data-theme='light']"));
for (const token of ['--studio-focus-shadow:', '--studio-shadow-card-subtle:', '--studio-chart-1:']) {
  assert.equal(lightTheme.includes(token), true, 'Light theme override missing: ' + token);
}
assert.match(tokens, /@import\s+["']tailwindcss["']/);

for (const token of [
  'var(--studio-control-height-lg)', 'var(--studio-control-radius)',
  'var(--studio-font-size-sm)', 'var(--studio-focus-shadow)',
  'var(--studio-card-radius)', 'var(--studio-shadow-card-subtle)',
  'var(--studio-motion-fast)', '.studio-menu-popup', '.studio-data-table',
  '.studio-chart', '.magicui-number-ticker', '.studio-toast',
]) {
  assert.equal(shared.includes(token), true, 'Shared primitives must consume/style ' + token);
}
assert.equal(modal.includes('var(--studio-dialog-radius)'), true);
assert.equal(modal.includes('var(--studio-overlay-backdrop)'), true);
assert.equal(modal.includes('var(--studio-motion-normal)'), true);
assert.equal(packageJson.scripts.test.includes('design-system-foundation-contract-test.mjs'), true);

console.log('design-system-foundation-contract-test: PASS');
