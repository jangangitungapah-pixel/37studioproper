import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createMaintenanceWorkOrder, transitionMaintenanceWorkOrder } from '../workers/admin-operations-worker/src/domain/inventory.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

function makeFirestore(seed = {}) {
  const documents = new Map();
  let revision = 0;
  for (const [collection, rows] of Object.entries(seed)) {
    for (const [id, data] of Object.entries(rows)) {
      documents.set(collection + '/' + id, { id, data: structuredClone(data), updateTime: 'seed-' + (++revision) });
    }
  }

  return {
    documents,
    async getDocument(collection, id) {
      const value = documents.get(collection + '/' + id);
      return value ? structuredClone(value) : null;
    },
    setWrite(collection, id, data, precondition = null) {
      return { collection, id, data: structuredClone(data), precondition };
    },
    async commit(writes) {
      for (const write of writes) {
        const current = documents.get(write.collection + '/' + write.id);
        if (write.precondition?.exists === false && current) {
          throw Object.assign(new Error('Document already exists.'), { status: 409 });
        }
        if (write.precondition?.updateTime && current?.updateTime !== write.precondition.updateTime) {
          throw Object.assign(new Error('Document revision changed.'), { status: 409 });
        }
      }
      for (const write of writes) {
        const updateTime = 'revision-' + (++revision);
        documents.set(write.collection + '/' + write.id, {
          id: write.id,
          data: structuredClone(write.data),
          updateTime,
        });
      }
      return { writeResults: writes.map(() => ({})) };
    },
  };
}

function requestFor(key) {
  return { headers: new Headers({ 'x-idempotency-key': key }) };
}

function getStored(firestore, collection, id) {
  return firestore.documents.get(collection + '/' + id)?.data;
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error?.code === code);
}

const actor = { uid: 'owner-test', displayName: 'Owner Test', role: 'owner' };
const firestore = makeFirestore({
  inventoryItems: {
    'amp-1': { id: 'amp-1', name: 'Guitar Amplifier', status: 'active', condition: 'good', quantity: 1, unit: 'unit' },
    'amp-2': { id: 'amp-2', name: 'Bass Amplifier', status: 'broken', condition: 'broken', quantity: 1, unit: 'unit' },
    'amp-3': { id: 'amp-3', name: 'Archived Amplifier', status: 'inactive', condition: 'fair', quantity: 1, unit: 'unit' },
  },
});

const created = await createMaintenanceWorkOrder({
  actor, firestore, request: requestFor('create-amp-1'),
  body: { inventoryItemId: 'amp-1', title: 'Output channel failure', priority: 'high' },
});
assert.equal(created.workOrder.status, 'reported');
assert.equal(getStored(firestore, 'inventoryItems', 'amp-1').status, 'maintenance');

const duplicate = await createMaintenanceWorkOrder({
  actor, firestore, request: requestFor('create-amp-1'),
  body: { inventoryItemId: 'amp-1', title: 'Output channel failure', priority: 'high' },
});
assert.equal(duplicate.duplicate, true);
await expectCode(createMaintenanceWorkOrder({
  actor, firestore, request: requestFor('create-amp-1-second'),
  body: { inventoryItemId: 'amp-1', title: 'Second maintenance report' },
}), 'maintenance_already_open');
await expectCode(createMaintenanceWorkOrder({
  actor, firestore, request: requestFor('create-amp-3'),
  body: { inventoryItemId: 'amp-3', title: 'Repair archived equipment' },
}), 'maintenance_item_unavailable');

const triaged = await transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('triage-amp-1'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: created.workOrder.updatedAt, status: 'triaged' },
});
await expectCode(transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('assign-missing-revision'),
  body: { workOrderId: created.workOrder.id, status: 'assigned', assignedToName: 'Teknisi Studio' },
}), 'maintenance_revision_required');
await expectCode(transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('assign-missing-pic'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: triaged.workOrder.updatedAt, status: 'assigned' },
}), 'maintenance_assignee_required');
const assigned = await transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('assign-amp-1'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: triaged.workOrder.updatedAt, status: 'assigned', assignedToName: 'Teknisi Studio' },
});
assert.equal(assigned.workOrder.assignedToName, 'Teknisi Studio');

const detailsUpdated = await transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('details-amp-1'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: assigned.workOrder.updatedAt, status: 'assigned', diagnosis: 'Power supply checked' },
});
const detailEvent = getStored(firestore, 'maintenanceEvents', detailsUpdated.event.id);
assert.equal(detailEvent.action, 'details_updated');

await expectCode(transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('start-stale-amp-1'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: 'stale-revision', status: 'in_progress' },
}), 'maintenance_changed');

const inProgress = await transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('start-amp-1'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: detailsUpdated.workOrder.updatedAt, status: 'in_progress' },
});
const waitingParts = await transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('waiting-parts-amp-1'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: inProgress.workOrder.updatedAt, status: 'waiting_parts' },
});
await expectCode(transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('complete-no-cost'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: waitingParts.workOrder.updatedAt, status: 'completed' },
}), 'maintenance_cost_required');
await expectCode(transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('complete-empty-cost'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: waitingParts.workOrder.updatedAt, status: 'completed', cost: '' },
}), 'maintenance_cost_required');

const completed = await transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('complete-amp-1'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: waitingParts.workOrder.updatedAt, status: 'completed', cost: 225000, paymentMethod: 'cash' },
});
assert.equal(completed.workOrder.cost, 225000);
assert.equal(completed.expense.amount, 225000);
assert.equal(completed.expense.source, 'maintenance');
assert.equal(getStored(firestore, 'bookkeepingEntries', completed.expense.id).sourceMaintenanceId, created.workOrder.id);

await expectCode(transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('verify-no-condition'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: completed.workOrder.updatedAt, status: 'verified' },
}), 'maintenance_condition_required');

const verified = await transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('verify-amp-1'),
  body: { workOrderId: created.workOrder.id, expectedUpdatedAt: completed.workOrder.updatedAt, status: 'verified', verifiedCondition: 'fair' },
});
assert.equal(verified.workOrder.status, 'verified');
assert.equal(getStored(firestore, 'inventoryItems', 'amp-1').status, 'active');
assert.equal(getStored(firestore, 'inventoryItems', 'amp-1').condition, 'fair');

const cancelledOrder = await createMaintenanceWorkOrder({
  actor, firestore, request: requestFor('create-amp-2'),
  body: { inventoryItemId: 'amp-2', title: 'Inspect broken bass amplifier' },
});
const cancelledTriage = await transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('triage-amp-2'),
  body: { workOrderId: cancelledOrder.workOrder.id, expectedUpdatedAt: cancelledOrder.workOrder.updatedAt, status: 'triaged' },
});
await expectCode(transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('cancel-no-reason'),
  body: { workOrderId: cancelledOrder.workOrder.id, expectedUpdatedAt: cancelledTriage.workOrder.updatedAt, status: 'cancelled' },
}), 'maintenance_reason_required');
const cancelled = await transitionMaintenanceWorkOrder({
  actor, firestore, request: requestFor('cancel-amp-2'),
  body: { workOrderId: cancelledOrder.workOrder.id, expectedUpdatedAt: cancelledTriage.workOrder.updatedAt, status: 'cancelled', reason: 'Laporan dibatalkan oleh Owner.' },
});
assert.equal(cancelled.workOrder.status, 'cancelled');
assert.equal(getStored(firestore, 'inventoryItems', 'amp-2').status, 'broken');
assert.equal(getStored(firestore, 'inventoryItems', 'amp-2').condition, 'broken');

process.stdout.write('✅ Equipment maintenance domain behavior tests passed.\\n');
