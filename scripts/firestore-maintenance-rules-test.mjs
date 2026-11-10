import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  createRepositoryOperationId,
  createRepositoryPayloadHash,
} from '../src/lib/firestoreRepositoryFoundation.js';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run this test through `npm run test:rules`.');
}

const projectId = 'demo-studio37';
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const environment = await initializeTestEnvironment({
  firestore: { rules },
  projectId,
});

const timestamp = '2026-11-10T03:00:00.000Z';
const businessDate = '2026-11-10';
const closingId = businessDate + '__main';
const permissions = (enabled = {}) => ({
  billing: false,
  bookkeeping: false,
  customers: false,
  dashboard: false,
  gallery: false,
  'guard-attendance': false,
  inventory: false,
  notifications: false,
  'operator-fee': false,
  schedule: false,
  settings: false,
  ...enabled,
});

function userProfile(uid, role, enabled = {}) {
  return {
    uid,
    displayName: role === 'owner' ? 'Owner Test' : 'Admin Test',
    email: uid + '@example.com',
    role,
    status: 'approved',
    permissions: permissions(enabled),
  };
}

function inventoryItem(id, updatedAt = timestamp) {
  return {
    id,
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
    updatedAt,
  };
}

function workOrderBase({
  id,
  inventoryItemId,
  status,
  revision,
  updatedAt,
  lastOperationId,
  lastOperationAction,
  lastEventId,
}) {
  return {
    id,
    inventoryItemId,
    itemName: 'Digital Mixer',
    itemCategory: 'studio_gear',
    itemLocation: 'Studio A',
    title: 'Output channel intermittent',
    description: 'Output channel kanan kadang hilang saat volume dinaikkan.',
    priority: 'high',
    status,
    reportedAt: '2026-11-09T08:00:00.000Z',
    reportedByUid: 'inventory-admin',
    reportedByName: 'Admin Test',
    assignedToUid: status === 'completed' ? 'technician-1' : '',
    assignedToName: status === 'completed' ? 'Teknisi Internal' : '',
    plannedAt: '',
    dueAt: '',
    diagnosis: '',
    repairNotes: status === 'completed' ? 'Modul output diganti dan diuji.' : '',
    verificationNote: '',
    verificationCondition: '',
    vendor: '',
    estimatedCost: 0,
    actualCost: 0,
    costEntryId: '',
    attachments: [],
    priorItemStatus: 'active',
    priorItemCondition: 'good',
    revision,
    createdAt: '2026-11-09T08:00:00.000Z',
    updatedAt,
    updatedByUid: 'inventory-admin',
    updatedByName: 'Admin Test',
    lastOperationId,
    lastOperationAction,
    lastEventId,
  };
}

function maintenanceEvent({
  id,
  workOrderId,
  inventoryItemId,
  action,
  operationAction,
  operationId,
  revision,
  fromStatus,
  toStatus,
  actorUid,
  createdAt,
  details = {},
  reason = '',
  actualCost,
  bookkeepingEntryId,
}) {
  return {
    action,
    actorName: actorUid === 'bookkeeping-admin' ? 'Bookkeeping Admin' : 'Admin Test',
    actorUid,
    createdAt,
    details,
    fromStatus,
    id,
    inventoryItemId,
    operationAction,
    operationId,
    reason,
    revision,
    toStatus,
    workOrderId,
    ...(actualCost === undefined ? {} : { actualCost }),
    ...(bookkeepingEntryId ? { bookkeepingEntryId } : {}),
  };
}

async function operationMarker({
  db,
  actorUid,
  action,
  requestId,
  operationId,
  resultId,
}) {
  await setDoc(
    doc(db, 'users', actorUid, 'repositoryOperations', operationId),
    {
      operationId,
      actorUid,
      scope: 'maintenance',
      action,
      requestId,
      payloadHash: await createRepositoryPayloadHash({ action, requestId, resultId }),
      resultCollection: 'maintenanceWorkOrders',
      resultId,
      createdAt: serverTimestamp(),
    },
  );
}

try {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'adminControl', 'ownership'), {
      currentOwnerUid: 'owner-1',
      initializedAt: timestamp,
      updatedAt: timestamp,
    });
    await setDoc(doc(db, 'users', 'owner-1'), userProfile('owner-1', 'owner'));
    await setDoc(doc(db, 'users', 'inventory-admin'), userProfile('inventory-admin', 'admin', {
      inventory: true,
    }));
    await setDoc(doc(db, 'users', 'bookkeeping-admin'), userProfile('bookkeeping-admin', 'admin', {
      bookkeeping: true,
    }));
    await setDoc(doc(db, 'inventoryItems', 'maintenance-report-item'), inventoryItem('maintenance-report-item'));
    await setDoc(doc(db, 'inventoryItems', 'maintenance-cost-item'), {
      ...inventoryItem('maintenance-cost-item'),
      status: 'maintenance',
      condition: 'maintenance',
      activeMaintenanceWorkOrderId: 'mwo-cost-fixture',
      lastMaintenanceWorkOrderId: 'mwo-cost-fixture',
      updatedAt: '2026-11-09T08:00:00.000Z',
    });
    await setDoc(
      doc(db, 'maintenanceWorkOrders', 'mwo-cost-fixture'),
      {
        ...workOrderBase({
          id: 'mwo-cost-fixture',
          inventoryItemId: 'maintenance-cost-item',
          status: 'completed',
          revision: 8,
          updatedAt: '2026-11-09T08:00:00.000Z',
          lastOperationId: 'v1_' + 'a'.repeat(64),
          lastOperationAction: 'complete',
          lastEventId: 'mwe-cost-fixture',
        }),
        assignedToUid: 'technician-1',
        assignedToName: 'Teknisi Internal',
        completedAt: '2026-11-09T08:00:00.000Z',
        completedByUid: 'inventory-admin',
        completedByName: 'Admin Test',
      },
    );
    await setDoc(doc(db, 'cashClosingSessions', closingId), {
      id: closingId,
      businessDate,
      registerId: 'main',
      status: 'open',
      activityRevision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActivityAt: timestamp,
      lastActivityByUid: '',
      lastOperationId: '',
      lastOperationAction: '',
      lastBookingId: '',
      lastLedgerEntryId: '',
      lastProofId: '',
    });
  });

  const inventoryDb = environment.authenticatedContext('inventory-admin').firestore();
  const bookkeepingDb = environment.authenticatedContext('bookkeeping-admin').firestore();

  // Report creates a WorkOrder, exact event, equipment lock and immutable operation marker atomically.
  const reportRequestId = 'maintenance-report-rules-001';
  const reportOperationId = await createRepositoryOperationId({
    actorUid: 'inventory-admin',
    scope: 'maintenance',
    action: 'report',
    requestId: reportRequestId,
  });
  const reportWorkOrderId = 'mwo_' + reportOperationId.slice(3);
  const reportEventId = 'mwe_' + reportOperationId.slice(3);
  const reportAt = '2026-11-10T03:10:00.000Z';
  const reportWorkOrder = workOrderBase({
    id: reportWorkOrderId,
    inventoryItemId: 'maintenance-report-item',
    status: 'reported',
    revision: 1,
    updatedAt: reportAt,
    lastOperationId: reportOperationId,
    lastOperationAction: 'report',
    lastEventId: reportEventId,
  });
  reportWorkOrder.reportedAt = reportAt;
  reportWorkOrder.reportedByUid = 'inventory-admin';
  reportWorkOrder.reportedByName = 'Admin Test';
  reportWorkOrder.createdAt = reportAt;
  reportWorkOrder.updatedByUid = 'inventory-admin';
  reportWorkOrder.updatedByName = 'Admin Test';
  const reportEvent = maintenanceEvent({
    id: reportEventId,
    workOrderId: reportWorkOrderId,
    inventoryItemId: 'maintenance-report-item',
    action: 'reported',
    operationAction: 'report',
    operationId: reportOperationId,
    revision: 1,
    fromStatus: '',
    toStatus: 'reported',
    actorUid: 'inventory-admin',
    createdAt: reportAt,
    details: {
      title: reportWorkOrder.title,
      priority: reportWorkOrder.priority,
      itemName: reportWorkOrder.itemName,
    },
  });
  const reportItem = {
    ...inventoryItem('maintenance-report-item'),
    status: 'maintenance',
    condition: 'maintenance',
    activeMaintenanceWorkOrderId: reportWorkOrderId,
    lastMaintenanceWorkOrderId: reportWorkOrderId,
    updatedAt: reportAt,
  };
  const reportBatch = writeBatch(inventoryDb);
  reportBatch.set(doc(inventoryDb, 'inventoryItems', reportItem.id), reportItem);
  reportBatch.set(doc(inventoryDb, 'maintenanceWorkOrders', reportWorkOrderId), reportWorkOrder);
  reportBatch.set(doc(inventoryDb, 'maintenanceEvents', reportEventId), reportEvent);
  reportBatch.set(
    doc(inventoryDb, 'users', 'inventory-admin', 'repositoryOperations', reportOperationId),
    {
      operationId: reportOperationId,
      actorUid: 'inventory-admin',
      scope: 'maintenance',
      action: 'report',
      requestId: reportRequestId,
      payloadHash: await createRepositoryPayloadHash({
        inventoryItemId: 'maintenance-report-item',
        title: reportWorkOrder.title,
        description: reportWorkOrder.description,
        priority: reportWorkOrder.priority,
      }),
      resultCollection: 'maintenanceWorkOrders',
      resultId: reportWorkOrderId,
      createdAt: serverTimestamp(),
    },
  );
  await assertSucceeds(reportBatch.commit());

  const savedReport = await getDoc(doc(inventoryDb, 'maintenanceWorkOrders', reportWorkOrderId));
  const savedReportItem = await getDoc(doc(inventoryDb, 'inventoryItems', reportItem.id));
  assert.equal(savedReport.data().status, 'reported');
  assert.equal(savedReportItem.data().activeMaintenanceWorkOrderId, reportWorkOrderId);

  // A lifecycle action requires a valid revision, event, operation marker and linked equipment state.
  const triageRequestId = 'maintenance-triage-rules-001';
  const triageOperationId = await createRepositoryOperationId({
    actorUid: 'inventory-admin',
    scope: 'maintenance',
    action: 'triage',
    requestId: triageRequestId,
  });
  const triageEventId = 'mwe_' + triageOperationId.slice(3);
  const triageAt = '2026-11-10T03:15:00.000Z';
  const triagedWorkOrder = {
    ...savedReport.data(),
    status: 'triaged',
    revision: 2,
    diagnosis: 'Output connector perlu pemeriksaan ulang.',
    priority: 'urgent',
    triagedAt: triageAt,
    triagedByUid: 'inventory-admin',
    triagedByName: 'Admin Test',
    updatedAt: triageAt,
    updatedByUid: 'inventory-admin',
    updatedByName: 'Admin Test',
    lastOperationId: triageOperationId,
    lastOperationAction: 'triage',
    lastEventId: triageEventId,
  };
  const triagedEvent = maintenanceEvent({
    id: triageEventId,
    workOrderId: reportWorkOrderId,
    inventoryItemId: 'maintenance-report-item',
    action: 'triage',
    operationAction: 'triage',
    operationId: triageOperationId,
    revision: 2,
    fromStatus: 'reported',
    toStatus: 'triaged',
    actorUid: 'inventory-admin',
    createdAt: triageAt,
    details: {
      diagnosis: triagedWorkOrder.diagnosis,
      priority: triagedWorkOrder.priority,
    },
  });
  const triagedItem = {
    ...savedReportItem.data(),
    updatedAt: triageAt,
  };
  const triageBatch = writeBatch(inventoryDb);
  triageBatch.set(doc(inventoryDb, 'maintenanceWorkOrders', reportWorkOrderId), triagedWorkOrder);
  triageBatch.set(doc(inventoryDb, 'maintenanceEvents', triageEventId), triagedEvent);
  triageBatch.set(doc(inventoryDb, 'inventoryItems', reportItem.id), triagedItem);
  triageBatch.set(
    doc(inventoryDb, 'users', 'inventory-admin', 'repositoryOperations', triageOperationId),
    {
      operationId: triageOperationId,
      actorUid: 'inventory-admin',
      scope: 'maintenance',
      action: 'triage',
      requestId: triageRequestId,
      payloadHash: await createRepositoryPayloadHash({ action: 'triage', workOrderId: reportWorkOrderId }),
      resultCollection: 'maintenanceWorkOrders',
      resultId: reportWorkOrderId,
      createdAt: serverTimestamp(),
    },
  );
  await assertSucceeds(triageBatch.commit());

  await assertFails(updateDoc(doc(inventoryDb, 'maintenanceWorkOrders', reportWorkOrderId), {
    status: 'verified',
  }));
  await assertFails(updateDoc(doc(inventoryDb, 'maintenanceEvents', reportEventId), {
    reason: 'History tampering',
  }));
  await assertFails(updateDoc(doc(inventoryDb, 'bookkeepingEntries', 'maintenance-ledger-missing'), {
    amount: 1,
  }));

  // Maintenance costs update the WorkOrder, append an event, post an immutable ledger row,
  // update the Daily Closing fence and add the operation marker in one batch.
  const costRequestId = 'maintenance-cost-rules-001';
  const costOperationId = await createRepositoryOperationId({
    actorUid: 'bookkeeping-admin',
    scope: 'maintenance',
    action: 'cost',
    requestId: costRequestId,
  });
  const costEventId = 'mwe_' + costOperationId.slice(3);
  const costEntryId = 'mce_' + costOperationId.slice(3);
  const costAt = '2026-11-10T03:20:00.000Z';
  const costAmount = 275000;
  const costWorkOrderRef = doc(bookkeepingDb, 'maintenanceWorkOrders', 'mwo-cost-fixture');
  const costWorkOrderSnapshot = await getDoc(costWorkOrderRef);
  const currentCostWorkOrder = costWorkOrderSnapshot.data();
  const nextCostWorkOrder = {
    ...currentCostWorkOrder,
    actualCost: costAmount,
    costEntryId,
    costRecordedAt: costAt,
    costRecordedByUid: 'bookkeeping-admin',
    costRecordedByName: 'Bookkeeping Admin',
    revision: currentCostWorkOrder.revision + 1,
    updatedAt: costAt,
    updatedByUid: 'bookkeeping-admin',
    updatedByName: 'Bookkeeping Admin',
    lastOperationId: costOperationId,
    lastOperationAction: 'cost',
    lastEventId: costEventId,
  };
  const costEvent = maintenanceEvent({
    id: costEventId,
    workOrderId: 'mwo-cost-fixture',
    inventoryItemId: 'maintenance-cost-item',
    action: 'cost_recorded',
    operationAction: 'cost',
    operationId: costOperationId,
    revision: nextCostWorkOrder.revision,
    fromStatus: 'completed',
    toStatus: 'completed',
    actorUid: 'bookkeeping-admin',
    createdAt: costAt,
    details: {
      amount: costAmount,
      date: businessDate,
      paymentMethod: 'transfer',
      note: 'Invoice servis modul output.',
    },
    reason: 'Invoice servis modul output.',
    actualCost: costAmount,
    bookkeepingEntryId: costEntryId,
  });
  const costEntry = {
    id: costEntryId,
    type: 'expense',
    category: 'maintenance',
    title: 'Biaya maintenance Digital Mixer',
    amount: costAmount,
    date: businessDate,
    paymentMethod: 'transfer',
    note: 'Invoice servis modul output.',
    source: 'maintenance',
    sourceWorkOrderId: 'mwo-cost-fixture',
    sourceEventId: costEventId,
    sourceAction: 'maintenance_cost',
    actorName: 'Bookkeeping Admin',
    actorUid: 'bookkeeping-admin',
    idempotencyKey: costRequestId,
    immutable: true,
    reversalOf: '',
    operationId: costOperationId,
    createdAt: costAt,
    updatedAt: costAt,
  };
  const currentFence = (await getDoc(doc(bookkeepingDb, 'cashClosingSessions', closingId))).data();
  const nextFence = {
    ...currentFence,
    activityRevision: currentFence.activityRevision + 1,
    updatedAt: costAt,
    lastActivityAt: costAt,
    lastActivityByUid: 'bookkeeping-admin',
    lastOperationId: costOperationId,
    lastOperationAction: 'maintenance-cost',
    lastLedgerEntryId: costEntryId,
  };
  const costBatch = writeBatch(bookkeepingDb);
  costBatch.set(costWorkOrderRef, nextCostWorkOrder);
  costBatch.set(doc(bookkeepingDb, 'maintenanceEvents', costEventId), costEvent);
  costBatch.set(doc(bookkeepingDb, 'bookkeepingEntries', costEntryId), costEntry);
  costBatch.set(doc(bookkeepingDb, 'cashClosingSessions', closingId), nextFence);
  costBatch.set(
    doc(bookkeepingDb, 'users', 'bookkeeping-admin', 'repositoryOperations', costOperationId),
    {
      operationId: costOperationId,
      actorUid: 'bookkeeping-admin',
      scope: 'maintenance',
      action: 'cost',
      requestId: costRequestId,
      payloadHash: await createRepositoryPayloadHash({
        workOrderId: 'mwo-cost-fixture',
        amount: costAmount,
        paymentMethod: 'transfer',
        date: businessDate,
        note: costEntry.note,
      }),
      resultCollection: 'maintenanceWorkOrders',
      resultId: 'mwo-cost-fixture',
      createdAt: serverTimestamp(),
    },
  );
  await assertSucceeds(costBatch.commit());

  const savedCostWorkOrder = await getDoc(costWorkOrderRef);
  const savedCostEntry = await getDoc(doc(bookkeepingDb, 'bookkeepingEntries', costEntryId));
  assert.equal(savedCostWorkOrder.data().costEntryId, costEntryId);
  assert.equal(savedCostWorkOrder.data().actualCost, costAmount);
  assert.equal(savedCostEntry.data().sourceWorkOrderId, 'mwo-cost-fixture');
  await assertFails(updateDoc(doc(bookkeepingDb, 'bookkeepingEntries', costEntryId), {
    note: 'Tampered maintenance ledger',
  }));

  console.log('Firestore Maintenance direct-write Rules test passed.');
} finally {
  await environment.cleanup();
}
