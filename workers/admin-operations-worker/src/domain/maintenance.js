import { HttpError, cleanMoney, cleanText, getIdempotencyKey } from '../lib/http.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';
import { stableDocumentId } from '../lib/firestore.js';

const ACTIVE_STATUSES = new Set([
  'reported',
  'triaged',
  'approved',
  'assigned',
  'in_progress',
  'waiting_parts',
  'completed',
]);

const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const METHODS = new Set(['cash', 'transfer', 'qris', 'other']);

function optionalDateTime(value, label) {
  if (value === undefined || value === null || value === '') return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, 'invalid_datetime', label + ' tidak valid.');
  }
  return parsed.toISOString();
}

function requiredDate(value, label) {
  const date = cleanText(value, 20);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
    throw new HttpError(400, 'invalid_date', label + ' wajib menggunakan format YYYY-MM-DD.');
  }
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, 'invalid_date', label + ' tidak valid.');
  }
  return date;
}

function optionalMoney(value, label) {
  if (value === undefined || value === null || value === '') return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
    throw new HttpError(400, 'invalid_amount', label + ' harus berupa nominal 0 sampai 1.000.000.000.');
  }
  return cleanMoney(amount);
}

function normalizeAttachments(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, 'invalid_attachments', 'Lampiran harus berupa daftar referensi.');
  return value.slice(0, 10).map((entry) => {
    const url = cleanText(entry?.url, 2000);
    if (!/^https:\/\//i.test(url)) throw new HttpError(400, 'invalid_attachment_url', 'Referensi lampiran harus menggunakan URL HTTPS.');
    return { label: cleanText(entry?.label, 100) || 'Lampiran', url };
  });
}

function normalizePriority(value, fallback = 'normal') {
  const priority = cleanText(value, 20).toLowerCase() || fallback;
  if (!PRIORITIES.has(priority)) {
    throw new HttpError(400, 'invalid_priority', 'Prioritas harus low, normal, high, atau urgent.');
  }
  return priority;
}

function actorFields(actor) {
  return {
    actorName: cleanText(actor.displayName, 120) || 'Admin',
    actorUid: cleanText(actor.uid, 128),
  };
}

function createEvent({ actor, action, fromStatus, toStatus, workOrder, reason = '', details = {}, now, id }) {
  return {
    action,
    ...actorFields(actor),
    createdAt: now,
    details,
    fromStatus: fromStatus || '',
    id,
    inventoryItemId: workOrder.inventoryItemId,
    reason: cleanText(reason, 600),
    revision: Number(workOrder.revision || 0) + 1,
    toStatus,
    workOrderId: workOrder.id,
  };
}

export function isActiveMaintenanceStatus(status) {
  return ACTIVE_STATUSES.has(cleanText(status, 40));
}

export function getMaintenanceTransition(action) {
  const transitions = {
    triage: { from: ['reported'], to: 'triaged' },
    approve: { from: ['triaged'], to: 'approved' },
    assign: { from: ['approved'], to: 'assigned' },
    start: { from: ['assigned'], to: 'in_progress' },
    waiting_parts: { from: ['in_progress'], to: 'waiting_parts' },
    resume: { from: ['waiting_parts'], to: 'in_progress' },
    complete: { from: ['in_progress'], to: 'completed' },
    verify: { from: ['completed'], to: 'verified' },
    cancel: { from: ['reported', 'triaged', 'approved', 'assigned', 'in_progress', 'waiting_parts'], to: 'cancelled' },
    reopen: { from: ['verified'], to: 'in_progress' },
  };
  return transitions[cleanText(action, 40)] || null;
}

async function loadWorkOrder(firestore, workOrderId) {
  const id = cleanText(workOrderId, 160);
  if (!id) throw new HttpError(400, 'work_order_required', 'Work order wajib dipilih.');
  const document = await firestore.getDocument('maintenanceWorkOrders', id);
  if (!document) throw new HttpError(404, 'work_order_not_found', 'Work order maintenance tidak ditemukan.');
  return document;
}

async function loadItem(firestore, itemId) {
  const id = cleanText(itemId, 160);
  if (!id) throw new HttpError(400, 'item_required', 'Equipment wajib dipilih.');
  const document = await firestore.getDocument('inventoryItems', id);
  if (!document) throw new HttpError(404, 'item_not_found', 'Equipment tidak ditemukan di inventory.');
  return document;
}

async function findWorkOrdersForItem(firestore, itemId) {
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
  return rows.map((row) => ({ id: row.id, ...(row.data || {}), updateTime: row.updateTime || '' }));
}

function assertRevision(workOrder, expectedRevision) {
  if (expectedRevision === undefined || expectedRevision === null || expectedRevision === '') return;
  const expected = Number(expectedRevision);
  if (!Number.isInteger(expected) || expected !== Number(workOrder.revision || 0)) {
    throw new HttpError(409, 'maintenance_revision_conflict', 'Work order sudah berubah. Muat ulang data terbaru sebelum melanjutkan.');
  }
}

function makeWorkOrderEventWrite(firestore, eventId, event) {
  return firestore.setWrite('maintenanceEvents', eventId, event, { exists: false });
}

export async function reportMaintenanceWorkOrder({ actor, body, firestore, request, now = new Date() }) {
  const key = getIdempotencyKey(request, body);
  const type = 'maintenance-work-order-report';
  const existingOperation = await readOperationResult(firestore, type, key);
  if (existingOperation.result) return { ...existingOperation.result, duplicate: true };

  const itemDocument = await loadItem(firestore, body.inventoryItemId);
  const item = { id: itemDocument.id, ...itemDocument.data };
  if (['inactive', 'lost'].includes(cleanText(item.status, 40))) {
    throw new HttpError(409, 'equipment_unavailable', 'Equipment nonaktif atau hilang tidak dapat dibuatkan work order baru.');
  }

  const existingOrders = await findWorkOrdersForItem(firestore, item.id);
  const activeOrder = existingOrders.find((row) => isActiveMaintenanceStatus(row.status));
  if (activeOrder) {
    throw new HttpError(409, 'active_work_order_exists', 'Equipment ini masih memiliki work order aktif: ' + activeOrder.id + '.');
  }

  const title = cleanText(body.title, 160);
  const description = cleanText(body.description, 2000);
  if (title.length < 3) throw new HttpError(400, 'title_required', 'Judul masalah minimal 3 karakter.');
  if (description.length < 4) throw new HttpError(400, 'description_required', 'Deskripsi masalah minimal 4 karakter.');

  const plannedAt = optionalDateTime(body.plannedAt, 'Jadwal maintenance');
  const dueAt = optionalDateTime(body.dueAt, 'Target penyelesaian');
  if (plannedAt && dueAt && new Date(dueAt).getTime() < new Date(plannedAt).getTime()) {
    throw new HttpError(400, 'invalid_schedule', 'Target penyelesaian tidak boleh lebih awal dari jadwal maintenance.');
  }

  const timestamp = now.toISOString();
  const workOrderId = await stableDocumentId('maintenance-work-order', key);
  const eventId = await stableDocumentId('maintenance-event', workOrderId + ':reported');
  const priority = normalizePriority(body.priority);
  const workOrder = {
    id: workOrderId,
    inventoryItemId: item.id,
    itemName: cleanText(item.name, 160),
    itemCategory: cleanText(item.category, 80),
    itemLocation: cleanText(item.location, 240),
    title,
    description,
    priority,
    status: 'reported',
    reportedAt: timestamp,
    reportedByUid: actor.uid,
    reportedByName: actor.displayName,
    assignedToUid: '',
    assignedToName: '',
    plannedAt,
    dueAt,
    diagnosis: '',
    repairNotes: '',
    verificationNote: '',
    verificationCondition: '',
    vendor: cleanText(body.vendor, 160),
    estimatedCost: optionalMoney(body.estimatedCost, 'Estimasi biaya'),
    actualCost: 0,
    costEntryId: '',
    attachments: normalizeAttachments(body.attachments),
    priorItemStatus: cleanText(item.status, 40) || 'active',
    priorItemCondition: cleanText(item.condition, 40) || 'good',
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    updatedByUid: actor.uid,
    updatedByName: actor.displayName,
  };
  const nextItem = {
    ...item,
    condition: 'maintenance',
    status: 'maintenance',
    updatedAt: timestamp,
  };
  const event = {
    action: 'reported',
    ...actorFields(actor),
    createdAt: timestamp,
    details: { title, priority, itemName: workOrder.itemName },
    fromStatus: '',
    id: eventId,
    inventoryItemId: item.id,
    reason: '',
    revision: 1,
    toStatus: 'reported',
    workOrderId,
  };
  const result = { event, item: nextItem, workOrder };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      event: { collectionId: 'maintenanceEvents', documentId: eventId },
      item: { collectionId: 'inventoryItems', documentId: item.id },
      workOrder: { collectionId: 'maintenanceWorkOrders', documentId: workOrderId },
    },
    firestore,
    key,
    result,
    receipt: {},
    targetId: workOrderId,
    type,
    writes: [
      firestore.setWrite('inventoryItems', item.id, nextItem, { updateTime: itemDocument.updateTime }),
      firestore.setWrite('maintenanceWorkOrders', workOrderId, workOrder, { exists: false }),
      makeWorkOrderEventWrite(firestore, eventId, event),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function actOnMaintenanceWorkOrder({ actor, body, firestore, request, now = new Date() }) {
  const action = cleanText(body.action, 40).toLowerCase();
  const key = getIdempotencyKey(request, body);
  const type = 'maintenance-work-order-' + action;
  const existingOperation = await readOperationResult(firestore, type, key);
  if (existingOperation.result) return { ...existingOperation.result, duplicate: true };

  const workOrderDocument = await loadWorkOrder(firestore, body.workOrderId);
  const current = { id: workOrderDocument.id, ...workOrderDocument.data };
  assertRevision(current, body.expectedRevision);
  const policy = getMaintenanceTransition(action);
  if (!policy || !policy.from.includes(current.status)) {
    throw new HttpError(409, 'maintenance_transition_invalid', 'Aksi ' + action + ' tidak tersedia untuk status ' + current.status + '.');
  }
  if (action === 'reopen' && actor.role !== 'owner') {
    throw new HttpError(403, 'owner_required', 'Reopen work order hanya dapat dilakukan Owner.');
  }

  const itemDocument = await loadItem(firestore, current.inventoryItemId);
  const item = { id: itemDocument.id, ...itemDocument.data };
  if (action === 'reopen') {
    const otherActive = (await findWorkOrdersForItem(firestore, item.id))
      .find((row) => row.id !== current.id && isActiveMaintenanceStatus(row.status));
    if (otherActive) {
      throw new HttpError(409, 'active_work_order_exists', 'Equipment sudah memiliki work order aktif lain.');
    }
  }

  const timestamp = now.toISOString();
  const nextStatus = policy.to;
  const nextWorkOrder = {
    ...current,
    revision: Number(current.revision || 0) + 1,
    status: nextStatus,
    updatedAt: timestamp,
    updatedByUid: actor.uid,
    updatedByName: actor.displayName,
  };
  let nextItem = null;
  let reason = cleanText(body.reason, 600);
  const details = {};

  if (action === 'triage') {
    const diagnosis = cleanText(body.diagnosis, 2000);
    if (diagnosis.length < 4) throw new HttpError(400, 'diagnosis_required', 'Diagnosis awal minimal 4 karakter.');
    nextWorkOrder.diagnosis = diagnosis;
    nextWorkOrder.priority = normalizePriority(body.priority, current.priority);
    nextWorkOrder.triagedAt = timestamp;
    nextWorkOrder.triagedByUid = actor.uid;
    nextWorkOrder.triagedByName = actor.displayName;
    details.diagnosis = diagnosis;
    details.priority = nextWorkOrder.priority;
  } else if (action === 'approve') {
    nextWorkOrder.approvedAt = timestamp;
    nextWorkOrder.approvedByUid = actor.uid;
    nextWorkOrder.approvedByName = actor.displayName;
    nextWorkOrder.approvalNote = cleanText(body.note, 600);
    details.note = nextWorkOrder.approvalNote;
  } else if (action === 'assign') {
    const assignedToName = cleanText(body.assignedToName, 120);
    if (!assignedToName) throw new HttpError(400, 'assignee_required', 'Nama PIC wajib diisi.');
    const plannedAt = optionalDateTime(body.plannedAt, 'Jadwal maintenance');
    const dueAt = optionalDateTime(body.dueAt, 'Target penyelesaian');
    if (plannedAt && dueAt && new Date(dueAt).getTime() < new Date(plannedAt).getTime()) {
      throw new HttpError(400, 'invalid_schedule', 'Target penyelesaian tidak boleh lebih awal dari jadwal maintenance.');
    }
    nextWorkOrder.assignedToName = assignedToName;
    nextWorkOrder.assignedToUid = cleanText(body.assignedToUid, 128);
    nextWorkOrder.plannedAt = plannedAt || current.plannedAt || '';
    nextWorkOrder.dueAt = dueAt || current.dueAt || '';
    nextWorkOrder.assignedAt = timestamp;
    nextWorkOrder.assignedByUid = actor.uid;
    details.assignedToName = assignedToName;
    details.plannedAt = nextWorkOrder.plannedAt;
    details.dueAt = nextWorkOrder.dueAt;
  } else if (action === 'start') {
    if (!cleanText(current.assignedToName, 120)) {
      throw new HttpError(409, 'assignee_required', 'Work order harus ditugaskan sebelum pekerjaan dimulai.');
    }
    nextWorkOrder.startedAt = timestamp;
    nextWorkOrder.startedByUid = actor.uid;
  } else if (action === 'waiting_parts') {
    if (reason.length < 4) throw new HttpError(400, 'waiting_reason_required', 'Alasan menunggu spare part minimal 4 karakter.');
    nextWorkOrder.waitingPartsAt = timestamp;
    nextWorkOrder.waitingPartsReason = reason;
    details.reason = reason;
  } else if (action === 'resume') {
    nextWorkOrder.resumedAt = timestamp;
    nextWorkOrder.resumeNote = cleanText(body.note, 600);
    details.note = nextWorkOrder.resumeNote;
  } else if (action === 'complete') {
    const repairNotes = cleanText(body.repairNotes, 2000);
    if (repairNotes.length < 4) throw new HttpError(400, 'repair_notes_required', 'Catatan perbaikan minimal 4 karakter.');
    nextWorkOrder.repairNotes = repairNotes;
    nextWorkOrder.completedAt = timestamp;
    nextWorkOrder.completedByUid = actor.uid;
    nextWorkOrder.completedByName = actor.displayName;
    details.repairNotes = repairNotes;
  } else if (action === 'verify') {
    const condition = cleanText(body.verificationCondition, 20).toLowerCase();
    if (!['good', 'fair', 'broken'].includes(condition)) {
      throw new HttpError(400, 'verification_condition_required', 'Hasil verifikasi wajib good, fair, atau broken.');
    }
    const verificationNote = cleanText(body.verificationNote, 1000);
    if (condition === 'broken' && verificationNote.length < 4) {
      throw new HttpError(400, 'verification_note_required', 'Catatan wajib diisi jika equipment belum layak digunakan.');
    }
    nextWorkOrder.verificationCondition = condition;
    nextWorkOrder.verificationNote = verificationNote;
    nextWorkOrder.verifiedAt = timestamp;
    nextWorkOrder.verifiedByUid = actor.uid;
    nextWorkOrder.verifiedByName = actor.displayName;
    nextItem = {
      ...item,
      condition,
      status: condition === 'broken' ? 'broken' : 'active',
      updatedAt: timestamp,
    };
    details.verificationCondition = condition;
    details.verificationNote = verificationNote;
  } else if (action === 'cancel') {
    if (reason.length < 4) throw new HttpError(400, 'cancel_reason_required', 'Alasan pembatalan minimal 4 karakter.');
    nextWorkOrder.cancelledAt = timestamp;
    nextWorkOrder.cancelledByUid = actor.uid;
    nextWorkOrder.cancelReason = reason;
    nextItem = {
      ...item,
      condition: cleanText(current.reopenPriorItemCondition, 40) || cleanText(current.priorItemCondition, 40) || 'good',
      status: cleanText(current.reopenPriorItemStatus, 40) || cleanText(current.priorItemStatus, 40) || 'active',
      updatedAt: timestamp,
    };
    details.reason = reason;
  } else if (action === 'reopen') {
    if (reason.length < 4) throw new HttpError(400, 'reopen_reason_required', 'Alasan reopen minimal 4 karakter.');
    nextWorkOrder.reopenPriorItemStatus = cleanText(item.status, 40) || 'active';
    nextWorkOrder.reopenPriorItemCondition = cleanText(item.condition, 40) || 'good';
    nextWorkOrder.reopenedAt = timestamp;
    nextWorkOrder.reopenedByUid = actor.uid;
    nextWorkOrder.reopenedByName = actor.displayName;
    nextWorkOrder.reopenReason = reason;
    nextItem = { ...item, condition: 'maintenance', status: 'maintenance', updatedAt: timestamp };
    details.reason = reason;
  }

  const eventId = await stableDocumentId('maintenance-event', current.id + ':' + key);
  const event = createEvent({
    actor,
    action,
    fromStatus: current.status,
    toStatus: nextStatus,
    workOrder: current,
    reason,
    details,
    now: timestamp,
    id: eventId,
  });
  const writes = [
    firestore.setWrite('maintenanceWorkOrders', current.id, nextWorkOrder, { updateTime: workOrderDocument.updateTime }),
    makeWorkOrderEventWrite(firestore, eventId, event),
  ];
  if (nextItem) {
    writes.push(firestore.setWrite('inventoryItems', item.id, nextItem, { updateTime: itemDocument.updateTime }));
  }
  const result = { event, item: nextItem, workOrder: nextWorkOrder };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      event: { collectionId: 'maintenanceEvents', documentId: eventId },
      ...(nextItem ? { item: { collectionId: 'inventoryItems', documentId: item.id } } : {}),
      workOrder: { collectionId: 'maintenanceWorkOrders', documentId: current.id },
    },
    firestore,
    key,
    result,
    receipt: {},
    targetId: current.id,
    type,
    writes,
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function recordMaintenanceCost({ actor, body, firestore, request, now = new Date() }) {
  const key = getIdempotencyKey(request, body);
  const type = 'maintenance-work-order-cost';
  const existingOperation = await readOperationResult(firestore, type, key);
  if (existingOperation.result) return { ...existingOperation.result, duplicate: true };

  const workOrderDocument = await loadWorkOrder(firestore, body.workOrderId);
  const current = { id: workOrderDocument.id, ...workOrderDocument.data };
  assertRevision(current, body.expectedRevision);
  if (!['completed', 'verified'].includes(current.status)) {
    throw new HttpError(409, 'maintenance_cost_not_ready', 'Biaya aktual hanya dapat dicatat setelah pekerjaan selesai.');
  }
  if (current.costEntryId) {
    throw new HttpError(409, 'maintenance_cost_already_recorded', 'Biaya work order ini sudah tercatat di Bookkeeping.');
  }

  const amount = optionalMoney(body.amount, 'Biaya aktual');
  if (amount <= 0) throw new HttpError(400, 'amount_required', 'Biaya aktual harus lebih dari nol.');
  const paymentMethod = cleanText(body.paymentMethod, 20).toLowerCase();
  if (!METHODS.has(paymentMethod)) throw new HttpError(400, 'invalid_payment_method', 'Metode harus cash, transfer, qris, atau other.');
  const note = cleanText(body.note, 600);
  if (note.length < 4) throw new HttpError(400, 'cost_note_required', 'Catatan biaya minimal 4 karakter.');
  const date = requiredDate(body.date, 'Tanggal biaya');

  const timestamp = now.toISOString();
  const entryId = await stableDocumentId('maintenance-ledger', current.id);
  const eventId = await stableDocumentId('maintenance-event', current.id + ':cost:' + key);
  const entry = {
    id: entryId,
    type: 'expense',
    category: 'maintenance',
    title: 'Biaya maintenance ' + cleanText(current.itemName, 120),
    amount,
    date,
    paymentMethod,
    note,
    source: 'maintenance',
    sourceWorkOrderId: current.id,
    sourceEventId: eventId,
    sourceAction: 'maintenance_cost',
    actorName: actor.displayName,
    actorUid: actor.uid,
    idempotencyKey: key,
    immutable: true,
    reversalOf: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const nextWorkOrder = {
    ...current,
    actualCost: amount,
    costEntryId: entryId,
    costRecordedAt: timestamp,
    costRecordedByUid: actor.uid,
    costRecordedByName: actor.displayName,
    revision: Number(current.revision || 0) + 1,
    updatedAt: timestamp,
    updatedByUid: actor.uid,
    updatedByName: actor.displayName,
  };
  const event = {
    action: 'cost_recorded',
    ...actorFields(actor),
    actualCost: amount,
    bookkeepingEntryId: entryId,
    createdAt: timestamp,
    details: { amount, date, paymentMethod, note },
    fromStatus: current.status,
    id: eventId,
    inventoryItemId: current.inventoryItemId,
    reason: note,
    revision: nextWorkOrder.revision,
    toStatus: current.status,
    workOrderId: current.id,
  };
  const result = { entry, event, workOrder: nextWorkOrder };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      entry: { collectionId: 'bookkeepingEntries', documentId: entryId },
      event: { collectionId: 'maintenanceEvents', documentId: eventId },
      workOrder: { collectionId: 'maintenanceWorkOrders', documentId: current.id },
    },
    firestore,
    key,
    result,
    receipt: {},
    targetId: current.id,
    type,
    writes: [
      firestore.setWrite('maintenanceWorkOrders', current.id, nextWorkOrder, { updateTime: workOrderDocument.updateTime }),
      firestore.setWrite('bookkeepingEntries', entryId, entry, { exists: false }),
      makeWorkOrderEventWrite(firestore, eventId, event),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
