import { HttpError, cleanText, getIdempotencyKey } from '../lib/http.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';
import { stableDocumentId } from '../lib/firestore.js';

const FOLLOW_UP_STATUSES = Object.freeze(['open', 'in_progress', 'snoozed', 'completed', 'cancelled']);
const FOLLOW_UP_OUTCOMES = Object.freeze(['connected', 'no_answer', 'rescheduled', 'not_interested', 'paid', 'booked', 'other']);

function validateDueAt(value) {
  const dueAt = cleanText(value, 80);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(dueAt)) {
    throw new HttpError(400, 'follow_up_due_required', 'Tanggal follow-up tidak valid.');
  }
  return dueAt;
}

function eventFor(task, action, actor, now, details = {}) {
  return {
    id: details.id,
    taskId: task.id,
    customerId: task.customerId,
    action,
    status: task.status,
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now,
    ...details,
  };
}

export async function createCustomerFollowUpTask({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'customer-follow-up-create', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const customerId = cleanText(body.customerId, 160);
  const customer = await firestore.getDocument('customers', customerId);
  if (!customer) throw new HttpError(404, 'customer_not_found', 'Customer tidak ditemukan.');
  const title = cleanText(body.title || 'Customer follow-up', 160);
  const dueAt = validateDueAt(body.dueAt);
  const now = new Date().toISOString();
  const id = await stableDocumentId('follow-up', key);
  const task = {
    id, customerId, customerName: cleanText(customer.data.name, 160),
    customerPhone: cleanText(customer.data.phone, 40),
    bookingId: cleanText(body.bookingId, 160),
    title, description: cleanText(body.description, 1200),
    templateKey: cleanText(body.templateKey || 'payment', 40),
    status: 'open', outcome: '',
    assignedToUid: cleanText(body.assignedToUid || actor.uid, 128),
    assignedToName: cleanText(body.assignedToName || actor.displayName, 120),
    dueAt, createdAt: now, updatedAt: now,
    createdByUid: actor.uid, createdByName: actor.displayName,
    lastContactedAt: '', completedAt: '', completedByUid: '',
    notes: cleanText(body.notes, 1200),
  };
  const eventId = await stableDocumentId('follow-up-event', `${id}:created`);
  const event = eventFor(task, 'created', actor, now, { id: eventId, note: title });
  const result = { task, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      task: { collectionId: 'customerFollowUpTasks', documentId: id },
      event: { collectionId: 'customerFollowUpEvents', documentId: eventId },
    },
    firestore, key, receipt: {}, result, targetId: id, type: 'customer-follow-up-create',
    writes: [
      firestore.setWrite('customerFollowUpTasks', id, task, { exists: false }),
      firestore.setWrite('customerFollowUpEvents', eventId, event, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function updateCustomerFollowUpTask({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'customer-follow-up-update', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const id = cleanText(body.taskId || body.id, 160);
  const current = await firestore.getDocument('customerFollowUpTasks', id);
  if (!current) throw new HttpError(404, 'follow_up_not_found', 'Task follow-up tidak ditemukan.');
  const task = { id: current.id, ...current.data };
  if (body.expectedUpdatedAt && body.expectedUpdatedAt !== task.updatedAt) {
    throw new HttpError(409, 'follow_up_changed', 'Task berubah. Muat ulang sebelum menyimpan.');
  }
  const status = cleanText(body.status || task.status, 40);
  if (!FOLLOW_UP_STATUSES.includes(status)) throw new HttpError(400, 'follow_up_status_invalid', 'Status follow-up tidak valid.');
  if (task.status === 'completed' || task.status === 'cancelled') {
    throw new HttpError(409, 'follow_up_closed', 'Task yang sudah selesai atau dibatalkan tidak dapat diubah.');
  }
  const dueAt = body.dueAt ? validateDueAt(body.dueAt) : task.dueAt;
  const outcome = cleanText(body.outcome || task.outcome, 40);
  if (outcome && !FOLLOW_UP_OUTCOMES.includes(outcome)) throw new HttpError(400, 'follow_up_outcome_invalid', 'Hasil follow-up tidak valid.');
  if (status === 'completed' && !outcome) throw new HttpError(400, 'follow_up_outcome_required', 'Pilih hasil follow-up sebelum menyelesaikan task.');
  const now = new Date().toISOString();
  const next = {
    ...task,
    status,
    outcome,
    dueAt,
    assignedToUid: Object.hasOwn(body, 'assignedToUid') ? cleanText(body.assignedToUid, 128) : task.assignedToUid,
    assignedToName: Object.hasOwn(body, 'assignedToName') ? cleanText(body.assignedToName, 120) : task.assignedToName,
    notes: Object.hasOwn(body, 'notes') ? cleanText(body.notes, 1200) : task.notes,
    description: Object.hasOwn(body, 'description') ? cleanText(body.description, 1200) : task.description,
    updatedAt: now,
    ...(body.contacted === true ? { lastContactedAt: now } : {}),
    ...(status === 'completed' ? { completedAt: now, completedByUid: actor.uid, completedByName: actor.displayName } : {}),
    ...(status === 'snoozed' ? { snoozedAt: now, snoozedByUid: actor.uid } : {}),
  };
  const eventId = await stableDocumentId('follow-up-event', `${id}:${key}`);
  const action = body.contacted === true ? 'contacted' : status === task.status ? 'updated' : status;
  const event = eventFor(next, action, actor, now, { id: eventId, fromStatus: task.status, outcome, dueAt, note: cleanText(body.note, 1200) });
  const result = { task: next, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      task: { collectionId: 'customerFollowUpTasks', documentId: id },
      event: { collectionId: 'customerFollowUpEvents', documentId: eventId },
    },
    firestore, key, receipt: {}, result, targetId: id, type: 'customer-follow-up-update',
    writes: [
      firestore.setWrite('customerFollowUpTasks', id, next, { updateTime: current.updateTime }),
      firestore.setWrite('customerFollowUpEvents', eventId, event, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function cancelCustomerFollowUpTask({ actor, body, firestore, request }) {
  return updateCustomerFollowUpTask({ actor, body: { ...body, status: 'cancelled', note: body.reason }, firestore, request });
}
