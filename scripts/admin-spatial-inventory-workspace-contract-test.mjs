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
  'adjustCanonicalInventory({',
  'adjustingItemIdsRef',
  'Alasan adjustment wajib diisi minimal 4 karakter.',
  "quantity: editingItem?.quantity ?? nextItem.quantity",
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
  'actorName: cleanText(source.actorName)',
  'reason: cleanText(source.reason || source.note)',
  'await updateDoc(docRef',
]) {
  assert.equal(repositorySource.includes(required), true, 'UI-9 repository contract missing: ' + required);
}

for (const forbidden of [
  'deleteDoc(',
  'deleteInventoryItem',
  'quantity: cleanItem.quantity',
]) {
  assert.equal(
    repositorySource.includes(forbidden),
    false,
    'UI-9 repository must not directly delete inventory or mutate stock metadata: ' + forbidden,
  );
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

assert.match(
  cssSource,
  /\.inventory-editorial-header\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;/,
  'UI-9 desktop editorial header must share one vertical axis.',
);
assert.match(
  cssSource,
  /\.inventory-command-shelf\s*\{[\s\S]*?minmax\(144px, auto\)/,
  'UI-9 command shelf must reserve stable room for result context.',
);
assert.match(
  cssSource,
  /\.inventory-filter-context\s*>\s*span\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*baseline;[\s\S]*?gap:\s*4px;/,
  'UI-9 result count must remain on one aligned baseline.',
);
assert.match(
  cssSource,
  /\.inventory-insight-state\s*\{\s*min-height:\s*108px;/,
  'UI-9 desktop operation empty states must stay compact.',
);
assert.match(
  cssSource,
  /\.inventory-ledger-state\s*\{\s*min-height:\s*148px;/,
  'UI-9 desktop registry empty state must stay compact.',
);

const mobileVisualQaStart = cssSource.indexOf('/* UI-9 Visual QA — alignment and mobile dock clearance */');
const mobileVisualQaEnd = cssSource.indexOf('@media (max-width: 520px)', mobileVisualQaStart);
assert.notEqual(mobileVisualQaStart, -1, 'UI-9 mobile visual QA marker missing.');
assert.notEqual(mobileVisualQaEnd, -1, 'UI-9 mobile visual QA boundary missing.');

const mobileVisualQaSource = cssSource.slice(mobileVisualQaStart, mobileVisualQaEnd);
for (const required of [
  '.inventory-operations-grid {\n    margin-bottom: 64px;',
  'min-height: 52px;\n    padding: 7px 10px;',
  '.inventory-insight-state {\n    min-height: 84px;\n    padding: 12px 14px;',
  '.inventory-ledger-state {\n    min-height: 140px;',
]) {
  assert.equal(
    mobileVisualQaSource.includes(required),
    true,
    'UI-9 mobile alignment contract missing: ' + required,
  );
}

assert.equal(
  cssSource.includes('.admin-bottom-nav'),
  false,
  'UI-9 repair must not override the shared mobile dock.',
);

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
