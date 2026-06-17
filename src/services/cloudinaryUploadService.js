export const MAX_GALLERY_IMAGE_SIZE_BYTES = 12 * 1024 * 1024;

const CLOUDINARY_CLOUD_NAME = 'dbvlmxvyd';
const CLOUDINARY_UPLOAD_PRESET = 'studio37_gallery_unsigned';

function getCloudinaryUploadUrl() {
  return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
}

export async function uploadGalleryImageFile(file) {
  if (!file) {
    throw new Error('Harap pilih file foto terlebih dahulu.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(getCloudinaryUploadUrl(), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json();

    throw new Error(errData.error?.message || 'Gagal mengirim file ke Cloudinary.');
  }

  const data = await response.json();

  return {
    publicId: data.public_id,
    raw: data,
    secureUrl: data.secure_url,
  };
}
