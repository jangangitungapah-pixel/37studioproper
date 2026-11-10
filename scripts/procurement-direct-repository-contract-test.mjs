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
  'receiveCanonicalPurchaseOrder',
]) {
  assert.equal(repository.includes('export async function ' + operation + '('), true);
}
assert.equal((repository.match(/await runIdempotentFirestoreTransaction\(/g) || []).length, 4);
for (const required of [
  'scope: SCOPE',
  'requestId',
  'payload',
  'execute: async (transaction, metadata)',
  'createRepositoryOperationId',
  'createRepositoryRequestId',
  'transaction.get(supplierRef)',
  'transaction.get(poRef)',
  'transaction.get(eventRef)',
  'transaction.get(reference)',
  'transaction.set(supplierRef, supplier)',
  'transaction.set(poRef, purchaseOrder)',
  'transaction.set(eventRef, event)',
]) {
  assert.equal(repository.includes(required), true, 'Direct procurement repository missing: ' + required);
}

const supplierStart = repository.indexOf('export async function createCanonicalSupplier');
const poStart = repository.indexOf('export async function createCanonicalPurchaseOrder');
const transitionStart = repository.indexOf('export async function transitionCanonicalPurchaseOrder');
const supplier = repository.slice(supplierStart, poStart);
const purchaseOrder = repository.slice(poStart, transitionStart);
const transition = repository.slice(transitionStart);
for (const required of [
  "status: 'active'",
  'lastOperationId: metadata.operationId',
  'lastEventId: eventId',
  'operationId: metadata.operationId',
]) {
  assert.equal(supplier.includes(required), true, 'Supplier contract missing: ' + required);
}
for (const required of [
  "supplierSnapshot.data().status !== 'active'",
  "lineId: 'line_'",
  'receivedQuantity: 0',
  "status: 'draft'",
  'paidAmount: 0',
  "lastOperationAction: 'create'",
]) {
  assert.equal(purchaseOrder.includes(required), true, 'PO create contract missing: ' + required);
}
for (const required of [
  'expectedUpdatedAt',
  "draft: ['submitted', 'cancelled']",
  "submitted: ['approved', 'cancelled']",
  "approved: ['ordered', 'cancelled']",
  'PO yang sudah memiliki pembayaran',
  'sudah menerima barang',
  "lastOperationAction: 'transition'",
]) {
  assert.equal(transition.includes(required), true, 'PO transition contract missing: ' + required);
}

for (const required of [
  "from '../../services/procurementFirestoreRepository.js'",
  'recordCanonicalProcurementPayment',
  'receiveCanonicalPurchaseOrder',
  "getStableRequestId('supplier-create'",
  "getStableRequestId('purchase-order-create'",
  "getStableRequestId('purchase-order-transition'",
  'receiveCanonicalPurchaseOrder',
  'recordCanonicalProcurementPayment',
  "getStableRequestId('goods-receipt'",
  'receiveCanonicalPurchaseOrder(payload, request.requestId)',
]) {
  assert.equal(workspace.includes(required), true, 'Procurement UI routing missing: ' + required);
}
assert.equal(operations.includes("requestOperation('/v1/procurement/goods-receipts'"), true);
assert.equal(operations.includes("requestOperation('/v1/procurement/payments'"), true);

for (const required of [
  'function validProcurementSupplier',
  'function validProcurementPurchaseOrder',
  'function procurementSupplierCreateAllowed',
  'function procurementPurchaseOrderCreateAllowed',
  'function procurementPurchaseOrderUpdateAllowed',
  'function procurementEventCreateAllowed',
  'allow create: if procurementSupplierCreateAllowed(supplierId);',
  'allow create: if procurementPurchaseOrderCreateAllowed(purchaseOrderId);',
  'allow update: if procurementPurchaseOrderUpdateAllowed(purchaseOrderId);',
  'event.operationId == data.lastOperationId',
  'allow create, update, delete: if false;',
]) {
  assert.equal(rules.includes(required), true, 'Procurement Rules contract missing: ' + required);
}
assert.equal(rules.includes('function procurementPurchaseOrderEventMatchesAfter'), true);
assert.equal(rules.includes('function procurementEventPurchaseOrderMatchesAfter'), true);
assert.equal(packageJson.scripts.test.includes('procurement-direct-repository-contract-test.mjs'), true);
assert.equal(packageJson.scripts['test:prd'].includes('procurement-direct-repository-contract-test.mjs'), true);

assert.match(workspace, /recordCanonicalProcurementPayment,[\s\S]*?from '\.\.\/\.\.\/services\/procurementFirestoreRepository\.js'/);
assert.match(workspace, /getStableRequestId\('procurement-payment'[\s\S]*?recordCanonicalProcurementPayment\(payload, request\.requestId\)/);
assert.match(repository, /export async function receiveCanonicalPurchaseOrder/);
assert.match(repository, /runTransaction\(firestoreDb, async \(transaction\)/);
assert.match(repository, /existingReceipt\.payloadHash !== payloadHash/);
assert.match(repository, /createRepositoryPayloadHash\(payload\)/);
assert.match(repository, /export async function recordCanonicalProcurementPayment/);
assert.match(repository, /requirePrincipal\('bookkeeping'\)/);
assert.match(repository, /closing\?\.status === 'closed'/);
assert.match(repository, /amount > remaining/);
assert.match(repository, /transaction\.set\(poRef, nextPurchaseOrder\)/);
assert.match(repository, /transaction\.set\(paymentRef, payment\)/);
assert.match(repository, /transaction\.set\(expenseRef, expense\)/);
assert.match(repository, /transaction\.set\(eventRef, event\)/);
assert.match(repository, /transaction\.set\(closingRef, closingSession\)/);
assert.match(repository, /lastProcurementPurchaseOrderId: purchaseOrderId/);
assert.match(rules, /function validProcurementPayment\(data, paymentId\)/);
assert.match(rules, /function procurementPaymentCreateAllowed\(paymentId\)/);
assert.match(rules, /function procurementPurchaseOrderPaymentUpdateAllowed\(purchaseOrderId, data\)/);
assert.match(rules, /function procurementPaymentFenceUpdateAllowed\(closingId\)/);
assert.match(rules, /function validProcurementPaymentFence\(data, closingId\)[\s\S]*?'status', 'activityRevision'[\s\S]*?get\(fencePath\)\.data\.status in \['open', 'reopened', 'not_opened'\]/);

assert.match(rules, /data\.source == 'procurement-payment'[\s\S]*?bookkeepingBusinessDateOpen\(data\)/);
assert.match(rules, /data\.action == 'payment_recorded'[\s\S]*?procurementPaymentEventMatchesAfter\(data\)/);
assert.match(rules, /allow create: if procurementPaymentCreateAllowed\(paymentId\);/);

console.log('procurement-direct-repository-contract-test: PASS');
