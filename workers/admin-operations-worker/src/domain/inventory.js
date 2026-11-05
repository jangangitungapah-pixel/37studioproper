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
    limit: 500,
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


const PURCHASE_ORDER_STATUSES = Object.freeze([
  'draft',
  'submitted',
  'approved',
  'ordered',
  'partially_received',
  'received',
  'cancelled',
]);

function procurementDate(value, label, { optional = false } = {}) {
  const date = String(value ?? '').trim();
  if (!date && optional) return '';
  if (date.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'procurement_date_invalid', label + ' harus menggunakan format YYYY-MM-DD.');
  }
  const parsed = new Date(date + 'T00:00:00.000Z');
  const year = Number(date.slice(0, 4));
  if (year < 2000 || year > 2100 || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, 'procurement_date_invalid', label + ' bukan tanggal kalender yang valid.');
  }
  return date;
}

function procurementAmount(value, label, { allowZero = false } = {}) {
  const amount = Number(value);
  if (
    !Number.isFinite(amount) ||
    amount > 1_000_000_000_000 ||
    (allowZero ? amount < 0 : amount <= 0)
  ) {
    throw new HttpError(400, 'procurement_amount_invalid', label + ' tidak valid.');
  }
  const rounded = Math.round(amount);
  if (!Number.isSafeInteger(rounded)) {
    throw new HttpError(400, 'procurement_amount_invalid', label + ' melebihi batas angka yang aman.');
  }
  return rounded;
}

function summarizePurchaseOrderStatus(items) {
  const hasReceived = items.some((item) => Number(item.receivedQuantity || 0) > 0);
  const allReceived = items.length > 0 && items.every(
    (item) => Number(item.receivedQuantity || 0) >= Number(item.quantity || 0),
  );
  if (allReceived) return 'received';
  return hasReceived ? 'partially_received' : 'ordered';
}

async function normalizePurchaseOrderItems(input, firestore) {
  if (!Array.isArray(input) || !input.length || input.length > 100) {
    throw new HttpError(400, 'po_items_required', 'Purchase order harus memiliki 1 sampai 100 item.');
  }

  const seenInventoryIds = new Set();
  const seenLineIds = new Set();
  const items = [];

  for (const raw of input) {
    const inventoryItemId = cleanText(raw?.inventoryItemId, 160);
    const quantity = finiteQuantity(raw?.quantity, 'Jumlah pesanan');
    const unitPrice = procurementAmount(raw?.unitPrice, 'Harga satuan');
    if (!inventoryItemId || quantity <= 0) {
      throw new HttpError(400, 'po_item_invalid', 'Setiap baris PO wajib memilih item inventory dan jumlah positif.');
    }
    if (seenInventoryIds.has(inventoryItemId)) {
      throw new HttpError(400, 'po_duplicate_inventory_item', 'Setiap item inventory hanya boleh muncul satu kali dalam PO.');
    }
    seenInventoryIds.add(inventoryItemId);

    const inventoryDocument = await firestore.getDocument('inventoryItems', inventoryItemId);
    if (!inventoryDocument || inventoryDocument.data.status === 'inactive') {
      throw new HttpError(404, 'po_inventory_item_unavailable', 'Item inventory tidak ditemukan atau sudah dinonaktifkan.');
    }

    const lineId = cleanText(raw?.lineId, 80) || crypto.randomUUID();
    if (seenLineIds.has(lineId)) {
      throw new HttpError(400, 'po_duplicate_line_id', 'ID baris PO tidak boleh duplikat.');
    }
    seenLineIds.add(lineId);

    const lineTotal = Math.round(quantity * unitPrice);
    if (!Number.isSafeInteger(lineTotal) || lineTotal <= 0) {
      throw new HttpError(400, 'po_line_total_invalid', 'Total harga baris PO tidak valid.');
    }

    const inventoryItem = inventoryDocument.data;
    items.push({
      lineId,
      inventoryItemId,
      name: cleanText(inventoryItem.name, 160),
      category: cleanText(inventoryItem.category, 80),
      quantity,
      receivedQuantity: 0,
      unit: cleanText(inventoryItem.unit, 40) || 'pcs',
      unitPrice,
      lineTotal,
    });
  }

  return items;
}

export async function createSupplier({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'supplier-create', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const name = cleanText(body.name, 160);
  const phone = cleanText(body.phone, 40);
  const email = cleanText(body.email, 160).toLowerCase();
  if (name.length < 2) {
    throw new HttpError(400, 'supplier_name_required', 'Nama supplier minimal 2 karakter.');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'supplier_email_invalid', 'Format email supplier belum valid.');
  }

  const now = new Date().toISOString();
  const id = await stableDocumentId('supplier', key);
  const supplier = {
    id,
    name,
    contactName: cleanText(body.contactName, 120),
    phone,
    email,
    address: cleanText(body.address, 500),
    notes: cleanText(body.notes, 1000),
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdByUid: actor.uid,
    createdByName: actor.displayName,
  };
  const eventId = await stableDocumentId('procurement-event', id + ':created');
  const event = {
    id: eventId,
    entityType: 'supplier',
    entityId: id,
    action: 'created',
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now,
  };
  const result = { supplier, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      supplier: { collectionId: 'suppliers', documentId: id },
      event: { collectionId: 'procurementEvents', documentId: eventId },
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: 'supplier-create',
    writes: [
      firestore.setWrite('suppliers', id, supplier, { exists: false }),
      firestore.setWrite('procurementEvents', eventId, event, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function createPurchaseOrder({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'purchase-order-create', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const supplierId = cleanText(body.supplierId, 160);
  if (!supplierId) throw new HttpError(400, 'supplier_required', 'Supplier wajib dipilih.');
  const supplierDocument = await firestore.getDocument('suppliers', supplierId);
  if (!supplierDocument || supplierDocument.data.status !== 'active') {
    throw new HttpError(404, 'supplier_not_found', 'Supplier aktif tidak ditemukan.');
  }

  const items = await normalizePurchaseOrderItems(body.items, firestore);
  const now = new Date().toISOString();
  const orderDate = procurementDate(body.orderDate || now.slice(0, 10), 'Tanggal PO');
  const expectedAt = procurementDate(body.expectedAt, 'Estimasi barang datang', { optional: true });
  if (expectedAt && expectedAt < orderDate) {
    throw new HttpError(400, 'po_expected_date_invalid', 'Estimasi barang datang tidak boleh sebelum tanggal PO.');
  }

  const id = await stableDocumentId('purchase-order', key);
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0 || totalAmount > 1_000_000_000_000) {
    throw new HttpError(400, 'po_total_invalid', 'Total purchase order di luar batas operasional.');
  }
  const purchaseOrder = {
    id,
    poNumber: 'PO-' + orderDate.replaceAll('-', '') + '-' + id.slice(-8).toUpperCase(),
    supplierId,
    supplierName: cleanText(supplierDocument.data.name, 160),
    items,
    totalAmount,
    paidAmount: 0,
    status: 'draft',
    orderDate,
    expectedAt,
    notes: cleanText(body.notes, 1200),
    createdAt: now,
    updatedAt: now,
    createdByUid: actor.uid,
    createdByName: actor.displayName,
  };
  const eventId = await stableDocumentId('procurement-event', id + ':created');
  const event = {
    id: eventId,
    entityType: 'purchase_order',
    entityId: id,
    action: 'created',
    fromStatus: '',
    toStatus: 'draft',
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now,
    amount: totalAmount,
  };
  const result = { purchaseOrder, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      purchaseOrder: { collectionId: 'purchaseOrders', documentId: id },
      event: { collectionId: 'procurementEvents', documentId: eventId },
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: 'purchase-order-create',
    writes: [
      firestore.setWrite('purchaseOrders', id, purchaseOrder, { exists: false }),
      firestore.setWrite('procurementEvents', eventId, event, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function transitionPurchaseOrder({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'purchase-order-transition', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const id = cleanText(body.purchaseOrderId, 160);
  if (!id) throw new HttpError(400, 'purchase_order_required', 'Purchase order wajib dipilih.');
  const current = await firestore.getDocument('purchaseOrders', id);
  if (!current) throw new HttpError(404, 'purchase_order_not_found', 'Purchase order tidak ditemukan.');
  const po = { id: current.id, ...current.data };
  const expectedUpdatedAt = cleanText(body.expectedUpdatedAt, 40);
  if (!expectedUpdatedAt || expectedUpdatedAt !== po.updatedAt) {
    throw new HttpError(409, 'purchase_order_changed', 'PO berubah. Muat ulang sebelum menyimpan.');
  }

  const status = cleanText(body.status, 40);
  const transitions = {
    draft: ['submitted', 'cancelled'],
    submitted: ['approved', 'cancelled'],
    approved: ['ordered', 'cancelled'],
    ordered: [],
    partially_received: [],
    received: [],
    cancelled: [],
  };
  if (!PURCHASE_ORDER_STATUSES.includes(status) || !transitions[po.status]?.includes(status)) {
    throw new HttpError(409, 'purchase_order_transition_invalid', 'Transisi status PO tidak diizinkan.');
  }

  const reason = cleanText(body.reason, 600);
  if (status === 'approved' || status === 'cancelled') {
    if (!['owner', 'admin'].includes(actor.role)) {
      throw new HttpError(403, 'purchase_order_approval_forbidden', 'Approval PO memerlukan Admin atau Owner.');
    }
  }
  if (status === 'cancelled') {
    if (reason.length < 4) {
      throw new HttpError(400, 'purchase_order_cancel_reason_required', 'Alasan pembatalan minimal 4 karakter.');
    }
    if (Number(po.paidAmount || 0) > 0) {
      throw new HttpError(409, 'purchase_order_has_payment', 'PO yang sudah memiliki pembayaran tidak dapat dibatalkan dari alur ini.');
    }
    if ((po.items || []).some((item) => Number(item.receivedQuantity || 0) > 0)) {
      throw new HttpError(409, 'purchase_order_has_receipt', 'PO yang sudah menerima barang tidak dapat dibatalkan.');
    }
  }

  const now = new Date().toISOString();
  const next = {
    ...po,
    status,
    updatedAt: now,
    ...(status === 'approved' ? { approvedAt: now, approvedByUid: actor.uid, approvedByName: actor.displayName } : {}),
    ...(status === 'ordered' ? { orderedAt: now } : {}),
    ...(status === 'cancelled' ? { cancelledAt: now, cancelReason: reason, cancelledByUid: actor.uid } : {}),
  };
  const eventId = await stableDocumentId('procurement-event', id + ':' + key);
  const event = {
    id: eventId,
    entityType: 'purchase_order',
    entityId: id,
    action: 'status_changed',
    fromStatus: po.status,
    toStatus: status,
    reason,
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now,
  };
  const result = { purchaseOrder: next, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      purchaseOrder: { collectionId: 'purchaseOrders', documentId: id },
      event: { collectionId: 'procurementEvents', documentId: eventId },
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: 'purchase-order-transition',
    writes: [
      firestore.setWrite('purchaseOrders', id, next, { updateTime: current.updateTime }),
      firestore.setWrite('procurementEvents', eventId, event, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function receivePurchaseOrder({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'goods-receipt-create', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const poId = cleanText(body.purchaseOrderId, 160);
  if (!poId) throw new HttpError(400, 'purchase_order_required', 'Purchase order wajib dipilih.');
  const poDocument = await firestore.getDocument('purchaseOrders', poId);
  if (!poDocument) throw new HttpError(404, 'purchase_order_not_found', 'PO tidak ditemukan.');
  const po = { id: poDocument.id, ...poDocument.data };
  if (!['ordered', 'partially_received'].includes(po.status)) {
    throw new HttpError(409, 'purchase_order_not_receivable', 'PO harus berstatus Ordered atau Partially Received.');
  }
  if (cleanText(body.expectedUpdatedAt, 40) !== po.updatedAt) {
    throw new HttpError(409, 'purchase_order_changed', 'PO berubah. Muat ulang sebelum mencatat penerimaan.');
  }
  if (!Array.isArray(po.items) || !po.items.length) {
    throw new HttpError(409, 'purchase_order_items_missing', 'PO tidak memiliki detail item yang valid.');
  }

  const receivedLines = Array.isArray(body.items) ? body.items : [];
  if (!receivedLines.length) {
    throw new HttpError(400, 'goods_receipt_items_required', 'Pilih setidaknya satu item yang diterima.');
  }

  const requestedLineIds = new Set();
  for (const line of receivedLines) {
    const lineId = cleanText(line?.lineId, 80);
    if (!lineId || requestedLineIds.has(lineId)) {
      throw new HttpError(400, 'goods_receipt_line_duplicate', 'Baris penerimaan wajib unik.');
    }
    requestedLineIds.add(lineId);
  }
  if (receivedLines.length > po.items.length) {
    throw new HttpError(400, 'goods_receipt_items_required', 'Jumlah baris penerimaan melebihi detail PO.');
  }

  const now = new Date().toISOString();
  const id = await stableDocumentId('goods-receipt', key);
  const nextItems = po.items.map((item) => ({ ...item }));
  const writes = [];
  const refs = {
    purchaseOrder: { collectionId: 'purchaseOrders', documentId: poId },
  };
  const receivedSummary = [];
  const seenLineIds = new Set();
  const seenInventoryIds = new Set();

  for (const line of receivedLines) {
    const lineId = cleanText(line?.lineId, 80);
    if (!lineId || seenLineIds.has(lineId)) {
      throw new HttpError(400, 'goods_receipt_line_duplicate', 'Baris penerimaan wajib unik.');
    }
    seenLineIds.add(lineId);

    const lineIndex = nextItems.findIndex((item) => item.lineId === lineId);
    if (lineIndex < 0) throw new HttpError(400, 'goods_receipt_line_invalid', 'Baris penerimaan tidak sesuai PO.');
    const orderedLine = nextItems[lineIndex];
    if (!orderedLine.inventoryItemId || seenInventoryIds.has(orderedLine.inventoryItemId)) {
      throw new HttpError(409, 'goods_receipt_inventory_invalid', 'Referensi inventory pada PO tidak valid atau duplikat.');
    }
    seenInventoryIds.add(orderedLine.inventoryItemId);

    const quantity = finiteQuantity(line.quantity, 'Jumlah diterima');
    const orderedQuantity = finiteQuantity(orderedLine.quantity, 'Jumlah pesanan');
    const previouslyReceived = finiteQuantity(orderedLine.receivedQuantity || 0, 'Jumlah yang sudah diterima');
    const remaining = Math.max(0, orderedQuantity - previouslyReceived);
    if (quantity <= 0 || quantity > remaining) {
      throw new HttpError(409, 'goods_receipt_quantity_invalid', 'Jumlah diterima melebihi sisa pesanan.');
    }

    const itemDocument = await firestore.getDocument('inventoryItems', orderedLine.inventoryItemId);
    if (!itemDocument || itemDocument.data.status === 'inactive') {
      throw new HttpError(404, 'inventory_item_not_found', 'Item inventory terkait PO tidak ditemukan atau sudah dinonaktifkan.');
    }
    const inventoryItem = { id: itemDocument.id, ...itemDocument.data };
    const previousQuantity = finiteQuantity(inventoryItem.quantity || 0, 'Stok saat ini');
    const nextQuantity = finiteQuantity(previousQuantity + quantity, 'Stok hasil');
    if (nextQuantity < 0 || nextQuantity > 1_000_000) {
      throw new HttpError(400, 'stock_limit', 'Stok hasil berada di luar batas operasional.');
    }

    const movementId = await stableDocumentId('movement', 'receipt:' + id + ':' + orderedLine.lineId);
    const movement = {
      id: movementId,
      itemId: inventoryItem.id,
      itemName: cleanText(inventoryItem.name, 160),
      type: 'stock-in',
      quantity,
      previousQuantity,
      nextQuantity,
      unit: cleanText(inventoryItem.unit || orderedLine.unit || 'pcs', 40),
      note: 'Penerimaan ' + po.poNumber,
      reason: cleanText(body.note || 'Goods receipt', 500),
      source: 'procurement',
      sourcePurchaseOrderId: poId,
      sourceGoodsReceiptId: id,
      actorUid: actor.uid,
      actorName: actor.displayName,
      createdAt: now,
    };
    const nextItem = { ...inventoryItem, quantity: nextQuantity, updatedAt: now };
    writes.push(
      firestore.setWrite('inventoryItems', inventoryItem.id, nextItem, { updateTime: itemDocument.updateTime }),
      firestore.setWrite('inventoryMovements', movementId, movement, { exists: false }),
    );

    orderedLine.receivedQuantity = finiteQuantity(previouslyReceived + quantity, 'Total diterima');
    receivedSummary.push({
      lineId: orderedLine.lineId,
      inventoryItemId: inventoryItem.id,
      itemName: orderedLine.name,
      quantity,
      movementId,
    });
  }

  const status = summarizePurchaseOrderStatus(nextItems);
  const nextPurchaseOrder = {
    ...po,
    items: nextItems,
    status,
    updatedAt: now,
    ...(status === 'received' ? { receivedAt: now } : {}),
  };
  const receiptEventId = await stableDocumentId('procurement-event', id + ':received');
  const receipt = {
    id,
    purchaseOrderId: poId,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    supplierName: po.supplierName,
    items: receivedSummary,
    note: cleanText(body.note, 800),
    receivedAt: now,
    receivedByUid: actor.uid,
    receivedByName: actor.displayName,
    createdAt: now,
  };
  const event = {
    id: receiptEventId,
    entityType: 'goods_receipt',
    entityId: id,
    purchaseOrderId: poId,
    action: 'received',
    fromStatus: po.status,
    toStatus: status,
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now,
    items: receivedSummary,
  };
  refs.receipt = { collectionId: 'goodsReceipts', documentId: id };
  refs.event = { collectionId: 'procurementEvents', documentId: receiptEventId };
  writes.push(
    firestore.setWrite('purchaseOrders', poId, nextPurchaseOrder, { updateTime: poDocument.updateTime }),
    firestore.setWrite('goodsReceipts', id, receipt, { exists: false }),
    firestore.setWrite('procurementEvents', receiptEventId, event, { exists: false }),
  );

  const result = { receipt, purchaseOrder: nextPurchaseOrder, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: refs,
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: 'goods-receipt-create',
    writes,
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function recordPurchaseOrderPayment({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'procurement-payment', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const poId = cleanText(body.purchaseOrderId, 160);
  if (!poId) throw new HttpError(400, 'purchase_order_required', 'Purchase order wajib dipilih.');
  const current = await firestore.getDocument('purchaseOrders', poId);
  if (!current) throw new HttpError(404, 'purchase_order_not_found', 'PO tidak ditemukan.');
  const po = { id: current.id, ...current.data };
  if (['draft', 'cancelled'].includes(po.status)) {
    throw new HttpError(409, 'purchase_order_not_payable', 'PO belum siap menerima pembayaran.');
  }
  if (cleanText(body.expectedUpdatedAt, 40) !== po.updatedAt) {
    throw new HttpError(409, 'purchase_order_changed', 'PO berubah. Muat ulang sebelum mencatat pembayaran.');
  }

  const amount = procurementAmount(body.amount, 'Pembayaran');
  const totalAmount = procurementAmount(po.totalAmount, 'Total PO');
  const paidAmount = procurementAmount(po.paidAmount || 0, 'Total terbayar', { allowZero: true });
  const remaining = Math.max(0, totalAmount - paidAmount);
  if (!amount || amount > remaining) {
    throw new HttpError(409, 'procurement_payment_exceeds_balance', 'Pembayaran melebihi sisa kewajiban PO.');
  }

  const paymentMethod = cleanText(body.paymentMethod || 'transfer', 40).toLowerCase();
  if (!['cash', 'transfer', 'qris'].includes(paymentMethod)) {
    throw new HttpError(400, 'procurement_payment_method_invalid', 'Metode pembayaran tidak didukung.');
  }
  const paymentDate = procurementDate(body.date || new Date().toISOString().slice(0, 10), 'Tanggal pembayaran');
  const closingSessionId = paymentDate + '__main';
  const closingDocument = await firestore.getDocument('cashClosingSessions', closingSessionId);
  if (closingDocument?.data?.status === 'closed') {
    throw new HttpError(409, 'business_date_closed', 'Tanggal pembayaran sudah ditutup oleh Daily Closing. Buka kembali tanggal tersebut melalui alur Owner sebelum mencatat pembayaran.');
  }
  const now = new Date().toISOString();
  const paymentId = await stableDocumentId('procurement-payment', key);
  // The closing session is also the per-business-date optimistic lock.
  // A payment and Daily Closing therefore cannot commit against the same stale revision.
  const nextClosingSession = {
    ...(closingDocument?.data || {}),
    id: closingSessionId,
    businessDate: paymentDate,
    registerId: 'main',
    status: closingDocument?.data?.status || 'not_opened',
    createdAt: closingDocument?.data?.createdAt || now,
    updatedAt: now,
    lastProcurementPaymentAt: now,
    lastProcurementPaymentId: paymentId,
  };
  const payment = {
    id: paymentId,
    purchaseOrderId: poId,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    supplierName: po.supplierName,
    amount,
    paymentMethod,
    date: paymentDate,
    reference: cleanText(body.reference, 120),
    note: cleanText(body.note, 800),
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now,
  };
  const expense = {
    id: paymentId,
    type: 'expense',
    category: 'procurement',
    title: 'Pembayaran ' + po.poNumber + ' · ' + po.supplierName,
    amount,
    date: paymentDate,
    paymentMethod,
    note: payment.note,
    source: 'procurement-payment',
    sourcePurchaseOrderId: poId,
    sourceProcurementPaymentId: paymentId,
    actorUid: actor.uid,
    actorName: actor.displayName,
    immutable: true,
    createdAt: now,
    updatedAt: now,
  };
  const nextPurchaseOrder = {
    ...po,
    paidAmount: paidAmount + amount,
    updatedAt: now,
  };
  const eventId = await stableDocumentId('procurement-event', paymentId + ':paid');
  const event = {
    id: eventId,
    entityType: 'purchase_order',
    entityId: poId,
    action: 'payment_recorded',
    amount,
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now,
  };
  const result = { purchaseOrder: nextPurchaseOrder, payment, expense, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      purchaseOrder: { collectionId: 'purchaseOrders', documentId: poId },
      payment: { collectionId: 'procurementPayments', documentId: paymentId },
      expense: { collectionId: 'bookkeepingEntries', documentId: paymentId },
      event: { collectionId: 'procurementEvents', documentId: eventId },
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: poId,
    type: 'procurement-payment',
    writes: [
      firestore.setWrite('purchaseOrders', poId, nextPurchaseOrder, { updateTime: current.updateTime }),
      firestore.setWrite('procurementPayments', paymentId, payment, { exists: false }),
      firestore.setWrite('bookkeepingEntries', paymentId, expense, { exists: false }),
      firestore.setWrite('procurementEvents', eventId, event, { exists: false }),
      firestore.setWrite(
        'cashClosingSessions',
        closingSessionId,
        nextClosingSession,
        closingDocument ? { updateTime: closingDocument.updateTime } : { exists: false },
      ),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
