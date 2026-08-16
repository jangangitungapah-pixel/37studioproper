import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(path), 'utf8');
const pageSource = read('src/pages/admin/NotificationsPage.jsx');
const cssSource = read('src/styles/modules/notifications.css');
const navigationSource = read('src/config/adminNavigation.js');
const topbarSource = read('src/components/admin/AdminTopbar.jsx');
const repositorySource = read('src/services/notificationEventRepository.js');
const packageJson = JSON.parse(read('package.json'));

for (const required of [
  'data-notification-ui="in-app-activity"',
  'Notifikasi dalam aplikasi',
  'notif-editorial-header',
  'notif-ops-strip',
  'notif-panel-title-group',
  'notif-row-meta',
  'notif-context-link',
  'subscribeNotificationEvents(',
]) {
  assert.equal(pageSource.includes(required), true, `Activity page missing ${required}.`);
}

for (const removed of ['Worker', 'OneSignal', 'retryNotificationEvent', 'cancelNotificationEvent']) {
  assert.equal(pageSource.includes(removed), false, `Push console residue remains: ${removed}.`);
}

assert.match(
  navigationSource,
  /key:\s*'notifications'[\s\S]*?path:\s*'\/admin\/notifications'[\s\S]*?permissionKey:\s*'notifications'/,
);
assert.match(topbarSource, /goTo\(\s*['"]\/admin\/notifications['"]\s*,?\s*\)/);

for (const required of [
  "export const NOTIFICATION_EVENTS_COLLECTION = 'notificationEvents';",
  'buildNotificationEventRecord',
  'createNotificationEvent',
  'subscribeNotificationEvents',
  "channel: 'in_app'",
  "provider: 'firestore'",
]) {
  assert.equal(repositorySource.includes(required), true, `Activity repository missing ${required}.`);
}

for (const required of [
  '.notif-editorial-header',
  '.notif-ops-strip',
  '.notif-toolbar',
  '.notif-row',
  '.notif-context-link',
  '@media (max-width: 820px)',
  '@media (max-width: 520px)',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert.equal(cssSource.includes(required), true, `Activity CSS missing ${required}.`);
}

assert.equal(
  packageJson.scripts.test.includes('node scripts/admin-spatial-notification-console-contract-test.mjs'),
  true,
);

console.log('admin-spatial-notification-console-contract-test: PASS');
