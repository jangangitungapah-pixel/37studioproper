const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const FIRESTORE_DATABASE_ID = '(default)';
const ONE_SIGNAL_API_URL = 'https://api.onesignal.com/notifications';

let tokenCache = {
  accessToken: '',
  expiresAt: 0,
};

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers: {
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
    throw new Error(`Firestore API failed: ${response.status} ${text}`);
  }

  return payload;
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
    if (String(error.message || '').includes('404')) return null;
    throw error;
  }
}

async function patchDocument(env, collectionId, documentId, patch) {
  const mask = Object.keys(patch)
    .map((fieldPath) => `updateMask.fieldPaths=${encodeURIComponent(fieldPath)}`)
    .join('&');

  return firestoreFetch(env, `/${collectionId}/${encodeURIComponent(documentId)}?${mask}`, {
    body: JSON.stringify(encodeDocument(patch)),
    method: 'PATCH',
  });
}

function stringValue(value) {
  return { stringValue: String(value || '') };
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

async function fetchRoleSubscriptions(env, role) {
  const rows = await runQuery(env, {
    from: [{ collectionId: 'notificationSubscriptions' }],
    limit: 100,
    where: {
      fieldFilter: {
        field: { fieldPath: 'role' },
        op: 'EQUAL',
        value: stringValue(role),
      },
    },
  });

  return rows.filter((row) =>
    row.permission === 'granted' &&
    row.optedIn === true &&
    Boolean(row.subscriptionId)
  );
}

async function fetchUserSubscription(env, uid) {
  const row = await getDocument(env, 'notificationSubscriptions', uid);

  if (!row) return [];

  if (row.permission !== 'granted' || !row.optedIn || !row.subscriptionId) {
    return [];
  }

  return [row];
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

async function sendOneSignalNotification(env, event, subscriptions) {
  const subscriptionIds = [...new Set(subscriptions.map((item) => item.subscriptionId).filter(Boolean))];

  if (!subscriptionIds.length) {
    throw new Error('No eligible OneSignal subscription IDs.');
  }

  const response = await fetch(ONE_SIGNAL_API_URL, {
    body: JSON.stringify(buildOneSignalPayload(env, event, subscriptionIds)),
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

async function markEvent(env, event, patch) {
  const attempts = Number(event.attempts || 0);
  const nextPatch = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if ('attempts' in patch) {
    nextPatch.attempts = patch.attempts;
  } else if (patch.status === 'processing' || patch.status === 'failed') {
    nextPatch.attempts = attempts + 1;
  }

  await patchDocument(env, 'notificationEvents', event.id, nextPatch);

  return nextPatch;
}

async function processEvent(env, event, options = {}) {
  if (!event?.id) return { ok: false, reason: 'missing-event-id' };

  await markEvent(env, event, {
    errorMessage: '',
    status: 'processing',
  });

  try {
    const subscriptions = await resolveSubscriptionsForEvent(env, event);

    if (options.dryRun) {
      await markEvent(env, event, {
        errorMessage: `dry-run subscriptions=${subscriptions.length}`,
        status: 'pending',
      });

      return {
        dryRun: true,
        eventId: event.id,
        subscriptionCount: subscriptions.length,
      };
    }

    const result = await sendOneSignalNotification(env, event, subscriptions);

    await markEvent(env, event, {
      errorMessage: '',
      sentAt: new Date().toISOString(),
      status: 'sent',
    });

    return {
      eventId: event.id,
      oneSignal: result.payload,
      sent: true,
      subscriptionCount: result.subscriptionCount,
    };
  } catch (error) {
    await markEvent(env, event, {
      errorMessage: String(error?.message || error).slice(0, 1000),
      status: 'failed',
    });

    return {
      error: String(error?.message || error),
      eventId: event.id,
      sent: false,
    };
  }
}

async function processPendingEvents(env, options = {}) {
  const limit = Math.max(1, Math.min(50, Number(options.limit || env.DEFAULT_LIMIT || 10)));
  const events = options.eventId
    ? [await getDocument(env, 'notificationEvents', options.eventId)].filter(Boolean)
    : await fetchPendingEvents(env, limit);

  const results = [];

  for (const event of events) {
    results.push(await processEvent(env, event, options));
  }

  return {
    count: results.length,
    dryRun: Boolean(options.dryRun),
    results,
  };
}

function isAuthorized(request, env) {
  const expected = getEnv(env, 'WORKER_SECRET');
  const received = request.headers.get('x-studio37-worker-secret') || '';

  return expected && received && expected === received;
}

async function parseJsonBody(request) {
  if (request.method === 'GET') return {};

  const text = await request.text();
  if (!text) return {};

  return JSON.parse(text);
}

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return jsonResponse({
      ok: true,
      service: 'studio37-onesignal-notification-worker',
      time: new Date().toISOString(),
    });
  }

  if (url.pathname === '/process' && request.method === 'POST') {
    if (!isAuthorized(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await parseJsonBody(request);
    const result = await processPendingEvents(env, {
      dryRun: Boolean(body.dryRun),
      eventId: body.eventId,
      limit: body.limit,
    });

    return jsonResponse(result);
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return jsonResponse({
        error: String(error?.message || error),
        ok: false,
      }, { status: 500 });
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(processPendingEvents(env, {
      limit: Number(env.DEFAULT_LIMIT || 10),
    }));
  },
};
