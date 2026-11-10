import {
  collection,
  doc,
  getDocFromServer,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import {
  buildRepositoryPrincipal,
  createRepositoryOperationId,
  createRepositoryRequestId,
  runIdempotentFirestoreTransaction,
} from '../lib/firestoreRepositoryFoundation.js';

const WORK_ORDERS = 'maintenanceWorkOrders';
const EVENTS = 'maintenanceEvents';
const INVENTORY_ITEMS = 'inventoryItems';
const LEDGER = 'bookkeepingEntries';
const CLOSINGS = 'cashClosingSessions';
const SCOPE = 'maintenance';
const ACTIVE_STATUSES = new Set([
  'reported', 'triaged', 'approved', 'assigned',
  'in_progress', 'waiting_parts', 'completed',
]);
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const PAYMENT_METHODS = new Set(['cash', 'transfer', 'qris', 'other']);
const TRANSITIONS = Object.freeze({
  triage: { from: ['reported'], to: 'triaged' },
  approve: { from: ['triaged'], to: 'approved' },
  assign: { from: ['approved'], to: 'assigned' },
  start: { from: ['assigned'], to: 'in_progress' },
  waiting_parts: { from: ['in_progress'], to: 'waiting_parts' },
  resume: { from: ['waiting_parts'], to: 'in_progress' },
  complete: { from: ['in_progress'], to: 'completed' },
  verify: { from: ['completed'], to: 'verified' },
  cancel: {
    from: ['reported', 'triaged', 'approved', 'assigned', 'in_progress', 'waiting_parts'],
    to: 'cancelled',
  },
  reopen: { from: ['verified'], to: 'in_progress' },
});

function assertFirebase() {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }
}

function cleanText(value, label, maxLength, required = false) {
  const result = String(value ?? '').trim();
  if (result.length > maxLength || (required && !result)) {
    throw new Error(label + (required ? ' wajib diisi.' : ' melebihi batas karakter.'));
  }
  return result;
}

function finiteMoney(value, label) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000000000) {
    throw new Error(label + ' harus berupa nominal 0 sampai 1.000.000.000.');
  }
  return Math.round(parsed * 100) / 100;
}

function isoNow() {
  return new Date().toISOString();
}

function dateTime(value, label, optional = false) {
  if ((value === undefined || value === null || value === '') && optional) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(label + ' tidak valid.');
  return parsed.toISOString();
}

function businessDate(value) {
  const date = cleanText(value, 'Tanggal biaya', 10, true);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
    throw new Error('Tanggal biaya wajib menggunakan format YYYY-MM-DD.');
  }
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Tanggal biaya tidak valid.');
  }
  return date;
}

function normalizeAttachments(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Lampiran harus berupa daftar referensi.');
  return value.slice(0, 10).map((entry) => {
    const url = cleanText(entry?.url, 'URL lampiran', 2000, true);
    if (!/^https:\\/\\//i.test(url)) {
      throw new Error('Referensi lampiran harus menggunakan URL HTTPS.');
    }
    return {
      label: cleanText(entry?.label, 'Label lampiran', 100) || 'Lampiran',
      url,
    };
  });
}

async function normalizeRequestId(value) {
  const candidate = String(value || '').trim();
  if (/^[A-Za-z0-9._:-]{8,128}$/.test(candidate)) return candidate;
  if (candidate) throw new Error('Request ID operasi tidak valid.');
  return createRepositoryRequestId();
}

async function requirePrincipal(permission) {
  assertFirebase();
  const user = firebaseAuth?.currentUser;
  if (!user?.uid) throw new Error('Sesi login diperlukan.');
  const [userSnapshot, ownershipSnapshot] = await Promise.all([
    getDocFromServer(doc(firestoreDb, 'users', user.uid)),
    getDocFromServer(doc(firestoreDb, 'adminControl', 'ownership')),
  ]);
  const profile = userSnapshot.exists()
    ? { ...userSnapshot.data(), uid: userSnapshot.id }
    : null;
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
    uid: user.uid,
    displayName: cleanText(
      profile?.displayName || user.displayName || user.email || 'Admin',
      'Nama actor',
      120,
      true,
    ),
    role: principal.role,
    principal,
  };
}

function assertExpectedRevision(workOrder, expectedRevision, expectedStatus) {
  const expected = Number(expectedRevision);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error('Revision work order wajib disertakan.');
  }
  if (expected !== Number(workOrder.revision || 0)) {
    throw new Error('Work order sudah berubah. Muat ulang data terbaru sebelum melanjutkan.');
  }
  if (expectedStatus && expectedStatus !== workOrder.status) {
    throw new Error('Status work order sudah berubah. Muat ulang data terbaru sebelum melanjutkan.');
  }
}

function createEvent({
  actor,
  action,
  operationAction,
  fromStatus,
  toStatus,
  workOrder,
  reason = '',
  details = {},
  timestamp,
  eventId,
  operationId,
  revision,
}) {
  return {
    action,
    actorName: actor.displayName,
    actorUid: actor.uid,
    createdAt: timestamp,
    details,
    fromStatus: fromStatus || '',
    id: eventId,
    inventoryItemId: workOrder.inventoryItemId,
    operationAction,
    operationId,
    reason: cleanText(reason, 'Alasan event', 600),
    revision,
    toStatus,
    workOrderId: workOrder.id,
  };
}

function activeOrdersQuery(itemId) {
  return query(
    collection(firestoreDb, WORK_ORDERS),
    where('inventoryItemId', '==', itemId),
    limit(500),
  );
}

async function hydrateWorkOrderOperation(operation, eventId, itemId, options = {}) {
  const workOrderId = operation.result.id;
  const [workOrderSnapshot, eventSnapshot, itemSnapshot] = await Promise.all([
    getDocFromServer(doc(firestoreDb, WORK_ORDERS, workOrderId)),
    getDocFromServer(doc(firestoreDb, EVENTS, eventId)),
    itemId ? getDocFromServer(doc(firestoreDb, INVENTORY_ITEMS, itemId)) : Promise.resolve(null),
  ]);
  if (!workOrderSnapshot.exists()) {
    throw new Error('Work order hasil operasi tidak ditemukan di Firestore.');
  }
  if (!eventSnapshot.exists()) {
    throw new Error('Event maintenance hasil operasi belum ditemukan. Gunakan request ID yang sama untuk pemulihan.');
  }
  const result = {
    workOrder: { id: workOrderSnapshot.id, ...workOrderSnapshot.data() },
    event: { id: eventSnapshot.id, ...eventSnapshot.data() },
    item: itemSnapshot?.exists()
      ? { id: itemSnapshot.id, ...itemSnapshot.data() }
      : null,
    duplicate: operation.replayed,
  };
  if (options.includeLedger) {
    const ledgerSnapshot = await getDocFromServer(doc(firestoreDb, LEDGER, options.ledgerId));
    if (!ledgerSnapshot.exists()) {
      throw new Error('Expense maintenance hasil operasi belum ditemukan. Gunakan request ID yang sama untuk pemulihan.');
    }
    result.entry = { id: ledgerSnapshot.id, ...ledgerSnapshot.data() };
  }
  return result;
}

function validateReportInput(body) {
  const title = cleanText(body.title, 'Judul masalah', 160, true);
  const description = cleanText(body.description, 'Deskripsi masalah', 2000, true);
  if (title.length < 3) throw new Error('Judul masalah minimal 3 karakter.');
  if (description.length < 4) throw new Error('Deskripsi masalah minimal 4 karakter.');
  const plannedAt = dateTime(body.plannedAt, 'Jadwal maintenance', true);
  const dueAt = dateTime(body.dueAt, 'Target penyelesaian', true);
  if (plannedAt && dueAt && new Date(dueAt).getTime() < new Date(plannedAt).getTime()) {
    throw new Error('Target penyelesaian tidak boleh lebih awal dari jadwal maintenance.');
  }
  const priority = cleanText(body.priority || 'normal', 'Prioritas', 20).toLowerCase();
  if (!PRIORITIES.has(priority)) throw new Error('Prioritas harus low, normal, high, atau urgent.');
  return {
    inventoryItemId: cleanText(body.inventoryItemId, 'Equipment', 160, true),
    title,
    description,
    priority,
    plannedAt,
    dueAt,
    vendor: cleanText(body.vendor, 'Vendor', 160),
    estimatedCost: finiteMoney(body.estimatedCost, 'Estimasi biaya'),
    attachments: normalizeAttachments(body.attachments),
  };
}

export async function reportCanonicalMaintenanceWorkOrder(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal('inventory');
  const body = validateReportInput(input && typeof input === 'object' ? input : {});
  const requestId = await normalizeRequestId(idempotencyKey);
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid,
    scope: SCOPE,
    action: 'report',
    requestId,
  });
  const workOrderId = 'mwo_' + operationId.slice(3);
  const eventId = 'mwe_' + operationId.slice(3);
  const timestamp = isoNow();

  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: SCOPE,
    action: 'report',
    requestId,
    payload: body,
    execute: async (transaction, marker) => {
      const itemRef = doc(firestoreDb, INVENTORY_ITEMS, body.inventoryItemId);
      const workOrderRef = doc(firestoreDb, WORK_ORDERS, workOrderId);
      const eventRef = doc(firestoreDb, EVENTS, eventId);
      const [itemSnapshot, workOrderSnapshot, eventSnapshot, activeOrdersSnapshot] = await Promise.all([
        transaction.get(itemRef),
        transaction.get(workOrderRef),
        transaction.get(eventRef),
        transaction.get(activeOrdersQuery(body.inventoryItemId)),
      ]);
      if (!itemSnapshot.exists()) throw new Error('Equipment tidak ditemukan di Inventory.');
      if (workOrderSnapshot.exists() || eventSnapshot.exists()) {
        throw new Error('ID work order atau event maintenance sudah digunakan.');
      }
      const activeOrder = activeOrdersSnapshot.docs.find((snapshot) => (
        ACTIVE_STATUSES.has(String(snapshot.data()?.status || ''))
      ));
      const item = { id: itemSnapshot.id, ...itemSnapshot.data() };
      if (item.activeMaintenanceWorkOrderId || activeOrder) {
        throw new Error(
          'Equipment masih memiliki work order aktif: ' +
          (item.activeMaintenanceWorkOrderId || activeOrder?.id || '') + '.',
        );
      }
      if (['inactive', 'lost'].includes(String(item.status || '').trim())) {
        throw new Error('Equipment nonaktif atau hilang tidak dapat dibuatkan work order baru.');
      }

      const workOrder = {
        id: workOrderId,
        inventoryItemId: item.id,
        itemName: cleanText(item.name, 'Nama equipment', 160, true),
        itemCategory: cleanText(item.category, 'Kategori equipment', 80),
        itemLocation: cleanText(item.location, 'Lokasi equipment', 240),
        title: body.title,
        description: body.description,
        priority: body.priority,
        status: 'reported',
        reportedAt: timestamp,
        reportedByUid: actor.uid,
        reportedByName: actor.displayName,
        assignedToUid: '',
        assignedToName: '',
        plannedAt: body.plannedAt,
        dueAt: body.dueAt,
        diagnosis: '',
        repairNotes: '',
        verificationNote: '',
        verificationCondition: '',
        vendor: body.vendor,
        estimatedCost: body.estimatedCost,
        actualCost: 0,
        costEntryId: '',
        attachments: body.attachments,
        priorItemStatus: cleanText(item.status, 'Status equipment', 40) || 'active',
        priorItemCondition: cleanText(item.condition, 'Kondisi equipment', 40) || 'good',
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedByUid: actor.uid,
        updatedByName: actor.displayName,
        lastOperationId: marker.operationId,
        lastOperationAction: 'report',
        lastEventId: eventId,
      };
      const nextItem = {
        ...item,
        condition: 'maintenance',
        status: 'maintenance',
        activeMaintenanceWorkOrderId: workOrderId,
        lastMaintenanceWorkOrderId: workOrderId,
        updatedAt: timestamp,
      };
      const event = createEvent({
        actor,
        action: 'reported',
        operationAction: 'report',
        fromStatus: '',
        toStatus: 'reported',
        workOrder,
        details: { title: body.title, priority: body.priority, itemName: workOrder.itemName },
        timestamp,
        eventId,
        operationId: marker.operationId,
        revision: 1,
      });
      transaction.set(itemRef, nextItem);
      transaction.set(workOrderRef, workOrder);
      transaction.set(eventRef, event);
      return { collection: WORK_ORDERS, id: workOrderId };
    },
  });

  return hydrateWorkOrderOperation(operation, eventId, body.inventoryItemId);
}

function buildLifecycleChange({ action, body, actor, current, item, timestamp, eventId, marker }) {
  const policy = TRANSITIONS[action];
  if (!policy || !policy.from.includes(current.status)) {
    throw new Error('Aksi ' + action + ' tidak tersedia untuk status ' + current.status + '.');
  }
  const nextWorkOrder = {
    ...current,
    revision: Number(current.revision || 0) + 1,
    status: policy.to,
    updatedAt: timestamp,
    updatedByUid: actor.uid,
    updatedByName: actor.displayName,
    lastOperationId: marker.operationId,
    lastOperationAction: action,
    lastEventId: eventId,
  };
  let nextItem = {
    ...item,
    updatedAt: timestamp,
    lastMaintenanceWorkOrderId: current.id,
    activeMaintenanceWorkOrderId: current.id,
  };
  let reason = cleanText(body.reason, 'Alasan', 600);
  const details = {};

  if (action === 'triage') {
    const diagnosis = cleanText(body.diagnosis, 'Diagnosis awal', 2000, true);
    if (diagnosis.length < 4) throw new Error('Diagnosis awal minimal 4 karakter.');
    const priority = cleanText(body.priority || current.priority, 'Prioritas', 20).toLowerCase();
    if (!PRIORITIES.has(priority)) throw new Error('Prioritas tidak valid.');
    nextWorkOrder.diagnosis = diagnosis;
    nextWorkOrder.priority = priority;
    nextWorkOrder.triagedAt = timestamp;
    nextWorkOrder.triagedByUid = actor.uid;
    nextWorkOrder.triagedByName = actor.displayName;
    details.diagnosis = diagnosis;
    details.priority = priority;
  } else if (action === 'approve') {
    nextWorkOrder.approvedAt = timestamp;
    nextWorkOrder.approvedByUid = actor.uid;
    nextWorkOrder.approvedByName = actor.displayName;
    nextWorkOrder.approvalNote = cleanText(body.note, 'Catatan approval', 600);
    details.note = nextWorkOrder.approvalNote;
  } else if (action === 'assign') {
    const assignedToName = cleanText(body.assignedToName, 'Nama PIC', 120, true);
    const plannedAt = dateTime(body.plannedAt, 'Jadwal maintenance', true);
    const dueAt = dateTime(body.dueAt, 'Target penyelesaian', true);
    if (plannedAt && dueAt && new Date(dueAt).getTime() < new Date(plannedAt).getTime()) {
      throw new Error('Target selesai tidak boleh sebelum jadwal maintenance.');
    }
    nextWorkOrder.assignedToName = assignedToName;
    nextWorkOrder.assignedToUid = cleanText(body.assignedToUid, 'UID PIC', 128);
    nextWorkOrder.plannedAt = plannedAt || current.plannedAt || '';
    nextWorkOrder.dueAt = dueAt || current.dueAt || '';
    nextWorkOrder.assignedAt = timestamp;
    nextWorkOrder.assignedByUid = actor.uid;
    details.assignedToName = assignedToName;
    details.plannedAt = nextWorkOrder.plannedAt;
    details.dueAt = nextWorkOrder.dueAt;
  } else if (action === 'start') {
    if (!cleanText(current.assignedToName, 'Nama PIC', 120, true)) {
      throw new Error('Work order harus ditugaskan sebelum pekerjaan dimulai.');
    }
    nextWorkOrder.startedAt = timestamp;
    nextWorkOrder.startedByUid = actor.uid;
  } else if (action === 'waiting_parts') {
    if (reason.length < 4) throw new Error('Alasan menunggu spare part minimal 4 karakter.');
    nextWorkOrder.waitingPartsAt = timestamp;
    nextWorkOrder.waitingPartsReason = reason;
    details.reason = reason;
  } else if (action === 'resume') {
    nextWorkOrder.resumedAt = timestamp;
    nextWorkOrder.resumeNote = cleanText(body.note, 'Catatan resume', 600);
    details.note = nextWorkOrder.resumeNote;
  } else if (action === 'complete') {
    const repairNotes = cleanText(body.repairNotes, 'Catatan perbaikan', 2000, true);
    if (repairNotes.length < 4) throw new Error('Catatan perbaikan minimal 4 karakter.');
    nextWorkOrder.repairNotes = repairNotes;
    nextWorkOrder.completedAt = timestamp;
    nextWorkOrder.completedByUid = actor.uid;
    nextWorkOrder.completedByName = actor.displayName;
    details.repairNotes = repairNotes;
  } else if (action === 'verify') {
    const condition = cleanText(body.verificationCondition, 'Hasil verifikasi', 20).toLowerCase();
    if (!['good', 'fair', 'broken'].includes(condition)) {
      throw new Error('Hasil verifikasi wajib good, fair, atau broken.');
    }
    const verificationNote = cleanText(body.verificationNote, 'Catatan verifikasi', 1000);
    if (condition === 'broken' && verificationNote.length < 4) {
      throw new Error('Catatan wajib diisi jika equipment belum layak digunakan.');
    }
    nextWorkOrder.verificationCondition = condition;
    nextWorkOrder.verificationNote = verificationNote;
    nextWorkOrder.verifiedAt = timestamp;
    nextWorkOrder.verifiedByUid = actor.uid;
    nextWorkOrder.verifiedByName = actor.displayName;
    nextItem.condition = condition;
    nextItem.status = condition === 'broken' ? 'broken' : 'active';
    nextItem.activeMaintenanceWorkOrderId = '';
    details.verificationCondition = condition;
    details.verificationNote = verificationNote;
  } else if (action === 'cancel') {
    if (reason.length < 4) throw new Error('Alasan pembatalan minimal 4 karakter.');
    nextWorkOrder.cancelledAt = timestamp;
    nextWorkOrder.cancelledByUid = actor.uid;
    nextWorkOrder.cancelReason = reason;
    nextItem.condition = cleanText(
      current.reopenPriorItemCondition || current.priorItemCondition || 'good',
      'Kondisi sebelumnya',
      40,
    );
    nextItem.status = cleanText(
      current.reopenPriorItemStatus || current.priorItemStatus || 'active',
      'Status sebelumnya',
      40,
    );
    nextItem.activeMaintenanceWorkOrderId = '';
    details.reason = reason;
  } else if (action === 'reopen') {
    if (reason.length < 4) throw new Error('Alasan reopen minimal 4 karakter.');
    if (item.activeMaintenanceWorkOrderId && item.activeMaintenanceWorkOrderId !== current.id) {
      throw new Error('Equipment sudah memiliki work order aktif lain.');
    }
    nextWorkOrder.reopenPriorItemStatus = cleanText(item.status, 'Status sebelumnya', 40) || 'active';
    nextWorkOrder.reopenPriorItemCondition = cleanText(item.condition, 'Kondisi sebelumnya', 40) || 'good';
    nextWorkOrder.reopenedAt = timestamp;
    nextWorkOrder.reopenedByUid = actor.uid;
    nextWorkOrder.reopenedByName = actor.displayName;
    nextWorkOrder.reopenReason = reason;
    nextItem.condition = 'maintenance';
    nextItem.status = 'maintenance';
    details.reason = reason;
  }

  const eventAction = action;
  const event = createEvent({
    actor,
    action: eventAction,
    operationAction: action,
    fromStatus: current.status,
    toStatus: nextWorkOrder.status,
    workOrder: current,
    reason,
    details,
    timestamp,
    eventId,
    operationId: marker.operationId,
    revision: nextWorkOrder.revision,
  });
  return { nextWorkOrder, nextItem, event };
}

export async function actOnCanonicalMaintenanceWorkOrder(input = {}, idempotencyKey = '') {
  const body = input && typeof input === 'object' ? input : {};
  const action = cleanText(body.action, 'Aksi maintenance', 40).toLowerCase();
  if (!TRANSITIONS[action]) throw new Error('Aksi maintenance tidak valid.');
  const actor = await requirePrincipal('inventory');
  if (action === 'reopen' && !actor.principal.isOwner) {
    throw new Error('Hanya Owner yang dapat membuka kembali work order.');
  }
  const workOrderId = cleanText(body.workOrderId, 'Work order', 160, true);
  const requestId = await normalizeRequestId(idempotencyKey);
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid,
    scope: SCOPE,
    action,
    requestId,
  });
  const eventId = 'mwe_' + operationId.slice(3);
  const timestamp = isoNow();

  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: SCOPE,
    action,
    requestId,
    payload: {
      action,
      expectedRevision: body.expectedRevision,
      expectedStatus: body.expectedStatus || '',
      workOrderId,
      diagnosis: body.diagnosis || '',
      priority: body.priority || '',
      note: body.note || '',
      assignedToName: body.assignedToName || '',
      assignedToUid: body.assignedToUid || '',
      plannedAt: body.plannedAt || '',
      dueAt: body.dueAt || '',
      reason: body.reason || '',
      repairNotes: body.repairNotes || '',
      verificationCondition: body.verificationCondition || '',
      verificationNote: body.verificationNote || '',
    },
    execute: async (transaction, marker) => {
      const workOrderRef = doc(firestoreDb, WORK_ORDERS, workOrderId);
      const eventRef = doc(firestoreDb, EVENTS, eventId);
      const workOrderSnapshot = await transaction.get(workOrderRef);
      if (!workOrderSnapshot.exists()) throw new Error('Work order maintenance tidak ditemukan.');
      const current = { id: workOrderSnapshot.id, ...workOrderSnapshot.data() };
      assertExpectedRevision(current, body.expectedRevision, body.expectedStatus);
      const itemRef = doc(firestoreDb, INVENTORY_ITEMS, current.inventoryItemId);
      const eventSnapshot = await transaction.get(eventRef);
      const itemSnapshot = await transaction.get(itemRef);
      if (!itemSnapshot.exists()) throw new Error('Equipment tidak ditemukan di Inventory.');
      if (eventSnapshot.exists()) throw new Error('ID event maintenance sudah digunakan.');
      const item = { id: itemSnapshot.id, ...itemSnapshot.data() };
      if (action === 'reopen') {
        const activeOrdersSnapshot = await transaction.get(activeOrdersQuery(item.id));
        const otherActive = activeOrdersSnapshot.docs.find((snapshot) => (
          snapshot.id !== current.id && ACTIVE_STATUSES.has(String(snapshot.data()?.status || ''))
        ));
        if (otherActive) throw new Error('Equipment sudah memiliki work order aktif lain.');
      }
      if (action !== 'reopen' && item.activeMaintenanceWorkOrderId &&
          item.activeMaintenanceWorkOrderId !== current.id) {
        throw new Error('Equipment sedang dikunci oleh work order lain.');
      }
      const result = buildLifecycleChange({
        action,
        body,
        actor,
        current,
        item,
        timestamp,
        eventId,
        marker,
      });
      transaction.set(workOrderRef, result.nextWorkOrder);
      transaction.set(itemRef, result.nextItem);
      transaction.set(eventRef, result.event);
      return { collection: WORK_ORDERS, id: workOrderId };
    },
  });

  return hydrateWorkOrderOperation(operation, eventId, '');
}

export async function reopenCanonicalMaintenanceWorkOrder(input = {}, idempotencyKey = '') {
  return actOnCanonicalMaintenanceWorkOrder({
    ...input,
    action: 'reopen',
  }, idempotencyKey);
}

export async function recordCanonicalMaintenanceCost(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal('bookkeeping');
  const body = input && typeof input === 'object' ? input : {};
  const workOrderId = cleanText(body.workOrderId, 'Work order', 160, true);
  const amount = finiteMoney(body.amount, 'Biaya aktual');
  if (amount <= 0) throw new Error('Biaya aktual harus lebih dari nol.');
  const paymentMethod = cleanText(body.paymentMethod, 'Metode pembayaran', 20).toLowerCase();
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    throw new Error('Metode harus cash, transfer, qris, atau other.');
  }
  const note = cleanText(body.note, 'Catatan biaya', 600, true);
  if (note.length < 4) throw new Error('Catatan biaya minimal 4 karakter.');
  const date = businessDate(body.date);
  const requestId = await normalizeRequestId(idempotencyKey);
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid,
    scope: SCOPE,
    action: 'cost',
    requestId,
  });
  const eventId = 'mwe_' + operationId.slice(3);
  const entryId = 'mce_' + operationId.slice(3);
  const closingId = date + '__main';
  const timestamp = isoNow();

  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: SCOPE,
    action: 'cost',
    requestId,
    payload: { workOrderId, expectedRevision: body.expectedRevision, amount, paymentMethod, date, note },
    execute: async (transaction, marker) => {
      const workOrderRef = doc(firestoreDb, WORK_ORDERS, workOrderId);
      const eventRef = doc(firestoreDb, EVENTS, eventId);
      const entryRef = doc(firestoreDb, LEDGER, entryId);
      const fenceRef = doc(firestoreDb, CLOSINGS, closingId);
      const [workOrderSnapshot, eventSnapshot, entrySnapshot, fenceSnapshot] = await Promise.all([
        transaction.get(workOrderRef),
        transaction.get(eventRef),
        transaction.get(entryRef),
        transaction.get(fenceRef),
      ]);
      if (!workOrderSnapshot.exists()) throw new Error('Work order maintenance tidak ditemukan.');
      if (eventSnapshot.exists() || entrySnapshot.exists()) {
        throw new Error('ID event atau expense maintenance sudah digunakan.');
      }
      const current = { id: workOrderSnapshot.id, ...workOrderSnapshot.data() };
      assertExpectedRevision(current, body.expectedRevision);
      if (!['completed', 'verified'].includes(current.status)) {
        throw new Error('Biaya aktual hanya dapat dicatat setelah pekerjaan selesai.');
      }
      if (current.costEntryId) {
        throw new Error('Biaya work order ini sudah tercatat di Bookkeeping.');
      }
      const currentFence = fenceSnapshot.exists() ? fenceSnapshot.data() : null;
      if (currentFence?.status === 'closed') {
        throw new Error('Tanggal bisnis sudah ditutup. Posting biaya maintenance ditolak.');
      }
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
        lastOperationId: marker.operationId,
        lastOperationAction: 'cost',
        lastEventId: eventId,
      };
      const entry = {
        id: entryId,
        type: 'expense',
        category: 'maintenance',
        title: ('Biaya maintenance ' + cleanText(current.itemName, 'Nama equipment', 120)).slice(0, 160),
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
        idempotencyKey: requestId,
        immutable: true,
        reversalOf: '',
        operationId: marker.operationId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const event = {
        action: 'cost_recorded',
        actorName: actor.displayName,
        actorUid: actor.uid,
        actualCost: amount,
        bookkeepingEntryId: entryId,
        createdAt: timestamp,
        details: { amount, date, paymentMethod, note },
        fromStatus: current.status,
        id: eventId,
        inventoryItemId: current.inventoryItemId,
        operationAction: 'cost',
        operationId: marker.operationId,
        reason: note,
        revision: nextWorkOrder.revision,
        toStatus: current.status,
        workOrderId: current.id,
      };
      const fence = {
        ...(currentFence || {}),
        activityRevision: Number(currentFence?.activityRevision || 0) + 1,
        businessDate: date,
        createdAt: currentFence?.createdAt || timestamp,
        id: closingId,
        lastActivityAt: timestamp,
        lastActivityByUid: actor.uid,
        lastBookingId: '',
        lastLedgerEntryId: entryId,
        lastOperationAction: 'maintenance-cost',
        lastOperationId: marker.operationId,
        lastProofId: '',
        registerId: 'main',
        status: currentFence?.status || 'open',
        updatedAt: timestamp,
      };
      transaction.set(workOrderRef, nextWorkOrder);
      transaction.set(eventRef, event);
      transaction.set(entryRef, entry);
      transaction.set(fenceRef, fence);
      return { collection: WORK_ORDERS, id: workOrderId };
    },
  });

  return hydrateWorkOrderOperation(operation, eventId, '', { includeLedger: true, ledgerId: entryId });
}

export const maintenanceFirestoreRepository = Object.freeze({
  reportWorkOrder: reportCanonicalMaintenanceWorkOrder,
  actOnWorkOrder: actOnCanonicalMaintenanceWorkOrder,
  reopenWorkOrder: reopenCanonicalMaintenanceWorkOrder,
  recordWorkOrderCost: recordCanonicalMaintenanceCost,
});
