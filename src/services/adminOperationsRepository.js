import { firebaseAuth } from '../lib/firebase.js';

const operationEnv = import.meta.env || {};
const ADMIN_OPERATIONS_URL = String(operationEnv.VITE_ADMIN_OPERATIONS_URL || '')
  .trim()
  .replace(/\/$/, '');
const DEFAULT_TIMEOUT_MS = 20_000;

export class AdminOperationError extends Error {
  constructor(message, { code = 'operation_failed', details = null, status = 0 } = {}) {
    super(message);
    this.name = 'AdminOperationError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export function createAdminOperationKey(action, targetId = '') {
  const safeAction = String(action || 'operation').replace(/[^a-z0-9_-]/gi, '_').slice(0, 50);
  const safeTarget = String(targetId || '').replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return [safeAction, safeTarget, random].filter(Boolean).join(':');
}

function requireOperationsUrl() {
  if (!ADMIN_OPERATIONS_URL) {
    throw new AdminOperationError(
      'Admin Operations Worker belum dikonfigurasi. Isi VITE_ADMIN_OPERATIONS_URL.',
      { code: 'operations_not_configured' },
    );
  }
  return ADMIN_OPERATIONS_URL;
}

async function getCurrentToken(forceRefresh = false) {
  const user = firebaseAuth?.currentUser;
  if (!user || typeof user.getIdToken !== 'function') {
    throw new AdminOperationError('Sesi Admin diperlukan.', { code: 'authentication_required', status: 401 });
  }
  return user.getIdToken(forceRefresh);
}

async function parseResponse(response) {
  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.ok === false) {
    throw new AdminOperationError(
      payload?.error || `Operasi gagal (${response.status}).`,
      {
        code: payload?.code || 'operation_failed',
        details: payload?.details || null,
        status: response.status,
      },
    );
  }

  return payload || { ok: true };
}

async function requestOperation(path, {
  body,
  idempotencyKey = '',
  method = 'POST',
  retryCount = 1,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const url = `${requireOperationsUrl()}${path}`;
  const operationKey = idempotencyKey || (
    method === 'POST' ? createAdminOperationKey('admin') : ''
  );
  let lastError;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const token = await getCurrentToken(attempt > 0 && lastError?.status === 401);
      const response = await fetch(url, {
        ...(body === undefined ? {} : { body: JSON.stringify({ ...body, idempotencyKey: operationKey }) }),
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(operationKey ? { 'x-idempotency-key': operationKey } : {}),
        },
        method,
        signal: controller.signal,
      });

      return await parseResponse(response);
    } catch (error) {
      lastError = error;
      const retryable = error?.name === 'AbortError' || (
        !(error instanceof AdminOperationError) || error.status >= 500
      );
      if (!retryable || attempt >= retryCount) break;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError?.name === 'AbortError') {
    throw new AdminOperationError(
      'Operasi memerlukan waktu lebih lama. Status aman akan dicek saat dicoba ulang.',
      { code: 'operation_timeout' },
    );
  }
  throw lastError;
}

export function recordCanonicalPayment(input, idempotencyKey = '') {
  return requestOperation('/v1/finance/payments', {
    body: input,
    idempotencyKey: idempotencyKey || createAdminOperationKey('payment', input?.bookingId),
  });
}

export function recordCanonicalRefund(input, idempotencyKey = '') {
  return requestOperation('/v1/finance/refunds', {
    body: input,
    idempotencyKey: idempotencyKey || createAdminOperationKey('refund', input?.bookingId),
  });
}

export function voidCanonicalInvoice(input, idempotencyKey = '') {
  return requestOperation('/v1/finance/voids', {
    body: input,
    idempotencyKey: idempotencyKey || createAdminOperationKey('void', input?.bookingId),
  });
}

export function reviewCanonicalPaymentProof(proofId, decision, input = {}, idempotencyKey = '') {
  return requestOperation(`/v1/finance/payment-proofs/${encodeURIComponent(proofId)}/${decision}`, {
    body: input,
    idempotencyKey: idempotencyKey || `payment-proof:${decision}:${proofId}`,
  });
}

export function adjustCanonicalInventory(input, idempotencyKey = '') {
  return requestOperation('/v1/inventory/adjustments', {
    body: input,
    idempotencyKey: idempotencyKey || createAdminOperationKey('inventory', input?.itemId),
  });
}

export function permanentlyDeleteGalleryItem(input, idempotencyKey = '') {
  return requestOperation('/v1/gallery/permanent-delete', {
    body: input,
    idempotencyKey: idempotencyKey || createAdminOperationKey('gallery-delete', input?.itemId),
  });
}

export function transferCanonicalOwnership(input, idempotencyKey = '') {
  return requestOperation('/v1/accounts/transfer-ownership', {
    body: input,
    idempotencyKey: idempotencyKey || createAdminOperationKey('ownership', input?.targetUid),
  });
}

export function createDangerZoneDryRun(idempotencyKey = '') {
  return requestOperation('/v1/danger-zone/dry-run', {
    body: {},
    idempotencyKey: idempotencyKey || createAdminOperationKey('danger-dry-run'),
    timeoutMs: 45_000,
  });
}

export function startDangerZoneJob(input, idempotencyKey = '') {
  return requestOperation('/v1/danger-zone/jobs', {
    body: input,
    idempotencyKey: idempotencyKey || createAdminOperationKey('danger-start', input?.snapshotId),
  });
}

export function stepDangerZoneJob(jobId, idempotencyKey = '') {
  return requestOperation(`/v1/danger-zone/jobs/${encodeURIComponent(jobId)}/step`, {
    body: {},
    idempotencyKey: idempotencyKey || createAdminOperationKey('danger-step', jobId),
    timeoutMs: 45_000,
  });
}

export function getDangerZoneJob(jobId) {
  return requestOperation(`/v1/danger-zone/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    retryCount: 0,
  });
}

export const adminOperationsRepository = {
  adjustInventory: adjustCanonicalInventory,
  createDangerZoneDryRun,
  getDangerZoneJob,
  permanentlyDeleteGalleryItem,
  recordPayment: recordCanonicalPayment,
  recordRefund: recordCanonicalRefund,
  reviewPaymentProof: reviewCanonicalPaymentProof,
  startDangerZoneJob,
  stepDangerZoneJob,
  transferOwnership: transferCanonicalOwnership,
  voidInvoice: voidCanonicalInvoice,
};
