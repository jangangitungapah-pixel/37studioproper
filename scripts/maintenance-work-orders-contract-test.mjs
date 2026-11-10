import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  actOnMaintenanceWorkOrder,
  isActiveMaintenanceStatus,
  reportMaintenanceWorkOrder,
  recordMaintenanceCost,
} from '../workers/admin-operations-worker/src/domain/maintenance.js';
import { saveInventoryItem } from '../workers/admin-operations-worker/src/domain/inventory.js';

function clone(value) {
  return structuredClone(value);
}

class FakeFirestore {
  constructor(seed = {}) {
    this.collections = new Map();
    this.version = 1;
    Object.entries(seed).forEach(([collectionId, documents]) => {
      this.collections.set(collectionId, new Map(
        Object.entries(documents).map(([id, data]) => [id, {
          data: clone(data),
          updateTime: 'v' + this.version++,
        }]),
      ));
    });
  }

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return this.collections.get(name);
  }

  async getDocument(collectionId, id) {
    const entry = this.collection(collectionId).get(id);
    return entry ? { data: clone(entry.data), id, updateTime: entry.updateTime } : null;
  }

  setWrite(collectionId, id, data, precondition = null) {
    return { collectionId, data: clone(data), id, kind: 'set', precondition };
  }

  async commit(writes) {
    for (const write of writes) {
      const current = this.collection(write.collectionId).get(write.id);
      if (write.precondition?.exists === false && current) {
        const error = new Error('Document already exists.');
        error.status = 409;
        throw error;
      }
      if (write.precondition?.updateTime && current?.updateTime !== write.precondition.updateTime) {
        const error = new Error('Stale document.');
        error.status = 412;
        throw error;
      }
    }
    for (const write of writes) {
      this.collection(write.collectionId).set(write.id, {
        data: clone(write.data),
        updateTime: 'v' + this.version++,
      });
    }
    return { writeResults: writes.map(() => ({})) };
  }

  async runQuery(query) {
    const collectionId = query.from?.[0]?.collectionId;
    const field = query.where?.fieldFilter?.field?.fieldPath;
    const value = query.where?.fieldFilter?.value?.stringValue;
    const offset = Number(query.offset || 0);
    const pageSize = Number(query.limit || 500);
    return Array.from(this.collection(collectionId).entries())
      .filter(([, entry]) => !field || entry.data[field] === value)
      .slice(offset, offset + pageSize)
      .map(([id, entry]) => ({
        data: clone(entry.data),
        id,
        updateTime: entry.updateTime,
      }));
  }
}

function requestWithKey(key) {
  return new Request('https://worker.test/maintenance', {
    headers: { 'x-idempotency-key': key },
    method: 'POST',
  });
}

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(repositoryRoot, path), 'utf8');
const workerIndex = read('workers/admin-operations-worker/src/index.js');
const firestoreRules = read('firestore.rules');
const inventoryPage = read('src/pages/admin/InventoryPage.jsx');
const maintenanceUi = read('src/components/inventory/InventoryMaintenanceWorkspace.jsx');
const maintenanceRepository = read('src/services/maintenanceFirestoreRepository.js');
const bookkeepingRepository = read('src/services/bookkeepingRepository.js');
const bookkeepingPage = read('src/pages/admin/BookkeepingPage.jsx');
const packageJson = JSON.parse(read('package.json'));

const actor = { displayName: 'Admin Test', role: 'admin', uid: 'admin-1' };
const owner = { displayName: 'Owner Test', role: 'owner', uid: 'owner-1' };
const now = () => new Date('2026-11-05T08:00:00.000Z');

assert.equal(isActiveMaintenanceStatus('reported'), true);
assert.equal(isActiveMaintenanceStatus('waiting_parts'), true);
assert.equal(isActiveMaintenanceStatus('completed'), true, 'Completed remains locked until verification.');
assert.equal(isActiveMaintenanceStatus('verified'), false);
assert.equal(isActiveMaintenanceStatus('cancelled'), false);

const firestore = new FakeFirestore({
  inventoryItems: {
    'mixer-1': {
      id: 'mixer-1',
      name: 'Digital Mixer',
      category: 'studio_gear',
      type: 'asset',
      quantity: 1,
      unit: 'unit',
      minStock: 0,
      condition: 'good',
      status: 'active',
      location: 'Studio A',
      note: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-11-05T07:00:00.000Z',
    },
    'speaker-1': {
      id: 'speaker-1',
      name: 'Monitor Speaker',
      category: 'studio_gear',
      type: 'asset',
      quantity: 2,
      unit: 'unit',
      minStock: 0,
      condition: 'good',
      status: 'active',
      location: 'Studio B',
      note: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-11-05T07:00:00.000Z',
    },
  },
});

const reportPayload = {
  inventoryItemId: 'mixer-1',
  title: 'Channel output intermittent',
  description: 'Output channel kanan kadang hilang ketika volume dinaikkan.',
  priority: 'high',
  estimatedCost: 350000,
  plannedAt: '2026-11-06T02:00:00.000Z',
  dueAt: '2026-11-06T09:00:00.000Z',
  attachments: [{ label: 'Foto panel', url: 'https://example.com/mixer-panel.jpg' }],
};
const reportOptions = {
  actor,
  body: reportPayload,
  firestore,
  request: requestWithKey('maintenance-report-mixer-1'),
  now: now(),
};

const reported = await reportMaintenanceWorkOrder(reportOptions);
assert.equal(reported.duplicate, false);
assert.equal(reported.workOrder.status, 'reported');
assert.equal(reported.workOrder.priority, 'high');
assert.equal(reported.workOrder.attachments.length, 1);
assert.equal(reported.item.status, 'maintenance');
assert.equal(reported.item.condition, 'maintenance');
assert.equal(firestore.collection('maintenanceEvents').size, 1);

const reportRetry = await reportMaintenanceWorkOrder(reportOptions);
assert.equal(reportRetry.duplicate, true);
assert.equal(firestore.collection('maintenanceWorkOrders').size, 1);
assert.equal(firestore.collection('maintenanceEvents').size, 1);

await assert.rejects(
  () => reportMaintenanceWorkOrder({
    actor,
    body: { ...reportPayload, title: 'Duplicate report' },
    firestore,
    request: requestWithKey('maintenance-report-mixer-duplicate'),
    now: now(),
  }),
  (error) => error?.code === 'active_work_order_exists',
  'One equipment cannot receive a second active work order.',
);

await assert.rejects(
  () => saveInventoryItem({
    actor,
    body: {
      action: 'update',
      itemId: 'mixer-1',
      name: 'Digital Mixer',
      category: 'studio_gear',
      type: 'asset',
      unit: 'unit',
      minStock: 0,
      condition: 'good',
      status: 'active',
      location: 'Studio A',
      note: '',
    },
    firestore,
    request: requestWithKey('inventory-reactivate-during-maintenance'),
  }),
  (error) => error?.code === 'equipment_maintenance_locked',
  'Generic inventory update cannot restore equipment while a work order is active.',
);

await assert.rejects(
  () => actOnMaintenanceWorkOrder({
    actor,
    body: { action: 'start', workOrderId: reported.workOrder.id, expectedRevision: 1 },
    firestore,
    request: requestWithKey('maintenance-start-before-assignment'),
    now: now(),
  }),
  (error) => error?.code === 'maintenance_transition_invalid',
  'The lifecycle must prevent starting before triage, approval, and assignment.',
);

const stale = await actOnMaintenanceWorkOrder({
  actor,
  body: { action: 'triage', workOrderId: reported.workOrder.id, expectedRevision: 99, diagnosis: 'Test diagnosis' },
  firestore,
  request: requestWithKey('maintenance-stale-action'),
  now: now(),
}).then(() => null).catch((error) => error);
assert.equal(stale?.code, 'maintenance_revision_conflict');

async function act(action, revision, payload = {}, actingUser = actor, key = action + '-' + revision) {
  return actOnMaintenanceWorkOrder({
    actor: actingUser,
    body: {
      action,
      expectedRevision: revision,
      workOrderId: reported.workOrder.id,
      ...payload,
    },
    firestore,
    request: requestWithKey('maintenance-' + key),
    now: now(),
  });
}

let current = await act('triage', 1, {
  diagnosis: 'Output connector perlu pemeriksaan ulang.',
  priority: 'urgent',
});
assert.equal(current.workOrder.status, 'triaged');
assert.equal(current.workOrder.revision, 2);

current = await act('approve', 2, { note: 'Perbaikan disetujui.' });
assert.equal(current.workOrder.status, 'approved');
current = await act('assign', 3, {
  assignedToName: 'Teknisi Internal',
  assignedToUid: 'technician-1',
  plannedAt: '2026-11-06T02:00:00.000Z',
  dueAt: '2026-11-06T09:00:00.000Z',
});
assert.equal(current.workOrder.status, 'assigned');
assert.equal(current.workOrder.assignedToUid, 'technician-1');

current = await act('start', 4);
assert.equal(current.workOrder.status, 'in_progress');
assert.ok(current.workOrder.startedAt);

current = await act('waiting_parts', 5, { reason: 'Menunggu modul output pengganti.' });
assert.equal(current.workOrder.status, 'waiting_parts');

current = await act('resume', 6, { note: 'Spare part telah tersedia.' });
assert.equal(current.workOrder.status, 'in_progress');

current = await act('complete', 7, { repairNotes: 'Modul output diganti dan seluruh channel diuji.' });
assert.equal(current.workOrder.status, 'completed');
assert.equal((await firestore.getDocument('inventoryItems', 'mixer-1')).data.status, 'maintenance',
  'Completed must not automatically put equipment back in service.');

await assert.rejects(
  () => act('reopen', 8, { reason: 'Admin tidak boleh reopen.' }, actor, 'admin-reopen-denied'),
  (error) => error?.code === 'owner_required',
  'Reopen is restricted to Owner.',
);

current = await act('verify', 8, {
  verificationCondition: 'good',
  verificationNote: 'Seluruh output sudah diuji dan stabil.',
});
assert.equal(current.workOrder.status, 'verified');
assert.equal(current.item.status, 'active');
assert.equal(current.item.condition, 'good');

const costOptions = {
  actor,
  body: {
    workOrderId: reported.workOrder.id,
    expectedRevision: 9,
    amount: 275000,
    paymentMethod: 'transfer',
    date: '2026-11-06',
    note: 'Invoice servis modul output.',
  },
  firestore,
  request: requestWithKey('maintenance-cost-mixer-1'),
  now: now(),
};
const cost = await recordMaintenanceCost(costOptions);
assert.equal(cost.entry.source, 'maintenance');
assert.equal(cost.entry.sourceWorkOrderId, reported.workOrder.id);
assert.equal(cost.entry.type, 'expense');
assert.equal(cost.entry.amount, 275000);
assert.equal(cost.workOrder.costEntryId, cost.entry.id);
assert.equal(firestore.collection('bookkeepingEntries').size, 1);

const costRetry = await recordMaintenanceCost(costOptions);
assert.equal(costRetry.duplicate, true);
assert.equal(firestore.collection('bookkeepingEntries').size, 1,
  'Retry must not create duplicate maintenance expenses.');

await assert.rejects(
  () => recordMaintenanceCost({
    ...costOptions,
    body: { ...costOptions.body, expectedRevision: 10, amount: 100000 },
    request: requestWithKey('maintenance-cost-mixer-second-key'),
  }),
  (error) => error?.code === 'maintenance_cost_already_recorded',
  'A work order may only post one linked maintenance expense.',
);

current = await act('reopen', 10, { reason: 'Perlu pemeriksaan ulang setelah feedback teknisi.' }, owner, 'owner-reopen');
assert.equal(current.workOrder.status, 'in_progress');
assert.equal(current.item.status, 'maintenance');

await assert.rejects(
  () => actOnMaintenanceWorkOrder({
    actor: owner,
    body: { action: 'verify', workOrderId: reported.workOrder.id, expectedRevision: 1, verificationCondition: 'good' },
    firestore,
    request: requestWithKey('maintenance-stale-verify'),
    now: now(),
  }),
  (error) => error?.code === 'maintenance_revision_conflict',
  'Stale transitions must be rejected after the work order changes.',
);

const cancelledReport = await reportMaintenanceWorkOrder({
  actor,
  body: {
    inventoryItemId: 'speaker-1',
    title: 'Speaker hum noise',
    description: 'Monitor speaker mengeluarkan dengung ketika tidak ada input.',
  },
  firestore,
  request: requestWithKey('maintenance-report-speaker'),
  now: now(),
});
await assert.rejects(
  () => actOnMaintenanceWorkOrder({
    actor,
    body: { action: 'cancel', workOrderId: cancelledReport.workOrder.id, expectedRevision: 1 },
    firestore,
    request: requestWithKey('maintenance-cancel-no-reason'),
    now: now(),
  }),
  (error) => error?.code === 'cancel_reason_required',
);
const cancelled = await actOnMaintenanceWorkOrder({
  actor,
  body: {
    action: 'cancel',
    workOrderId: cancelledReport.workOrder.id,
    expectedRevision: 1,
    reason: 'Laporan duplikat, masalah telah diperiksa pada tiket lain.',
  },
  firestore,
  request: requestWithKey('maintenance-cancel-with-reason'),
  now: now(),
});
assert.equal(cancelled.workOrder.status, 'cancelled');
assert.equal(cancelled.item.status, 'active');
assert.equal(firestore.collection('maintenanceEvents').size, 13);

assert.match(workerIndex, /pathname === '\/v1\/inventory\/maintenance\/work-orders'[\s\S]*?authorize\(env, request, firestore, \{ permission: 'inventory' \}\);[\s\S]*?body = await readJson\(request\);/);
assert.match(workerIndex, /pathname === '\/v1\/inventory\/maintenance\/work-orders\/action'[\s\S]*?authorize\(env, request, firestore, \{ permission: 'inventory' \}\);[\s\S]*?body = await readJson\(request\);/);
assert.match(workerIndex, /pathname === '\/v1\/inventory\/maintenance\/work-orders\/reopen'[\s\S]*?ownerOnly: true[\s\S]*?requireFreshAuth: true[\s\S]*?body = await readJson\(request\);/);
assert.match(workerIndex, /pathname === '\/v1\/inventory\/maintenance\/work-orders\/cost'[\s\S]*?permission: 'bookkeeping'[\s\S]*?body = await readJson\(request\);/);
assert.match(firestoreRules, /match \/maintenanceWorkOrders\/\{workOrderId\} \{[\s\S]*?allow read: if isApproved\(\) && canAccessInventoryData\(\);[\s\S]*?allow create: if maintenanceWorkOrderCreateAllowed\(workOrderId\);[\s\S]*?allow update: if maintenanceWorkOrderUpdateAllowed\(workOrderId\);[\s\S]*?allow delete: if false;/);
assert.match(firestoreRules, /match \/maintenanceEvents\/\{eventId\} \{[\s\S]*?allow read: if isApproved\(\) && canAccessInventoryData\(\);[\s\S]*?allow create: if maintenanceEventCreateAllowed\(eventId\);[\s\S]*?allow update, delete: if false;/);
assert.match(firestoreRules, /function maintenanceOperationMarkerMatches\(data\)/);
assert.match(firestoreRules, /function maintenanceWorkOrderCreateAllowed\(workOrderId\)/);
assert.match(firestoreRules, /function maintenanceWorkOrderTransitionAllowed\(workOrderId, data\)/);
assert.match(firestoreRules, /function maintenanceCostLedgerCreateAllowed\(data, entryId\)/);
assert.match(firestoreRules, /data.lastOperationAction == 'maintenance-cost'/);
assert.match(firestoreRules, /'sourceWorkOrderId'/);
assert.match(firestoreRules, /validOptionalString\(data, 'sourceWorkOrderId', 160\)/);
assert.equal(inventoryPage.includes('InventoryMaintenanceWorkspace'), true);
assert.equal(maintenanceUi.includes('maintenanceFirestoreRepository.js'), true);
assert.equal(maintenanceUi.includes('adminOperationsRepository.js'), false);
assert.equal(maintenanceUi.includes('recordCanonicalMaintenanceCost'), true);
assert.equal(maintenanceRepository.includes('runIdempotentFirestoreTransaction'), true);
assert.equal(maintenanceRepository.includes('reportCanonicalMaintenanceWorkOrder'), true);
assert.equal(maintenanceRepository.includes('actOnCanonicalMaintenanceWorkOrder'), true);
assert.equal(maintenanceRepository.includes('reopenCanonicalMaintenanceWorkOrder'), true);
assert.equal(maintenanceRepository.includes('recordCanonicalMaintenanceCost'), true);
assert.equal(maintenanceRepository.includes('activeMaintenanceWorkOrderId'), true);
assert.equal(bookkeepingRepository.includes('sourceWorkOrderId'), true);
assert.equal(bookkeepingPage.includes("source === 'maintenance'"), true);
assert.equal(bookkeepingPage.includes('workOrderId: entry.sourceWorkOrderId'), true);
assert.equal(packageJson.scripts['test:prd'].includes('maintenance-work-orders-contract-test.mjs'), true);
assert.equal(packageJson.scripts.test.includes('maintenance-work-orders-contract-test.mjs'), true);

console.log('Maintenance work order contract passed.');
