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

async function assertNoActiveMaintenance(firestore, itemId, message) {
  const rows = await firestore.runQuery({
    from: [{ collectionId: 'maintenanceWorkOrders' }],
    limit: 100,
    where: {
      fieldFilter: {
        field: { fieldPath: 'inventoryItemId' },
        op: 'EQUAL',
        value: { stringValue: itemId },
      },
    },
  });
  const active = rows.find((row) => [
    'reported', 'triaged', 'approved', 'assigned', 'in_progress',
    'waiting_parts', 'completed',
  ].includes(String(row.data?.status || '')));
  if (active) throw new HttpError(409, 'equipment_maintenance_locked', message);
}

function normalizeInventoryMetadata(body, current = {}) {
  const name = cleanText(body.name, 160);
  const category = cleanText(body.category, 80);
  const itemType = cleanText(body.type, 40);
  const unit = cleanText(body.unit, 40);
  const condition = cleanText(body.condition, 40);
  const status = cleanText(body.status, 40);
  const location = cleanText(body.location, 240);
  const note = cleanText(body.note, 2000);
  const minStock = finiteQuantity(body.minStock, 'Minimal stok');
  if (!name || !category || !itemType || !unit || !condition || !status) {
    throw new HttpError(400, 'invalid_item', 'Nama, kategori, tipe, satuan, kondisi, dan status wajib diisi.');
  }
  if (minStock < 0 || minStock > 1000000) {
    throw new HttpError(400, 'invalid_min_stock', 'Minimal stok berada di luar batas operasional.');
  }
  return { ...current, category, condition, location, minStock, name, note, status, type: itemType, unit };
}

export async function saveInventoryItem({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const isCreate = body.action === 'create';
  const itemId = cleanText(body.itemId, 160);
  const type = isCreate ? 'inventory-item-create' : 'inventory-item-update';
  if (!isCreate && !itemId) throw new HttpError(400, 'item_required', 'Inventory item wajib dipilih.');
  if (isCreate && itemId) throw new HttpError(400, 'invalid_item_id', 'ID item baru dibuat oleh server.');
  const existing = await readOperationResult(firestore, type, key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const itemDocument = isCreate ? null : await firestore.getDocument('inventoryItems', itemId);
  if (!isCreate && !itemDocument) throw new HttpError(404, 'item_not_found', 'Inventory item tidak ditemukan.');
  const now = new Date().toISOString();
  const id = isCreate ? await stableDocumentId('inventory', key) : itemId;
  const current = itemDocument ? { id: itemDocument.id, ...itemDocument.data } : {};
  const metadata = normalizeInventoryMetadata(body, current);
  if (!isCreate && (metadata.status !== current.status || metadata.condition !== current.condition)) {
    await assertNoActiveMaintenance(
      firestore,
      itemId,
      'Status/kondisi equipment dikunci selama work order belum Verified atau Cancelled.',
    );
  }
  const quantity = isCreate ? finiteQuantity(body.quantity, 'Stok awal') : finiteQuantity(current.quantity || 0, 'Stok saat ini');
  if (quantity < 0 || quantity > 1000000) throw new HttpError(400, 'invalid_quantity', 'Stok berada di luar batas operasional.');
  if (!isCreate && body.quantity !== undefined && Number(body.quantity) !== quantity) {
    throw new HttpError(400, 'stock_write_forbidden', 'Perubahan jumlah stok harus memakai adjustment inventory.');
  }
  const item = { ...metadata, createdAt: isCreate ? now : current.createdAt, id, quantity, updatedAt: now };
  const movementId = await stableDocumentId('movement', id + ':' + key);
  const reason = cleanText(body.reason, 600) || (isCreate ? 'Item baru ditambahkan' : 'Metadata inventory diperbarui');
  const movement = {
    actorName: actor.displayName, actorUid: actor.uid, createdAt: now, id: movementId,
    itemId: id, itemName: item.name, nextQuantity: quantity, note: reason,
    previousQuantity: isCreate ? 0 : quantity, quantity: isCreate ? quantity : 0,
    reason, type: isCreate ? 'create' : 'edit', unit: item.unit,
    metadataSnapshot: { category: item.category, condition: item.condition, location: item.location, minStock: item.minStock, name: item.name, note: item.note, status: item.status, type: item.type, unit: item.unit },
  };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { item: { collectionId: 'inventoryItems', documentId: id }, movement: { collectionId: 'inventoryMovements', documentId: movementId } },
    firestore, key, receipt: {}, result: { item, movement }, targetId: id, type,
    writes: [
      firestore.setWrite('inventoryItems', id, item, isCreate ? { exists: false } : { updateTime: itemDocument.updateTime }),
      firestore.setWrite('inventoryMovements', movementId, movement, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function archiveInventoryItem({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const itemId = cleanText(body.itemId, 160);
  if (!itemId) throw new HttpError(400, 'item_required', 'Inventory item wajib dipilih.');
  const type = 'inventory-item-archive';
  const existing = await readOperationResult(firestore, type, key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const itemDocument = await firestore.getDocument('inventoryItems', itemId);
  if (!itemDocument) throw new HttpError(404, 'item_not_found', 'Inventory item tidak ditemukan.');
  const current = { id: itemDocument.id, ...itemDocument.data };
  await assertNoActiveMaintenance(firestore, itemId, 'Equipment dengan work order aktif tidak dapat diarsipkan.');
  if (current.status === 'inactive') throw new HttpError(409, 'already_archived', 'Item sudah dinonaktifkan.');
  const now = new Date().toISOString();
  const item = { ...current, status: 'inactive', updatedAt: now };
  const movementId = await stableDocumentId('movement', itemId + ':' + key);
  const movement = {
    actorName: actor.displayName, actorUid: actor.uid, createdAt: now, id: movementId,
    itemId, itemName: cleanText(item.name, 160), nextQuantity: Number(item.quantity || 0),
    note: 'Item dinonaktifkan', previousQuantity: Number(item.quantity || 0),
    quantity: 0, reason: 'Item dinonaktifkan', type: 'inactive', unit: cleanText(item.unit, 40),
    previousMetadata: { status: current.status, condition: current.condition },
    nextMetadata: { status: 'inactive', condition: current.condition },
  };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { item: { collectionId: 'inventoryItems', documentId: itemId }, movement: { collectionId: 'inventoryMovements', documentId: movementId } },
    firestore, key, receipt: {}, result: { item, movement }, targetId: itemId, type,
    writes: [
      firestore.setWrite('inventoryItems', itemId, item, { updateTime: itemDocument.updateTime }),
      firestore.setWrite('inventoryMovements', movementId, movement, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
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
