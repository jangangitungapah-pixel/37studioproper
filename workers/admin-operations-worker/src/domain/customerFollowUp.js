import { HttpError, cleanText, getIdempotencyKey } from '../lib/http.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';
import { stableDocumentId } from '../lib/firestore.js';

const FOLLOW_UP_STATUSES = Object.freeze(['open', 'in_progress', 'snoozed', 'completed', 'cancelled']);
const FOLLOW_UP_OUTCOMES = Object.freeze(['connected', 'no_answer', 'rescheduled', 'not_interested', 'paid', 'booked', 'other']);
const FOLLOW_UP_TEMPLATES = new Set(['payment', 'booking', 'comeback']);
const ALLOWED_TRANSITIONS = Object.freeze({
  open: ['in_progress', 'snoozed', 'completed', 'cancelled'],
  in_progress: ['open', 'snoozed', 'completed', 'cancelled'],
  snoozed: ['open', 'in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
});
const CHANGE_FIELDS = Object.freeze(['status', 'dueAt', 'dueTime', 'assignedToUid', 'assignedToName', 'outcome', 'notes', 'description']);

function boundedText(value, label, maxLength, { required = false, minLength = 0, code = 'follow_up_invalid_input' } = {}) {
  const text = String(value ?? '').trim();
  if (required && text.length < minLength) {
    throw new HttpError(400, code, label + ' wajib diisi' + (minLength > 1 ? ' minimal ' + minLength + ' karakter.' : '.'));
  }
  if (text.length > maxLength) {
    throw new HttpError(400, code, label + ' maksimal ' + maxLength + ' karakter.');
  }
  return text;
}

export function validateFollowUpDueAt(value) {
  const dueAt = boundedText(value, 'Tanggal follow-up', 10, {
    code: 'follow_up_due_invalid',
    minLength: 10,
    required: true,
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) {
    throw new HttpError(400, 'follow_up_due_invalid', 'Tanggal follow-up wajib menggunakan format YYYY-MM-DD.');
  }
  const parsed = new Date(dueAt + 'T00:00:00.000Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueAt) {
    throw new HttpError(400, 'follow_up_due_invalid', 'Tanggal follow-up tidak valid.');
  }
  return dueAt;
}


export function validateFollowUpDueTime(value) {
  const dueTime = boundedText(value, 'Waktu follow-up', 5);
  if (dueTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) {
    throw new HttpError(400, 'follow_up_time_invalid', 'Waktu follow-up harus menggunakan format 24 jam HH:mm.');
  }
  return dueTime;
}

function businessDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
  }).format(now);
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function slugName(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'customer';
}

function fallbackCustomerId(phone, name) {
  return 'cust_' + hashString((normalizePhone(phone) || 'no-phone') + '|' + slugName(name) + '|');
}

function customerSnapshot(data = {}) {
  return {
    customerName: boundedText(data.name || data.customer || data.displayName, 'Nama customer', 160, {
      code: 'customer_identity_invalid',
      minLength: 1,
      required: true,
    }),
    customerPhone: boundedText(data.phone || data.phoneNumber || data.customerPhoneKey, 'Nomor customer', 40),
  };
}

async function resolveFollowUpCustomer({ body, firestore }) {
  const customerId = boundedText(body.customerId, 'Customer', 160, {
    code: 'customer_required',
    minLength: 1,
    required: true,
  });

  const customerDocument = await firestore.getDocument('customers', customerId);
  if (customerDocument) {
    return {
      ...customerSnapshot(customerDocument.data),
      customerId,
      sourceId: customerId,
      sourceType: 'customer',
    };
  }

  if (customerId.startsWith('auth_')) {
    const uid = customerId.slice(5);
    const userDocument = uid ? await firestore.getDocument('users', uid) : null;
    const user = userDocument?.data;
    if (!user || user.role !== 'client' || user.status !== 'active') {
      throw new HttpError(404, 'customer_not_found', 'Identitas client tidak ditemukan atau sudah tidak aktif.');
    }
    return {
      ...customerSnapshot(user),
      customerId,
      sourceId: uid,
      sourceType: 'client_account',
    };
  }

  const bookingId = boundedText(body.bookingId, 'Referensi booking', 160, {
    code: 'customer_reference_required',
    minLength: 1,
    required: true,
  });
  const bookingDocument = await firestore.getDocument('bookings', bookingId);
  if (!bookingDocument) {
    throw new HttpError(404, 'customer_source_not_found', 'Booking sumber customer tidak ditemukan.');
  }
  const booking = bookingDocument.data || {};
  const snapshot = customerSnapshot(booking);
  const sourceCustomerId = boundedText(
    booking.customerId || fallbackCustomerId(booking.phone || booking.customerPhoneKey, snapshot.customerName),
    'Referensi customer booking',
    160,
  );
  if (sourceCustomerId !== customerId) {
    throw new HttpError(404, 'customer_reference_mismatch', 'Booking sumber tidak cocok dengan customer yang dipilih.');
  }
  return {
    ...snapshot,
    customerId,
    sourceId: bookingId,
    sourceType: 'booking',
  };
}

function isEligibleAssignee(user) {
  if (!user || user.status !== 'approved') return false;
  if (user.role === 'owner') return true;
  return user.role === 'admin' && user.permissions?.customers === true;
}

async function resolveFollowUpAssignee(firestore, uid) {
  const assigneeUid = boundedText(uid, 'PIC', 128, {
    code: 'follow_up_assignee_required',
    minLength: 1,
    required: true,
  });
  const userDocument = await firestore.getDocument('users', assigneeUid);
  if (!isEligibleAssignee(userDocument?.data)) {
    throw new HttpError(400, 'follow_up_assignee_invalid', 'PIC harus merupakan Owner atau Admin aktif dengan akses Customer.');
  }
  return {
    assignedToUid: assigneeUid,
    assignedToName: boundedText(userDocument.data.displayName || userDocument.data.email, 'Nama PIC', 120, {
      code: 'follow_up_assignee_invalid',
      minLength: 1,
      required: true,
    }),
  };
}

export async function listCustomerFollowUpAssignees({ actor, firestore }) {
  const rows = await firestore.runQuery({
    from: [{ collectionId: 'users' }],
    limit: 100,
    where: {
      fieldFilter: {
        field: { fieldPath: 'role' },
        op: 'IN',
        value: {
          arrayValue: {
            values: [{ stringValue: 'owner' }, { stringValue: 'admin' }],
          },
        },
      },
    },
  });
  const assignees = rows
    .filter((row) => isEligibleAssignee(row.data))
    .map((row) => ({
      uid: row.id,
      displayName: boundedText(row.data.displayName || row.data.email, 'Nama PIC', 120) || 'Admin',
      role: row.data.role,
    }))
    .sort((first, second) => first.displayName.localeCompare(second.displayName, 'id'));
  if (!assignees.some((item) => item.uid === actor.uid)) {
    const current = await firestore.getDocument('users', actor.uid);
    if (isEligibleAssignee(current?.data)) {
      assignees.push({
        uid: actor.uid,
        displayName: boundedText(current.data.displayName || actor.displayName, 'Nama PIC', 120) || 'Admin',
        role: current.data.role,
      });
    }
  }
  return {
    assignees,
    currentActorUid: actor.uid,
  };
}

function makeChanges(before, after) {
  return CHANGE_FIELDS.reduce((changes, field) => {
    const previous = before?.[field] ?? '';
    const next = after?.[field] ?? '';
    if (previous !== next) changes[field] = { before: previous, after: next };
    return changes;
  }, {});
}

function eventFor(task, action, actor, now, details = {}) {
  return {
    ...details,
    action,
    actorUid: actor.uid,
    actorName: actor.displayName,
    changes: details.changes || {},
    createdAt: now,
    customerId: task.customerId,
    id: details.id,
    taskId: task.id,
  };
}

function validateOutcome(value) {
  const outcome = boundedText(value, 'Outcome', 40);
  if (outcome && !FOLLOW_UP_OUTCOMES.includes(outcome)) {
    throw new HttpError(400, 'follow_up_outcome_invalid', 'Hasil follow-up tidak valid.');
  }
  return outcome;
}

function validateStatus(value) {
  const status = boundedText(value, 'Status', 40, {
    code: 'follow_up_status_invalid',
    minLength: 1,
    required: true,
  });
  if (!FOLLOW_UP_STATUSES.includes(status)) {
    throw new HttpError(400, 'follow_up_status_invalid', 'Status follow-up tidak valid.');
  }
  return status;
}

export async function createCustomerFollowUpTask({ actor, body, firestore, request, now = new Date() }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'customer-follow-up-create', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const customer = await resolveFollowUpCustomer({ body, firestore });
  const assignee = await resolveFollowUpAssignee(firestore, body.assignedToUid || actor.uid);
  const title = boundedText(body.title, 'Judul task', 160, {
    code: 'follow_up_title_required',
    minLength: 3,
    required: true,
  });
  const description = boundedText(body.description, 'Deskripsi', 1200);
  const notes = boundedText(body.notes, 'Catatan', 1200);
  const dueAt = validateFollowUpDueAt(body.dueAt);
  const dueTime = validateFollowUpDueTime(body.dueTime);
  const templateKey = boundedText(body.templateKey || 'payment', 'Template', 40, {
    code: 'follow_up_template_invalid',
    minLength: 1,
    required: true,
  });
  if (!FOLLOW_UP_TEMPLATES.has(templateKey)) {
    throw new HttpError(400, 'follow_up_template_invalid', 'Template follow-up tidak dikenal.');
  }

  const timestamp = now.toISOString();
  const id = await stableDocumentId('follow-up', key);
  const task = {
    ...customer,
    ...assignee,
    bookingId: customer.sourceType === 'booking' ? customer.sourceId : '',
    id,
    title,
    description,
    templateKey,
    status: 'open',
    outcome: '',
    dueAt,
    dueTime,
    notes,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByUid: actor.uid,
    createdByName: actor.displayName,
    lastContactedAt: '',
    completedAt: '',
    completedByUid: '',
    completedByName: '',
    cancelledAt: '',
    cancelledByUid: '',
    cancelReason: '',
  };
  const eventId = await stableDocumentId('follow-up-event', id + ':created');
  const event = eventFor(task, 'created', actor, timestamp, {
    id: eventId,
    note: title,
    changes: {
      status: { before: '', after: 'open' },
      dueAt: { before: '', after: dueAt },
      dueTime: { before: '', after: dueTime },
      assignedToUid: { before: '', after: assignee.assignedToUid },
      assignedToName: { before: '', after: assignee.assignedToName },
    },
  });
  const result = { task, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      task: { collectionId: 'customerFollowUpTasks', documentId: id },
      event: { collectionId: 'customerFollowUpEvents', documentId: eventId },
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: 'customer-follow-up-create',
    writes: [
      firestore.setWrite('customerFollowUpTasks', id, task, { exists: false }),
      firestore.setWrite('customerFollowUpEvents', eventId, event, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function updateCustomerFollowUpTask({ actor, body, firestore, request, now = new Date() }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'customer-follow-up-update', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const id = boundedText(body.taskId || body.id, 'Task', 160, {
    code: 'follow_up_not_found',
    minLength: 1,
    required: true,
  });
  const currentDocument = await firestore.getDocument('customerFollowUpTasks', id);
  if (!currentDocument) throw new HttpError(404, 'follow_up_not_found', 'Task follow-up tidak ditemukan.');
  const current = { id: currentDocument.id, ...currentDocument.data };
  const expectedUpdatedAt = boundedText(body.expectedUpdatedAt, 'Revision task', 40, {
    code: 'follow_up_revision_required',
    minLength: 1,
    required: true,
  });
  if (expectedUpdatedAt !== current.updatedAt) {
    throw new HttpError(409, 'follow_up_changed', 'Task berubah. Muat ulang sebelum menyimpan.');
  }

  const action = boundedText(body.action, 'Aksi', 40);
  const reopening = action === 'reopen';
  const cancelling = action === 'cancel';
  const reason = boundedText(body.reason || body.note, 'Alasan', 600);
  let status = reopening ? 'open' : validateStatus(body.status || current.status);

  if (reopening) {
    if (!['completed', 'cancelled'].includes(current.status)) {
      throw new HttpError(409, 'follow_up_transition_invalid', 'Hanya task selesai atau dibatalkan yang dapat dibuka kembali.');
    }
    if (reason.length < 4) {
      throw new HttpError(400, 'follow_up_reopen_reason_required', 'Alasan membuka kembali task minimal 4 karakter.');
    }
  } else {
    if (['completed', 'cancelled'].includes(current.status)) {
      throw new HttpError(409, 'follow_up_closed', 'Task sudah ditutup. Gunakan aksi buka kembali dengan alasan.');
    }
    if (status !== current.status && !ALLOWED_TRANSITIONS[current.status]?.includes(status)) {
      throw new HttpError(409, 'follow_up_transition_invalid', 'Perubahan status follow-up tidak diizinkan.');
    }
  }

  if (cancelling || status === 'cancelled') {
    if (reason.length < 4) {
      throw new HttpError(400, 'follow_up_cancel_reason_required', 'Alasan pembatalan minimal 4 karakter.');
    }
    status = 'cancelled';
  }

  const dueAt = Object.hasOwn(body, 'dueAt') ? validateFollowUpDueAt(body.dueAt) : current.dueAt;
  const dueTime = Object.hasOwn(body, 'dueTime') ? validateFollowUpDueTime(body.dueTime) : current.dueTime || '';
  if (status === 'snoozed' && dueAt <= businessDate(now)) {
    throw new HttpError(400, 'follow_up_snooze_date_future_required', 'Tanggal snooze harus setelah hari ini menurut WIB.');
  }

  const outcome = reopening ? '' : Object.hasOwn(body, 'outcome') ? validateOutcome(body.outcome) : current.outcome;
  if (status === 'completed' && !outcome) {
    throw new HttpError(400, 'follow_up_outcome_required', 'Pilih hasil follow-up sebelum menyelesaikan task.');
  }
  if (body.contacted === true && !outcome) {
    throw new HttpError(400, 'follow_up_outcome_required', 'Catat outcome komunikasi sebelum menandai sudah dihubungi.');
  }

  const assignee = Object.hasOwn(body, 'assignedToUid')
    ? await resolveFollowUpAssignee(firestore, body.assignedToUid)
    : { assignedToUid: current.assignedToUid, assignedToName: current.assignedToName };
  const notes = Object.hasOwn(body, 'notes') || Object.hasOwn(body, 'note')
    ? boundedText(Object.hasOwn(body, 'notes') ? body.notes : body.note, 'Catatan', 1200)
    : current.notes;
  const description = Object.hasOwn(body, 'description')
    ? boundedText(body.description, 'Deskripsi', 1200)
    : current.description;
  const timestamp = now.toISOString();
  const next = {
    ...current,
    ...assignee,
    status,
    outcome,
    dueAt,
    dueTime,
    notes,
    description,
    revision: Number(current.revision || 0) + 1,
    updatedAt: timestamp,
    ...(body.contacted === true ? { lastContactedAt: timestamp } : {}),
    ...(status === 'completed' ? {
      completedAt: timestamp,
      completedByUid: actor.uid,
      completedByName: actor.displayName,
    } : {}),
    ...(status === 'cancelled' ? {
      cancelledAt: timestamp,
      cancelledByUid: actor.uid,
      cancelReason: reason,
    } : {}),
    ...(reopening ? {
      lastCompletedAt: current.completedAt || current.lastCompletedAt || '',
      completedAt: '',
      completedByUid: '',
      completedByName: '',
      lastCancelledAt: current.cancelledAt || '',
      cancelledAt: '',
      cancelledByUid: '',
      cancelReason: '',
      reopenedAt: timestamp,
      reopenedByUid: actor.uid,
      reopenedByName: actor.displayName,
      reopenReason: reason,
    } : {}),
    ...(status === 'snoozed' ? { snoozedAt: timestamp, snoozedByUid: actor.uid } : {}),
  };

  const changes = makeChanges(current, next);
  if (!Object.keys(changes).length && !body.contacted) {
    throw new HttpError(400, 'follow_up_no_changes', 'Tidak ada perubahan untuk disimpan.');
  }
  const eventId = await stableDocumentId('follow-up-event', id + ':' + key);
  const eventAction = reopening ? 'reopened'
    : status === 'cancelled' ? 'cancelled'
      : status === 'completed' ? 'completed'
        : status === 'snoozed' ? 'snoozed'
          : changes.assignedToUid ? 'reassigned'
            : changes.dueAt ? 'rescheduled'
              : body.contacted === true ? 'contacted'
                : changes.status ? status : 'updated';
  const event = eventFor(next, eventAction, actor, timestamp, {
    id: eventId,
    fromStatus: current.status,
    toStatus: status,
    outcome,
    dueAt,
    reason: cancelling || reopening ? reason : '',
    note: reason || boundedText(body.note, 'Catatan aktivitas', 1200),
    changes,
  });
  const result = { task: next, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      task: { collectionId: 'customerFollowUpTasks', documentId: id },
      event: { collectionId: 'customerFollowUpEvents', documentId: eventId },
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: 'customer-follow-up-update',
    writes: [
      firestore.setWrite('customerFollowUpTasks', id, next, { updateTime: currentDocument.updateTime }),
      firestore.setWrite('customerFollowUpEvents', eventId, event, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function cancelCustomerFollowUpTask({ actor, body, firestore, request, now = new Date() }) {
  return updateCustomerFollowUpTask({
    actor,
    body: { ...body, action: 'cancel', status: 'cancelled' },
    firestore,
    request,
    now,
  });
}
