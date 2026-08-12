const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const FIRESTORE_DATABASE_ID = '(default)';
const ONE_SIGNAL_API_URL = 'https://api.onesignal.com/notifications';
const NOTIFICATION_AUDITS_COLLECTION = 'notificationEventAudits';
const EVENT_LEASE_MS = 2 * 60 * 1000;

let tokenCache = {
  accessToken: '',
  expiresAt: 0,
};

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers: {
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-origin': '*',
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });
}

function getEnv(env, key, fallback = '') {
  return String(env[key] || fallback || '').trim();
}

function requireEnv(env, key) {
  const value = getEnv(env, key);

  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }

  return value;
}

function getSiteUrl(env, url = '') {
  const origin = getEnv(env, 'SITE_ORIGIN', 'https://studio-37.web.app').replace(/\/$/, '');
  const cleanUrl = String(url || '').trim();

  if (!cleanUrl) return origin;
  if (/^https?:\/\//i.test(cleanUrl)) return cleanUrl;

  return `${origin}/${cleanUrl.replace(/^\//, '')}`;
}

function base64UrlEncode(input) {
  let bytes;

  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }

  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function pemToArrayBuffer(pem) {
  const normalized = String(pem || '')
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function signServiceAccountJwt(env) {
  const clientEmail = requireEnv(env, 'FIREBASE_CLIENT_EMAIL');
  const privateKey = requireEnv(env, 'FIREBASE_PRIVATE_KEY');
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const claim = {
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
    iss: clientEmail,
    scope: FIRESTORE_SCOPE,
  };

  const signingInput = [
    base64UrlEncode(JSON.stringify(header)),
    base64UrlEncode(JSON.stringify(claim)),
  ].join('.');

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    {
      hash: 'SHA-256',
      name: 'RSASSA-PKCS1-v1_5',
    },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function getFirestoreAccessToken(env) {
  const now = Date.now();

  if (tokenCache.accessToken && tokenCache.expiresAt > now + 60000) {
    return tokenCache.accessToken;
  }

  const assertion = await signServiceAccountJwt(env);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    body: new URLSearchParams({
      assertion,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });

  const payload = await response.json();

  if (!response.ok || !payload.access_token) {
    throw new Error(`Firebase OAuth failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: now + Math.max(1, Number(payload.expires_in || 3600) - 60) * 1000,
  };

  return tokenCache.accessToken;
}

function firestoreBaseUrl(env) {
  const projectId = requireEnv(env, 'FIREBASE_PROJECT_ID');

  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents`;
}

async function firestoreFetch(env, path, init = {}) {
  const token = await getFirestoreAccessToken(env);
  const response = await fetch(`${firestoreBaseUrl(env)}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(`Firestore API failed: ${response.status} ${text}`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function isFirestoreWriteConflict(error) {
  const apiStatus = cleanText(error?.payload?.error?.status, 80);

  return (
    error?.statusCode === 409 ||
    error?.statusCode === 412 ||
    apiStatus === 'ABORTED' ||
    apiStatus === 'ALREADY_EXISTS' ||
    apiStatus === 'FAILED_PRECONDITION'
  );
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };

  if (typeof value === 'boolean') return { booleanValue: value };

  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(toFirestoreValue),
      },
    };
  }

  if (typeof value === 'object') {
    const fields = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      fields[key] = toFirestoreValue(nestedValue);
    });

    return {
      mapValue: {
        fields,
      },
    };
  }

  return {
    stringValue: String(value),
  };
}

function fromFirestoreValue(value = {}) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue || 0);
  if ('doubleValue' in value) return Number(value.doubleValue || 0);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;

  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }

  if ('mapValue' in value) {
    return fromFirestoreFields(value.mapValue.fields || {});
  }

  return null;
}

function fromFirestoreFields(fields = {}) {
  const output = {};

  Object.entries(fields).forEach(([key, value]) => {
    output[key] = fromFirestoreValue(value);
  });

  return output;
}

function encodeDocument(data = {}) {
  const fields = {};

  Object.entries(data).forEach(([key, value]) => {
    fields[key] = toFirestoreValue(value);
  });

  return { fields };
}

function parseDocument(document = {}) {
  const nameParts = String(document.name || '').split('/');

  return {
    id: nameParts[nameParts.length - 1] || '',
    path: document.name || '',
    _updateTime: document.updateTime || '',
    ...fromFirestoreFields(document.fields || {}),
  };
}

async function runQuery(env, structuredQuery) {
  const payload = await firestoreFetch(env, ':runQuery', {
    body: JSON.stringify({ structuredQuery }),
    method: 'POST',
  });

  return (payload || [])
    .filter((row) => row.document)
    .map((row) => parseDocument(row.document));
}

async function getDocument(env, collectionId, documentId) {
  try {
    const payload = await firestoreFetch(env, `/${collectionId}/${encodeURIComponent(documentId)}`);
    return parseDocument(payload);
  } catch (error) {
    if (error?.statusCode === 404) return null;
    throw error;
  }
}

function firestoreDocumentName(env, collectionId, documentId) {
  const projectId = requireEnv(env, 'FIREBASE_PROJECT_ID');

  return `projects/${projectId}/databases/${FIRESTORE_DATABASE_ID}/documents/${collectionId}/${documentId}`;
}

function updateWrite(env, collectionId, documentId, patch, currentDocument = {}) {
  return {
    currentDocument,
    update: {
      ...encodeDocument(patch),
      name: firestoreDocumentName(env, collectionId, documentId),
    },
    updateMask: {
      fieldPaths: Object.keys(patch),
    },
  };
}

async function commitWrites(env, writes) {
  return firestoreFetch(env, ':commit', {
    body: JSON.stringify({ writes }),
    method: 'POST',
  });
}

function stringValue(value) {
  return { stringValue: String(value || '') };
}

function cleanText(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function createRequestId(prefix = 'request') {
  const safePrefix = cleanText(prefix, 40).replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const randomPart = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return `${safePrefix || 'request'}_${randomPart}`;
}

function makeAuditId(eventId, action, requestId) {
  return `${eventId}_${action}_${requestId}`
    .replace(/[^a-z0-9_-]/gi, '_')
    .slice(0, 480);
}


async function fetchPendingEvents(env, limit = 10) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
  const queryLimit = Math.max(safeLimit, Math.min(100, safeLimit * 5));
  const rows = await runQuery(env, {
    from: [{ collectionId: 'notificationEvents' }],
    limit: queryLimit,
    where: {
      fieldFilter: {
        field: { fieldPath: 'status' },
        op: 'EQUAL',
        value: stringValue('pending'),
      },
    },
  });

  return rows
    .sort((first, second) => String(first.createdAt || '').localeCompare(String(second.createdAt || '')))
    .slice(0, safeLimit);
}

function isEligibleSubscription(row) {
  return Boolean(
    row &&
      row.permission === 'granted' &&
      row.optedIn === true &&
      row.subscriptionId &&
      row.isActive !== false
  );
}

function uniqueSubscriptions(rows = []) {
  const lookup = new Map();

  rows
    .filter(isEligibleSubscription)
    .forEach((row) => {
      if (!lookup.has(row.subscriptionId)) {
        lookup.set(row.subscriptionId, row);
      }
    });

  return [...lookup.values()];
}

async function fetchRoleSubscriptions(env, role) {
  const [deviceRows, legacyRows] = await Promise.all([
    runQuery(env, {
      from: [{ collectionId: 'notificationSubscriptionDevices' }],
      limit: 200,
      where: {
        fieldFilter: {
          field: { fieldPath: 'role' },
          op: 'EQUAL',
          value: stringValue(role),
        },
      },
    }),
    runQuery(env, {
      from: [{ collectionId: 'notificationSubscriptions' }],
      limit: 100,
      where: {
        fieldFilter: {
          field: { fieldPath: 'role' },
          op: 'EQUAL',
          value: stringValue(role),
        },
      },
    }),
  ]);

  return uniqueSubscriptions([...deviceRows, ...legacyRows]);
}

async function fetchUserSubscription(env, uid) {
  const [deviceRows, legacyRow] = await Promise.all([
    runQuery(env, {
      from: [{ collectionId: 'notificationSubscriptionDevices' }],
      limit: 50,
      where: {
        fieldFilter: {
          field: { fieldPath: 'uid' },
          op: 'EQUAL',
          value: stringValue(uid),
        },
      },
    }),
    getDocument(env, 'notificationSubscriptions', uid),
  ]);

  return uniqueSubscriptions([...deviceRows, legacyRow].filter(Boolean));
}

async function resolveSubscriptionsForEvent(env, event) {
  if (event.targetMode === 'user' && event.targetUid) {
    return fetchUserSubscription(env, event.targetUid);
  }

  if (event.targetMode === 'role' && event.targetRole && event.targetRole !== 'none') {
    return fetchRoleSubscriptions(env, event.targetRole);
  }

  return [];
}

function buildOneSignalPayload(env, event, subscriptionIds) {
  const appId = requireEnv(env, 'ONESIGNAL_APP_ID');
  const data = {
    bookingId: event.bookingId || '',
    eventId: event.id || '',
    paymentProofId: event.paymentProofId || '',
    source: event.source || '',
    type: event.type || '',
  };

  return {
    app_id: appId,
    contents: {
      en: event.message || 'Ada update baru dari 37 Music Studio.',
    },
    data,
    headings: {
      en: event.title || '37 Music Studio',
    },
    include_subscription_ids: subscriptionIds,
    target_channel: 'push',
    url: getSiteUrl(env, event.url),
  };
}

async function makeOneSignalIdempotencyKey(eventId) {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cleanText(eventId, 240))),
  );
  const bytes = digest.slice(0, 16);

  // OneSignal accepts a UUID idempotency key. Keep it deterministic per
  // canonical notification event so an ambiguous provider response cannot
  // turn an authenticated retry into a duplicate delivery.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

async function sendOneSignalNotification(env, event, subscriptions) {
  const subscriptionIds = [...new Set(subscriptions.map((item) => item.subscriptionId).filter(Boolean))];

  if (!subscriptionIds.length) {
    throw new Error('No eligible OneSignal subscription IDs.');
  }

  const requestPayload = buildOneSignalPayload(env, event, subscriptionIds);
  requestPayload.idempotency_key = await makeOneSignalIdempotencyKey(event.id);
  const response = await fetch(ONE_SIGNAL_API_URL, {
    body: JSON.stringify(requestPayload),
    headers: {
      authorization: `Key ${requireEnv(env, 'ONESIGNAL_REST_API_KEY')}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`OneSignal API failed: ${response.status} ${text}`);
  }

  return {
    payload,
    subscriptionCount: subscriptionIds.length,
  };
}

function normalizeAuditActor(actor = {}) {
  return {
    email: cleanText(actor.email, 254),
    role: cleanText(actor.role || 'system', 40),
    uid: cleanText(actor.uid || 'system', 128),
  };
}

async function commitEventOperation(
  env,
  event,
  { action, actor, patch = {}, reason, requestId },
) {
  if (!event?.id || !event?._updateTime) {
    const error = new Error('Notification event version is unavailable.');
    error.statusCode = 409;
    throw error;
  }

  const cleanAction = cleanText(action, 80);
  const cleanReason = cleanText(reason, 500);
  const cleanRequestId = cleanText(requestId, 160);
  const timestamp = new Date().toISOString();
  const auditActor = normalizeAuditActor(actor);
  const nextPatch = {
    ...patch,
    lastAction: cleanAction,
    lastActionAt: timestamp,
    lastActionByEmail: auditActor.email,
    lastActionByRole: auditActor.role,
    lastActionByUid: auditActor.uid,
    lastActionReason: cleanReason,
    lastActionRequestId: cleanRequestId,
    updatedAt: timestamp,
  };
  const nextStatus = cleanText(nextPatch.status || event.status, 40);
  const auditId = makeAuditId(event.id, cleanAction, cleanRequestId);
  const auditRecord = {
    action: cleanAction,
    actorEmail: auditActor.email,
    actorRole: auditActor.role,
    actorUid: auditActor.uid,
    createdAt: timestamp,
    eventId: event.id,
    fromStatus: cleanText(event.status, 40),
    id: auditId,
    reason: cleanReason,
    requestId: cleanRequestId,
    toStatus: nextStatus,
  };

  try {
    await commitWrites(env, [
      updateWrite(env, 'notificationEvents', event.id, nextPatch, {
        updateTime: event._updateTime,
      }),
      updateWrite(env, NOTIFICATION_AUDITS_COLLECTION, auditId, auditRecord, {
        exists: false,
      }),
    ]);
  } catch (error) {
    if (isFirestoreWriteConflict(error)) {
      const current = await getDocument(env, 'notificationEvents', event.id);

      if (
        current?.lastAction === cleanAction &&
        current?.lastActionRequestId === cleanRequestId
      ) {
        return {
          event: current,
          idempotent: true,
        };
      }

      const conflict = new Error('Notification event changed concurrently.');
      conflict.cause = error;
      conflict.statusCode = 409;
      throw conflict;
    }

    throw error;
  }

  return {
    event: await getDocument(env, 'notificationEvents', event.id),
    idempotent: false,
  };
}

async function recordDryRun(env, event, options, subscriptionCount) {
  try {
    const result = await commitEventOperation(env, event, {
      action: 'dry_run',
      actor: options.actor,
      patch: {},
      reason: options.reason,
      requestId: options.requestId,
    });

    return {
      dryRun: true,
      eventId: event.id,
      idempotent: result.idempotent,
      subscriptionCount,
    };
  } catch (error) {
    if (error?.statusCode === 409) {
      return {
        dryRun: true,
        eventId: event.id,
        skipped: true,
        reason: 'claim-conflict',
        subscriptionCount,
      };
    }

    throw error;
  }
}

async function claimPendingEvent(env, event, options) {
  if (event.status !== 'pending') {
    return {
      event,
      skipped: true,
      status: event.status,
    };
  }

  const leaseId = createRequestId('lease');
  const leaseExpiresAt = new Date(Date.now() + EVENT_LEASE_MS).toISOString();

  try {
    const result = await commitEventOperation(env, event, {
      action: 'claim',
      actor: options.actor,
      patch: {
        attempts: Math.max(0, Number(event.attempts || 0)) + 1,
        errorMessage: '',
        leaseExpiresAt,
        leaseId,
        status: 'processing',
      },
      reason: options.reason,
      requestId: options.requestId,
    });

    return {
      event: result.event,
      leaseId,
      skipped: result.idempotent,
      status: result.event?.status || 'processing',
    };
  } catch (error) {
    if (error?.statusCode === 409) {
      return {
        event: await getDocument(env, 'notificationEvents', event.id),
        skipped: true,
        status: 'claim-conflict',
      };
    }

    throw error;
  }
}

async function finalizeClaimedEvent(env, claimedEvent, options, patch, action) {
  const current = await getDocument(env, 'notificationEvents', claimedEvent.id);

  if (
    !current ||
    current.status !== 'processing' ||
    current.leaseId !== options.leaseId
  ) {
    const error = new Error('Notification event lease is no longer owned by this worker.');
    error.statusCode = 409;
    throw error;
  }

  return commitEventOperation(env, current, {
    action,
    actor: options.actor,
    patch: {
      ...patch,
      leaseExpiresAt: '',
      leaseId: '',
    },
    reason: options.reason,
    requestId: options.requestId,
  });
}

async function processEvent(env, event, options = {}) {
  if (!event?.id) return { ok: false, reason: 'missing-event-id' };
  if (event.status !== 'pending') {
    return {
      eventId: event.id,
      skipped: true,
      status: event.status,
    };
  }

  if (options.dryRun) {
    const subscriptions = await resolveSubscriptionsForEvent(env, event);
    return recordDryRun(env, event, options, subscriptions.length);
  }

  const claim = await claimPendingEvent(env, event, options);

  if (claim.skipped) {
    return {
      eventId: event.id,
      skipped: true,
      status: claim.status,
    };
  }

  const claimedEvent = claim.event;
  const finalizeOptions = {
    ...options,
    leaseId: claim.leaseId,
  };
  let deliveryCompleted = false;

  try {
    const subscriptions = await resolveSubscriptionsForEvent(env, claimedEvent);
    const result = await sendOneSignalNotification(env, claimedEvent, subscriptions);
    deliveryCompleted = true;

    await finalizeClaimedEvent(env, claimedEvent, finalizeOptions, {
      errorMessage: '',
      providerNotificationId: cleanText(result.payload?.id, 240),
      sentAt: new Date().toISOString(),
      status: 'sent',
    }, 'sent');

    return {
      eventId: event.id,
      oneSignal: result.payload,
      sent: true,
      subscriptionCount: result.subscriptionCount,
    };
  } catch (error) {
    if (deliveryCompleted) {
      return {
        error: 'Push terkirim tetapi finalisasi status gagal; event dipertahankan dalam lease untuk mencegah resend otomatis.',
        eventId: event.id,
        sent: true,
        statusPersistenceFailed: true,
      };
    }

    try {
      await finalizeClaimedEvent(env, claimedEvent, finalizeOptions, {
        errorMessage: cleanText(error?.message || error, 1000),
        status: 'failed',
      }, 'failed');
    } catch (finalizeError) {
      return {
        error: cleanText(error?.message || error, 1000),
        eventId: event.id,
        finalizeError: cleanText(finalizeError?.message || finalizeError, 500),
        sent: false,
      };
    }

    return {
      error: cleanText(error?.message || error, 1000),
      eventId: event.id,
      sent: false,
    };
  }
}

async function processPendingEvents(env, options = {}) {
  const limit = Math.max(1, Math.min(50, Number(options.limit || env.DEFAULT_LIMIT || 10)));
  const requestedEventId = cleanText(options.eventId, 240);
  const events = requestedEventId
    ? [await getDocument(env, 'notificationEvents', requestedEventId)].filter(Boolean)
    : await fetchPendingEvents(env, limit);
  const baseRequestId = cleanText(options.requestId, 120) || createRequestId('process');
  const results = [];

  for (const event of events) {
    results.push(await processEvent(env, event, {
      ...options,
      requestId: `${baseRequestId}_${event.id}`.slice(0, 160),
    }));
  }

  return {
    count: results.length,
    dryRun: Boolean(options.dryRun),
    results,
  };
}

async function parseJsonBody(request) {
  if (request.method === 'GET') return {};

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 32768) {
    const error = new Error('Request body is too large.');
    error.statusCode = 413;
    throw error;
  }

  const text = await request.text();
  if (!text) return {};

  if (text.length > 32768) {
    const error = new Error('Request body is too large.');
    error.statusCode = 413;
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch (cause) {
    const error = new Error('Request body must contain valid JSON.');
    error.cause = cause;
    error.statusCode = 400;
    throw error;
  }
}

function getBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
}

async function verifyFirebaseIdToken(env, request) {
  const token = getBearerToken(request);

  if (!token) {
    const error = new Error('Missing Firebase ID token.');
    error.statusCode = 401;
    throw error;
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload) {
    const error = new Error('Invalid Firebase ID token.');
    error.statusCode = 401;
    throw error;
  }

  const projectId = requireEnv(env, 'FIREBASE_PROJECT_ID');
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const uid = String(payload.user_id || payload.sub || '').trim();
  const expiresAt = Number(payload.exp || 0);
  const now = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId || payload.iss !== expectedIssuer || !uid || expiresAt <= now) {
    const error = new Error('Firebase token claim mismatch.');
    error.statusCode = 401;
    throw error;
  }

  return {
    email: String(payload.email || '').trim(),
    uid,
  };
}

function isActiveCallerUser(user) {
  if (!user?.id || !user?.role) return false;
  if (user.role === 'owner') return user.status === 'approved';
  if (user.role === 'admin') return user.status === 'approved';
  if (user.role === 'client') return user.status === 'active';
  if (user.role === 'studio_guard') return user.status === 'approved';

  return false;
}

function hasNotificationPermission(user) {
  if (user?.role === 'owner' && user?.status === 'approved') return true;
  if (user?.role !== 'admin' || user?.status !== 'approved') return false;

  const permissions = user.permissions && typeof user.permissions === 'object'
    ? user.permissions
    : {};

  if (typeof permissions.notifications === 'boolean') {
    return permissions.notifications;
  }

  return permissions.settings === true;
}

async function authenticateCaller(env, request) {
  const tokenIdentity = await verifyFirebaseIdToken(env, request);
  const user = await getDocument(env, 'users', tokenIdentity.uid);

  if (!isActiveCallerUser(user)) {
    const error = new Error('Caller account is not active.');
    error.statusCode = 403;
    throw error;
  }

  const tokenEmail = cleanText(tokenIdentity.email, 254).toLowerCase();
  const userEmail = cleanText(user.email, 254).toLowerCase();

  if (tokenEmail && userEmail && tokenEmail !== userEmail) {
    const error = new Error('Caller identity does not match the user record.');
    error.statusCode = 403;
    throw error;
  }

  return {
    actor: {
      email: user.email || tokenIdentity.email,
      role: user.role,
      uid: tokenIdentity.uid,
    },
    email: tokenIdentity.email,
    uid: tokenIdentity.uid,
    user,
  };
}

function requireNotificationPermission(caller) {
  if (hasNotificationPermission(caller?.user)) return;

  const error = new Error('Notifications permission is required.');
  error.statusCode = 403;
  throw error;
}

function callerMatchesRequestedEvent(event, caller) {
  if (!event || !caller?.uid) return false;
  if (event.actorUid && event.actorUid === caller.uid) return true;
  if (event.targetMode === 'user' && event.targetUid && event.targetUid === caller.uid) return true;

  return false;
}

function canDispatchRequestedEvent(event, caller) {
  return event?.status === 'pending' && callerMatchesRequestedEvent(event, caller);
}

async function processRequestedEvent(env, eventId, caller, requestId) {
  const cleanEventId = String(eventId || '').trim().slice(0, 240);

  if (!cleanEventId) {
    return {
      error: 'Missing eventId.',
      ok: false,
      statusCode: 400,
    };
  }

  const event = await getDocument(env, 'notificationEvents', cleanEventId);

  if (!event) {
    return {
      error: 'Notification event not found.',
      eventId: cleanEventId,
      ok: false,
      statusCode: 404,
    };
  }

  if (!callerMatchesRequestedEvent(event, caller)) {
    return {
      error: 'Forbidden notification event dispatch.',
      eventId: cleanEventId,
      ok: false,
      statusCode: 403,
    };
  }

  if (event.status !== 'pending') {
    return {
      eventId: cleanEventId,
      ok: true,
      skipped: true,
      status: event.status,
    };
  }

  const result = await processEvent(env, event, {
    actor: caller.actor,
    reason: 'Realtime dispatch requested by event actor or target.',
    realtimeDispatch: true,
    requestId: cleanText(requestId, 160) || createRequestId('dispatch'),
  });

  return {
    ...result,
    ok: !result.error,
    realtimeDispatch: true,
    statusCode: result.error ? 500 : 200,
  };
}

async function changeEventStatus(env, body, caller, action) {
  const eventId = cleanText(body.eventId, 240);
  const reason = cleanText(body.reason, 500);
  const requestId = cleanText(body.requestId, 160) || createRequestId(action);

  if (!eventId) {
    const error = new Error('Missing eventId.');
    error.statusCode = 400;
    throw error;
  }

  if (reason.length < 4) {
    const error = new Error('Operation reason must contain at least 4 characters.');
    error.statusCode = 400;
    throw error;
  }

  const event = await getDocument(env, 'notificationEvents', eventId);

  if (!event) {
    const error = new Error('Notification event not found.');
    error.statusCode = 404;
    throw error;
  }

  if (
    event.lastAction === action &&
    event.lastActionRequestId === requestId
  ) {
    return {
      eventId,
      idempotent: true,
      ok: true,
      status: event.status,
    };
  }

  const allowedStatuses = action === 'retry'
    ? ['failed', 'cancelled']
    : ['pending'];

  if (!allowedStatuses.includes(event.status)) {
    const error = new Error(
      event.status === 'sent'
        ? 'Sent notifications cannot be replayed from the normal operations endpoint.'
        : `Cannot ${action} notification event with status ${event.status}.`,
    );
    error.statusCode = 409;
    throw error;
  }

  const patch = action === 'retry'
    ? {
        errorMessage: '',
        leaseExpiresAt: '',
        leaseId: '',
        status: 'pending',
      }
    : {
        errorMessage: reason,
        leaseExpiresAt: '',
        leaseId: '',
        status: 'cancelled',
      };
  const result = await commitEventOperation(env, event, {
    action,
    actor: caller.actor,
    patch,
    reason,
    requestId,
  });

  return {
    eventId,
    idempotent: result.idempotent,
    ok: true,
    status: result.event?.status,
  };
}

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return jsonResponse({
      ok: true,
    });
  }

  if (url.pathname === '/health') {
    const caller = await authenticateCaller(env, request);
    requireNotificationPermission(caller);

    return jsonResponse({
      configured: {
        firebase: Boolean(getEnv(env, 'FIREBASE_CLIENT_EMAIL') && getEnv(env, 'FIREBASE_PRIVATE_KEY')),
        oneSignal: Boolean(getEnv(env, 'ONESIGNAL_APP_ID') && getEnv(env, 'ONESIGNAL_REST_API_KEY')),
      },
      ok: true,
      service: 'studio37-onesignal-notification-worker',
      time: new Date().toISOString(),
    });
  }

  if (url.pathname === '/dispatch' && request.method === 'POST') {
    const caller = await authenticateCaller(env, request);
    const body = await parseJsonBody(request);
    const result = await processRequestedEvent(env, body.eventId, caller, body.requestId);
    const statusCode = Number(result.statusCode || 200);

    return jsonResponse(result, { status: statusCode });
  }

  if (url.pathname === '/process' && request.method === 'POST') {
    const caller = await authenticateCaller(env, request);
    requireNotificationPermission(caller);
    const body = await parseJsonBody(request);
    const result = await processPendingEvents(env, {
      actor: caller.actor,
      dryRun: Boolean(body.dryRun),
      eventId: body.eventId,
      limit: body.limit,
      reason: cleanText(body.reason, 500) || 'Authenticated notification queue process.',
      requestId: cleanText(body.requestId, 160) || createRequestId('process'),
    });

    return jsonResponse(result);
  }

  if (url.pathname === '/events/retry' && request.method === 'POST') {
    const caller = await authenticateCaller(env, request);
    requireNotificationPermission(caller);
    const body = await parseJsonBody(request);

    return jsonResponse(await changeEventStatus(env, body, caller, 'retry'));
  }

  if (url.pathname === '/events/cancel' && request.method === 'POST') {
    const caller = await authenticateCaller(env, request);
    requireNotificationPermission(caller);
    const body = await parseJsonBody(request);

    return jsonResponse(await changeEventStatus(env, body, caller, 'cancel'));
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500);

      return jsonResponse({
        error: statusCode >= 500
          ? 'Internal notification worker error.'
          : cleanText(error?.message || error, 500),
        ok: false,
      }, { status: statusCode });
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(processPendingEvents(env, {
      actor: {
        email: '',
        role: 'system',
        uid: 'cloudflare-cron',
      },
      limit: Number(env.DEFAULT_LIMIT || 10),
      reason: 'Scheduled notification queue process.',
      requestId: createRequestId('scheduled'),
    }));
  },
};

export const notificationWorkerTestApi = Object.freeze({
  canDispatchRequestedEvent,
  hasNotificationPermission,
  isActiveCallerUser,
  makeOneSignalIdempotencyKey,
});
