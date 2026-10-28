# Staging Acceptance Readiness — 2026-10-29

## Current status

- Code head reviewed: `2c8f6451e59a8c6ac36a6c7a49b7f82e5d348819`.
- Automated CI on that head: [run #94](https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/40777923883) passed build, lint, repository regression contracts, PRD/security contracts, Firestore Rules emulator checks, and Playwright responsive smoke.
- Authenticated Admin walkthrough: **not executed**.
- Live Firebase staging acceptance: **blocked pending a separately configured staging environment and staging test accounts**.
- No deployment or test mutation was sent to the production Firebase project.

## Environment readiness finding

The reviewed branch snapshot does not currently declare a separate staging alias or a staging deployment workflow:

- `.firebaserc` has only the default project `studio-proper`.
- `firebase.json` targets Hosting site `studio-37`.
- `workers/admin-operations-worker/wrangler.jsonc` declares `APP_ENVIRONMENT: production`, `FIREBASE_PROJECT_ID: studio-proper`, and `SITE_ORIGIN: https://studio-37.web.app`.
- `.env.example` documents the front-end Worker URL and Owner email variables but leaves values blank.
- The only workflow under `.github/workflows` is `quality-gates.yml`; it runs validation, not staging deployment.

These settings are treated as production-facing. Do not use the current default Firebase target or the production Worker to execute acceptance cases that create, edit, refund, void, transfer ownership, adjust inventory, or delete media.

## Required staging prerequisites

Complete these before running live acceptance:

- [ ] Create or identify a dedicated Firebase project used only for non-production acceptance. Record its exact project ID here: `<STAGING_FIREBASE_PROJECT_ID>`.
- [ ] Create a separate Hosting site/origin for the staging build. Record the URL here: `<STAGING_SITE_ORIGIN>`.
- [ ] Configure a separate Admin Operations Worker environment with `APP_ENVIRONMENT=staging`, the staging Firebase project ID, and the staging `SITE_ORIGIN`. Do not reuse the production service-account key or Worker secret set by default.
- [ ] Store Worker service-account and any Cloudinary credentials as staging-only secrets. Apply least privilege and use a disposable staging Cloudinary folder/prefix.
- [ ] Set the staging front-end `VITE_ADMIN_OPERATIONS_URL`, Firebase client configuration, Owner bootstrap email, and App Check site key through the staging deployment environment. Never commit tokens, private keys, debug tokens, or real account credentials.
- [ ] Deploy the branch's reviewed Firestore Rules and required indexes to the staging Firebase project. Verify the deployed project ID before deployment and again before testing.
- [ ] Seed only synthetic test records. Avoid production client records, real payment data, live booking customers, and production media.
- [ ] Create dedicated test identities: Owner, approved Admin with restricted permissions, pending/rejected Admin, Client, Guard, and a signed-out browser context.
- [ ] Record the staging build commit, Hosting URL, Firebase project ID, Worker deployment/version, and rules deployment time in the acceptance evidence.
- [ ] Confirm backups/cleanup plan and identify the person authorized to approve the staging sign-off.

## Acceptance procedure

### A. Environment isolation and portal access — P0

- [ ] Confirm the browser is on `<STAGING_SITE_ORIGIN>`, the frontend points to the staging Firebase project, and protected operations point to the staging Worker before creating any record.
- [ ] Signed-out user: direct-load and refresh `/admin/*`; access must be redirected/denied without protected data becoming visible.
- [ ] Active Client: verify `/client/portal` works, `/admin/*` is denied, and only that Client's own bookings/payment proofs are visible.
- [ ] Approved Admin: verify allowed navigation and direct routes for each enabled permission; disabled permission pages and protected operations must be denied even when loaded by URL.
- [ ] Pending/rejected Admin: verify no administrative data or protected mutations are available.
- [ ] Owner: verify allowed Owner-only operations and canonical ownership.
- [ ] Guard: verify own attendance workflow only; administrative pages and unrelated user/booking data are denied.
- [ ] Session change, logout, role/permission change, page refresh, and wrong-portal navigation must not preserve stale privilege or expose another account's data.
- [ ] Verify browser-side permission hiding is backed by Worker and Firestore denial behavior. Capture the expected denial in logs/network response without saving ID tokens.

**Pass criteria:** each role sees only authorized data, direct URL access cannot bypass permissions, and failed authorization causes no database mutation.

### B. Booking request, schedule and availability — P0/P1

Use synthetic clients, two test booking dates, and disposable calendar slots.

- [ ] Client submits a request for a free slot; Admin inbox shows it once and Client status reflects the request.
- [ ] Admin confirms the request; the booking, canonical status fields, calendar mirror, and client-visible status agree after refresh.
- [ ] Admin rejects another request with a reason; status and response note are visible to the Client. Rejection without a reason is rejected server-side.
- [ ] Create two overlapping requests and confirm them concurrently in separate sessions. Exactly one may claim the slot; the losing operation gets a conflict and leaves no duplicate booking/calendar mirror.
- [ ] Race confirmation against manual booking creation and against manual reschedule into the same slot. Exactly one conflicting mutation may commit.
- [ ] Confirm adjacent sessions whose boundary times touch are both allowed.
- [ ] A booking with `cancellation_requested` continues to hold its time until the cancellation is approved. After approved cancellation, availability is released consistently.
- [ ] Reload the calendar, request inbox, Client portal and public `/book` page and compare the result after each mutation.
- [ ] Verify invalid dates, empty/fractional/out-of-range start hours and stale schedule snapshots fail safely.

**Pass criteria:** no double booking; conflicts are clear; calendar, request and client-facing state converge; failed writes do not leave partial mirrors.

### C. Billing, payment proof, refunds, voids and bookkeeping — P0

Use disposable invoice amounts and an agreed test payment reference only. Do not connect a real payment provider or refund a real customer.

- [ ] Submit a synthetic payment proof and approve it as an authorized reviewer. Verify invoice paid amount/status, payment history, bookkeeping row and audit record agree.
- [ ] Race proof approval against a manual payment for the same invoice. Exactly one operation may apply to the stale invoice revision; the losing proof must remain pending or clearly require retry/review.
- [ ] Retry a successful operation with the same idempotency key. It must not add a second payment, ledger row, refund or audit mutation.
- [ ] Perform a partial refund, refresh the invoice and ledger, and verify net paid amount, refunded amount and outstanding balance.
- [ ] Test a duplicate refund request and a refund larger than the refundable amount; both must fail safely without ledger duplication.
- [ ] Void a disposable invoice with the permitted preconditions. Verify the booking availability/calendar mirror, invoice status, ledger, audit, and idempotency receipt all agree.
- [ ] Verify an Admin lacking billing/finance permission cannot post payment, approve proof, refund or void by invoking a protected endpoint directly.

**Pass criteria:** invoice and ledger totals reconcile, each accepted financial mutation is applied once, rejected/stale operations leave no partial writes, and audit history is durable.

### D. Inventory, Gallery, Owner transfer and Danger Zone — P0/P1

- [ ] Perform one synthetic inventory adjustment; verify resulting stock, immutable movement/audit trail and no duplicate effect on retry.
- [ ] Verify an unprivileged Admin cannot adjust stock through a direct Worker request.
- [ ] Test Gallery deletion only against a disposable staging asset under the configured staging prefix. Verify failure/retry restores or retains metadata safely. Never test deletion against production Cloudinary.
- [ ] If testing ownership transfer, use two dedicated staging identities and a recovery Owner. Verify exactly one canonical Owner after transfer; attempt a concurrent transfer and verify only one succeeds. Confirm the former Owner loses Owner-only authorization on its next protected request.
- [ ] Danger Zone is destructive: keep it out of routine acceptance unless an isolated disposable project, verified backup/cleanup process, and explicit approval are available. If explicitly tested, first capture dry-run scope and prove production identities/data are outside its target.

**Pass criteria:** every protected operation is authorized server-side, idempotent where required, auditable, and reversible or safely contained in disposable test data.

### E. Guard attendance and operator fee — P1

- [ ] Guard checks in and out using the dedicated Guard account; records must be UID-bound.
- [ ] Owner reviews attendance and the expected review state transitions are reflected after refresh.
- [ ] Reconcile operator/guard fee eligibility and totals against the synthetic booking/attendance; verify no duplicate posting on refresh/retry.
- [ ] Verify a Client, pending Admin, and unrelated Guard cannot view or mutate another Guard's attendance.

### F. Responsive UI and error states — P1/P2

Run authenticated walkthroughs at 390 px, 768 px and 1440 px. Automated Playwright CI covers the public landing and booking pages plus a signed-out direct Admin-route redirect at the three tested viewport sizes; it does **not** close authenticated Admin workflows or live staging checks.

- [ ] Visit dashboard, Requests, Calendar, All Bookings, Customers, Billing, Bookkeeping, Operator Fee, Guard Attendance, Inventory, Gallery, Settings and Notifications as the appropriate test role.
- [ ] Check loading, empty, success, permission-denied, validation-error, network-error and stale-conflict states.
- [ ] Check menu/dialog stacking, horizontal overflow, keyboard navigation/focus, reduced-motion behavior and usable mobile navigation.
- [ ] Check browser console for uncaught errors; capture desktop/tablet/mobile screenshots with environment and commit noted.

## Evidence record

Fill this in after the run. Do not paste credentials, cookies, Firebase ID tokens, customer PII or payment secrets.

- Acceptance date/time:
- Test operator:
- Commit SHA:
- Staging Hosting origin:
- Staging Firebase project ID:
- Staging Worker deployment/version:
- Firestore Rules/index deployment:
- Test record IDs (synthetic only):
- Screenshots/log references:
- Failed cases and follow-up issue links:
- Sign-off:

## Release decision

- [ ] All P0 environment, authorization, booking concurrency and finance checks passed.
- [ ] All P1 workflow and responsive checks passed, or remaining issues are documented and accepted by the release owner.
- [ ] Evidence is attached to the pull request.
- [ ] Release owner explicitly approves the deployment/merge decision.

Until the prerequisites and checks above are completed, staging acceptance remains **blocked / not run**, regardless of green CI. Keep the pull request draft and unmerged.
