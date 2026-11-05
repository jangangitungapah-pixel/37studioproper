import { HttpError, cleanText, getIdempotencyKey } from '../lib/http.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';
import { stableDocumentId } from '../lib/firestore.js';

function finiteQuantity(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, 'invalid_quantity', `${label} tidak valid.`);
  }

  return Math.round(parsed * 1000) / 1000;
}

export async function adjustInventory({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'inventory-adjust', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const itemId = cleanText(body.itemId, 160);
  const reason = cleanText(body.reason || body.note, 600);
  const delta = finiteQuantity(body.delta, 'Perubahan stok');

  if (!itemId) throw new HttpError(400, 'item_required', 'Inventory item wajib dipilih.');
  if (!delta) throw new HttpError(400, 'delta_required', 'Perubahan stok tidak boleh nol.');
  if (reason.length < 4) {
    throw new HttpError(400, 'reason_required', 'Alasan adjustment minimal 4 karakter.');
  }

  const itemDocument = await firestore.getDocument('inventoryItems', itemId);
  if (!itemDocument) throw new HttpError(404, 'item_not_found', 'Inventory item tidak ditemukan.');

  const item = { id: itemDocument.id, ...itemDocument.data };
  const previousQuantity = finiteQuantity(item.quantity || 0, 'Stok saat ini');
  const nextQuantity = finiteQuantity(previousQuantity + delta, 'Stok hasil');

  if (nextQuantity < 0) {
    throw new HttpError(
      400,
      'negative_stock',
      'Adjustment ditolak karena stok akan menjadi negatif.',
      { available: previousQuantity },
    );
  }

  if (nextQuantity > 1_000_000) {
    throw new HttpError(400, 'stock_limit', 'Stok hasil melebihi batas operasional.');
  }

  const now = new Date().toISOString();
  const movementId = await stableDocumentId('movement', `${itemId}:${key}`);
  const movement = {
    actorName: actor.displayName,
    actorUid: actor.uid,
    adjustmentKey: key,
    createdAt: now,
    id: movementId,
    itemId,
    itemName: cleanText(item.name || 'Inventory Item', 160),
    nextQuantity,
    note: reason,
    previousQuantity,
    quantity: Math.abs(delta),
    reason,
    type: delta > 0 ? 'stock-in' : 'stock-out',
    unit: cleanText(item.unit || 'pcs', 40),
  };
  const nextItem = { ...item, quantity: nextQuantity, updatedAt: now };
  const result = { item: nextItem, movement };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      item: { collectionId: 'inventoryItems', documentId: itemId },
      movement: { collectionId: 'inventoryMovements', documentId: movementId },
    },
    firestore,
    key,
    result,
    receipt: {},
    targetId: itemId,
    type: 'inventory-adjust',
    writes: [
      firestore.setWrite('inventoryItems', itemId, nextItem, { updateTime: itemDocument.updateTime }),
      firestore.setWrite('inventoryMovements', movementId, movement, { exists: false }),
    ],
  });

  return { ...committed.result, duplicate: committed.duplicate };
}

const MAINTENANCE_STATUSES = Object.freeze([
  'reported', 'triaged', 'assigned', 'in_progress', 'waiting_parts', 'completed', 'verified', 'cancelled',
]);

function maintenanceActor(actor) {
  return { actorUid: actor.uid, actorName: actor.displayName };
}

export async function createMaintenanceWorkOrder({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'maintenance-create', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const itemId = cleanText(body.inventoryItemId, 160);
  if (!itemId) throw new HttpError(400, 'inventory_item_required', 'Pilih alat yang akan diperiksa.');
  const itemDocument = await firestore.getDocument('inventoryItems', itemId);
  if (!itemDocument) throw new HttpError(404, 'inventory_item_not_found', 'Item inventory tidak ditemukan.');
  const item = { id: itemDocument.id, ...itemDocument.data };
  const title = cleanText(body.title, 160);
  if (title.length < 3) throw new HttpError(400, 'maintenance_title_required', 'Judul laporan minimal 3 karakter.');
  const priority = cleanText(body.priority || 'normal', 20);
  if (!['low', 'normal', 'high', 'urgent'].includes(priority)) throw new HttpError(400, 'invalid_priority', 'Prioritas maintenance tidak valid.');
  const now = new Date().toISOString();
  const id = await stableDocumentId('maintenance', key);
  const workOrder = {
    id, inventoryItemId: itemId, inventoryItemName: cleanText(item.name, 160),
    title, description: cleanText(body.description, 2000), priority,
    status: 'reported', reportedAt: now, reportedByUid: actor.uid, reportedByName: actor.displayName,
    assignedToUid: '', assignedToName: '', dueAt: cleanText(body.dueAt, 80),
    diagnosis: '', resolution: '', partsRequired: '', cost: 0,
    expenseEntryId: '', verifiedAt: '', verifiedByUid: '',
    createdAt: now, updatedAt: now,
  };
  const nextItem = { ...item, condition: item.condition === 'broken' ? 'broken' : 'maintenance', status: 'maintenance', updatedAt: now };
  const movementId = await stableDocumentId('movement', `maintenance-report:${id}`);
  const movement = {
    id: movementId, itemId, itemName: item.name, type: 'maintenance',
    quantity: item.quantity || 0, previousQuantity: item.quantity || 0, nextQuantity: item.quantity || 0,
    unit: cleanText(item.unit || 'pcs', 40), note: title, reason: 'Perangkat masuk antrean maintenance',
    actorUid: actor.uid, actorName: actor.displayName, createdAt: now,
  };
  const eventId = await stableDocumentId('maintenance-event', `${id}:reported`);
  const event = { id: eventId, workOrderId: id, inventoryItemId: itemId, action: 'reported', fromStatus: '', toStatus: 'reported', ...maintenanceActor(actor), createdAt: now, note: title };
  const result = { workOrder, item: nextItem, event };
  const committed = await commitIdempotentOperation({
    actor, documentRefs: {
      workOrder: { collectionId: 'maintenanceWorkOrders', documentId: id },
      item: { collectionId: 'inventoryItems', documentId: itemId },
      event: { collectionId: 'maintenanceEvents', documentId: eventId },
      movement: { collectionId: 'inventoryMovements', documentId: movementId },
    },
    firestore, key, receipt: {}, result, targetId: id, type: 'maintenance-create',
    writes: [
      firestore.setWrite('maintenanceWorkOrders', id, workOrder, { exists: false }),
      firestore.setWrite('inventoryItems', itemId, nextItem, { updateTime: itemDocument.updateTime }),
      firestore.setWrite('maintenanceEvents', eventId, event, { exists: false }),
      firestore.setWrite('inventoryMovements', movementId, movement, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function transitionMaintenanceWorkOrder({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'maintenance-transition', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const id = cleanText(body.workOrderId || body.id, 160);
  const current = await firestore.getDocument('maintenanceWorkOrders', id);
  if (!current) throw new HttpError(404, 'maintenance_not_found', 'Work order tidak ditemukan.');
  const order = { id: current.id, ...current.data };
  if (body.expectedUpdatedAt && body.expectedUpdatedAt !== order.updatedAt) {
    throw new HttpError(409, 'maintenance_changed', 'Work order berubah. Muat ulang sebelum menyimpan.');
  }
  const targetStatus = cleanText(body.status, 40);
  if (!MAINTENANCE_STATUSES.includes(targetStatus)) throw new HttpError(400, 'invalid_maintenance_status', 'Status maintenance tidak valid.');
  const allowed = {
    reported: ['triaged', 'cancelled'],
    triaged: ['assigned', 'in_progress', 'cancelled'],
    assigned: ['in_progress', 'waiting_parts', 'cancelled'],
    in_progress: ['waiting_parts', 'completed', 'cancelled'],
    waiting_parts: ['in_progress', 'cancelled'],
    completed: ['verified', 'in_progress'],
    verified: [],
    cancelled: [],
  };
  if (targetStatus === order.status && ['reported', 'triaged', 'assigned', 'in_progress', 'waiting_parts'].includes(order.status)) {
    // Details may be saved without changing the workflow state.
  } else if (!allowed[order.status]?.includes(targetStatus)) {
    throw new HttpError(409, 'invalid_maintenance_transition', 'Perubahan status maintenance tidak diizinkan.');
  }
  if (targetStatus === 'verified' && !['owner', 'admin'].includes(actor.role)) {
    throw new HttpError(403, 'maintenance_verification_forbidden', 'Verifikasi harus dilakukan Admin atau Owner.');
  }
  const reason = cleanText(body.reason || body.note, 800);
  if (targetStatus === 'cancelled' && reason.length < 4) {
    throw new HttpError(400, 'maintenance_reason_required', 'Alasan pembatalan minimal 4 karakter.');
  }
  const now = new Date().toISOString();
  const next = {
    ...order,
    status: targetStatus,
    assignedToUid: targetStatus === 'assigned' ? cleanText(body.assignedToUid, 128) : order.assignedToUid,
    assignedToName: targetStatus === 'assigned' ? cleanText(body.assignedToName, 120) : order.assignedToName,
    dueAt: Object.hasOwn(body, 'dueAt') ? cleanText(body.dueAt, 80) : order.dueAt,
    diagnosis: Object.hasOwn(body, 'diagnosis') ? cleanText(body.diagnosis, 2000) : order.diagnosis,
    resolution: Object.hasOwn(body, 'resolution') ? cleanText(body.resolution, 2000) : order.resolution,
    partsRequired: Object.hasOwn(body, 'partsRequired') ? cleanText(body.partsRequired, 1200) : order.partsRequired,
    updatedAt: now,
    ...(targetStatus === 'verified' ? { verifiedAt: now, verifiedByUid: actor.uid, verifiedByName: actor.displayName } : {}),
    ...(targetStatus === 'cancelled' ? { cancelledAt: now, cancelledByUid: actor.uid, cancelReason: reason } : {}),
  };
  const itemDocument = await firestore.getDocument('inventoryItems', order.inventoryItemId);
  if (!itemDocument) throw new HttpError(404, 'inventory_item_not_found', 'Item inventory tidak ditemukan.');
  const item = { id: itemDocument.id, ...itemDocument.data };
  const itemStatus = targetStatus === 'cancelled' || targetStatus === 'verified' ? 'active' : 'maintenance';
  const itemCondition = targetStatus === 'verified' ? 'good' : targetStatus === 'cancelled' ? (item.condition === 'maintenance' ? 'good' : item.condition) : 'maintenance';
  const nextItem = { ...item, status: itemStatus, condition: itemCondition, updatedAt: now };
  const eventId = await stableDocumentId('maintenance-event', `${id}:${key}`);
  const event = { id: eventId, workOrderId: id, inventoryItemId: order.inventoryItemId, action: 'status_change', fromStatus: order.status, toStatus: targetStatus, reason, ...maintenanceActor(actor), createdAt: now };
  const writes = [
    firestore.setWrite('maintenanceWorkOrders', id, next, { updateTime: current.updateTime }),
    firestore.setWrite('inventoryItems', item.id, nextItem, { updateTime: itemDocument.updateTime }),
    firestore.setWrite('maintenanceEvents', eventId, event, { exists: false }),
  ];
  let expense = null;
  if (Object.hasOwn(body, 'cost')) {
    const cost = Number(body.cost);
    if (!Number.isFinite(cost) || cost < 0 || cost > 1_000_000_000) throw new HttpError(400, 'maintenance_cost_invalid', 'Biaya maintenance tidak valid.');
    if (targetStatus !== 'completed') throw new HttpError(409, 'maintenance_cost_stage_invalid', 'Biaya dicatat saat pekerjaan selesai.');
    if (order.expenseEntryId) throw new HttpError(409, 'maintenance_expense_exists', 'Biaya work order ini sudah diposting.');
    next.cost = Math.round(cost);
    if (cost > 0) {
      const expenseId = await stableDocumentId('maintenance-expense', id);
      expense = {
        id: expenseId, type: 'expense', category: 'maintenance',
        title: `Maintenance: ${order.inventoryItemName}`, amount: Math.round(cost),
        date: now.slice(0, 10), paymentMethod: cleanText(body.paymentMethod || 'cash', 40),
        note: cleanText(body.expenseNote || order.title, 1000), source: 'maintenance',
        sourceMaintenanceId: id, sourceAction: 'completed', sourceEventId: eventId,
        actorUid: actor.uid, actorName: actor.displayName, immutable: true,
        createdAt: now, updatedAt: now,
      };
      next.expenseEntryId = expenseId;
      writes.push(firestore.setWrite('bookkeepingEntries', expenseId, expense, { exists: false }));
    }
  }
  const result = { workOrder: next, item: nextItem, event, expense };
  const committed = await commitIdempotentOperation({
    actor, documentRefs: {
      workOrder: { collectionId: 'maintenanceWorkOrders', documentId: id },
      item: { collectionId: 'inventoryItems', documentId: item.id },
      event: { collectionId: 'maintenanceEvents', documentId: eventId },
      ...(expense ? { expense: { collectionId: 'bookkeepingEntries', documentId: expense.id } } : {}),
    },
    firestore, key, receipt: {}, result, targetId: id, type: 'maintenance-transition', writes,
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
