import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(resolve('src/pages/admin/NotificationsPage.jsx'), 'utf8');
const cssSource = readFileSync(resolve('src/styles/modules/notifications.css'), 'utf8');
const navigationSource = readFileSync(resolve('src/config/adminNavigation.js'), 'utf8');
const topbarSource = readFileSync(resolve('src/components/admin/AdminTopbar.jsx'), 'utf8');
const repositorySource = readFileSync(resolve('src/services/notificationEventRepository.js'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

for (const required of [
  'data-notification-ui="ui-13-spatial"',
  'function getEventAttentionState(',
  'function getEventDestination(',
  'data-notification-attention={attention.key}',
  'notif-attention-tag',
  'notif-row-meta',
  'notif-context-link',
  'event?.url',
  'attentionStats',
  'notif-editorial-header',
  'notif-ops-strip',
  'notif-panel-title-group',
  'notif-health-main',
  'subscribeNotificationEvents(',
  'retryNotificationEvent(event)',
  'cancelNotificationEvent(event)',
  'handleProcessWorker',
]) {
  assert.equal(
    pageSource.includes(required),
    true,
    'UI-13 page contract missing: ' + required,
  );
}

assert.equal(
  pageSource.includes('<button className="notif-health-toggle"'),
  false,
  'UI-13 health surface must not nest interactive buttons.',
);

assert.match(
  navigationSource,
  /key:\s*'notifications'[\s\S]*?path:\s*'\/admin\/notifications'[\s\S]*?sidebar:\s*false[\s\S]*?mobile:\s*false/,
  'UI-13 notifications must remain topbar-only navigation.',
);

assert.match(
  topbarSource,
  /goTo\(\s*['"]\/admin\/notifications['"]\s*,?\s*\)/,
  'UI-13 topbar bell must keep opening the notification console.',
);

for (const required of [
  "export const NOTIFICATION_EVENTS_COLLECTION = 'notificationEvents';",
  'subscribeNotificationEvents',
  'retryNotificationEvent',
  'cancelNotificationEvent',
  'dispatchNotificationEventNow',
  'createNotificationEvent',
  'url: cleanString(source.url, 700)',
]) {
  assert.equal(
    repositorySource.includes(required),
    true,
    'UI-13 notification delivery invariant missing: ' + required,
  );
}

for (const required of [
  '/* UI-13 — Spatial Notification Operations Console */',
  ".notif-page[data-notification-ui='ui-13-spatial']",
  '.notif-editorial-header',
  '.notif-ops-strip',
  '.notif-row.is-problem::before',
  '.notif-row.is-actionable::before',
  '.notif-attention-tag.is-problem',
  '.notif-context-link',
  '.notif-worker-wrap',
  '@media (max-width: 767px)',
  '@media (max-width: 420px)',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
]) {
  assert.equal(
    cssSource.includes(required),
    true,
    'UI-13 CSS contract missing: ' + required,
  );
}

assert.match(
  cssSource,
  /\.notif-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.5fr\)\s*minmax\(280px,\s*0\.58fr\)/,
  'UI-13 desktop console must preserve a dominant event feed with secondary worker operations.',
);

assert.match(
  cssSource,
  /html\s*\[\s*data-admin-theme-active='true'\s*\]\s*\[\s*data-theme='dark'\s*\][\s\S]*?\.notif-page\s*\[\s*data-notification-ui='ui-13-spatial'\s*\]/,
  'UI-13 dark mode must be an intentional tonal adaptation.',
);

assert.match(
  cssSource,
  /@media\s*\(max-width:\s*767px\)[\s\S]*?\.notif-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
  'UI-13 mobile must become a single-column operations flow.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/admin-spatial-notification-console-contract-test.mjs',
  ),
  true,
  'UI-13 contract must be registered in npm test.',
);

console.log('admin-spatial-notification-console-contract-test: PASS');
