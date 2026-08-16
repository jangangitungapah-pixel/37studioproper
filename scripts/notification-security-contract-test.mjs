import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildNotificationEventRecord,
  NOTIFICATION_EVENT_STATUSES,
} from '../src/services/notificationEventRepository.js';
import {
  NOTIFICATIONS_PERMISSION_KEY,
  normalizeAdminPermissions,
} from '../src/utils/adminPermissions.js';

const read = (path) => readFileSync(resolve(path), 'utf8');
const appSource = read('src/App.jsx');
const adminSource = read('src/pages/AdminPage.jsx');
const clientSource = read('src/pages/ClientPortalPage.jsx');
const pageSource = read('src/pages/admin/NotificationsPage.jsx');
const repositorySource = read('src/services/notificationEventRepository.js');
const cleanupSource = read('src/utils/retiredPushCleanup.js');
const rulesSource = read('firestore.rules');

assert.equal(NOTIFICATIONS_PERMISSION_KEY, 'notifications');
assert.equal(normalizeAdminPermissions({ settings: true }).notifications, true);
assert.equal(normalizeAdminPermissions({ notifications: false, settings: true }).notifications, false);

const record = buildNotificationEventRecord({
  actorRole: 'client',
  message: 'Booking baru diterima.',
  title: 'Booking baru',
  type: 'booking_request_created',
  user: { email: 'client@example.test', uid: 'client-1' },
});

assert.equal(record.channel, 'in_app');
assert.equal(record.provider, 'firestore');
assert.equal(record.status, NOTIFICATION_EVENT_STATUSES.SENT);
assert.equal(record.attempts, 0);
assert.equal(record.sentAt, record.createdAt);

for (const source of [appSource, adminSource, clientSource, pageSource, repositorySource]) {
  assert.doesNotMatch(source, /onesignal|notificationSubscription|push permission|push-delivery/i);
}

assert.match(appSource, /cleanupRetiredPushWorkers/);
assert.match(cleanupSource, /navigator\.serviceWorker\.getRegistrations\(\)/);
assert.match(cleanupSource, /registration\.unregister\(\)/);

for (const required of [
  "data.channel == 'in_app'",
  "data.provider == 'firestore'",
  "data.status == 'sent'",
  'notificationEventCreateIsRecorded',
  'allow update, delete: if false;',
]) {
  assert.equal(rulesSource.includes(required), true, `In-app activity rule missing ${required}.`);
}

for (const removed of [
  'notificationSubscriptions',
  'notificationSubscriptionDevices',
  'notificationEventAudits',
  "data.provider == 'onesignal'",
]) {
  assert.equal(rulesSource.includes(removed), false, `Retired push rule remains: ${removed}.`);
}

console.log('notification-security-contract-test: PASS');
