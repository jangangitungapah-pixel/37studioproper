import { HttpError } from './http.js';
import { stableDocumentId } from './firestore.js';

export async function operationDocumentId(type, key) {
  return stableDocumentId('op', `${type}:${key}`);
}

export async function readOperationResult(firestore, type, key) {
  const id = await operationDocumentId(type, key);
  const existing = await firestore.getDocument('adminOperationKeys', id);

  if (!existing) return { id, result: null };

  const result = { ...(existing.data.result || {}) };
  const documentRefs = existing.data.documentRefs || {};
  await Promise.all(Object.entries(documentRefs).map(async ([resultKey, reference]) => {
    const document = await firestore.getDocument(reference.collectionId, reference.documentId);
    if (document) result[resultKey] = { id: document.id, ...document.data };
  }));
  return { id, result };
}

export async function commitIdempotentOperation({
  actor,
  documentRefs = {},
  firestore,
  key,
  result,
  receipt = null,
  targetId = '',
  type,
  writes,
}) {
  const operation = await readOperationResult(firestore, type, key);
  if (operation.result) return { duplicate: true, result: operation.result };

  const now = new Date().toISOString();
  const operationRecord = {
    actorName: actor.displayName,
    actorUid: actor.uid,
    createdAt: now,
    documentRefs,
    expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(),
    id: operation.id,
    key,
    result: receipt ?? result,
    targetId: String(targetId || ''),
    type,
  };
  const auditRecord = {
    actorName: actor.displayName,
    actorUid: actor.uid,
    createdAt: now,
    id: operation.id,
    key,
    targetId: String(targetId || ''),
    type,
  };

  try {
    await firestore.commit([
      ...writes,
      firestore.setWrite(
        'adminOperationKeys',
        operation.id,
        operationRecord,
        { exists: false },
      ),
      firestore.setWrite(
        'adminOperationAudit',
        operation.id,
        auditRecord,
        { exists: false },
      ),
    ]);

    return { duplicate: false, result };
  } catch (error) {
    const raced = await readOperationResult(firestore, type, key).catch(() => null);
    if (raced?.result) return { duplicate: true, result: raced.result };

    if (error?.status === 409 || error?.status === 412) {
      throw new HttpError(
        409,
        'operation_conflict',
        'Data berubah saat operasi diproses. Muat data terbaru lalu tinjau kembali.',
      );
    }

    throw error;
  }
}
