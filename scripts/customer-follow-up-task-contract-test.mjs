import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import {
  cancelCustomerFollowUpTask,
  createCustomerFollowUpTask,
  listCustomerFollowUpAssignees,
  updateCustomerFollowUpTask,
  validateFollowUpDueAt,
  validateFollowUpDueTime,
} from '../workers/admin-operations-worker/src/domain/customerFollowUp.js';
import { getCustomerFollowUpBuckets } from '../src/domain/customerFollowUp.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

function clone(value) {
  return structuredClone(value);
}

class FakeFirestore {
  constructor(seed = {}) {
    this.collections = new Map();
    this.version = 1;
    Object.entries(seed).forEach(([collectionId, documents]) => {
      this.collections.set(collectionId, new Map(
        Object.entries(documents).map(([id, data]) => [id, {
          data: clone(data),
          updateTime: 'v' + this.version++,
        }]),
      ));
    });
  }

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return this.collections.get(name);
  }

  async getDocument(collectionId, id) {
    const entry = this.collection(collectionId).get(id);
    return entry ? { data: clone(entry.data), id, updateTime: entry.updateTime } : null;
  }

  setWrite(collectionId, id, data, precondition = null) {
    return { collectionId, data: clone(data), id, kind: 'set', precondition };
  }

  async commit(writes) {
    for (const write of writes) {
      const current = this.collection(write.collectionId).get(write.id);
      if (write.precondition?.exists === false && current) {
        const error = new Error('Document already exists.');
        error.status = 409;
        throw error;
      }
      if (write.precondition?.exists === true && !current) {
        const error = new Error('Document does not exist.');
        error.status = 412;
        throw error;
      }
      if (write.precondition?.updateTime && current?.updateTime !== write.precondition.updateTime) {
        const error = new Error('Stale document.');
        error.status = 412;
        throw error;
      }
    }
    for (const write of writes) {
      this.collection(write.collectionId).set(write.id, {
        data: clone(write.data),
        updateTime: 'v' + this.version++,
      });
    }
    return { writeResults: writes.map(() => ({})) };
  }

  async runQuery(query) {
    const collectionId = query.from?.[0]?.collectionId;
    const filter = query.where?.fieldFilter;
    const field = filter?.field?.fieldPath;
    const value = filter?.value?.stringValue;
    const values = filter?.value?.arrayValue?.values?.map((item) => item.stringValue) || [];
    return Array.from(this.collection(collectionId).entries())
      .filter(([, entry]) => {
        if (!field) return true;
        if (filter?.op === 'IN') return values.includes(entry.data[field]);
        return entry.data[field] === value;
      })
      .slice(0, Number(query.limit || 500))
      .map(([id, entry]) => ({ data: clone(entry.data), id, updateTime: entry.updateTime }));
  }
}

function requestWithKey(key) {
  return new Request('https://worker.test/customers/follow-ups', {
    headers: { 'x-idempotency-key': key },
    method: 'POST',
  });
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function fallbackCustomerId(phone, name) {
  const slug = String(name || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'customer';
  return 'cust_' + hashString((normalizePhone(phone) || 'no-phone') + '|' + slug + '|');
}

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const rules = read('firestore.rules');
const workerIndex = read('workers/admin-operations-worker/src/index.js');
const ui = read('src/pages/admin/CustomerPage.jsx');
const customerRepository = read('src/services/adminCustomerRepository.js');
const directFollowUpRepository = read('src/services/customerFollowUpFirestoreRepository.js');
const operationsRepository = read('src/services/adminOperationsRepository.js');
const packageJson = JSON.parse(read('package.json'));

const actor = { displayName: 'Operator Test', role: 'admin', uid: 'operator-1' };
const adminPic = { displayName: 'PIC Admin', role: 'admin', status: 'approved', permissions: { customers: true } };
const owner = { displayName: 'Studio Owner', role: 'owner', status: 'approved', permissions: {} };
const now = new Date('2026-11-05T16:30:00.000Z');
const firestore = new FakeFirestore({
  customers: {
    'customer-1': { id: 'customer-1', name: 'Customer One', phone: '08123456789', phoneKey: '628123456789' },
  },
  users: {
    'operator-1': { displayName: actor.displayName, role: 'admin', status: 'approved', permissions: { customers: true } },
    'pic-1': adminPic,
    'pic-2': { ...adminPic, displayName: 'PIC Kedua' },
    'owner-1': owner,
    'client-1': { displayName: 'Portal Client', phoneNumber: '08111111111', role: 'client', status: 'active' },
    'not-eligible': { displayName: 'Admin Tanpa Akses Customer', role: 'admin', status: 'approved', permissions: { dashboard: true } },
    'pending-admin': { displayName: 'Admin Pending', role: 'admin', status: 'pending', permissions: { customers: true } },
  },
  bookings: {
    'legacy-booking-1': {
      id: 'legacy-booking-1',
      customer: 'Legacy Customer',
      phone: '08123400000',
      date: '2026-10-31',
    },
  },
});

assert.equal(validateFollowUpDueAt('2026-11-06'), '2026-11-06');
assert.equal(validateFollowUpDueTime('09:05'), '09:05');
assert.equal(validateFollowUpDueTime(''), '');
assert.throws(() => validateFollowUpDueTime('24:00'), (error) => error?.code === 'follow_up_time_invalid');
assert.throws(() => validateFollowUpDueTime('9:05'), (error) => error?.code === 'follow_up_time_invalid');
assert.throws(() => validateFollowUpDueAt('2026-02-30'), (error) => error?.code === 'follow_up_due_invalid');
assert.throws(() => validateFollowUpDueAt('2026-11-6'), (error) => error?.code === 'follow_up_due_invalid');

const list = await listCustomerFollowUpAssignees({ actor, firestore });
assert.deepEqual(
  list.assignees.map((person) => person.uid).sort(),
  ['operator-1', 'owner-1', 'pic-1', 'pic-2'],
  'Only active Owner/Admin accounts with Customer access are assignable.',
);

const taskInput = {
  assignedToUid: 'pic-1',
  customerId: 'customer-1',
  description: 'Hubungi kembali terkait sesi berikutnya.',
  dueAt: '2026-11-05',
  dueTime: '13:30',
  templateKey: 'comeback',
  title: 'Follow-up booking ulang',
};
const createOptions = {
  actor,
  body: taskInput,
  firestore,
  now,
  request: requestWithKey('follow-up-create-customer-1'),
};
const created = await createCustomerFollowUpTask(createOptions);
assert.equal(created.duplicate, false);
assert.equal(created.task.customerName, 'Customer One');
assert.equal(created.task.customerPhone, '08123456789');
assert.equal(created.task.assignedToUid, 'pic-1');
assert.equal(created.task.assignedToName, 'PIC Admin');
assert.equal(created.task.status, 'open');
assert.equal(created.task.dueTime, '13:30');
assert.equal(created.event.changes.dueTime.after, '13:30');
assert.equal(created.task.revision, 1);
assert.equal(created.event.actorUid, actor.uid);
assert.equal(created.event.changes.dueAt.after, '2026-11-05');
assert.equal(firestore.collection('customerFollowUpTasks').size, 1);
assert.equal(firestore.collection('customerFollowUpEvents').size, 1);

const createRetry = await createCustomerFollowUpTask(createOptions);
assert.equal(createRetry.duplicate, true);
assert.equal(firestore.collection('customerFollowUpTasks').size, 1);
assert.equal(firestore.collection('customerFollowUpEvents').size, 1);

await assert.rejects(
  () => createCustomerFollowUpTask({
    ...createOptions,
    body: { ...taskInput, customerId: 'missing-customer', bookingId: 'missing-booking' },
    request: requestWithKey('follow-up-invalid-customer'),
  }),
  (error) => error?.code === 'customer_source_not_found',
);

await assert.rejects(
  () => createCustomerFollowUpTask({
    ...createOptions,
    body: { ...taskInput, assignedToUid: 'client-1' },
    request: requestWithKey('follow-up-invalid-pic-client'),
  }),
  (error) => error?.code === 'follow_up_assignee_invalid',
);

await assert.rejects(
  () => createCustomerFollowUpTask({
    ...createOptions,
    body: { ...taskInput, assignedToUid: 'not-eligible' },
    request: requestWithKey('follow-up-invalid-pic-permission'),
  }),
  (error) => error?.code === 'follow_up_assignee_invalid',
);

const legacyId = fallbackCustomerId('08123400000', 'Legacy Customer');
const legacy = await createCustomerFollowUpTask({
  actor,
  body: { ...taskInput, customerId: legacyId, bookingId: 'legacy-booking-1' },
  firestore,
  now,
  request: requestWithKey('follow-up-legacy-booking'),
});
assert.equal(legacy.task.customerId, legacyId);
assert.equal(legacy.task.sourceType, 'booking');
assert.equal(legacy.task.bookingId, 'legacy-booking-1');

const portal = await createCustomerFollowUpTask({
  actor,
  body: { ...taskInput, customerId: 'auth_client-1' },
  firestore,
  now,
  request: requestWithKey('follow-up-auth-client'),
});
assert.equal(portal.task.sourceType, 'client_account');
assert.equal(portal.task.customerName, 'Portal Client');

const updateOptions = {
  actor,
  body: {
    taskId: created.task.id,
    expectedUpdatedAt: created.task.updatedAt,
    assignedToUid: 'pic-2',
    dueAt: '2026-11-07',
    dueTime: '10:15',
  },
  firestore,
  now: new Date('2026-11-05T16:31:00.000Z'),
  request: requestWithKey('follow-up-reassign-reschedule'),
};
const updated = await updateCustomerFollowUpTask(updateOptions);
assert.equal(updated.task.assignedToUid, 'pic-2');
assert.equal(updated.task.assignedToName, 'PIC Kedua');
assert.equal(updated.task.dueAt, '2026-11-07');
assert.equal(updated.task.dueTime, '10:15');
assert.equal(updated.task.revision, 2);
assert.equal(updated.event.action, 'reassigned');
assert.deepEqual(updated.event.changes.assignedToUid, { before: 'pic-1', after: 'pic-2' });
assert.deepEqual(updated.event.changes.dueAt, { before: '2026-11-05', after: '2026-11-07' });
assert.deepEqual(updated.event.changes.dueTime, { before: '13:30', after: '10:15' });

const updateRetry = await updateCustomerFollowUpTask(updateOptions);
assert.equal(updateRetry.duplicate, true);
assert.equal(firestore.collection('customerFollowUpEvents').size, 4);

await assert.rejects(
  () => updateCustomerFollowUpTask({
    ...updateOptions,
    body: {
      ...updateOptions.body,
      expectedUpdatedAt: updated.task.updatedAt,
      dueAt: '2026-02-30',
    },
    request: requestWithKey('follow-up-invalid-update-date'),
  }),
  (error) => error?.code === 'follow_up_due_invalid',
);

await assert.rejects(
  () => updateCustomerFollowUpTask({
    ...updateOptions,
    body: {
      taskId: created.task.id,
      expectedUpdatedAt: created.task.updatedAt,
      dueAt: '2026-11-08',
      status: 'in_progress',
    },
    request: requestWithKey('follow-up-stale-revision'),
  }),
  (error) => error?.code === 'follow_up_changed',
);

const currentAfterUpdate = updated.task;
await assert.rejects(
  () => updateCustomerFollowUpTask({
    actor,
    body: {
      taskId: currentAfterUpdate.id,
      expectedUpdatedAt: currentAfterUpdate.updatedAt,
      status: 'snoozed',
      dueAt: '2026-11-05',
    },
    firestore,
    now: new Date('2026-11-05T16:32:00.000Z'),
    request: requestWithKey('follow-up-snooze-same-wib-day'),
  }),
  (error) => error?.code === 'follow_up_snooze_date_future_required',
);

const snoozed = await updateCustomerFollowUpTask({
  actor,
  body: {
    taskId: currentAfterUpdate.id,
    expectedUpdatedAt: currentAfterUpdate.updatedAt,
    status: 'snoozed',
    dueAt: '2026-11-06',
  },
  firestore,
  now: new Date('2026-11-05T16:32:00.000Z'),
  request: requestWithKey('follow-up-snooze-next-wib-day'),
});
assert.equal(snoozed.task.status, 'snoozed');
assert.equal(snoozed.task.dueAt, '2026-11-06');
assert.equal(snoozed.event.action, 'snoozed');

const contacted = await updateCustomerFollowUpTask({
  actor,
  body: {
    taskId: snoozed.task.id,
    expectedUpdatedAt: snoozed.task.updatedAt,
    status: 'in_progress',
    outcome: 'no_answer',
    contacted: true,
    note: 'Tidak ada jawaban, coba lagi besok.',
  },
  firestore,
  now: new Date('2026-11-05T16:33:00.000Z'),
  request: requestWithKey('follow-up-manual-outcome'),
});
assert.equal(contacted.task.status, 'in_progress');
assert.equal(contacted.task.outcome, 'no_answer');
assert.equal(contacted.task.notes, 'Tidak ada jawaban, coba lagi besok.');
assert.ok(contacted.task.lastContactedAt);
assert.equal(contacted.event.action, 'contacted');
assert.equal(contacted.event.actorUid, actor.uid);

await assert.rejects(
  () => updateCustomerFollowUpTask({
    actor,
    body: {
      taskId: contacted.task.id,
      expectedUpdatedAt: contacted.task.updatedAt,
      status: 'completed',
      outcome: '',
    },
    firestore,
    now,
    request: requestWithKey('follow-up-complete-without-outcome'),
  }),
  (error) => error?.code === 'follow_up_outcome_required',
);

const completed = await updateCustomerFollowUpTask({
  actor,
  body: {
    taskId: contacted.task.id,
    expectedUpdatedAt: contacted.task.updatedAt,
    status: 'completed',
    outcome: 'rescheduled',
    contacted: true,
  },
  firestore,
  now: new Date('2026-11-05T16:34:00.000Z'),
  request: requestWithKey('follow-up-completed'),
});
assert.equal(completed.task.status, 'completed');
assert.equal(completed.event.action, 'completed');
assert.ok(completed.task.completedAt);

const reopened = await updateCustomerFollowUpTask({
  actor,
  body: {
    action: 'reopen',
    taskId: completed.task.id,
    expectedUpdatedAt: completed.task.updatedAt,
    note: 'Customer meminta dihubungi kembali.',
  },
  firestore,
  now: new Date('2026-11-05T16:35:00.000Z'),
  request: requestWithKey('follow-up-reopen'),
});
assert.equal(reopened.task.status, 'open');
assert.equal(reopened.task.outcome, '');
assert.equal(reopened.task.completedAt, '');
assert.equal(reopened.task.lastCompletedAt, completed.task.completedAt);
assert.equal(reopened.event.action, 'reopened');
assert.deepEqual(reopened.event.changes.outcome, { before: 'rescheduled', after: '' });

const cancelTarget = await createCustomerFollowUpTask({
  actor,
  body: taskInput,
  firestore,
  now,
  request: requestWithKey('follow-up-cancel-target'),
});
await assert.rejects(
  () => cancelCustomerFollowUpTask({
    actor,
    body: { taskId: cancelTarget.task.id, expectedUpdatedAt: cancelTarget.task.updatedAt },
    firestore,
    now,
    request: requestWithKey('follow-up-cancel-without-reason'),
  }),
  (error) => error?.code === 'follow_up_cancel_reason_required',
);
const cancelled = await cancelCustomerFollowUpTask({
  actor,
  body: {
    taskId: cancelTarget.task.id,
    expectedUpdatedAt: cancelTarget.task.updatedAt,
    reason: 'Task duplikat dari permintaan customer.',
  },
  firestore,
  now,
  request: requestWithKey('follow-up-cancel'),
});
assert.equal(cancelled.task.status, 'cancelled');
assert.equal(cancelled.event.action, 'cancelled');
assert.equal(cancelled.event.reason, 'Task duplikat dari permintaan customer.');

const beforeWibMidnight = getCustomerFollowUpBuckets([
  { id: 'still-today', status: 'open', dueAt: '2026-11-05' },
], new Date('2026-11-05T16:59:59.999Z'));
assert.equal(beforeWibMidnight.businessDate, '2026-11-05');
assert.deepEqual(beforeWibMidnight.dueToday.map((item) => item.id), ['still-today']);

const buckets = getCustomerFollowUpBuckets([
  { id: 'late', status: 'open', dueAt: '2026-11-04', createdAt: '2026-11-01' },
  { id: 'today-late', status: 'open', dueAt: '2026-11-06', dueTime: '11:30', createdAt: '2026-11-02' },
  { id: 'today-early', status: 'open', dueAt: '2026-11-06', dueTime: '09:00', createdAt: '2026-11-02' },
  { id: 'later', status: 'snoozed', dueAt: '2026-11-07', createdAt: '2026-11-03' },
  { id: 'done', status: 'completed', dueAt: '2026-11-01', completedAt: '2026-11-05T10:00:00.000Z' },
  { id: 'void', status: 'cancelled', dueAt: '2026-11-05' },
], new Date('2026-11-05T17:00:00.000Z'));
assert.equal(buckets.businessDate, '2026-11-06');
assert.deepEqual(buckets.overdue.map((item) => item.id), ['late']);
assert.deepEqual(buckets.dueToday.map((item) => item.id), ['today-early', 'today-late']);
assert.deepEqual(buckets.upcoming.map((item) => item.id), ['later']);
assert.deepEqual(buckets.completed.map((item) => item.id), ['done']);

const rulesTask = rules.slice(rules.indexOf('match /customerFollowUpTasks/'), rules.indexOf('match /customerFollowUpEvents/'));
const rulesEvent = rules.slice(rules.indexOf('match /customerFollowUpEvents/'), rules.indexOf('match /{document=**}', rules.indexOf('match /customerFollowUpEvents/')));
assert.match(rulesTask, /allow read: if isApproved\(\) && canAccessCustomerData\(\);[\s\S]*?allow create: if customerFollowUpTaskCreateAllowed\(taskId\);[\s\S]*?allow update: if customerFollowUpTaskUpdateAllowed\(taskId\);[\s\S]*?allow delete: if false;/);
assert.match(rules, /function repositoryOperationDomainMatches\(data\)[\s\S]*?task\.lastOperationId == data\.operationId[\s\S]*?task\.lastOperationPayloadHash == data\.payloadHash/);
assert.doesNotMatch(
  rules.slice(
    rules.indexOf('function customerFollowUpOperationMarkerMatches(data)'),
    rules.indexOf('match /users/{userId}/repositoryOperations/')
  ),
  /lastEventSnapshot/,
  'Operation marker validation must not repeat the task event-snapshot checks.',
);
assert.match(rules, /function validCustomerFollowUpTask\(data, taskId\)[\s\S]*?data\.keys\(\)\.size\(\) == 42[\s\S]*?data\.lastOperationPayloadHash\.size\(\) == 64/);
assert.match(
  rules,
  /function customerFollowUpActorAllowed\(\)[\s\S]*?profile\.permissions\.customers == true[\s\S]*?profile\.role == 'owner'[\s\S]*?get\(ownershipPath\)\.data\.currentOwnerUid == request\.auth\.uid/,
  'Customer admins must avoid the extra ownership read; canonical Owner access remains ownership-bound.',
);
assert.match(
  rules,
  /function customerFollowUpOtherAssigneeAllowed\(uid\)[\s\S]*?profile\.role == 'owner'[\s\S]*?get\(ownershipPath\)\.data\.currentOwnerUid == uid/,
  'Owner assignees must remain bound to the canonical ownership document.',
);
const followUpUpdateValidator = rules.slice(
  rules.indexOf('function validCustomerFollowUpTaskUpdate(data, taskId)'),
  rules.indexOf('function customerFollowUpPreviousEventRecorded()'),
);
const followUpUpdateAllowedKeys = followUpUpdateValidator.match(
  /affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/,
)?.[1] || '';
assert.ok(followUpUpdateAllowedKeys.includes("'lastEventSnapshot'"));
assert.equal(followUpUpdateAllowedKeys.includes("'customerId'"), false,
  'Follow-up update allowlist must not permit changing the task customer identity.');
assert.equal(followUpUpdateAllowedKeys.includes("'createdByUid'"), false,
  'Follow-up update allowlist must not permit changing the task creator.');
assert.match(followUpUpdateValidator, /data\.revision == resource\.data\.revision \+ 1/);
assert.match(
  followUpUpdateValidator,
  /data\.assignedToUid == resource\.data\.assignedToUid \|\|\s*validString\(data\.assignedToUid, 1, 128\)/,
  'An unchanged assignee is preserved; a changed assignee must remain a valid UID.',
);
const followUpUpdateRule = rules.slice(
  rules.indexOf('function customerFollowUpTaskUpdateAllowed(taskId)'),
  rules.indexOf('function customerFollowUpEventCreateAllowed(eventId)'),
);
assert.match(followUpUpdateRule, /customerFollowUpActorAllowed\(\)/);
assert.match(followUpUpdateRule, /customerFollowUpPreviousEventRecorded\(\)/);
assert.match(followUpUpdateRule, /validCustomerFollowUpTaskUpdate\(data, taskId\)/);
assert.match(followUpUpdateRule, /data\.lastOperationId != resource\.data\.lastOperationId/);
assert.match(followUpUpdateRule, /customerFollowUpAssigneeAllowed\(data\.assignedToUid\)/);
assert.match(
  rules,
  /data\.lastEventSnapshot\.keys\(\)\.size\(\) == 16[\s\S]*?data\.lastEventSnapshot\.changes is map[\s\S]*?data\.lastEventSnapshot\.operationAction == 'update'[\s\S]*?data\.lastEventSnapshot\.createdAt == data\.updatedAt/,
  'Task update snapshots must preserve the full 16-field event schema.',
);
assert.doesNotMatch(rules, /function validCustomerFollowUpEventSnapshot/);

assert.match(rules, /return uid == request\.auth\.uid \|\| customerFollowUpOtherAssigneeAllowed\(uid\);/);
assert.match(
  rules,
  /function validCustomerFollowUpTaskUpdate\(data, taskId\)[\s\S]*?data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\[[\s\S]*?'lastEventSnapshot'[\s\S]*?data\.revision == resource\.data\.revision \+ 1[\s\S]*?data\.lastEventSnapshot\.operationAction == 'update'[\s\S]*?function customerFollowUpTaskUpdateAllowed\(taskId\)[\s\S]*?validCustomerFollowUpTaskUpdate\(data, taskId\)[\s\S]*?data\.lastOperationId != resource\.data\.lastOperationId/,
  'Follow-up updates must restrict changed keys, preserve revision and idempotency, and validate changed values.',
);

assert.equal(rules.includes('lastOperationPayloadHash.size() == 64') && rules.includes("data.lastOperationPayloadHash.matches('^[0-9a-f]{64}')"), true);
assert.match(rulesEvent, /allow read: if isApproved\(\) && canAccessCustomerData\(\);[\s\S]*?allow create: if customerFollowUpEventCreateAllowed\(eventId\);[\s\S]*?allow update, delete: if false;/);
assert.match(directFollowUpRepository, /runIdempotentFirestoreTransaction\(/);
assert.equal((directFollowUpRepository.match(/markerWriteMode: 'after'/g) || []).length, 2);
assert.equal((directFollowUpRepository.match(/lastOperationPayloadHash: metadata\.payloadHash/g) || []).length, 2);
assert.match(directFollowUpRepository, /current\.lastOperationPayloadHash === metadata\.payloadHash/);

assert.match(directFollowUpRepository, /scope: SCOPE,[\s\S]*?action,[\s\S]*?requestId,[\s\S]*?execute: async \(transaction, metadata\)/);
assert.match(directFollowUpRepository, /task\.lastEventSnapshot = event;[\s\S]*?transaction\.set\(taskRef, task\);/);
assert.match(directFollowUpRepository, /async function ensureFollowUpEvent\([\s\S]*?await setDoc\(eventRef, event\)/);
assert.doesNotMatch(directFollowUpRepository, /transaction\.set\(eventRef, event\)/);
assert.match(directFollowUpRepository, /lastOperationId: metadata\.operationId/);
assert.match(directFollowUpRepository, /lastEventSnapshot: \{\}/);
assert.match(directFollowUpRepository, /operationAction: action/);
assert.match(ui, /customerFollowUpFirestoreRepository\.js/);
assert.match(ui, /createRepositoryRequestId\(\)/);
assert.match(ui, /followUpRequestIdsRef\.current\.set\(requestKey, requestId\)/);
assert.doesNotMatch(ui, /from '\.\.\/\.\.\/services\/adminOperationsRepository\.js'/);
assert.match(workerIndex, /pathname === '\/v1\/customers\/follow-ups\/assignees'[\s\S]*?authorize\(env, request, firestore, \{ permission: 'customers' \}\)/);
assert.match(workerIndex, /pathname === '\/v1\/customers\/follow-ups'[\s\S]*?authorize\(env, request, firestore, \{ permission: 'customers' \}\)/);
assert.match(customerRepository, /where\('status', 'in', ACTIVE_CUSTOMER_FOLLOW_UP_STATUSES\)[\s\S]*?orderBy\('dueAt', 'asc'\)[\s\S]*?orderBy\('dueTime', 'asc'\)[\s\S]*?limit\(200\)/);
assert.match(customerRepository, /where\('status', '==', 'completed'\)[\s\S]*?limit\(50\)/);
assert.match(customerRepository, /where\('taskId', '==', taskId\)[\s\S]*?orderBy\('createdAt', 'desc'\)[\s\S]*?limit\(30\)/);
assert.match(ui, /subscribeCustomerFollowUpEvents\(/);
assert.match(ui, /getCustomerFollowUpBuckets\(tasks(?:,\s*queueNow)?\)/);
assert.match(ui, /getCanonicalCustomerFollowUpAssignees\(\)/);
assert.match(ui, /onRetry=\{[\s\S]*?setFollowUpTaskRetry/);
assert.match(ui, /loadError=\{followUpTasksError\}/);
assert.match(ui, /Catat hasil komunikasi/);
assert.match(ui, /Jam follow-up \(WIB\)/);
assert.match(ui, /window\.confirm\('Selesaikan follow-up/);
assert.match(ui, /taskDueTimes\[task\.id\]/);
assert.match(ui, /Buka draft WhatsApp/);
assert.doesNotMatch(ui, /onClick=\{\(\) => onUpdateTask\(task, \{ status: 'in_progress', contacted: false \}\)\}/);
assert.doesNotMatch(ui, /placeholder="Nama PIC"/);
assert.match(operationsRepository, /\/v1\/customers\/follow-ups\/assignees/);
assert.match(packageJson.scripts.test, /customer-follow-up-task-contract-test\.mjs/);
assert.match(packageJson.scripts['test:prd'], /customer-follow-up-task-contract-test\.mjs/);

console.log('Customer follow-up domain and integration contract passed.');
