const MAX_JSON_BYTES = 64 * 1024;

export class HttpError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function allowedOrigin(request, env) {
  const requestOrigin = String(request.headers.get('origin') || '').trim();
  const configured = String(env.SITE_ORIGIN || '').trim().replace(/\/$/, '');

  if (!requestOrigin) return configured || '*';
  if (!configured || requestOrigin === configured) return requestOrigin;

  return configured;
}

export function corsHeaders(request, env) {
  return {
    'access-control-allow-headers': 'authorization,content-type,x-idempotency-key',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-origin': allowedOrigin(request, env),
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

export function json(request, env, payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      ...corsHeaders(request, env),
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

export async function readJson(request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);

  if (declaredLength > MAX_JSON_BYTES) {
    throw new HttpError(413, 'payload_too_large', 'Payload operasi terlalu besar.');
  }

  const text = await request.text();

  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new HttpError(413, 'payload_too_large', 'Payload operasi terlalu besar.');
  }

  if (!text) return {};

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new HttpError(400, 'invalid_json', 'Payload JSON tidak valid.');
  }
}

export function getIdempotencyKey(request, body, fallback = '') {
  const raw = String(
    request.headers.get('x-idempotency-key') || body?.idempotencyKey || fallback || '',
  ).trim();

  if (!raw || raw.length > 240 || !/^[A-Za-z0-9._:-]+$/.test(raw)) {
    throw new HttpError(
      400,
      'invalid_idempotency_key',
      'Operation key tidak valid. Muat ulang form lalu coba lagi.',
    );
  }

  return raw;
}

export function cleanText(value, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength);
}

export function cleanMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function toPublicError(error) {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      payload: {
        code: error.code,
        details: error.details,
        error: error.message,
        ok: false,
      },
    };
  }

  return {
    status: 500,
    payload: {
      code: 'internal_error',
      error: 'Operasi belum selesai. Data tidak diubah. Coba lagi atau hubungi Owner.',
      ok: false,
    },
  };
}
