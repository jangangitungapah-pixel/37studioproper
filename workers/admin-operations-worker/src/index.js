import { transferOwnership } from './domain/accounts.js';
import { createManualBooking, decideBookingRequest, updateManualBooking } from './domain/bookings.js';
import { recordBookingSessionAction } from './domain/bookingSessions.js';
import { closeDailyClosing, previewDailyClosing, reopenDailyClosing } from './domain/dailyClosings.js';
import { actOnMaintenanceWorkOrder, recordMaintenanceCost, reportMaintenanceWorkOrder } from './domain/maintenance.js';
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
import { cancelCustomerFollowUpTask, createCustomerFollowUpTask, listCustomerFollowUpAssignees, updateCustomerFollowUpTask } from './domain/customerFollowUp.js';
import {
  adjustInventory,
  archiveInventoryItem,
  createPurchaseOrder,
  createSupplier,
  receivePurchaseOrder,
  recordPurchaseOrderPayment,
  saveInventoryItem,
  transitionPurchaseOrder,
} from './domain/inventory.js';
import { authorize } from './lib/auth.js';
import { createFirestoreClient } from './lib/firestore.js';
import { HttpError, corsHeaders, json, readJson, toPublicError } from './lib/http.js';

function pathMatch(pathname, pattern) {
  const match = pathname.match(pattern);
  return match ? match.slice(1).map((value) => decodeURIComponent(value)) : null;
}

function requirePost(request) {
  if (request.method !== 'POST') {
    throw new HttpError(405, 'method_not_allowed', 'Gunakan POST untuk operasi ini.');
  }
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

  if (pathname === '/v1/bookings/manual') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'schedule' });
    body = await readJson(request);
    result = await createManualBooking({ actor, body, firestore, request });
  } else if (pathname === '/v1/bookings/requests/decision') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'schedule' });
    body = await readJson(request);
    result = await decideBookingRequest({ actor, body, firestore, request });
  } else if (pathname === '/v1/bookings/sessions/action') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'schedule' });
    body = await readJson(request);
    result = await recordBookingSessionAction({ actor, body, firestore, request });
  } else if (pathname === '/v1/bookings/manual/update') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'schedule' });
    body = await readJson(request);
    result = await updateManualBooking({ actor, body, firestore, request });
  } else if (pathname === '/v1/finance/daily-closings/preview') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'bookkeeping' });
    body = await readJson(request);
    result = await previewDailyClosing({ actor, body, firestore });
  } else if (pathname === '/v1/finance/daily-closings/close') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'bookkeeping' });
    body = await readJson(request);
    result = await closeDailyClosing({ actor, body, firestore, request });
  } else if (pathname === '/v1/finance/daily-closings/reopen') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, permission: 'bookkeeping', requireFreshAuth: true });
    body = await readJson(request);
    result = await reopenDailyClosing({ actor, body, firestore, request });
  } else if (pathname === '/v1/finance/payments') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'billing' });
    body = await readJson(request);
    result = await recordPayment({ actor, body, firestore, request });
  } else if (pathname === '/v1/finance/refunds') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'billing' });
    body = await readJson(request);
    result = await recordRefund({ actor, body, firestore, request });
  } else if (pathname === '/v1/finance/voids') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'billing' });
    body = await readJson(request);
    result = await voidInvoice({ actor, body, firestore, request });
  } else if ((params = pathMatch(pathname, /^\/v1\/finance\/payment-proofs\/([^/]+)\/(approve|reject)$/))) {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'billing' });
    body = await readJson(request);
    result = await reviewPaymentProof({
      actor,
      body,
      decision: params[1],
      firestore,
      proofId: params[0],
      request,
    });
  } else if (pathname === '/v1/inventory/items') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'inventory' });
    body = await readJson(request);
    result = await saveInventoryItem({ actor, body, firestore, request });
  } else if (pathname === '/v1/inventory/items/archive') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'inventory' });
    body = await readJson(request);
    result = await archiveInventoryItem({ actor, body, firestore, request });
  } else if (pathname === '/v1/customers/follow-ups/assignees') {
    if (request.method !== 'GET') {
      throw new HttpError(405, 'method_not_allowed', 'Gunakan GET untuk membaca daftar PIC.');
    }
    actor = await authorize(env, request, firestore, { permission: 'customers' });
    result = await listCustomerFollowUpAssignees({ actor, firestore });
  } else if (pathname === '/v1/customers/follow-ups') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'customers' });
    body = await readJson(request);
    result = await createCustomerFollowUpTask({ actor, body, firestore, request });
  } else if (pathname === '/v1/customers/follow-ups/update') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'customers' });
    body = await readJson(request);
    result = await updateCustomerFollowUpTask({ actor, body, firestore, request });
  } else if (pathname === '/v1/customers/follow-ups/cancel') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'customers' });
    body = await readJson(request);
    result = await cancelCustomerFollowUpTask({ actor, body, firestore, request });
  } else if (pathname === '/v1/inventory/adjustments') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'inventory' });
    body = await readJson(request);
    result = await adjustInventory({ actor, body, firestore, request });
  } else if (pathname === '/v1/inventory/maintenance/work-orders') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'inventory' });
    body = await readJson(request);
    result = await reportMaintenanceWorkOrder({ actor, body, firestore, request });
  } else if (pathname === '/v1/inventory/maintenance/work-orders/action') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'inventory' });
    body = await readJson(request);
    if (body.action === 'reopen') {
      throw new HttpError(403, 'owner_reopen_route_required', 'Reopen harus menggunakan endpoint khusus Owner dengan verifikasi ulang.');
    }
    result = await actOnMaintenanceWorkOrder({ actor, body, firestore, request });
  } else if (pathname === '/v1/inventory/maintenance/work-orders/reopen') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, permission: 'inventory', requireFreshAuth: true });
    body = await readJson(request);
    result = await actOnMaintenanceWorkOrder({ actor, body: { ...body, action: 'reopen' }, firestore, request });
  } else if (pathname === '/v1/inventory/maintenance/work-orders/cost') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'bookkeeping' });
    body = await readJson(request);
    result = await recordMaintenanceCost({ actor, body, firestore, request });
  } else if (pathname === '/v1/procurement/suppliers') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'inventory' });
    body = await readJson(request);
    result = await createSupplier({ actor, body, firestore, request });
  } else if (pathname === '/v1/procurement/purchase-orders') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'inventory' });
    body = await readJson(request);
    result = await createPurchaseOrder({ actor, body, firestore, request });
  } else if (pathname === '/v1/procurement/purchase-orders/transition') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'inventory' });
    body = await readJson(request);
    result = await transitionPurchaseOrder({ actor, body, firestore, request });
  } else if (pathname === '/v1/procurement/goods-receipts') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'inventory' });
    body = await readJson(request);
    result = await receivePurchaseOrder({ actor, body, firestore, request });
  } else if (pathname === '/v1/procurement/payments') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: 'bookkeeping' });
    body = await readJson(request);
    result = await recordPurchaseOrderPayment({ actor, body, firestore, request });
  } else if (pathname === '/v1/gallery/permanent-delete') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, permission: 'gallery' });
    body = await readJson(request);
    result = await permanentlyDeleteGalleryItem({ actor, body, env, firestore, request });
  } else if (pathname === '/v1/accounts/transfer-ownership') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, requireFreshAuth: true });
    body = await readJson(request);
    result = await transferOwnership({ actor, body, firestore, request });
  } else if (pathname === '/v1/danger-zone/dry-run') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true });
    body = await readJson(request);
    result = await createDangerDryRun({ actor, body, env, firestore, request });
  } else if (pathname === '/v1/danger-zone/jobs') {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, requireFreshAuth: true });
    body = await readJson(request);
    result = await startDangerJob({ actor, body, env, firestore, request });
  } else if ((params = pathMatch(pathname, /^\/v1\/danger-zone\/jobs\/([^/]+)\/step$/))) {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true });
    body = await readJson(request);
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
      console.error('admin-operation-diagnostic', {
  method: request.method,
  status: publicError.status,
  errorMessage: String(error?.message || '').slice(0, 200),
  requestPath: String(error?.requestPath || '')
    .replace(/\/users\/[^/?]+/g, '/users/{uid}')
    .slice(0, 240),
  upstreamStatus: error?.status || null,
  upstreamCode: error?.payload?.error?.status || null,
  upstreamMessage: String(error?.payload?.error?.message || '').slice(0, 240),
  upstreamDetails: Array.isArray(error?.payload?.error?.details)
    ? error.payload.error.details.map((detail) => ({
        reason: detail?.reason || null,
        domain: detail?.domain || null,
        permission: detail?.metadata?.permission || null,
        service: detail?.metadata?.service || null,
        method: detail?.metadata?.method || null,
      }))
    : [],
});
      return json(request, env, publicError.payload, { status: publicError.status });
    }
  },
};
