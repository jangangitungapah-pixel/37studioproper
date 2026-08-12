import { HttpError } from './http.js';

function configured(env) {
  return Boolean(
    String(env.CLOUDINARY_CLOUD_NAME || '').trim() &&
    String(env.CLOUDINARY_API_KEY || '').trim() &&
    String(env.CLOUDINARY_API_SECRET || '').trim(),
  );
}

function hex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function destroyCloudinaryImage(env, publicId) {
  const cleanPublicId = String(publicId || '').trim();
  if (!cleanPublicId) return { status: 'not-linked' };
  if (!configured(env)) {
    throw new HttpError(
      503,
      'cloudinary_not_configured',
      'Cloudinary belum dikonfigurasi; metadata tetap dipertahankan.',
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const secret = String(env.CLOUDINARY_API_SECRET || '').trim();
  const signature = hex(await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(`public_id=${cleanPublicId}&timestamp=${timestamp}${secret}`),
  ));
  const body = new URLSearchParams({
    api_key: String(env.CLOUDINARY_API_KEY || '').trim(),
    public_id: cleanPublicId,
    signature,
    timestamp: String(timestamp),
  });
  const cloudName = encodeURIComponent(String(env.CLOUDINARY_CLOUD_NAME || '').trim());
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    body,
    method: 'POST',
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !['ok', 'not found'].includes(String(payload?.result || '').toLowerCase())) {
    throw new HttpError(
      502,
      'external_asset_delete_failed',
      'File eksternal belum terhapus; metadata tetap dipertahankan.',
    );
  }

  return {
    publicId: cleanPublicId,
    status: String(payload.result || '').toLowerCase() === 'ok' ? 'deleted' : 'already-missing',
  };
}
