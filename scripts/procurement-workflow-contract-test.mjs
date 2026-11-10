import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file) => readFileSync(resolve(file), 'utf8');
const inventoryPage = read('src/pages/admin/InventoryPage.jsx');
const adminPage = read('src/pages/AdminPage.jsx');
const workspace = read('src/components/inventory/ProcurementWorkspace.jsx');
const inventoryCss = read('src/styles/modules/inventory.css');
const inventoryWorker = read('workers/admin-operations-worker/src/domain/inventory.js');
const workerRouter = read('workers/admin-operations-worker/src/index.js');
const inventoryRepository = read('src/services/inventoryRepository.js');
const directRepository = read('src/services/procurementFirestoreRepository.js');
const rules = read('firestore.rules');
const packageJson = JSON.parse(read('package.json'));

assert.match(inventoryPage, /ProcurementWorkspace currentUser=\{currentUser\} inventoryItems=\{items\}/);
assert.match(inventoryPage, /activeTab === 'procurement'/);
assert.match(adminPage, /<InventoryPage currentUser=\{currentUser\} \/>/);
assert.match(workspace, /Procurement Management/);
assert.match(workspace, /createCanonicalSupplier/);
assert.match(workspace, /createCanonicalPurchaseOrder/);
assert.match(workspace, /transitionCanonicalPurchaseOrder/);
assert.match(workspace, /from '\.\.\/\.\.\/services\/procurementFirestoreRepository\.js'/);
assert.match(workspace, /recordCanonicalProcurementPayment,[\s\S]*?from '\.\.\/\.\.\/services\/procurementFirestoreRepository\.js'/);
assert.match(workspace, /getStableRequestId\('procurement-payment'/);
assert.match(workspace, /recordCanonicalProcurementPayment\(payload, request\.requestId\)/);

assert.doesNotMatch(workspace, /adminOperationsRepository/);
assert.match(workspace, /getStableRequestId\('supplier-create'/);
assert.match(workspace, /getStableRequestId\('purchase-order-create'/);
assert.match(workspace, /getStableRequestId\('purchase-order-transition'/);
assert.match(directRepository, /export async function createCanonicalSupplier/);
assert.match(directRepository, /export async function createCanonicalPurchaseOrder/);
assert.match(directRepository, /export async function transitionCanonicalPurchaseOrder/);
assert.match(directRepository, /export async function receiveCanonicalPurchaseOrder/);
assert.equal((directRepository.match(/await runIdempotentFirestoreTransaction\(/g) || []).length, 4);
assert.match(directRepository, /transaction\.get\(supplierRef\)/);
assert.match(directRepository, /transaction\.get\(reference\)/);

assert.match(workspace, /receiveCanonicalPurchaseOrder/);
assert.match(workspace, /recordCanonicalProcurementPayment/);
assert.match(workspace, /subscribeSuppliers/);
assert.match(workspace, /subscribePurchaseOrders/);
assert.match(workspace, /subscribeGoodsReceipts/);
assert.match(workspace, /subscribeProcurementPayments/);
assert.match(workspace, /if \(canRecordPayments\) \{[\s\S]*?subscribeProcurementPayments/);
assert.match(workspace, /const canApprovePurchaseOrders = currentUser\?\.role === 'admin'/);
assert.match(workspace, /order\.status === 'submitted' && canApprovePurchaseOrders/);
assert.match(workspace, /canApprovePurchaseOrders && \['draft', 'submitted', 'approved'\]\.includes\(order\.status\)/);
assert.match(workspace, /Approval PO memerlukan role Owner atau Admin/);
assert.match(workspace, /procurement-payment-list/);
assert.match(workspace, /Stok belum berubah sampai barang diterima/);
assert.match(workspace, /Pencatatan pembayaran memerlukan izin Pembukuan/);
assert.match(inventoryCss, /\.procurement-workspace\s*\{/);
assert.match(inventoryCss, /@media \(max-width: 680px\)[\s\S]*?\.procurement-metrics/);

for (const required of [
  'export async function createSupplier',
  'export async function createPurchaseOrder',
  'export async function transitionPurchaseOrder',
  'export async function receivePurchaseOrder',
  'export async function recordPurchaseOrderPayment',
  'po_duplicate_inventory_item',
  'goods_receipt_quantity_invalid',
  'procurement_payment_exceeds_balance',
  'purchase_order_has_payment',
  'purchase_order_changed',
  'business_date_closed',
  'cashClosingSessions',
  'commitIdempotentOperation',
  "firestore.setWrite('inventoryItems', inventoryItem.id, nextItem",
  "firestore.setWrite('inventoryMovements', movementId, movement",
  "firestore.setWrite('bookkeepingEntries', paymentId, expense",
]) {
  assert.equal(inventoryWorker.includes(required), true, 'Procurement Worker contract missing: ' + required);
}

for (const [pathName, functionName, permission] of [
  ['/v1/procurement/suppliers', 'createSupplier', 'inventory'],
  ['/v1/procurement/purchase-orders', 'createPurchaseOrder', 'inventory'],
  ['/v1/procurement/purchase-orders/transition', 'transitionPurchaseOrder', 'inventory'],
  ['/v1/procurement/goods-receipts', 'receivePurchaseOrder', 'inventory'],
  ['/v1/procurement/payments', 'recordPurchaseOrderPayment', 'bookkeeping'],
]) {
  const routeIndex = workerRouter.indexOf("pathname === '" + pathName + "'");
  assert.notEqual(routeIndex, -1, 'Worker route missing: ' + pathName);
  const routeBlock = workerRouter.slice(routeIndex, routeIndex + 650);
  const authorizeIndex = routeBlock.indexOf("authorize(env, request, firestore, { permission: '" + permission + "' })");
  const readBodyIndex = routeBlock.indexOf('body = await readJson(request)');
  assert.notEqual(authorizeIndex, -1, 'Route authorization missing: ' + pathName);
  assert.notEqual(readBodyIndex, -1, 'Route body parsing missing: ' + pathName);
  assert.equal(authorizeIndex < readBodyIndex, true, 'Route must authorize before reading body: ' + pathName);
  assert.equal(routeBlock.includes(functionName), true, 'Route handler missing: ' + functionName);
}

for (const endpoint of [
  '/v1/procurement/suppliers',
  '/v1/procurement/purchase-orders',
  '/v1/procurement/purchase-orders/transition',
  '/v1/procurement/goods-receipts',
  '/v1/procurement/payments',
]) {
  assert.equal(directRepository.includes(endpoint), false, 'Direct Firestore repository must not call Worker routes: ' + endpoint);
}

function getCollectionRulesBlock(collectionName, documentId) {
  const startIndex = rules.indexOf('match /' + collectionName + '/{' + documentId + '} {');
  if (startIndex < 0) throw new Error('Firestore Rules collection missing: ' + collectionName);
  const endIndex = rules.indexOf(String.fromCharCode(10) + '    match /', startIndex + 1);
  return rules.slice(startIndex, endIndex < 0 ? rules.length : endIndex);
}

const supplierRules = getCollectionRulesBlock('suppliers', 'supplierId');
const purchaseOrderRules = getCollectionRulesBlock('purchaseOrders', 'purchaseOrderId');
const receiptRules = getCollectionRulesBlock('goodsReceipts', 'receiptId');
const procurementPaymentRules = getCollectionRulesBlock('procurementPayments', 'paymentId');
const procurementEventRules = getCollectionRulesBlock('procurementEvents', 'eventId');

assert.equal(supplierRules.includes('allow create: if procurementSupplierCreateAllowed(supplierId);'), true);
assert.equal(supplierRules.includes('allow update, delete: if false;'), true);
assert.equal(purchaseOrderRules.includes('allow create: if procurementPurchaseOrderCreateAllowed(purchaseOrderId);'), true);
assert.equal(purchaseOrderRules.includes('allow update: if procurementPurchaseOrderUpdateAllowed(purchaseOrderId);'), true);
assert.match(rules, /function procurementPurchaseOrderTransitionUpdateAllowed\(purchaseOrderId, data\)[\s\S]*?data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\[[\s\S]*?'purchase-order-transition'[\s\S]*?procurementPurchaseOrderEventMatchesAfter\(data\)/);
assert.match(rules, /function procurementPurchaseOrderUpdateAllowed\(purchaseOrderId\)[\s\S]*?procurementPurchaseOrderTransitionUpdateAllowed\(purchaseOrderId, data\)[\s\S]*?procurementPurchaseOrderPaymentUpdateAllowed\(purchaseOrderId, data\)/);

assert.equal(purchaseOrderRules.includes('allow delete: if false;'), true);
assert.equal(receiptRules.includes('allow create: if procurementGoodsReceiptCreateAllowed(receiptId);'), true);
assert.equal(receiptRules.includes('allow update, delete: if false;'), true);
assert.equal(procurementPaymentRules.includes('allow create: if procurementPaymentCreateAllowed(paymentId);'), true);
assert.equal(procurementPaymentRules.includes('allow update, delete: if false;'), true);
assert.equal(procurementEventRules.includes('allow create: if procurementEventCreateAllowed(eventId);'), true);
assert.equal(procurementEventRules.includes('allow update, delete: if false;'), true);
assert.match(
  rules,
  /match \/procurementPayments\/\{paymentId\} \{[\s\S]*?canAccessBookkeepingData\(\)/,
  'Procurement payment records must stay behind Bookkeeping read permission.',
);
assert.match(
  rules,
  /function isReconciledBookkeepingSource\([\s\S]*?'procurement-payment'/,
  'Supplier payment ledger rows must be treated as immutable reconciled sources.',
);
assert.match(inventoryWorker, /lastProcurementPaymentAt/);
assert.match(inventoryWorker, /cashClosingSessions/);
assert.match(
  inventoryWorker,
  /purchaseOrder:\s*\{ collectionId: 'purchaseOrders'/,
  'Idempotent Procurement responses must use the canonical purchaseOrder result key.',
);
assert.match(
  read('workers/admin-operations-worker/src/domain/dailyClosings.js'),
  /firestore\.setWrite\('cashClosingSessions'/,
  'Daily Closing must retain the atomic session precondition used by Procurement payments.',
);
assert.match(workspace, /orders\s*\.filter\(\(order\)\s*=>\s*!\['draft',\s*'cancelled'\]\.includes\(order\.status\)\)/);
assert.match(
  read('src/pages/admin/BookkeepingPage.jsx'),
  /key: 'procurement', label: 'Pengadaan'/,
  'Bookkeeping must label the canonical procurement expense category.',
);
assert.match(
  rules,
  /match \/inventoryItems\/\{itemId\} \{[\s\S]*?allow create: if inventoryItemCreateAllowed\(itemId\);[\s\S]*?allow update: if inventoryItemUpdateAllowed\(itemId\);[\s\S]*?allow delete: if false;/,
  'Inventory writes must remain protected by direct stock and movement contracts.',
);
assert.equal(inventoryRepository.includes('subscribeSuppliers'), true);
assert.equal(inventoryRepository.includes('subscribePurchaseOrders'), true);
assert.equal(inventoryRepository.includes('subscribeGoodsReceipts'), true);
assert.equal(inventoryRepository.includes('subscribeProcurementPayments'), true);
assert.match(read('scripts/procurement-worker-regression-test.mjs'), /business_date_closed/);
assert.match(packageJson.scripts.test, /procurement-worker-regression-test\.mjs/);
assert.match(packageJson.scripts['test:prd'], /procurement-workflow-contract-test\.mjs/);

console.log('procurement-workflow-contract-test: PASS');
