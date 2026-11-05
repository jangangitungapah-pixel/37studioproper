import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('workers/admin-operations-worker/src/domain/bookings.js', 'utf8');
const router = readFileSync('workers/admin-operations-worker/src/index.js', 'utf8');
const operations = readFileSync('src/services/adminOperationsRepository.js', 'utf8');
const normalizer = readFileSync('src/domain/booking/normalizeBooking.js', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const drawer = readFileSync('src/components/booking/BookingDetailDrawer.jsx', 'utf8');

assert.match(worker, /export async function updateBookingSession/);
assert.match(worker, /bookingSessionEvents/);
assert.match(worker, /commitIdempotentOperation/);
assert.match(worker, /updateTime: current\.updateTime/);
assert.match(worker, /no_show_too_early/);
assert.match(worker, /correction_reason_required/);
assert.doesNotMatch(worker.slice(worker.indexOf('const EDITABLE_BOOKING_FIELDS'), worker.indexOf('function cleanBookingUpdatePatch')), /'sessionStatus',/);
assert.match(worker, /actor\.role !== 'owner'/);
assert.match(worker, /already_checked_in/);
assert.match(router, /\/v1\/bookings\/sessions\/action/);
assert.match(operations, /\/v1\/bookings\/sessions\/action/);
assert.match(normalizer, /return 'needs_review'/);
assert.match(drawer, /Session Operations/);
assert.match(rules, /match \/bookingSessionEvents\/{eventId}[\s\S]*?allow create, update, delete: if false;/);
process.stdout.write('✅ Session lifecycle transitions are Worker-only and audited.\n');
