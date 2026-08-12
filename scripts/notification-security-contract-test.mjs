import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NOTIFICATIONS_PERMISSION_KEY,
  normalizeAdminPermissions,
} from '../src/utils/adminPermissions.js';
import { migrateNotificationPermissions } from './migrate-notification-permissions.mjs';
import { notificationWorkerTestApi } from '../workers/onesignal-notification-worker/src/index.js';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const readRepositoryFile = (path) => readFileSync(resolve(repositoryRoot, path), 'utf8');
const pageSource = readRepositoryFile('src/pages/admin/NotificationsPage.jsx');
const repositorySource = readRepositoryFile('src/services/notificationEventRepository.js');
const navigationSource = readRepositoryFile('src/config/adminNavigation.js');
const workerSource = readRepositoryFile('workers/onesignal-notification-worker/src/index.js');
const rulesSource = readRepositoryFile('firestore.rules');

assert.equal(NOTIFICATIONS_PERMISSION_KEY, 'notifications');
assert.equal(normalizeAdminPermissions({ settings: true }).notifications, true);
assert.equal(normalizeAdminPermissions({ settings: false }).notifications, false);
assert.equal(
  normalizeAdminPermissions({ notifications: false, settings: true }).notifications,
  false,
  'Explicit Notifications permission must override the legacy Settings fallback.',
);

assert.match(
  navigationSource,
  /key:\s*'notifications'[\s\S]*?permissionKey:\s*'notifications'/,
);

for (const forbidden of [
  'workerSecret',
  'Worker Secret',
  'x-studio37-worker-secret',
  'type="url"',
]) {
  assert.equal(pageSource.includes(forbidden), false, `Browser UI still exposes ${forbidden}.`);
}

for (const required of [
  'fetchNotificationWorkerHealth',
  'processNotificationEvents',
  "requestNotificationWorker('/events/retry'",
  "requestNotificationWorker('/events/cancel'",
  'authorization: `Bearer ${token}`',
]) {
  assert.equal(repositorySource.includes(required), true, `Repository missing ${required}.`);
}

assert.equal(repositorySource.includes('updateDoc('), false);
assert.equal(workerSource.includes('WORKER_SECRET'), false);
assert.equal(workerSource.includes('x-studio37-worker-secret'), false);

for (const required of [
  "getDocument(env, 'users', tokenIdentity.uid)",
  'hasNotificationPermission(caller?.user)',
  'commitEventOperation(',
  'updateTime: event._updateTime',
  'requestPayload.idempotency_key',
  "NOTIFICATION_AUDITS_COLLECTION = 'notificationEventAudits'",
  'Sent notifications cannot be replayed',
]) {
  assert.equal(workerSource.includes(required), true, `Worker hardening missing ${required}.`);
}

assert.equal(
  notificationWorkerTestApi.hasNotificationPermission({
    permissions: { settings: true },
    role: 'admin',
    status: 'approved',
  }),
  true,
);
assert.equal(
  notificationWorkerTestApi.canDispatchRequestedEvent(
    { actorUid: 'actor-1', status: 'pending' },
    { uid: 'actor-1' },
  ),
  true,
);
assert.equal(
  notificationWorkerTestApi.canDispatchRequestedEvent(
    { actorUid: 'actor-1', status: 'sent' },
    { uid: 'actor-1' },
  ),
  false,
);
const providerKey = await notificationWorkerTestApi.makeOneSignalIdempotencyKey('event-1');
assert.match(providerKey, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
assert.equal(
  providerKey,
  await notificationWorkerTestApi.makeOneSignalIdempotencyKey('event-1'),
);
assert.notEqual(
  providerKey,
  await notificationWorkerTestApi.makeOneSignalIdempotencyKey('event-2'),
);
assert.equal(
  notificationWorkerTestApi.hasNotificationPermission({
    permissions: { notifications: false, settings: true },
    role: 'admin',
    status: 'approved',
  }),
  false,
);
assert.equal(
  notificationWorkerTestApi.hasNotificationPermission({
    permissions: {},
    role: 'owner',
    status: 'approved',
  }),
  true,
);

for (const required of [
  'function canAccessNotifications()',
  "permissions.keys().hasAny(['notifications'])",
  'allow update, delete: if false;',
  'match /notificationEventAudits/{auditId}',
]) {
  assert.equal(rulesSource.includes(required), true, `Rules hardening missing ${required}.`);
}

const firstMigration = migrateNotificationPermissions([
  { uid: 'legacy-allow', permissions: { settings: true } },
  { uid: 'legacy-deny', permissions: { settings: false } },
  { uid: 'explicit-deny', permissions: { notifications: false, settings: true } },
]);
assert.equal(firstMigration.summary.changed, 2);
assert.equal(firstMigration.users[0].permissions.notifications, true);
assert.equal(firstMigration.users[1].permissions.notifications, false);
assert.equal(firstMigration.users[2].permissions.notifications, false);

const secondMigration = migrateNotificationPermissions(firstMigration.users);
assert.equal(secondMigration.summary.changed, 0, 'Migration must be idempotent.');

console.log('notification-security-contract-test: PASS');
