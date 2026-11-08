import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(path), 'utf8');
const galleryPage = read('src/pages/admin/GalleryPage.jsx');
const galleryAlerts = read('src/components/gallery/GalleryAlerts.jsx');
const galleryCss = read('src/styles/modules/gallery.css');
const notificationPage = read('src/pages/admin/NotificationsPage.jsx');
const notificationCss = read('src/styles/modules/notifications.css');
const settingsCss = read('src/styles/modules/settings.css');
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  'gallerySubscriptionRetry',
  'galleryLoadError',
  'handleRetryGallerySubscription',
  'canRetry={Boolean(galleryLoadError && error === galleryLoadError)}',
  'onRetry={handleRetryGallerySubscription}',
  'galleryRepository.subscribeGalleryItems(',
]) {
  assert.ok(galleryPage.includes(marker), 'Gallery recovery contract missing: ' + marker);
}
assert.ok(galleryAlerts.includes('className="gallery-alert-retry"'));
assert.ok(galleryAlerts.includes('aria-label="Coba muat galeri kembali"'));
assert.ok(galleryCss.includes(".gallery-page[data-gallery-ui='ui-11-spatial'] button:focus-visible"));
assert.ok(galleryCss.includes("@media (prefers-reduced-motion: reduce)"));
assert.ok(galleryCss.includes('button:active'));
assert.ok(galleryCss.includes('outline: 2px solid Highlight'));

for (const marker of [
  'aria-pressed={status === option.key}',
  'role="group" aria-label="Filter status"',
  'const handleRetry = () =>',
  'setRetryToken((current) => current + 1)',
  'Coba muat lagi',
  'Tidak ada aktivitas yang cocok dengan pencarian.',
]) {
  assert.ok(notificationPage.includes(marker), 'Notification activity UX contract missing: ' + marker);
}
assert.ok(notificationCss.includes('.notif-filter-pill:focus-visible'));
assert.ok(notificationCss.includes('.notif-context-link:focus-visible'));
assert.ok(notificationCss.includes('.notif-retry-button:focus-visible'));
assert.ok(notificationCss.includes('.notif-row:focus-within'));
assert.ok(notificationCss.includes('@media (prefers-reduced-motion: reduce)'));
assert.ok(notificationCss.includes('@media (forced-colors: active)'));

assert.ok(settingsCss.includes(':where(button, a, input, select, textarea):focus-visible'));
assert.ok(settingsCss.includes('.settings-mini-button:active:not(:disabled)'));
assert.ok(settingsCss.includes('@media (prefers-reduced-motion: reduce)'));
assert.ok(settingsCss.includes('.settings-role-select:active'));

assert.ok(
  packageJson.scripts.test.includes('node scripts/content-notification-settings-interaction-contract-test.mjs'),
  'Phase 6 interaction contract must run during npm test.',
);

console.log('content-notification-settings-interaction-contract-test: PASS');
