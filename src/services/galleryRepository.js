import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { firestoreDb } from '../lib/firebase.js';

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

export function deleteGalleryItem(itemId) {
  if (!itemId) {
    throw new Error('Gallery item id wajib ada.');
  }

  return deleteDoc(doc(firestoreDb, GALLERY_COLLECTION, itemId));
}

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

export function batchDeleteGalleryItems(itemIds) {
  const ids = Array.from(itemIds || []);

  return Promise.all(ids.map((itemId) => deleteGalleryItem(itemId)));
}

export const galleryRepository = {
  batchDeleteGalleryItems,
  batchUpdateGalleryItems,
  createGalleryItem,
  deleteGalleryItem,
  moveGalleryItemToTrash,
  restoreGalleryItem,
  setGalleryFavorite,
  subscribeGalleryItems,
  updateGalleryItem,
};
