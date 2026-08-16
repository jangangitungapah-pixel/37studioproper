import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(repositoryRoot, path), 'utf8');
const rules = read('firestore.rules');
const billing = read('src/pages/admin/BillingPage.jsx');
const paymentProofRepository = read('src/services/paymentProofRepository.js');
const inventoryRepository = read('src/services/inventoryRepository.js');
const galleryRepository = read('src/services/galleryRepository.js');
const settings = read('src/pages/admin/SettingsPage.jsx');
const accountRoleRepository = read('src/services/accountRoleRepository.js');
const dangerWorker = read('workers/admin-operations-worker/src/domain/danger.js');
const bookingWorker = read('workers/admin-operations-worker/src/domain/bookings.js');
const galleryWorker = read('workers/admin-operations-worker/src/domain/gallery.js');
const workerIndex = read('workers/admin-operations-worker/src/index.js');
const workerHttp = read('workers/admin-operations-worker/src/lib/http.js');

assert.match(
  rules,
  /function isOwner\(\) \{[\s\S]*?!userDocExists\(\) && isBootstrapOwnerEmail\(\)[\s\S]*?getUserData\(\)\.role == 'owner'[\s\S]*?getUserData\(\)\.status == 'approved'/,
  'Bootstrap email must stop granting Owner authority after a canonical user document exists.',
);
assert.equal(rules.includes('match /adminControl/ownership'), true);
assert.equal(rules.includes('ownershipControlMatches()'), true);
assert.equal(accountRoleRepository.includes("doc(firestoreDb, 'adminControl', 'ownership')"), true);
assert.doesNotMatch(
  rules,
  /match \/settings\/\{settingId\} \{[\s\S]*?allow read, write:/,
  'Generic Settings writes must not bypass the dedicated Studio/Pricing/Invoice validators.',
);
assert.match(
  workerIndex,
  /pathname === '\/v1\/finance\/payments'[\s\S]*?authorize\(env, request, firestore, \{ permission: 'billing' \}\);[\s\S]*?body = await readJson\(request\);/,
  'Finance routes must authorize before reading a request body.',
);
assert.equal(workerHttp.includes('request.text()'), false, 'Worker must bound streamed bodies before buffering.');
assert.equal(workerHttp.includes('request.body.getReader()'), true);

for (const required of [
  'function adminBookingFinanceFieldsUnchanged()',
  "'paymentHistory', 'refundHistory', 'paymentStatus'",
  "'booking-payment'",
  "'booking-refund'",
  'request.resource.data.quantity == resource.data.quantity',
  'match /adminOperationKeys/{operationId}',
  'match /adminOperationAudit/{auditId}',
  'match /adminOperationDryRuns/{snapshotId}',
  'match /adminOperationJobs/{jobId}',
]) {
  assert.equal(rules.includes(required), true, `Security Rules missing ${required}.`);
}

assert.match(
  rules,
  /match \/settings\/operatorFees \{[\s\S]*?allow read: if isOwner\(\);/,
  'Operator Fee Settings must be Owner-read-only.',
);
assert.match(
  rules,
  /match \/gallery\/\{imageId\} \{[\s\S]*?permanentDeleteStatus != 'deleting'[\s\S]*?request\.resource\.data\.publicId == resource\.data\.publicId/,
  'Gallery restore/edit must not race a protected permanent-delete claim or replace the external asset identity.',
);
assert.equal(galleryWorker.includes("studio37/gallery/"), true);
assert.equal(galleryWorker.includes("permanentDeleteStatus: 'deleting'"), true);
assert.equal(bookingWorker.includes("type: 'manual-booking-create'"), true);
assert.equal(bookingWorker.includes("'bookkeepingEntries'"), true);
assert.match(
  rules,
  /function isSafeClientBookingRequestCreate\(data, documentId\) \{[\s\S]*?data\.keys\(\)\.hasOnly/,
  'Client booking create must use a strict allow-list.',
);
assert.match(
  rules,
  /match \/inventoryMovements\/\{movementId\} \{[\s\S]*?allow create, update, delete: if false;/,
  'Inventory movements must be server-only.',
);
assert.match(
  rules,
  /match \/gallery\/\{imageId\} \{[\s\S]*?allow delete: if false;/,
  'Gallery hard delete must be server-only.',
);
assert.match(
  rules,
  /match \/users\/\{userId\} \{[\s\S]*?request\.resource\.data\.role == resource\.data\.role[\s\S]*?allow delete: if false;/,
  'Direct ownership changes/deletes must be server-only.',
);

for (const forbidden of [
  'buildBookingPaymentPatch(',
  'buildBookingRefundPatch(',
  'buildBookingVoidPatch(',
]) {
  assert.equal(billing.includes(forbidden), false, `Billing still performs ${forbidden}.`);
}
for (const required of [
  'recordCanonicalPayment(',
  'recordCanonicalRefund(',
  'voidCanonicalInvoice(',
  'createAdminOperationKey(',
]) {
  assert.equal(billing.includes(required), true, `Billing missing ${required}.`);
}

assert.equal(paymentProofRepository.includes('writeBatch('), false);
assert.equal(paymentProofRepository.includes('updateDoc('), false);
assert.equal(paymentProofRepository.includes('reviewCanonicalPaymentProof('), true);
assert.equal(
  inventoryRepository.includes('createInventoryMovement') && billing.length > 0,
  true,
  'Inventory repository compatibility API should remain available while Page owns protected adjustment.',
);
assert.equal(read('src/pages/admin/InventoryPage.jsx').includes('adjustCanonicalInventory'), true);
assert.equal(galleryRepository.includes('permanentlyDeleteGalleryItem'), true);
assert.equal(settings.includes('DANGER_ZONE_DELETE_BATCH_SIZE'), false, 'Danger Zone still contains a browser delete loop.');
for (const collectionId of [
  'bookingScheduleDays',
  'operatorFeeEntries',
  'guardAttendanceSessions',
  'mail',
]) {
  assert.equal(
    dangerWorker.includes(`['${collectionId}'`),
    true,
    `Danger Zone Worker missing operational collection ${collectionId}.`,
  );
  assert.equal(
    settings.includes(`collectionName: '${collectionId}'`),
    true,
    `Danger Zone preview missing operational collection ${collectionId}.`,
  );
}
assert.equal(dangerWorker.includes('operatorFeeRecords'), false);

console.log('admin-operations-security-contract-test: PASS');
