import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const repository = read('../src/services/notificationEventRepository.js');
const panel = read('../src/components/client/ClientNotificationsPanel.jsx');
const page = read('../src/pages/ClientPortalPage.jsx');
const calendar = read('../src/components/client/ClientCalendarTab.jsx');
const conversation = read('../src/components/booking/BookingConversationPanel.jsx');
const portalStyles = read('../src/styles/modules/client-portal-overhaul.css');
const bookingStyles = read('../src/styles/modules/booking.css');
const rules = read('../firestore.rules');
const packageJson = JSON.parse(read('../package.json'));

assert.match(repository, /subscribeClientNotificationEvents\(user, callback, onError\)/);
assert.match(repository, /where\('targetUid',\s*'==',\s*user\.uid\)/);
assert.match(repository, /event\.targetUid === user\.uid/);
assert.match(repository, /event\.targetMode === 'user'/);
assert.match(repository, /event\.targetRole === 'client'/);
assert.match(repository, /subscribeClientNotificationEvents,/);

assert.match(panel, /role="region"/);
assert.match(panel, /Aktivitas akun/);
assert.match(panel, /Tercatat/);
assert.match(panel, /onRetry/);
assert.doesNotMatch(panel, /readByClient|mark.*read|unread/i);

assert.match(page, /notificationEventRepository\.subscribeClientNotificationEvents/);
assert.match(page, /userBookings\.find\(\(item\) => item\.id === event\?\.bookingId\)/);
assert.match(page, /new URLSearchParams\(location\.search\)\.get\('bookingId'\)/);
assert.match(page, /client-notifications-panel/);
assert.match(page, /client-notifications-trigger/);
assert.match(page, /setAuthLoading\(true\);\s*setCurrentUser\(null\);/);
assert.match(page, /setBookingsRetryVersion/);
assert.match(page, /setPaymentProofsRetryVersion/);
assert.match(page, /setClientNotificationsRetryVersion/);
assert.match(page, /Ketersediaan jadwal belum dapat diverifikasi/);
assert.match(page, /isBookingStartOccupied\(calendarSlots, simulatorDate, Number\(simulatorStartHour\)\)/);
assert.match(page, /Data jadwal belum siap atau belum dapat diverifikasi/);
assert.match(page, /setCalendarSlotsReady\(false\);\s*setCalendarSlotsLoading\(false\)/);

assert.match(calendar, /calendarSlotsReady = false/);
assert.match(calendar, /disabled=\{!calendarSlotsReady\}/);
assert.match(calendar, /data belum siap/);
assert.match(calendar, /onRetryCalendarSlots/);

assert.match(conversation, /event\.key !== 'Enter' \|\| event\.shiftKey \|\| event\.isComposing/);
assert.match(conversation, /requestSubmit\(\)/);
assert.match(conversation, /loadError/);
assert.match(conversation, /setRetryVersion/);
assert.match(conversation, /Percakapan belum dapat dimuat/);
assert.match(bookingStyles, /client-detail-modal \.booking-conversation-form[\s\S]*?position: sticky/);
assert.match(bookingStyles, /env\(safe-area-inset-bottom\)/);

assert.match(portalStyles, /\.client-notifications-panel/);
assert.match(portalStyles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(portalStyles, /@media \(forced-colors: active\)/);
assert.match(portalStyles, /\.client-data-status-group:empty/);
assert.match(portalStyles, /\.client-booking-slot:disabled/);

const notificationRule = rules.match(/match \/notificationEvents\/\{eventId\}[\s\S]*?allow update, delete: if false;/)?.[0] || '';
assert.match(notificationRule, /resource\.data\.targetUid == request\.auth\.uid/);
assert.match(notificationRule, /allow update, delete: if false/);
assert.match(packageJson.scripts.test, /client-portal-phase-7-contract-test\.mjs/);

console.log('Phase 7 Client Portal interaction and ownership contracts passed.');
