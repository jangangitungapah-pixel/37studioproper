function requiredEnv(env, key) {
  const value = String(env[key] || '').trim();
  if (!value) throw new Error(`Missing required environment binding: ${key}`);
  return value;
}

function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });

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

async function createServiceAccountJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
    iss: requiredEnv(env, 'FIREBASE_CLIENT_EMAIL'),
    scope: 'https://www.googleapis.com/auth/datastore',
  };
  const signingInput = [
    base64UrlEncode(JSON.stringify(header)),
    base64UrlEncode(JSON.stringify(claim)),
  ].join('.');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(requiredEnv(env, 'FIREBASE_PRIVATE_KEY')),
    { hash: 'SHA-256', name: 'RSASSA-PKCS1-v1_5' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function fetchAccessToken(env) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    body: new URLSearchParams({
      assertion: await createServiceAccountJwt(env),
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
  const payload = await response.json();

  if (!response.ok || !payload?.access_token) {
    throw new Error(`Firebase service authentication failed (${response.status}).`);
  }

  return {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 3600)) * 1000,
  };
}

export function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nested]) => [key, encodeValue(nested)]),
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

export function decodeValue(value = {}) {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

export function encodeFields(data = {}) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)]));
}

export function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function assertPathSegment(value, label) {
  const clean = String(value || '').trim();
  if (!clean || clean.includes('/') || clean.length > 500) {
    throw new Error(`Invalid Firestore ${label}.`);
  }
  return clean;
}

export async function stableDocumentId(prefix, rawKey) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${prefix}:${rawKey}`),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return `${prefix}_${hex.slice(0, 40)}`;
}

export function createFirestoreClient(env) {
  const projectId = requiredEnv(env, 'FIREBASE_PROJECT_ID');
  const databaseRoot = `projects/${projectId}/databases/(default)`;
  const documentRoot = `${databaseRoot}/documents`;
  let tokenPromise = null;

  async function token(forceRefresh = false) {
    if (forceRefresh) tokenPromise = null;
    if (!tokenPromise) tokenPromise = fetchAccessToken(env);
    let tokenState = await tokenPromise;

    if (tokenState.expiresAt <= Date.now() + 60_000) {
      tokenPromise = fetchAccessToken(env);
      tokenState = await tokenPromise;
    }

    return tokenState.accessToken;
  }

  function documentName(collectionId, documentId) {
    return `${documentRoot}/${assertPathSegment(collectionId, 'collection')}/${assertPathSegment(documentId, 'document id')}`;
  }

  async function api(path, init = {}) {
    const requestUrl = `https://firestore.googleapis.com/v1/${path}`;
    const send = async (forceRefresh = false) => fetch(requestUrl, {
      ...init,
      headers: {
        authorization: `Bearer ${await token(forceRefresh)}`,
        'content-type': 'application/json',
        ...(init.headers || {}),
      },
    });
    let response = await send();
    if (response.status === 401) response = await send(true);
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(payload?.error?.message || `Firestore request failed (${response.status}).`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function getDocument(collectionId, documentId) {
    try {
      const document = await api(documentName(collectionId, documentId));
      return {
        createTime: document.createTime || '',
        data: decodeFields(document.fields || {}),
        id: document.name?.split('/').pop() || documentId,
        name: document.name,
        updateTime: document.updateTime || '',
      };
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  async function listDocuments(collectionId, { pageSize = 250, pageToken = '' } = {}) {
    const params = new URLSearchParams({ pageSize: String(Math.max(1, Math.min(500, pageSize))) });
    if (pageToken) params.set('pageToken', pageToken);
    const payload = await api(`${documentRoot}/${assertPathSegment(collectionId, 'collection')}?${params}`);

    return {
      documents: (payload.documents || []).map((document) => ({
        data: decodeFields(document.fields || {}),
        id: document.name?.split('/').pop() || '',
        name: document.name,
        updateTime: document.updateTime || '',
      })),
      nextPageToken: payload.nextPageToken || '',
    };
  }

  async function runQuery(structuredQuery) {
    const rows = await api(`${documentRoot}:runQuery`, {
      body: JSON.stringify({ structuredQuery }),
      method: 'POST',
    });

    return (rows || [])
      .filter((row) => row.document)
      .map((row) => ({
        data: decodeFields(row.document.fields || {}),
        id: row.document.name?.split('/').pop() || '',
        name: row.document.name,
        updateTime: row.document.updateTime || '',
      }));
  }

  async function commit(writes) {
    return api(`${databaseRoot}/documents:commit`, {
      body: JSON.stringify({ writes }),
      method: 'POST',
    });
  }

  function setWrite(collectionId, documentId, data, precondition = null) {
    return {
      update: {
        fields: encodeFields(data),
        name: documentName(collectionId, documentId),
      },
      ...(precondition ? { currentDocument: precondition } : {}),
    };
  }

  function deleteWrite(collectionId, documentId, precondition = null) {
    return {
      delete: documentName(collectionId, documentId),
      ...(precondition ? { currentDocument: precondition } : {}),
    };
  }

  return {
    commit,
    deleteWrite,
    documentName,
    getDocument,
    listDocuments,
    projectId,
    runQuery,
    setWrite,
  };
}
