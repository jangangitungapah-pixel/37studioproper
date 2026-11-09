import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import {
  buildRepositoryPrincipal,
  createRepositoryOperationId,
  createRepositoryPayloadHash,
  createRepositoryRequestId,
  runIdempotentFirestoreTransaction,
} from '../lib/firestoreRepositoryFoundation.js';

const TASKS = 'customerFollowUpTasks';
const EVENTS = 'customerFollowUpEvents';
const USERS = 'users';
const SCOPE = 'customer-follow-up';
const ACTIVE_STATUSES = Object.freeze(['open', 'in_progress', 'snoozed']);
const STATUSES = Object.freeze([...ACTIVE_STATUSES, 'completed', 'cancelled']);
const OUTCOMES = Object.freeze(['connected', 'no_answer', 'rescheduled', 'not_interested', 'paid', 'booked', 'other']);
const TEMPLATES = new Set(['payment', 'booking', 'comeback']);
const CHANGE_FIELDS = Object.freeze([
  'status',
  'dueAt',
  'dueTime',
  'assignedToUid',
  'assignedToName',
  'outcome',
  'notes',
  'description',
]);
const ALLOWED_TRANSITIONS = Object.freeze({
  open: ['in_progress', 'snoozed', 'completed', 'cancelled'],
  in_progress: ['open', 'snoozed', 'completed', 'cancelled'],
  snoozed: ['open', 'in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
});

function assertFirebase() {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }
}

function boundedText(value, label, maxLength, options = {}) {
  const text = String(value ?? '').trim();
  if (options.required && text.length < (options.minLength || 1)) {
    throw new Error(label + ' wajib diisi' + ((options.minLength || 1) > 1 ? ' minimal ' + options.minLength + ' karakter.' : '.'));
  }
  if (text.length > maxLength) throw new Error(label + ' maksimal ' + maxLength + ' karakter.');
  return text;
}

function isoNow() {
  return new Date().toISOString();
}

function businessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + '-' + values.month + '-' + values.day;
}

function validateDueAt(value) {
  const date = boundedText(value, 'Tanggal follow-up', 10, { required: true, minLength: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tanggal follow-up wajib menggunakan format YYYY-MM-DD.');
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Tanggal follow-up tidak valid.');
  }
  return date;
}

function validateDueTime(value) {
  const time = boundedText(value, 'Waktu follow-up', 5);
  if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Waktu follow-up harus menggunakan format 24 jam HH:mm.');
  }
  return time;
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
    customerName: boundedText(data.name || data.customer || data.displayName, 'Nama customer', 160, { required: true }),
    customerPhone: boundedText(data.phone || data.phoneNumber || data.customerPhoneKey, 'Nomor customer', 40),
  };
}

function isEligibleAssignee(user, uid, ownershipControl) {
  if (!user || user.status !== 'approved') return false;
  if (user.role === 'owner') return ownershipControl?.currentOwnerUid === uid;
  return user.role === 'admin' && user.permissions?.customers === true;
}

async function requirePrincipal(permission) {
  assertFirebase();
  const user = firebaseAuth?.currentUser;
  if (!user?.uid) throw new Error('Sesi login diperlukan.');
  const [userSnapshot, ownershipSnapshot] = await Promise.all([
    getDocFromServer(doc(firestoreDb, USERS, user.uid)),
    getDocFromServer(doc(firestoreDb, 'adminControl', 'ownership')),
  ]);
  const profile = userSnapshot.exists() ? { uid: userSnapshot.id, ...userSnapshot.data() } : null;
  const ownershipControl = ownershipSnapshot.exists() ? ownershipSnapshot.data() : null;
  const principal = buildRepositoryPrincipal({
    authUid: user.uid,
    userProfile: profile,
    ownershipControl,
  });
  if (!principal.active || !principal.hasPermission(permission)) {
    throw new Error('Akun tidak memiliki izin ' + permission + '.');
  }
  return {
    displayName: boundedText(profile?.displayName || user.displayName || user.email || 'Admin', 'Nama actor', 120, { required: true }),
    principal,
    uid: user.uid,
  };
}

async function normalizeRequestId(value) {
  const candidate = String(value || '').trim();
  if (/^[A-Za-z0-9._:-]{8,128}$/.test(candidate)) return candidate;
  if (candidate) return 'req_' + await createRepositoryPayloadHash({ idempotencyKey: candidate });
  return createRepositoryRequestId();
}

async function resolveCustomer(transaction, body) {
  const customerId = boundedText(body.customerId, 'Customer', 160, { required: true });
  const customerRef = doc(firestoreDb, 'customers', customerId);
  const customerDocument = await transaction.get(customerRef);
  if (customerDocument.exists()) {
    return {
      ...customerSnapshot(customerDocument.data()),
      customerId,
      sourceId: customerId,
      sourceType: 'customer',
    };
  }

  if (customerId.startsWith('auth_')) {
    const uid = customerId.slice(5);
    const userDocument = uid ? await transaction.get(doc(firestoreDb, USERS, uid)) : null;
    const user = userDocument?.exists() ? userDocument.data() : null;
    if (!user || user.role !== 'client' || user.status !== 'active') {
      throw new Error('Identitas client tidak ditemukan atau sudah tidak aktif.');
    }
    return {
      ...customerSnapshot(user),
      customerId,
      sourceId: uid,
      sourceType: 'client_account',
    };
  }

  const bookingId = boundedText(body.bookingId, 'Referensi booking', 160, { required: true });
  const bookingDocument = await transaction.get(doc(firestoreDb, 'bookings', bookingId));
  if (!bookingDocument.exists()) throw new Error('Booking sumber customer tidak ditemukan.');
  const booking = bookingDocument.data() || {};
  const snapshot = customerSnapshot(booking);
  const sourceCustomerId = boundedText(
    booking.customerId || fallbackCustomerId(booking.phone || booking.customerPhoneKey, snapshot.customerName),
    'Referensi customer booking',
    160,
  );
  if (sourceCustomerId !== customerId) throw new Error('Booking sumber tidak cocok dengan customer yang dipilih.');
  return {
    ...snapshot,
    customerId,
    sourceId: bookingId,
    sourceType: 'booking',
  };
}

async function resolveAssignee(transaction, uid) {
  const assigneeUid = boundedText(uid, 'PIC', 128, { required: true });
  const [userDocument, ownershipDocument] = await Promise.all([
    transaction.get(doc(firestoreDb, USERS, assigneeUid)),
    transaction.get(doc(firestoreDb, 'adminControl', 'ownership')),
  ]);
  const user = userDocument.exists() ? userDocument.data() : null;
  const ownershipControl = ownershipDocument.exists() ? ownershipDocument.data() : null;
  if (!isEligibleAssignee(user, assigneeUid, ownershipControl)) {
    throw new Error('PIC harus merupakan Owner aktif atau Admin aktif dengan akses Customer.');
  }
  return {
    assignedToUid: assigneeUid,
    assignedToName: boundedText(user.displayName || user.email, 'Nama PIC', 120, { required: true }),
  };
}

function validateStatus(value) {
  const status = boundedText(value, 'Status', 40, { required: true });
  if (!STATUSES.includes(status)) throw new Error('Status follow-up tidak valid.');
  return status;
}

function validateOutcome(value) {
  const outcome = boundedText(value, 'Outcome', 40);
  if (outcome && !OUTCOMES.includes(outcome)) throw new Error('Hasil follow-up tidak valid.');
  return outcome;
}

function makeChanges(before, after) {
  return CHANGE_FIELDS.reduce((changes, field) => {
    const previous = before?.[field] ?? '';
    const next = after?.[field] ?? '';
    if (previous !== next) changes[field] = { before: previous, after: next };
    return changes;
  }, {});
}

function stableSerialize(value) {
  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableSerialize(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

async function ensureFollowUpEvent(event) {
  const eventRef = doc(firestoreDb, EVENTS, event.id);
  const current = await getDocFromServer(eventRef);
  if (current.exists()) {
    if (stableSerialize(current.data()) !== stableSerialize(event)) {
      throw new Error('Event follow-up yang tersimpan tidak cocok dengan snapshot task.');
    }
    return { id: current.id, ...current.data() };
  }
  try {
    await setDoc(eventRef, event);
  } catch (error) {
    const retry = await getDocFromServer(eventRef);
    if (!retry.exists() || stableSerialize(retry.data()) !== stableSerialize(event)) throw error;
    return { id: retry.id, ...retry.data() };
  }
  return { id: event.id, ...event };
}

async function hydrateOperation(operation, taskId) {
  const resolvedTaskId = taskId || operation.result.id;
  const taskSnapshot = await getDocFromServer(doc(firestoreDb, TASKS, resolvedTaskId));
  if (!taskSnapshot.exists()) throw new Error('Task follow-up hasil operasi tidak ditemukan.');
  const task = { id: taskSnapshot.id, ...taskSnapshot.data() };
  let event;
  if (task.lastEventSnapshot?.id === task.lastEventId) {
    event = await ensureFollowUpEvent(task.lastEventSnapshot);
  } else {
    const eventSnapshot = await getDocFromServer(doc(firestoreDb, EVENTS, task.lastEventId));
    if (!eventSnapshot.exists()) throw new Error('Event follow-up hasil operasi tidak ditemukan.');
    event = { id: eventSnapshot.id, ...eventSnapshot.data() };
  }
  return { task, event, duplicate: operation.replayed };
}

export async function getCanonicalCustomerFollowUpAssignees() {
  const actor = await requirePrincipal('customers');
  const [userSnapshot, ownershipSnapshot] = await Promise.all([
    getDocsFromServer(query(
      collection(firestoreDb, USERS),
      where('role', 'in', ['owner', 'admin']),
      limit(100),
    )),
    getDocFromServer(doc(firestoreDb, 'adminControl', 'ownership')),
  ]);
  const ownershipControl = ownershipSnapshot.exists() ? ownershipSnapshot.data() : null;
  const assignees = userSnapshot.docs
    .filter((item) => isEligibleAssignee(item.data(), item.id, ownershipControl))
    .map((item) => ({
      uid: item.id,
      displayName: boundedText(item.data().displayName || item.data().email, 'Nama PIC', 120) || 'Admin',
      role: item.data().role,
    }))
    .sort((first, second) => first.displayName.localeCompare(second.displayName, 'id'));

  if (!assignees.some((item) => item.uid === actor.uid)) {
    const currentSnapshot = await getDocFromServer(doc(firestoreDb, USERS, actor.uid));
    if (currentSnapshot.exists() && isEligibleAssignee(currentSnapshot.data(), actor.uid, ownershipControl)) {
      assignees.push({
        uid: actor.uid,
        displayName: boundedText(currentSnapshot.data().displayName || firebaseAuth.currentUser?.displayName, 'Nama PIC', 120) || 'Admin',
        role: currentSnapshot.data().role,
      });
    }
  }
  return { assignees, currentActorUid: actor.uid };
}

export async function createCanonicalCustomerFollowUpTask(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal('customers');
  const body = input && typeof input === 'object' ? input : {};
  const requestId = await normalizeRequestId(idempotencyKey);
  const action = 'create';
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid,
    scope: SCOPE,
    action,
    requestId,
  });
  const taskId = 'fup_' + operationId.slice(3);
  const eventId = 'fue_' + operationId.slice(3);
  const timestamp = isoNow();
  const title = boundedText(body.title, 'Judul task', 160, { required: true, minLength: 3 });
  const description = boundedText(body.description, 'Deskripsi', 1200);
  const notes = boundedText(body.notes, 'Catatan', 1200);
  const dueAt = validateDueAt(body.dueAt);
  const dueTime = validateDueTime(body.dueTime);
  const templateKey = boundedText(body.templateKey || 'payment', 'Template', 40, { required: true });
  if (!TEMPLATES.has(templateKey)) throw new Error('Template follow-up tidak dikenal.');

  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: SCOPE,
    action,
    requestId,
    payload: {
      customerId: body.customerId,
      bookingId: body.bookingId || '',
      assignedToUid: body.assignedToUid || actor.uid,
      title,
      description,
      notes,
      dueAt,
      dueTime,
      templateKey,
    },
    execute: async (transaction, metadata) => {
      const taskRef = doc(firestoreDb, TASKS, taskId);
      const eventRef = doc(firestoreDb, EVENTS, eventId);
      const [existingTask, existingEvent] = await Promise.all([
        transaction.get(taskRef),
        transaction.get(eventRef),
      ]);
      if (existingTask.exists() || existingEvent.exists()) {
        throw new Error('ID task follow-up sudah digunakan oleh dokumen lain.');
      }
      const [customer, assignee] = await Promise.all([
        resolveCustomer(transaction, body),
        resolveAssignee(transaction, body.assignedToUid || actor.uid),
      ]);
      const bookingId = customer.sourceType === 'booking' ? customer.sourceId : '';
      const task = {
        ...customer,
        ...assignee,
        bookingId,
        id: taskId,
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
        lastOperationId: metadata.operationId,
        lastOperationAction: action,
        lastEventId: eventId,
        lastEventSnapshot: {},
      };
      const event = {
        id: eventId,
        taskId,
        customerId: task.customerId,
        action: 'created',
        actorUid: actor.uid,
        actorName: actor.displayName,
        changes: {
          status: { before: '', after: 'open' },
          dueAt: { before: '', after: dueAt },
          dueTime: { before: '', after: dueTime },
          assignedToUid: { before: '', after: assignee.assignedToUid },
          assignedToName: { before: '', after: assignee.assignedToName },
        },
        note: title,
        createdAt: timestamp,
        operationId: metadata.operationId,
        operationAction: action,
      };
      task.lastEventSnapshot = event;
      transaction.set(taskRef, task);
      return { collection: TASKS, id: taskId };
    },
  });
  return hydrateOperation(operation, taskId);
}

export async function updateCanonicalCustomerFollowUpTask(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal('customers');
  const body = input && typeof input === 'object' ? input : {};
  const taskId = boundedText(body.taskId || body.id, 'Task', 160, { required: true });
  const expectedUpdatedAt = boundedText(body.expectedUpdatedAt, 'Revision task', 40, { required: true });
  const requestId = await normalizeRequestId(idempotencyKey);
  const action = 'update';
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid,
    scope: SCOPE,
    action,
    requestId,
  });
  const eventId = 'fue_' + operationId.slice(3);
  const timestamp = isoNow();

  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: SCOPE,
    action,
    requestId,
    payload: JSON.parse(JSON.stringify({
      taskId,
      expectedUpdatedAt,
      action: body.action || '',
      status: body.status || '',
      dueAt: Object.prototype.hasOwnProperty.call(body, 'dueAt') ? body.dueAt : null,
      dueTime: Object.prototype.hasOwnProperty.call(body, 'dueTime') ? body.dueTime : null,
      assignedToUid: Object.prototype.hasOwnProperty.call(body, 'assignedToUid') ? body.assignedToUid : null,
      outcome: Object.prototype.hasOwnProperty.call(body, 'outcome') ? body.outcome : null,
      notes: Object.prototype.hasOwnProperty.call(body, 'notes') ? body.notes : null,
      note: Object.prototype.hasOwnProperty.call(body, 'note') ? body.note : null,
      description: Object.prototype.hasOwnProperty.call(body, 'description') ? body.description : null,
      contacted: body.contacted === true,
      reason: body.reason || '',
    })),
    execute: async (transaction, metadata) => {
      const taskRef = doc(firestoreDb, TASKS, taskId);
      const eventRef = doc(firestoreDb, EVENTS, eventId);
      const [taskDocument, existingEvent] = await Promise.all([
        transaction.get(taskRef),
        transaction.get(eventRef),
      ]);
      if (!taskDocument.exists()) throw new Error('Task follow-up tidak ditemukan.');
      if (existingEvent.exists()) throw new Error('ID event follow-up sudah digunakan oleh dokumen lain.');
      const current = { id: taskDocument.id, ...taskDocument.data() };
      if (expectedUpdatedAt !== current.updatedAt) {
        throw new Error('Task berubah. Muat ulang sebelum menyimpan.');
      }

      const actionName = boundedText(body.action, 'Aksi', 40);
      const reopening = actionName === 'reopen';
      const cancelling = actionName === 'cancel';
      const reason = boundedText(body.reason || body.note, 'Alasan', 600);
      let status = reopening ? 'open' : validateStatus(body.status || current.status);

      if (reopening) {
        if (!['completed', 'cancelled'].includes(current.status)) {
          throw new Error('Hanya task selesai atau dibatalkan yang dapat dibuka kembali.');
        }
        if (reason.length < 4) throw new Error('Alasan membuka kembali task minimal 4 karakter.');
      } else {
        if (['completed', 'cancelled'].includes(current.status)) {
          throw new Error('Task sudah ditutup. Gunakan aksi buka kembali dengan alasan.');
        }
        if (status !== current.status && !ALLOWED_TRANSITIONS[current.status]?.includes(status)) {
          throw new Error('Perubahan status follow-up tidak diizinkan.');
        }
      }

      if (cancelling || status === 'cancelled') {
        if (reason.length < 4) throw new Error('Alasan pembatalan minimal 4 karakter.');
        status = 'cancelled';
      }

      const dueAt = Object.prototype.hasOwnProperty.call(body, 'dueAt') ? validateDueAt(body.dueAt) : current.dueAt;
      const dueTime = Object.prototype.hasOwnProperty.call(body, 'dueTime') ? validateDueTime(body.dueTime) : current.dueTime || '';
      if (status === 'snoozed' && dueAt <= businessDate(new Date(timestamp))) {
        throw new Error('Tanggal snooze harus setelah hari ini menurut WIB.');
      }

      const outcome = reopening
        ? ''
        : Object.prototype.hasOwnProperty.call(body, 'outcome')
          ? validateOutcome(body.outcome)
          : current.outcome;
      if (status === 'completed' && !outcome) throw new Error('Pilih hasil follow-up sebelum menyelesaikan task.');
      if (body.contacted === true && !outcome) throw new Error('Catat outcome komunikasi sebelum menandai sudah dihubungi.');

      const assignee = Object.prototype.hasOwnProperty.call(body, 'assignedToUid')
        ? await resolveAssignee(transaction, body.assignedToUid)
        : { assignedToUid: current.assignedToUid, assignedToName: current.assignedToName };
      const notes = Object.prototype.hasOwnProperty.call(body, 'notes') || Object.prototype.hasOwnProperty.call(body, 'note')
        ? boundedText(Object.prototype.hasOwnProperty.call(body, 'notes') ? body.notes : body.note, 'Catatan', 1200)
        : current.notes;
      const description = Object.prototype.hasOwnProperty.call(body, 'description')
        ? boundedText(body.description, 'Deskripsi', 1200)
        : current.description;
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
        lastOperationId: metadata.operationId,
        lastOperationAction: action,
        lastEventId: eventId,
        lastEventSnapshot: {},
      };

      const changes = makeChanges(current, next);
      if (!Object.keys(changes).length && !body.contacted) {
        throw new Error('Tidak ada perubahan untuk disimpan.');
      }
      const eventAction = reopening ? 'reopened'
        : status === 'cancelled' ? 'cancelled'
          : status === 'completed' ? 'completed'
            : status === 'snoozed' ? 'snoozed'
              : changes.assignedToUid ? 'reassigned'
                : changes.dueAt ? 'rescheduled'
                  : body.contacted === true ? 'contacted'
                    : changes.status ? status : 'updated';
      const event = {
        id: eventId,
        taskId,
        customerId: next.customerId,
        action: eventAction,
        actorUid: actor.uid,
        actorName: actor.displayName,
        changes,
        fromStatus: current.status,
        toStatus: status,
        outcome,
        dueAt,
        reason: cancelling || reopening ? reason : '',
        note: reason || boundedText(body.note, 'Catatan aktivitas', 1200),
        createdAt: timestamp,
        operationId: metadata.operationId,
        operationAction: action,
      };
      next.lastEventSnapshot = event;
      transaction.set(taskRef, next);
      return { collection: TASKS, id: taskId };
    },
  });
  return hydrateOperation(operation, taskId);
}

export async function cancelCanonicalCustomerFollowUpTask(input = {}, idempotencyKey = '') {
  return updateCanonicalCustomerFollowUpTask({
    ...input,
    action: 'cancel',
    status: 'cancelled',
  }, idempotencyKey);
}
