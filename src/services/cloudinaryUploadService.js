export const MAX_GALLERY_IMAGE_SIZE_BYTES = 12 * 1024 * 1024;
export const MAX_PAYMENT_PROOF_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const CLOUDINARY_CLOUD_NAME = 'dbvlmxvyd';
const CLOUDINARY_UPLOAD_PRESET = 'studio37_gallery_unsigned';

const allowedImageMimeTypes = new Set([
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function getCloudinaryUploadUrl() {
  return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
}

function assertImageFile(file, maxSizeBytes) {
  if (!file) {
    throw new Error('Harap pilih file foto terlebih dahulu.');
  }

  if (!allowedImageMimeTypes.has(file.type)) {
    throw new Error('Format file harus berupa gambar.');
  }

  if (file.size > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / 1024 / 1024);
    throw new Error('Ukuran file maksimal ' + maxMb + ' MB.');
  }
}

function normalizeUploadResult(data) {
  return {
    bytes: data.bytes || 0,
    createdAt: data.created_at || '',
    format: data.format || '',
    height: data.height || 0,
    publicId: data.public_id,
    raw: data,
    secureUrl: data.secure_url,
    width: data.width || 0,
  };
}

export async function uploadImageFile(file, options = {}) {
  const {
    context = {},
    folder = '',
    maxSizeBytes = MAX_GALLERY_IMAGE_SIZE_BYTES,
    tags = [],
  } = options;

  assertImageFile(file, maxSizeBytes);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  if (folder) {
    formData.append('folder', folder);
  }

  if (tags.length) {
    formData.append('tags', tags.join(','));
  }

  Object.entries(context).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    formData.append('context', key + '=' + String(value));
  });

  const response = await fetch(getCloudinaryUploadUrl(), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));

    throw new Error(errData.error?.message || 'Gagal mengirim file ke Cloudinary.');
  }

  const data = await response.json();

  return normalizeUploadResult(data);
}

export async function uploadGalleryImageFile(file) {
  return uploadImageFile(file, {
    folder: 'studio37/gallery',
    maxSizeBytes: MAX_GALLERY_IMAGE_SIZE_BYTES,
    tags: ['studio37', 'gallery'],
  });
}

export async function uploadPaymentProofFile(file, context = {}) {
  return uploadImageFile(file, {
    context,
    folder: 'studio37/payment-proofs',
    maxSizeBytes: MAX_PAYMENT_PROOF_IMAGE_SIZE_BYTES,
    tags: ['studio37', 'payment-proof'],
  });
}
