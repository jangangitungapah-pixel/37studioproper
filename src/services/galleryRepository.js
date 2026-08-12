import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { firestoreDb } from '../lib/firebase.js';
import {
  permanentlyDeleteGalleryItem as runProtectedPermanentDelete,
} from './adminOperationsRepository.js';

const GALLERY_COLLECTION = 'gallery';

export function normalizeGalleryItem(docSnap) {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  };
}

export function subscribeGalleryItems(callback, onError) {
  const galleryQuery = query(
    collection(firestoreDb, GALLERY_COLLECTION),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    galleryQuery,
    (snapshot) => {
      const list = [];

      snapshot.forEach((docSnap) => {
        list.push(normalizeGalleryItem(docSnap));
      });

      callback(list);
    },
    onError
  );
}

export function createGalleryItem(data) {
  return addDoc(collection(firestoreDb, GALLERY_COLLECTION), data);
}

export function updateGalleryItem(itemId, data) {
  if (!itemId) {
    throw new Error('Gallery item id wajib ada.');
  }

  return updateDoc(doc(firestoreDb, GALLERY_COLLECTION, itemId), data);
}

export function permanentlyDeleteGalleryItem(itemId, idempotencyKey = '') {
  if (!itemId) {
    throw new Error('Gallery item id wajib ada.');
  }

  return runProtectedPermanentDelete({ itemId }, idempotencyKey);
}

// Compatibility alias kept for older consumers. This no longer bypasses the
// Owner-only server operation or deletes Firestore documents from the browser.
export const deleteGalleryItem = permanentlyDeleteGalleryItem;

export function setGalleryFavorite(itemId, isFavorite) {
  return updateGalleryItem(itemId, { isFavorite });
}

export function moveGalleryItemToTrash(itemId) {
  return updateGalleryItem(itemId, {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
  });
}

export function restoreGalleryItem(itemId) {
  return updateGalleryItem(itemId, {
    isDeleted: false,
    deletedAt: null,
  });
}

export function batchUpdateGalleryItems(itemIds, dataOrFactory) {
  const ids = Array.from(itemIds || []);

  return Promise.all(
    ids.map((itemId) => {
      const data = typeof dataOrFactory === 'function' ? dataOrFactory(itemId) : dataOrFactory;

      return updateGalleryItem(itemId, data);
    })
  );
}

export async function batchPermanentlyDeleteGalleryItems(itemIds) {
  const ids = Array.from(new Set(itemIds || [])).filter(Boolean);
  const settled = await Promise.allSettled(
    ids.map((itemId) => permanentlyDeleteGalleryItem(itemId)),
  );

  const successes = [];
  const failures = [];

  settled.forEach((result, index) => {
    const itemId = ids[index];

    if (result.status === 'fulfilled') {
      successes.push({ itemId, result: result.value });
      return;
    }

    failures.push({
      error: result.reason,
      itemId,
      message: result.reason?.message || 'Permanent delete gagal.',
    });
  });

  return { failures, successes };
}

export const batchDeleteGalleryItems = batchPermanentlyDeleteGalleryItems;

export const galleryRepository = {
  batchDeleteGalleryItems,
  batchPermanentlyDeleteGalleryItems,
  batchUpdateGalleryItems,
  createGalleryItem,
  deleteGalleryItem,
  moveGalleryItemToTrash,
  permanentlyDeleteGalleryItem,
  restoreGalleryItem,
  setGalleryFavorite,
  subscribeGalleryItems,
  updateGalleryItem,
};
