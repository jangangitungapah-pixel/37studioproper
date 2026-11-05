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


function cleanInventoryItem(body, previous = null) {
  const name = cleanText(body.name, 160);
  if (name.length < 2) throw new HttpError(400, 'item_name_required', 'Nama item minimal 2 karakter.');
  const quantity = finiteQuantity(body.quantity ?? previous?.quantity ?? 0, 'Jumlah stok');
  const minStock = finiteQuantity(body.minStock ?? previous?.minStock ?? 0, 'Minimal stok');
  if (quantity < 0 || quantity > 1_000_000 || minStock < 0 || minStock > 1_000_000) {
    throw new HttpError(400, 'invalid_stock_value', 'Jumlah stok di luar batas operasional.');
  }
  const category = cleanText(body.category || previous?.category || 'other', 60);
  const type = cleanText(body.type || previous?.type || 'asset', 40);
  const unit = cleanText(body.unit || previous?.unit || 'pcs', 40);
  const condition = cleanText(body.condition || previous?.condition || 'good', 40);
  const status = cleanText(body.status || previous?.status || 'active', 40);
  if (!['asset', 'consumable'].includes(type)) throw new HttpError(400, 'invalid_item_type', 'Tipe item tidak valid.');
  if (!['good', 'fair', 'maintenance', 'broken'].includes(condition)) throw new HttpError(400, 'invalid_condition', 'Kondisi item tidak valid.');
  if (!['active', 'maintenance', 'broken', 'lost', 'inactive'].includes(status)) throw new HttpError(400, 'invalid_item_status', 'Status item tidak valid.');
  return {
    id: previous?.id || cleanText(body.id, 160),
    name, category, type, quantity, unit, minStock, condition, status,
    location: cleanText(body.location, 160),
    note: cleanText(body.note, 1000),
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function writeInventoryMetadata({ actor, body, firestore, request, archive = false }) {
  const key = getIdempotencyKey(request, body);
  const operationType = archive ? 'inventory-archive' : 'inventory-save';
  const existing = await readOperationResult(firestore, operationType, key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const itemId = cleanText(body.itemId || body.id, 160);
  const current = itemId ? await firestore.getDocument('inventoryItems', itemId) : null;
  if (archive && !current) throw new HttpError(404, 'item_not_found', 'Inventory item tidak ditemukan.');
  if (itemId && !current) throw new HttpError(404, 'item_not_found', 'Inventory item tidak ditemukan.');

  if (current && body.expectedUpdatedAt && body.expectedUpdatedAt !== current.data.updatedAt) {
    throw new HttpError(409, 'item_changed', 'Inventory berubah sejak terakhir dibuka. Muat ulang sebelum menyimpan.');
  }

  const previous = current ? { id: current.id, ...current.data } : null;
  const nextItem = archive
    ? { ...previous, status: 'inactive', updatedAt: new Date().toISOString() }
    : cleanInventoryItem(body, previous);
  const now = nextItem.updatedAt;
  const movementId = await stableDocumentId('movement', `${nextItem.id}:${key}`);
  const movement = {
    id: movementId,
    itemId: nextItem.id,
    itemName: nextItem.name,
    type: archive ? 'inactive' : (previous ? 'edit' : 'create'),
    quantity: nextItem.quantity,
    previousQuantity: previous?.quantity ?? nextItem.quantity,
    nextQuantity: nextItem.quantity,
    unit: nextItem.unit,
    note: archive ? cleanText(body.reason || 'Item dinonaktifkan', 600) : (previous ? 'Update data inventory' : 'Item baru ditambahkan'),
    reason: cleanText(body.reason || (archive ? 'Item dinonaktifkan' : 'Metadata inventory diperbarui'), 600),
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now,
  };
  const result = { item: nextItem, movement };
  const writes = [
    firestore.setWrite('inventoryItems', nextItem.id, nextItem, current ? { updateTime: current.updateTime } : { exists: false }),
    firestore.setWrite('inventoryMovements', movementId, movement, { exists: false }),
  ];
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      item: { collectionId: 'inventoryItems', documentId: nextItem.id },
      movement: { collectionId: 'inventoryMovements', documentId: movementId },
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: nextItem.id,
    type: operationType,
    writes,
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export function saveInventoryItem(input) {
  return writeInventoryMetadata(input);
}

export function archiveInventoryItem(input) {
  return writeInventoryMetadata({ ...input, archive: true }, true);
}
