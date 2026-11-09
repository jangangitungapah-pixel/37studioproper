import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file) => readFileSync(resolve(file), 'utf8');
const repository = read('src/services/procurementFirestoreRepository.js');
const workspace = read('src/components/inventory/ProcurementWorkspace.jsx');
const rules = read('firestore.rules');
const operations = read('src/services/adminOperationsRepository.js');
const packageJson = JSON.parse(read('package.json'));

assert.equal(repository.includes('adminOperationsRepository'), false);
for (const operation of [
  'createCanonicalSupplier',
  'createCanonicalPurchaseOrder',
  'transitionCanonicalPurchaseOrder',
]) {
  assert.match(repository, new RegExp('export async function ' + operation + '\\('));
}
assert.equal((repository.match(/await runIdempotentFirestoreTransaction\\(/g) || []).length, 3);
assert.match(repository, /scope: SCOPE,[\\s\\S]*?action,[\\s\\S]*?requestId,[\\s\\S]*?payload,[\\s\\S]*?execute:/);
assert.match(repository, /createRepositoryOperationId/);
assert.match(repository, /createRepositoryRequestId/);
assert.match(repository, /transaction\\.get\\(supplierRef\\)/);
assert.match(repository, /transaction\\.get\\(poRef\\)/);
assert.match(repository, /transaction\\.get\\(eventRef\\)/);
assert.match(repository, /transaction\\.get\\(reference\\)/);
assert.match(repository, /transaction\\.set\\(supplierRef, supplier\\)/);
assert.match(repository, /transaction\\.set\\(poRef, purchaseOrder\\)/);
assert.match(repository, /transaction\\.set\\(eventRef, event\\)/);

const supplierStart = repository.indexOf('export async function createCanonicalSupplier');
const poStart = repository.indexOf('export async function createCanonicalPurchaseOrder');
const transitionStart = repository.indexOf('export async function transitionCanonicalPurchaseOrder');
const supplier = repository.slice(supplierStart, poStart);
const purchaseOrder = repository.slice(poStart, transitionStart);
const transition = repository.slice(transitionStart);
assert.match(supplier, /status: 'active'/);
assert.match(supplier, /lastOperationId: metadata\\.operationId/);
assert.match(supplier, /lastEventId: eventId/);
assert.match(supplier, /operationId: metadata\\.operationId/);
assert.match(purchaseOrder, /supplierSnapshot\\.data\\(\\)\\.status !== 'active'/);
assert.match(purchaseOrder, /lineId: 'line_'/);
assert.match(purchaseOrder, /receivedQuantity: 0/);
assert.match(purchaseOrder, /status: 'draft'/);
assert.match(purchaseOrder, /paidAmount: 0/);
assert.match(purchaseOrder, /lastOperationAction: 'create'/);
assert.match(transition, /expectedUpdatedAt/);
assert.match(transition, /draft: \\['submitted', 'cancelled'\\]/);
assert.match(transition, /submitted: \\['approved', 'cancelled'\\]/);
assert.match(transition, /approved: \\['ordered', 'cancelled'\\]/);
assert.match(transition, /purchase order yang sudah memiliki pembayaran/i);
assert.match(transition, /sudah menerima barang/i);
assert.match(transition, /lastOperationAction: 'transition'/);

assert.match(workspace, /from '\\.\\.\\/\\.\\.\\/services\\/procurementFirestoreRepository\\.js'/);
assert.match(workspace, /getStableRequestId\\('supplier-create'/);
assert.match(workspace, /getStableRequestId\\('purchase-order-create'/);
assert.match(workspace, /getStableRequestId\\('purchase-order-transition'/);
assert.match(workspace, /receiveCanonicalPurchaseOrder/);
assert.match(workspace, /recordCanonicalProcurementPayment/);
assert.match(workspace, /from '\\.\\.\\/\\.\\.\\/services\\/adminOperationsRepository\\.js'/);
assert.match(operations, /requestOperation\\('\\/v1\\/procurement\\/goods-receipts'/);
assert.match(operations, /requestOperation\\('\\/v1\\/procurement\\/payments'/);

assert.match(rules, /function validProcurementSupplier/);
assert.match(rules, /function validProcurementPurchaseOrder/);
assert.match(rules, /function procurementSupplierCreateAllowed/);
assert.match(rules, /function procurementPurchaseOrderCreateAllowed/);
assert.match(rules, /function procurementPurchaseOrderUpdateAllowed/);
assert.match(rules, /function procurementEventCreateAllowed/);
assert.match(rules, /match \\/suppliers\\/\\{supplierId\\} \\{[\\s\\S]*?allow create: if procurementSupplierCreateAllowed\\(supplierId\\);[\\s\\S]*?allow update, delete: if false;/);
assert.match(rules, /match \\/purchaseOrders\\/\\{purchaseOrderId\\} \\{[\\s\\S]*?allow create: if procurementPurchaseOrderCreateAllowed\\(purchaseOrderId\\);[\\s\\S]*?allow update: if procurementPurchaseOrderUpdateAllowed\\(purchaseOrderId\\);[\\s\\S]*?allow delete: if false;/);
assert.match(rules, /event\\.operationId == data\\.lastOperationId/);
assert.match(rules, /match \\/goodsReceipts\\/\\{receiptId\\} \\{[\\s\\S]*?allow create, update, delete: if false;/);
assert.match(rules, /match \\/procurementPayments\\/\\{paymentId\\} \\{[\\s\\S]*?allow create, update, delete: if false;/);
assert.match(rules, /match \\/procurementEvents\\/\\{eventId\\} \\{[\\s\\S]*?allow create: if procurementEventCreateAllowed\\(eventId\\);[\\s\\S]*?allow update, delete: if false;/);
assert.match(packageJson.scripts.test, /procurement-direct-repository-contract-test\\.mjs/);
assert.match(packageJson.scripts['test:prd'], /procurement-direct-repository-contract-test\\.mjs/);

console.log('procurement-direct-repository-contract-test: PASS');
