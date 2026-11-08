# Firebase Single-Backend Migration Plan

**Project:** 37Studio Proper  
**Target Firebase project:** `studio-proper`  
**Target Hosting site:** `studio-37` (`https://studio-37.web.app`)  
**Architecture decision date:** 2026-11-09  
**Status:** Approved direction; migration not yet implemented

## 1. Objective

Make Firebase the only application backend for 37Studio Proper:

- Firebase Authentication for identities and sessions.
- Cloud Firestore for all operational, financial, scheduling, customer, inventory, procurement, maintenance, notification, and application data.
- Firestore Security Rules for every read/write authorization boundary and schema/invariant validation that can be enforced by Rules.
- Firebase Hosting for the static SPA.

Cloudflare Workers must be removed from the application request path and retired after all operations have been migrated and production usage has been verified.

**Media exception:** Cloudinary may remain only for Gallery photo binaries. Gallery metadata, albums, tags, status, trash, and references remain in Firestore.

**Billing constraint:** Keep project `studio-proper` on Firebase Spark. Do not link Cloud Billing, upgrade to Blaze, provision Cloud Functions, or introduce Cloud Storage for Firebase. No payment method or trial subscription may be added.

## 2. Current-state audit

### 2.1 Data is already primarily in Firestore

The existing repository's `docs/firebase-data-audit.md` identifies Firestore as authoritative for existing business data. Local storage is described as a temporary/offline/migration cache for legacy booking/customer data and UI preferences. The migration is therefore primarily an **operation, authorization, and integration migration**, not a wholesale database-provider migration.

Current Firestore areas identified in source/rules/audits include:

- Identity and authorization: `users`, role/permission records.
- CRM: `customers`, `customerFollowUpTasks`, `customerFollowUpEvents`.
- Booking and schedule: `bookings`, `clientCalendarSlots`, `bookingMessages`, booking session/event records.
- Studio configuration: `settings/pricing`, `settings/invoice`, studio settings and related configuration documents.
- Finance: `bookkeepingEntries`, payment proof metadata, invoices/payment state, daily closing sessions/events, refunds/voids and payment history.
- Inventory and procurement: `inventoryItems`, `inventoryMovements`, `suppliers`, `purchaseOrders`, `goodsReceipts`, `procurementPayments`, `procurementEvents`.
- Maintenance: `maintenanceWorkOrders`, `maintenanceEvents`.
- Gallery: Firestore metadata and lifecycle state; binary assets currently use Cloudinary.
- In-app activity: `notificationEvents`.
- Guard attendance and related operational records.

Do not create replacement collections or migrate existing records unless the domain audit proves a schema change is unavoidable. Preserve document IDs, ownership fields, audit history, timestamps, idempotency references, and relationships.

### 2.2 Cloudflare Admin Operations Worker is the remaining operational API

The frontend service `src/services/adminOperationsRepository.js` routes privileged operations through `VITE_ADMIN_OPERATIONS_URL`. The Worker uses Firebase ID-token verification, a service-account credential, Firestore REST API access, and domain-specific mutation logic.

The current endpoint families are:

| Domain | Current Worker operations |
|---|---|
| Booking | Create manual booking; decide booking request; update manual booking |
| Booking sessions | Record session lifecycle action |
| Finance | Record payment; refund; void; payment-proof approval/rejection |
| Daily closing | Preview; close; Owner-only reopen |
| Customer follow-up | List PICs; create/update/cancel task |
| Inventory | Save/archive item; adjust stock |
| Procurement | Create supplier/PO; transition PO; receive goods; record procurement payment |
| Maintenance | Create work order; lifecycle action/reopen; record cost |
| Account | Transfer Owner role |
| Danger Zone | Dry-run; start job; step job; read job |
| Gallery | Owner-only permanent Cloudinary asset deletion |

Each route must be replaced with a Firebase client SDK repository operation and matching Firestore Security Rules contract before its Worker route can be removed.

### 2.3 Other integrations and residues

- **EmailJS:** Used to send a new Admin registration notification. This is an external email provider and must be removed to meet the single-backend direction. Replace the email notification with a Firestore-backed Owner/Admin approval inbox and in-app activity. Firebase Auth-managed password-reset/verification flows remain native Auth flows.
- **OneSignal:** Existing code/audits describe OneSignal removal from the application and an immutable Firestore in-app activity feed. Verify that the legacy `onesignal-notification-worker` has no active consumers, then retire its repository/configuration residue. Do not reintroduce push delivery as part of this migration.
- **Firebase AI Logic:** Existing integration uses `firebase/ai` with `GoogleAIBackend` and a reviewed no-billing model allowlist. Keep only while the selected model/backend remains eligible for the no-billing plan and quota failures remain explicit.
- **Cloudinary:** Keep the Gallery image upload path only. Current payment-proof upload also uses Cloudinary and is therefore outside the newly approved exception. Decide whether payment proof becomes metadata/reference-only (recommended under Spark), or whether the user explicitly approves retaining an additional media exception.
- **Cloud Storage for Firebase:** Not an option under the Spark-only constraint. The current Firebase documentation states Cloud Storage for Firebase requires Blaze; projects on Spark lose bucket access. Do not attempt to use it as a substitute for payment-proof images.

## 3. Target architecture and security model

### 3.1 Client-to-Firebase request path

The application should use Firebase Web SDK directly:

- Firebase Auth provides the authenticated identity.
- Firestore reads use narrowly scoped queries whose constraints are provable by Rules.
- Firestore writes use transactions or batched writes for multi-document invariants.
- Firestore Rules enforce role/permission checks, ownership, allowed fields, valid state transitions where feasible, and append-only audit/event documents.
- All IDs for idempotent operations are generated before the transaction and stored with the operation/audit records.
- No service-account credential, private key, Admin SDK credential, privileged API secret, or server token may be shipped in the browser bundle.

### 3.2 Security limitations to design around

This architecture intentionally has no trusted custom server runtime on Spark. Client-side business logic is never treated as a security boundary. Firestore Rules must reject forged fields, unauthorized transitions, cross-user writes, direct ledger manipulation, and writes that omit required companion documents.

Firestore Rules have documented access-call limits: 10 document access calls for a single-document/query request and 20 for a multi-document read, transaction, or batch, with the 10-call limit also applying to each individual operation. Access calls may also incur reads. Rules must be designed and emulator-tested against these limits.

Firestore transactions/batches are atomic, and Rules `getAfter()` can validate related documents after an atomic operation. Transaction callbacks may retry; they must not perform external side effects or mutate React/application state.

### 3.3 Authentication administration limitations

The Firebase Admin SDK is a trusted-server API for listing users and managing arbitrary users' Auth properties. It cannot be moved into the browser.

The migration must distinguish:
- Operations supported with the signed-in user's Auth session and normal Web SDK.
- Owner-controlled Firestore role/status lifecycle operations.
- Auth administration operations that require Admin SDK privileges.

Do not emulate Admin SDK power by exposing credentials. Where a server-only Auth action cannot be safely implemented on Spark, redesign the feature (for example, deactivate an account in Firestore authorization state instead of disabling/deleting its Auth identity). User identities must not be silently deleted.

## 4. Migration workstreams

### Phase 0 — Architecture baseline and domain inventory
- [x] Record the single-Firebase-backend direction.
- [x] Inventory current Worker endpoint families and external providers.
- [x] Record Spark limitations and unresolved media/Auth lifecycle decisions.
- [ ] Verify every repository and Firestore collection against the source, not only existing audit documents.
- [ ] Map each Worker operation to current direct Firestore repository/rules/test coverage.
- [ ] Capture production rules and index baselines before implementation.

**Exit:** reviewed migration matrix, no unclassified Worker route or external data provider.

### Phase 1 — Firebase repository foundation and security contracts
- Build shared Firestore transaction/batch helpers with explicit idempotency and safe retry behavior.
- Define per-domain data validators and Firestore Rules contracts.
- Add emulator tests for positive/negative roles, tampered payloads, invalid transitions, atomic companion writes, and cross-user isolation.
- Add quota/read-cost safeguards and bounded query/listener behavior.
- No production writes or deployments in this phase.

**Exit:** reusable repository patterns and security tests pass without broad wildcard grants.

### Phase 2 — Booking, schedule, and booking-session operations
- Migrate manual booking creation/update, booking-request decisions, and session lifecycle actions.
- Preserve request/confirmation/cancellation states, immutable client ownership, schedule collision checks, calendar slot mirrors, and message history.
- Use atomic writes for every cross-document invariant.

**Exit:** booking lifecycle regression suite and emulator rules tests pass.

### Phase 3 — Finance, payment, proof review, and daily closing
- Migrate payment posting, refund, void, payment-proof review, bookkeeping journal, daily closing preview/close/reopen.
- Preserve ledger immutability, source linkage, idempotency, reconciliation, closed-day write guards, and audit history.
- Resolve payment-proof binary handling before implementation. Firebase Storage is not allowed on Spark; default plan is proof metadata/reference-only plus manual review, with no image binary stored in Firestore.

**Exit:** payment/bookkeeping reconciliation and concurrent update regression tests pass.

### Phase 4 — Customer, follow-up, inventory, procurement, and maintenance
- Migrate follow-up task lifecycle and PIC discovery to direct Auth/Firestore reads/writes.
- Migrate inventory save/archive/adjustment, supplier/PO/receipt/payment lifecycle, and maintenance work-order/cost lifecycle.
- Preserve stock movement records, procurement event history, idempotency, role boundaries, and linked bookkeeping effects.

**Exit:** all domain lifecycle, inventory balance, procurement and maintenance tests pass.

### Phase 5 — Owner, account, Danger Zone, and Gallery lifecycle
- Replace Worker-based ownership transfer with an atomic and reauthenticated Firestore owner-role transition.
- Review current secondary Firebase Auth provisioning flow; keep only operations possible using normal client SDK, without adding privileged credentials.
- Redesign account deactivation/deletion where Auth Admin SDK operations cannot be performed safely on Spark.
- Redesign Danger Zone as bounded, resumable, Owner-only Firestore cleanup that preserves Auth users, the active Owner, and Gallery media. Keep dry-run and explicit confirmation.
- Keep Gallery photo upload and metadata in their approved split. Permanent Cloudinary asset deletion cannot expose the Cloudinary API secret in the browser; choose between manual asset cleanup or retaining a narrowly scoped trusted deletion mechanism only with a separate explicit exception.

**Exit:** no browser Admin SDK privileges, destructive operations remain Owner-only, resumable and tested on emulator/synthetic data.

### Phase 6 — Retire Cloudflare and consolidate configuration
- Remove `VITE_ADMIN_OPERATIONS_URL`, `adminOperationsRepository.js` Worker wrappers, Worker service-account dependencies, Worker route contracts, Cloudflare-only runtime settings and no-longer-used secrets after all domains pass.
- Audit and retire `admin-operations-worker` and any unused OneSignal Worker after traffic and dependency checks.
- Remove EmailJS configuration and code after its Firestore approval inbox replacement is accepted.
- Keep Cloudinary configuration only for Gallery photos.
- Update architecture docs, .env examples, CI scanners, regression tests, runbooks, and handoff docs.
- Build/deploy Firebase Hosting only after complete regression and explicit deployment approval.

**Exit:** no operational feature calls a Cloudflare endpoint; no stale service-account credential remains necessary; the production SPA functions entirely against `studio-proper`.

## 5. Explicit exclusions and safety rules

- No project migration: keep Firebase project ID `studio-proper`.
- No Hosting site migration: keep `studio-37`.
- No new Firebase project or database.
- No Cloud Billing, Blaze, Free Trial, payment method, Firebase Cloud Functions, Firebase Storage, or Firebase Extensions.
- No change to Gallery photo binary provider beyond the approved Cloudinary exception.
- No broad replacement of Firestore Rules with a local rules file. Merge rules only after comparing against the active production ruleset and testing in emulator.
- No deletion/reformatting of production data to simplify migration.
- No destructive production test writes.
- No merge or production deployment without explicit user approval.

## 6. Current known incident state (2026-11-09)

- Firestore Follow-up read rules were published to `studio-proper` in the active `cloud.firestore/(default)` release. Active ruleset: `aa6d3469-9101-4c7a-8ede-bcba9894d38a`.
- Production browser error then identified the required composite index for `customerFollowUpTasks(status, dueAt, dueTime)`. The repository already contains active-task, completed-task, and event indexes. Production index deployment status must be checked before closing the incident.
- The production frontend's `VITE_ADMIN_OPERATIONS_URL` was found locally as `http://127.0.0.1:8787`. This is incompatible with production; it will be removed as part of the Firebase-only migration, not replaced with another Worker URL.
- Worker deployment was observed, but no Worker deployment is required by the target architecture.
- PR #17 (Follow-up query regression tests and guarded rules hotfix script) remains a separate open PR and is not merged by this plan.

## 7. Official constraints checked 2026-11-09

- Firebase Spark does not require payment information and includes defined free quotas for Firestore and Hosting.
- Cloud Functions access requires Blaze.
- Cloud Storage for Firebase requires Blaze; Spark projects lose access to buckets.
- Firestore Security Rules support `getAfter()` for atomic invariant checks but enforce 10/20 document-access-call limits.
- Firestore Web SDK transactions/batches are atomic, but transaction callbacks can retry.

References:
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/firestore/pricing
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/auth/admin/manage-users
