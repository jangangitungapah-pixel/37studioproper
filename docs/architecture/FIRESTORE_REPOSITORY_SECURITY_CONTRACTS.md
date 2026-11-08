# Firestore Repository Foundation & Security Contracts

**Project:** 37Studio Proper  
**Firebase project:** studio-proper  
**Database:** (default)  
**Phase:** 1 — Firebase Repository Foundation & Security Contracts

## 1. Authority boundaries

- Firebase Authentication establishes the signed-in UID and verified Auth claims.
- /users/{uid} is the canonical application identity and role record.
- adminControl/ownership.currentOwnerUid is the current ownership pointer. Owner access must be consistent with both records.
- The repository principal helper in src/lib/firestoreRepositoryFoundation.js is a UI/application convenience only. Firestore Security Rules are the actual authorization boundary.
- Missing, mismatched, pending, inactive, unknown, or stale identities fail closed. An Admin permission is granted only when its stored value is explicitly true. Clients and Studio Guards do not inherit Admin page permissions.
- Do not use email-only UI helpers, cached role state, route visibility, or a repository callback as a security boundary.

## 2. Shared repository conventions

### Input validation

Every public repository mutation should parse its input with a strict Zod schema before constructing Firestore writes. Schemas should:

- Use .strict() unless legacy compatibility is explicitly documented.
- Bound string lengths, list sizes, numeric ranges, and optional fields.
- Reject unknown keys and client-supplied authority fields.
- Validate document IDs independently from payload IDs.
- Avoid silently normalizing an invalid financial amount or state into a valid one.

parseRepositoryInput(schema, input, operationName) provides a common error contract. Domain schemas remain next to their domain repository or model; this foundation does not guess domain-specific fields.

### Stable request IDs and idempotency

Generate one request ID when the user initiates an action using createRepositoryRequestId(). Keep that value through UI retries, network retries, and transaction retries. Never generate a new request ID inside a transaction callback.

The operation ID is deterministic for:

actorUid + scope + action + requestId

The payload fingerprint is SHA-256 over canonical JSON. Object keys are sorted, dates are normalized to ISO strings, and unsupported values, circular structures, non-finite numbers, and undefined fields are rejected.

runIdempotentFirestoreTransaction() stores one immutable marker at:

users/{actorUid}/repositoryOperations/{operationId}

The marker contains the actor, operation scope/action, request ID, payload hash, a result reference, and a server timestamp. A repeated request with the same identity and payload replays the stored result reference without executing the domain callback again. Reusing the same request ID with a different payload raises RepositoryIdempotencyConflictError.

The marker is an idempotency record, not an authorization grant. Every domain write and result read must independently pass its own Firestore Rules. The current contract permits an active user to create/read only their own marker; markers cannot be updated or deleted by clients. Product code must not expose a marker as a source of financial truth.

### Batch write helper

\`createRepositoryWriteBatch()\` wraps a Firestore WriteBatch with a configurable write ceiling (default 450, absolute maximum 500). It refuses empty commits, a second commit, and additions after commit. The wrapper counts document writes only; it does **not** replace Firestore Rules' 10/20 document-access-call budgets.

Use a batch only when the complete write set is already known and no read-dependent decision is needed. For state transitions, collision checks, ownership checks, idempotency, or any operation that must inspect current snapshots, use a transaction. Domain inputs must still pass strict validation before writes. Use deterministic document IDs and Rules that reject overwrites of append-only events so an ambiguous retry cannot mutate history.

### Transaction callback purity

Firestore can rerun a transaction callback. The callback must be deterministic and must not perform network calls, send notifications, emit analytics, modify application/UI state, mutate objects shared outside the callback, or generate IDs/timestamps that change across retries. Prepare document IDs, request IDs, timestamps, normalized payloads, and hashes before entering the transaction. Complete all transaction reads before the first transaction write.

For operations with external effects, persist the Firestore state first. An external delivery mechanism is not part of this Spark-only foundation and must not be hidden inside a transaction callback.

## 3. Role contract

| Role | Canonical status | Read/write baseline |
|---|---|---|
| Owner | role=owner, status=approved, ownership pointer matches or is not initialized | Full application permission, subject to explicit operation-specific Rules |
| Admin | role=admin, status=approved | Only explicit permissions[page] == true; no implicit grant for missing values |
| Client | role=client, status=active | Own client-scoped records and narrowly defined public reads |
| Studio Guard | role=studio_guard, status=approved | Own guard attendance and explicitly defined Guard operations; no Admin page permissions |
| Pending/rejected/unknown | Any non-active or mismatched identity | Deny |

The current canonical firestore.rules includes compatibility/bootstrap and legacy transition rules. Do not simplify or replace those rules wholesale in this phase. Any change must be reviewed against the active production ruleset baseline before deployment.

## 4. Atomic companion writes

For a multi-document business invariant:

1. Prepare all IDs and immutable inputs before the transaction.
2. Read all documents needed for collision, state, and permission checks.
3. Derive the intended state transition from the latest snapshots.
4. Write the primary document, companion/mirror document, append-only event, and idempotency marker in one atomic transaction when they must succeed or fail together.
5. Use getAfter() / existsAfter() in Rules to verify companion documents when the invariant spans documents.
6. Keep each rule's document-access budget below Firestore's limit: 10 calls for a single-document/query operation and 20 for a transaction/batch, with the per-operation 10-call limit still applying.

Existing Rules already contain getAfter() contracts for ownership initialization, client booking messages, Guard meal reconciliation, and Operator Fee bookkeeping reconciliation. The Emulator foundation test verifies the ownership profile + pointer pair. Domain migration phases must add positive and negative pair tests for each newly migrated operation. Do not assume a client transaction is safe merely because its writes are atomic; Rules must validate the post-write state.

## 5. Query and quota conventions

- Every real-time listener must have a documented scope and a bounded result set, or a clear justification for an unbounded small configuration collection.
- Prefer explicit limit() values for operational lists and paginate historical records.
- Do not run an unbounded collection read to discover existence or ownership.
- Query predicates must be compatible with Firestore Rules; rules are not post-query filters.
- Query changes must update firestore.indexes.json, the query audit, and the Emulator/CI contract.
- Keep realtime listeners to the smallest required collection and unsubscribe when their owning view is disposed.
- Never add a production seed or synthetic test write.

## 6. Current composite indexes in the repository

The current firestore.indexes.json contains:

1. customerFollowUpTasks(status ASC, dueAt ASC, dueTime ASC) — active Follow-up list.
2. customerFollowUpTasks(status ASC, completedAt DESC) — completed Follow-up list.
3. customerFollowUpEvents(taskId ASC, createdAt DESC) — per-task Follow-up event history.

These entries are repository configuration, not proof of successful deployment. The production deployment state must be verified separately. The active Follow-up query that raised a production missing-index error is covered locally by entry 1; do not add a duplicate entry.

Other observed queries use single-field ordering/equality or multiple ownership filters assembled in application code. Any query combining filters on different fields with ordering must be checked against the live Firestore index link and added to the repository if required. Emulator success alone is not evidence that a required production composite index is deployed.

## 7. Explicit non-goals

This foundation does not migrate Booking, Finance, payment proof, Follow-up, Inventory, Procurement, Maintenance, account provisioning, Danger Zone, or Gallery business writes. It does not remove Worker wrappers, EmailJS, Cloudinary upload code, or production configuration. Those changes belong to later phases in the approved migration plan.

No Cloud Billing, Blaze, Cloud Functions, Firebase Storage, Extensions, Admin SDK credentials, production rules deployment, production test writes, PR merge, or Hosting deployment is permitted by this phase.
