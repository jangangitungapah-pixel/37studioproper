import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertOwnerControlMatches } from '../workers/admin-operations-worker/src/lib/auth.js';

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
const bookingOperationsRepository = read('src/services/bookingOperationsRepository.js');
const galleryWorker = read('workers/admin-operations-worker/src/domain/gallery.js');
const workerIndex = read('workers/admin-operations-worker/src/index.js');
const bookingSessionsWorker = read('workers/admin-operations-worker/src/domain/bookingSessions.js');
const dailyClosingWorker = read('workers/admin-operations-worker/src/domain/dailyClosings.js');
const adminBookingRepository = read('src/services/adminBookingRepository.js');

const bookingCommunicationRepository = read('src/services/bookingCommunicationRepository.js');
const bookingDetailDrawer = read('src/components/booking/BookingDetailDrawer.jsx');
const publicBookingPage = read('src/pages/PublicBookingPage.jsx');
const adminPage = read('src/pages/AdminPage.jsx');
const workerHttp = read('workers/admin-operations-worker/src/lib/http.js');
const workerAuth = read('workers/admin-operations-worker/src/lib/auth.js');
const inventoryWorker = read('workers/admin-operations-worker/src/domain/inventory.js');

assert.match(
  rules,
  /function isOwner\(\) \{[\s\S]*?!userDocExists\(\) && isBootstrapOwnerEmail\(\)[\s\S]*?getUserData\(\)\.role == 'owner'[\s\S]*?getUserData\(\)\.status == 'approved'/,
  'Bootstrap email must stop granting Owner authority after a canonical user document exists.',
);
assert.equal(rules.includes('match /adminControl/ownership'), true);
assert.equal(rules.includes('ownershipControlMatches()'), true);
assert.doesNotThrow(() => assertOwnerControlMatches(
  { role: 'owner', status: 'approved' },
  'uid-current',
  { data: { currentOwnerUid: 'uid-current' } },
));
assert.doesNotThrow(() => assertOwnerControlMatches(
  { role: 'owner', status: 'approved' },
  'uid-legacy',
  null,
), 'A legacy owner remains compatible until ownership control is initialized.');
assert.throws(
  () => assertOwnerControlMatches(
    { role: 'owner', status: 'approved' },
    'uid-former-owner',
    { data: { currentOwnerUid: 'uid-current' } },
  ),
  (error) => error?.code === 'owner_identity_mismatch' && error?.status === 403,
  'A stale owner role must not bypass canonical ownership after a transfer.',
);
assert.doesNotThrow(() => assertOwnerControlMatches(
  { role: 'admin', status: 'approved' },
  'uid-admin',
  { data: { currentOwnerUid: 'uid-current' } },
), 'The canonical owner control must not block ordinary approved admins.');
assert.equal(workerAuth.includes("firestore.getDocument('adminControl', 'ownership')"), true);
assert.equal(workerAuth.includes('assertOwnerControlMatches(user, identity.uid, ownershipControlDocument)'), true);

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
assert.match(
  bookingOperationsRepository,
  /initialPaymentIntent: payment/,
  'A pending initial payment must be durably stored as an intent on the booking.',
);
assert.match(
  bookingOperationsRepository,
  /current\.initialPaymentLedgerStatus === 'pending' && current\.initialPaymentIntent/,
  'Editing a pending booking must recover its initial payment ledger after a page reload.',
);
assert.match(
  rules,
  /payment == resource\.data\.initialPaymentIntent/,
  'Rules must bind the posted payment history to the immutable initial payment intent.',
);
assert.equal(bookingSessionsWorker.includes('commitIdempotentOperation'), true);
assert.equal(bookingSessionsWorker.includes("'bookingSessionEvents'"), true);
assert.equal(workerIndex.includes("pathname === '/v1/bookings/sessions/action'"), true);
assert.match(workerIndex, /pathname === '\/v1\/bookings\/sessions\/action'[\s\S]*?authorize\(env, request, firestore, \{ permission: 'schedule' \}\);[\s\S]*?body = await readJson\(request\);/);
assert.match(
  rules,
  /match \/bookingSessionEvents\/\{eventId\} \{[\s\S]*?allow read: if isApprovedScheduleAdmin\(\);[\s\S]*?allow create: if isApprovedScheduleAdmin\(\)[\s\S]*?bookingSessionEventReferencesBookingAfter\(eventId\);[\s\S]*?allow update, delete: if false;/,
  'Session history must be schedule-admin readable, paired with its booking update, and append-only.',
);
assert.match(
  rules,
  /match \/bookingScheduleDays\/\{dateId\} \{[\s\S]*?bookingDocumentChangesAfter\(request\.resource\.data\.lastBookingId, request\.resource\.data\.updatedAt\)/,
  'Schedule revision markers must accompany a booking write.',
);
assert.match(
  rules,
  /match \/clientCalendarSlots\/\{slotId\} \{[\s\S]*?allow read: if true;[\s\S]*?bookingCalendarSlotMatchesAfter/,
  'Public calendar slots must be generic and match the paired booking state.',
);
assert.match(
  rules,
  /function adminBookingUpdateAllowed\(bookingId\)[\s\S]*?changed\.hasAny\(\['initialPaymentLedgerStatus'\]\)[\s\S]*?adminBookingInitialPaymentLedgerUpdate\(bookingId\)[\s\S]*?changed\.hasAny\(\[[\s\S]*?'lastFinanceAction'[\s\S]*?\]\)[\s\S]*?adminBookingFinanceUpdateAllowed\(bookingId\)[\s\S]*?isApprovedScheduleAdmin\(\) && adminBookingOperationalUpdate\(bookingId\)/,
  'Initial-payment ledger writes must be routed before ordinary finance mutations, with no duplicate finance evaluation.',
);
const operationalStart = rules.indexOf('function adminBookingOperationalUpdate(bookingId)');
const operationalEnd = rules.indexOf('function adminBookingUpdateAllowed(bookingId)', operationalStart);
assert.ok(operationalStart >= 0 && operationalEnd > operationalStart);
assert.doesNotMatch(
  rules.slice(operationalStart, operationalEnd),
  /adminBookingFinanceUpdateAllowed/,
  'Operational booking validation must not repeat the finance validator.',
);

assert.match(
  workerIndex,
  /pathname === '\/v1\/finance\/daily-closings\/preview'[\s\S]*?authorize\(env, request, firestore, \{ permission: 'bookkeeping' \}\);[\s\S]*?body = await readJson\(request\);/,
  'Daily closing preview must be authenticated and authorized before reading the body.',
);
assert.match(
  workerIndex,
  /pathname === '\/v1\/finance\/daily-closings\/close'[\s\S]*?authorize\(env, request, firestore, \{ permission: 'bookkeeping' \}\);[\s\S]*?body = await readJson\(request\);/,
  'Closing must require the bookkeeping permission before reading the body.',
);
assert.match(
  workerIndex,
  /pathname === '\/v1\/finance\/daily-closings\/reopen'[\s\S]*?ownerOnly: true[\s\S]*?requireFreshAuth: true[\s\S]*?body = await readJson\(request\);/,
  'Reopen must be Owner-only and require fresh authentication.',
);
assert.equal(dailyClosingWorker.includes("firestore.listDocuments('bookings'"), true, 'Legacy payments must be included without relying on the UI 150-row query.');
assert.equal(dailyClosingWorker.includes("'bookkeepingEntries'"), true);
assert.equal(dailyClosingWorker.includes('transactionReferences'), true);
assert.equal(dailyClosingWorker.includes('Asia/Jakarta'), true);
assert.equal(dailyClosingWorker.includes('requiredSignedMoney'), true, 'Net digital reconciliation must support negative refunds and outflows.');
assert.equal(dailyClosingWorker.includes('commitIdempotentOperation'), true);
assert.match(rules, /function bookkeepingBusinessDateOpen\(data\)[\s\S]*?cashClosingSessions[\s\S]*?status != 'closed'/);
assert.match(rules, /match \/cashClosingSessions\/\{closingId\} \{[\s\S]*?allow read: if isApproved\(\) && canAccessBookkeepingData\(\);[\s\S]*?allow create, update, delete: if false;/);
assert.match(rules, /match \/cashClosingEvents\/\{eventId\} \{[\s\S]*?allow read: if isApproved\(\) && canAccessBookkeepingData\(\);[\s\S]*?allow create, update, delete: if false;/);
assert.equal(rules.includes('bookkeepingBusinessDateOpen(data)'), true,
  'Manual journal create must reject writes against a closed business date.');
assert.match(
  rules,
  /function manualBookkeepingFenceUpdateAllowed\(closingId\)[\s\S]*?validManualBookkeepingActivityFence\(data, closingId\)[\s\S]*?status != 'closed'/,
  'Manual journal updates/deletes must be paired with an open activity fence.',
);

assert.equal(adminBookingRepository.includes('createCanonicalManualBooking'), false);
assert.equal(adminBookingRepository.includes('updateCanonicalManualBooking'), false);
assert.equal(adminBookingRepository.includes('syncClientCalendarSlotsFromBookings'), false);
assert.match(
  bookingOperationsRepository,
  /const EDITABLE_BOOKING_FIELDS = new Set\(\[[\s\S]*?'title',?\s*\n\]\);/,
  'Firebase booking updates must use a narrow editable-field allow-list.',
);
assert.equal(bookingOperationsRepository.includes('runIdempotentFirestoreTransaction'), true);
assert.equal(bookingOperationsRepository.includes('readCompletedOperation'), true);
assert.equal(bookingOperationsRepository.includes('createRepositoryOperationId'), true);
assert.equal(bookingOperationsRepository.includes('MAX_BOOKINGS_PER_DATE = 250'), true);
assert.equal(bookingOperationsRepository.includes('validateNoShowEligibility'), true);
assert.equal(bookingCommunicationRepository.includes("import { decideBookingRequest } from './bookingOperationsRepository.js'"), true);
assert.equal(bookingDetailDrawer.includes("import { recordBookingSessionAction } from '../../services/bookingOperationsRepository.js'"), true);
assert.equal(publicBookingPage.includes('const calendarStartDate = dateWindow[0]'), true);
assert.equal(publicBookingPage.includes('const calendarEndDate = dateWindow[6]'), true);
assert.equal(publicBookingPage.includes('startDate: calendarStartDate'), true);
assert.equal(publicBookingPage.includes('endDate: calendarEndDate'), true);
assert.equal(publicBookingPage.includes('limitCount: 500'), true);
assert.equal(adminPage.includes('syncClientCalendarSlotsFromBookings'), false);
assert.equal(bookingWorker.includes("'sessionStatus',\n  'sessionType'"), false, 'Generic booking updates must not accept sessionStatus.');

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
  'financeRepository.recordPayment(',
  'financeRepository.recordRefund(',
  'financeRepository.voidInvoice(',
  'createAdminOperationKey(',
]) {
  assert.equal(billing.includes(required), true, `Billing missing ${required}.`);
}

assert.equal(paymentProofRepository.includes('writeBatch('), false);
assert.equal(paymentProofRepository.includes('updateDoc('), false);
assert.equal(paymentProofRepository.includes('runIdempotentFirestoreTransaction('), true);
assert.equal(paymentProofRepository.includes('approvePaymentProofDirect('), true);
assert.equal(paymentProofRepository.includes('rejectPaymentProofDirect('), true);
assert.equal(paymentProofRepository.includes('reviewCanonicalPaymentProof('), false);
assert.equal(billing.includes('recordCanonicalPayment('), false);
assert.equal(billing.includes('recordCanonicalRefund('), false);
assert.equal(billing.includes('voidCanonicalInvoice('), false);
assert.equal(
  inventoryRepository.includes('subscribeInventoryItems') &&
    inventoryRepository.includes('subscribeInventoryMovements') &&
    !inventoryRepository.includes('export async function createInventoryMovement'),
  true,
  'Inventory repository must retain Firestore read subscriptions without exposing unguarded write helpers.',
);
assert.equal(read('src/pages/admin/InventoryPage.jsx').includes('adjustCanonicalInventory'), true);
const inventoryPage = read('src/pages/admin/InventoryPage.jsx');
assert.equal(inventoryPage.includes('saveCanonicalInventoryItem'), true);
assert.equal(inventoryPage.includes('archiveCanonicalInventoryItem'), true);
assert.equal(inventoryPage.includes("from '../../services/inventoryFirestoreRepository.js'"), true);
assert.equal(inventoryPage.includes('inventoryRepository.createInventoryMovement('), false);
assert.equal(inventoryPage.includes('inventoryRepository.createInventoryItem('), false);
assert.equal(inventoryPage.includes('inventoryRepository.updateInventoryItem('), false);
assert.equal(workerIndex.includes("pathname === '/v1/inventory/items'"), true);
assert.equal(workerIndex.includes("pathname === '/v1/inventory/items/archive'"), true);
assert.equal(inventoryPage.includes('createInventoryMovement('), false, 'No direct movement writes may remain in the inventory page.');
assert.match(workerIndex, /pathname === '\/v1\/inventory\/items'[\s\S]*?authorize\(env, request, firestore, \{ permission: 'inventory' \}\);[\s\S]*?body = await readJson\(request\);/);
assert.match(rules, /match \/inventoryItems\/\{itemId\} \{[\s\S]*?allow create: if inventoryItemCreateAllowed\(itemId\);[\s\S]*?allow update: if inventoryItemUpdateAllowed\(itemId\);[\s\S]*?allow delete: if false;/);
assert.match(
  rules,
  /match \/inventoryMovements\/\{movementId\} \{[\s\S]*?allow create: if inventoryMovementCreateAllowed\(movementId\);[\s\S]*?allow update, delete: if false;/,
  'Inventory movements must remain append-only with a paired operation gate.',
);
assert.match(
  inventoryWorker,
  /if \(!isCreate && body\.quantity !== undefined && Number\(body\.quantity\) !== quantity\) \{\s*throw new HttpError\(400, 'stock_write_forbidden'/,
  'Inventory metadata updates must not bypass the stock-adjustment workflow.',
);
assert.match(
  inventoryWorker,
  /if \(nextQuantity < 0\) \{\s*throw new HttpError\(\s*400,\s*'negative_stock'/,
  'Canonical stock adjustments must reject negative stock.',
);
assert.match(
  inventoryWorker,
  /firestore\.setWrite\('inventoryItems', itemId, nextItem, \{ updateTime: itemDocument\.updateTime \}\)/,
  'Canonical stock adjustments must use an update-time precondition.',
);
const inventoryDirectRepository = read('src/services/inventoryFirestoreRepository.js');
assert.match(inventoryDirectRepository, /runIdempotentFirestoreTransaction\(/);
assert.match(inventoryDirectRepository, /item\.lastMovementSnapshot = movement;[\s\S]*?transaction\.set\(itemRef, item\);/);
assert.match(inventoryDirectRepository, /async function ensureInventoryMovement\([\s\S]*?await setDoc\(movementRef, movement\)/);
assert.doesNotMatch(inventoryDirectRepository, /transaction\.set\(movementRef, movement\)/);
assert.match(inventoryDirectRepository, /lastOperationAction: action/);
assert.match(inventoryDirectRepository, /lastMovementId: movementId/);
assert.match(inventoryDirectRepository, /lastMovementSnapshot: \{\}/);
assert.match(inventoryDirectRepository, /assertNoActiveMaintenance\(transaction, itemId\)/);
assert.equal(read('workers/admin-operations-worker/src/domain/inventory.js').includes('commitIdempotentOperation'), true);
assert.equal(read('workers/admin-operations-worker/src/domain/inventory.js').includes("'inventoryMovements'"), true);
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
