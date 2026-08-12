import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

const pageSource =
  readFileSync(
    resolve(
      'src/pages/admin/GalleryPage.jsx',
    ),
    'utf8',
  );

const heroSource =
  readFileSync(
    resolve(
      'src/components/gallery/GalleryHero.jsx',
    ),
    'utf8',
  );

const toolbarSource =
  readFileSync(
    resolve(
      'src/components/gallery/GalleryToolbar.jsx',
    ),
    'utf8',
  );

const photoCardSource =
  readFileSync(
    resolve(
      'src/components/gallery/PhotoCard.jsx',
    ),
    'utf8',
  );

const timelineSource =
  readFileSync(
    resolve(
      'src/components/gallery/GalleryTimelineView.jsx',
    ),
    'utf8',
  );

const albumsSource =
  readFileSync(
    resolve(
      'src/components/gallery/GalleryAlbumsView.jsx',
    ),
    'utf8',
  );

const trashSource =
  readFileSync(
    resolve(
      'src/components/gallery/GalleryTrashView.jsx',
    ),
    'utf8',
  );

const uploadModalSource =
  readFileSync(
    resolve(
      'src/components/gallery/GalleryUploadModal.jsx',
    ),
    'utf8',
  );

const metadataModalSource =
  readFileSync(
    resolve(
      'src/components/gallery/GalleryMetadataModal.jsx',
    ),
    'utf8',
  );

const cssSource =
  readFileSync(
    resolve(
      'src/styles/modules/gallery.css',
    ),
    'utf8',
  );

const repositorySource =
  readFileSync(
    resolve(
      'src/services/galleryRepository.js',
    ),
    'utf8',
  );

const uploadServiceSource =
  readFileSync(
    resolve(
      'src/services/cloudinaryUploadService.js',
    ),
    'utf8',
  );

const packageJson =
  JSON.parse(
    readFileSync(
      resolve('package.json'),
      'utf8',
    ),
  );

for (const required of [
  'data-gallery-ui="ui-11-spatial"',
  'gallery-editorial-header',
  'galleryRepository.subscribeGalleryItems(',
  'uploadGalleryImageFile(selectedFile)',
  'galleryRepository.createGalleryItem(docData)',
  'galleryRepository.moveGalleryItemToTrash(imgId)',
  'galleryRepository.restoreGalleryItem(imgId)',
  'galleryRepository.batchUpdateGalleryItems(',
  'galleryRepository.batchPermanentlyDeleteGalleryItems(',
  'isOwnerAdminUser(currentUser)',
  "data-can-permanent-delete={canPermanentlyDelete ? 'true' : 'false'}",
  'isEditableShortcutTarget(e.target)',
  'prefersReducedMotion',
  'summarizePermanentDeleteFailures',
  'summarizePermanentDeleteSuccesses',
  'galleryRepository.updateGalleryItem(metadataPhoto.id',
  '<GalleryMetadataModal',
  'onEditMetadata={openMetadataEditor}',
  'categories={CATEGORIES}',
  '<GalleryLightbox',
]) {
  assert.equal(
    pageSource.includes(required),
    true,
    'UI-11 page contract missing: ' +
      required,
  );
}

for (const forbidden of [
  'addDoc(',
  'updateDoc(',
  'deleteDoc(',
  "collection(firestoreDb, 'gallery')",
  'writeBatch(',
]) {
  assert.equal(
    pageSource.includes(forbidden),
    false,
    'UI-11 page must not bypass galleryRepository: ' +
      forbidden,
  );
}

for (const required of [
  'gallery-overview',
  'Published media',
  'Favorites',
  'Recycle bin',
]) {
  assert.equal(
    heroSource.includes(required),
    true,
    'UI-11 overview missing: ' +
      required,
  );
}

for (const required of [
  'gallery-command-shelf',
  'gallery-command-search',
  'gallery-primary-tabs',
  'gallery-density-control',
  'Pilih media',
  'Upload foto',
]) {
  assert.equal(
    toolbarSource.includes(required),
    true,
    'UI-11 command shelf missing: ' +
      required,
  );
}

for (const required of [
  'gallery-photo-card',
  'gallery-photo-caption',
  'gallery-photo-actions',
  'Edit metadata',
  'onEditMetadata',
]) {
  assert.equal(
    photoCardSource.includes(required),
    true,
    'UI-11 media card missing: ' +
      required,
  );
}

assert.match(
  timelineSource,
  /onEditMetadata\s*=\s*\{\(\)\s*=>\s*onEditMetadata\(img\)\s*\}/,
  'UI-11 timeline must expose metadata editing.',
);

assert.match(
  albumsSource,
  /onEditMetadata\s*=\s*\{\(\)\s*=>\s*onEditMetadata\(img\)\s*\}/,
  'UI-11 album detail must expose metadata editing.',
);

assert.equal(
  trashSource.includes(
    'gallery-trash-header',
  ),
  true,
  'UI-11 trash surface missing.',
);

for (const required of [
  'data-gallery-upload-ui="ui-11-spatial"',
  'gallery-upload-dropzone',
  'Upload & simpan',
]) {
  assert.equal(
    uploadModalSource.includes(required),
    true,
    'UI-11 upload modal missing: ' +
      required,
  );
}

for (const required of [
  'data-gallery-metadata-ui="ui-11-spatial"',
  'Edit metadata',
  'Asset gambar tidak diubah',
  'Simpan metadata',
]) {
  assert.equal(
    metadataModalSource.includes(required),
    true,
    'UI-11 metadata modal missing: ' +
      required,
  );
}

for (const required of [
  "const GALLERY_COLLECTION = 'gallery';",
  'subscribeGalleryItems',
  'createGalleryItem',
  'updateGalleryItem',
  'deleteGalleryItem',
  'permanentlyDeleteGalleryItem',
  'setGalleryFavorite',
  'moveGalleryItemToTrash',
  'restoreGalleryItem',
  'batchUpdateGalleryItems',
  'batchDeleteGalleryItems',
  'batchPermanentlyDeleteGalleryItems',
  'runProtectedPermanentDelete',
  'Promise.allSettled(',
]) {
  assert.equal(
    repositorySource.includes(required),
    true,
    'UI-11 repository invariant missing: ' +
      required,
  );
}

assert.equal(
  repositorySource.includes('deleteDoc('),
  false,
  'UI-11 browser repository must not permanently delete gallery metadata directly.',
);

for (const required of [
  ".gallery-page[data-can-permanent-delete='false']",
  ".gallery-page[aria-busy='true'][data-gallery-tab='trash']",
  '.gallery-owner-operation-note',
]) {
  assert.equal(
    cssSource.includes(required),
    true,
    'UI-11 protected operation styling missing: ' + required,
  );
}

for (const required of [
  'MAX_GALLERY_IMAGE_SIZE_BYTES',
  "folder: 'studio37/gallery'",
  "tags: ['studio37', 'gallery']",
  'uploadGalleryImageFile',
]) {
  assert.equal(
    uploadServiceSource.includes(required),
    true,
    'UI-11 upload invariant missing: ' +
      required,
  );
}

for (const required of [
  '/* UI-11 — Spatial Studio Gallery Workspace */',
  ".gallery-page[data-gallery-ui='ui-11-spatial']",
  '.gallery-editorial-header',
  '.gallery-overview',
  '.gallery-command-shelf',
  '.gallery-photo-grid',
  '.gallery-photo-card',
  '.gallery-album-grid',
  '.gallery-trash-header',
  '.gallery-modal-layer',
  '.gallery-metadata-preview',
  '@media (max-width: 767px)',
  '@media (max-width: 420px)',
  'prefers-reduced-motion: reduce',
  '@media (forced-colors: active)',
]) {
  assert.equal(
    cssSource.includes(required),
    true,
    'UI-11 CSS contract missing: ' +
      required,
  );
}

assert.match(
  cssSource,
  /html\s*\[\s*data-admin-theme-active='true'\s*\]\s*\[\s*data-theme='dark'\s*\]\s*\.gallery-page\s*\[\s*data-gallery-ui='ui-11-spatial'\s*\]/,
  'UI-11 dark theme must remain scoped to the spatial gallery workspace.',
);

assert.match(
  cssSource,
  /\.gallery-overview\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.3fr\)\s*minmax\(310px,\s*0\.7fr\)/,
  'UI-11 overview must use asymmetric spatial composition.',
);

assert.match(
  cssSource,
  /@media \(max-width:\s*767px\)[\s\S]*?\.gallery-photo-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(\s*2,\s*minmax\(0,\s*1fr\)\s*\)\s*!important/,
  'UI-11 mobile media grid must be intentionally recomposed.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/admin-spatial-gallery-workspace-contract-test.mjs',
  ),
  true,
  'UI-11 contract must be registered in npm test.',
);

console.log(
  'admin-spatial-gallery-workspace-contract-test: PASS',
);
