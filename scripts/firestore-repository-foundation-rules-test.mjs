import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  RepositoryIdempotencyConflictError,
  createRepositoryOperationId,
  createRepositoryPayloadHash,
  createRepositoryWriteBatch,
  runIdempotentFirestoreTransaction,
} from '../src/lib/firestoreRepositoryFoundation.js';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run this test through npm run test:rules.');
}

const projectId = 'demo-studio37';
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const environment = await initializeTestEnvironment({
  firestore: { rules },
  projectId,
});
await environment.clearFirestore();

const now = '2026-11-09T00:00:00.000Z';
const ownerEmail = 'marsicprod@gmail.com';

const permissions = (enabled = {}) => ({
  billing: false,
  bookkeeping: false,
  customers: false,
  dashboard: false,
  gallery: false,
  'guard-attendance': false,
  inventory: false,
  notifications: false,
  'operator-fee': false,
  schedule: false,
  settings: false,
  ...enabled,
});

function identity(uid, role, status, email, enabledPermissions = {}) {
  return {
    uid,
    email,
    phoneNumber: '',
    displayName: uid,
    provider: 'password',
    permissions: permissions(enabledPermissions),
    role,
    status,
    createdAt: now,
    updatedAt: now,
    ...(role === 'studio_guard' ? { guardId: 'guard-person-1' } : {}),
  };
}

function authenticatedDb(uid, email) {
  return environment.authenticatedContext(uid, {
    email,
    email_verified: true,
  }).firestore();
}

function notificationRecord({ id, uid, email, actorRole }) {
  return {
    actorEmail: email,
    actorRole,
    actorUid: uid,
    attempts: 0,
    bookingId: 'booking-1',
    channel: 'in_app',
    createdAt: now,
    errorMessage: '',
    id,
    message: 'Booking baru diterima.',
    metadata: {},
    paymentProofId: '',
    priority: 'normal',
    provider: 'firestore',
    sentAt: now,
    source: 'rules-test',
    status: 'sent',
    targetMode: 'role',
    targetRole: 'admin',
    targetUid: '',
    title: 'Booking baru',
    type: actorRole === 'guard' ? 'guard_attendance_submitted' : 'booking_request_created',
    updatedAt: now,
    url: '/admin/requests',
  };
}

function operationCall({ db, uid, email, actorRole, requestId, payload, corruptActorUid = false }) {
  return runIdempotentFirestoreTransaction({
    db,
    actorUid: uid,
    scope: 'foundation',
    action: 'create-event',
    requestId,
    payload,
    execute: async (transaction, context) => {
      const eventId = 'evt_' + context.operationId.slice(3, 27);
      const actorUid = corruptActorUid ? 'forged-actor' : uid;
      transaction.set(
        doc(db, 'notificationEvents', eventId),
        notificationRecord({
          id: eventId,
          uid: actorUid,
          email,
          actorRole,
        }),
      );
      return { collection: 'notificationEvents', id: eventId };
    },
  });
}

function markerCollection(db, uid) {
  return collection(db, 'users', uid, 'repositoryOperations');
}

function markerOnlyOperationCall({ db, uid, requestId, payload }) {
  return runIdempotentFirestoreTransaction({
    db,
    actorUid: uid,
    scope: 'foundation',
    action: 'idempotency-probe',
    requestId,
    payload,
    execute: async () => ({ collection: '', id: '' }),
  });
}

async function createInvalidOperation(db) {
  const requestId = 'req_foundation_forged_01';
  const payload = { reason: 'forged domain actor' };
  return runIdempotentFirestoreTransaction({
    db,
    actorUid: 'owner-1',
    scope: 'foundation',
    action: 'create-event',
    requestId,
    payload,
    execute: async (transaction, context) => {
      const eventId = 'evt_' + context.operationId.slice(3, 27);
      transaction.set(
        doc(db, 'notificationEvents', eventId),
        notificationRecord({
          id: eventId,
          uid: 'forged-actor',
          email: ownerEmail,
          actorRole: 'admin',
        }),
      );
      return { collection: 'notificationEvents', id: eventId };
    },
  });
}

try {
  // Verify a real getAfter() companion-write contract: the Owner profile and
  // ownership pointer must be created atomically. A pointer without its user
  // profile is rejected before the valid pair is written.
  const missingOwnerDb = authenticatedDb('missing-owner', ownerEmail);
  await assertFails(setDoc(doc(missingOwnerDb, 'adminControl', 'ownership'), {
    currentOwnerUid: 'missing-owner',
    initializedAt: now,
    updatedAt: now,
  }));

  const ownerDb = authenticatedDb('owner-1', ownerEmail);
  const ownerIdentity = identity(
    'owner-1',
    'owner',
    'approved',
    ownerEmail,
  );
  await assertSucceeds(runTransaction(ownerDb, async (transaction) => {
    transaction.set(doc(ownerDb, 'users', 'owner-1'), ownerIdentity);
    transaction.set(doc(ownerDb, 'adminControl', 'ownership'), {
      currentOwnerUid: 'owner-1',
      initializedAt: now,
      updatedAt: now,
    });
  }));
  console.log('repository-foundation: owner getAfter pair passed');

  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'admin-1'), identity(
      'admin-1',
      'admin',
      'approved',
      'admin@example.com',
      { schedule: true },
    ));
    await setDoc(doc(db, 'users', 'client-1'), identity(
      'client-1',
      'client',
      'active',
      'client@example.com',
    ));
    await setDoc(doc(db, 'users', 'guard-1'), identity(
      'guard-1',
      'studio_guard',
      'approved',
      'guard@example.com',
    ));
    await setDoc(doc(db, 'users', 'pending-admin'), identity(
      'pending-admin',
      'admin',
      'pending',
      'pending@example.com',
      { schedule: true },
    ));
  });



  // Bounded batch API: the wrapper refuses a 2nd write before commit and
  // still commits only the first valid self-owned marker.
  const batchRequest = {
    actorUid: 'owner-1',
    scope: 'foundation',
    action: 'batch-probe',
    requestId: 'req_foundation_batch_01',
  };
  const batchOperationId = await createRepositoryOperationId(batchRequest);
  const batchPayloadHash = await createRepositoryPayloadHash({ purpose: 'bounded batch test' });
  const batchMarkerRef = doc(
    ownerDb,
    'users',
    'owner-1',
    'repositoryOperations',
    batchOperationId,
  );
  const boundedBatch = createRepositoryWriteBatch(ownerDb, { maxWrites: 1 });
  boundedBatch.set(batchMarkerRef, {
    operationId: batchOperationId,
    actorUid: 'owner-1',
    scope: batchRequest.scope,
    action: batchRequest.action,
    requestId: batchRequest.requestId,
    payloadHash: batchPayloadHash,
    resultCollection: '',
    resultId: '',
    createdAt: serverTimestamp(),
  });
  assert.equal(boundedBatch.writeCount, 1);
  assert.throws(
    () => boundedBatch.delete(doc(ownerDb, 'repositoryFoundationProbes', 'must-not-commit')),
    /melewati batas 1 writes/,
  );
  const batchResult = await boundedBatch.commit();
  console.log('repository-foundation: bounded batch passed');
  assert.deepEqual(batchResult, { writeCount: 1 });
  assert.equal((await getDoc(batchMarkerRef)).exists(), true);
  assert.throws(
    () => boundedBatch.delete(doc(ownerDb, 'repositoryFoundationProbes', 'after-commit')),
    /sudah di-commit/,
  );
  await assert.rejects(boundedBatch.commit(), /satu kali/);

  const roleCases = [
    { uid: 'admin-1', email: 'admin@example.com', actorRole: 'admin', requestId: 'req_foundation_admin_01' },
    { uid: 'client-1', email: 'client@example.com', actorRole: 'client', requestId: 'req_foundation_client_01' },
    { uid: 'guard-1', email: 'guard@example.com', actorRole: 'guard', requestId: 'req_foundation_guard_01' },
  ];

  for (const roleCase of roleCases) {
    const db = authenticatedDb(roleCase.uid, roleCase.email);
    await assertSucceeds(getDoc(doc(db, 'users', roleCase.uid)));
    console.log('repository-foundation: starting role marker ' + roleCase.uid);
    let result;
    try {
      result = await markerOnlyOperationCall({
        db,
        uid: roleCase.uid,
        requestId: roleCase.requestId,
        payload: { note: 'single role matrix operation', uid: roleCase.uid },
      });
    } catch (error) {
      console.error('repository-foundation: role marker failed for ' + roleCase.uid, error);
      throw error;
    }
    assert.equal(result.replayed, false);
    assert.match(result.operationId, /^v1_[a-f0-9]{64}$/);
    assert.equal(result.result.collection, '');
    assert.equal(result.result.id, '');
    assert.equal(
      (await getDoc(doc(db, 'users', roleCase.uid, 'repositoryOperations', result.operationId))).exists(),
      true,
    );
  }

  const ownerPayload = { bookingId: 'synthetic-booking-1', decision: 'confirmed' };

  // First prove that an allowed append-only domain event and its idempotency
  // marker commit together exactly once.
  const ownerEvent = await operationCall({
    db: ownerDb,
    uid: 'owner-1',
    email: ownerEmail,
    actorRole: 'admin',
    requestId: 'req_foundation_owner_event_01',
    payload: ownerPayload,
  });
  assert.equal(ownerEvent.replayed, false);
  assert.equal(ownerEvent.result.collection, 'notificationEvents');

  // Then isolate concurrent idempotency behavior from the append-only event
  // collection. Replaying an already-created append-only event is a separate
  // state transition and must not be disguised as an update.
  const concurrent = await Promise.all([
    markerOnlyOperationCall({
      db: ownerDb,
      uid: 'owner-1',
      requestId: 'req_foundation_owner_01',
      payload: ownerPayload,
    }),
    markerOnlyOperationCall({
      db: ownerDb,
      uid: 'owner-1',
      requestId: 'req_foundation_owner_01',
      payload: ownerPayload,
    }),
  ]);

  assert.equal(concurrent.filter((item) => item.replayed === false).length, 1);
  assert.equal(concurrent.filter((item) => item.replayed === true).length, 1);
  assert.equal(concurrent[0].operationId, concurrent[1].operationId);
  assert.deepEqual(concurrent[0].result, concurrent[1].result);

  const replay = await markerOnlyOperationCall({
    db: ownerDb,
    uid: 'owner-1',
    requestId: 'req_foundation_owner_01',
    payload: ownerPayload,
  });
  assert.equal(replay.replayed, true);

  await assert.rejects(
    markerOnlyOperationCall({
      db: ownerDb,
      uid: 'owner-1',
      requestId: 'req_foundation_owner_01',
      payload: { bookingId: 'synthetic-booking-1', decision: 'rejected' },
    }),
    RepositoryIdempotencyConflictError,
  );

  const ownerMarkerRef = doc(
    ownerDb,
    'users',
    'owner-1',
    'repositoryOperations',
    replay.operationId,
  );
  await assertSucceeds(getDoc(ownerMarkerRef));
  await assertFails(updateDoc(ownerMarkerRef, { resultId: 'forged-result' }));
  await assertFails(deleteDoc(ownerMarkerRef));

  const clientDb = authenticatedDb('client-1', 'client@example.com');
  await assertFails(getDoc(doc(
    clientDb,
    'users',
    'owner-1',
    'repositoryOperations',
    replay.operationId,
  )));
  await assertFails(getDocs(query(markerCollection(clientDb, 'owner-1'), limit(20))));

  const ownerMarkerList = await assertSucceeds(
    getDocs(query(markerCollection(ownerDb, 'owner-1'), limit(20))),
  );
  assert.ok(ownerMarkerList.size >= 1);

  const unauthenticatedDb = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(unauthenticatedDb, 'users', 'owner-1', 'repositoryOperations', replay.operationId)));
  await assertFails(getDoc(ownerMarkerRef));

  const forgedMarkerId = 'v1_' + 'a'.repeat(64);
  const forgedMarkerRef = doc(
    ownerDb,
    'users',
    'owner-1',
    'repositoryOperations',
    forgedMarkerId,
  );
  const forgedMarker = {
    operationId: forgedMarkerId,
    actorUid: 'another-user',
    scope: 'foundation',
    action: 'create-event',
    requestId: 'req_forged_marker_01',
    payloadHash: 'b'.repeat(64),
    resultCollection: 'notificationEvents',
    resultId: 'fake-result',
    createdAt: serverTimestamp(),
  };
  await assertFails(setDoc(forgedMarkerRef, forgedMarker));
  await assertFails(setDoc(doc(
    ownerDb,
    'users',
    'owner-1',
    'repositoryOperations',
    'v1_' + 'c'.repeat(64),
  ), {
    ...forgedMarker,
    operationId: 'v1_' + 'c'.repeat(64),
    actorUid: 'owner-1',
    extraPrivilegedField: true,
  }));

  await assertFails(setDoc(doc(
    ownerDb,
    'users',
    'owner-1',
    'repositoryOperations',
    'v1_' + 'd'.repeat(64),
  ), {
    ...forgedMarker,
    operationId: 'v1_' + 'e'.repeat(64),
    actorUid: 'owner-1',
    requestId: 'req_forged_id_01',
    createdAt: serverTimestamp(),
  }));

  const pendingDb = authenticatedDb('pending-admin', 'pending@example.com');
  await assertFails(operationCall({
    db: pendingDb,
    uid: 'pending-admin',
    email: 'pending@example.com',
    actorRole: 'admin',
    requestId: 'req_foundation_pending_01',
    payload: { note: 'pending role must not write' },
  }));

  await assert.rejects(createInvalidOperation(ownerDb));
  const markersAfterDeniedTransaction = await getDocs(markerCollection(ownerDb, 'owner-1'));
  assert.equal(
    markersAfterDeniedTransaction.docs.some((item) => (
      item.data().requestId === 'req_foundation_forged_01'
    )),
    false,
    'A forged domain event must roll back its companion idempotency marker.',
  );

  const eventSnapshot = await getDoc(doc(ownerDb, 'notificationEvents', ownerEvent.result.id));
  assert.equal(eventSnapshot.exists(), true);
  await assertFails(updateDoc(eventSnapshot.ref, { message: 'Mutated immutable event.' }));
  await assertFails(deleteDoc(eventSnapshot.ref));

  console.log('firestore-repository-foundation-rules-test: PASS');
} finally {
  await environment.cleanup();
}
