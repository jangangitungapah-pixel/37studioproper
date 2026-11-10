import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path) {
  return readFileSync(resolve(path), 'utf8').replace(/\r\n?/g, '\n');
}

const finance = read('src/services/firestoreFinanceRepository.js');
const proof = read('src/services/paymentProofRepository.js');
const portal = read('src/pages/ClientPortalPage.jsx');
const wizard = read('src/components/client/ClientBookingWizard.jsx');
const billing = read('src/pages/admin/BillingPage.jsx');
const queue = read('src/components/billing/PaymentProofCommandCenter.jsx');
const drawer = read('src/components/booking/BookingDetailDrawer.jsx');
const paymentCore = read('src/utils/bookingPaymentUtils.js');
const bookkeeping = read('src/services/bookkeepingRepository.js');
const bookkeepingPage = read('src/pages/admin/BookkeepingPage.jsx');
const closing = read('src/components/bookkeeping/DailyClosingWorkspace.jsx');
const cloudinary = read('src/services/cloudinaryUploadService.js');
const rules = read('firestore.rules');
const clientCss = read('src/styles/modules/client-portal-overhaul.css');
const wizardCss = read('src/styles/modules/client-booking-wizard.css');
const billingCss = read('src/styles/modules/billing.css');

for (const method of [
  'recordFinancePayment',
  'recordFinanceRefund',
  'voidFinanceInvoice',
  'approvePaymentProofDirect',
  'rejectPaymentProofDirect',
  'createManualBookkeepingEntry',
  'updateManualBookkeepingEntry',
  'deleteManualBookkeepingEntry',
  'previewDailyClosingDirect',
  'closeDailyClosingDirect',
  'reopenDailyClosingDirect',
]) {
  assert.equal(finance.includes('function ' + method) || finance.includes('async function ' + method), true,
    'Firebase finance repository method missing: ' + method);
}
assert.equal(finance.includes('runIdempotentFirestoreTransaction('), true);
assert.equal(finance.includes('sourceProofId: proofId ||'), true);
assert.equal(finance.includes('lastOperationAction'), true);
assert.equal(finance.includes("timeZone: BUSINESS_TIME_ZONE"), true);
assert.match(finance, /date: businessDateOf\(at\) \|\| at\.slice\(0, 10\)/);
assert.equal((finance.match(/normalizeRegisterId\(body\.registerId\)/g) || []).length, 3,
  'All daily-closing operations must reject unsupported registers.');
assert.match(proof, /canonicalStatus[\s\S]*?\['void', 'refunded'\]\.includes\(canonicalStatus\)/);
assert.match(proof, /\['void', 'refunded'\]\.includes\(legacyStatus\)/);

assert.equal(proof.includes('runIdempotentFirestoreTransaction('), true);
assert.equal(proof.includes('transactionReference'), true);
assert.equal(proof.includes('payerName'), true);
assert.equal(proof.includes("proofUrl: ''"), true);
assert.equal(proof.includes("proofPublicId: ''"), true);
assert.equal(proof.includes('approvePaymentProofDirect('), true);
assert.equal(proof.includes('rejectPaymentProofDirect('), true);
assert.equal(proof.includes('reviewCanonicalPaymentProof('), false);
assert.equal(proof.includes('uploadPaymentProofFile('), false);

for (const [name, source] of [['ClientPortalPage', portal], ['ClientBookingWizard', wizard]]) {
  assert.equal(source.includes('uploadPaymentProofFile'), false, name + ' must not upload payment images.');
  assert.equal(source.includes('proofFile'), false, name + ' must not carry payment file state.');
  assert.equal(source.includes('setProofFile'), false, name + ' must not expose payment file input state.');
}
assert.equal(portal.includes('transactionReference'), true, 'ClientPortalPage must submit the Firestore transaction-reference field.');
assert.equal(wizard.includes('proofReference'), true, 'ClientBookingWizard must collect the transaction reference through its controlled prop.');
assert.equal(wizard.includes('proofPayerName'), true, 'ClientBookingWizard must collect the payer name.');
assert.equal(wizard.includes('setProofReference'), true, 'ClientBookingWizard must update the controlled reference field.');
assert.equal(portal.includes('proofPayerName'), true);
assert.equal(portal.includes('simProofPayerName'), true);

for (const [name, source] of [['BillingPage', billing], ['ProofQueue', queue], ['BookingDetailDrawer', drawer], ['PaymentProjection', paymentCore]]) {
  assert.equal(source.includes('proofUrl'), false, name + ' must not render or project historical image URLs.');
  assert.equal(source.includes('proofPublicId'), false, name + ' must not project Cloudinary public IDs.');
}
assert.equal(billing.includes('financeRepository.recordPayment('), true);
assert.equal(billing.includes('financeRepository.recordRefund('), true);
assert.equal(billing.includes('financeRepository.voidInvoice('), true);
assert.equal(queue.includes('proof.transactionReference'), true);
assert.equal(queue.includes('proof.payerName'), true);
assert.equal(drawer.includes('payment.proofReference'), true);
assert.equal(paymentCore.includes('proofReference:'), true);
assert.equal(paymentCore.includes('payerName:'), true);

assert.equal(bookkeeping.includes('financeRepository.createManualBookkeepingEntry('), true);
assert.equal(bookkeeping.includes('financeRepository.updateManualBookkeepingEntry('), true);
assert.equal(bookkeeping.includes('financeRepository.deleteManualBookkeepingEntry('), true);
assert.match(
  finance,
  /action: 'manual-create', requestId,[\s\S]*?payload: \{[\s\S]*?amount: entry\.amount,[\s\S]*?paymentMethod: entry\.paymentMethod,[\s\S]*?type: entry\.type,[\s\S]*?\},[\s\S]*?execute: async \(transaction\)/,
  'Manual create idempotency must hash stable user fields, not generated IDs or timestamps.',
);
assert.equal(bookkeepingPage.includes('createRepositoryRequestId()'), true);
assert.equal(bookkeepingPage.includes('manualSaveOperationRef'), true);
assert.equal(bookkeepingPage.includes('manualDeleteOperationsRef'), true);

assert.equal(closing.includes('dailyClosingRepository.preview('), true);
assert.equal(closing.includes('dailyClosingRepository.close('), true);
assert.equal(closing.includes('dailyClosingRepository.reopen('), true);
assert.equal(closing.includes('adminOperationsRepository'), false);

assert.equal(cloudinary.includes('uploadPaymentProofFile'), false);
assert.equal(clientCss.includes('.client-proof-file-field'), false);
assert.equal(wizardCss.includes('.client-booking-wizard-file'), false);
assert.equal(billingCss.includes('.billing-proof-image-link'), false);

for (const required of [
  'financeBookingPaymentUpdateAllowed',
  'financeBookingRefundUpdateAllowed',
  'financeBookingVoidUpdateAllowed',
  'financeBookingLedgerCreateAllowed',
  'paymentProofReviewUpdateAllowed',
  'manualBookkeepingCreateOrUpdateAllowed',
  'manualBookkeepingDeleteAllowed',
  'financeActivityFenceUpdateAllowed',
  'manualBookkeepingFenceUpdateAllowed',
  'dailyClosingSessionTransitionAllowed',
  'financeVoidScheduleDayCompanionAllowed',
  'financeVoidScheduleSlotDeleteAllowed',
  'repositoryOperationMatchesAfter',
]) {
  assert.equal(rules.includes(required), true, 'Firestore Rules contract missing: ' + required);
}
assert.equal(rules.includes("allow create: if clientCreatesPaymentProof(request.resource.data, proofId);"), true);
assert.equal(rules.includes("allow update: if paymentProofReviewUpdateAllowed(proofId);"), true);
assert.equal(rules.includes("data.get('sourceFingerprint', '')"), true,
  'Legacy closing events without a fingerprint must be safely evaluated.');
assert.equal(rules.includes('function bookkeepingEntryCreateAllowed(data, entryId)'), true,
  'Bookkeeping create authorization must dispatch by reconciled source before running expensive validators.');
assert.equal(rules.includes('function validManualBookkeepingEntry(data, entryId)'), true,
  'Manual journals must use a narrow schema-specific validator.');
assert.equal(rules.includes('function validManualBookkeepingActivityFence(data, closingId)'), true,
  'Manual journal activity fences must use a lightweight, append-safe validator.');
assert.doesNotMatch(
  rules.slice(rules.indexOf('function manualBookkeepingFenceCompanionMatchesAfter'), rules.indexOf('function manualBookkeepingFenceUpdateAllowed')),
  /repositoryOperationMatchesAfter/,
  'The operation marker is validated by the journal write; the paired fence must not duplicate that expensive check.',
);
const manualCreateFenceRule = rules.slice(
  rules.indexOf('function manualBookkeepingCreateFenceMatchesAfter'),
  rules.indexOf('function manualBookkeepingFenceMatchesAfter'),
);
assert.match(manualCreateFenceRule, /closingAfter\.lastOperationAction == 'manual-create'/);
assert.doesNotMatch(
  manualCreateFenceRule,
  /exists\(entryPath\)|get\(entryPath\)/,
  'Manual-create must not read a pre-image for a newly created journal entry.',
);
const manualFenceCreateCompanion = rules.slice(
  rules.indexOf('function manualBookkeepingFenceCreateCompanionMatchesAfter'),
  rules.indexOf('function manualBookkeepingMaintenanceFenceCompanionMatchesAfter'),
);
assert.doesNotMatch(
  manualFenceCreateCompanion,
  /exists\(entryPath\)|get\(entryPath\)/,
  'A new manual activity fence must validate its journal companion without pre-image reads.',
);
assert.equal(rules.includes('function cashClosingSessionWriteAllowed(closingId, data)'), true,
  'Closing-session authorization must dispatch by operation action.');
assert.match(
  rules,
  /function hasPermission\(page\)[\s\S]*?let profileExists = userDocExists\(\);[\s\S]*?let profile = profileExists \? getUserData\(\) : \{\};[\s\S]*?profile\.role == 'admin'[\s\S]*?profile\.status == 'approved'[\s\S]*?profile\.permissions is map[\s\S]*?profile\.permissions\[page\] == true[\s\S]*?\|\| isOwner\(\)/,
  'Approved admins must take the direct permission path while Owner authority remains canonical.',
);
assert.equal(rules.includes(`'proof-reject',\n              'paymentProofs',\n              proofId`), true,
  'Payment proof rejection must require the same-transaction repository operation marker.');
assert.equal(rules.includes('validBooking(request.resource.data, bookingId)'), false);
assert.equal(rules.includes('proofUrl, 0, 1200'), true);
assert.equal(rules.includes('data.proofUrl == \'\''), true);

assert.equal(rules.includes("!(data.paymentStatus in ['cancelled', 'canceled', 'rejected', 'deleted', 'void'])"), true,
  'Voided invoices must release their public calendar slot.');

const testOutput = '✅ Firebase finance + metadata-only payment reference contract passed.\n';
process.stdout.write(testOutput);
