import { HttpError, cleanText, getIdempotencyKey } from '../lib/http.js';
import { destroyCloudinaryImage } from '../lib/cloudinary.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';

export async function permanentlyDeleteGalleryItem({ actor, body, env, firestore, request }) {
  const itemId = cleanText(body.itemId, 160);
  const key = getIdempotencyKey(request, body, `gallery-delete:${itemId}`);
  const existing = await readOperationResult(firestore, 'gallery-permanent-delete', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  if (!itemId) throw new HttpError(400, 'item_required', 'Gallery item wajib dipilih.');

  const itemDocument = await firestore.getDocument('gallery', itemId);
  if (!itemDocument) {
    return { duplicate: true, externalAsset: { status: 'unknown' }, itemId, metadata: 'already-missing' };
  }
  const item = itemDocument.data;
  if (item.isDeleted !== true) {
    throw new HttpError(409, 'trash_required', 'Pindahkan item ke Trash sebelum permanent delete.');
  }

  // External deletion is completed first. If it fails, metadata remains so the action is retryable.
  const externalAsset = await destroyCloudinaryImage(env, item.publicId);
  const result = { externalAsset, itemId, metadata: 'deleted' };
  const committed = await commitIdempotentOperation({
    actor,
    firestore,
    key,
    result,
    targetId: itemId,
    type: 'gallery-permanent-delete',
    writes: [
      firestore.deleteWrite('gallery', itemId, { updateTime: itemDocument.updateTime }),
    ],
  });

  return { ...committed.result, duplicate: committed.duplicate };
}
