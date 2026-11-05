import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/admin/InventoryPage.jsx', 'utf8');
const repository = readFileSync('src/services/inventoryRepository.js', 'utf8');
const operations = readFileSync('src/services/adminOperationsRepository.js', 'utf8');
const worker = readFileSync('workers/admin-operations-worker/src/domain/inventory.js', 'utf8');
const router = readFileSync('workers/admin-operations-worker/src/index.js', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');

assert.match(page, /saveCanonicalInventoryItem\(/);
assert.match(page, /archiveCanonicalInventoryItem\(/);
assert.doesNotMatch(page, /inventoryRepository\.createInventoryMovement\(/);
assert.doesNotMatch(page, /inventoryRepository\.createInventoryItem\(/);
assert.doesNotMatch(page, /inventoryRepository\.updateInventoryItem\(/);
assert.doesNotMatch(repository, /setDoc\(|updateDoc\(|createInventoryMovement/);
assert.match(operations, /\/v1\/inventory\/items\/save/);
assert.match(operations, /\/v1\/inventory\/items\/archive/);
assert.match(worker, /commitIdempotentOperation/);
assert.match(worker, /inventoryMovements/);
assert.match(worker, /updateTime: current\.updateTime/);
assert.match(worker, /type: archive \? 'inactive' : \(previous \? 'edit' : 'create'\)/);
assert.match(router, /\/v1\/inventory\/items\/save/);
assert.match(router, /\/v1\/inventory\/items\/archive/);
assert.match(rules, /match \/inventoryMovements\/{movementId}[\s\S]*?allow create, update, delete: if false;/);
process.stdout.write('✅ Canonical inventory metadata writes are atomic and Worker-only.\n');
