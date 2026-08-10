import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(resolve('src/pages/admin/InventoryPage.jsx'), 'utf8');
const cssSource = readFileSync(resolve('src/styles/modules/inventory.css'), 'utf8');
const repositorySource = readFileSync(resolve('src/services/inventoryRepository.js'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

for (const required of [
  'data-inventory-ui="ui-9-spatial"',
  'InventoryEditorialHeader',
  'InventorySummary',
  'InventoryToolbar',
  'InventoryAttentionPanel',
  'InventoryMovementPanel',
  'InventoryLedgerState',
  'inventory-operations-grid',
  'inventory-ledger-header',
  'inventory-ledger-columns',
  'inventory-status-pill',
  'isItemsLoading',
  'itemsLoadError',
  'isMovementsLoading',
  'movementsLoadError',
  'Dialog.Root',
  'Dialog.Overlay',
  'Dialog.Content',
  'data-inventory-modal-ui="ui-9-spatial"',
  "{ key: 'lost', label: 'Hilang'",
  'Semua equipment terkontrol',
  'Tidak ada item di filter ini',
  'Inventory masih kosong',
]) {
  assert.equal(pageSource.includes(required), true, 'UI-9 page contract missing: ' + required);
}

for (const required of [
  'subscribeInventoryItems',
  'subscribeInventoryMovements',
  'createInventoryItem',
  'updateInventoryItem',
  'createInventoryMovement',
  "status: 'inactive'",
  "type: 'inactive'",
  "adjustment.mode === 'in'",
  'type: adjustment.mode',
  'previousQuantity',
  'nextQuantity',
  'buildInventoryCsv',
  'downloadInventoryCsv',
  'ADMIN_LIST_PAGE_SIZE',
  'getPaginationSlice',
  'filteredItems',
  'resetFilters',
]) {
  assert.equal(pageSource.includes(required), true, 'UI-9 preserved behavior missing: ' + required);
}

for (const forbidden of [
  'deleteInventoryItem(',
  'deleteDoc(',
  "collection(firestoreDb, 'inventoryItems')",
  "collection(firestoreDb, 'inventoryMovements')",
]) {
  assert.equal(
    pageSource.includes(forbidden),
    false,
    'UI-9 page must not bypass the repository or hard-delete inventory: ' + forbidden,
  );
}

for (const required of [
  "const INVENTORY_COLLECTION = 'inventoryItems'",
  "const INVENTORY_MOVEMENTS_COLLECTION = 'inventoryMovements'",
  'normalizeInventoryItem',
  'normalizeInventoryMovement',
  'name: cleanText(source.name',
  'category: cleanText(source.category',
  'type: cleanText(source.type',
  'quantity: toNumber(source.quantity)',
  'unit: cleanText(source.unit',
  'minStock: toNumber(source.minStock)',
  'condition: cleanText(source.condition',
  'status: cleanText(source.status',
  'location: cleanText(source.location)',
  'note: cleanText(source.note)',
  'previousQuantity: toNumber(source.previousQuantity)',
  'nextQuantity: toNumber(source.nextQuantity)',
  'subscribeInventoryItems',
  'subscribeInventoryMovements',
  'createInventoryItem',
  'updateInventoryItem',
  'createInventoryMovement',
  'deleteInventoryItem',
]) {
  assert.equal(repositorySource.includes(required), true, 'UI-9 repository contract missing: ' + required);
}

for (const required of [
  'UI-9 — Spatial Inventory Operations Workspace',
  ".inventory-page[data-inventory-ui='ui-9-spatial']",
  '.inventory-editorial-header',
  '.inventory-pulse',
  '.inventory-command-shelf',
  '.inventory-operations-grid',
  '.inventory-attention-panel',
  '.inventory-movement-panel',
  '.inventory-ledger-columns',
  '.inventory-item-row.is-low_stock',
  '.inventory-ledger-state.is-error',
  '.inventory-modal-backdrop',
  '.inventory-modal-panel',
  "html[data-admin-theme-active='true'][data-theme='dark']",
  '@media (max-width: 767px)',
  '@media (max-width: 520px)',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
]) {
  assert.equal(cssSource.includes(required), true, 'UI-9 CSS contract missing: ' + required);
}

for (const token of [
  '--studio-surface-1',
  '--studio-surface-2',
  '--studio-surface-floating',
  '--studio-text-primary',
  '--studio-text-secondary',
  '--studio-text-tertiary',
  '--studio-edge-soft',
  '--studio-edge-normal',
  '--studio-accent',
  '--studio-accent-soft',
  '--studio-shadow-contact',
  '--studio-shadow-surface',
  '--studio-shadow-floating',
  '--studio-success',
  '--studio-warning',
  '--studio-danger',
  '--studio-info',
]) {
  assert.equal(cssSource.includes(token), true, 'UI-9 semantic token missing: ' + token);
}

assert.equal(cssSource.includes('--auth-'), false, 'UI-9 CSS must not depend on legacy auth tokens.');
assert.equal(/#[0-9a-f]{3,8}\b/i.test(cssSource), false, 'UI-9 CSS must not add raw hex colors.');
assert.equal(
  packageJson.scripts.test.includes('admin-spatial-inventory-workspace-contract-test.mjs'),
  true,
  'UI-9 npm test registration missing.',
);

process.stdout.write('✅ Admin Spatial Inventory Workspace UI-9 contract passed.\n');
