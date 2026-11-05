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

const PURCHASE_ORDER_STATUSES = Object.freeze(['draft', 'submitted', 'approved', 'ordered', 'partially_received', 'received', 'cancelled']);

function procurementAmount(value, label) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) {
    throw new HttpError(400, 'procurement_amount_invalid', `${label} tidak valid.`);
  }
  return Math.round(amount);
}

function normalizePurchaseOrderItems(input) {
  if (!Array.isArray(input) || !input.length || input.length > 100) {
    throw new HttpError(400, 'po_items_required', 'Purchase order harus memiliki minimal satu item.');
  }
  const seenInventoryIds = new Set();
  return input.map((raw) => {
    const inventoryItemId = cleanText(raw.inventoryItemId, 160);
    const name = cleanText(raw.name, 160);
    const quantity = finiteQuantity(raw.quantity, 'Jumlah pesanan');
    const unitPrice = procurementAmount(raw.unitPrice, 'Harga satuan');
    if ((!inventoryItemId && name.length < 2) || quantity <= 0) throw new HttpError(400, 'po_item_invalid', 'Item PO atau jumlah pesanan tidak valid.');
    if (inventoryItemId && seenInventoryIds.has(inventoryItemId)) throw new HttpError(400, 'po_duplicate_inventory_item', 'Setiap item inventory hanya boleh memiliki satu baris dalam PO.');
    if (inventoryItemId) seenInventoryIds.add(inventoryItemId);
    return {
      lineId: cleanText(raw.lineId, 80) || crypto.randomUUID(),
      inventoryItemId, name, quantity, receivedQuantity: 0,
      unit: cleanText(raw.unit, 40) || 'pcs', unitPrice, lineTotal: Math.round(quantity * unitPrice),
    };
  });
}

function summarizePurchaseOrderStatus(items) {
  const ordered = items.reduce((sum, item) => sum + item.quantity, 0);
  const received = items.reduce((sum, item) => sum + item.receivedQuantity, 0);
  if (received === 0) return 'ordered';
  if (received < ordered) return 'partially_received';
  return 'received';
}

export async function createSupplier({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'supplier-create', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const name = cleanText(body.name, 160);
  if (name.length < 2) throw new HttpError(400, 'supplier_name_required', 'Nama supplier wajib diisi.');
  const now = new Date().toISOString();
  const id = await stableDocumentId('supplier', key);
  const supplier = {
    id, name, contactName: cleanText(body.contactName, 120),
    phone: cleanText(body.phone, 40), email: cleanText(body.email, 160),
    address: cleanText(body.address, 500), notes: cleanText(body.notes, 1000),
    status: 'active', createdAt: now, updatedAt: now,
    createdByUid: actor.uid, createdByName: actor.displayName,
  };
  const eventId = await stableDocumentId('procurement-event', `${id}:created`);
  const event = { id: eventId, entityType: 'supplier', entityId: id, action: 'created', actorUid: actor.uid, actorName: actor.displayName, createdAt: now };
  const result = { supplier, event };
  const committed = await commitIdempotentOperation({
    actor, documentRefs: { supplier: { collectionId: 'suppliers', documentId: id }, event: { collectionId: 'procurementEvents', documentId: eventId } },
    firestore, key, receipt: {}, result, targetId: id, type: 'supplier-create',
    writes: [firestore.setWrite('suppliers', id, supplier, { exists: false }), firestore.setWrite('procurementEvents', eventId, event, { exists: false })],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function createPurchaseOrder({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'purchase-order-create', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const supplierId = cleanText(body.supplierId, 160);
  const supplierDoc = await firestore.getDocument('suppliers', supplierId);
  if (!supplierDoc || supplierDoc.data.status !== 'active') throw new HttpError(404, 'supplier_not_found', 'Supplier aktif tidak ditemukan.');
  const items = normalizePurchaseOrderItems(body.items);
  const now = new Date().toISOString();
  const id = await stableDocumentId('purchase-order', key);
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const purchaseOrder = {
    id,
    poNumber: cleanText(body.poNumber, 80) || `PO-${now.slice(0,10).replaceAll('-', '')}-${id.slice(0,6).toUpperCase()}`,
    supplierId, supplierName: cleanText(supplierDoc.data.name, 160),
    items, totalAmount, paidAmount: 0, status: 'draft',
    orderDate: cleanText(body.orderDate, 10) || now.slice(0,10),
    expectedAt: cleanText(body.expectedAt, 10),
    notes: cleanText(body.notes, 1200),
    createdAt: now, updatedAt: now, createdByUid: actor.uid, createdByName: actor.displayName,
  };
  const eventId = await stableDocumentId('procurement-event', `${id}:created`);
  const event = { id: eventId, entityType: 'purchase_order', entityId: id, action: 'created', fromStatus: '', toStatus: 'draft', actorUid: actor.uid, actorName: actor.displayName, createdAt: now, amount: totalAmount };
  const result = { purchaseOrder, event };
  const committed = await commitIdempotentOperation({
    actor, documentRefs: { po: { collectionId: 'purchaseOrders', documentId: id }, event: { collectionId: 'procurementEvents', documentId: eventId } },
    firestore, key, receipt: {}, result, targetId: id, type: 'purchase-order-create',
    writes: [firestore.setWrite('purchaseOrders', id, purchaseOrder, { exists: false }), firestore.setWrite('procurementEvents', eventId, event, { exists: false })],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function transitionPurchaseOrder({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'purchase-order-transition', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const id = cleanText(body.purchaseOrderId || body.id, 160);
  const current = await firestore.getDocument('purchaseOrders', id);
  if (!current) throw new HttpError(404, 'purchase_order_not_found', 'Purchase order tidak ditemukan.');
  const po = { id: current.id, ...current.data };
  if (body.expectedUpdatedAt && body.expectedUpdatedAt !== po.updatedAt) throw new HttpError(409, 'purchase_order_changed', 'PO berubah. Muat ulang sebelum menyimpan.');
  const status = cleanText(body.status, 40);
  const transitions = {
    draft: ['submitted', 'cancelled'],
    submitted: ['approved', 'cancelled'],
    approved: ['ordered', 'cancelled'],
    ordered: [], partially_received: [], received: [], cancelled: [],
  };
  if (!transitions[po.status]?.includes(status)) throw new HttpError(409, 'purchase_order_transition_invalid', 'Transisi status PO tidak diizinkan.');
  if (['approved', 'cancelled'].includes(status) && !['owner', 'admin'].includes(actor.role)) {
    throw new HttpError(403, 'purchase_order_approval_forbidden', 'Approval PO memerlukan Admin atau Owner.');
  }
  const now = new Date().toISOString();
  const next = {
    ...po, status, updatedAt: now,
    ...(status === 'approved' ? { approvedAt: now, approvedByUid: actor.uid, approvedByName: actor.displayName } : {}),
    ...(status === 'ordered' ? { orderedAt: now } : {}),
    ...(status === 'cancelled' ? { cancelledAt: now, cancelReason: cleanText(body.reason, 600) } : {}),
  };
  const eventId = await stableDocumentId('procurement-event', `${id}:${key}`);
  const event = { id: eventId, entityType: 'purchase_order', entityId: id, action: 'status_changed', fromStatus: po.status, toStatus: status, reason: cleanText(body.reason, 600), actorUid: actor.uid, actorName: actor.displayName, createdAt: now };
  const result = { purchaseOrder: next, event };
  const committed = await commitIdempotentOperation({
    actor, documentRefs: { po: { collectionId: 'purchaseOrders', documentId: id }, event: { collectionId: 'procurementEvents', documentId: eventId } },
    firestore, key, receipt: {}, result, targetId: id, type: 'purchase-order-transition',
    writes: [firestore.setWrite('purchaseOrders', id, next, { updateTime: current.updateTime }), firestore.setWrite('procurementEvents', eventId, event, { exists: false })],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function receivePurchaseOrder({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'goods-receipt-create', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const poId = cleanText(body.purchaseOrderId, 160);
  const poDoc = await firestore.getDocument('purchaseOrders', poId);
  if (!poDoc) throw new HttpError(404, 'purchase_order_not_found', 'PO tidak ditemukan.');
  const po = { id: poDoc.id, ...poDoc.data };
  if (!['ordered', 'partially_received'].includes(po.status)) throw new HttpError(409, 'purchase_order_not_receivable', 'PO harus berstatus Ordered atau Partially Received.');
  const receivedLines = Array.isArray(body.items) ? body.items : [];
  if (!receivedLines.length) throw new HttpError(400, 'goods_receipt_items_required', 'Pilih item dan jumlah yang diterima.');
  const now = new Date().toISOString();
  const id = await stableDocumentId('goods-receipt', key);
  const nextItems = po.items.map((item) => ({ ...item }));
  const writes = [];
  const refs = {
    po: { collectionId: 'purchaseOrders', documentId: poId },
  };
  const receivedSummary = [];
  const seenLineIds = new Set();
  for (const line of receivedLines) {
    const lineId = cleanText(line.lineId, 80);
    if (seenLineIds.has(lineId)) throw new HttpError(400, 'goods_receipt_line_duplicate', 'Baris PO tidak boleh dicatat dua kali dalam satu penerimaan.');
    seenLineIds.add(lineId);
    const lineIndex = nextItems.findIndex((item) => item.lineId === lineId);
    if (lineIndex < 0) throw new HttpError(400, 'goods_receipt_line_invalid', 'Baris penerimaan tidak sesuai PO.');
    const orderedLine = nextItems[lineIndex];
    const quantity = finiteQuantity(line.quantity, 'Jumlah diterima');
    if (quantity <= 0 || orderedLine.receivedQuantity + quantity > orderedLine.quantity) throw new HttpError(409, 'goods_receipt_quantity_invalid', 'Jumlah diterima melebihi sisa pesanan.');
    if (!orderedLine.inventoryItemId) throw new HttpError(409, 'goods_receipt_inventory_missing', 'Baris PO belum terhubung ke item inventory.');
    const itemDoc = await firestore.getDocument('inventoryItems', orderedLine.inventoryItemId);
    if (!itemDoc) throw new HttpError(404, 'inventory_item_not_found', 'Item inventory terkait PO tidak ditemukan.');
    const inventoryItem = { id: itemDoc.id, ...itemDoc.data };
    const previous = finiteQuantity(inventoryItem.quantity || 0, 'Stok saat ini');
    const nextQuantity = finiteQuantity(previous + quantity, 'Stok hasil');
    if (nextQuantity > 1_000_000) throw new HttpError(400, 'stock_limit', 'Stok hasil melewati batas operasional.');
    const movementId = await stableDocumentId('movement', `receipt:${id}:${orderedLine.lineId}`);
    const movement = {
      id: movementId, itemId: inventoryItem.id, itemName: inventoryItem.name,
      type: 'stock-in', quantity, previousQuantity: previous, nextQuantity,
      unit: cleanText(inventoryItem.unit || orderedLine.unit || 'pcs', 40),
      note: `Penerimaan ${po.poNumber}`,
      reason: cleanText(body.note || 'Goods receipt', 500),
      source: 'procurement', sourcePurchaseOrderId: poId, sourceGoodsReceiptId: id,
      actorUid: actor.uid, actorName: actor.displayName, createdAt: now,
    };
    const nextItem = { ...inventoryItem, quantity: nextQuantity, updatedAt: now };
    writes.push(
      firestore.setWrite('inventoryItems', inventoryItem.id, nextItem, { updateTime: itemDoc.updateTime }),
      firestore.setWrite('inventoryMovements', movementId, movement, { exists: false }),
    );
    refs[`item_${inventoryItem.id}`] = { collectionId: 'inventoryItems', documentId: inventoryItem.id };
    refs[`movement_${movementId}`] = { collectionId: 'inventoryMovements', documentId: movementId };
    orderedLine.receivedQuantity = finiteQuantity(orderedLine.receivedQuantity + quantity, 'Total diterima');
    receivedSummary.push({ lineId: orderedLine.lineId, inventoryItemId: inventoryItem.id, quantity, movementId });
  }
  const status = summarizePurchaseOrderStatus(nextItems);
  const nextPO = { ...po, items: nextItems, status, updatedAt: now, ...(status === 'received' ? { receivedAt: now } : {}) };
  const receiptEventId = await stableDocumentId('procurement-event', `${id}:received`);
  const receipt = {
    id, purchaseOrderId: poId, poNumber: po.poNumber,
    supplierId: po.supplierId, supplierName: po.supplierName,
    items: receivedSummary, note: cleanText(body.note, 800),
    receivedAt: now, receivedByUid: actor.uid, receivedByName: actor.displayName,
    createdAt: now,
  };
  const event = {
    id: receiptEventId, entityType: 'goods_receipt', entityId: id, purchaseOrderId: poId,
    action: 'received', fromStatus: po.status, toStatus: status,
    actorUid: actor.uid, actorName: actor.displayName, createdAt: now,
    items: receivedSummary,
  };
  refs.receipt = { collectionId: 'goodsReceipts', documentId: id };
  refs.event = { collectionId: 'procurementEvents', documentId: receiptEventId };
  writes.push(
    firestore.setWrite('purchaseOrders', poId, nextPO, { updateTime: poDoc.updateTime }),
    firestore.setWrite('goodsReceipts', id, receipt, { exists: false }),
    firestore.setWrite('procurementEvents', receiptEventId, event, { exists: false }),
  );
  const result = { receipt, purchaseOrder: nextPO, event };
  const committed = await commitIdempotentOperation({
    actor, documentRefs: refs, firestore, key, receipt: {}, result, targetId: id, type: 'goods-receipt-create', writes,
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function recordPurchaseOrderPayment({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'procurement-payment', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const poId = cleanText(body.purchaseOrderId, 160);
  const current = await firestore.getDocument('purchaseOrders', poId);
  if (!current) throw new HttpError(404, 'purchase_order_not_found', 'PO tidak ditemukan.');
  const po = { id: current.id, ...current.data };
  if (['draft', 'cancelled'].includes(po.status)) throw new HttpError(409, 'purchase_order_not_payable', 'PO belum siap menerima pembayaran.');
  const amount = procurementAmount(body.amount, 'Pembayaran');
  const remaining = Math.max(0, po.totalAmount - po.paidAmount);
  if (!amount || amount > remaining) throw new HttpError(409, 'procurement_payment_exceeds_balance', 'Pembayaran melebihi sisa kewajiban PO.');
  const now = new Date().toISOString();
  const paymentId = await stableDocumentId('procurement-payment', key);
  const payment = {
    id: paymentId, purchaseOrderId: poId, poNumber: po.poNumber,
    supplierId: po.supplierId, supplierName: po.supplierName,
    amount, paymentMethod: cleanText(body.paymentMethod || 'transfer', 40),
    date: cleanText(body.date, 10) || now.slice(0,10),
    reference: cleanText(body.reference, 120), note: cleanText(body.note, 800),
    actorUid: actor.uid, actorName: actor.displayName, createdAt: now,
  };
  const expense = {
    id: paymentId, type: 'expense', category: 'procurement',
    title: `Pembayaran ${po.poNumber} · ${po.supplierName}`,
    amount, date: payment.date, paymentMethod: payment.paymentMethod,
    note: payment.note, source: 'procurement-payment',
    sourcePurchaseOrderId: poId, sourceProcurementPaymentId: paymentId,
    actorUid: actor.uid, actorName: actor.displayName, immutable: true,
    createdAt: now, updatedAt: now,
  };
  const nextPO = { ...po, paidAmount: po.paidAmount + amount, updatedAt: now };
  const eventId = await stableDocumentId('procurement-event', `${paymentId}:paid`);
  const event = { id: eventId, entityType: 'purchase_order', entityId: poId, action: 'payment_recorded', amount, actorUid: actor.uid, actorName: actor.displayName, createdAt: now };
  const result = { purchaseOrder: nextPO, payment, expense, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      po: { collectionId: 'purchaseOrders', documentId: poId },
      payment: { collectionId: 'procurementPayments', documentId: paymentId },
      expense: { collectionId: 'bookkeepingEntries', documentId: paymentId },
      event: { collectionId: 'procurementEvents', documentId: eventId },
    },
    firestore, key, receipt: {}, result, targetId: poId, type: 'procurement-payment',
    writes: [
      firestore.setWrite('purchaseOrders', poId, nextPO, { updateTime: current.updateTime }),
      firestore.setWrite('procurementPayments', paymentId, payment, { exists: false }),
      firestore.setWrite('bookkeepingEntries', paymentId, expense, { exists: false }),
      firestore.setWrite('procurementEvents', eventId, event, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

function normalizeCanonicalInventoryMetadata(body, previous = null) {
  const name = cleanText(body.name, 160);
  if (name.length < 2) throw new HttpError(400, 'item_name_required', 'Nama item minimal 2 karakter.');
  const quantity = finiteQuantity(body.quantity ?? previous?.quantity ?? 0, 'Jumlah stok');
  const minStock = finiteQuantity(body.minStock ?? previous?.minStock ?? 0, 'Minimal stok');
  if (quantity < 0 || quantity > 1_000_000 || minStock < 0 || minStock > 1_000_000) {
    throw new HttpError(400, 'invalid_stock_value', 'Jumlah stok di luar batas operasional.');
  }
  const type = cleanText(body.type || previous?.type || 'asset', 40);
  const condition = cleanText(body.condition || previous?.condition || 'good', 40);
  const status = cleanText(body.status || previous?.status || 'active', 40);
  if (!['asset', 'consumable'].includes(type)) throw new HttpError(400, 'invalid_item_type', 'Tipe item tidak valid.');
  if (!['good', 'fair', 'maintenance', 'broken'].includes(condition)) throw new HttpError(400, 'invalid_condition', 'Kondisi item tidak valid.');
  if (!['active', 'maintenance', 'broken', 'lost', 'low_stock', 'inactive'].includes(status)) throw new HttpError(400, 'invalid_item_status', 'Status item tidak valid.');
  const now = new Date().toISOString();
  return {
    id: previous?.id || cleanText(body.id, 160),
    name,
    category: cleanText(body.category || previous?.category || 'other', 60),
    type,
    quantity,
    unit: cleanText(body.unit || previous?.unit || 'pcs', 40),
    minStock,
    condition,
    status,
    location: cleanText(body.location || previous?.location, 160),
    note: cleanText(body.note || previous?.note, 1000),
    createdAt: previous?.createdAt || cleanText(body.createdAt, 80) || now,
    updatedAt: now,
  };
}

export async function saveInventoryItemMetadata({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'inventory-metadata-save', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const id = cleanText(body.id, 160);
  const current = id ? await firestore.getDocument('inventoryItems', id) : null;
  if (id && !current) throw new HttpError(404, 'item_not_found', 'Inventory item tidak ditemukan.');
  if (current && body.expectedUpdatedAt && body.expectedUpdatedAt !== current.data.updatedAt) {
    throw new HttpError(409, 'item_changed', 'Inventory berubah. Muat ulang sebelum menyimpan.');
  }
  const previous = current ? { id: current.id, ...current.data } : null;
  const item = normalizeCanonicalInventoryMetadata(body, previous);
  const movementId = await stableDocumentId('movement', `metadata:${item.id}:${key}`);
  const movement = {
    id: movementId, itemId: item.id, itemName: item.name,
    type: previous ? 'edit' : 'create',
    quantity: item.quantity,
    previousQuantity: previous?.quantity ?? item.quantity,
    nextQuantity: item.quantity,
    unit: item.unit,
    note: previous ? 'Update data inventory' : 'Item baru ditambahkan',
    reason: previous ? 'Inventory metadata updated' : 'Inventory item created',
    actorUid: actor.uid, actorName: actor.displayName, createdAt: item.updatedAt,
  };
  const result = { item, movement };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      item: { collectionId: 'inventoryItems', documentId: item.id },
      movement: { collectionId: 'inventoryMovements', documentId: movementId },
    },
    firestore, key, receipt: {}, result, targetId: item.id, type: 'inventory-metadata-save',
    writes: [
      firestore.setWrite('inventoryItems', item.id, item, current ? { updateTime: current.updateTime } : { exists: false }),
      firestore.setWrite('inventoryMovements', movementId, movement, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function archiveInventoryItem({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'inventory-archive', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const id = cleanText(body.itemId, 160);
  const current = await firestore.getDocument('inventoryItems', id);
  if (!current) throw new HttpError(404, 'item_not_found', 'Inventory item tidak ditemukan.');
  if (body.expectedUpdatedAt && body.expectedUpdatedAt !== current.data.updatedAt) {
    throw new HttpError(409, 'item_changed', 'Inventory berubah. Muat ulang sebelum mengarsipkan.');
  }
  const previous = { id: current.id, ...current.data };
  const now = new Date().toISOString();
  const item = { ...previous, status: 'inactive', updatedAt: now };
  const movementId = await stableDocumentId('movement', `archive:${id}:${key}`);
  const movement = {
    id: movementId, itemId: id, itemName: item.name, type: 'inactive',
    quantity: item.quantity, previousQuantity: item.quantity, nextQuantity: item.quantity,
    unit: item.unit, note: 'Item dinonaktifkan',
    reason: cleanText(body.reason || 'Item dinonaktifkan', 500),
    actorUid: actor.uid, actorName: actor.displayName, createdAt: now,
  };
  const result = { item, movement };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      item: { collectionId: 'inventoryItems', documentId: id },
      movement: { collectionId: 'inventoryMovements', documentId: movementId },
    },
    firestore, key, receipt: {}, result, targetId: id, type: 'inventory-archive',
    writes: [
      firestore.setWrite('inventoryItems', id, item, { updateTime: current.updateTime }),
      firestore.setWrite('inventoryMovements', movementId, movement, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
