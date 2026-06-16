
const SESSION_KEY = '37musicstudio.admin.session.v1';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

const ADMIN_USERNAME = String(import.meta.env.VITE_ADMIN_USERNAME || '').trim();
const ADMIN_PASSWORD = String(import.meta.env.VITE_ADMIN_PASSWORD || '');

function now() {
  return Date.now();
}

function makeSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return String(now()) + '-' + Math.random().toString(16).slice(2);
}

function removeStoredSession(notify = false) {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(SESSION_KEY);

  if (notify) {
    window.dispatchEvent(new Event('admin-auth-change'));
  }
}

function readStorage() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    removeStoredSession(false);
    return null;
  }
}

function isFreshSession(session) {
  return Boolean(
    session &&
      session.sessionId &&
      session.username &&
      Number.isFinite(session.issuedAt) &&
      Number.isFinite(session.expiresAt) &&
      session.expiresAt > now()
  );
}

export function isAdminCredentialConfigured() {
  return Boolean(ADMIN_USERNAME && ADMIN_PASSWORD);
}

export function getAdminSession() {
  const session = readStorage();

  if (!isFreshSession(session)) {
    removeStoredSession(false);
    return null;
  }

  return session;
}

export function isAdminAuthenticated() {
  return Boolean(getAdminSession());
}

export function loginAdmin({ username, password }) {
  if (!isAdminCredentialConfigured()) {
    return { ok: false, reason: 'CONFIG_MISSING' };
  }

  const cleanUsername = String(username || '').trim();
  const cleanPassword = String(password || '');

  if (cleanUsername !== ADMIN_USERNAME || cleanPassword !== ADMIN_PASSWORD) {
    return { ok: false, reason: 'INVALID_CREDENTIALS' };
  }

  const issuedAt = now();
  const session = {
    sessionId: makeSessionId(),
    username: cleanUsername,
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_MS,
  };

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event('admin-auth-change'));

  return { ok: true, session };
}

export function clearAdminSession() {
  removeStoredSession(true);
}
