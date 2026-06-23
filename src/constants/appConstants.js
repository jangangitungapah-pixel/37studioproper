/**
 * App-level constants loaded from environment variables.
 * Semua nilai sensitif atau konfigurasi harus di sini, bukan hardcoded.
 */

/** Email owner utama studio — digunakan untuk bootstrap ownership */
export const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL || '';

/** Nama studio untuk display di UI dan email notifikasi */
export const STUDIO_DISPLAY_NAME = import.meta.env.VITE_STUDIO_NAME || '37 Music Studio';

/** Cloudinary upload config */
export const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
export const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
