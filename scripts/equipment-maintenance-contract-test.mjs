import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/admin/InventoryPage.jsx', 'utf8');
const worker = readFileSync('workers/admin-operations-worker/src/domain/inventory.js', 'utf8');
const router = readFileSync('workers/admin-operations-worker/src/index.js', 'utf8');
const operations = readFileSync('src/services/adminOperationsRepository.js', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');

assert.match(page, /Equipment Maintenance/);
assert.match(page, /createCanonicalMaintenanceWorkOrder/);
assert.match(page, /transitionCanonicalMaintenanceWorkOrder/);
assert.match(worker, /export async function createMaintenanceWorkOrder/);
assert.match(worker, /export async function transitionMaintenanceWorkOrder/);
assert.match(worker, /maintenanceWorkOrders/);
assert.match(worker, /maintenanceEvents/);
assert.match(worker, /commitIdempotentOperation/);
assert.match(worker, /maintenance_expense_exists/);
assert.match(worker, /previousItemCondition/);
assert.match(worker, /verifiedCondition/);
assert.match(worker, /!order\.expenseEntryId/);
assert.match(page, /Simpan detail/);
assert.match(page, /Menunggu Spare Part/);
assert.match(worker, /source: 'maintenance'/);
assert.match(router, /\/v1\/inventory\/maintenance/);
assert.match(operations, /\/v1\/inventory\/maintenance/);
assert.match(rules, /match \/maintenanceWorkOrders\/{workOrderId}[\s\S]*?allow create, update, delete: if false;/);
assert.match(rules, /match \/maintenanceEvents\/{eventId}[\s\S]*?allow create, update, delete: if false;/);
process.stdout.write('✅ Equipment maintenance contract passed.\n');
