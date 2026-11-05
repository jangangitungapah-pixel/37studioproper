import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/admin/BookkeepingPage.jsx', 'utf8');
const repository = readFileSync('src/services/bookkeepingRepository.js', 'utf8');
const operations = readFileSync('src/services/adminOperationsRepository.js', 'utf8');
const finance = readFileSync('workers/admin-operations-worker/src/domain/finance.js', 'utf8');
const router = readFileSync('workers/admin-operations-worker/src/index.js', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');

assert.match(page, /Daily Closing/);
assert.match(page, /createCanonicalDailyClosing/);
assert.match(page, /getCanonicalDailyClosing/);
assert.doesNotMatch(page, /bookkeepingRepository\.createBookkeepingEntry/);
assert.doesNotMatch(page, /bookkeepingRepository\.updateBookkeepingEntry/);
assert.doesNotMatch(page, /bookkeepingRepository\.deleteBookkeepingEntry/);
assert.doesNotMatch(repository, /setDoc\(|deleteDoc\(/);
assert.match(finance, /export async function closeDailyRegister/);
assert.match(finance, /bookkeepingEntries/);
assert.match(finance, /expectedCash/);
assert.match(finance, /countedCash/);
assert.match(finance, /cashVariance/);
assert.match(finance, /dailyClosings/);
assert.match(finance, /dailyClosingEvents/);
assert.match(finance, /commitIdempotentOperation/);
assert.match(finance, /Asia\\/Jakarta/);
assert.match(router, /\/v1\/finance\/daily-closings/);
assert.match(rules, /match \/dailyClosings\/{closingId}[\s\S]*?allow create, update, delete: if false;/);
process.stdout.write('✅ Daily closing and reconciliation contract passed.\\n');
