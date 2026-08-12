import { HttpError } from './http.js';

function bearerToken(request) {
  const match = String(request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJwtPart(value) {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch {
    throw new HttpError(401, 'invalid_session', 'Sesi sudah tidak valid. Login kembali.');
  }
}

async function verifyFirebaseToken(env, request) {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, 'authentication_required', 'Sesi login diperlukan.');
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new HttpError(401, 'invalid_session', 'Sesi sudah tidak valid. Login kembali.');
  }
  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  const projectId = String(env.FIREBASE_PROJECT_ID || '').trim();
  const uid = String(payload?.user_id || payload?.sub || '').trim();
  const now = Math.floor(Date.now() / 1000);

  if (
    header.alg !== 'RS256' ||
    !header.kid ||
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    !uid ||
    uid.length > 128 ||
    Number(payload.exp || 0) <= now ||
    Number(payload.iat || 0) > now + 300
  ) {
    throw new HttpError(401, 'invalid_session', 'Sesi sudah tidak valid. Login kembali.');
  }

  const jwkResponse = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    { cf: { cacheEverything: true, cacheTtl: 3600 } },
  );
  const jwkSet = await jwkResponse.json().catch(() => null);
  const jwk = jwkSet?.keys?.find((candidate) => candidate.kid === header.kid);
  if (!jwkResponse.ok || !jwk) {
    throw new HttpError(401, 'invalid_session', 'Sesi belum dapat diverifikasi. Login kembali.');
  }
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { hash: 'SHA-256', name: 'RSASSA-PKCS1-v1_5' },
    false,
    ['verify'],
  );
  const signatureValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!signatureValid) {
    throw new HttpError(401, 'invalid_session', 'Sesi sudah tidak valid. Login kembali.');
  }

  return {
    authTime: Number(payload.auth_time || payload.iat || 0),
    email: String(payload.email || '').trim(),
    uid,
  };
}

function permissionEnabled(user, permission) {
  if (user.role === 'owner') return true;
  if (user.role !== 'admin' || user.status !== 'approved') return false;

  if (permission === 'notifications') {
    return user.permissions?.notifications === true || (
      typeof user.permissions?.notifications !== 'boolean' &&
      user.permissions?.settings === true
    );
  }

  return user.permissions?.[permission] === true;
}

export async function authorize(env, request, firestore, options = {}) {
  const identity = await verifyFirebaseToken(env, request);
  const userDocument = await firestore.getDocument('users', identity.uid);
  const user = userDocument?.data || null;

  if (!user || !['owner', 'admin'].includes(user.role) || user.status !== 'approved') {
    throw new HttpError(403, 'admin_access_required', 'Akun tidak memiliki akses Admin aktif.');
  }

  if (options.ownerOnly && user.role !== 'owner') {
    throw new HttpError(403, 'owner_required', 'Operasi ini hanya tersedia untuk Owner.');
  }

  if (options.permission && !permissionEnabled(user, options.permission)) {
    throw new HttpError(403, 'permission_denied', 'Permission untuk operasi ini tidak aktif.');
  }

  if (options.requireFreshAuth) {
    const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - identity.authTime);
    if (!identity.authTime || ageSeconds > 300) {
      throw new HttpError(
        401,
        'fresh_auth_required',
        'Verifikasi ulang akun diperlukan sebelum operasi sensitif ini.',
      );
    }
  }

  return {
    ...identity,
    displayName: String(user.displayName || identity.email || 'Admin').trim().slice(0, 120),
    permissions: user.permissions || {},
    role: user.role,
    userDocument,
  };
}
