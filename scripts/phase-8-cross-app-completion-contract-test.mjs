import assert from 'node:assert/strict';
import { readFileSync as rawReadFileSync } from 'node:fs';

const readFileSync = (...args) => {
  const value = rawReadFileSync(...args);
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n') : value;
};

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const conversation = read('../src/components/booking/BookingConversationPanel.jsx');
const page = read('../src/pages/ClientPortalPage.jsx');
const packageJson = JSON.parse(read('../package.json'));

assert.match(conversation, /const subscriptionKey = `\$\{user\?\.uid \|\| ''\}:\$\{booking\?\.id \|\| ''\}:\$\{role\}:\$\{retryVersion\}`/);
assert.match(conversation, /conversationState\.key === subscriptionKey/);
assert.match(conversation, /setConversationState\(\{[\s\S]*?key: subscriptionKey/);
assert.match(conversation, /Promise\.resolve\(\)\.then\(\(\) => \{/);
assert.equal(page.includes('key={`${currentUser.uid}:${selectedBookingDetail.id}`}'), true);

const subscriptionEffects = [
  ['booking', '// Load client-owned bookings', '// Availability is actionable'],
  ['calendar', '// Availability is actionable', '// Resume a slot selected'],
  ['payment proof', '// Load payment proofs', '// Client notifications are'],
  ['notifications', '// Client notifications are', 'useEffect(() => {\n    if (!isNotificationsOpen)'],
];
for (const [label, startMarker, endMarker] of subscriptionEffects) {
  const start = page.indexOf(startMarker);
  const end = page.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Missing ${label} subscription section markers`);
  const section = page.slice(start, end);
  assert.doesNotMatch(section, /set(?:Bookings|CalendarSlots|PaymentProofs|ClientNotifications)\(\[\]\)/);
}

assert.match(page, /function retryClientBookings\(\) \{[\s\S]*?setBookings\(\[\]\);[\s\S]*?setBookingsLoading\(true\);[\s\S]*?setBookingsRetryVersion/);
assert.match(page, /function retryCalendarSlots\(\) \{[\s\S]*?setCalendarSlots\(\[\]\);[\s\S]*?setCalendarSlotsReady\(false\);[\s\S]*?setCalendarSlotsLoading\(true\);[\s\S]*?setCalendarRetryVersion/);
assert.match(page, /function retryPaymentProofs\(\) \{[\s\S]*?setPaymentProofs\(\[\]\);[\s\S]*?setPaymentProofsLoading\(true\);[\s\S]*?setPaymentProofsRetryVersion/);
assert.match(page, /function retryClientNotifications\(\) \{[\s\S]*?setClientNotifications\(\[\]\);[\s\S]*?setClientNotificationsLoading\(true\);[\s\S]*?setClientNotificationsRetryVersion/);
assert.match(page, /const resolveNotificationBooking = window\.setTimeout\(/);
assert.match(page, /window\.clearTimeout\(resolveNotificationBooking\)/);
assert.match(page, /setAuthLoading\(true\);\s*setCurrentUser\(null\);\s*setBookings\(\[\]\);/);
assert.ok(packageJson.scripts.test.includes('phase-8-cross-app-completion-contract-test.mjs'));

console.log('Phase 8 cross-app subscription lifecycle contracts passed.');
