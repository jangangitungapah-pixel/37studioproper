import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  REPOSITORY_ROLES,
  RepositoryValidationError,
  buildRepositoryPrincipal,
  canonicalizeRepositoryPayload,
  createRepositoryOperationId,
  createRepositoryPayloadHash,
  createRepositoryRequestId,
  parseRepositoryInput,
} from '../src/lib/firestoreRepositoryFoundation.js';

const permissions = (overrides = {}) => ({
  dashboard: false,
  schedule: false,
  customers: false,
  billing: false,
  bookkeeping: false,
  'operator-fee': false,
  'guard-attendance': false,
  inventory: false,
  gallery: false,
  settings: false,
  notifications: false,
  ...overrides,
});

const profile = (uid, role, status, permissionSet = permissions()) => ({
  uid,
  role,
  status,
  permissions: permissionSet,
});

assert.equal(buildRepositoryPrincipal({}).active, false);

const owner = buildRepositoryPrincipal({
  authUid: 'owner-1',
  userProfile: profile('owner-1', REPOSITORY_ROLES.OWNER, 'approved'),
  ownershipControl: null,
});
assert.equal(owner.active, true);
assert.equal(owner.isOwner, true);
assert.equal(owner.hasPermission('unknown-page'), true);

const unresolvedOwner = buildRepositoryPrincipal({
  authUid: 'owner-1',
  userProfile: profile('owner-1', REPOSITORY_ROLES.OWNER, 'approved'),
});
assert.equal(unresolvedOwner.active, false, 'Owner access must fail closed when ownership state is unknown.');

const transferredOwner = buildRepositoryPrincipal({
  authUid: 'owner-1',
  userProfile: profile('owner-1', REPOSITORY_ROLES.OWNER, 'approved'),
  ownershipControl: { currentOwnerUid: 'owner-2' },
});
assert.equal(transferredOwner.active, false);
assert.equal(transferredOwner.hasPermission('settings'), false);

const admin = buildRepositoryPrincipal({
  authUid: 'admin-1',
  userProfile: profile('admin-1', REPOSITORY_ROLES.ADMIN, 'approved', permissions({ schedule: true })),
  ownershipControl: null,
});
assert.equal(admin.active, true);
assert.equal(admin.isAdmin, true);
assert.equal(admin.hasPermission('schedule'), true);
assert.equal(admin.hasPermission('bookkeeping'), false);
assert.equal(admin.hasPermission('missing'), false);

const pendingAdmin = buildRepositoryPrincipal({
  authUid: 'pending-admin',
  userProfile: profile('pending-admin', REPOSITORY_ROLES.ADMIN, 'pending', permissions({ schedule: true })),
  ownershipControl: null,
});
assert.equal(pendingAdmin.active, false);
assert.equal(pendingAdmin.hasPermission('schedule'), false);

const client = buildRepositoryPrincipal({
  authUid: 'client-1',
  userProfile: profile('client-1', REPOSITORY_ROLES.CLIENT, 'active', permissions({ schedule: true })),
  ownershipControl: null,
});
assert.equal(client.active, true);
assert.equal(client.isClient, true);
assert.equal(client.hasPermission('schedule'), false, 'A forged client permission must never grant an Admin page.');

const guard = buildRepositoryPrincipal({
  authUid: 'guard-1',
  userProfile: profile('guard-1', REPOSITORY_ROLES.GUARD, 'approved', permissions({ schedule: true })),
  ownershipControl: null,
});
assert.equal(guard.active, true);
assert.equal(guard.isGuard, true);
assert.equal(guard.hasPermission('schedule'), false);

const mismatchedProfile = buildRepositoryPrincipal({
  authUid: 'admin-1',
  userProfile: profile('another-user', REPOSITORY_ROLES.ADMIN, 'approved', permissions({ schedule: true })),
  ownershipControl: null,
});
assert.equal(mismatchedProfile.active, false);
assert.equal(mismatchedProfile.uid, '');

const requestId = createRepositoryRequestId();
assert.match(requestId, /^req_[0-9a-f-]{36}$/);

const operationInput = {
  actorUid: 'admin-1',
  scope: 'booking',
  action: 'manual-create',
  requestId,
};
const operationId = await createRepositoryOperationId(operationInput);
assert.match(operationId, /^v1_[a-f0-9]{64}$/);
assert.equal(await createRepositoryOperationId(operationInput), operationId);
assert.notEqual(
  await createRepositoryOperationId({ ...operationInput, action: 'manual-update' }),
  operationId,
);

const payloadOne = { z: 3, nested: { b: true, a: 'value' } };
const payloadTwo = { nested: { a: 'value', b: true }, z: 3 };
assert.equal(
  canonicalizeRepositoryPayload(payloadOne),
  canonicalizeRepositoryPayload(payloadTwo),
);
assert.equal(
  await createRepositoryPayloadHash(payloadOne),
  await createRepositoryPayloadHash(payloadTwo),
);
assert.notEqual(
  await createRepositoryPayloadHash(payloadOne),
  await createRepositoryPayloadHash({ ...payloadTwo, z: 4 }),
);
assert.equal(
  canonicalizeRepositoryPayload({ value: new Date('2026-11-09T00:00:00.000Z') }),
  '{"value":"2026-11-09T00:00:00.000Z"}',
);

const circular = {};
circular.self = circular;
assert.throws(() => canonicalizeRepositoryPayload(circular), /circular reference/);
assert.throws(() => canonicalizeRepositoryPayload({ bad: undefined }), /undefined/);
assert.throws(() => canonicalizeRepositoryPayload({ value: Number.NaN }), /finite/);

const strictSchema = z.object({ title: z.string().min(1) }).strict();
assert.deepEqual(parseRepositoryInput(strictSchema, { title: 'Valid' }), { title: 'Valid' });
assert.throws(
  () => parseRepositoryInput(strictSchema, { title: 'Valid', forged: true }, 'test'),
  RepositoryValidationError,
);
await assert.rejects(
  createRepositoryOperationId({ ...operationInput, requestId: 'short' }),
  RepositoryValidationError,
);
await assert.rejects(
  createRepositoryOperationId({ ...operationInput, actorUid: 'uid/with/slash' }),
  RepositoryValidationError,
);

const indexes = JSON.parse(
  await readFile(new URL('../firestore.indexes.json', import.meta.url), 'utf8'),
);
const indexSignature = (index) => ({
  collectionGroup: index.collectionGroup,
  fields: index.fields.map((field) => field.fieldPath + ':' + field.order),
});
const signatures = indexes.indexes.map(indexSignature);

for (const expected of [
  {
    collectionGroup: 'customerFollowUpTasks',
    fields: ['status:ASCENDING', 'dueAt:ASCENDING', 'dueTime:ASCENDING'],
  },
  {
    collectionGroup: 'customerFollowUpTasks',
    fields: ['status:ASCENDING', 'completedAt:DESCENDING'],
  },
  {
    collectionGroup: 'customerFollowUpEvents',
    fields: ['taskId:ASCENDING', 'createdAt:DESCENDING'],
  },
]) {
  assert.ok(
    signatures.some((actual) => (
      actual.collectionGroup === expected.collectionGroup &&
      JSON.stringify(actual.fields) === JSON.stringify(expected.fields)
    )),
    'Missing Firestore composite index: ' + expected.collectionGroup + ' ' + expected.fields.join(', '),
  );
}

console.log('firestore-repository-foundation-contract-test: PASS');
