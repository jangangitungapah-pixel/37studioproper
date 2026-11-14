import { z } from 'zod';
import {
  doc,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

export const REPOSITORY_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  CLIENT: 'client',
  GUARD: 'studio_guard',
});

const identifierSchema = z.string()
  .min(2)
  .max(48)
  .regex(/^[a-z][a-z0-9-]*$/);

const requestIdSchema = z.string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const repositoryOperationInputSchema = z.object({
  actorUid: z.string().min(1).max(128).refine((value) => !value.includes('/')),
  scope: identifierSchema,
  action: identifierSchema,
  requestId: requestIdSchema,
}).strict();

export const repositoryOperationResultSchema = z.object({
  collection: z.string().max(64).refine((value) => (
    value === '' || /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)
  )),
  id: z.string().max(160).refine((value) => (
    value === '' || /^[^/]{1,160}$/.test(value)
  )),
}).strict().superRefine((value, context) => {
  if ((value.collection === '') !== (value.id === '')) {
    context.addIssue({
      code: 'custom',
      message: 'Collection dan ID hasil harus sama-sama kosong atau sama-sama terisi.',
    });
  }
});

export class RepositoryValidationError extends Error {
  constructor(operationName, validationError) {
    super('Input tidak valid untuk operasi repository: ' + operationName);
    this.name = 'RepositoryValidationError';
    this.validationError = validationError;
  }
}

export class RepositoryIdempotencyConflictError extends Error {
  constructor(operationId) {
    super('Idempotency key sudah digunakan dengan payload berbeda: ' + operationId);
    this.name = 'RepositoryIdempotencyConflictError';
    this.operationId = operationId;
  }
}

export class RepositoryConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RepositoryConfigurationError';
  }
}

export function parseRepositoryInput(schema, input, operationName = 'Firestore operation') {
  if (!schema || typeof schema.safeParse !== 'function') {
    throw new TypeError('Schema Zod wajib diberikan.');
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new RepositoryValidationError(operationName, parsed.error);
  }

  return parsed.data;
}

/**
 * Resolve a UI convenience principal from canonical Firebase Auth and /users/{uid}
 * snapshots. Pass ownershipControl as null only after confirming that the
 * adminControl/ownership document does not exist. Undefined means unknown and
 * therefore denies Owner access. Firestore Security Rules remain authoritative.
 */
export function buildRepositoryPrincipal(options = {}) {
  const {
    authUid = '',
    userProfile = null,
    ownershipControl,
  } = options;

  const uid = typeof authUid === 'string' ? authUid : '';
  const profileMatches = Boolean(
    uid &&
    userProfile &&
    userProfile.uid === uid
  );
  const role = profileMatches ? userProfile.role : 'anonymous';
  const status = profileMatches ? userProfile.status : 'signed_out';
  const permissions = (
    profileMatches &&
    userProfile.permissions &&
    typeof userProfile.permissions === 'object' &&
    !Array.isArray(userProfile.permissions)
  ) ? userProfile.permissions : {};

  const ownershipWasResolved = Object.prototype.hasOwnProperty.call(
    options,
    'ownershipControl',
  );
  const ownerActive = profileMatches &&
    role === REPOSITORY_ROLES.OWNER &&
    status === 'approved' &&
    ownershipWasResolved &&
    (
      ownershipControl === null ||
      ownershipControl?.currentOwnerUid === uid
    );

  const adminActive = profileMatches &&
    role === REPOSITORY_ROLES.ADMIN &&
    status === 'approved';
  const clientActive = profileMatches &&
    role === REPOSITORY_ROLES.CLIENT &&
    status === 'active';
  const guardActive = profileMatches &&
    role === REPOSITORY_ROLES.GUARD &&
    status === 'approved';
  const active = ownerActive || adminActive || clientActive || guardActive;

  return Object.freeze({
    uid: profileMatches ? uid : '',
    role,
    status,
    active,
    isOwner: Boolean(ownerActive),
    isAdmin: Boolean(adminActive),
    isClient: Boolean(clientActive),
    isGuard: Boolean(guardActive),
    hasPermission(permissionKey) {
      if (!active || typeof permissionKey !== 'string' || !permissionKey) {
        return false;
      }
      if (ownerActive) return true;
      if (!adminActive) return false;
      return permissions[permissionKey] === true;
    },
  });
}

export function canonicalizeRepositoryPayload(value) {
  const seen = new Set();

  function normalize(input) {
    if (input === null || typeof input === 'string' || typeof input === 'boolean') {
      return input;
    }

    if (typeof input === 'number') {
      if (!Number.isFinite(input)) {
        throw new TypeError('Payload repository hanya menerima angka finite.');
      }
      return Object.is(input, -0) ? 0 : input;
    }

    if (input instanceof Date) {
      if (Number.isNaN(input.getTime())) {
        throw new TypeError('Tanggal payload tidak valid.');
      }
      return input.toISOString();
    }

    if (typeof input !== 'object') {
      throw new TypeError('Payload repository harus berupa JSON-compatible data.');
    }

    if (seen.has(input)) {
      throw new TypeError('Payload repository tidak boleh memiliki circular reference.');
    }

    seen.add(input);

    let normalized;
    if (Array.isArray(input)) {
      normalized = input.map((item) => normalize(item));
    } else {
      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('Payload repository hanya menerima plain object.');
      }

      normalized = {};
      for (const key of Object.keys(input).sort()) {
        if (input[key] === undefined) {
          throw new TypeError('Payload repository tidak boleh memiliki nilai undefined.');
        }
        normalized[key] = normalize(input[key]);
      }
    }

    seen.delete(input);
    return normalized;
  }

  return JSON.stringify(normalize(value));
}

async function sha256Hex(value) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof TextEncoder === 'undefined') {
    throw new RepositoryConfigurationError(
      'Web Crypto SHA-256 tidak tersedia di runtime ini.',
    );
  }

  const bytes = new TextEncoder().encode(value);
  const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function createRepositoryRequestId() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new RepositoryConfigurationError(
      'crypto.randomUUID() tidak tersedia untuk membuat request ID.',
    );
  }

  return 'req_' + globalThis.crypto.randomUUID();
}

export async function createRepositoryOperationId(input) {
  const parsed = parseRepositoryInput(repositoryOperationInputSchema, input);
  const identity = [
    parsed.actorUid,
    parsed.scope,
    parsed.action,
    parsed.requestId,
  ].join('\u0000');

  return 'v1_' + await sha256Hex(identity);
}

export async function createRepositoryPayloadHash(payload) {
  return sha256Hex(canonicalizeRepositoryPayload(payload));
}


/**
 * Build a bounded Firestore WriteBatch wrapper.
 *
 * Use batches only when the caller has already determined the complete write
 * set and no read-dependent decision is needed. Use a transaction for
 * optimistic concurrency, state transitions, or idempotency markers.
 *
 * The default cap is 450 writes to leave headroom below Firestore's 500-write
 * batch ceiling. This helper counts document writes, not Rules document-access
 * calls. Rules' 10/20 access-call budgets still apply independently.
 */
export function createRepositoryWriteBatch(db, options = {}) {
  if (!db) {
    throw new RepositoryConfigurationError('Firestore Database wajib diberikan.');
  }

  const maxWrites = options.maxWrites ?? 450;
  if (!Number.isInteger(maxWrites) || maxWrites < 1 || maxWrites > 500) {
    throw new RangeError('maxWrites harus berupa integer antara 1 dan 500.');
  }

  const batch = writeBatch(db);
  let writeCount = 0;
  let committed = false;
  let result = null;

  function reserveWrite() {
    if (committed) {
      throw new Error('Repository batch sudah di-commit dan tidak dapat diubah.');
    }
    if (writeCount >= maxWrites) {
      throw new RangeError('Repository batch melewati batas ' + maxWrites + ' writes.');
    }
    writeCount += 1;
  }

  const api = {
    set(reference, data, setOptions) {
      reserveWrite();
      if (setOptions === undefined) {
        batch.set(reference, data);
      } else {
        batch.set(reference, data, setOptions);
      }
      return api;
    },
    update(reference, data) {
      reserveWrite();
      batch.update(reference, data);
      return api;
    },
    delete(reference) {
      reserveWrite();
      batch.delete(reference);
      return api;
    },
    get writeCount() {
      return writeCount;
    },
    async commit() {
      if (committed) {
        throw new Error('Repository batch hanya dapat di-commit satu kali.');
      }
      if (writeCount === 0) {
        throw new Error('Repository batch kosong tidak dapat di-commit.');
      }

      committed = true;
      await batch.commit();
      result = Object.freeze({ writeCount });
      return result;
    },
  };

  return Object.freeze(api);
}

/**
 * Execute one user-intended Firestore operation at most once per actor/scope/
 * action/requestId, as long as its operation marker is retained.
 *
 * requestId must be generated once when the user initiates the action and
 * reused for every retry. The execute callback may run more than once because
 * Firestore can retry transactions. It must therefore be deterministic and
 * side-effect free outside the supplied transaction. Do all transaction.get()
 * calls before the first transaction write. Never send email, call APIs,
 * mutate React state, or generate fresh IDs/timestamps inside execute.
 *
 * The marker is only an idempotency/replay record. It grants no access to the
 * result document; every domain document remains protected by its own Rules.
 */
export async function runIdempotentFirestoreTransaction({
  db,
  actorUid,
  scope,
  action,
  requestId,
  payload,
  execute,
  transactionOptions,
  markerWriteMode = 'transaction',
}) {
  if (!db) {
    throw new RepositoryConfigurationError('Firestore Database wajib diberikan.');
  }
  if (typeof execute !== 'function') {
    throw new TypeError('Callback execute wajib berupa function.');
  }
  if (!['transaction', 'after'].includes(markerWriteMode)) {
    throw new TypeError('markerWriteMode harus transaction atau after.');
  }

  const operationInput = parseRepositoryInput(
    repositoryOperationInputSchema,
    { actorUid, scope, action, requestId },
    scope + ':' + action,
  );
  const payloadHash = await createRepositoryPayloadHash(payload);
  const operationId = await createRepositoryOperationId(operationInput);
  const markerRef = doc(
    db,
    'users',
    operationInput.actorUid,
    'repositoryOperations',
    operationId,
  );

  const transactionCallback = async (transaction) => {
    const markerSnapshot = await transaction.get(markerRef);

    if (markerSnapshot.exists()) {
      const existing = markerSnapshot.data();
      const matches = existing.actorUid === operationInput.actorUid &&
        existing.scope === operationInput.scope &&
        existing.action === operationInput.action &&
        existing.requestId === operationInput.requestId &&
        existing.payloadHash === payloadHash;

      if (!matches) {
        throw new RepositoryIdempotencyConflictError(operationId);
      }

      return {
        operationId,
        result: {
          collection: existing.resultCollection,
          id: existing.resultId,
        },
        replayed: true,
      };
    }

    const result = parseRepositoryInput(
      repositoryOperationResultSchema,
      await execute(transaction, {
        actorUid: operationInput.actorUid,
        scope: operationInput.scope,
        action: operationInput.action,
        requestId: operationInput.requestId,
        operationId,
        payloadHash,
      }),
      operationInput.scope + ':' + operationInput.action + ' result',
    );

    if (markerWriteMode === 'transaction') {
      transaction.set(markerRef, {
        operationId,
        actorUid: operationInput.actorUid,
        scope: operationInput.scope,
        action: operationInput.action,
        requestId: operationInput.requestId,
        payloadHash,
        resultCollection: result.collection,
        resultId: result.id,
        createdAt: serverTimestamp(),
      });
    }

    return {
      operationId,
      result,
      replayed: false,
    };
  };

  const operation = transactionOptions
    ? await runTransaction(db, transactionCallback, transactionOptions)
    : await runTransaction(db, transactionCallback);

  if (markerWriteMode === 'after' && !operation.replayed) {
    const marker = {
      operationId,
      actorUid: operationInput.actorUid,
      scope: operationInput.scope,
      action: operationInput.action,
      requestId: operationInput.requestId,
      payloadHash,
      resultCollection: operation.result.collection,
      resultId: operation.result.id,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(markerRef, marker);
    } catch (error) {
      const existingSnapshot = await getDocFromServer(markerRef);
      const existing = existingSnapshot.exists() ? existingSnapshot.data() : null;
      const matches = existing &&
        existing.operationId === operationId &&
        existing.actorUid === operationInput.actorUid &&
        existing.scope === operationInput.scope &&
        existing.action === operationInput.action &&
        existing.requestId === operationInput.requestId &&
        existing.payloadHash === payloadHash &&
        existing.resultCollection === operation.result.collection &&
        existing.resultId === operation.result.id;
      if (!matches) throw error;
    }
  }

  return operation;
}
