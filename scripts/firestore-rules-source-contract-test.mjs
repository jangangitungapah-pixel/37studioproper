import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const modules = [
  'firestore/rules/core.rules',
  'firestore/rules/domains/guard-attendance.rules',
  'firestore/rules/domains/accounts-and-identity.rules',
  'firestore/rules/domains/booking-and-scheduling.rules',
  'firestore/rules/domains/finance-and-bookkeeping.rules',
  'firestore/rules/domains/inventory-and-maintenance.rules',
  'firestore/rules/domains/gallery-and-operations.rules',
  'firestore/rules/domains/notifications.rules',
  'firestore/rules/domains/procurement.rules',
  'firestore/rules/domains/customer-follow-up.rules',
  'firestore/rules/fallback.rules',
];
const assembled = (await Promise.all(modules.map(async (path) =>
  (await read(path)).replace(/\s+$/, '')
))).map((section, index) => index === 1 || index === 3 ? section + '\n' : section).join('\n');
const deployed = await read('firestore.rules');
assert.equal(
  assembled,
  deployed,
  'firestore.rules must exactly match the ordered modular source files.',
);
assert.ok(assembled.startsWith("rules_version = '2';"));
assert.ok(assembled.includes('match /{document=**} {'));
console.log('Firestore Rules modular source contract passed.');
