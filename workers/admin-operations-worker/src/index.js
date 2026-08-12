import { transferOwnership } from './domain/accounts.js';
import {
  createDangerDryRun,
  readDangerJob,
  runDangerJobStep,
  startDangerJob,
} from './domain/danger.js';
import {
  recordPayment,
  recordRefund,
  reviewPaymentProof,
  voidInvoice,
} from './domain/finance.js';
import { permanentlyDeleteGalleryItem } from './domain/gallery.js';
import { adjustInventory } from './domain/inventory.js';
import { authorize } from './lib/auth.js';
import { createFirestoreClient } from './lib/firestore.js';
import { HttpError, corsHeaders, json, readJson, toPublicError } from './lib/http.js';

function pathMatch(pathname, pattern) {
  const match = pathname.match(pattern);
  return match ? match.slice(1).map((value) => decodeURIComponent(value)) : null;
}

async function requirePost(request) {
  if (request.method !== 'POST') {
    throw new HttpError(405, 'method_not_allowed', 'Gunakan POST untuk operasi ini.');
  }
  return readJson(request);
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(request, env), status: 204 });
  }
  if (request.method === 'GET' && pathname === '/health') {
    return json(request, env, {
      environment: String(env.APP_ENVIRONMENT || 'unknown'),
      ok: true,
      service: 'studio37-admin-operations',
    });
  }

  const firestore = createFirestoreClient(env);
  let body;
  let actor;
  let result;
  let params;

  if (pathname === '/v1/finance/payments') {
    body = await requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'billing' });
    result = await recordPayment({ actor, body, firestore, request });
  } else if (pathname === '/v1/finance/refunds') {
    body = await requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'billing' });
    result = await recordRefund({ actor, body, firestore, request });
  } else if (pathname === '/v1/finance/voids') {
    body = await requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'billing' });
    result = await voidInvoice({ actor, body, firestore, request });
  } else if ((params = pathMatch(pathname, /^\/v1\/finance\/payment-proofs\/([^/]+)\/(approve|reject)$/))) {
    body = await requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'billing' });
    result = await reviewPaymentProof({
      actor,
      body,
      decision: params[1],
      firestore,
      proofId: params[0],
      request,
    });
  } else if (pathname === '/v1/inventory/adjustments') {
    body = await requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'inventory' });
    result = await adjustInventory({ actor, body, firestore, request });
  } else if (pathname === '/v1/gallery/permanent-delete') {
    body = await requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, permission: 'gallery' });
    result = await permanentlyDeleteGalleryItem({ actor, body, env, firestore, request });
  } else if (pathname === '/v1/accounts/transfer-ownership') {
    body = await requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, requireFreshAuth: true });
    result = await transferOwnership({ actor, body, firestore, request });
  } else if (pathname === '/v1/danger-zone/dry-run') {
    body = await requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true });
    result = await createDangerDryRun({ actor, body, env, firestore, request });
  } else if (pathname === '/v1/danger-zone/jobs') {
    body = await requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, requireFreshAuth: true });
    result = await startDangerJob({ actor, body, env, firestore, request });
  } else if ((params = pathMatch(pathname, /^\/v1\/danger-zone\/jobs\/([^/]+)\/step$/))) {
    body = await requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true });
    result = await runDangerJobStep({ actor, body, firestore, jobId: params[0], request });
  } else if ((params = pathMatch(pathname, /^\/v1\/danger-zone\/jobs\/([^/]+)$/))) {
    if (request.method !== 'GET') {
      throw new HttpError(405, 'method_not_allowed', 'Gunakan GET untuk membaca status job.');
    }
    actor = await authorize(env, request, firestore, { ownerOnly: true });
    result = await readDangerJob({ actor, firestore, jobId: params[0] });
  } else {
    throw new HttpError(404, 'not_found', 'Endpoint operasi tidak ditemukan.');
  }

  return json(request, env, { ...result, ok: true });
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const publicError = toPublicError(error);
      console.error('admin-operation-failed', {
        code: publicError.payload.code,
        method: request.method,
        status: publicError.status,
      });
      return json(request, env, publicError.payload, { status: publicError.status });
    }
  },
};
