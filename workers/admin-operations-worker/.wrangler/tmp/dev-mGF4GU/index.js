var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/lib/http.js
var MAX_JSON_BYTES = 64 * 1024;
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  constructor(status, code, message, details = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
};
function allowedOrigin(request, env) {
  const requestOrigin = String(request.headers.get("origin") || "").trim();
  const configured2 = String(env.SITE_ORIGIN || "").trim().replace(/\/$/, "");
  if (!requestOrigin) return configured2 || "*";
  if (!configured2 || requestOrigin === configured2) return requestOrigin;
  return configured2;
}
__name(allowedOrigin, "allowedOrigin");
function corsHeaders(request, env) {
  return {
    "access-control-allow-headers": "authorization,content-type,x-idempotency-key",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-origin": allowedOrigin(request, env),
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
function json(request, env, payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      ...corsHeaders(request, env),
      "cache-control": "no-store",
      ...init.headers || {}
    }
  });
}
__name(json, "json");
async function readJson(request) {
  const lengthHeader = request.headers.get("content-length");
  const declaredLength = lengthHeader === null ? 0 : Number(lengthHeader);
  if (!Number.isFinite(declaredLength) || declaredLength < 0) {
    throw new HttpError(400, "invalid_content_length", "Content-Length tidak valid.");
  }
  if (declaredLength > MAX_JSON_BYTES) {
    throw new HttpError(413, "payload_too_large", "Payload operasi terlalu besar.");
  }
  if (!request.body) return {};
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_JSON_BYTES) {
        await reader.cancel("payload_too_large");
        throw new HttpError(413, "payload_too_large", "Payload operasi terlalu besar.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new HttpError(400, "invalid_json", "Payload JSON tidak valid.");
  }
}
__name(readJson, "readJson");
function getIdempotencyKey(request, body, fallback = "") {
  const raw = String(
    request.headers.get("x-idempotency-key") || body?.idempotencyKey || fallback || ""
  ).trim();
  if (!raw || raw.length > 240 || !/^[A-Za-z0-9._:-]+$/.test(raw)) {
    throw new HttpError(
      400,
      "invalid_idempotency_key",
      "Operation key tidak valid. Muat ulang form lalu coba lagi."
    );
  }
  return raw;
}
__name(getIdempotencyKey, "getIdempotencyKey");
function cleanText(value, maxLength = 2e3) {
  return String(value || "").trim().slice(0, maxLength);
}
__name(cleanText, "cleanText");
function cleanMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}
__name(cleanMoney, "cleanMoney");
function toPublicError(error) {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      payload: {
        code: error.code,
        details: error.details,
        error: error.message,
        ok: false
      }
    };
  }
  return {
    status: 500,
    payload: {
      code: "internal_error",
      error: "Operasi belum selesai. Data tidak diubah. Coba lagi atau hubungi Owner.",
      ok: false
    }
  };
}
__name(toPublicError, "toPublicError");

// src/lib/firestore.js
function requiredEnv(env, key) {
  const value = String(env[key] || "").trim();
  if (!value) throw new Error(`Missing required environment binding: ${key}`);
  return value;
}
__name(requiredEnv, "requiredEnv");
function base64UrlEncode(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function pemToArrayBuffer(pem) {
  const normalized = String(pem || "").replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
__name(pemToArrayBuffer, "pemToArrayBuffer");
async function createServiceAccountJwt(env) {
  const now = Math.floor(Date.now() / 1e3);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
    iss: requiredEnv(env, "FIREBASE_CLIENT_EMAIL"),
    scope: "https://www.googleapis.com/auth/datastore"
  };
  const signingInput = [
    base64UrlEncode(JSON.stringify(header)),
    base64UrlEncode(JSON.stringify(claim))
  ].join(".");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(requiredEnv(env, "FIREBASE_PRIVATE_KEY")),
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
}
__name(createServiceAccountJwt, "createServiceAccountJwt");
async function fetchAccessToken(env) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      assertion: await createServiceAccountJwt(env),
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer"
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
  const payload = await response.json();
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Firebase service authentication failed (${response.status}).`);
  }
  return {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 3600)) * 1e3
  };
}
__name(fetchAccessToken, "fetchAccessToken");
function encodeValue(value) {
  if (value === null || value === void 0) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nested]) => [key, encodeValue(nested)])
        )
      }
    };
  }
  return { stringValue: String(value) };
}
__name(encodeValue, "encodeValue");
function decodeValue(value = {}) {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
  return null;
}
__name(decodeValue, "decodeValue");
function encodeFields(data = {}) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)]));
}
__name(encodeFields, "encodeFields");
function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}
__name(decodeFields, "decodeFields");
function assertPathSegment(value, label) {
  const clean = String(value || "").trim();
  if (!clean || clean.includes("/") || clean.length > 500) {
    throw new Error(`Invalid Firestore ${label}.`);
  }
  return clean;
}
__name(assertPathSegment, "assertPathSegment");
async function stableDocumentId(prefix, rawKey) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${prefix}:${rawKey}`)
  );
  const hex2 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex2.slice(0, 40)}`;
}
__name(stableDocumentId, "stableDocumentId");
function createFirestoreClient(env) {
  const projectId = requiredEnv(env, "FIREBASE_PROJECT_ID");
  const databaseRoot = `projects/${projectId}/databases/(default)`;
  const documentRoot = `${databaseRoot}/documents`;
  let tokenPromise = null;
  async function token(forceRefresh = false) {
    if (forceRefresh) tokenPromise = null;
    if (!tokenPromise) tokenPromise = fetchAccessToken(env);
    let tokenState = await tokenPromise;
    if (tokenState.expiresAt <= Date.now() + 6e4) {
      tokenPromise = fetchAccessToken(env);
      tokenState = await tokenPromise;
    }
    return tokenState.accessToken;
  }
  __name(token, "token");
  function documentName(collectionId, documentId) {
    return `${documentRoot}/${assertPathSegment(collectionId, "collection")}/${assertPathSegment(documentId, "document id")}`;
  }
  __name(documentName, "documentName");
  async function api(path, init = {}) {
    const requestUrl = `https://firestore.googleapis.com/v1/${path}`;
    const send = /* @__PURE__ */ __name(async (forceRefresh = false) => fetch(requestUrl, {
      ...init,
      headers: {
        authorization: `Bearer ${await token(forceRefresh)}`,
        "content-type": "application/json",
        ...init.headers || {}
      }
    }), "send");
    let response = await send();
    if (response.status === 401) response = await send(true);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `Firestore request failed (${response.status}).`);
      error.status = response.status;
      error.payload = payload;
      error.requestPath = path;
      throw error;
    }
    return payload;
  }
  __name(api, "api");
  async function getDocument(collectionId, documentId) {
    try {
      const document = await api(documentName(collectionId, documentId));
      return {
        createTime: document.createTime || "",
        data: decodeFields(document.fields || {}),
        id: document.name?.split("/").pop() || documentId,
        name: document.name,
        updateTime: document.updateTime || ""
      };
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }
  __name(getDocument, "getDocument");
  async function listDocuments(collectionId, { pageSize = 250, pageToken = "" } = {}) {
    const params = new URLSearchParams({ pageSize: String(Math.max(1, Math.min(500, pageSize))) });
    if (pageToken) params.set("pageToken", pageToken);
    const payload = await api(`${documentRoot}/${assertPathSegment(collectionId, "collection")}?${params}`);
    return {
      documents: (payload.documents || []).map((document) => ({
        data: decodeFields(document.fields || {}),
        id: document.name?.split("/").pop() || "",
        name: document.name,
        updateTime: document.updateTime || ""
      })),
      nextPageToken: payload.nextPageToken || ""
    };
  }
  __name(listDocuments, "listDocuments");
  async function runQuery(structuredQuery) {
    const rows = await api(`${documentRoot}:runQuery`, {
      body: JSON.stringify({ structuredQuery }),
      method: "POST"
    });
    return (rows || []).filter((row) => row.document).map((row) => ({
      data: decodeFields(row.document.fields || {}),
      id: row.document.name?.split("/").pop() || "",
      name: row.document.name,
      updateTime: row.document.updateTime || ""
    }));
  }
  __name(runQuery, "runQuery");
  async function commit(writes) {
    return api(`${databaseRoot}/documents:commit`, {
      body: JSON.stringify({ writes }),
      method: "POST"
    });
  }
  __name(commit, "commit");
  function setWrite(collectionId, documentId, data, precondition = null) {
    return {
      update: {
        fields: encodeFields(data),
        name: documentName(collectionId, documentId)
      },
      ...precondition ? { currentDocument: precondition } : {}
    };
  }
  __name(setWrite, "setWrite");
  function deleteWrite(collectionId, documentId, precondition = null) {
    return {
      delete: documentName(collectionId, documentId),
      ...precondition ? { currentDocument: precondition } : {}
    };
  }
  __name(deleteWrite, "deleteWrite");
  return {
    commit,
    deleteWrite,
    documentName,
    getDocument,
    listDocuments,
    projectId,
    runQuery,
    setWrite
  };
}
__name(createFirestoreClient, "createFirestoreClient");

// src/lib/operation.js
async function operationDocumentId(type, key) {
  return stableDocumentId("op", `${type}:${key}`);
}
__name(operationDocumentId, "operationDocumentId");
async function readOperationResult(firestore, type, key) {
  const id = await operationDocumentId(type, key);
  const existing = await firestore.getDocument("adminOperationKeys", id);
  if (!existing) return { id, result: null };
  const result = { ...existing.data.result || {} };
  const documentRefs = existing.data.documentRefs || {};
  await Promise.all(Object.entries(documentRefs).map(async ([resultKey, reference]) => {
    const document = await firestore.getDocument(reference.collectionId, reference.documentId);
    if (document) result[resultKey] = { id: document.id, ...document.data };
  }));
  return { id, result };
}
__name(readOperationResult, "readOperationResult");
async function commitIdempotentOperation({
  actor,
  documentRefs = {},
  firestore,
  key,
  result,
  receipt = null,
  targetId = "",
  type,
  writes
}) {
  const operation = await readOperationResult(firestore, type, key);
  if (operation.result) return { duplicate: true, result: operation.result };
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const operationRecord = {
    actorName: actor.displayName,
    actorUid: actor.uid,
    createdAt: now,
    documentRefs,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString(),
    id: operation.id,
    key,
    result: receipt ?? result,
    targetId: String(targetId || ""),
    type
  };
  const auditRecord = {
    actorName: actor.displayName,
    actorUid: actor.uid,
    createdAt: now,
    id: operation.id,
    key,
    targetId: String(targetId || ""),
    type
  };
  try {
    await firestore.commit([
      ...writes,
      firestore.setWrite(
        "adminOperationKeys",
        operation.id,
        operationRecord,
        { exists: false }
      ),
      firestore.setWrite(
        "adminOperationAudit",
        operation.id,
        auditRecord,
        { exists: false }
      )
    ]);
    return { duplicate: false, result };
  } catch (error) {
    const raced = await readOperationResult(firestore, type, key).catch(() => null);
    if (raced?.result) return { duplicate: true, result: raced.result };
    if (error?.status === 409 || error?.status === 412) {
      throw new HttpError(
        409,
        "operation_conflict",
        "Data berubah saat operasi diproses. Muat data terbaru lalu tinjau kembali."
      );
    }
    throw error;
  }
}
__name(commitIdempotentOperation, "commitIdempotentOperation");

// src/domain/accounts.js
function allAdminPermissions() {
  return {
    billing: true,
    bookkeeping: true,
    customers: true,
    dashboard: true,
    gallery: true,
    "guard-attendance": true,
    inventory: true,
    notifications: true,
    "operator-fee": true,
    schedule: true,
    settings: true
  };
}
__name(allAdminPermissions, "allAdminPermissions");
async function transferOwnership({ actor, body, firestore, request }) {
  const targetUid = cleanText(body.targetUid, 160);
  const key = getIdempotencyKey(request, body, `ownership-transfer:${actor.uid}:${targetUid}`);
  const existing = await readOperationResult(firestore, "ownership-transfer", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  if (!targetUid || targetUid === actor.uid) {
    throw new HttpError(400, "invalid_target", "Pilih Admin lain sebagai Owner baru.");
  }
  const [sourceDocument, targetDocument, ownershipDocument, owners] = await Promise.all([
    firestore.getDocument("users", actor.uid),
    firestore.getDocument("users", targetUid),
    firestore.getDocument("adminControl", "ownership"),
    firestore.runQuery({
      from: [{ collectionId: "users" }],
      limit: 3,
      where: { fieldFilter: { field: { fieldPath: "role" }, op: "EQUAL", value: { stringValue: "owner" } } }
    })
  ]);
  if (!sourceDocument || sourceDocument.data.role !== "owner") {
    throw new HttpError(409, "owner_changed", "Owner aktif sudah berubah. Muat ulang halaman.");
  }
  if (ownershipDocument && ownershipDocument.data.currentOwnerUid !== actor.uid) {
    throw new HttpError(409, "owner_control_changed", "Owner control sudah berubah. Muat ulang halaman.");
  }
  if (owners.length !== 1 || owners[0].id !== actor.uid) {
    throw new HttpError(409, "owner_invariant", "Transfer dihentikan karena invariant satu Owner tidak terpenuhi.");
  }
  if (!targetDocument || targetDocument.data.role !== "admin" || targetDocument.data.status !== "approved") {
    throw new HttpError(409, "target_not_approved", "Target harus merupakan Admin approved aktif.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const permissions = allAdminPermissions();
  const nextSource = {
    ...sourceDocument.data,
    ownershipTransferredOutAt: now,
    permissions,
    role: "admin",
    status: "approved",
    updatedAt: now
  };
  const nextTarget = {
    ...targetDocument.data,
    ownershipTransferredInAt: now,
    permissions,
    role: "owner",
    status: "approved",
    updatedAt: now
  };
  const result = { previousOwnerUid: actor.uid, status: "transferred", targetUid };
  const committed = await commitIdempotentOperation({
    actor,
    firestore,
    key,
    result,
    targetId: targetUid,
    type: "ownership-transfer",
    writes: [
      firestore.setWrite("users", actor.uid, nextSource, { updateTime: sourceDocument.updateTime }),
      firestore.setWrite("users", targetUid, nextTarget, { updateTime: targetDocument.updateTime }),
      firestore.setWrite("adminControl", "ownership", {
        currentOwnerUid: targetUid,
        initializedAt: ownershipDocument?.data?.initializedAt || now,
        updatedAt: now
      }, ownershipDocument ? { updateTime: ownershipDocument.updateTime } : { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(transferOwnership, "transferOwnership");

// src/domain/bookings.js
var PAYMENT_METHODS = /* @__PURE__ */ new Set(["cash", "transfer", "qris", "other"]);
var CANCELLED_STATES = /* @__PURE__ */ new Set(["cancelled", "canceled", "rejected", "deleted"]);
var NON_BLOCKING_REQUEST_STATES = /* @__PURE__ */ new Set(["draft", "submitted", "rejected", "cancelled", "canceled", "deleted"]);
var BOOKING_DECISION_TRANSITIONS = Object.freeze({
  submitted: /* @__PURE__ */ new Set(["confirmed", "rejected"]),
  cancellation_requested: /* @__PURE__ */ new Set(["cancelled", "confirmed"])
});
function cleanDate(value) {
  const date = cleanText(value, 10);
  const parsed = /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, "invalid_date", "Tanggal booking tidak valid.");
  }
  return date;
}
__name(cleanDate, "cleanDate");
function cleanNumber(value, minimum, maximum, code, message) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new HttpError(400, code, message);
  }
  return number;
}
__name(cleanNumber, "cleanNumber");
function paymentMethod(value) {
  const method = cleanText(value, 20).toLowerCase();
  if (!PAYMENT_METHODS.has(method)) {
    throw new HttpError(400, "invalid_payment_method", "Metode wajib cash, transfer, qris, atau other.");
  }
  return method;
}
__name(paymentMethod, "paymentMethod");
function normalizeStatus(value) {
  return cleanText(value, 40).toLowerCase().replace(/[-\s]+/g, "_");
}
__name(normalizeStatus, "normalizeStatus");
function requestStatus(booking) {
  const value = booking?.requestStatus || booking?.bookingRequestStatus;
  return normalizeStatus(value || (booking?.source === "clientPortal" ? "submitted" : "confirmed"));
}
__name(requestStatus, "requestStatus");
function isCancelled(booking) {
  const values = [
    booking?.requestStatus,
    booking?.bookingRequestStatus,
    booking?.sessionStatus,
    booking?.status,
    booking?.paymentStatusCanonical,
    booking?.paymentStatus
  ];
  return values.some((value) => {
    const status = normalizeStatus(value);
    return CANCELLED_STATES.has(status) || status === "void";
  });
}
__name(isCancelled, "isCancelled");
function isScheduleBlockingBooking(booking) {
  if (!booking || isCancelled(booking)) return false;
  return !NON_BLOCKING_REQUEST_STATES.has(requestStatus(booking));
}
__name(isScheduleBlockingBooking, "isScheduleBlockingBooking");
function isValidStartHour(value) {
  if (typeof value !== "number" && typeof value !== "string" || typeof value === "string" && !/^\d+$/.test(value.trim())) return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number < 24;
}
__name(isValidStartHour, "isValidStartHour");
function isNoDurationPackage(booking) {
  const hasPackage = Boolean(booking?.packageId && booking.packageId !== "none") || booking?.pricingMode === "package";
  return hasPackage && Number(booking?.durationHours ?? booking?.duration ?? 0) <= 0;
}
__name(isNoDurationPackage, "isNoDurationPackage");
function scheduleWindow(booking) {
  if (isNoDurationPackage(booking)) return null;
  const start = Number(booking?.startHour);
  const duration = Number(booking?.durationHours ?? booking?.duration);
  if (!isValidStartHour(booking?.startHour) || !Number.isFinite(duration) || duration <= 0 || duration > 24 || start + duration > 24) return null;
  return { end: start + duration, start };
}
__name(scheduleWindow, "scheduleWindow");
async function assertSlotAvailable(firestore, booking, ignoreBookingId = "") {
  if (booking.durationHours === 0) return;
  const rows = await firestore.runQuery({
    from: [{ collectionId: "bookings" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "date" },
        op: "EQUAL",
        value: { stringValue: booking.date }
      }
    }
  });
  const start = booking.startHour;
  const end = start + booking.durationHours;
  const conflict = rows.find((row) => {
    if (row.id === ignoreBookingId || !isScheduleBlockingBooking(row.data)) return false;
    const window = scheduleWindow(row.data);
    if (!window) return false;
    return start < window.end && end > window.start;
  });
  if (conflict) {
    throw new HttpError(409, "booking_conflict", "Slot bertabrakan dengan booking lain.", {
      bookingId: conflict.id
    });
  }
}
__name(assertSlotAvailable, "assertSlotAvailable");
function buildBooking(body, actor, key) {
  const id = cleanText(body.id, 160);
  if (!id) throw new HttpError(400, "booking_id_required", "Booking ID wajib tersedia.");
  const customer = cleanText(body.customer, 120);
  if (!customer) throw new HttpError(400, "customer_required", "Nama customer wajib diisi.");
  const date = cleanDate(body.date);
  if (!isValidStartHour(body.startHour)) {
    throw new HttpError(400, "invalid_start_hour", "Jam mulai booking harus berupa jam bulat antara 00 dan 23.");
  }
  const startHour = Number(body.startHour);
  const durationHours = cleanNumber(body.durationHours, 0, 24, "invalid_duration", "Durasi booking tidak valid.");
  const pricingMode = cleanText(body.pricingMode || "session", 40);
  if (durationHours === 0 && pricingMode !== "package") {
    throw new HttpError(400, "duration_required", "Durasi booking harus lebih dari 0 jam.");
  }
  if (startHour + durationHours > 24) {
    throw new HttpError(400, "booking_outside_day", "Waktu selesai booking melewati batas hari.");
  }
  const total = cleanMoney(body.total);
  const requestedPayment = Array.isArray(body.paymentHistory) ? body.paymentHistory[0] : null;
  const initialAmount = cleanMoney(requestedPayment?.amount ?? body.paidAmount ?? body.dpAmount);
  if (initialAmount > total) {
    throw new HttpError(400, "amount_exceeds_total", "Pembayaran awal melebihi total booking.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const method = initialAmount > 0 ? paymentMethod(requestedPayment?.method || body.paymentMethod || body.lastPaymentMethod) : "";
  const payment = initialAmount > 0 ? {
    actorName: actor.displayName,
    actorUid: actor.uid,
    amount: initialAmount,
    createdAt: now,
    date: now.slice(0, 10),
    id: `payment_${key.slice(0, 80)}`,
    idempotencyKey: key,
    method,
    note: cleanText(requestedPayment?.note || "Pembayaran awal booking", 600),
    source: "manual-booking-create"
  } : null;
  const paymentStatus = total > 0 && initialAmount >= total ? "lunas" : initialAmount > 0 ? "dp" : "pending";
  const canonicalStatus = paymentStatus === "lunas" ? "paid" : paymentStatus === "dp" ? "partial" : "unpaid";
  const bookingCode = cleanText(body.bookingCode || body.bookingId, 120) || `BKG-${id}`;
  const invoiceNumber = cleanText(body.invoiceNumber, 120) || `INV-${bookingCode.replace(/^BKG-/, "")}`;
  return {
    appliedDiscounts: Array.isArray(body.appliedDiscounts) ? body.appliedDiscounts.slice(0, 50) : [],
    bandName: cleanText(body.bandName, 120),
    bookingCode,
    bookingId: bookingCode,
    bookingRequestStatus: "confirmed",
    clientUid: cleanText(body.clientUid, 128),
    createdAt: now,
    customer,
    customerId: cleanText(body.customerId, 160),
    customerIdentityMode: cleanText(body.customerIdentityMode, 60),
    customerPhoneKey: cleanText(body.customerPhoneKey, 32),
    date,
    discountAmount: cleanMoney(body.discountAmount),
    dpAmount: paymentStatus === "dp" ? initialAmount : 0,
    durationHours,
    email: cleanText(body.email, 254),
    id,
    invoiceAmount: Math.max(0, total - initialAmount),
    invoiceNumber,
    lastPaymentAt: payment?.createdAt || "",
    lastPaymentMethod: method,
    packageId: cleanText(body.packageId, 80),
    packageLabel: cleanText(body.packageLabel, 160),
    paidAmount: initialAmount,
    paymentHistory: payment ? [payment] : [],
    paymentMethod: method,
    paymentStatus,
    paymentStatusCanonical: canonicalStatus,
    pricingMode,
    recordingTypeId: cleanText(body.recordingTypeId, 80),
    recordingTypeLabel: cleanText(body.recordingTypeLabel, 160),
    refundHistory: [],
    refundedAmount: 0,
    sessionLabel: cleanText(body.sessionLabel || "Sesi Studio", 160),
    sessionStatus: "scheduled",
    sessionType: cleanText(body.sessionType || "session", 80),
    source: "admin",
    startHour,
    startTimeLabel: cleanText(body.startTimeLabel, 40),
    status: paymentStatus,
    subtotal: cleanMoney(body.subtotal ?? total),
    title: cleanText(body.title || body.bandName || body.sessionLabel || "Sesi Studio", 160),
    total,
    updatedAt: now
  };
}
__name(buildBooking, "buildBooking");
async function initialLedgerWrite({ actor, booking, firestore, payment }) {
  if (!payment) return null;
  const id = await stableDocumentId("ledger", `booking-payment:${booking.id}:${payment.idempotencyKey}`);
  return firestore.setWrite("bookkeepingEntries", id, {
    actorName: actor.displayName,
    actorUid: actor.uid,
    amount: payment.amount,
    category: "booking",
    createdAt: payment.createdAt,
    date: payment.date,
    id,
    idempotencyKey: payment.idempotencyKey,
    immutable: true,
    note: payment.note,
    paymentMethod: payment.method,
    reversalOf: "",
    source: "booking-payment",
    sourceAction: "payment",
    sourceBookingId: booking.id,
    sourceEventId: payment.id,
    title: `Pembayaran ${booking.invoiceNumber}`,
    type: "income",
    updatedAt: payment.createdAt
  }, { exists: false });
}
__name(initialLedgerWrite, "initialLedgerWrite");
async function createManualBooking({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "manual-booking-create", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const booking = buildBooking(body, actor, key);
  const scheduleDay = await firestore.getDocument("bookingScheduleDays", booking.date);
  await assertSlotAvailable(firestore, booking);
  const writes = [
    firestore.setWrite("bookings", booking.id, booking, { exists: false }),
    firestore.setWrite("bookingScheduleDays", booking.date, {
      date: booking.date,
      lastBookingId: booking.id,
      revision: Number(scheduleDay?.data?.revision || 0) + 1,
      updatedAt: booking.updatedAt
    }, scheduleDay ? { updateTime: scheduleDay.updateTime } : { exists: false })
  ];
  if (booking.durationHours > 0) {
    writes.push(firestore.setWrite("clientCalendarSlots", booking.id, {
      bookingId: booking.id,
      date: booking.date,
      durationHours: booking.durationHours,
      sessionLabel: "Sesi Studio",
      startHour: booking.startHour,
      status: booking.paymentStatus,
      title: "Terisi",
      updatedAt: booking.updatedAt
    }, { exists: false }));
  }
  const ledger = await initialLedgerWrite({ actor, booking, firestore, payment: booking.paymentHistory[0] });
  if (ledger) writes.push(ledger);
  const result = { booking };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { booking: { collectionId: "bookings", documentId: booking.id } },
    firestore,
    key,
    result,
    receipt: {},
    targetId: booking.id,
    type: "manual-booking-create",
    writes
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(createManualBooking, "createManualBooking");
var EDITABLE_BOOKING_FIELDS = /* @__PURE__ */ new Set([
  "bandName",
  "clientUid",
  "customer",
  "customerId",
  "customerIdentityMode",
  "customerPhoneKey",
  "date",
  "duration",
  "durationHours",
  "email",
  "internalNotes",
  "notes",
  "packageId",
  "packageLabel",
  "pricingMode",
  "recordingTypeId",
  "recordingTypeLabel",
  "sessionLabel",
  "sessionType",
  "startHour",
  "startTimeLabel",
  "title"
]);
function cleanBookingUpdatePatch(body, currentBooking) {
  const supplied = body.patch && typeof body.patch === "object" ? body.patch : body.booking && typeof body.booking === "object" ? body.booking : body;
  for (const field of ["sessionStatus", "checkedInAt", "actualStartAt", "actualEndAt", "actualDurationMinutes"]) {
    if (supplied[field] !== void 0 && supplied[field] !== currentBooking[field]) {
      throw new HttpError(400, "session_action_required", "Status dan waktu aktual sesi harus diubah melalui operasi Session Operations.");
    }
  }
  const patch = Object.fromEntries(
    Object.entries(supplied).filter(([field]) => EDITABLE_BOOKING_FIELDS.has(field))
  );
  for (const field of ["requestStatus", "bookingRequestStatus"]) {
    if (supplied[field] !== void 0 && normalizeStatus(supplied[field]) !== requestStatus(currentBooking)) {
      throw new HttpError(400, "booking_status_requires_decision", "Perubahan status request harus melalui alur keputusan booking.");
    }
  }
  if (patch.date !== void 0) patch.date = cleanDate(patch.date);
  if (patch.startHour !== void 0) {
    if (!isValidStartHour(patch.startHour)) {
      throw new HttpError(400, "invalid_start_hour", "Jam mulai booking harus berupa jam bulat antara 00 dan 23.");
    }
    patch.startHour = Number(patch.startHour);
  }
  if (patch.durationHours !== void 0 || patch.duration !== void 0) {
    const duration = Number(patch.durationHours ?? patch.duration);
    if (!Number.isFinite(duration) || duration < 0 || duration > 24) {
      throw new HttpError(400, "invalid_duration", "Durasi booking tidak valid.");
    }
    patch.durationHours = duration;
    delete patch.duration;
  }
  const candidate = { ...currentBooking, ...patch };
  candidate.date = patch.date ?? currentBooking.date;
  candidate.startHour = patch.startHour ?? currentBooking.startHour;
  candidate.durationHours = patch.durationHours ?? patch.duration ?? currentBooking.durationHours ?? currentBooking.duration;
  if (!cleanText(candidate.customer, 120)) {
    throw new HttpError(400, "customer_required", "Nama customer wajib diisi.");
  }
  if (candidate.date) candidate.date = cleanDate(candidate.date);
  if (!isNoDurationPackage(candidate) && !scheduleWindow(candidate)) {
    throw new HttpError(400, "invalid_booking_window", "Tanggal, jam mulai, atau durasi booking tidak valid.");
  }
  if (scheduleWindow(candidate) && scheduleWindow(candidate).end > 24) {
    throw new HttpError(400, "booking_outside_day", "Waktu selesai booking melewati batas hari.");
  }
  return { candidate, patch };
}
__name(cleanBookingUpdatePatch, "cleanBookingUpdatePatch");
async function updateManualBooking({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "manual-booking-update", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const bookingId = cleanText(body.id || body.bookingId, 160);
  if (!bookingId) throw new HttpError(400, "booking_id_required", "Booking ID wajib tersedia.");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await firestore.getDocument("bookings", bookingId);
    if (!current) throw new HttpError(404, "booking_not_found", "Booking tidak ditemukan.");
    const currentBooking = { id: current.id, ...current.data };
    if (body.expectedUpdatedAt && body.expectedUpdatedAt !== currentBooking.updatedAt) {
      throw new HttpError(409, "booking_changed", "Booking berubah sejak terakhir dibuka. Muat ulang data sebelum menyimpan perubahan jadwal.");
    }
    const { candidate, patch } = cleanBookingUpdatePatch(body, currentBooking);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    candidate.updatedAt = now;
    const dates = [...new Set([currentBooking.date, candidate.date].map((value) => cleanText(value, 10)).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))].sort();
    const scheduleDays = /* @__PURE__ */ new Map();
    for (const date of dates) {
      scheduleDays.set(date, await firestore.getDocument("bookingScheduleDays", date));
    }
    if (isScheduleBlockingBooking(candidate) && scheduleWindow(candidate)) {
      await assertSlotAvailable(firestore, candidate, bookingId);
    }
    const updatedBooking = { ...currentBooking, ...patch, id: bookingId, updatedAt: now };
    const writes = [
      firestore.setWrite("bookings", bookingId, updatedBooking, { updateTime: current.updateTime })
    ];
    for (const date of dates) {
      const scheduleDay = scheduleDays.get(date);
      writes.push(firestore.setWrite("bookingScheduleDays", date, {
        date,
        lastBookingId: bookingId,
        revision: Number(scheduleDay?.data?.revision || 0) + 1,
        updatedAt: now
      }, scheduleDay ? { updateTime: scheduleDay.updateTime } : { exists: false }));
    }
    const publicSlot = clientCalendarSlot(updatedBooking, now);
    const oldSlot = await firestore.getDocument("clientCalendarSlots", bookingId);
    if (publicSlot) {
      writes.push(firestore.setWrite(
        "clientCalendarSlots",
        bookingId,
        publicSlot,
        oldSlot ? { updateTime: oldSlot.updateTime } : { exists: false }
      ));
    } else if (oldSlot) {
      writes.push(firestore.deleteWrite("clientCalendarSlots", bookingId, { updateTime: oldSlot.updateTime }));
    }
    try {
      const committed = await commitIdempotentOperation({
        actor,
        documentRefs: { booking: { collectionId: "bookings", documentId: bookingId } },
        firestore,
        key,
        receipt: {},
        result: { booking: updatedBooking },
        targetId: bookingId,
        type: "manual-booking-update",
        writes
      });
      return { ...committed.result, duplicate: committed.duplicate };
    } catch (error) {
      if (error?.status === 409 && error?.code === "operation_conflict" && attempt < 3) continue;
      throw error;
    }
  }
  throw new HttpError(409, "booking_conflict", "Jadwal berubah saat penyimpanan. Muat ulang data dan coba kembali.");
}
__name(updateManualBooking, "updateManualBooking");
function currentBookingSessionStatus(booking) {
  const explicitValue = normalizeStatus(booking?.sessionStatus || booking?.sessionState);
  const legacyValue = normalizeStatus(booking?.status);
  const value = ["upcoming", "scheduled", "in_progress", "active", "completed", "no_show", "cancelled", "canceled"].includes(explicitValue) ? explicitValue : legacyValue;
  if (["upcoming", "scheduled", "in_progress", "active", "completed", "no_show", "cancelled", "canceled"].includes(value)) {
    return value === "scheduled" ? "upcoming" : value;
  }
  return requestStatus(booking) === "cancelled" || requestStatus(booking) === "rejected" ? "cancelled" : "upcoming";
}
__name(currentBookingSessionStatus, "currentBookingSessionStatus");
function requestDecisionIssue(booking, status, reason) {
  if (!booking?.id) {
    throw new HttpError(400, "invalid_booking", "Data booking belum lengkap.");
  }
  const currentStatus = requestStatus(booking);
  if (!BOOKING_DECISION_TRANSITIONS[currentStatus]?.has(status)) {
    throw new HttpError(409, "invalid_booking_transition", "Request ini sudah berubah dan tidak dapat diproses dengan aksi tersebut.");
  }
  if (["rejected", "cancelled"].includes(status) && cleanText(reason, 600).length < 4) {
    throw new HttpError(400, "booking_reason_required", "Masukkan alasan minimal 4 karakter.");
  }
  if (status === "confirmed") {
    if (!cleanText(booking.customer, 120)) {
      throw new HttpError(400, "incomplete_booking", "Customer wajib tersedia sebelum booking dikonfirmasi.");
    }
    try {
      cleanDate(booking.date);
    } catch {
      throw new HttpError(400, "invalid_date", "Tanggal booking belum valid.");
    }
    if (!isValidStartHour(booking.startHour)) {
      throw new HttpError(400, "invalid_start_hour", "Jam mulai booking belum valid.");
    }
    const service = cleanText(
      booking.sessionLabel || booking.packageLabel || booking.recordingTypeLabel || booking.title || booking.serviceId || booking.packageId || booking.recordingTypeId,
      160
    );
    if (!service) {
      throw new HttpError(400, "incomplete_booking", "Layanan booking wajib dipilih sebelum dikonfirmasi.");
    }
    const window = scheduleWindow(booking);
    if (!window && !isNoDurationPackage(booking)) {
      throw new HttpError(400, "invalid_duration", "Durasi booking belum valid.");
    }
  }
}
__name(requestDecisionIssue, "requestDecisionIssue");
async function listBookingsForDate(firestore, date) {
  return firestore.runQuery({
    from: [{ collectionId: "bookings" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "date" },
        op: "EQUAL",
        value: { stringValue: date }
      }
    }
  });
}
__name(listBookingsForDate, "listBookingsForDate");
async function assertDecisionSlotAvailable(firestore, booking) {
  if (isNoDurationPackage(booking)) return;
  const window = scheduleWindow(booking);
  if (!window) {
    throw new HttpError(400, "invalid_booking_window", "Rentang waktu booking belum valid.");
  }
  const rows = await listBookingsForDate(firestore, booking.date);
  const conflict = rows.find((row) => {
    if (row.id === booking.id || !isScheduleBlockingBooking(row.data)) return false;
    const other = scheduleWindow(row.data);
    if (!other) return false;
    return window.start < other.end && window.end > other.start;
  });
  if (conflict) {
    throw new HttpError(409, "booking_conflict", "Jadwal bentrok dengan booking lain pada rentang waktu yang sama.", {
      bookingId: conflict.id
    });
  }
}
__name(assertDecisionSlotAvailable, "assertDecisionSlotAvailable");
function decisionMessage({ actor, booking, decisionKey, note, timestamp }) {
  return {
    id: `request-${decisionKey}`,
    bookingId: booking.id,
    clientUid: cleanText(booking.clientUid, 128),
    senderUid: cleanText(actor.uid, 128),
    senderRole: "admin",
    senderName: cleanText(actor.displayName || "Admin Studio", 120),
    text: cleanText(note, 600),
    type: "status",
    createdAt: timestamp,
    readByAdmin: true,
    readByClient: false
  };
}
__name(decisionMessage, "decisionMessage");
function decisionBookingPatch({ actor, decisionKey, message, note, status, timestamp }) {
  const patch = {
    adminResponseAt: timestamp,
    adminResponseBy: cleanText(actor.uid, 128),
    adminResponseNote: cleanText(note, 600),
    bookingRequestStatus: status,
    requestStatus: status,
    lastRequestDecisionKey: decisionKey,
    lastMessageId: message.id,
    lastMessageAt: message.createdAt,
    lastMessagePreview: message.text.slice(0, 180),
    lastMessageSenderRole: message.senderRole,
    lastMessageReadByAdmin: message.readByAdmin,
    lastMessageReadByClient: message.readByClient,
    updatedAt: timestamp
  };
  if (status === "cancelled") patch.sessionStatus = "cancelled";
  return patch;
}
__name(decisionBookingPatch, "decisionBookingPatch");
function clientCalendarSlot(booking, timestamp) {
  const window = scheduleWindow(booking);
  if (!window || !isScheduleBlockingBooking(booking)) return null;
  return {
    bookingId: booking.id,
    date: booking.date,
    durationHours: Number(booking.durationHours ?? booking.duration),
    sessionLabel: cleanText(booking.sessionLabel || "Sesi Studio", 160),
    startHour: Number(booking.startHour),
    status: cleanText(booking.paymentStatus || booking.status || "pending", 40),
    title: cleanText(booking.sessionLabel || "Terisi", 160),
    updatedAt: timestamp
  };
}
__name(clientCalendarSlot, "clientCalendarSlot");
async function decideBookingRequest({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "booking-request-decision", key);
  if (existing.result) return { ...existing.result, duplicate: true, alreadyApplied: true };
  const bookingId = cleanText(body.bookingId || body.id, 160);
  const status = cleanText(body.status, 40).toLowerCase();
  const note = cleanText(body.note, 600);
  const decisionKey = cleanText(body.decisionKey || key, 180);
  if (!bookingId) throw new HttpError(400, "booking_id_required", "Booking ID wajib tersedia.");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await firestore.getDocument("bookings", bookingId);
    if (!current) throw new HttpError(404, "booking_not_found", "Booking sudah tidak tersedia.");
    const booking = { id: current.id, ...current.data };
    requestDecisionIssue(booking, status, note);
    if (status === "cancelled" && currentBookingSessionStatus(booking) !== "upcoming") {
      throw new HttpError(409, "session_not_cancellable", "Booking tidak dapat dibatalkan setelah sesi dimulai atau mencapai status akhir.");
    }
    const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(cleanText(booking.date, 10)) && !Number.isNaN((/* @__PURE__ */ new Date(`${cleanText(booking.date, 10)}T00:00:00.000Z`)).getTime()) && (/* @__PURE__ */ new Date(`${cleanText(booking.date, 10)}T00:00:00.000Z`)).toISOString().slice(0, 10) === cleanText(booking.date, 10);
    const date = dateIsValid ? cleanText(booking.date, 10) : "";
    const scheduleDay = date ? await firestore.getDocument("bookingScheduleDays", date) : null;
    if (status === "confirmed") await assertDecisionSlotAvailable(firestore, booking);
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const message = decisionMessage({ actor, booking, decisionKey, note, timestamp });
    const updatedBooking = {
      ...booking,
      ...decisionBookingPatch({ actor, decisionKey, message, note, status, timestamp })
    };
    const publicSlot = status === "confirmed" ? clientCalendarSlot(updatedBooking, timestamp) : null;
    const writes = [
      firestore.setWrite("bookings", bookingId, updatedBooking, { updateTime: current.updateTime }),
      firestore.setWrite("bookingMessages", message.id, message, { exists: false })
    ];
    let sessionEvent = null;
    if (status === "cancelled") {
      const sessionEventId = await stableDocumentId("booking-session-event", bookingId + ":cancel:" + decisionKey);
      sessionEvent = {
        action: "cancelled",
        actorName: cleanText(actor.displayName || "Admin Studio", 120),
        actorUid: cleanText(actor.uid, 128),
        bookingId,
        createdAt: timestamp,
        fromStatus: currentBookingSessionStatus(booking),
        id: sessionEventId,
        reason: note,
        toStatus: "cancelled",
        type: "booking-session-event"
      };
      updatedBooking.lastSessionEventAt = timestamp;
      updatedBooking.lastSessionEventType = "cancelled";
      updatedBooking.lastSessionEventId = sessionEventId;
      writes[0] = firestore.setWrite("bookings", bookingId, updatedBooking, { updateTime: current.updateTime });
      writes.push(firestore.setWrite("bookingSessionEvents", sessionEventId, sessionEvent, { exists: false }));
    }
    if (date) {
      writes.push(firestore.setWrite("bookingScheduleDays", date, {
        date,
        lastBookingId: bookingId,
        revision: Number(scheduleDay?.data?.revision || 0) + 1,
        updatedAt: timestamp
      }, scheduleDay ? { updateTime: scheduleDay.updateTime } : { exists: false }));
    }
    if (publicSlot) {
      const oldSlot = await firestore.getDocument("clientCalendarSlots", bookingId);
      writes.push(firestore.setWrite(
        "clientCalendarSlots",
        bookingId,
        publicSlot,
        oldSlot ? { updateTime: oldSlot.updateTime } : { exists: false }
      ));
    } else {
      const oldSlot = await firestore.getDocument("clientCalendarSlots", bookingId);
      if (oldSlot) writes.push(firestore.deleteWrite("clientCalendarSlots", bookingId, { updateTime: oldSlot.updateTime }));
    }
    try {
      const committed = await commitIdempotentOperation({
        actor,
        documentRefs: {
          booking: { collectionId: "bookings", documentId: bookingId },
          message: { collectionId: "bookingMessages", documentId: message.id },
          ...sessionEvent ? { sessionEvent: { collectionId: "bookingSessionEvents", documentId: sessionEvent.id } } : {}
        },
        firestore,
        key,
        receipt: { decisionKey, status },
        result: { booking: updatedBooking, decisionKey, message, status },
        targetId: bookingId,
        type: "booking-request-decision",
        writes
      });
      return { ...committed.result, alreadyApplied: committed.duplicate, duplicate: committed.duplicate };
    } catch (error) {
      if (error?.status === 409 && error?.code === "operation_conflict" && attempt < 3) continue;
      throw error;
    }
  }
  throw new HttpError(409, "booking_conflict", "Jadwal berubah saat request diproses. Muat ulang data dan coba kembali.");
}
__name(decideBookingRequest, "decideBookingRequest");

// src/domain/bookingSessions.js
var BOOKING_SESSION_ACTIONS = Object.freeze({
  CHECK_IN: "check_in",
  START: "start",
  COMPLETE: "complete",
  NO_SHOW: "no_show"
});
var BOOKING_NO_SHOW_GRACE_MINUTES = 15;
function currentSessionStatus(booking) {
  const value = cleanText(booking.sessionStatus || booking.sessionState, 40).toLowerCase().replace(/[-\s]+/g, "_");
  if (["upcoming", "scheduled"].includes(value)) return "upcoming";
  if (["in_progress", "active", "ongoing"].includes(value)) return "in_progress";
  if (["completed", "complete", "finished", "done"].includes(value)) return "completed";
  if (["no_show", "noshow", "absent"].includes(value)) return "no_show";
  if (["cancelled", "canceled"].includes(value)) return "cancelled";
  const requestStatus2 = cleanText(booking.requestStatus || booking.bookingRequestStatus, 40).toLowerCase();
  return ["rejected", "cancelled", "canceled"].includes(requestStatus2) ? "cancelled" : "upcoming";
}
__name(currentSessionStatus, "currentSessionStatus");
function getScheduledStartTimestamp(booking) {
  const date = cleanText(booking.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const utcDateCheck = /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(utcDateCheck.getTime()) || utcDateCheck.toISOString().slice(0, 10) !== date) return null;
  const parsedDate = /* @__PURE__ */ new Date(`${date}T00:00:00+07:00`);
  if (Number.isNaN(parsedDate.getTime())) return null;
  let startMinute;
  const startHour = Number(booking.startHour);
  if (Number.isFinite(startHour) && Number.isInteger(startHour) && startHour >= 0 && startHour < 24) {
    startMinute = startHour * 60;
  } else {
    const match = cleanText(booking.startTimeLabel || booking.startTime, 20).match(/^(\d{1,2})[:.](\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    startMinute = hour * 60 + minute;
  }
  return parsedDate.getTime() + startMinute * 6e4;
}
__name(getScheduledStartTimestamp, "getScheduledStartTimestamp");
function validateNoShowEligibility(booking, now) {
  const scheduledStart = getScheduledStartTimestamp(booking);
  if (scheduledStart === null) {
    throw new HttpError(400, "invalid_booking_schedule", "Tanggal dan jam mulai booking harus valid sebelum no-show dicatat.");
  }
  const eligibleAt = scheduledStart + BOOKING_NO_SHOW_GRACE_MINUTES * 6e4;
  if (now.getTime() < eligibleAt) {
    throw new HttpError(409, "no_show_grace_not_elapsed", "No-show baru dapat dicatat 15 menit setelah jam mulai booking.", { eligibleAt: new Date(eligibleAt).toISOString() });
  }
}
__name(validateNoShowEligibility, "validateNoShowEligibility");
function buildSessionEvent({ actor, action, booking, eventId, fromStatus, reason, timestamp, toStatus }) {
  return {
    action,
    actorName: cleanText(actor.displayName || "Admin Studio", 120),
    actorUid: cleanText(actor.uid, 128),
    bookingId: booking.id,
    createdAt: timestamp,
    fromStatus,
    id: eventId,
    reason: cleanText(reason, 600),
    toStatus,
    type: "booking-session-event"
  };
}
__name(buildSessionEvent, "buildSessionEvent");
async function recordBookingSessionAction({ actor, body, firestore, request, now = /* @__PURE__ */ new Date() }) {
  const key = getIdempotencyKey(request, body);
  const bookingId = cleanText(body.bookingId || body.id, 160);
  const action = cleanText(body.action, 40).toLowerCase();
  const reason = cleanText(body.reason, 600);
  if (!bookingId) throw new HttpError(400, "booking_id_required", "Booking ID wajib tersedia.");
  if (!Object.values(BOOKING_SESSION_ACTIONS).includes(action)) {
    throw new HttpError(400, "invalid_session_action", "Aksi sesi tidak dikenal.");
  }
  if (action === BOOKING_SESSION_ACTIONS.NO_SHOW && reason.length < 4) {
    throw new HttpError(400, "session_reason_required", "Alasan no-show wajib diisi minimal 4 karakter.");
  }
  const type = "booking-session-action";
  const existing = await readOperationResult(firestore, type, key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const current = await firestore.getDocument("bookings", bookingId);
  if (!current) throw new HttpError(404, "booking_not_found", "Booking tidak ditemukan.");
  const booking = { id: current.id, ...current.data };
  const fromStatus = currentSessionStatus(booking);
  if (["completed", "no_show", "cancelled"].includes(fromStatus)) {
    throw new HttpError(409, "session_terminal", "Sesi sudah berada pada status akhir dan tidak menerima aksi operasional baru.");
  }
  if (action === BOOKING_SESSION_ACTIONS.CHECK_IN && booking.checkedInAt) {
    throw new HttpError(409, "already_checked_in", "Customer sudah tercatat check-in.");
  }
  if (action === BOOKING_SESSION_ACTIONS.NO_SHOW && booking.checkedInAt) {
    throw new HttpError(409, "checked_in_cannot_be_no_show", "Customer sudah check-in sehingga tidak dapat ditandai no-show.");
  }
  const timestamp = now.toISOString();
  const nextBooking = { ...booking, updatedAt: timestamp };
  let toStatus = fromStatus;
  if (action === BOOKING_SESSION_ACTIONS.CHECK_IN) {
    if (fromStatus !== "upcoming") throw new HttpError(409, "invalid_session_transition", "Check-in hanya dapat dicatat sebelum sesi dimulai.");
    nextBooking.checkedInAt = timestamp;
    nextBooking.checkedInByUid = actor.uid;
    nextBooking.checkedInByName = cleanText(actor.displayName || "Admin Studio", 120);
  } else if (action === BOOKING_SESSION_ACTIONS.START) {
    if (fromStatus !== "upcoming") throw new HttpError(409, "invalid_session_transition", "Sesi hanya dapat dimulai dari status Akan Datang.");
    nextBooking.sessionStatus = "in_progress";
    nextBooking.actualStartAt = timestamp;
    nextBooking.actualStartByUid = actor.uid;
    nextBooking.actualStartByName = cleanText(actor.displayName || "Admin Studio", 120);
    toStatus = "in_progress";
  } else if (action === BOOKING_SESSION_ACTIONS.COMPLETE) {
    if (fromStatus !== "in_progress") throw new HttpError(409, "invalid_session_transition", "Selesaikan sesi hanya dapat dilakukan setelah sesi dimulai.");
    const actualStart = new Date(booking.actualStartAt || "");
    if (Number.isNaN(actualStart.getTime())) throw new HttpError(409, "session_start_missing", "Waktu mulai aktual tidak tersedia.");
    const actualDurationMinutes = Math.max(1, Math.round((now.getTime() - actualStart.getTime()) / 6e4));
    nextBooking.sessionStatus = "completed";
    nextBooking.actualEndAt = timestamp;
    nextBooking.actualEndByUid = actor.uid;
    nextBooking.actualEndByName = cleanText(actor.displayName || "Admin Studio", 120);
    nextBooking.actualDurationMinutes = actualDurationMinutes;
    toStatus = "completed";
  } else if (action === BOOKING_SESSION_ACTIONS.NO_SHOW) {
    if (fromStatus !== "upcoming") throw new HttpError(409, "invalid_session_transition", "No-show hanya dapat dicatat sebelum sesi dimulai.");
    validateNoShowEligibility(booking, now);
    nextBooking.sessionStatus = "no_show";
    nextBooking.noShowAt = timestamp;
    nextBooking.noShowByUid = actor.uid;
    nextBooking.noShowByName = cleanText(actor.displayName || "Admin Studio", 120);
    nextBooking.noShowReason = reason;
    toStatus = "no_show";
  }
  const eventId = await stableDocumentId("booking-session-event", bookingId + ":" + key);
  const event = buildSessionEvent({ actor, action, booking, eventId, fromStatus, reason, timestamp, toStatus });
  nextBooking.lastSessionEventAt = timestamp;
  nextBooking.lastSessionEventType = action;
  nextBooking.lastSessionEventId = eventId;
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      booking: { collectionId: "bookings", documentId: bookingId },
      event: { collectionId: "bookingSessionEvents", documentId: eventId }
    },
    firestore,
    key,
    receipt: {},
    result: { booking: nextBooking, event },
    targetId: bookingId,
    type,
    writes: [
      firestore.setWrite("bookings", bookingId, nextBooking, { updateTime: current.updateTime }),
      firestore.setWrite("bookingSessionEvents", eventId, event, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(recordBookingSessionAction, "recordBookingSessionAction");

// src/domain/dailyClosings.js
var BUSINESS_TIME_ZONE = "Asia/Jakarta";
var METHODS = Object.freeze(["cash", "transfer", "qris", "other"]);
var CASH_DENOMINATIONS = Object.freeze([1e5, 5e4, 2e4, 1e4, 5e3, 2e3, 1e3, 500, 200, 100]);
var MAX_QUERY_ROWS = 1e4;
var MAX_BOOKING_PAGES = 50;
var MAX_TRANSACTION_REFERENCES = 1e3;
function validBusinessDate(value) {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = /* @__PURE__ */ new Date(date + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
}
__name(validBusinessDate, "validBusinessDate");
function businessDateOf(value) {
  if (value === void 0 || value === null || value === "") return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return validBusinessDate(raw);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric"
  }).formatToParts(parsed);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}
__name(businessDateOf, "businessDateOf");
function normalizeRegisterId(value) {
  const registerId = cleanText(value || "main", 40).toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(registerId)) {
    throw new HttpError(400, "invalid_register", "Register ID hanya boleh berisi huruf, angka, tanda hubung, dan underscore.");
  }
  if (registerId !== "main") {
    throw new HttpError(400, "register_not_supported", "Register tambahan belum diaktifkan. MVP saat ini menggunakan register main.");
  }
  return registerId;
}
__name(normalizeRegisterId, "normalizeRegisterId");
function sessionDocumentId(businessDate2, registerId) {
  return businessDate2 + "__" + registerId;
}
__name(sessionDocumentId, "sessionDocumentId");
function optionalMoney(value, field) {
  if (value === void 0 || value === null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) {
    throw new HttpError(400, "invalid_amount", field + " harus berupa nominal non-negatif yang valid.");
  }
  return Math.round(amount);
}
__name(optionalMoney, "optionalMoney");
function requiredMoney(value, field) {
  const amount = optionalMoney(value, field);
  if (amount === null) throw new HttpError(400, "amount_required", field + " wajib diisi.");
  return amount;
}
__name(requiredMoney, "requiredMoney");
function optionalSignedMoney(value, field) {
  if (value === void 0 || value === null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || Math.abs(amount) > 1e12) {
    throw new HttpError(400, "invalid_amount", field + " harus berupa nominal bersih yang valid.");
  }
  return Math.round(amount);
}
__name(optionalSignedMoney, "optionalSignedMoney");
function requiredSignedMoney(value, field) {
  const amount = optionalSignedMoney(value, field);
  if (amount === null) throw new HttpError(400, "amount_required", field + " wajib diisi.");
  return amount;
}
__name(requiredSignedMoney, "requiredSignedMoney");
function normalizeMethod(value) {
  const method = cleanText(value, 30).toLowerCase();
  return METHODS.includes(method) ? method : "other";
}
__name(normalizeMethod, "normalizeMethod");
function emptyMethodTotals() {
  return Object.fromEntries(METHODS.map((method) => [method, { income: 0, expense: 0, net: 0 }]));
}
__name(emptyMethodTotals, "emptyMethodTotals");
function addTransaction(totals, transaction, references) {
  const method = normalizeMethod(transaction.method);
  const amount = cleanMoney(transaction.amount);
  if (!amount) return;
  const direction = transaction.type === "expense" ? "expense" : "income";
  totals[method][direction] += amount;
  totals[method].net = totals[method].income - totals[method].expense;
  references.push({
    amount,
    bookingId: cleanText(transaction.bookingId, 160),
    createdAt: cleanText(transaction.createdAt, 50),
    eventId: cleanText(transaction.eventId, 180),
    id: cleanText(transaction.id, 220),
    method,
    source: cleanText(transaction.source, 80),
    type: direction
  });
}
__name(addTransaction, "addTransaction");
function bookingTotal(booking) {
  const candidates = [booking.total, booking.subtotal, booking.invoiceAmount];
  for (const candidate of candidates) {
    if (candidate !== void 0 && candidate !== null && candidate !== "" && Number.isFinite(Number(candidate))) {
      return cleanMoney(candidate);
    }
  }
  return 0;
}
__name(bookingTotal, "bookingTotal");
function legacyPaymentRows(booking) {
  const history = Array.isArray(booking.paymentHistory) ? booking.paymentHistory : [];
  if (history.length) return history.filter((row) => cleanMoney(row?.amount) > 0);
  const status = cleanText(booking.paymentStatusCanonical || booking.paymentStatus, 40).toLowerCase();
  const amount = Math.max(
    cleanMoney(booking.paidAmount),
    cleanMoney(booking.dpAmount),
    ["paid", "lunas"].includes(status) ? bookingTotal(booking) : 0
  );
  if (!amount) return [];
  return [{
    amount,
    createdAt: booking.lastPaymentAt || booking.createdAt || booking.date || "",
    date: booking.lastPaymentAt || booking.createdAt || booking.date || "",
    id: "legacy_" + cleanText(booking.id || "booking", 120) + "_payment",
    method: booking.lastPaymentMethod || booking.paymentMethod || "other",
    source: "legacy-projection"
  }];
}
__name(legacyPaymentRows, "legacyPaymentRows");
function legacyRefundRows(booking) {
  const history = Array.isArray(booking.refundHistory) ? booking.refundHistory : [];
  if (history.length) return history.filter((row) => cleanMoney(row?.amount) > 0);
  const amount = cleanMoney(booking.refundedAmount);
  if (!amount) return [];
  const timestamp = booking.lastRefundAt || booking.refundCompletedAt || booking.updatedAt || booking.createdAt || booking.date || "";
  return [{
    amount,
    createdAt: timestamp,
    date: timestamp,
    id: "legacy_" + cleanText(booking.id || "booking", 120) + "_refund",
    method: booking.lastRefundMethod || "other",
    source: "legacy-refund-projection"
  }];
}
__name(legacyRefundRows, "legacyRefundRows");
async function loadLedgerEntries(firestore, businessDate2) {
  const results = [];
  let offset = 0;
  while (offset < MAX_QUERY_ROWS) {
    const page = await firestore.runQuery({
      from: [{ collectionId: "bookkeepingEntries" }],
      limit: 500,
      offset,
      where: {
        fieldFilter: {
          field: { fieldPath: "date" },
          op: "EQUAL",
          value: { stringValue: businessDate2 }
        }
      }
    });
    results.push(...page);
    if (page.length < 500) return results;
    offset += page.length;
  }
  throw new HttpError(413, "closing_volume_too_large", "Volume ledger tanggal ini melampaui batas aman closing. Hubungi Owner untuk pemeriksaan.");
}
__name(loadLedgerEntries, "loadLedgerEntries");
async function loadBookings(firestore) {
  const documents = [];
  let pageToken = "";
  let pageCount = 0;
  do {
    const page = await firestore.listDocuments("bookings", { pageSize: 500, pageToken });
    documents.push(...page.documents);
    pageToken = page.nextPageToken;
    pageCount += 1;
    if (pageCount >= MAX_BOOKING_PAGES && pageToken) {
      throw new HttpError(413, "closing_booking_scan_too_large", "Jumlah booking terlalu besar untuk dipindai dalam satu closing.");
    }
  } while (pageToken);
  return documents;
}
__name(loadBookings, "loadBookings");
function canonicalEventKey(bookingId, eventId) {
  return bookingId && eventId ? bookingId + ":" + eventId : "";
}
__name(canonicalEventKey, "canonicalEventKey");
async function collectBusinessTransactions({ businessDate: businessDate2, firestore, registerId }) {
  const entries = await loadLedgerEntries(firestore, businessDate2);
  const bookings = await loadBookings(firestore);
  const totals = emptyMethodTotals();
  const references = [];
  const canonicalEvents = /* @__PURE__ */ new Set();
  entries.forEach((document) => {
    const row = document.data || {};
    if (normalizeRegisterId(row.registerId || "main") !== registerId) return;
    if (!["income", "expense"].includes(row.type)) return;
    const source = cleanText(row.source || "manual", 80);
    const bookingId = cleanText(row.sourceBookingId, 160);
    const eventId = cleanText(row.sourceEventId, 180);
    const eventKey = canonicalEventKey(bookingId, eventId);
    if (eventKey) canonicalEvents.add(eventKey);
    addTransaction(totals, {
      amount: row.amount,
      bookingId,
      createdAt: row.createdAt || row.updatedAt,
      eventId,
      id: document.id || row.id,
      method: row.paymentMethod,
      source,
      type: row.type
    }, references);
  });
  bookings.forEach((document) => {
    const booking = { id: document.id, ...document.data || {} };
    const bookingId = cleanText(booking.id, 160);
    if (!bookingId) return;
    legacyPaymentRows(booking).forEach((payment, index) => {
      if (businessDateOf(payment.date || payment.createdAt || payment.timestamp) !== businessDate2) return;
      const eventId = cleanText(payment.id, 180) || "legacy_payment_" + index;
      if (canonicalEvents.has(canonicalEventKey(bookingId, eventId))) return;
      addTransaction(totals, {
        amount: payment.amount,
        bookingId,
        createdAt: payment.createdAt || payment.date,
        eventId,
        id: "legacy-payment:" + bookingId + ":" + eventId,
        method: payment.method || payment.paymentMethod || booking.lastPaymentMethod || booking.paymentMethod,
        source: "legacy-booking-payment",
        type: "income"
      }, references);
    });
    legacyRefundRows(booking).forEach((refund, index) => {
      if (businessDateOf(refund.date || refund.createdAt || refund.timestamp) !== businessDate2) return;
      const eventId = cleanText(refund.id, 180) || "legacy_refund_" + index;
      if (canonicalEvents.has(canonicalEventKey(bookingId, eventId))) return;
      addTransaction(totals, {
        amount: refund.amount,
        bookingId,
        createdAt: refund.createdAt || refund.date,
        eventId,
        id: "legacy-refund:" + bookingId + ":" + eventId,
        method: refund.method || refund.paymentMethod || booking.lastRefundMethod || "other",
        source: "legacy-booking-refund",
        type: "expense"
      }, references);
    });
  });
  references.sort((first, second) => first.id.localeCompare(second.id));
  if (references.length > MAX_TRANSACTION_REFERENCES) {
    throw new HttpError(413, "closing_reference_limit", "Jumlah transaksi melebihi kapasitas snapshot closing.");
  }
  const fingerprintInput = JSON.stringify(references);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprintInput));
  const sourceFingerprint = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const sourceWatermark = references.map((reference) => reference.createdAt).filter(Boolean).sort().at(-1) || "";
  return { references, sourceFingerprint, sourceWatermark, totals };
}
__name(collectBusinessTransactions, "collectBusinessTransactions");
function normalizeCounts(body, required = false) {
  const digitalSource = body.digitalCounts && typeof body.digitalCounts === "object" ? body.digitalCounts : {};
  const denominationSource = body.cashDenominations && typeof body.cashDenominations === "object" ? body.cashDenominations : null;
  if (required && !denominationSource) {
    throw new HttpError(400, "cash_denominations_required", "Rincian pecahan uang fisik wajib diisi untuk menyimpan closing.");
  }
  const cashDenominations = {};
  let countedCashFromDenominations = 0;
  CASH_DENOMINATIONS.forEach((denomination) => {
    const rawCount = denominationSource?.[String(denomination)] ?? 0;
    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 0 || count > 1e5) {
      throw new HttpError(400, "invalid_cash_denomination", "Jumlah lembar atau keping uang tidak valid.");
    }
    cashDenominations[String(denomination)] = count;
    countedCashFromDenominations += denomination * count;
  });
  const openingCash = required ? requiredMoney(body.openingCash, "Opening cash") : optionalMoney(body.openingCash, "Opening cash");
  const suppliedCountedCash = optionalMoney(body.countedCash, "Cash fisik terhitung");
  if (denominationSource && suppliedCountedCash !== null && suppliedCountedCash !== countedCashFromDenominations) {
    throw new HttpError(400, "cash_count_mismatch", "Total kas harus sama dengan penjumlahan rincian pecahan uang.");
  }
  const countedCash = denominationSource ? countedCashFromDenominations : suppliedCountedCash;
  if (required && countedCash === null) {
    throw new HttpError(400, "amount_required", "Cash fisik terhitung wajib diisi.");
  }
  const digitalCounts = {};
  METHODS.filter((method) => method !== "cash").forEach((method) => {
    digitalCounts[method] = required ? requiredSignedMoney(digitalSource[method], "Net " + method.toUpperCase()) : optionalSignedMoney(digitalSource[method], "Net " + method.toUpperCase());
  });
  return { cashDenominations, countedCash, digitalCounts, openingCash };
}
__name(normalizeCounts, "normalizeCounts");
function calculateReconciliation(totals, counts) {
  const expectedCash = counts.openingCash === null ? null : counts.openingCash + totals.cash.net;
  const cashVariance = counts.countedCash === null || expectedCash === null ? null : counts.countedCash - expectedCash;
  const digital = {};
  METHODS.filter((method) => method !== "cash").forEach((method) => {
    const counted = counts.digitalCounts[method];
    const expected = totals[method].net;
    digital[method] = {
      counted,
      expected,
      variance: counted === null ? null : counted - expected
    };
  });
  const variances = [cashVariance, ...Object.values(digital).map((row) => row.variance)];
  return {
    cashVariance,
    digital,
    expectedCash,
    hasVariance: variances.some((value) => value !== null && value !== 0)
  };
}
__name(calculateReconciliation, "calculateReconciliation");
function varianceReason(body, reconciliation) {
  const reason = cleanText(body.varianceReason || body.reason, 600);
  if (reconciliation.hasVariance && reason.length < 4) {
    throw new HttpError(400, "variance_reason_required", "Alasan selisih wajib diisi minimal 4 karakter.");
  }
  return reason;
}
__name(varianceReason, "varianceReason");
function summarizeLatePostings(snapshot, currentReferences) {
  const previous = new Set((Array.isArray(snapshot?.transactionReferences) ? snapshot.transactionReferences : []).map((row) => row.id));
  return currentReferences.filter((row) => !previous.has(row.id));
}
__name(summarizeLatePostings, "summarizeLatePostings");
async function loadClosingEvents(firestore, sessionId) {
  const rows = await firestore.runQuery({
    from: [{ collectionId: "cashClosingEvents" }],
    limit: 100,
    where: {
      fieldFilter: {
        field: { fieldPath: "closingId" },
        op: "EQUAL",
        value: { stringValue: sessionId }
      }
    }
  });
  return rows.map((row) => {
    const data = row.data || {};
    return {
      action: data.action || "",
      actorName: data.actorName || "",
      actorUid: data.actorUid || "",
      createdAt: data.createdAt || "",
      id: row.id,
      reason: data.reason || "",
      revision: data.revision || 0,
      snapshot: data.snapshot ? {
        cutoffAt: data.snapshot.cutoffAt || "",
        reviewNote: data.snapshot.reviewNote || "",
        sourceFingerprint: data.snapshot.sourceFingerprint || "",
        transactionCount: data.snapshot.transactionCount || 0
      } : null,
      sourceFingerprint: data.sourceFingerprint || "",
      summary: data.summary || null
    };
  }).sort((first, second) => String(second.createdAt || "").localeCompare(String(first.createdAt || "")));
}
__name(loadClosingEvents, "loadClosingEvents");
function buildPreviewResult({ actor, businessDate: businessDate2, collected, counts, events, existing, registerId }) {
  const isClosed = existing?.status === "closed";
  const snapshotCounts = isClosed ? {
    openingCash: existing.openingCash,
    cashDenominations: existing.cashDenominations || {},
    countedCash: existing.countedCash,
    digitalCounts: existing.digitalCounts || {}
  } : counts;
  const snapshotTotals = isClosed ? existing.totalsByMethod : collected.totals;
  const reconciliation = calculateReconciliation(snapshotTotals, snapshotCounts);
  const latePostingExceptions = existing?.cutoffAt ? summarizeLatePostings(existing, collected.references) : [];
  return {
    businessDate: businessDate2,
    canReopen: actor.role === "owner",
    counts: snapshotCounts,
    cutoffAt: existing?.cutoffAt || "",
    digitalReconciliation: reconciliation.digital,
    expectedCash: isClosed ? existing.expectedCash : reconciliation.expectedCash,
    events: events || [],
    existingSession: existing ? { ...existing } : null,
    isClosed,
    latePostingExceptions,
    latePostingCount: latePostingExceptions.length,
    reconciliation: isClosed ? {
      ...reconciliation,
      cashVariance: existing.cashVariance,
      digital: existing.digitalReconciliation || reconciliation.digital,
      expectedCash: existing.expectedCash,
      hasVariance: Number(existing.cashVariance || 0) !== 0 || Object.values(existing.digitalReconciliation || {}).some((row) => Number(row.variance || 0) !== 0)
    } : reconciliation,
    registerId,
    sourceFingerprint: isClosed ? existing.sourceFingerprint : collected.sourceFingerprint,
    sourceWatermark: isClosed ? existing.sourceWatermark : collected.sourceWatermark,
    status: existing?.status || "not_opened",
    totalsByMethod: snapshotTotals,
    transactionCount: isClosed ? existing.transactionCount : collected.references.length,
    transactionReferences: isClosed ? existing.transactionReferences || [] : collected.references
  };
}
__name(buildPreviewResult, "buildPreviewResult");
async function previewDailyClosing({ actor, body, firestore, now = /* @__PURE__ */ new Date() }) {
  const businessDate2 = validBusinessDate(body.businessDate);
  if (!businessDate2) throw new HttpError(400, "invalid_business_date", "Tanggal bisnis wajib valid (YYYY-MM-DD).");
  const registerId = normalizeRegisterId(body.registerId);
  const counts = normalizeCounts(body, false);
  const existing = await firestore.getDocument(
    "cashClosingSessions",
    sessionDocumentId(businessDate2, registerId)
  );
  const collected = await collectBusinessTransactions({ businessDate: businessDate2, firestore, registerId });
  const existingData = existing?.data || null;
  const events = existingData ? await loadClosingEvents(firestore, existing.id) : [];
  const preview = buildPreviewResult({ actor, businessDate: businessDate2, collected, counts, events, existing: existingData, registerId });
  return { ...preview, generatedAt: now.toISOString(), ok: true };
}
__name(previewDailyClosing, "previewDailyClosing");
async function closeDailyClosing({ actor, body, firestore, request, now = /* @__PURE__ */ new Date() }) {
  const businessDate2 = validBusinessDate(body.businessDate);
  if (!businessDate2) throw new HttpError(400, "invalid_business_date", "Tanggal bisnis wajib valid (YYYY-MM-DD).");
  const registerId = normalizeRegisterId(body.registerId);
  if (businessDate2 > businessDateOf(now.toISOString())) {
    throw new HttpError(400, "future_business_date", "Tanggal bisnis di masa depan belum dapat ditutup.");
  }
  const counts = normalizeCounts(body, true);
  const key = getIdempotencyKey(request, body);
  const type = "daily-closing-close";
  const existingOperation = await readOperationResult(firestore, type, key);
  if (existingOperation.result) return { ...existingOperation.result, duplicate: true };
  const sessionId = sessionDocumentId(businessDate2, registerId);
  const existingDocument = await firestore.getDocument("cashClosingSessions", sessionId);
  const existing = existingDocument?.data || null;
  if (existing?.status === "closed") {
    throw new HttpError(409, "daily_closing_already_closed", "Tanggal dan register ini sudah ditutup. Reopen hanya dapat dilakukan Owner.");
  }
  const collected = await collectBusinessTransactions({ businessDate: businessDate2, firestore, registerId });
  const reconciliation = calculateReconciliation(collected.totals, counts);
  const reason = varianceReason(body, reconciliation);
  const revision = Math.max(0, Number(existing?.revision || 0)) + 1;
  const timestamp = now.toISOString();
  const eventId = await stableDocumentId("cash-closing-event", sessionId + ":" + key);
  const session = {
    businessDate: businessDate2,
    cashVariance: reconciliation.cashVariance,
    closedAt: timestamp,
    closedByName: actor.displayName,
    closedByUid: actor.uid,
    cashDenominations: counts.cashDenominations,
    countedCash: counts.countedCash,
    createdAt: existing?.createdAt || timestamp,
    cutoffAt: timestamp,
    digitalCounts: counts.digitalCounts,
    digitalReconciliation: reconciliation.digital,
    expectedCash: reconciliation.expectedCash,
    id: sessionId,
    lastEventAt: timestamp,
    lastEventId: eventId,
    lastEventType: "closed",
    openingCash: counts.openingCash,
    reviewNote: cleanText(body.reviewNote, 1e3),
    registerId,
    revision,
    sourceFingerprint: collected.sourceFingerprint,
    sourceWatermark: collected.sourceWatermark,
    status: "closed",
    totalsByMethod: collected.totals,
    transactionCount: collected.references.length,
    transactionReferences: collected.references,
    updatedAt: timestamp,
    varianceReason: reason
  };
  const event = {
    action: "closed",
    actorName: actor.displayName,
    actorUid: actor.uid,
    businessDate: businessDate2,
    closingId: sessionId,
    createdAt: timestamp,
    id: eventId,
    reason,
    registerId,
    revision,
    sourceFingerprint: collected.sourceFingerprint,
    snapshot: {
      businessDate: businessDate2,
      cashVariance: reconciliation.cashVariance,
      cashDenominations: counts.cashDenominations,
      countedCash: counts.countedCash,
      cutoffAt: timestamp,
      digitalCounts: counts.digitalCounts,
      digitalReconciliation: reconciliation.digital,
      expectedCash: reconciliation.expectedCash,
      openingCash: counts.openingCash,
      registerId,
      reviewNote: cleanText(body.reviewNote, 1e3),
      revision,
      sourceFingerprint: collected.sourceFingerprint,
      sourceWatermark: collected.sourceWatermark,
      totalsByMethod: collected.totals,
      transactionCount: collected.references.length,
      transactionReferences: collected.references,
      varianceReason: reason
    },
    summary: {
      cashVariance: reconciliation.cashVariance,
      expectedCash: reconciliation.expectedCash,
      transactionCount: collected.references.length
    },
    type: "cash-closing-event"
  };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      event: { collectionId: "cashClosingEvents", documentId: eventId },
      session: { collectionId: "cashClosingSessions", documentId: sessionId }
    },
    firestore,
    key,
    receipt: {},
    result: { event, session },
    targetId: sessionId,
    type,
    writes: [
      firestore.setWrite(
        "cashClosingSessions",
        sessionId,
        session,
        existingDocument ? { updateTime: existingDocument.updateTime } : { exists: false }
      ),
      firestore.setWrite("cashClosingEvents", eventId, event, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(closeDailyClosing, "closeDailyClosing");
async function reopenDailyClosing({ actor, body, firestore, request, now = /* @__PURE__ */ new Date() }) {
  if (actor.role !== "owner") throw new HttpError(403, "owner_required", "Reopen closing hanya dapat dilakukan Owner.");
  const businessDate2 = validBusinessDate(body.businessDate);
  if (!businessDate2) throw new HttpError(400, "invalid_business_date", "Tanggal bisnis wajib valid (YYYY-MM-DD).");
  const registerId = normalizeRegisterId(body.registerId);
  const reason = cleanText(body.reason, 600);
  if (reason.length < 4) throw new HttpError(400, "reopen_reason_required", "Alasan reopen wajib diisi minimal 4 karakter.");
  const key = getIdempotencyKey(request, body);
  const type = "daily-closing-reopen";
  const existingOperation = await readOperationResult(firestore, type, key);
  if (existingOperation.result) return { ...existingOperation.result, duplicate: true };
  const sessionId = sessionDocumentId(businessDate2, registerId);
  const existingDocument = await firestore.getDocument("cashClosingSessions", sessionId);
  if (!existingDocument || existingDocument.data.status !== "closed") {
    throw new HttpError(409, "daily_closing_not_closed", "Hanya closing berstatus Closed yang dapat dibuka kembali.");
  }
  const timestamp = now.toISOString();
  const eventId = await stableDocumentId("cash-closing-event", sessionId + ":" + key);
  const session = {
    ...existingDocument.data,
    id: sessionId,
    lastEventAt: timestamp,
    lastEventId: eventId,
    lastEventType: "reopened",
    reopenReason: reason,
    reopenedAt: timestamp,
    reopenedByName: actor.displayName,
    reopenedByUid: actor.uid,
    status: "reopened",
    updatedAt: timestamp
  };
  const event = {
    action: "reopened",
    actorName: actor.displayName,
    actorUid: actor.uid,
    businessDate: businessDate2,
    closingId: sessionId,
    createdAt: timestamp,
    id: eventId,
    reason,
    registerId,
    revision: Number(existingDocument.data.revision || 1),
    sourceFingerprint: existingDocument.data.sourceFingerprint || "",
    type: "cash-closing-event"
  };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      event: { collectionId: "cashClosingEvents", documentId: eventId },
      session: { collectionId: "cashClosingSessions", documentId: sessionId }
    },
    firestore,
    key,
    receipt: {},
    result: { event, session },
    targetId: sessionId,
    type,
    writes: [
      firestore.setWrite("cashClosingSessions", sessionId, session, { updateTime: existingDocument.updateTime }),
      firestore.setWrite("cashClosingEvents", eventId, event, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(reopenDailyClosing, "reopenDailyClosing");

// src/domain/maintenance.js
var ACTIVE_STATUSES = /* @__PURE__ */ new Set([
  "reported",
  "triaged",
  "approved",
  "assigned",
  "in_progress",
  "waiting_parts",
  "completed"
]);
var PRIORITIES = /* @__PURE__ */ new Set(["low", "normal", "high", "urgent"]);
var METHODS2 = /* @__PURE__ */ new Set(["cash", "transfer", "qris", "other"]);
function optionalDateTime(value, label) {
  if (value === void 0 || value === null || value === "") return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "invalid_datetime", label + " tidak valid.");
  }
  return parsed.toISOString();
}
__name(optionalDateTime, "optionalDateTime");
function requiredDate(value, label) {
  const date = cleanText(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, "invalid_date", label + " wajib menggunakan format YYYY-MM-DD.");
  }
  const parsed = /* @__PURE__ */ new Date(date + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, "invalid_date", label + " tidak valid.");
  }
  return date;
}
__name(requiredDate, "requiredDate");
function optionalMoney2(value, label) {
  if (value === void 0 || value === null || value === "") return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e9) {
    throw new HttpError(400, "invalid_amount", label + " harus berupa nominal 0 sampai 1.000.000.000.");
  }
  return cleanMoney(amount);
}
__name(optionalMoney2, "optionalMoney");
function normalizeAttachments(value) {
  if (value === void 0 || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "invalid_attachments", "Lampiran harus berupa daftar referensi.");
  return value.slice(0, 10).map((entry) => {
    const url = cleanText(entry?.url, 2e3);
    if (!/^https:\/\//i.test(url)) throw new HttpError(400, "invalid_attachment_url", "Referensi lampiran harus menggunakan URL HTTPS.");
    return { label: cleanText(entry?.label, 100) || "Lampiran", url };
  });
}
__name(normalizeAttachments, "normalizeAttachments");
function normalizePriority(value, fallback = "normal") {
  const priority = cleanText(value, 20).toLowerCase() || fallback;
  if (!PRIORITIES.has(priority)) {
    throw new HttpError(400, "invalid_priority", "Prioritas harus low, normal, high, atau urgent.");
  }
  return priority;
}
__name(normalizePriority, "normalizePriority");
function actorFields(actor) {
  return {
    actorName: cleanText(actor.displayName, 120) || "Admin",
    actorUid: cleanText(actor.uid, 128)
  };
}
__name(actorFields, "actorFields");
function createEvent({ actor, action, fromStatus, toStatus, workOrder, reason = "", details = {}, now, id }) {
  return {
    action,
    ...actorFields(actor),
    createdAt: now,
    details,
    fromStatus: fromStatus || "",
    id,
    inventoryItemId: workOrder.inventoryItemId,
    reason: cleanText(reason, 600),
    revision: Number(workOrder.revision || 0) + 1,
    toStatus,
    workOrderId: workOrder.id
  };
}
__name(createEvent, "createEvent");
function isActiveMaintenanceStatus(status) {
  return ACTIVE_STATUSES.has(cleanText(status, 40));
}
__name(isActiveMaintenanceStatus, "isActiveMaintenanceStatus");
function getMaintenanceTransition(action) {
  const transitions = {
    triage: { from: ["reported"], to: "triaged" },
    approve: { from: ["triaged"], to: "approved" },
    assign: { from: ["approved"], to: "assigned" },
    start: { from: ["assigned"], to: "in_progress" },
    waiting_parts: { from: ["in_progress"], to: "waiting_parts" },
    resume: { from: ["waiting_parts"], to: "in_progress" },
    complete: { from: ["in_progress"], to: "completed" },
    verify: { from: ["completed"], to: "verified" },
    cancel: { from: ["reported", "triaged", "approved", "assigned", "in_progress", "waiting_parts"], to: "cancelled" },
    reopen: { from: ["verified"], to: "in_progress" }
  };
  return transitions[cleanText(action, 40)] || null;
}
__name(getMaintenanceTransition, "getMaintenanceTransition");
async function loadWorkOrder(firestore, workOrderId) {
  const id = cleanText(workOrderId, 160);
  if (!id) throw new HttpError(400, "work_order_required", "Work order wajib dipilih.");
  const document = await firestore.getDocument("maintenanceWorkOrders", id);
  if (!document) throw new HttpError(404, "work_order_not_found", "Work order maintenance tidak ditemukan.");
  return document;
}
__name(loadWorkOrder, "loadWorkOrder");
async function loadItem(firestore, itemId) {
  const id = cleanText(itemId, 160);
  if (!id) throw new HttpError(400, "item_required", "Equipment wajib dipilih.");
  const document = await firestore.getDocument("inventoryItems", id);
  if (!document) throw new HttpError(404, "item_not_found", "Equipment tidak ditemukan di inventory.");
  return document;
}
__name(loadItem, "loadItem");
async function findWorkOrdersForItem(firestore, itemId) {
  const rows = await firestore.runQuery({
    from: [{ collectionId: "maintenanceWorkOrders" }],
    limit: 500,
    where: {
      fieldFilter: {
        field: { fieldPath: "inventoryItemId" },
        op: "EQUAL",
        value: { stringValue: itemId }
      }
    }
  });
  return rows.map((row) => ({ id: row.id, ...row.data || {}, updateTime: row.updateTime || "" }));
}
__name(findWorkOrdersForItem, "findWorkOrdersForItem");
function assertRevision(workOrder, expectedRevision) {
  if (expectedRevision === void 0 || expectedRevision === null || expectedRevision === "") return;
  const expected = Number(expectedRevision);
  if (!Number.isInteger(expected) || expected !== Number(workOrder.revision || 0)) {
    throw new HttpError(409, "maintenance_revision_conflict", "Work order sudah berubah. Muat ulang data terbaru sebelum melanjutkan.");
  }
}
__name(assertRevision, "assertRevision");
function makeWorkOrderEventWrite(firestore, eventId, event) {
  return firestore.setWrite("maintenanceEvents", eventId, event, { exists: false });
}
__name(makeWorkOrderEventWrite, "makeWorkOrderEventWrite");
async function reportMaintenanceWorkOrder({ actor, body, firestore, request, now = /* @__PURE__ */ new Date() }) {
  const key = getIdempotencyKey(request, body);
  const type = "maintenance-work-order-report";
  const existingOperation = await readOperationResult(firestore, type, key);
  if (existingOperation.result) return { ...existingOperation.result, duplicate: true };
  const itemDocument = await loadItem(firestore, body.inventoryItemId);
  const item = { id: itemDocument.id, ...itemDocument.data };
  if (["inactive", "lost"].includes(cleanText(item.status, 40))) {
    throw new HttpError(409, "equipment_unavailable", "Equipment nonaktif atau hilang tidak dapat dibuatkan work order baru.");
  }
  const existingOrders = await findWorkOrdersForItem(firestore, item.id);
  const activeOrder = existingOrders.find((row) => isActiveMaintenanceStatus(row.status));
  if (activeOrder) {
    throw new HttpError(409, "active_work_order_exists", "Equipment ini masih memiliki work order aktif: " + activeOrder.id + ".");
  }
  const title = cleanText(body.title, 160);
  const description = cleanText(body.description, 2e3);
  if (title.length < 3) throw new HttpError(400, "title_required", "Judul masalah minimal 3 karakter.");
  if (description.length < 4) throw new HttpError(400, "description_required", "Deskripsi masalah minimal 4 karakter.");
  const plannedAt = optionalDateTime(body.plannedAt, "Jadwal maintenance");
  const dueAt = optionalDateTime(body.dueAt, "Target penyelesaian");
  if (plannedAt && dueAt && new Date(dueAt).getTime() < new Date(plannedAt).getTime()) {
    throw new HttpError(400, "invalid_schedule", "Target penyelesaian tidak boleh lebih awal dari jadwal maintenance.");
  }
  const timestamp = now.toISOString();
  const workOrderId = await stableDocumentId("maintenance-work-order", key);
  const eventId = await stableDocumentId("maintenance-event", workOrderId + ":reported");
  const priority = normalizePriority(body.priority);
  const workOrder = {
    id: workOrderId,
    inventoryItemId: item.id,
    itemName: cleanText(item.name, 160),
    itemCategory: cleanText(item.category, 80),
    itemLocation: cleanText(item.location, 240),
    title,
    description,
    priority,
    status: "reported",
    reportedAt: timestamp,
    reportedByUid: actor.uid,
    reportedByName: actor.displayName,
    assignedToUid: "",
    assignedToName: "",
    plannedAt,
    dueAt,
    diagnosis: "",
    repairNotes: "",
    verificationNote: "",
    verificationCondition: "",
    vendor: cleanText(body.vendor, 160),
    estimatedCost: optionalMoney2(body.estimatedCost, "Estimasi biaya"),
    actualCost: 0,
    costEntryId: "",
    attachments: normalizeAttachments(body.attachments),
    priorItemStatus: cleanText(item.status, 40) || "active",
    priorItemCondition: cleanText(item.condition, 40) || "good",
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    updatedByUid: actor.uid,
    updatedByName: actor.displayName
  };
  const nextItem = {
    ...item,
    condition: "maintenance",
    status: "maintenance",
    updatedAt: timestamp
  };
  const event = {
    action: "reported",
    ...actorFields(actor),
    createdAt: timestamp,
    details: { title, priority, itemName: workOrder.itemName },
    fromStatus: "",
    id: eventId,
    inventoryItemId: item.id,
    reason: "",
    revision: 1,
    toStatus: "reported",
    workOrderId
  };
  const result = { event, item: nextItem, workOrder };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      event: { collectionId: "maintenanceEvents", documentId: eventId },
      item: { collectionId: "inventoryItems", documentId: item.id },
      workOrder: { collectionId: "maintenanceWorkOrders", documentId: workOrderId }
    },
    firestore,
    key,
    result,
    receipt: {},
    targetId: workOrderId,
    type,
    writes: [
      firestore.setWrite("inventoryItems", item.id, nextItem, { updateTime: itemDocument.updateTime }),
      firestore.setWrite("maintenanceWorkOrders", workOrderId, workOrder, { exists: false }),
      makeWorkOrderEventWrite(firestore, eventId, event)
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(reportMaintenanceWorkOrder, "reportMaintenanceWorkOrder");
async function actOnMaintenanceWorkOrder({ actor, body, firestore, request, now = /* @__PURE__ */ new Date() }) {
  const action = cleanText(body.action, 40).toLowerCase();
  if (action === "reopen" && actor.role !== "owner") {
    throw new HttpError(403, "owner_required", "Reopen work order hanya dapat dilakukan Owner.");
  }
  const key = getIdempotencyKey(request, body);
  const type = "maintenance-work-order-" + action;
  const existingOperation = await readOperationResult(firestore, type, key);
  if (existingOperation.result) return { ...existingOperation.result, duplicate: true };
  const workOrderDocument = await loadWorkOrder(firestore, body.workOrderId);
  const current = { id: workOrderDocument.id, ...workOrderDocument.data };
  assertRevision(current, body.expectedRevision);
  const policy = getMaintenanceTransition(action);
  if (!policy || !policy.from.includes(current.status)) {
    throw new HttpError(409, "maintenance_transition_invalid", "Aksi " + action + " tidak tersedia untuk status " + current.status + ".");
  }
  const itemDocument = await loadItem(firestore, current.inventoryItemId);
  const item = { id: itemDocument.id, ...itemDocument.data };
  if (action === "reopen") {
    const otherActive = (await findWorkOrdersForItem(firestore, item.id)).find((row) => row.id !== current.id && isActiveMaintenanceStatus(row.status));
    if (otherActive) {
      throw new HttpError(409, "active_work_order_exists", "Equipment sudah memiliki work order aktif lain.");
    }
  }
  const timestamp = now.toISOString();
  const nextStatus = policy.to;
  const nextWorkOrder = {
    ...current,
    revision: Number(current.revision || 0) + 1,
    status: nextStatus,
    updatedAt: timestamp,
    updatedByUid: actor.uid,
    updatedByName: actor.displayName
  };
  let nextItem = null;
  let reason = cleanText(body.reason, 600);
  const details = {};
  if (action === "triage") {
    const diagnosis = cleanText(body.diagnosis, 2e3);
    if (diagnosis.length < 4) throw new HttpError(400, "diagnosis_required", "Diagnosis awal minimal 4 karakter.");
    nextWorkOrder.diagnosis = diagnosis;
    nextWorkOrder.priority = normalizePriority(body.priority, current.priority);
    nextWorkOrder.triagedAt = timestamp;
    nextWorkOrder.triagedByUid = actor.uid;
    nextWorkOrder.triagedByName = actor.displayName;
    details.diagnosis = diagnosis;
    details.priority = nextWorkOrder.priority;
  } else if (action === "approve") {
    nextWorkOrder.approvedAt = timestamp;
    nextWorkOrder.approvedByUid = actor.uid;
    nextWorkOrder.approvedByName = actor.displayName;
    nextWorkOrder.approvalNote = cleanText(body.note, 600);
    details.note = nextWorkOrder.approvalNote;
  } else if (action === "assign") {
    const assignedToName = cleanText(body.assignedToName, 120);
    if (!assignedToName) throw new HttpError(400, "assignee_required", "Nama PIC wajib diisi.");
    const plannedAt = optionalDateTime(body.plannedAt, "Jadwal maintenance");
    const dueAt = optionalDateTime(body.dueAt, "Target penyelesaian");
    if (plannedAt && dueAt && new Date(dueAt).getTime() < new Date(plannedAt).getTime()) {
      throw new HttpError(400, "invalid_schedule", "Target penyelesaian tidak boleh lebih awal dari jadwal maintenance.");
    }
    nextWorkOrder.assignedToName = assignedToName;
    nextWorkOrder.assignedToUid = cleanText(body.assignedToUid, 128);
    nextWorkOrder.plannedAt = plannedAt || current.plannedAt || "";
    nextWorkOrder.dueAt = dueAt || current.dueAt || "";
    nextWorkOrder.assignedAt = timestamp;
    nextWorkOrder.assignedByUid = actor.uid;
    details.assignedToName = assignedToName;
    details.plannedAt = nextWorkOrder.plannedAt;
    details.dueAt = nextWorkOrder.dueAt;
  } else if (action === "start") {
    if (!cleanText(current.assignedToName, 120)) {
      throw new HttpError(409, "assignee_required", "Work order harus ditugaskan sebelum pekerjaan dimulai.");
    }
    nextWorkOrder.startedAt = timestamp;
    nextWorkOrder.startedByUid = actor.uid;
  } else if (action === "waiting_parts") {
    if (reason.length < 4) throw new HttpError(400, "waiting_reason_required", "Alasan menunggu spare part minimal 4 karakter.");
    nextWorkOrder.waitingPartsAt = timestamp;
    nextWorkOrder.waitingPartsReason = reason;
    details.reason = reason;
  } else if (action === "resume") {
    nextWorkOrder.resumedAt = timestamp;
    nextWorkOrder.resumeNote = cleanText(body.note, 600);
    details.note = nextWorkOrder.resumeNote;
  } else if (action === "complete") {
    const repairNotes = cleanText(body.repairNotes, 2e3);
    if (repairNotes.length < 4) throw new HttpError(400, "repair_notes_required", "Catatan perbaikan minimal 4 karakter.");
    nextWorkOrder.repairNotes = repairNotes;
    nextWorkOrder.completedAt = timestamp;
    nextWorkOrder.completedByUid = actor.uid;
    nextWorkOrder.completedByName = actor.displayName;
    details.repairNotes = repairNotes;
  } else if (action === "verify") {
    const condition = cleanText(body.verificationCondition, 20).toLowerCase();
    if (!["good", "fair", "broken"].includes(condition)) {
      throw new HttpError(400, "verification_condition_required", "Hasil verifikasi wajib good, fair, atau broken.");
    }
    const verificationNote = cleanText(body.verificationNote, 1e3);
    if (condition === "broken" && verificationNote.length < 4) {
      throw new HttpError(400, "verification_note_required", "Catatan wajib diisi jika equipment belum layak digunakan.");
    }
    nextWorkOrder.verificationCondition = condition;
    nextWorkOrder.verificationNote = verificationNote;
    nextWorkOrder.verifiedAt = timestamp;
    nextWorkOrder.verifiedByUid = actor.uid;
    nextWorkOrder.verifiedByName = actor.displayName;
    nextItem = {
      ...item,
      condition,
      status: condition === "broken" ? "broken" : "active",
      updatedAt: timestamp
    };
    details.verificationCondition = condition;
    details.verificationNote = verificationNote;
  } else if (action === "cancel") {
    if (reason.length < 4) throw new HttpError(400, "cancel_reason_required", "Alasan pembatalan minimal 4 karakter.");
    nextWorkOrder.cancelledAt = timestamp;
    nextWorkOrder.cancelledByUid = actor.uid;
    nextWorkOrder.cancelReason = reason;
    nextItem = {
      ...item,
      condition: cleanText(current.reopenPriorItemCondition, 40) || cleanText(current.priorItemCondition, 40) || "good",
      status: cleanText(current.reopenPriorItemStatus, 40) || cleanText(current.priorItemStatus, 40) || "active",
      updatedAt: timestamp
    };
    details.reason = reason;
  } else if (action === "reopen") {
    if (reason.length < 4) throw new HttpError(400, "reopen_reason_required", "Alasan reopen minimal 4 karakter.");
    nextWorkOrder.reopenPriorItemStatus = cleanText(item.status, 40) || "active";
    nextWorkOrder.reopenPriorItemCondition = cleanText(item.condition, 40) || "good";
    nextWorkOrder.reopenedAt = timestamp;
    nextWorkOrder.reopenedByUid = actor.uid;
    nextWorkOrder.reopenedByName = actor.displayName;
    nextWorkOrder.reopenReason = reason;
    nextItem = { ...item, condition: "maintenance", status: "maintenance", updatedAt: timestamp };
    details.reason = reason;
  }
  const eventId = await stableDocumentId("maintenance-event", current.id + ":" + key);
  const event = createEvent({
    actor,
    action,
    fromStatus: current.status,
    toStatus: nextStatus,
    workOrder: current,
    reason,
    details,
    now: timestamp,
    id: eventId
  });
  const writes = [
    firestore.setWrite("maintenanceWorkOrders", current.id, nextWorkOrder, { updateTime: workOrderDocument.updateTime }),
    makeWorkOrderEventWrite(firestore, eventId, event)
  ];
  if (nextItem) {
    writes.push(firestore.setWrite("inventoryItems", item.id, nextItem, { updateTime: itemDocument.updateTime }));
  }
  const result = { event, item: nextItem, workOrder: nextWorkOrder };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      event: { collectionId: "maintenanceEvents", documentId: eventId },
      ...nextItem ? { item: { collectionId: "inventoryItems", documentId: item.id } } : {},
      workOrder: { collectionId: "maintenanceWorkOrders", documentId: current.id }
    },
    firestore,
    key,
    result,
    receipt: {},
    targetId: current.id,
    type,
    writes
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(actOnMaintenanceWorkOrder, "actOnMaintenanceWorkOrder");
async function recordMaintenanceCost({ actor, body, firestore, request, now = /* @__PURE__ */ new Date() }) {
  const key = getIdempotencyKey(request, body);
  const type = "maintenance-work-order-cost";
  const existingOperation = await readOperationResult(firestore, type, key);
  if (existingOperation.result) return { ...existingOperation.result, duplicate: true };
  const workOrderDocument = await loadWorkOrder(firestore, body.workOrderId);
  const current = { id: workOrderDocument.id, ...workOrderDocument.data };
  assertRevision(current, body.expectedRevision);
  if (!["completed", "verified"].includes(current.status)) {
    throw new HttpError(409, "maintenance_cost_not_ready", "Biaya aktual hanya dapat dicatat setelah pekerjaan selesai.");
  }
  if (current.costEntryId) {
    throw new HttpError(409, "maintenance_cost_already_recorded", "Biaya work order ini sudah tercatat di Bookkeeping.");
  }
  const amount = optionalMoney2(body.amount, "Biaya aktual");
  if (amount <= 0) throw new HttpError(400, "amount_required", "Biaya aktual harus lebih dari nol.");
  const paymentMethod2 = cleanText(body.paymentMethod, 20).toLowerCase();
  if (!METHODS2.has(paymentMethod2)) throw new HttpError(400, "invalid_payment_method", "Metode harus cash, transfer, qris, atau other.");
  const note = cleanText(body.note, 600);
  if (note.length < 4) throw new HttpError(400, "cost_note_required", "Catatan biaya minimal 4 karakter.");
  const date = requiredDate(body.date, "Tanggal biaya");
  const timestamp = now.toISOString();
  const entryId = await stableDocumentId("maintenance-ledger", current.id);
  const eventId = await stableDocumentId("maintenance-event", current.id + ":cost:" + key);
  const entry = {
    id: entryId,
    type: "expense",
    category: "maintenance",
    title: "Biaya maintenance " + cleanText(current.itemName, 120),
    amount,
    date,
    paymentMethod: paymentMethod2,
    note,
    source: "maintenance",
    sourceWorkOrderId: current.id,
    sourceEventId: eventId,
    sourceAction: "maintenance_cost",
    actorName: actor.displayName,
    actorUid: actor.uid,
    idempotencyKey: key,
    immutable: true,
    reversalOf: "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const nextWorkOrder = {
    ...current,
    actualCost: amount,
    costEntryId: entryId,
    costRecordedAt: timestamp,
    costRecordedByUid: actor.uid,
    costRecordedByName: actor.displayName,
    revision: Number(current.revision || 0) + 1,
    updatedAt: timestamp,
    updatedByUid: actor.uid,
    updatedByName: actor.displayName
  };
  const event = {
    action: "cost_recorded",
    ...actorFields(actor),
    actualCost: amount,
    bookkeepingEntryId: entryId,
    createdAt: timestamp,
    details: { amount, date, paymentMethod: paymentMethod2, note },
    fromStatus: current.status,
    id: eventId,
    inventoryItemId: current.inventoryItemId,
    reason: note,
    revision: nextWorkOrder.revision,
    toStatus: current.status,
    workOrderId: current.id
  };
  const result = { entry, event, workOrder: nextWorkOrder };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      entry: { collectionId: "bookkeepingEntries", documentId: entryId },
      event: { collectionId: "maintenanceEvents", documentId: eventId },
      workOrder: { collectionId: "maintenanceWorkOrders", documentId: current.id }
    },
    firestore,
    key,
    result,
    receipt: {},
    targetId: current.id,
    type,
    writes: [
      firestore.setWrite("maintenanceWorkOrders", current.id, nextWorkOrder, { updateTime: workOrderDocument.updateTime }),
      firestore.setWrite("bookkeepingEntries", entryId, entry, { exists: false }),
      makeWorkOrderEventWrite(firestore, eventId, event)
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(recordMaintenanceCost, "recordMaintenanceCost");

// src/domain/danger.js
var CONFIRMATION_PHRASE = "HAPUS DATA 37 STUDIO";
var DRY_RUN_TTL_MS = 15 * 60 * 1e3;
var DELETE_BATCH_SIZE = 200;
var COUNT_SAFETY_LIMIT = 5e4;
var DANGER_COLLECTIONS = Object.freeze([
  ["bookings", "Booking & invoice"],
  ["paymentProofs", "Bukti pembayaran"],
  ["bookingMessages", "Pesan booking"],
  ["clientCalendarSlots", "Slot kalender client"],
  ["bookingScheduleDays", "Booking schedule concurrency guards"],
  ["customers", "Customer profile"],
  ["bookkeepingEntries", "Pembukuan"],
  ["operatorFeeEntries", "Operator fee"],
  ["guardAttendanceSessions", "Guard attendance"],
  ["inventoryItems", "Inventory items"],
  ["inventoryMovements", "Inventory movements"],
  ["gallery", "Gallery metadata"],
  ["notificationEvents", "Notification events"],
  ["mail", "Mail queue"],
  ["settings", "Remote app settings"],
  ["users", "Admin/client account docs"]
]);
function environmentInfo(env, firestore) {
  return {
    environment: cleanText(env.APP_ENVIRONMENT || "unknown", 40),
    projectId: firestore.projectId
  };
}
__name(environmentInfo, "environmentInfo");
async function countCollection(firestore, collectionId) {
  let count = 0;
  let pageToken = "";
  let preserved = 0;
  let truncated = false;
  do {
    const page = await firestore.listDocuments(collectionId, { pageSize: 500, pageToken });
    if (collectionId === "users") preserved += page.documents.length;
    else count += page.documents.length;
    pageToken = page.nextPageToken;
    if (count + preserved >= COUNT_SAFETY_LIMIT) {
      truncated = Boolean(pageToken);
      break;
    }
  } while (pageToken);
  return { count, preserved, truncated };
}
__name(countCollection, "countCollection");
async function createDangerDryRun({ actor, body, env, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "danger-dry-run", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const collectionRows = [];
  for (const [collectionId, label] of DANGER_COLLECTIONS) {
    const estimate = await countCollection(firestore, collectionId);
    collectionRows.push({ collectionId, label, ...estimate });
  }
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const snapshotId = await stableDocumentId("dryrun", `${actor.uid}:${key}`);
  const result = {
    ...environmentInfo(env, firestore),
    collections: collectionRows,
    createdAt,
    externalData: {
      cloudinaryFiles: "retained",
      firebaseAuthUsers: "retained"
    },
    expiresAt: new Date(Date.now() + DRY_RUN_TTL_MS).toISOString(),
    ownerUid: actor.uid,
    snapshotId,
    totalDocuments: collectionRows.reduce((sum, row) => sum + row.count, 0)
  };
  const committed = await commitIdempotentOperation({
    actor,
    firestore,
    key,
    result,
    targetId: snapshotId,
    type: "danger-dry-run",
    writes: [
      firestore.setWrite("adminOperationDryRuns", snapshotId, result, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(createDangerDryRun, "createDangerDryRun");
function assertDangerConfirmation(body) {
  if (String(body.confirmationPhrase || "") !== CONFIRMATION_PHRASE || body.finalConfirmation !== true) {
    throw new HttpError(
      400,
      "confirmation_required",
      "Phrase konfirmasi dan checkbox final wajib cocok."
    );
  }
}
__name(assertDangerConfirmation, "assertDangerConfirmation");
async function startDangerJob({ actor, body, env, firestore, request }) {
  assertDangerConfirmation(body);
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "danger-start", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const snapshotId = cleanText(body.snapshotId, 160);
  const dryRunDocument = await firestore.getDocument("adminOperationDryRuns", snapshotId);
  const dryRun = dryRunDocument?.data;
  const currentEnvironment = environmentInfo(env, firestore);
  if (!dryRun || dryRun.ownerUid !== actor.uid) {
    throw new HttpError(409, "dry_run_required", "Jalankan dry-run baru sebelum reset.");
  }
  if (Date.parse(dryRun.expiresAt || "") <= Date.now() || dryRun.projectId !== currentEnvironment.projectId || dryRun.environment !== currentEnvironment.environment) {
    throw new HttpError(409, "dry_run_expired", "Dry-run sudah kedaluwarsa atau environment berubah.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const jobId = await stableDocumentId("danger", `${actor.uid}:${key}`);
  const collections = (Array.isArray(dryRun.collections) ? dryRun.collections : []).map((row) => ({
    collectionId: row.collectionId,
    deleted: 0,
    error: "",
    estimated: Number(row.count || 0),
    label: row.label,
    preserved: Number(row.preserved || 0),
    status: Number(row.count || 0) > 0 ? "pending" : "empty"
  }));
  const job = {
    ...currentEnvironment,
    actorName: actor.displayName,
    actorUid: actor.uid,
    collections,
    createdAt: now,
    dryRunSnapshotId: snapshotId,
    externalData: dryRun.externalData,
    id: jobId,
    status: collections.some((row) => row.status === "pending") ? "queued" : "completed",
    totalDeleted: 0,
    updatedAt: now
  };
  const result = { job };
  const committed = await commitIdempotentOperation({
    actor,
    firestore,
    key,
    result,
    targetId: jobId,
    type: "danger-start",
    writes: [firestore.setWrite("adminOperationJobs", jobId, job, { exists: false })]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(startDangerJob, "startDangerJob");
async function readDangerJob({ actor, firestore, jobId }) {
  const document = await firestore.getDocument("adminOperationJobs", cleanText(jobId, 160));
  if (!document || document.data.actorUid !== actor.uid) {
    throw new HttpError(404, "job_not_found", "Danger Zone job tidak ditemukan.");
  }
  return { job: document.data };
}
__name(readDangerJob, "readDangerJob");
async function runDangerJobStep({ actor, body, firestore, jobId, request }) {
  const key = getIdempotencyKey(request, body);
  const type = `danger-step:${cleanText(jobId, 160)}`;
  const existing = await readOperationResult(firestore, type, key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const jobDocument = await firestore.getDocument("adminOperationJobs", cleanText(jobId, 160));
  if (!jobDocument || jobDocument.data.actorUid !== actor.uid) {
    throw new HttpError(404, "job_not_found", "Danger Zone job tidak ditemukan.");
  }
  const job = jobDocument.data;
  if (job.status === "completed") return { duplicate: true, job };
  const rows = Array.isArray(job.collections) ? job.collections.map((row) => ({ ...row })) : [];
  const activeIndex = rows.findIndex((row) => ["pending", "running"].includes(row.status));
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const writes = [];
  if (activeIndex >= 0) {
    const row = rows[activeIndex];
    const page = await firestore.listDocuments(row.collectionId, { pageSize: DELETE_BATCH_SIZE });
    const deletable = row.collectionId === "users" ? [] : page.documents;
    if (deletable.length) {
      for (const document of deletable) {
        writes.push(firestore.deleteWrite(row.collectionId, document.id, { updateTime: document.updateTime }));
      }
      row.deleted = Number(row.deleted || 0) + deletable.length;
      row.status = "running";
    } else {
      row.status = Number(row.deleted || 0) > 0 ? "done" : "empty";
    }
    rows[activeIndex] = row;
  }
  const hasRemaining = rows.some((row) => ["pending", "running"].includes(row.status));
  const nextJob = {
    ...job,
    collections: rows,
    status: hasRemaining ? "running" : "completed",
    totalDeleted: rows.reduce((sum, row) => sum + Number(row.deleted || 0), 0),
    updatedAt: now
  };
  writes.push(firestore.setWrite(
    "adminOperationJobs",
    jobDocument.id,
    nextJob,
    { updateTime: jobDocument.updateTime }
  ));
  const result = { job: nextJob };
  const committed = await commitIdempotentOperation({
    actor,
    firestore,
    key,
    result,
    targetId: jobDocument.id,
    type,
    writes
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(runDangerJobStep, "runDangerJobStep");

// src/domain/finance.js
function bookingTotal2(booking, paymentHistory) {
  if (Object.prototype.hasOwnProperty.call(booking, "total") && Number.isFinite(Number(booking.total))) {
    return cleanMoney(booking.total);
  }
  if (Object.prototype.hasOwnProperty.call(booking, "subtotal") && Number.isFinite(Number(booking.subtotal))) {
    return cleanMoney(booking.subtotal);
  }
  return cleanMoney(booking.invoiceAmount) + sumAmounts(paymentHistory);
}
__name(bookingTotal2, "bookingTotal");
function payments(booking) {
  const history = Array.isArray(booking.paymentHistory) ? booking.paymentHistory.filter((entry) => cleanMoney(entry?.amount) > 0) : [];
  if (history.length) return history;
  const explicitTotal = bookingTotal2(booking, []);
  const status = cleanText(booking.paymentStatusCanonical || booking.paymentStatus, 40).toLowerCase();
  const legacyAmount = Math.max(
    cleanMoney(booking.paidAmount),
    cleanMoney(booking.dpAmount),
    ["paid", "lunas"].includes(status) ? explicitTotal : 0
  );
  if (!legacyAmount) return [];
  const createdAt = cleanText(
    booking.lastPaymentAt || booking.createdAt || booking.date || (/* @__PURE__ */ new Date()).toISOString(),
    80
  );
  return [{
    amount: legacyAmount,
    createdAt,
    date: /^\d{4}-\d{2}-\d{2}$/.test(createdAt) ? createdAt : createdAt.slice(0, 10),
    id: `legacy_${cleanText(booking.id || "booking", 80)}_payment`,
    idempotencyKey: `legacy:${cleanText(booking.id || "booking", 120)}`,
    method: cleanText(booking.lastPaymentMethod || booking.paymentMethod || "other", 80),
    note: "Saldo pembayaran sebelum ledger canonical",
    source: "legacy-projection"
  }];
}
__name(payments, "payments");
function refunds(booking) {
  return Array.isArray(booking.refundHistory) ? booking.refundHistory.filter((entry) => cleanMoney(entry?.amount) > 0) : [];
}
__name(refunds, "refunds");
function sumAmounts(rows) {
  return rows.reduce((total, row) => total + cleanMoney(row?.amount), 0);
}
__name(sumAmounts, "sumAmounts");
function financeSnapshot(booking) {
  const paymentHistory = payments(booking);
  const total = bookingTotal2(booking, paymentHistory);
  const refundHistory = refunds(booking);
  const grossPaid = sumAmounts(paymentHistory);
  const refunded = sumAmounts(refundHistory);
  const netPaid = Math.max(0, grossPaid - refunded);
  const isVoid = booking.paymentStatus === "void" || booking.invoiceStatus === "void";
  let status = "unpaid";
  if (isVoid) status = "void";
  else if (grossPaid > 0 && netPaid === 0 && refunded >= grossPaid) status = "refunded";
  else if (total > 0 && netPaid >= total) status = "paid";
  else if (netPaid > 0) status = "partial";
  return {
    grossPaid,
    netPaid,
    outstanding: ["void", "refunded"].includes(status) ? 0 : Math.max(0, total - netPaid),
    paymentHistory,
    refunded,
    refundHistory,
    status,
    total
  };
}
__name(financeSnapshot, "financeSnapshot");
function legacyPaymentStatus(status) {
  return {
    paid: "lunas",
    partial: "dp",
    refunded: "refunded",
    unpaid: "pending",
    void: "void"
  }[status] || "pending";
}
__name(legacyPaymentStatus, "legacyPaymentStatus");
function financeProjection(booking, snapshot, now) {
  return {
    ...booking,
    invoiceAmount: snapshot.outstanding,
    paidAmount: snapshot.netPaid,
    paymentStatus: legacyPaymentStatus(snapshot.status),
    paymentStatusCanonical: snapshot.status,
    refundedAmount: snapshot.refunded,
    updatedAt: now
  };
}
__name(financeProjection, "financeProjection");
function assertBookingOpen(snapshot) {
  if (snapshot.status === "void") {
    throw new HttpError(409, "invoice_void", "Invoice sudah void dan tidak menerima pembayaran baru.");
  }
  if (snapshot.status === "refunded") {
    throw new HttpError(409, "invoice_refunded", "Invoice sudah direfund penuh dan bersifat read-only.");
  }
}
__name(assertBookingOpen, "assertBookingOpen");
function actorFields2(actor) {
  return { actorName: actor.displayName, actorUid: actor.uid };
}
__name(actorFields2, "actorFields");
async function loadBooking(firestore, bookingId) {
  const cleanId = cleanText(bookingId, 160);
  if (!cleanId) throw new HttpError(400, "booking_required", "Booking wajib dipilih.");
  const document = await firestore.getDocument("bookings", cleanId);
  if (!document) throw new HttpError(404, "booking_not_found", "Booking tidak ditemukan.");
  return document;
}
__name(loadBooking, "loadBooking");
async function ledgerWrite({ actor, booking, event, firestore, type }) {
  const id = await stableDocumentId("ledger", `${type}:${booking.id}:${event.idempotencyKey}`);
  const isRefund = type === "booking-refund";
  const data = {
    amount: event.amount,
    ...actorFields2(actor),
    category: isRefund ? "refund" : "booking",
    createdAt: event.createdAt,
    date: event.date,
    id,
    idempotencyKey: event.idempotencyKey,
    immutable: true,
    note: isRefund ? event.reason : event.note,
    paymentMethod: event.method,
    reversalOf: "",
    source: type,
    sourceAction: isRefund ? "refund" : "payment",
    sourceBookingId: booking.id,
    sourceEventId: event.id,
    title: `${isRefund ? "Refund" : "Pembayaran"} ${booking.invoiceNumber || booking.bookingCode || booking.id}`,
    type: isRefund ? "expense" : "income",
    updatedAt: event.createdAt
  };
  return firestore.setWrite("bookkeepingEntries", id, data, { exists: false });
}
__name(ledgerWrite, "ledgerWrite");
function paymentEvent({ actor, body, key, source }) {
  const amount = cleanMoney(body.amount);
  const method = cleanPaymentMethod(body.method);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const date = cleanOperationDate(body.date, now);
  if (!amount) throw new HttpError(400, "amount_required", "Nominal pembayaran wajib lebih dari 0.");
  return {
    ...actorFields2(actor),
    amount,
    createdAt: now,
    date,
    id: `payment_${key.slice(0, 80)}`,
    idempotencyKey: key,
    method,
    note: cleanText(body.note, 600),
    source
  };
}
__name(paymentEvent, "paymentEvent");
var VALID_PAYMENT_METHODS = /* @__PURE__ */ new Set(["cash", "transfer", "qris", "other"]);
function cleanPaymentMethod(value) {
  const method = cleanText(value, 20).toLowerCase();
  if (!VALID_PAYMENT_METHODS.has(method)) {
    throw new HttpError(400, "invalid_payment_method", "Metode wajib cash, transfer, qris, atau other.");
  }
  return method;
}
__name(cleanPaymentMethod, "cleanPaymentMethod");
function validScheduleDate(value) {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
}
__name(validScheduleDate, "validScheduleDate");
function cleanOperationDate(value, now = (/* @__PURE__ */ new Date()).toISOString()) {
  if (value === void 0 || value === null || value === "") return now.slice(0, 10);
  const date = String(value);
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new HttpError(400, "invalid_date", "Tanggal operasi tidak valid.");
  const year = Number(match[1]);
  const parsed = /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
  if (year < 2e3 || year > 2100 || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, "invalid_date", "Tanggal operasi tidak valid.");
  }
  return date;
}
__name(cleanOperationDate, "cleanOperationDate");
async function recordPayment({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "payment", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const bookingDocument = await loadBooking(firestore, body.bookingId);
  const booking = { id: bookingDocument.id, ...bookingDocument.data };
  const before = financeSnapshot(booking);
  assertBookingOpen(before);
  const event = paymentEvent({ actor, body, key, source: cleanText(body.source || "admin-payment", 80) });
  if (event.amount > before.outstanding) {
    throw new HttpError(
      400,
      "amount_exceeds_outstanding",
      "Nominal pembayaran melebihi sisa invoice.",
      { outstanding: before.outstanding }
    );
  }
  const paymentHistory = [...before.paymentHistory, event];
  const nextBase = { ...booking, paymentHistory, total: before.total };
  const after = financeSnapshot(nextBase);
  const nextBooking = {
    ...financeProjection(nextBase, after, event.createdAt),
    dpAmount: after.status === "partial" ? after.netPaid : 0,
    lastPaymentAt: event.createdAt,
    lastPaymentMethod: event.method
  };
  const result = {
    booking: nextBooking,
    ledgerEventId: await stableDocumentId("ledger", `booking-payment:${booking.id}:${key}`),
    payment: event,
    snapshot: after
  };
  const writes = [
    firestore.setWrite("bookings", booking.id, nextBooking, { updateTime: bookingDocument.updateTime }),
    await ledgerWrite({ actor, booking, event, firestore, type: "booking-payment" })
  ];
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { booking: { collectionId: "bookings", documentId: booking.id } },
    firestore,
    key,
    result,
    receipt: { ledgerEventId: result.ledgerEventId },
    targetId: booking.id,
    type: "payment",
    writes
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(recordPayment, "recordPayment");
async function recordRefund({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "refund", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const bookingDocument = await loadBooking(firestore, body.bookingId);
  const booking = { id: bookingDocument.id, ...bookingDocument.data };
  const before = financeSnapshot(booking);
  const amount = cleanMoney(body.amount);
  const reason = cleanText(body.reason, 600);
  if (before.status === "void") throw new HttpError(409, "invoice_void", "Invoice void tidak dapat direfund.");
  if (!amount) throw new HttpError(400, "amount_required", "Nominal refund wajib lebih dari 0.");
  if (reason.length < 4) throw new HttpError(400, "reason_required", "Alasan refund minimal 4 karakter.");
  const refundable = Math.max(0, before.grossPaid - before.refunded);
  if (!refundable || amount > refundable) {
    throw new HttpError(400, "amount_exceeds_refundable", "Nominal melebihi saldo yang dapat direfund.", { refundable });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const event = {
    ...actorFields2(actor),
    amount,
    createdAt: now,
    date: cleanOperationDate(body.date, now),
    id: `refund_${key.slice(0, 80)}`,
    idempotencyKey: key,
    method: cleanPaymentMethod(body.method),
    reason,
    source: cleanText(body.source || "admin-refund", 80)
  };
  const nextBase = {
    ...booking,
    paymentHistory: before.paymentHistory,
    refundHistory: [...before.refundHistory, event],
    total: before.total
  };
  const after = financeSnapshot(nextBase);
  const nextBooking = {
    ...financeProjection(nextBase, after, now),
    lastRefundAt: now,
    lastRefundMethod: event.method,
    lastRefundReason: reason,
    refundStatus: after.status === "refunded" ? "full" : "partial"
  };
  const result = {
    booking: nextBooking,
    ledgerEventId: await stableDocumentId("ledger", `booking-refund:${booking.id}:${key}`),
    refund: event,
    snapshot: after
  };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { booking: { collectionId: "bookings", documentId: booking.id } },
    firestore,
    key,
    result,
    receipt: { ledgerEventId: result.ledgerEventId },
    targetId: booking.id,
    type: "refund",
    writes: [
      firestore.setWrite("bookings", booking.id, nextBooking, { updateTime: bookingDocument.updateTime }),
      await ledgerWrite({ actor, booking, event, firestore, type: "booking-refund" })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(recordRefund, "recordRefund");
async function voidInvoice({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "invoice-void", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const bookingDocument = await loadBooking(firestore, body.bookingId);
  const booking = { id: bookingDocument.id, ...bookingDocument.data };
  const before = financeSnapshot(booking);
  const reason = cleanText(body.reason, 600);
  if (reason.length < 4) throw new HttpError(400, "reason_required", "Alasan void minimal 4 karakter.");
  if (before.status === "void") throw new HttpError(409, "already_void", "Invoice sudah void.");
  if (before.netPaid > 0) {
    throw new HttpError(
      409,
      "refund_required",
      "Invoice masih memiliki pembayaran bersih. Catat refund sebelum void.",
      { refundable: before.netPaid }
    );
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const nextBooking = {
    ...booking,
    invoiceAmount: 0,
    invoiceStatus: "void",
    paymentStatus: "void",
    paymentStatusCanonical: "void",
    updatedAt: now,
    voidReason: reason,
    voidedAt: now,
    voidedByName: actor.displayName,
    voidedByUid: actor.uid
  };
  const date = validScheduleDate(booking.date);
  const scheduleDay = date ? await firestore.getDocument("bookingScheduleDays", date) : null;
  const publicSlot = await firestore.getDocument("clientCalendarSlots", booking.id);
  const writes = [
    firestore.setWrite("bookings", booking.id, nextBooking, { updateTime: bookingDocument.updateTime })
  ];
  if (date) {
    writes.push(firestore.setWrite("bookingScheduleDays", date, {
      date,
      lastBookingId: booking.id,
      revision: Number(scheduleDay?.data?.revision || 0) + 1,
      updatedAt: now
    }, scheduleDay ? { updateTime: scheduleDay.updateTime } : { exists: false }));
  }
  if (publicSlot) {
    writes.push(firestore.deleteWrite("clientCalendarSlots", booking.id, {
      updateTime: publicSlot.updateTime
    }));
  }
  const result = { booking: nextBooking, reason, status: "void" };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { booking: { collectionId: "bookings", documentId: booking.id } },
    firestore,
    key,
    result,
    receipt: { reason, status: "void" },
    targetId: booking.id,
    type: "invoice-void",
    writes
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(voidInvoice, "voidInvoice");
async function reviewPaymentProof({ actor, body, firestore, proofId, request, decision }) {
  const type = decision === "approve" ? "payment-proof-approve" : "payment-proof-reject";
  const key = getIdempotencyKey(request, body, `${type}:${proofId}`);
  const existing = await readOperationResult(firestore, type, key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const proofDocument = await firestore.getDocument("paymentProofs", cleanText(proofId, 160));
  if (!proofDocument) throw new HttpError(404, "proof_not_found", "Bukti pembayaran tidak ditemukan.");
  const proof = { id: proofDocument.id, ...proofDocument.data };
  if (proof.status !== "pending") throw new HttpError(409, "proof_reviewed", "Bukti sudah direview dan bersifat read-only.");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const note = cleanText(body.note || body.reason, 600);
  if (decision === "reject") {
    if (note.length < 4) throw new HttpError(400, "reason_required", "Alasan penolakan minimal 4 karakter.");
    const nextProof2 = {
      ...proof,
      adminNote: note,
      reviewedAt: now,
      reviewedByName: actor.displayName,
      reviewedByUid: actor.uid,
      status: "rejected",
      updatedAt: now
    };
    const result2 = { proof: nextProof2 };
    const committed2 = await commitIdempotentOperation({
      actor,
      documentRefs: { proof: { collectionId: "paymentProofs", documentId: proof.id } },
      firestore,
      key,
      result: result2,
      receipt: {},
      targetId: proof.id,
      type,
      writes: [
        firestore.setWrite("paymentProofs", proof.id, nextProof2, { updateTime: proofDocument.updateTime })
      ]
    });
    return { ...committed2.result, duplicate: committed2.duplicate };
  }
  const bookingDocument = await loadBooking(firestore, proof.bookingId);
  const booking = { id: bookingDocument.id, ...bookingDocument.data };
  const before = financeSnapshot(booking);
  assertBookingOpen(before);
  if (!Object.prototype.hasOwnProperty.call(body, "amount")) {
    throw new HttpError(400, "amount_confirmation_required", "Konfirmasi nominal pembayaran wajib diisi.");
  }
  if (!Object.prototype.hasOwnProperty.call(body, "method")) {
    throw new HttpError(400, "method_confirmation_required", "Konfirmasi metode pembayaran wajib diisi.");
  }
  const event = paymentEvent({
    actor,
    body: {
      ...body,
      amount: body.amount,
      method: body.method,
      note: note || proof.clientNote || "Bukti pembayaran disetujui"
    },
    key,
    source: "payment-proof"
  });
  if (event.amount > before.outstanding) {
    throw new HttpError(400, "amount_exceeds_outstanding", "Nominal bukti melebihi sisa invoice.", { outstanding: before.outstanding });
  }
  const nextBase = {
    ...booking,
    paymentHistory: [...before.paymentHistory, event],
    total: before.total
  };
  const after = financeSnapshot(nextBase);
  const nextBooking = {
    ...financeProjection(nextBase, after, now),
    dpAmount: after.status === "partial" ? after.netPaid : 0,
    lastPaymentAt: event.createdAt,
    lastPaymentMethod: event.method
  };
  const nextProof = {
    ...proof,
    adminNote: note,
    approvedAmount: event.amount,
    approvedMethod: event.method,
    reviewedAt: now,
    reviewedByName: actor.displayName,
    reviewedByUid: actor.uid,
    status: "approved",
    updatedAt: now
  };
  const result = { booking: nextBooking, payment: event, proof: nextProof, snapshot: after };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      booking: { collectionId: "bookings", documentId: booking.id },
      proof: { collectionId: "paymentProofs", documentId: proof.id }
    },
    firestore,
    key,
    result,
    receipt: {},
    targetId: proof.id,
    type,
    writes: [
      firestore.setWrite("bookings", booking.id, nextBooking, { updateTime: bookingDocument.updateTime }),
      firestore.setWrite("paymentProofs", proof.id, nextProof, { updateTime: proofDocument.updateTime }),
      await ledgerWrite({ actor, booking, event, firestore, type: "booking-payment" })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(reviewPaymentProof, "reviewPaymentProof");

// src/lib/cloudinary.js
function configured(env) {
  return Boolean(
    String(env.CLOUDINARY_CLOUD_NAME || "").trim() && String(env.CLOUDINARY_API_KEY || "").trim() && String(env.CLOUDINARY_API_SECRET || "").trim()
  );
}
__name(configured, "configured");
function hex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(hex, "hex");
async function destroyCloudinaryImage(env, publicId) {
  const cleanPublicId = String(publicId || "").trim();
  if (!cleanPublicId) return { status: "not-linked" };
  if (!configured(env)) {
    throw new HttpError(
      503,
      "cloudinary_not_configured",
      "Cloudinary belum dikonfigurasi; metadata tetap dipertahankan."
    );
  }
  const timestamp = Math.floor(Date.now() / 1e3);
  const secret = String(env.CLOUDINARY_API_SECRET || "").trim();
  const signature = hex(await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(`public_id=${cleanPublicId}&timestamp=${timestamp}${secret}`)
  ));
  const body = new URLSearchParams({
    api_key: String(env.CLOUDINARY_API_KEY || "").trim(),
    public_id: cleanPublicId,
    signature,
    timestamp: String(timestamp)
  });
  const cloudName = encodeURIComponent(String(env.CLOUDINARY_CLOUD_NAME || "").trim());
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    body,
    method: "POST"
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !["ok", "not found"].includes(String(payload?.result || "").toLowerCase())) {
    throw new HttpError(
      502,
      "external_asset_delete_failed",
      "File eksternal belum terhapus; metadata tetap dipertahankan."
    );
  }
  return {
    publicId: cleanPublicId,
    status: String(payload.result || "").toLowerCase() === "ok" ? "deleted" : "already-missing"
  };
}
__name(destroyCloudinaryImage, "destroyCloudinaryImage");

// src/domain/gallery.js
function galleryPrefix(env) {
  return String(env.CLOUDINARY_GALLERY_PREFIX || "studio37/gallery/").trim();
}
__name(galleryPrefix, "galleryPrefix");
function assertOwnedGalleryAsset(env, publicId) {
  const cleanPublicId = cleanText(publicId, 500);
  const prefix = galleryPrefix(env);
  if (!cleanPublicId || !prefix || !cleanPublicId.startsWith(prefix) || cleanPublicId.includes("..")) {
    throw new HttpError(
      409,
      "gallery_asset_not_owned",
      "Asset tidak berada di folder Gallery 37 Studio dan tidak boleh dihapus."
    );
  }
  return cleanPublicId;
}
__name(assertOwnedGalleryAsset, "assertOwnedGalleryAsset");
function withoutDeleteClaim(item) {
  const clean = { ...item };
  delete clean.permanentDeleteKey;
  delete clean.permanentDeleteStartedAt;
  delete clean.permanentDeleteStatus;
  return clean;
}
__name(withoutDeleteClaim, "withoutDeleteClaim");
async function assertUniqueGalleryReference(firestore, itemId, publicId) {
  const references = await firestore.runQuery({
    from: [{ collectionId: "gallery" }],
    limit: 3,
    where: {
      fieldFilter: {
        field: { fieldPath: "publicId" },
        op: "EQUAL",
        value: { stringValue: publicId }
      }
    }
  });
  if (references.length !== 1 || references[0].id !== itemId) {
    throw new HttpError(
      409,
      "gallery_asset_reference_ambiguous",
      "Referensi asset Gallery tidak unik; permanent delete dihentikan."
    );
  }
}
__name(assertUniqueGalleryReference, "assertUniqueGalleryReference");
async function permanentlyDeleteGalleryItem({ actor, body, env, firestore, request }) {
  const itemId = cleanText(body.itemId, 160);
  const key = getIdempotencyKey(request, body, `gallery-delete:${itemId}`);
  const existing = await readOperationResult(firestore, "gallery-permanent-delete", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  if (!itemId) throw new HttpError(400, "item_required", "Gallery item wajib dipilih.");
  let itemDocument = await firestore.getDocument("gallery", itemId);
  if (!itemDocument) {
    return { duplicate: true, externalAsset: { status: "unknown" }, itemId, metadata: "already-missing" };
  }
  const item = itemDocument.data;
  if (item.isDeleted !== true) {
    throw new HttpError(409, "trash_required", "Pindahkan item ke Trash sebelum permanent delete.");
  }
  const publicId = assertOwnedGalleryAsset(env, item.publicId);
  await assertUniqueGalleryReference(firestore, itemId, publicId);
  if (item.permanentDeleteStatus === "deleting" && item.permanentDeleteKey !== key) {
    throw new HttpError(409, "gallery_delete_in_progress", "Item sedang diproses oleh operasi lain.");
  }
  if (item.permanentDeleteStatus !== "deleting") {
    const claim = {
      ...withoutDeleteClaim(item),
      permanentDeleteKey: key,
      permanentDeleteStartedAt: (/* @__PURE__ */ new Date()).toISOString(),
      permanentDeleteStatus: "deleting"
    };
    try {
      await firestore.commit([
        firestore.setWrite("gallery", itemId, claim, { updateTime: itemDocument.updateTime })
      ]);
    } catch (error) {
      if (error?.status !== 409 && error?.status !== 412) throw error;
    }
    itemDocument = await firestore.getDocument("gallery", itemId);
    if (!itemDocument) {
      return { duplicate: true, externalAsset: { status: "unknown" }, itemId, metadata: "already-missing" };
    }
    if (itemDocument.data.permanentDeleteStatus !== "deleting" || itemDocument.data.permanentDeleteKey !== key) {
      throw new HttpError(409, "gallery_delete_in_progress", "Item sedang diproses oleh operasi lain.");
    }
  }
  let externalAsset;
  try {
    externalAsset = await destroyCloudinaryImage(env, publicId);
  } catch (error) {
    await firestore.commit([
      firestore.setWrite(
        "gallery",
        itemId,
        withoutDeleteClaim(itemDocument.data),
        { updateTime: itemDocument.updateTime }
      )
    ]).catch(() => null);
    throw error;
  }
  const result = { externalAsset, itemId, metadata: "deleted" };
  const committed = await commitIdempotentOperation({
    actor,
    firestore,
    key,
    result,
    targetId: itemId,
    type: "gallery-permanent-delete",
    writes: [
      firestore.deleteWrite("gallery", itemId, { updateTime: itemDocument.updateTime })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(permanentlyDeleteGalleryItem, "permanentlyDeleteGalleryItem");

// src/domain/customerFollowUp.js
var FOLLOW_UP_STATUSES = Object.freeze(["open", "in_progress", "snoozed", "completed", "cancelled"]);
var FOLLOW_UP_OUTCOMES = Object.freeze(["connected", "no_answer", "rescheduled", "not_interested", "paid", "booked", "other"]);
var FOLLOW_UP_TEMPLATES = /* @__PURE__ */ new Set(["payment", "booking", "comeback"]);
var ALLOWED_TRANSITIONS = Object.freeze({
  open: ["in_progress", "snoozed", "completed", "cancelled"],
  in_progress: ["open", "snoozed", "completed", "cancelled"],
  snoozed: ["open", "in_progress", "completed", "cancelled"],
  completed: [],
  cancelled: []
});
var CHANGE_FIELDS = Object.freeze(["status", "dueAt", "dueTime", "assignedToUid", "assignedToName", "outcome", "notes", "description"]);
function boundedText(value, label, maxLength, { required = false, minLength = 0, code = "follow_up_invalid_input" } = {}) {
  const text = String(value ?? "").trim();
  if (required && text.length < minLength) {
    throw new HttpError(400, code, label + " wajib diisi" + (minLength > 1 ? " minimal " + minLength + " karakter." : "."));
  }
  if (text.length > maxLength) {
    throw new HttpError(400, code, label + " maksimal " + maxLength + " karakter.");
  }
  return text;
}
__name(boundedText, "boundedText");
function validateFollowUpDueAt(value) {
  const dueAt = boundedText(value, "Tanggal follow-up", 10, {
    code: "follow_up_due_invalid",
    minLength: 10,
    required: true
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) {
    throw new HttpError(400, "follow_up_due_invalid", "Tanggal follow-up wajib menggunakan format YYYY-MM-DD.");
  }
  const parsed = /* @__PURE__ */ new Date(dueAt + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueAt) {
    throw new HttpError(400, "follow_up_due_invalid", "Tanggal follow-up tidak valid.");
  }
  return dueAt;
}
__name(validateFollowUpDueAt, "validateFollowUpDueAt");
function validateFollowUpDueTime(value) {
  const dueTime = boundedText(value, "Waktu follow-up", 5);
  if (dueTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) {
    throw new HttpError(400, "follow_up_time_invalid", "Waktu follow-up harus menggunakan format 24 jam HH:mm.");
  }
  return dueTime;
}
__name(validateFollowUpDueTime, "validateFollowUpDueTime");
function businessDate(now = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric"
  }).format(now);
}
__name(businessDate, "businessDate");
function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  if (digits.startsWith("8")) digits = "62" + digits;
  return digits;
}
__name(normalizePhone, "normalizePhone");
function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
__name(hashString, "hashString");
function slugName(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "customer";
}
__name(slugName, "slugName");
function fallbackCustomerId(phone, name) {
  return "cust_" + hashString((normalizePhone(phone) || "no-phone") + "|" + slugName(name) + "|");
}
__name(fallbackCustomerId, "fallbackCustomerId");
function customerSnapshot(data = {}) {
  return {
    customerName: boundedText(data.name || data.customer || data.displayName, "Nama customer", 160, {
      code: "customer_identity_invalid",
      minLength: 1,
      required: true
    }),
    customerPhone: boundedText(data.phone || data.phoneNumber || data.customerPhoneKey, "Nomor customer", 40)
  };
}
__name(customerSnapshot, "customerSnapshot");
async function resolveFollowUpCustomer({ body, firestore }) {
  const customerId = boundedText(body.customerId, "Customer", 160, {
    code: "customer_required",
    minLength: 1,
    required: true
  });
  const customerDocument = await firestore.getDocument("customers", customerId);
  if (customerDocument) {
    return {
      ...customerSnapshot(customerDocument.data),
      customerId,
      sourceId: customerId,
      sourceType: "customer"
    };
  }
  if (customerId.startsWith("auth_")) {
    const uid = customerId.slice(5);
    const userDocument = uid ? await firestore.getDocument("users", uid) : null;
    const user = userDocument?.data;
    if (!user || user.role !== "client" || user.status !== "active") {
      throw new HttpError(404, "customer_not_found", "Identitas client tidak ditemukan atau sudah tidak aktif.");
    }
    return {
      ...customerSnapshot(user),
      customerId,
      sourceId: uid,
      sourceType: "client_account"
    };
  }
  const bookingId = boundedText(body.bookingId, "Referensi booking", 160, {
    code: "customer_reference_required",
    minLength: 1,
    required: true
  });
  const bookingDocument = await firestore.getDocument("bookings", bookingId);
  if (!bookingDocument) {
    throw new HttpError(404, "customer_source_not_found", "Booking sumber customer tidak ditemukan.");
  }
  const booking = bookingDocument.data || {};
  const snapshot = customerSnapshot(booking);
  const sourceCustomerId = boundedText(
    booking.customerId || fallbackCustomerId(booking.phone || booking.customerPhoneKey, snapshot.customerName),
    "Referensi customer booking",
    160
  );
  if (sourceCustomerId !== customerId) {
    throw new HttpError(404, "customer_reference_mismatch", "Booking sumber tidak cocok dengan customer yang dipilih.");
  }
  return {
    ...snapshot,
    customerId,
    sourceId: bookingId,
    sourceType: "booking"
  };
}
__name(resolveFollowUpCustomer, "resolveFollowUpCustomer");
function isEligibleAssignee(user) {
  if (!user || user.status !== "approved") return false;
  if (user.role === "owner") return true;
  return user.role === "admin" && user.permissions?.customers === true;
}
__name(isEligibleAssignee, "isEligibleAssignee");
async function resolveFollowUpAssignee(firestore, uid) {
  const assigneeUid = boundedText(uid, "PIC", 128, {
    code: "follow_up_assignee_required",
    minLength: 1,
    required: true
  });
  const userDocument = await firestore.getDocument("users", assigneeUid);
  if (!isEligibleAssignee(userDocument?.data)) {
    throw new HttpError(400, "follow_up_assignee_invalid", "PIC harus merupakan Owner atau Admin aktif dengan akses Customer.");
  }
  return {
    assignedToUid: assigneeUid,
    assignedToName: boundedText(userDocument.data.displayName || userDocument.data.email, "Nama PIC", 120, {
      code: "follow_up_assignee_invalid",
      minLength: 1,
      required: true
    })
  };
}
__name(resolveFollowUpAssignee, "resolveFollowUpAssignee");
async function listCustomerFollowUpAssignees({ actor, firestore }) {
  const rows = await firestore.runQuery({
    from: [{ collectionId: "users" }],
    limit: 100,
    where: {
      fieldFilter: {
        field: { fieldPath: "role" },
        op: "IN",
        value: {
          arrayValue: {
            values: [{ stringValue: "owner" }, { stringValue: "admin" }]
          }
        }
      }
    }
  });
  const assignees = rows.filter((row) => isEligibleAssignee(row.data)).map((row) => ({
    uid: row.id,
    displayName: boundedText(row.data.displayName || row.data.email, "Nama PIC", 120) || "Admin",
    role: row.data.role
  })).sort((first, second) => first.displayName.localeCompare(second.displayName, "id"));
  if (!assignees.some((item) => item.uid === actor.uid)) {
    const current = await firestore.getDocument("users", actor.uid);
    if (isEligibleAssignee(current?.data)) {
      assignees.push({
        uid: actor.uid,
        displayName: boundedText(current.data.displayName || actor.displayName, "Nama PIC", 120) || "Admin",
        role: current.data.role
      });
    }
  }
  return {
    assignees,
    currentActorUid: actor.uid
  };
}
__name(listCustomerFollowUpAssignees, "listCustomerFollowUpAssignees");
function makeChanges(before, after) {
  return CHANGE_FIELDS.reduce((changes, field) => {
    const previous = before?.[field] ?? "";
    const next = after?.[field] ?? "";
    if (previous !== next) changes[field] = { before: previous, after: next };
    return changes;
  }, {});
}
__name(makeChanges, "makeChanges");
function eventFor(task, action, actor, now, details = {}) {
  return {
    ...details,
    action,
    actorUid: actor.uid,
    actorName: actor.displayName,
    changes: details.changes || {},
    createdAt: now,
    customerId: task.customerId,
    id: details.id,
    taskId: task.id
  };
}
__name(eventFor, "eventFor");
function validateOutcome(value) {
  const outcome = boundedText(value, "Outcome", 40);
  if (outcome && !FOLLOW_UP_OUTCOMES.includes(outcome)) {
    throw new HttpError(400, "follow_up_outcome_invalid", "Hasil follow-up tidak valid.");
  }
  return outcome;
}
__name(validateOutcome, "validateOutcome");
function validateStatus(value) {
  const status = boundedText(value, "Status", 40, {
    code: "follow_up_status_invalid",
    minLength: 1,
    required: true
  });
  if (!FOLLOW_UP_STATUSES.includes(status)) {
    throw new HttpError(400, "follow_up_status_invalid", "Status follow-up tidak valid.");
  }
  return status;
}
__name(validateStatus, "validateStatus");
async function createCustomerFollowUpTask({ actor, body, firestore, request, now = /* @__PURE__ */ new Date() }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "customer-follow-up-create", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const customer = await resolveFollowUpCustomer({ body, firestore });
  const assignee = await resolveFollowUpAssignee(firestore, body.assignedToUid || actor.uid);
  const title = boundedText(body.title, "Judul task", 160, {
    code: "follow_up_title_required",
    minLength: 3,
    required: true
  });
  const description = boundedText(body.description, "Deskripsi", 1200);
  const notes = boundedText(body.notes, "Catatan", 1200);
  const dueAt = validateFollowUpDueAt(body.dueAt);
  const dueTime = validateFollowUpDueTime(body.dueTime);
  const templateKey = boundedText(body.templateKey || "payment", "Template", 40, {
    code: "follow_up_template_invalid",
    minLength: 1,
    required: true
  });
  if (!FOLLOW_UP_TEMPLATES.has(templateKey)) {
    throw new HttpError(400, "follow_up_template_invalid", "Template follow-up tidak dikenal.");
  }
  const timestamp = now.toISOString();
  const id = await stableDocumentId("follow-up", key);
  const task = {
    ...customer,
    ...assignee,
    bookingId: customer.sourceType === "booking" ? customer.sourceId : "",
    id,
    title,
    description,
    templateKey,
    status: "open",
    outcome: "",
    dueAt,
    dueTime,
    notes,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByUid: actor.uid,
    createdByName: actor.displayName,
    lastContactedAt: "",
    completedAt: "",
    completedByUid: "",
    completedByName: "",
    cancelledAt: "",
    cancelledByUid: "",
    cancelReason: ""
  };
  const eventId = await stableDocumentId("follow-up-event", id + ":created");
  const event = eventFor(task, "created", actor, timestamp, {
    id: eventId,
    note: title,
    changes: {
      status: { before: "", after: "open" },
      dueAt: { before: "", after: dueAt },
      dueTime: { before: "", after: dueTime },
      assignedToUid: { before: "", after: assignee.assignedToUid },
      assignedToName: { before: "", after: assignee.assignedToName }
    }
  });
  const result = { task, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      task: { collectionId: "customerFollowUpTasks", documentId: id },
      event: { collectionId: "customerFollowUpEvents", documentId: eventId }
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: "customer-follow-up-create",
    writes: [
      firestore.setWrite("customerFollowUpTasks", id, task, { exists: false }),
      firestore.setWrite("customerFollowUpEvents", eventId, event, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(createCustomerFollowUpTask, "createCustomerFollowUpTask");
async function updateCustomerFollowUpTask({ actor, body, firestore, request, now = /* @__PURE__ */ new Date() }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "customer-follow-up-update", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const id = boundedText(body.taskId || body.id, "Task", 160, {
    code: "follow_up_not_found",
    minLength: 1,
    required: true
  });
  const currentDocument = await firestore.getDocument("customerFollowUpTasks", id);
  if (!currentDocument) throw new HttpError(404, "follow_up_not_found", "Task follow-up tidak ditemukan.");
  const current = { id: currentDocument.id, ...currentDocument.data };
  const expectedUpdatedAt = boundedText(body.expectedUpdatedAt, "Revision task", 40, {
    code: "follow_up_revision_required",
    minLength: 1,
    required: true
  });
  if (expectedUpdatedAt !== current.updatedAt) {
    throw new HttpError(409, "follow_up_changed", "Task berubah. Muat ulang sebelum menyimpan.");
  }
  const action = boundedText(body.action, "Aksi", 40);
  const reopening = action === "reopen";
  const cancelling = action === "cancel";
  const reason = boundedText(body.reason || body.note, "Alasan", 600);
  let status = reopening ? "open" : validateStatus(body.status || current.status);
  if (reopening) {
    if (!["completed", "cancelled"].includes(current.status)) {
      throw new HttpError(409, "follow_up_transition_invalid", "Hanya task selesai atau dibatalkan yang dapat dibuka kembali.");
    }
    if (reason.length < 4) {
      throw new HttpError(400, "follow_up_reopen_reason_required", "Alasan membuka kembali task minimal 4 karakter.");
    }
  } else {
    if (["completed", "cancelled"].includes(current.status)) {
      throw new HttpError(409, "follow_up_closed", "Task sudah ditutup. Gunakan aksi buka kembali dengan alasan.");
    }
    if (status !== current.status && !ALLOWED_TRANSITIONS[current.status]?.includes(status)) {
      throw new HttpError(409, "follow_up_transition_invalid", "Perubahan status follow-up tidak diizinkan.");
    }
  }
  if (cancelling || status === "cancelled") {
    if (reason.length < 4) {
      throw new HttpError(400, "follow_up_cancel_reason_required", "Alasan pembatalan minimal 4 karakter.");
    }
    status = "cancelled";
  }
  const dueAt = Object.hasOwn(body, "dueAt") ? validateFollowUpDueAt(body.dueAt) : current.dueAt;
  const dueTime = Object.hasOwn(body, "dueTime") ? validateFollowUpDueTime(body.dueTime) : current.dueTime || "";
  if (status === "snoozed" && dueAt <= businessDate(now)) {
    throw new HttpError(400, "follow_up_snooze_date_future_required", "Tanggal snooze harus setelah hari ini menurut WIB.");
  }
  const outcome = reopening ? "" : Object.hasOwn(body, "outcome") ? validateOutcome(body.outcome) : current.outcome;
  if (status === "completed" && !outcome) {
    throw new HttpError(400, "follow_up_outcome_required", "Pilih hasil follow-up sebelum menyelesaikan task.");
  }
  if (body.contacted === true && !outcome) {
    throw new HttpError(400, "follow_up_outcome_required", "Catat outcome komunikasi sebelum menandai sudah dihubungi.");
  }
  const assignee = Object.hasOwn(body, "assignedToUid") ? await resolveFollowUpAssignee(firestore, body.assignedToUid) : { assignedToUid: current.assignedToUid, assignedToName: current.assignedToName };
  const notes = Object.hasOwn(body, "notes") || Object.hasOwn(body, "note") ? boundedText(Object.hasOwn(body, "notes") ? body.notes : body.note, "Catatan", 1200) : current.notes;
  const description = Object.hasOwn(body, "description") ? boundedText(body.description, "Deskripsi", 1200) : current.description;
  const timestamp = now.toISOString();
  const next = {
    ...current,
    ...assignee,
    status,
    outcome,
    dueAt,
    dueTime,
    notes,
    description,
    revision: Number(current.revision || 0) + 1,
    updatedAt: timestamp,
    ...body.contacted === true ? { lastContactedAt: timestamp } : {},
    ...status === "completed" ? {
      completedAt: timestamp,
      completedByUid: actor.uid,
      completedByName: actor.displayName
    } : {},
    ...status === "cancelled" ? {
      cancelledAt: timestamp,
      cancelledByUid: actor.uid,
      cancelReason: reason
    } : {},
    ...reopening ? {
      lastCompletedAt: current.completedAt || current.lastCompletedAt || "",
      completedAt: "",
      completedByUid: "",
      completedByName: "",
      lastCancelledAt: current.cancelledAt || "",
      cancelledAt: "",
      cancelledByUid: "",
      cancelReason: "",
      reopenedAt: timestamp,
      reopenedByUid: actor.uid,
      reopenedByName: actor.displayName,
      reopenReason: reason
    } : {},
    ...status === "snoozed" ? { snoozedAt: timestamp, snoozedByUid: actor.uid } : {}
  };
  const changes = makeChanges(current, next);
  if (!Object.keys(changes).length && !body.contacted) {
    throw new HttpError(400, "follow_up_no_changes", "Tidak ada perubahan untuk disimpan.");
  }
  const eventId = await stableDocumentId("follow-up-event", id + ":" + key);
  const eventAction = reopening ? "reopened" : status === "cancelled" ? "cancelled" : status === "completed" ? "completed" : status === "snoozed" ? "snoozed" : changes.assignedToUid ? "reassigned" : changes.dueAt ? "rescheduled" : body.contacted === true ? "contacted" : changes.status ? status : "updated";
  const event = eventFor(next, eventAction, actor, timestamp, {
    id: eventId,
    fromStatus: current.status,
    toStatus: status,
    outcome,
    dueAt,
    reason: cancelling || reopening ? reason : "",
    note: reason || boundedText(body.note, "Catatan aktivitas", 1200),
    changes
  });
  const result = { task: next, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      task: { collectionId: "customerFollowUpTasks", documentId: id },
      event: { collectionId: "customerFollowUpEvents", documentId: eventId }
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: "customer-follow-up-update",
    writes: [
      firestore.setWrite("customerFollowUpTasks", id, next, { updateTime: currentDocument.updateTime }),
      firestore.setWrite("customerFollowUpEvents", eventId, event, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(updateCustomerFollowUpTask, "updateCustomerFollowUpTask");
async function cancelCustomerFollowUpTask({ actor, body, firestore, request, now = /* @__PURE__ */ new Date() }) {
  return updateCustomerFollowUpTask({
    actor,
    body: { ...body, action: "cancel", status: "cancelled" },
    firestore,
    request,
    now
  });
}
__name(cancelCustomerFollowUpTask, "cancelCustomerFollowUpTask");

// src/domain/inventory.js
function finiteQuantity(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, "invalid_quantity", `${label} tidak valid.`);
  }
  return Math.round(parsed * 1e3) / 1e3;
}
__name(finiteQuantity, "finiteQuantity");
async function assertNoActiveMaintenance(firestore, itemId, message) {
  const rows = await firestore.runQuery({
    from: [{ collectionId: "maintenanceWorkOrders" }],
    limit: 500,
    where: {
      fieldFilter: {
        field: { fieldPath: "inventoryItemId" },
        op: "EQUAL",
        value: { stringValue: itemId }
      }
    }
  });
  const active = rows.find((row) => [
    "reported",
    "triaged",
    "approved",
    "assigned",
    "in_progress",
    "waiting_parts",
    "completed"
  ].includes(String(row.data?.status || "")));
  if (active) throw new HttpError(409, "equipment_maintenance_locked", message);
}
__name(assertNoActiveMaintenance, "assertNoActiveMaintenance");
function normalizeInventoryMetadata(body, current = {}) {
  const name = cleanText(body.name, 160);
  const category = cleanText(body.category, 80);
  const itemType = cleanText(body.type, 40);
  const unit = cleanText(body.unit, 40);
  const condition = cleanText(body.condition, 40);
  const status = cleanText(body.status, 40);
  const location = cleanText(body.location, 240);
  const note = cleanText(body.note, 2e3);
  const minStock = finiteQuantity(body.minStock, "Minimal stok");
  if (!name || !category || !itemType || !unit || !condition || !status) {
    throw new HttpError(400, "invalid_item", "Nama, kategori, tipe, satuan, kondisi, dan status wajib diisi.");
  }
  if (minStock < 0 || minStock > 1e6) {
    throw new HttpError(400, "invalid_min_stock", "Minimal stok berada di luar batas operasional.");
  }
  return { ...current, category, condition, location, minStock, name, note, status, type: itemType, unit };
}
__name(normalizeInventoryMetadata, "normalizeInventoryMetadata");
async function saveInventoryItem({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const isCreate = body.action === "create";
  const itemId = cleanText(body.itemId, 160);
  const type = isCreate ? "inventory-item-create" : "inventory-item-update";
  if (!isCreate && !itemId) throw new HttpError(400, "item_required", "Inventory item wajib dipilih.");
  if (isCreate && itemId) throw new HttpError(400, "invalid_item_id", "ID item baru dibuat oleh server.");
  const existing = await readOperationResult(firestore, type, key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const itemDocument = isCreate ? null : await firestore.getDocument("inventoryItems", itemId);
  if (!isCreate && !itemDocument) throw new HttpError(404, "item_not_found", "Inventory item tidak ditemukan.");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const id = isCreate ? await stableDocumentId("inventory", key) : itemId;
  const current = itemDocument ? { id: itemDocument.id, ...itemDocument.data } : {};
  const metadata = normalizeInventoryMetadata(body, current);
  if (!isCreate && (metadata.status !== current.status || metadata.condition !== current.condition)) {
    await assertNoActiveMaintenance(
      firestore,
      itemId,
      "Status/kondisi equipment dikunci selama work order belum Verified atau Cancelled."
    );
  }
  const quantity = isCreate ? finiteQuantity(body.quantity, "Stok awal") : finiteQuantity(current.quantity || 0, "Stok saat ini");
  if (quantity < 0 || quantity > 1e6) throw new HttpError(400, "invalid_quantity", "Stok berada di luar batas operasional.");
  if (!isCreate && body.quantity !== void 0 && Number(body.quantity) !== quantity) {
    throw new HttpError(400, "stock_write_forbidden", "Perubahan jumlah stok harus memakai adjustment inventory.");
  }
  const item = { ...metadata, createdAt: isCreate ? now : current.createdAt, id, quantity, updatedAt: now };
  const movementId = await stableDocumentId("movement", id + ":" + key);
  const reason = cleanText(body.reason, 600) || (isCreate ? "Item baru ditambahkan" : "Metadata inventory diperbarui");
  const movement = {
    actorName: actor.displayName,
    actorUid: actor.uid,
    createdAt: now,
    id: movementId,
    itemId: id,
    itemName: item.name,
    nextQuantity: quantity,
    note: reason,
    previousQuantity: isCreate ? 0 : quantity,
    quantity: isCreate ? quantity : 0,
    reason,
    type: isCreate ? "create" : "edit",
    unit: item.unit,
    metadataSnapshot: { category: item.category, condition: item.condition, location: item.location, minStock: item.minStock, name: item.name, note: item.note, status: item.status, type: item.type, unit: item.unit }
  };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { item: { collectionId: "inventoryItems", documentId: id }, movement: { collectionId: "inventoryMovements", documentId: movementId } },
    firestore,
    key,
    receipt: {},
    result: { item, movement },
    targetId: id,
    type,
    writes: [
      firestore.setWrite("inventoryItems", id, item, isCreate ? { exists: false } : { updateTime: itemDocument.updateTime }),
      firestore.setWrite("inventoryMovements", movementId, movement, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(saveInventoryItem, "saveInventoryItem");
async function archiveInventoryItem({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const itemId = cleanText(body.itemId, 160);
  if (!itemId) throw new HttpError(400, "item_required", "Inventory item wajib dipilih.");
  const type = "inventory-item-archive";
  const existing = await readOperationResult(firestore, type, key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const itemDocument = await firestore.getDocument("inventoryItems", itemId);
  if (!itemDocument) throw new HttpError(404, "item_not_found", "Inventory item tidak ditemukan.");
  const current = { id: itemDocument.id, ...itemDocument.data };
  await assertNoActiveMaintenance(firestore, itemId, "Equipment dengan work order aktif tidak dapat diarsipkan.");
  if (current.status === "inactive") throw new HttpError(409, "already_archived", "Item sudah dinonaktifkan.");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const item = { ...current, status: "inactive", updatedAt: now };
  const movementId = await stableDocumentId("movement", itemId + ":" + key);
  const movement = {
    actorName: actor.displayName,
    actorUid: actor.uid,
    createdAt: now,
    id: movementId,
    itemId,
    itemName: cleanText(item.name, 160),
    nextQuantity: Number(item.quantity || 0),
    note: "Item dinonaktifkan",
    previousQuantity: Number(item.quantity || 0),
    quantity: 0,
    reason: "Item dinonaktifkan",
    type: "inactive",
    unit: cleanText(item.unit, 40),
    previousMetadata: { status: current.status, condition: current.condition },
    nextMetadata: { status: "inactive", condition: current.condition }
  };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { item: { collectionId: "inventoryItems", documentId: itemId }, movement: { collectionId: "inventoryMovements", documentId: movementId } },
    firestore,
    key,
    receipt: {},
    result: { item, movement },
    targetId: itemId,
    type,
    writes: [
      firestore.setWrite("inventoryItems", itemId, item, { updateTime: itemDocument.updateTime }),
      firestore.setWrite("inventoryMovements", movementId, movement, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(archiveInventoryItem, "archiveInventoryItem");
async function adjustInventory({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "inventory-adjust", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const itemId = cleanText(body.itemId, 160);
  const reason = cleanText(body.reason || body.note, 600);
  const delta = finiteQuantity(body.delta, "Perubahan stok");
  if (!itemId) throw new HttpError(400, "item_required", "Inventory item wajib dipilih.");
  if (!delta) throw new HttpError(400, "delta_required", "Perubahan stok tidak boleh nol.");
  if (reason.length < 4) {
    throw new HttpError(400, "reason_required", "Alasan adjustment minimal 4 karakter.");
  }
  const itemDocument = await firestore.getDocument("inventoryItems", itemId);
  if (!itemDocument) throw new HttpError(404, "item_not_found", "Inventory item tidak ditemukan.");
  const item = { id: itemDocument.id, ...itemDocument.data };
  const previousQuantity = finiteQuantity(item.quantity || 0, "Stok saat ini");
  const nextQuantity = finiteQuantity(previousQuantity + delta, "Stok hasil");
  if (nextQuantity < 0) {
    throw new HttpError(
      400,
      "negative_stock",
      "Adjustment ditolak karena stok akan menjadi negatif.",
      { available: previousQuantity }
    );
  }
  if (nextQuantity > 1e6) {
    throw new HttpError(400, "stock_limit", "Stok hasil melebihi batas operasional.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const movementId = await stableDocumentId("movement", `${itemId}:${key}`);
  const movement = {
    actorName: actor.displayName,
    actorUid: actor.uid,
    adjustmentKey: key,
    createdAt: now,
    id: movementId,
    itemId,
    itemName: cleanText(item.name || "Inventory Item", 160),
    nextQuantity,
    note: reason,
    previousQuantity,
    quantity: Math.abs(delta),
    reason,
    type: delta > 0 ? "stock-in" : "stock-out",
    unit: cleanText(item.unit || "pcs", 40)
  };
  const nextItem = { ...item, quantity: nextQuantity, updatedAt: now };
  const result = { item: nextItem, movement };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      item: { collectionId: "inventoryItems", documentId: itemId },
      movement: { collectionId: "inventoryMovements", documentId: movementId }
    },
    firestore,
    key,
    result,
    receipt: {},
    targetId: itemId,
    type: "inventory-adjust",
    writes: [
      firestore.setWrite("inventoryItems", itemId, nextItem, { updateTime: itemDocument.updateTime }),
      firestore.setWrite("inventoryMovements", movementId, movement, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(adjustInventory, "adjustInventory");
var PURCHASE_ORDER_STATUSES = Object.freeze([
  "draft",
  "submitted",
  "approved",
  "ordered",
  "partially_received",
  "received",
  "cancelled"
]);
function procurementDate(value, label, { optional = false } = {}) {
  const date = String(value ?? "").trim();
  if (!date && optional) return "";
  if (date.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, "procurement_date_invalid", label + " harus menggunakan format YYYY-MM-DD.");
  }
  const parsed = /* @__PURE__ */ new Date(date + "T00:00:00.000Z");
  const year = Number(date.slice(0, 4));
  if (year < 2e3 || year > 2100 || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, "procurement_date_invalid", label + " bukan tanggal kalender yang valid.");
  }
  return date;
}
__name(procurementDate, "procurementDate");
function procurementAmount(value, label, { allowZero = false } = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount > 1e12 || (allowZero ? amount < 0 : amount <= 0)) {
    throw new HttpError(400, "procurement_amount_invalid", label + " tidak valid.");
  }
  const rounded = Math.round(amount);
  if (!Number.isSafeInteger(rounded)) {
    throw new HttpError(400, "procurement_amount_invalid", label + " melebihi batas angka yang aman.");
  }
  return rounded;
}
__name(procurementAmount, "procurementAmount");
function summarizePurchaseOrderStatus(items) {
  const hasReceived = items.some((item) => Number(item.receivedQuantity || 0) > 0);
  const allReceived = items.length > 0 && items.every(
    (item) => Number(item.receivedQuantity || 0) >= Number(item.quantity || 0)
  );
  if (allReceived) return "received";
  return hasReceived ? "partially_received" : "ordered";
}
__name(summarizePurchaseOrderStatus, "summarizePurchaseOrderStatus");
async function normalizePurchaseOrderItems(input, firestore) {
  if (!Array.isArray(input) || !input.length || input.length > 100) {
    throw new HttpError(400, "po_items_required", "Purchase order harus memiliki 1 sampai 100 item.");
  }
  const seenInventoryIds = /* @__PURE__ */ new Set();
  const seenLineIds = /* @__PURE__ */ new Set();
  const items = [];
  for (const raw of input) {
    const inventoryItemId = cleanText(raw?.inventoryItemId, 160);
    const quantity = finiteQuantity(raw?.quantity, "Jumlah pesanan");
    const unitPrice = procurementAmount(raw?.unitPrice, "Harga satuan");
    if (!inventoryItemId || quantity <= 0) {
      throw new HttpError(400, "po_item_invalid", "Setiap baris PO wajib memilih item inventory dan jumlah positif.");
    }
    if (seenInventoryIds.has(inventoryItemId)) {
      throw new HttpError(400, "po_duplicate_inventory_item", "Setiap item inventory hanya boleh muncul satu kali dalam PO.");
    }
    seenInventoryIds.add(inventoryItemId);
    const inventoryDocument = await firestore.getDocument("inventoryItems", inventoryItemId);
    if (!inventoryDocument || inventoryDocument.data.status === "inactive") {
      throw new HttpError(404, "po_inventory_item_unavailable", "Item inventory tidak ditemukan atau sudah dinonaktifkan.");
    }
    const lineId = cleanText(raw?.lineId, 80) || crypto.randomUUID();
    if (seenLineIds.has(lineId)) {
      throw new HttpError(400, "po_duplicate_line_id", "ID baris PO tidak boleh duplikat.");
    }
    seenLineIds.add(lineId);
    const lineTotal = Math.round(quantity * unitPrice);
    if (!Number.isSafeInteger(lineTotal) || lineTotal <= 0) {
      throw new HttpError(400, "po_line_total_invalid", "Total harga baris PO tidak valid.");
    }
    const inventoryItem = inventoryDocument.data;
    items.push({
      lineId,
      inventoryItemId,
      name: cleanText(inventoryItem.name, 160),
      category: cleanText(inventoryItem.category, 80),
      quantity,
      receivedQuantity: 0,
      unit: cleanText(inventoryItem.unit, 40) || "pcs",
      unitPrice,
      lineTotal
    });
  }
  return items;
}
__name(normalizePurchaseOrderItems, "normalizePurchaseOrderItems");
async function createSupplier({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "supplier-create", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const name = cleanText(body.name, 160);
  const phone = cleanText(body.phone, 40);
  const email = cleanText(body.email, 160).toLowerCase();
  if (name.length < 2) {
    throw new HttpError(400, "supplier_name_required", "Nama supplier minimal 2 karakter.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "supplier_email_invalid", "Format email supplier belum valid.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const id = await stableDocumentId("supplier", key);
  const supplier = {
    id,
    name,
    contactName: cleanText(body.contactName, 120),
    phone,
    email,
    address: cleanText(body.address, 500),
    notes: cleanText(body.notes, 1e3),
    status: "active",
    createdAt: now,
    updatedAt: now,
    createdByUid: actor.uid,
    createdByName: actor.displayName
  };
  const eventId = await stableDocumentId("procurement-event", id + ":created");
  const event = {
    id: eventId,
    entityType: "supplier",
    entityId: id,
    action: "created",
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now
  };
  const result = { supplier, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      supplier: { collectionId: "suppliers", documentId: id },
      event: { collectionId: "procurementEvents", documentId: eventId }
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: "supplier-create",
    writes: [
      firestore.setWrite("suppliers", id, supplier, { exists: false }),
      firestore.setWrite("procurementEvents", eventId, event, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(createSupplier, "createSupplier");
async function createPurchaseOrder({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "purchase-order-create", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const supplierId = cleanText(body.supplierId, 160);
  if (!supplierId) throw new HttpError(400, "supplier_required", "Supplier wajib dipilih.");
  const supplierDocument = await firestore.getDocument("suppliers", supplierId);
  if (!supplierDocument || supplierDocument.data.status !== "active") {
    throw new HttpError(404, "supplier_not_found", "Supplier aktif tidak ditemukan.");
  }
  const items = await normalizePurchaseOrderItems(body.items, firestore);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const orderDate = procurementDate(body.orderDate || now.slice(0, 10), "Tanggal PO");
  const expectedAt = procurementDate(body.expectedAt, "Estimasi barang datang", { optional: true });
  if (expectedAt && expectedAt < orderDate) {
    throw new HttpError(400, "po_expected_date_invalid", "Estimasi barang datang tidak boleh sebelum tanggal PO.");
  }
  const id = await stableDocumentId("purchase-order", key);
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0 || totalAmount > 1e12) {
    throw new HttpError(400, "po_total_invalid", "Total purchase order di luar batas operasional.");
  }
  const purchaseOrder = {
    id,
    poNumber: "PO-" + orderDate.replaceAll("-", "") + "-" + id.slice(-8).toUpperCase(),
    supplierId,
    supplierName: cleanText(supplierDocument.data.name, 160),
    items,
    totalAmount,
    paidAmount: 0,
    status: "draft",
    orderDate,
    expectedAt,
    notes: cleanText(body.notes, 1200),
    createdAt: now,
    updatedAt: now,
    createdByUid: actor.uid,
    createdByName: actor.displayName
  };
  const eventId = await stableDocumentId("procurement-event", id + ":created");
  const event = {
    id: eventId,
    entityType: "purchase_order",
    entityId: id,
    action: "created",
    fromStatus: "",
    toStatus: "draft",
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now,
    amount: totalAmount
  };
  const result = { purchaseOrder, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      purchaseOrder: { collectionId: "purchaseOrders", documentId: id },
      event: { collectionId: "procurementEvents", documentId: eventId }
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: "purchase-order-create",
    writes: [
      firestore.setWrite("purchaseOrders", id, purchaseOrder, { exists: false }),
      firestore.setWrite("procurementEvents", eventId, event, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(createPurchaseOrder, "createPurchaseOrder");
async function transitionPurchaseOrder({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "purchase-order-transition", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const id = cleanText(body.purchaseOrderId, 160);
  if (!id) throw new HttpError(400, "purchase_order_required", "Purchase order wajib dipilih.");
  const current = await firestore.getDocument("purchaseOrders", id);
  if (!current) throw new HttpError(404, "purchase_order_not_found", "Purchase order tidak ditemukan.");
  const po = { id: current.id, ...current.data };
  const expectedUpdatedAt = cleanText(body.expectedUpdatedAt, 40);
  if (!expectedUpdatedAt || expectedUpdatedAt !== po.updatedAt) {
    throw new HttpError(409, "purchase_order_changed", "PO berubah. Muat ulang sebelum menyimpan.");
  }
  const status = cleanText(body.status, 40);
  const transitions = {
    draft: ["submitted", "cancelled"],
    submitted: ["approved", "cancelled"],
    approved: ["ordered", "cancelled"],
    ordered: [],
    partially_received: [],
    received: [],
    cancelled: []
  };
  if (!PURCHASE_ORDER_STATUSES.includes(status) || !transitions[po.status]?.includes(status)) {
    throw new HttpError(409, "purchase_order_transition_invalid", "Transisi status PO tidak diizinkan.");
  }
  const reason = cleanText(body.reason, 600);
  if (status === "approved" || status === "cancelled") {
    if (!["owner", "admin"].includes(actor.role)) {
      throw new HttpError(403, "purchase_order_approval_forbidden", "Approval PO memerlukan Admin atau Owner.");
    }
  }
  if (status === "cancelled") {
    if (reason.length < 4) {
      throw new HttpError(400, "purchase_order_cancel_reason_required", "Alasan pembatalan minimal 4 karakter.");
    }
    if (Number(po.paidAmount || 0) > 0) {
      throw new HttpError(409, "purchase_order_has_payment", "PO yang sudah memiliki pembayaran tidak dapat dibatalkan dari alur ini.");
    }
    if ((po.items || []).some((item) => Number(item.receivedQuantity || 0) > 0)) {
      throw new HttpError(409, "purchase_order_has_receipt", "PO yang sudah menerima barang tidak dapat dibatalkan.");
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const next = {
    ...po,
    status,
    updatedAt: now,
    ...status === "approved" ? { approvedAt: now, approvedByUid: actor.uid, approvedByName: actor.displayName } : {},
    ...status === "ordered" ? { orderedAt: now } : {},
    ...status === "cancelled" ? { cancelledAt: now, cancelReason: reason, cancelledByUid: actor.uid } : {}
  };
  const eventId = await stableDocumentId("procurement-event", id + ":" + key);
  const event = {
    id: eventId,
    entityType: "purchase_order",
    entityId: id,
    action: "status_changed",
    fromStatus: po.status,
    toStatus: status,
    reason,
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now
  };
  const result = { purchaseOrder: next, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      purchaseOrder: { collectionId: "purchaseOrders", documentId: id },
      event: { collectionId: "procurementEvents", documentId: eventId }
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: "purchase-order-transition",
    writes: [
      firestore.setWrite("purchaseOrders", id, next, { updateTime: current.updateTime }),
      firestore.setWrite("procurementEvents", eventId, event, { exists: false })
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(transitionPurchaseOrder, "transitionPurchaseOrder");
async function receivePurchaseOrder({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "goods-receipt-create", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const poId = cleanText(body.purchaseOrderId, 160);
  if (!poId) throw new HttpError(400, "purchase_order_required", "Purchase order wajib dipilih.");
  const poDocument = await firestore.getDocument("purchaseOrders", poId);
  if (!poDocument) throw new HttpError(404, "purchase_order_not_found", "PO tidak ditemukan.");
  const po = { id: poDocument.id, ...poDocument.data };
  if (!["ordered", "partially_received"].includes(po.status)) {
    throw new HttpError(409, "purchase_order_not_receivable", "PO harus berstatus Ordered atau Partially Received.");
  }
  if (cleanText(body.expectedUpdatedAt, 40) !== po.updatedAt) {
    throw new HttpError(409, "purchase_order_changed", "PO berubah. Muat ulang sebelum mencatat penerimaan.");
  }
  if (!Array.isArray(po.items) || !po.items.length) {
    throw new HttpError(409, "purchase_order_items_missing", "PO tidak memiliki detail item yang valid.");
  }
  const receivedLines = Array.isArray(body.items) ? body.items : [];
  if (!receivedLines.length) {
    throw new HttpError(400, "goods_receipt_items_required", "Pilih setidaknya satu item yang diterima.");
  }
  const requestedLineIds = /* @__PURE__ */ new Set();
  for (const line of receivedLines) {
    const lineId = cleanText(line?.lineId, 80);
    if (!lineId || requestedLineIds.has(lineId)) {
      throw new HttpError(400, "goods_receipt_line_duplicate", "Baris penerimaan wajib unik.");
    }
    requestedLineIds.add(lineId);
  }
  if (receivedLines.length > po.items.length) {
    throw new HttpError(400, "goods_receipt_items_required", "Jumlah baris penerimaan melebihi detail PO.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const id = await stableDocumentId("goods-receipt", key);
  const nextItems = po.items.map((item) => ({ ...item }));
  const writes = [];
  const refs = {
    purchaseOrder: { collectionId: "purchaseOrders", documentId: poId }
  };
  const receivedSummary = [];
  const seenLineIds = /* @__PURE__ */ new Set();
  const seenInventoryIds = /* @__PURE__ */ new Set();
  for (const line of receivedLines) {
    const lineId = cleanText(line?.lineId, 80);
    if (!lineId || seenLineIds.has(lineId)) {
      throw new HttpError(400, "goods_receipt_line_duplicate", "Baris penerimaan wajib unik.");
    }
    seenLineIds.add(lineId);
    const lineIndex = nextItems.findIndex((item) => item.lineId === lineId);
    if (lineIndex < 0) throw new HttpError(400, "goods_receipt_line_invalid", "Baris penerimaan tidak sesuai PO.");
    const orderedLine = nextItems[lineIndex];
    if (!orderedLine.inventoryItemId || seenInventoryIds.has(orderedLine.inventoryItemId)) {
      throw new HttpError(409, "goods_receipt_inventory_invalid", "Referensi inventory pada PO tidak valid atau duplikat.");
    }
    seenInventoryIds.add(orderedLine.inventoryItemId);
    const quantity = finiteQuantity(line.quantity, "Jumlah diterima");
    const orderedQuantity = finiteQuantity(orderedLine.quantity, "Jumlah pesanan");
    const previouslyReceived = finiteQuantity(orderedLine.receivedQuantity || 0, "Jumlah yang sudah diterima");
    const remaining = Math.max(0, orderedQuantity - previouslyReceived);
    if (quantity <= 0 || quantity > remaining) {
      throw new HttpError(409, "goods_receipt_quantity_invalid", "Jumlah diterima melebihi sisa pesanan.");
    }
    const itemDocument = await firestore.getDocument("inventoryItems", orderedLine.inventoryItemId);
    if (!itemDocument || itemDocument.data.status === "inactive") {
      throw new HttpError(404, "inventory_item_not_found", "Item inventory terkait PO tidak ditemukan atau sudah dinonaktifkan.");
    }
    const inventoryItem = { id: itemDocument.id, ...itemDocument.data };
    const previousQuantity = finiteQuantity(inventoryItem.quantity || 0, "Stok saat ini");
    const nextQuantity = finiteQuantity(previousQuantity + quantity, "Stok hasil");
    if (nextQuantity < 0 || nextQuantity > 1e6) {
      throw new HttpError(400, "stock_limit", "Stok hasil berada di luar batas operasional.");
    }
    const movementId = await stableDocumentId("movement", "receipt:" + id + ":" + orderedLine.lineId);
    const movement = {
      id: movementId,
      itemId: inventoryItem.id,
      itemName: cleanText(inventoryItem.name, 160),
      type: "stock-in",
      quantity,
      previousQuantity,
      nextQuantity,
      unit: cleanText(inventoryItem.unit || orderedLine.unit || "pcs", 40),
      note: "Penerimaan " + po.poNumber,
      reason: cleanText(body.note || "Goods receipt", 500),
      source: "procurement",
      sourcePurchaseOrderId: poId,
      sourceGoodsReceiptId: id,
      actorUid: actor.uid,
      actorName: actor.displayName,
      createdAt: now
    };
    const nextItem = { ...inventoryItem, quantity: nextQuantity, updatedAt: now };
    writes.push(
      firestore.setWrite("inventoryItems", inventoryItem.id, nextItem, { updateTime: itemDocument.updateTime }),
      firestore.setWrite("inventoryMovements", movementId, movement, { exists: false })
    );
    orderedLine.receivedQuantity = finiteQuantity(previouslyReceived + quantity, "Total diterima");
    receivedSummary.push({
      lineId: orderedLine.lineId,
      inventoryItemId: inventoryItem.id,
      itemName: orderedLine.name,
      quantity,
      movementId
    });
  }
  const status = summarizePurchaseOrderStatus(nextItems);
  const nextPurchaseOrder = {
    ...po,
    items: nextItems,
    status,
    updatedAt: now,
    ...status === "received" ? { receivedAt: now } : {}
  };
  const receiptEventId = await stableDocumentId("procurement-event", id + ":received");
  const receipt = {
    id,
    purchaseOrderId: poId,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    supplierName: po.supplierName,
    items: receivedSummary,
    note: cleanText(body.note, 800),
    receivedAt: now,
    receivedByUid: actor.uid,
    receivedByName: actor.displayName,
    createdAt: now
  };
  const event = {
    id: receiptEventId,
    entityType: "goods_receipt",
    entityId: id,
    purchaseOrderId: poId,
    action: "received",
    fromStatus: po.status,
    toStatus: status,
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now,
    items: receivedSummary
  };
  refs.receipt = { collectionId: "goodsReceipts", documentId: id };
  refs.event = { collectionId: "procurementEvents", documentId: receiptEventId };
  writes.push(
    firestore.setWrite("purchaseOrders", poId, nextPurchaseOrder, { updateTime: poDocument.updateTime }),
    firestore.setWrite("goodsReceipts", id, receipt, { exists: false }),
    firestore.setWrite("procurementEvents", receiptEventId, event, { exists: false })
  );
  const result = { receipt, purchaseOrder: nextPurchaseOrder, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: refs,
    firestore,
    key,
    receipt: {},
    result,
    targetId: id,
    type: "goods-receipt-create",
    writes
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(receivePurchaseOrder, "receivePurchaseOrder");
async function recordPurchaseOrderPayment({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, "procurement-payment", key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const poId = cleanText(body.purchaseOrderId, 160);
  if (!poId) throw new HttpError(400, "purchase_order_required", "Purchase order wajib dipilih.");
  const current = await firestore.getDocument("purchaseOrders", poId);
  if (!current) throw new HttpError(404, "purchase_order_not_found", "PO tidak ditemukan.");
  const po = { id: current.id, ...current.data };
  if (["draft", "cancelled"].includes(po.status)) {
    throw new HttpError(409, "purchase_order_not_payable", "PO belum siap menerima pembayaran.");
  }
  if (cleanText(body.expectedUpdatedAt, 40) !== po.updatedAt) {
    throw new HttpError(409, "purchase_order_changed", "PO berubah. Muat ulang sebelum mencatat pembayaran.");
  }
  const amount = procurementAmount(body.amount, "Pembayaran");
  const totalAmount = procurementAmount(po.totalAmount, "Total PO");
  const paidAmount = procurementAmount(po.paidAmount || 0, "Total terbayar", { allowZero: true });
  const remaining = Math.max(0, totalAmount - paidAmount);
  if (!amount || amount > remaining) {
    throw new HttpError(409, "procurement_payment_exceeds_balance", "Pembayaran melebihi sisa kewajiban PO.");
  }
  const paymentMethod2 = cleanText(body.paymentMethod || "transfer", 40).toLowerCase();
  if (!["cash", "transfer", "qris"].includes(paymentMethod2)) {
    throw new HttpError(400, "procurement_payment_method_invalid", "Metode pembayaran tidak didukung.");
  }
  const paymentDate = procurementDate(body.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), "Tanggal pembayaran");
  const closingSessionId = paymentDate + "__main";
  const closingDocument = await firestore.getDocument("cashClosingSessions", closingSessionId);
  if (closingDocument?.data?.status === "closed") {
    throw new HttpError(409, "business_date_closed", "Tanggal pembayaran sudah ditutup oleh Daily Closing. Buka kembali tanggal tersebut melalui alur Owner sebelum mencatat pembayaran.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const paymentId = await stableDocumentId("procurement-payment", key);
  const nextClosingSession = {
    ...closingDocument?.data || {},
    id: closingSessionId,
    businessDate: paymentDate,
    registerId: "main",
    status: closingDocument?.data?.status || "not_opened",
    createdAt: closingDocument?.data?.createdAt || now,
    updatedAt: now,
    lastProcurementPaymentAt: now,
    lastProcurementPaymentId: paymentId
  };
  const payment = {
    id: paymentId,
    purchaseOrderId: poId,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    supplierName: po.supplierName,
    amount,
    paymentMethod: paymentMethod2,
    date: paymentDate,
    reference: cleanText(body.reference, 120),
    note: cleanText(body.note, 800),
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now
  };
  const expense = {
    id: paymentId,
    type: "expense",
    category: "procurement",
    title: "Pembayaran " + po.poNumber + " \xB7 " + po.supplierName,
    amount,
    date: paymentDate,
    paymentMethod: paymentMethod2,
    note: payment.note,
    source: "procurement-payment",
    sourcePurchaseOrderId: poId,
    sourceProcurementPaymentId: paymentId,
    actorUid: actor.uid,
    actorName: actor.displayName,
    immutable: true,
    createdAt: now,
    updatedAt: now
  };
  const nextPurchaseOrder = {
    ...po,
    paidAmount: paidAmount + amount,
    updatedAt: now
  };
  const eventId = await stableDocumentId("procurement-event", paymentId + ":paid");
  const event = {
    id: eventId,
    entityType: "purchase_order",
    entityId: poId,
    action: "payment_recorded",
    amount,
    actorUid: actor.uid,
    actorName: actor.displayName,
    createdAt: now
  };
  const result = { purchaseOrder: nextPurchaseOrder, payment, expense, event };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      purchaseOrder: { collectionId: "purchaseOrders", documentId: poId },
      payment: { collectionId: "procurementPayments", documentId: paymentId },
      expense: { collectionId: "bookkeepingEntries", documentId: paymentId },
      event: { collectionId: "procurementEvents", documentId: eventId }
    },
    firestore,
    key,
    receipt: {},
    result,
    targetId: poId,
    type: "procurement-payment",
    writes: [
      firestore.setWrite("purchaseOrders", poId, nextPurchaseOrder, { updateTime: current.updateTime }),
      firestore.setWrite("procurementPayments", paymentId, payment, { exists: false }),
      firestore.setWrite("bookkeepingEntries", paymentId, expense, { exists: false }),
      firestore.setWrite("procurementEvents", eventId, event, { exists: false }),
      firestore.setWrite(
        "cashClosingSessions",
        closingSessionId,
        nextClosingSession,
        closingDocument ? { updateTime: closingDocument.updateTime } : { exists: false }
      )
    ]
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
__name(recordPurchaseOrderPayment, "recordPurchaseOrderPayment");

// src/lib/auth.js
function bearerToken(request) {
  const match = String(request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}
__name(bearerToken, "bearerToken");
function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
__name(decodeBase64Url, "decodeBase64Url");
function decodeJwtPart(value) {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch {
    throw new HttpError(401, "invalid_session", "Sesi sudah tidak valid. Login kembali.");
  }
}
__name(decodeJwtPart, "decodeJwtPart");
async function verifyFirebaseToken(env, request) {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, "authentication_required", "Sesi login diperlukan.");
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new HttpError(401, "invalid_session", "Sesi sudah tidak valid. Login kembali.");
  }
  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  const projectId = String(env.FIREBASE_PROJECT_ID || "").trim();
  const uid = String(payload?.user_id || payload?.sub || "").trim();
  const now = Math.floor(Date.now() / 1e3);
  if (header.alg !== "RS256" || !header.kid || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || !uid || uid.length > 128 || Number(payload.exp || 0) <= now || Number(payload.iat || 0) > now + 300) {
    throw new HttpError(401, "invalid_session", "Sesi sudah tidak valid. Login kembali.");
  }
  const jwkResponse = await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
    { cf: { cacheEverything: true, cacheTtl: 3600 } }
  );
  const jwkSet = await jwkResponse.json().catch(() => null);
  const jwk = jwkSet?.keys?.find((candidate) => candidate.kid === header.kid);
  if (!jwkResponse.ok || !jwk) {
    throw new HttpError(401, "invalid_session", "Sesi belum dapat diverifikasi. Login kembali.");
  }
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["verify"]
  );
  const signatureValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!signatureValid) {
    throw new HttpError(401, "invalid_session", "Sesi sudah tidak valid. Login kembali.");
  }
  return {
    authTime: Number(payload.auth_time || payload.iat || 0),
    email: String(payload.email || "").trim(),
    uid
  };
}
__name(verifyFirebaseToken, "verifyFirebaseToken");
function permissionEnabled(user, permission) {
  if (user.role === "owner") return true;
  if (user.role !== "admin" || user.status !== "approved") return false;
  if (permission === "notifications") {
    return user.permissions?.notifications === true || typeof user.permissions?.notifications !== "boolean" && user.permissions?.settings === true;
  }
  return user.permissions?.[permission] === true;
}
__name(permissionEnabled, "permissionEnabled");
function assertOwnerControlMatches(user, uid, ownershipControlDocument) {
  if (user?.role === "owner" && ownershipControlDocument && String(ownershipControlDocument.data?.currentOwnerUid || "").trim() !== String(uid || "").trim()) {
    throw new HttpError(
      403,
      "owner_identity_mismatch",
      "Akun ini tidak lagi terdaftar sebagai Owner aktif."
    );
  }
}
__name(assertOwnerControlMatches, "assertOwnerControlMatches");
async function authorize(env, request, firestore, options = {}) {
  const identity = await verifyFirebaseToken(env, request);
  const userDocument = await firestore.getDocument("users", identity.uid);
  const user = userDocument?.data || null;
  if (!user || !["owner", "admin"].includes(user.role) || user.status !== "approved") {
    throw new HttpError(403, "admin_access_required", "Akun tidak memiliki akses Admin aktif.");
  }
  const ownershipControlDocument = user.role === "owner" ? await firestore.getDocument("adminControl", "ownership") : null;
  assertOwnerControlMatches(user, identity.uid, ownershipControlDocument);
  if (options.ownerOnly && user.role !== "owner") {
    throw new HttpError(403, "owner_required", "Operasi ini hanya tersedia untuk Owner.");
  }
  if (options.permission && !permissionEnabled(user, options.permission)) {
    throw new HttpError(403, "permission_denied", "Permission untuk operasi ini tidak aktif.");
  }
  if (options.requireFreshAuth) {
    const ageSeconds = Math.max(0, Math.floor(Date.now() / 1e3) - identity.authTime);
    if (!identity.authTime || ageSeconds > 300) {
      throw new HttpError(
        401,
        "fresh_auth_required",
        "Verifikasi ulang akun diperlukan sebelum operasi sensitif ini."
      );
    }
  }
  return {
    ...identity,
    displayName: String(user.displayName || identity.email || "Admin").trim().slice(0, 120),
    permissions: user.permissions || {},
    role: user.role,
    userDocument
  };
}
__name(authorize, "authorize");

// src/index.js
function pathMatch(pathname, pattern) {
  const match = pathname.match(pattern);
  return match ? match.slice(1).map((value) => decodeURIComponent(value)) : null;
}
__name(pathMatch, "pathMatch");
function requirePost(request) {
  if (request.method !== "POST") {
    throw new HttpError(405, "method_not_allowed", "Gunakan POST untuk operasi ini.");
  }
}
__name(requirePost, "requirePost");
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(request, env), status: 204 });
  }
  if (request.method === "GET" && pathname === "/health") {
    return json(request, env, {
      environment: String(env.APP_ENVIRONMENT || "unknown"),
      ok: true,
      service: "studio37-admin-operations"
    });
  }
  const firestore = createFirestoreClient(env);
  let body;
  let actor;
  let result;
  let params;
  if (pathname === "/v1/bookings/manual") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "schedule" });
    body = await readJson(request);
    result = await createManualBooking({ actor, body, firestore, request });
  } else if (pathname === "/v1/bookings/requests/decision") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "schedule" });
    body = await readJson(request);
    result = await decideBookingRequest({ actor, body, firestore, request });
  } else if (pathname === "/v1/bookings/sessions/action") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "schedule" });
    body = await readJson(request);
    result = await recordBookingSessionAction({ actor, body, firestore, request });
  } else if (pathname === "/v1/bookings/manual/update") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "schedule" });
    body = await readJson(request);
    result = await updateManualBooking({ actor, body, firestore, request });
  } else if (pathname === "/v1/finance/daily-closings/preview") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "bookkeeping" });
    body = await readJson(request);
    result = await previewDailyClosing({ actor, body, firestore });
  } else if (pathname === "/v1/finance/daily-closings/close") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "bookkeeping" });
    body = await readJson(request);
    result = await closeDailyClosing({ actor, body, firestore, request });
  } else if (pathname === "/v1/finance/daily-closings/reopen") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, permission: "bookkeeping", requireFreshAuth: true });
    body = await readJson(request);
    result = await reopenDailyClosing({ actor, body, firestore, request });
  } else if (pathname === "/v1/finance/payments") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "billing" });
    body = await readJson(request);
    result = await recordPayment({ actor, body, firestore, request });
  } else if (pathname === "/v1/finance/refunds") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "billing" });
    body = await readJson(request);
    result = await recordRefund({ actor, body, firestore, request });
  } else if (pathname === "/v1/finance/voids") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "billing" });
    body = await readJson(request);
    result = await voidInvoice({ actor, body, firestore, request });
  } else if (params = pathMatch(pathname, /^\/v1\/finance\/payment-proofs\/([^/]+)\/(approve|reject)$/)) {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "billing" });
    body = await readJson(request);
    result = await reviewPaymentProof({
      actor,
      body,
      decision: params[1],
      firestore,
      proofId: params[0],
      request
    });
  } else if (pathname === "/v1/inventory/items") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "inventory" });
    body = await readJson(request);
    result = await saveInventoryItem({ actor, body, firestore, request });
  } else if (pathname === "/v1/inventory/items/archive") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "inventory" });
    body = await readJson(request);
    result = await archiveInventoryItem({ actor, body, firestore, request });
  } else if (pathname === "/v1/customers/follow-ups/assignees") {
    if (request.method !== "GET") {
      throw new HttpError(405, "method_not_allowed", "Gunakan GET untuk membaca daftar PIC.");
    }
    actor = await authorize(env, request, firestore, { permission: "customers" });
    result = await listCustomerFollowUpAssignees({ actor, firestore });
  } else if (pathname === "/v1/customers/follow-ups") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "customers" });
    body = await readJson(request);
    result = await createCustomerFollowUpTask({ actor, body, firestore, request });
  } else if (pathname === "/v1/customers/follow-ups/update") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "customers" });
    body = await readJson(request);
    result = await updateCustomerFollowUpTask({ actor, body, firestore, request });
  } else if (pathname === "/v1/customers/follow-ups/cancel") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "customers" });
    body = await readJson(request);
    result = await cancelCustomerFollowUpTask({ actor, body, firestore, request });
  } else if (pathname === "/v1/inventory/adjustments") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "inventory" });
    body = await readJson(request);
    result = await adjustInventory({ actor, body, firestore, request });
  } else if (pathname === "/v1/inventory/maintenance/work-orders") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "inventory" });
    body = await readJson(request);
    result = await reportMaintenanceWorkOrder({ actor, body, firestore, request });
  } else if (pathname === "/v1/inventory/maintenance/work-orders/action") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "inventory" });
    body = await readJson(request);
    if (body.action === "reopen") {
      throw new HttpError(403, "owner_reopen_route_required", "Reopen harus menggunakan endpoint khusus Owner dengan verifikasi ulang.");
    }
    result = await actOnMaintenanceWorkOrder({ actor, body, firestore, request });
  } else if (pathname === "/v1/inventory/maintenance/work-orders/reopen") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, permission: "inventory", requireFreshAuth: true });
    body = await readJson(request);
    result = await actOnMaintenanceWorkOrder({ actor, body: { ...body, action: "reopen" }, firestore, request });
  } else if (pathname === "/v1/inventory/maintenance/work-orders/cost") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "bookkeeping" });
    body = await readJson(request);
    result = await recordMaintenanceCost({ actor, body, firestore, request });
  } else if (pathname === "/v1/procurement/suppliers") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "inventory" });
    body = await readJson(request);
    result = await createSupplier({ actor, body, firestore, request });
  } else if (pathname === "/v1/procurement/purchase-orders") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "inventory" });
    body = await readJson(request);
    result = await createPurchaseOrder({ actor, body, firestore, request });
  } else if (pathname === "/v1/procurement/purchase-orders/transition") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "inventory" });
    body = await readJson(request);
    result = await transitionPurchaseOrder({ actor, body, firestore, request });
  } else if (pathname === "/v1/procurement/goods-receipts") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "inventory" });
    body = await readJson(request);
    result = await receivePurchaseOrder({ actor, body, firestore, request });
  } else if (pathname === "/v1/procurement/payments") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { permission: "bookkeeping" });
    body = await readJson(request);
    result = await recordPurchaseOrderPayment({ actor, body, firestore, request });
  } else if (pathname === "/v1/gallery/permanent-delete") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, permission: "gallery" });
    body = await readJson(request);
    result = await permanentlyDeleteGalleryItem({ actor, body, env, firestore, request });
  } else if (pathname === "/v1/accounts/transfer-ownership") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, requireFreshAuth: true });
    body = await readJson(request);
    result = await transferOwnership({ actor, body, firestore, request });
  } else if (pathname === "/v1/danger-zone/dry-run") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true });
    body = await readJson(request);
    result = await createDangerDryRun({ actor, body, env, firestore, request });
  } else if (pathname === "/v1/danger-zone/jobs") {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true, requireFreshAuth: true });
    body = await readJson(request);
    result = await startDangerJob({ actor, body, env, firestore, request });
  } else if (params = pathMatch(pathname, /^\/v1\/danger-zone\/jobs\/([^/]+)\/step$/)) {
    requirePost(request);
    actor = await authorize(env, request, firestore, { ownerOnly: true });
    body = await readJson(request);
    result = await runDangerJobStep({ actor, body, firestore, jobId: params[0], request });
  } else if (params = pathMatch(pathname, /^\/v1\/danger-zone\/jobs\/([^/]+)$/)) {
    if (request.method !== "GET") {
      throw new HttpError(405, "method_not_allowed", "Gunakan GET untuk membaca status job.");
    }
    actor = await authorize(env, request, firestore, { ownerOnly: true });
    result = await readDangerJob({ actor, firestore, jobId: params[0] });
  } else {
    throw new HttpError(404, "not_found", "Endpoint operasi tidak ditemukan.");
  }
  return json(request, env, { ...result, ok: true });
}
__name(handleRequest, "handleRequest");
var src_default = {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const publicError = toPublicError(error);
      console.error("admin-operation-diagnostic", {
        method: request.method,
        status: publicError.status,
        errorMessage: String(error?.message || "").slice(0, 200),
        requestPath: String(error?.requestPath || "").replace(/\/users\/[^/?]+/g, "/users/{uid}").slice(0, 240),
        upstreamStatus: error?.status || null,
        upstreamCode: error?.payload?.error?.status || null,
        upstreamMessage: String(error?.payload?.error?.message || "").slice(0, 240),
        upstreamDetails: Array.isArray(error?.payload?.error?.details) ? error.payload.error.details.map((detail) => ({
          reason: detail?.reason || null,
          domain: detail?.domain || null,
          permission: detail?.metadata?.permission || null,
          service: detail?.metadata?.service || null,
          method: detail?.metadata?.method || null
        })) : []
      });
      return json(request, env, publicError.payload, { status: publicError.status });
    }
  }
};

// ../../../../../AppData/Local/npm-cache/_npx/31203f1a28efbe66/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../AppData/Local/npm-cache/_npx/31203f1a28efbe66/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-a0d4wz/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../../AppData/Local/npm-cache/_npx/31203f1a28efbe66/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-a0d4wz/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
