/**
 * App-level constants loaded from environment variables.
 * Semua nilai sensitif atau konfigurasi harus di sini, bukan hardcoded.
 */

const viteEnv = import.meta.env || {};
const nodeEnv = typeof process !== 'undefined' ? process.env || {} : {};

function readEnv(key, fallback = '') {
  return viteEnv[key] || nodeEnv[key] || fallback;
}

/** Email owner utama studio — digunakan untuk bootstrap ownership */
export const OWNER_EMAIL = readEnv('VITE_OWNER_EMAIL');

/** Nama studio untuk display di UI dan email notifikasi */
export const STUDIO_DISPLAY_NAME = readEnv('VITE_STUDIO_NAME', '37 Music Studio');

/** Cloudinary upload config */
export const CLOUDINARY_CLOUD_NAME = readEnv('VITE_CLOUDINARY_CLOUD_NAME');
export const CLOUDINARY_UPLOAD_PRESET = readEnv('VITE_CLOUDINARY_UPLOAD_PRESET');
