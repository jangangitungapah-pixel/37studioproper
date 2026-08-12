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
    firestore,
    key,
    result,
    targetId: itemId,
    type: 'inventory-adjust',
    writes: [
      firestore.setWrite('inventoryItems', itemId, nextItem, { updateTime: itemDocument.updateTime }),
      firestore.setWrite('inventoryMovements', movementId, movement, { exists: false }),
    ],
  });

  return { ...committed.result, duplicate: committed.duplicate };
}
