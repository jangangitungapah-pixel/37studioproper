import { HttpError, cleanText, getIdempotencyKey } from '../lib/http.js';
import { destroyCloudinaryImage } from '../lib/cloudinary.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';

function galleryPrefix(env) {
  return String(env.CLOUDINARY_GALLERY_PREFIX || 'studio37/gallery/').trim();
}

function assertOwnedGalleryAsset(env, publicId) {
  const cleanPublicId = cleanText(publicId, 500);
  const prefix = galleryPrefix(env);
  if (!cleanPublicId || !prefix || !cleanPublicId.startsWith(prefix) || cleanPublicId.includes('..')) {
    throw new HttpError(
      409,
      'gallery_asset_not_owned',
      'Asset tidak berada di folder Gallery 37 Studio dan tidak boleh dihapus.',
    );
  }
  return cleanPublicId;
}

function withoutDeleteClaim(item) {
  const clean = { ...item };
  delete clean.permanentDeleteKey;
  delete clean.permanentDeleteStartedAt;
  delete clean.permanentDeleteStatus;
  return clean;
}

async function assertUniqueGalleryReference(firestore, itemId, publicId) {
  const references = await firestore.runQuery({
    from: [{ collectionId: 'gallery' }],
    limit: 3,
    where: {
      fieldFilter: {
        field: { fieldPath: 'publicId' },
        op: 'EQUAL',
        value: { stringValue: publicId },
      },
    },
  });
  if (references.length !== 1 || references[0].id !== itemId) {
    throw new HttpError(
      409,
      'gallery_asset_reference_ambiguous',
      'Referensi asset Gallery tidak unik; permanent delete dihentikan.',
    );
  }
}

export async function permanentlyDeleteGalleryItem({ actor, body, env, firestore, request }) {
  const itemId = cleanText(body.itemId, 160);
  const key = getIdempotencyKey(request, body, `gallery-delete:${itemId}`);
  const existing = await readOperationResult(firestore, 'gallery-permanent-delete', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  if (!itemId) throw new HttpError(400, 'item_required', 'Gallery item wajib dipilih.');

  let itemDocument = await firestore.getDocument('gallery', itemId);
  if (!itemDocument) {
    return { duplicate: true, externalAsset: { status: 'unknown' }, itemId, metadata: 'already-missing' };
  }
  const item = itemDocument.data;
  if (item.isDeleted !== true) {
    throw new HttpError(409, 'trash_required', 'Pindahkan item ke Trash sebelum permanent delete.');
  }

  const publicId = assertOwnedGalleryAsset(env, item.publicId);
  await assertUniqueGalleryReference(firestore, itemId, publicId);
  if (item.permanentDeleteStatus === 'deleting' && item.permanentDeleteKey !== key) {
    throw new HttpError(409, 'gallery_delete_in_progress', 'Item sedang diproses oleh operasi lain.');
  }

  if (item.permanentDeleteStatus !== 'deleting') {
    const claim = {
      ...withoutDeleteClaim(item),
      permanentDeleteKey: key,
      permanentDeleteStartedAt: new Date().toISOString(),
      permanentDeleteStatus: 'deleting',
    };
    try {
      await firestore.commit([
        firestore.setWrite('gallery', itemId, claim, { updateTime: itemDocument.updateTime }),
      ]);
    } catch (error) {
      if (error?.status !== 409 && error?.status !== 412) throw error;
    }
    itemDocument = await firestore.getDocument('gallery', itemId);
    if (!itemDocument) {
      return { duplicate: true, externalAsset: { status: 'unknown' }, itemId, metadata: 'already-missing' };
    }
    if (
      itemDocument.data.permanentDeleteStatus !== 'deleting' ||
      itemDocument.data.permanentDeleteKey !== key
    ) {
      throw new HttpError(409, 'gallery_delete_in_progress', 'Item sedang diproses oleh operasi lain.');
    }
  }

  let externalAsset;
  try {
    externalAsset = await destroyCloudinaryImage(env, publicId);
  } catch (error) {
    await firestore.commit([
      firestore.setWrite(
        'gallery',
        itemId,
        withoutDeleteClaim(itemDocument.data),
        { updateTime: itemDocument.updateTime },
      ),
    ]).catch(() => null);
    throw error;
  }
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
