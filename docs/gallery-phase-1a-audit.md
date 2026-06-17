# Gallery Phase 1A Audit & Architecture Map

Tanggal audit: 18/6/2026, 06.04.06

## Scope Phase 1A

Phase ini hanya membuat audit dan peta arsitektur untuk fitur Gallery. Tidak ada perubahan behavior, UI, route, Firestore rules, upload flow, delete flow, editor, permission, ataupun data model.

## Executive Summary

Fitur Gallery sudah masuk ke Admin Shell sebagai halaman admin baru dan sudah terhubung dengan permission `gallery`. Rules Firestore juga sudah memiliki match khusus `/gallery/{imageId}`.

Gallery saat ini cukup besar karena satu file menangani banyak concern sekaligus: live Firestore subscription, upload Cloudinary, lightbox, slideshow, batch actions, trash, canvas image editor, dan procedural ambient audio.

Risk level awal: **High**

## File Map

| Area | File | Catatan |
|---|---|---|
| Admin Shell | `src/pages/AdminPage.jsx` | Lazy import Gallery, nav item, render branch |
| Gallery Page | `src/pages/admin/GalleryPage.jsx` | Core UI, upload, lightbox, editor, audio, batch |
| Permission Utility | `src/utils/adminPermissions.js` | Permission key `gallery` |
| Firestore Rules | `firestore.rules` | Rules collection `gallery` |
| Public Route | `src/App.jsx` | Route `/client` sudah ada |
| Global CSS | `src/styles/admin-auth.css` | Styling admin shared dan modal/global UI |
| Package | `package.json` | Dependency utama project |

## Metrics

| File | Lines |
|---|---:|
| `src/pages/admin/GalleryPage.jsx` | 2324 |
| `src/pages/AdminPage.jsx` | 586 |
| `src/utils/adminPermissions.js` | 86 |
| `firestore.rules` | 152 |
| `src/styles/admin-auth.css` | 16245 |

## Anchor Map

| Item | File | Line |
|---|---|---:|
| Gallery lazy import | `src/pages/AdminPage.jsx` | 37 |
| Gallery nav item | `src/pages/AdminPage.jsx` | 85 |
| Gallery render branch | `src/pages/AdminPage.jsx` | 132 |
| Firestore gallery collection | `src/pages/admin/GalleryPage.jsx` | 243 |
| Cloudinary upload endpoint | `src/pages/admin/GalleryPage.jsx` | 465 |
| Lo-fi ambient synth | `src/pages/admin/GalleryPage.jsx` | 48 |
| Image editor save | `src/pages/admin/GalleryPage.jsx` | 817 |
| Gallery permission key | `src/utils/adminPermissions.js` | 35 |
| Gallery Firestore rules | `firestore.rules` | 109 |
| Client public route | `src/App.jsx` | 15 |

## Current Feature Inventory

### Gallery Admin

- Live Firestore subscription ke collection `gallery`.
- Upload image ke Cloudinary.
- Metadata foto disimpan ke Firestore.
- Search foto by title, description, category, uploadedBy.
- Tab Foto, Album, dan Sampah.
- Category filter.
- Favorite.
- Soft delete ke trash.
- Restore dari trash.
- Permanent delete metadata Firestore.
- Batch select, batch favorite, batch soft delete, batch restore, batch permanent delete.
- Lightbox.
- Keyboard navigation.
- Slideshow.
- Image editor berbasis canvas.
- Save edited image sebagai copy baru.
- Download edited image.
- Ambient lo-fi audio via Web Audio API.

### Client Landing

- Route publik `/client`.
- Pricing simulator memakai pricing settings.
- Generate WhatsApp booking URL.
- Menggunakan invoice settings untuk nomor WhatsApp dan studio identity.

## Data Flow

### Gallery Read

```txt
GalleryPage
  -> Firestore onSnapshot(collection gallery ordered by createdAt desc)
  -> rawImages
  -> filteredActiveImages / trashedImages
  -> displayedImages
  -> timelineGroups / tabs / albums / lightbox
```

### Gallery Upload

```txt
User pilih file
  -> validate max 12MB
  -> upload ke Cloudinary unsigned preset
  -> Cloudinary returns secure_url + public_id
  -> addDoc gallery metadata ke Firestore
  -> UI reset dan modal upload ditutup
```

### Gallery Edit

```txt
Open lightbox
  -> masuk editor canvas
  -> apply filter / rotate / flip / watermark / crop
  -> canvas.toBlob
  -> upload hasil edit ke Cloudinary
  -> addDoc sebagai foto baru di gallery
```

### Delete Flow

```txt
Soft delete
  -> updateDoc gallery/{id}: isDeleted true, deletedAt timestamp

Restore
  -> updateDoc gallery/{id}: isDeleted false, deletedAt null

Permanent delete
  -> deleteDoc gallery/{id}
```

## Security & Rules Review

Firestore rules saat ini memberi public read untuk `gallery`, dan write hanya untuk admin approved dengan permission `gallery`.

Catatan:
- Public read masuk akal jika gallery juga dipakai untuk landing page publik.
- Write sudah dibatasi permission.
- Permanent delete hanya menghapus metadata Firestore, bukan asset Cloudinary. Ini aman dari sisi app, tapi asset Cloudinary bisa tetap tersimpan.

## Cloudinary Safety Checklist

Karena upload dilakukan dari client memakai unsigned preset, dashboard Cloudinary wajib dicek:

- Upload preset `studio37_gallery_unsigned` harus unsigned memang sengaja.
- Batasi allowed formats: jpg, jpeg, png, webp.
- Batasi max file size sesuai kebutuhan, misalnya 12MB atau lebih kecil.
- Set folder khusus, misalnya `studio37/gallery`.
- Hindari raw/video jika tidak perlu.
- Aktifkan moderasi atau manual review jika dibutuhkan.
- Jangan taruh API secret di client.

## Performance Risk

### Risiko utama

1. `GalleryPage.jsx` terlalu besar dan memegang banyak concern.
2. Image editor canvas bisa berat di mobile untuk foto resolusi besar.
3. Batch update memakai banyak `updateDoc` paralel, aman untuk sedikit item tapi bisa berat untuk banyak file.
4. Web Audio API cukup unik, tapi sebaiknya tetap opt-in dan tidak auto-play.
5. Lightbox + editor + timeline + upload modal dalam satu komponen membuat re-render scope besar.

### Mitigasi phase berikutnya

- Pecah komponen UI tanpa ubah behavior.
- Pindah Cloudinary upload helper ke service.
- Pindah Firestore gallery operations ke repository.
- Lazy render editor hanya saat `isEditing`.
- Tambah image dimension guard sebelum canvas edit.
- Tambah pagination atau virtual grid jika foto banyak.

## UX / Mobile Risk

- Toolbar Gallery cukup padat.
- Batch banner berpotensi makan tinggi layar mobile.
- Lightbox/editor perlu dicek di mobile real device.
- Upload modal perlu disamakan behavior/solid skin dengan modal admin lain.
- Gallery grid density desktop-only sudah baik, tapi mobile perlu fixed compact layout.

## Dependency Review

| Dependency | Status |
|---|---|
| firebase | dipakai |
| lucide-react | dipakai |
| react / react-dom | dipakai |
| react-router-dom | dipakai |
| recharts | dipakai dashboard |
| motion | tidak terpasang |

## Recommended Next Phases

### Phase Gallery 1B: Repository & Upload Service Split

Tujuan:
- Buat `src/services/galleryRepository.js`.
- Buat `src/services/cloudinaryUploadService.js`.
- Pindahkan Firestore CRUD dan upload helper dari GalleryPage.
- Tidak mengubah UI/behavior.

### Phase Gallery 1C: Component Split

Tujuan:
- Pecah GalleryHero, GalleryToolbar, GalleryGrid, GalleryUploadModal, GalleryLightbox, GalleryEditorPanel.
- Tidak mengubah logic user-facing.

### Phase Gallery 1D: Mobile UI Polish

Tujuan:
- Compact toolbar mobile.
- Solid upload modal.
- Lightbox/editor mobile safe-area.
- Batch action lebih ramping.

### Phase Gallery 1E: Safety Guard

Tujuan:
- Guard file type.
- Guard image dimensions sebelum canvas edit.
- Better user error untuk upload Cloudinary.
- Optional: mark Cloudinary orphan risk.

## Phase 1A Decision

Phase 1A selesai jika:
- Audit doc ini masuk repo.
- Lint, test, build lewat.
- Belum ada behavior yang berubah.
