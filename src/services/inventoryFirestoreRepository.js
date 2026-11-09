import {
  collection,
  doc,
  getDocFromServer,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import {
  buildRepositoryPrincipal,
  createRepositoryOperationId,
  createRepositoryRequestId,
  runIdempotentFirestoreTransaction,
} from '../lib/firestoreRepositoryFoundation.js';

const ITEMS = 'inventoryItems';
const MOVEMENTS = 'inventoryMovements';
const MAINTENANCE = 'maintenanceWorkOrders';
const SCOPE = 'inventory';
const ACTIVE_MAINTENANCE = new Set([
  'reported', 'triaged', 'approved', 'assigned',
  'in_progress', 'waiting_parts', 'completed',
]);

function assertFirebase() {
  if (!isFirebaseConfigured || !firestoreDb) throw new Error('Firebase belum dikonfigurasi.');
}

function cleanText(value, label, maxLength, required = false) {
  const result = String(value ?? '').trim();
  if (result.length > maxLength || (required && !result)) {
    throw new Error(label + (required ? ' wajib diisi.' : ' melebihi batas karakter.'));
  }
  return result;
}

function finiteQuantity(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(label + ' tidak valid.');
  return Math.round(parsed * 1000) / 1000;
}

function isoNow() {
  return new Date().toISOString();
}

async function requirePrincipal(permission = 'inventory') {
  assertFirebase();
  const user = firebaseAuth?.currentUser;
  if (!user?.uid) throw new Error('Sesi login diperlukan.');
  const [userSnapshot, ownerSnapshot] = await Promise.all([
    getDocFromServer(doc(firestoreDb, 'users', user.uid)),
    getDocFromServer(doc(firestoreDb, 'adminControl', 'ownership')),
  ]);
  const profile = userSnapshot.exists() ? { ...userSnapshot.data(), uid: userSnapshot.id } : null;
  const principal = buildRepositoryPrincipal({
    authUid: user.uid,
    userProfile: profile,
    ownershipControl: ownerSnapshot.exists() ? ownerSnapshot.data() : null,
  });
  if (!principal.active || !principal.hasPermission(permission)) {
    throw new Error('Akun tidak memiliki izin ' + permission + '.');
  }
  return {
    uid: user.uid,
    displayName: cleanText(profile?.displayName || user.displayName || user.email || 'Admin', 'Nama actor', 120, true),
    role: principal.role,
    principal,
  };
}

async function normalizeRequestId(value) {
  const candidate = String(value || '').trim();
  if (/^[A-Za-z0-9._:-]{8,128}$/.test(candidate)) return candidate;
  if (candidate) throw new Error('Request ID operasi tidak valid.');
  return createRepositoryRequestId();
}

function normalizeInventoryMetadata(body) {
  const metadata = {
    name: cleanText(body.name, 'Nama item', 160, true),
    category: cleanText(body.category, 'Kategori', 80, true),
    type: cleanText(body.type, 'Tipe item', 40, true),
    unit: cleanText(body.unit, 'Satuan', 40, true),
    condition: cleanText(body.condition, 'Kondisi', 40, true),
    status: cleanText(body.status, 'Status', 40, true),
    location: cleanText(body.location, 'Lokasi', 240),
    note: cleanText(body.note, 'Catatan', 2000),
    minStock: finiteQuantity(body.minStock, 'Minimal stok'),
  };
  if (metadata.minStock < 0 || metadata.minStock > 1000000) {
    throw new Error('Minimal stok berada di luar batas operasional.');
  }
  return metadata;
}

async function assertNoActiveMaintenance(transaction, itemId) {
  const activeQuery = query(
    collection(firestoreDb, MAINTENANCE),
    where('inventoryItemId', '==', itemId),
    limit(500),
  );
  const snapshot = await transaction.get(activeQuery);
  const active = snapshot.docs.find((item) => ACTIVE_MAINTENANCE.has(String(item.data()?.status || '')));
  if (active) {
    throw new Error('Status/kondisi equipment dikunci selama work order belum Verified atau Cancelled.');
  }
}

function stableSerialize(value) {
  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableSerialize(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

async function ensureInventoryMovement(movement) {
  const movementRef = doc(firestoreDb, MOVEMENTS, movement.id);
  const current = await getDocFromServer(movementRef);
  if (current.exists()) {
    if (stableSerialize(current.data()) !== stableSerialize(movement)) {
      throw new Error('Movement inventory yang tersimpan tidak cocok dengan snapshot item.');
    }
    return { id: current.id, ...current.data() };
  }
  try {
    await setDoc(movementRef, movement);
  } catch (error) {
    const retry = await getDocFromServer(movementRef);
    if (!retry.exists() || stableSerialize(retry.data()) !== stableSerialize(movement)) throw error;
    return { id: retry.id, ...retry.data() };
  }
  return { id: movement.id, ...movement };
}

async function hydrate(operation, action) {
  const itemSnapshot = await getDocFromServer(doc(firestoreDb, ITEMS, operation.result.id));
  if (!itemSnapshot.exists()) throw new Error('Inventory item hasil operasi tidak ditemukan.');
  const item = { id: itemSnapshot.id, ...itemSnapshot.data() };
  let movement;
  if (item.lastMovementSnapshot?.id === item.lastMovementId) {
    movement = await ensureInventoryMovement(item.lastMovementSnapshot);
  } else {
    const movementSnapshot = item.lastMovementId
      ? await getDocFromServer(doc(firestoreDb, MOVEMENTS, item.lastMovementId))
      : null;
    if (!movementSnapshot?.exists()) throw new Error('Movement hasil operasi tidak ditemukan.');
    movement = { id: movementSnapshot.id, ...movementSnapshot.data() };
  }
  return { item, movement, duplicate: operation.replayed, action };
}

export async function saveCanonicalInventoryItem(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal();
  const body = input && typeof input === 'object' ? input : {};
  const isCreate = body.action === 'create';
  const itemIdInput = cleanText(body.itemId, 'ID item', 160);
  if (!isCreate && !itemIdInput) throw new Error('Inventory item wajib dipilih.');
  if (isCreate && itemIdInput) throw new Error('ID item baru dibuat oleh repository.');
  if (!['create', 'update'].includes(body.action)) throw new Error('Aksi inventory tidak valid.');

  const metadata = normalizeInventoryMetadata(body);
  const reason = cleanText(body.reason, 'Alasan movement', 600) ||
    (isCreate ? 'Item baru ditambahkan' : 'Metadata inventory diperbarui');
  const requestId = await normalizeRequestId(idempotencyKey);
  const action = isCreate ? 'create' : 'update';
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid, scope: SCOPE, action, requestId,
  });
  const itemId = isCreate ? 'inv_' + operationId.slice(3) : itemIdInput;
  const movementId = 'mov_' + operationId.slice(3);
  const timestamp = isoNow();
  const payload = {
    action,
    itemId: isCreate ? '' : itemId,
    ...metadata,
    quantity: isCreate ? finiteQuantity(body.quantity, 'Stok awal') : null,
    reason,
  };
  if (isCreate && (payload.quantity < 0 || payload.quantity > 1000000)) {
    throw new Error('Stok berada di luar batas operasional.');
  }

  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: SCOPE,
    action,
    requestId,
    payload,
    execute: async (transaction, marker) => {
      const itemRef = doc(firestoreDb, ITEMS, itemId);
      const movementRef = doc(firestoreDb, MOVEMENTS, movementId);
      const [itemSnapshot, movementSnapshot] = await Promise.all([
        transaction.get(itemRef),
        transaction.get(movementRef),
      ]);
      if (movementSnapshot.exists()) throw new Error('ID movement inventory sudah digunakan.');

      if (isCreate && itemSnapshot.exists()) throw new Error('ID item inventory sudah digunakan.');
      if (!isCreate && !itemSnapshot.exists()) throw new Error('Inventory item tidak ditemukan.');

      const current = itemSnapshot.exists() ? { id: itemSnapshot.id, ...itemSnapshot.data() } : {};
      if (!isCreate && (
        metadata.status !== current.status || metadata.condition !== current.condition
      )) {
        await assertNoActiveMaintenance(transaction, itemId);
      }

      const quantity = isCreate
        ? payload.quantity
        : finiteQuantity(current.quantity || 0, 'Stok saat ini');
      if (!isCreate && body.quantity !== undefined && Number(body.quantity) !== quantity) {
        throw new Error('Perubahan jumlah stok harus memakai adjustment inventory.');
      }
      const item = {
        ...current,
        ...metadata,
        id: itemId,
        quantity,
        createdAt: isCreate ? timestamp : current.createdAt,
        updatedAt: timestamp,
        lastOperationId: marker.operationId,
        lastOperationAction: action,
        lastMovementId: movementId,
        lastMovementSnapshot: {},
      };
      const movement = {
        id: movementId,
        itemId,
        itemName: item.name,
        type: isCreate ? 'create' : 'edit',
        quantity: isCreate ? quantity : 0,
        previousQuantity: isCreate ? 0 : quantity,
        nextQuantity: quantity,
        unit: item.unit,
        note: reason,
        reason,
        actorUid: actor.uid,
        actorName: actor.displayName,
        createdAt: timestamp,
        operationId: marker.operationId,
        operationAction: action,
        metadataSnapshot: {
          category: item.category,
          condition: item.condition,
          location: item.location,
          minStock: item.minStock,
          name: item.name,
          note: item.note,
          status: item.status,
          type: item.type,
          unit: item.unit,
        },
      };
      item.lastMovementSnapshot = movement;
      transaction.set(itemRef, item);
      return { collection: ITEMS, id: itemId };
    },
  });
  return hydrate(operation, action);
}

export async function archiveCanonicalInventoryItem(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal();
  const body = input && typeof input === 'object' ? input : {};
  const itemId = cleanText(body.itemId, 'ID item', 160, true);
  const reason = cleanText(body.reason, 'Alasan archive', 600) || 'Item dinonaktifkan';
  const requestId = await normalizeRequestId(idempotencyKey);
  const action = 'archive';
  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: SCOPE,
    action,
    requestId,
    payload: { itemId, reason },
    execute: async (transaction, marker) => {
      const itemRef = doc(firestoreDb, ITEMS, itemId);
      const movementId = 'mov_' + marker.operationId.slice(3);
      const movementRef = doc(firestoreDb, MOVEMENTS, movementId);
      const [itemSnapshot, movementSnapshot] = await Promise.all([
        transaction.get(itemRef),
        transaction.get(movementRef),
      ]);
      if (!itemSnapshot.exists()) throw new Error('Inventory item tidak ditemukan.');
      if (movementSnapshot.exists()) throw new Error('ID movement inventory sudah digunakan.');
      await assertNoActiveMaintenance(transaction, itemId);
      const current = { id: itemSnapshot.id, ...itemSnapshot.data() };
      if (current.status === 'inactive') throw new Error('Item sudah dinonaktifkan.');
      const timestamp = isoNow();
      const quantity = finiteQuantity(current.quantity || 0, 'Stok saat ini');
      const item = {
        ...current,
        status: 'inactive',
        updatedAt: timestamp,
        lastOperationId: marker.operationId,
        lastOperationAction: action,
        lastMovementId: movementId,
        lastMovementSnapshot: {},
      };
      const movement = {
        id: movementId,
        itemId,
        itemName: cleanText(item.name, 'Nama item', 160, true),
        type: 'inactive',
        quantity: 0,
        previousQuantity: quantity,
        nextQuantity: quantity,
        unit: cleanText(item.unit || 'pcs', 'Satuan', 40, true),
        note: reason,
        reason,
        actorUid: actor.uid,
        actorName: actor.displayName,
        createdAt: timestamp,
        operationId: marker.operationId,
        operationAction: action,
        previousMetadata: { status: current.status, condition: current.condition },
        nextMetadata: { status: 'inactive', condition: current.condition },
      };
      item.lastMovementSnapshot = movement;
      transaction.set(itemRef, item);
      return { collection: ITEMS, id: itemId };
    },
  });
  return hydrate(operation, action);
}

export async function adjustCanonicalInventory(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal();
  const body = input && typeof input === 'object' ? input : {};
  const itemId = cleanText(body.itemId, 'ID item', 160, true);
  const reason = cleanText(body.reason || body.note, 'Alasan adjustment', 600, true);
  if (reason.length < 4) throw new Error('Alasan adjustment minimal 4 karakter.');
  const delta = finiteQuantity(body.delta, 'Perubahan stok');
  if (!delta) throw new Error('Perubahan stok tidak boleh nol.');

  const requestId = await normalizeRequestId(idempotencyKey);
  const action = 'adjust';
  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: SCOPE,
    action,
    requestId,
    payload: { itemId, reason, delta },
    execute: async (transaction, marker) => {
      const itemRef = doc(firestoreDb, ITEMS, itemId);
      const movementId = 'mov_' + marker.operationId.slice(3);
      const movementRef = doc(firestoreDb, MOVEMENTS, movementId);
      const [itemSnapshot, movementSnapshot] = await Promise.all([
        transaction.get(itemRef),
        transaction.get(movementRef),
      ]);
      if (!itemSnapshot.exists()) throw new Error('Inventory item tidak ditemukan.');
      if (movementSnapshot.exists()) throw new Error('ID movement inventory sudah digunakan.');
      const current = { id: itemSnapshot.id, ...itemSnapshot.data() };
      const previousQuantity = finiteQuantity(current.quantity || 0, 'Stok saat ini');
      const nextQuantity = finiteQuantity(previousQuantity + delta, 'Stok hasil');
      if (nextQuantity < 0) throw new Error('Adjustment ditolak karena stok akan menjadi negatif.');
      if (nextQuantity > 1000000) throw new Error('Stok hasil melebihi batas operasional.');
      const timestamp = isoNow();
      const item = {
        ...current,
        quantity: nextQuantity,
        updatedAt: timestamp,
        lastOperationId: marker.operationId,
        lastOperationAction: action,
        lastMovementId: movementId,
        lastMovementSnapshot: {},
      };
      const movement = {
        id: movementId,
        itemId,
        itemName: cleanText(current.name || 'Inventory Item', 'Nama item', 160, true),
        type: delta > 0 ? 'stock-in' : 'stock-out',
        quantity: Math.abs(delta),
        previousQuantity,
        nextQuantity,
        unit: cleanText(current.unit || 'pcs', 'Satuan', 40, true),
        note: reason,
        reason,
        actorUid: actor.uid,
        actorName: actor.displayName,
        createdAt: timestamp,
        adjustmentKey: requestId,
        operationId: marker.operationId,
        operationAction: action,
      };
      item.lastMovementSnapshot = movement;
      transaction.set(itemRef, item);
      return { collection: ITEMS, id: itemId };
    },
  });
  return hydrate(operation, action);
}

export const inventoryFirestoreRepository = Object.freeze({
  saveInventoryItem: saveCanonicalInventoryItem,
  archiveInventoryItem: archiveCanonicalInventoryItem,
  adjustInventory: adjustCanonicalInventory,
});
