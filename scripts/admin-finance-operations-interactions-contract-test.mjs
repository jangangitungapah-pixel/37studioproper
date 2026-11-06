import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const cases = [
  {
    path: 'src/styles/modules/billing.css',
    active: ['.billing-row-actions button:active:not(:disabled)', '.billing-proof-modal-actions button:active:not(:disabled)', '.billing-row:focus-within'],
    reduced: ['@media (prefers-reduced-motion: reduce)', '.billing-row-actions button:active', 'transform: none;'],
  },
  {
    path: 'src/styles/modules/bookkeeping.css',
    active: ['.bookkeeping-ledger-actions button:active:not(:disabled)', '.bookkeeping-command-actions button:active:not(:disabled)', '.bookkeeping-ledger-row:focus-within'],
    reduced: ['@media (prefers-reduced-motion: reduce)', '.bookkeeping-ledger-actions button:active', 'transform: none;'],
  },
  {
    path: 'src/styles/modules/operator-fee.css',
    active: [".operator-fee-queue[data-operator-fee-ui='ui-8-spatial'] .operator-fee-row-btn:active:not(:disabled)", '.operator-fee-bulk-buttons button:active:not(:disabled)', '.operator-fee-meal-row > button:active:not(:disabled)'],
    reduced: ['@media (prefers-reduced-motion: reduce)', '.operator-fee-bulk-buttons button:active', 'transform: none;'],
  },
  {
    path: 'src/styles/modules/inventory.css',
    active: [".inventory-page[data-inventory-ui='ui-9-spatial'] .inventory-adjust-btn:active:not(:disabled)", '.inventory-page .procurement-button:active:not(:disabled)', '.inventory-page .maintenance-primary-button:active:not(:disabled)'],
    reduced: ['@media (prefers-reduced-motion: reduce)', '.inventory-page button:active', 'transform: none;'],
  },
  {
    path: 'src/styles/modules/guard-attendance.css',
    active: ['.guard-review-row:focus-within', '.guard-review-row-actions button:active:not(:disabled)', '.guard-review-attention-modal button:active:not(:disabled)'],
    reduced: ['@media (prefers-reduced-motion: reduce)', '.guard-review-row-actions button:active', 'transform: none;'],
  },
  {
    path: 'src/styles/modules/guard-portal.css',
    active: ['.guard-portal-primary-action:active:not(:disabled)', '.guard-portal-danger-action:active:not(:disabled)', '.guard-portal-icon-button:active:not(:disabled)'],
    reduced: ['@media (prefers-reduced-motion: reduce)', '.guard-portal-primary-action:active', 'transform: none;'],
  },
];
for (const testCase of cases) {
  const css = read(testCase.path);
  for (const marker of testCase.active) assert.ok(css.includes(marker), `${testCase.path}: missing interaction state ${marker}`);
  for (const marker of testCase.reduced) assert.ok(css.includes(marker), `${testCase.path}: reduced-motion contract missing ${marker}`);
  assert.ok(css.includes('var(--studio-duration-fast)'), `${testCase.path}: shared motion tokens must be used`);
}
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.ok(packageJson.scripts.test.includes('admin-finance-operations-interactions-contract-test.mjs'));
console.log('✅ Admin Finance & Operations interaction contract passed.');
