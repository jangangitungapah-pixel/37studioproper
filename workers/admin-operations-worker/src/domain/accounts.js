import { HttpError, cleanText, getIdempotencyKey } from '../lib/http.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';

function allAdminPermissions() {
  return {
    billing: true,
    bookkeeping: true,
    customers: true,
    dashboard: true,
    gallery: true,
    'guard-attendance': true,
    inventory: true,
    notifications: true,
    'operator-fee': true,
    schedule: true,
    settings: true,
  };
}

export async function transferOwnership({ actor, body, firestore, request }) {
  const targetUid = cleanText(body.targetUid, 160);
  const key = getIdempotencyKey(request, body, `ownership-transfer:${actor.uid}:${targetUid}`);
  const existing = await readOperationResult(firestore, 'ownership-transfer', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  if (!targetUid || targetUid === actor.uid) {
    throw new HttpError(400, 'invalid_target', 'Pilih Admin lain sebagai Owner baru.');
  }

  const [sourceDocument, targetDocument, ownershipDocument, owners] = await Promise.all([
    firestore.getDocument('users', actor.uid),
    firestore.getDocument('users', targetUid),
    firestore.getDocument('adminControl', 'ownership'),
    firestore.runQuery({
      from: [{ collectionId: 'users' }],
      limit: 3,
      where: { fieldFilter: { field: { fieldPath: 'role' }, op: 'EQUAL', value: { stringValue: 'owner' } } },
    }),
  ]);

  if (!sourceDocument || sourceDocument.data.role !== 'owner') {
    throw new HttpError(409, 'owner_changed', 'Owner aktif sudah berubah. Muat ulang halaman.');
  }
  if (ownershipDocument && ownershipDocument.data.currentOwnerUid !== actor.uid) {
    throw new HttpError(409, 'owner_control_changed', 'Owner control sudah berubah. Muat ulang halaman.');
  }
  if (owners.length !== 1 || owners[0].id !== actor.uid) {
    throw new HttpError(409, 'owner_invariant', 'Transfer dihentikan karena invariant satu Owner tidak terpenuhi.');
  }
  if (!targetDocument || targetDocument.data.role !== 'admin' || targetDocument.data.status !== 'approved') {
    throw new HttpError(409, 'target_not_approved', 'Target harus merupakan Admin approved aktif.');
  }

  const now = new Date().toISOString();
  const permissions = allAdminPermissions();
  const nextSource = {
    ...sourceDocument.data,
    ownershipTransferredOutAt: now,
    permissions,
    role: 'admin',
    status: 'approved',
    updatedAt: now,
  };
  const nextTarget = {
    ...targetDocument.data,
    ownershipTransferredInAt: now,
    permissions,
    role: 'owner',
    status: 'approved',
    updatedAt: now,
  };
  const result = { previousOwnerUid: actor.uid, status: 'transferred', targetUid };
  const committed = await commitIdempotentOperation({
    actor,
    firestore,
    key,
    result,
    targetId: targetUid,
    type: 'ownership-transfer',
    writes: [
      firestore.setWrite('users', actor.uid, nextSource, { updateTime: sourceDocument.updateTime }),
      firestore.setWrite('users', targetUid, nextTarget, { updateTime: targetDocument.updateTime }),
      firestore.setWrite('adminControl', 'ownership', {
        currentOwnerUid: targetUid,
        initializedAt: ownershipDocument?.data?.initializedAt || now,
        updatedAt: now,
      }, ownershipDocument ? { updateTime: ownershipDocument.updateTime } : { exists: false }),
    ],
  });

  return { ...committed.result, duplicate: committed.duplicate };
}
