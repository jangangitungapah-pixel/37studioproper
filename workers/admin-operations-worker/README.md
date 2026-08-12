# 37 Studio Admin Operations Worker

Protected command boundary for operations that must not be assembled from stale browser state:

- payment, refund, invoice void, and payment-proof review;
- inventory stock adjustment with an immutable movement;
- Owner-only Gallery permanent delete;
- Owner-only ownership transfer with the one-Owner invariant;
- resumable Danger Zone dry-run and delete jobs.

The browser sends a current Firebase ID token and an `X-Idempotency-Key`. The Worker verifies the token, reloads the user role/permission from Firestore, applies optimistic document preconditions, and commits the domain mutation, deterministic operation key, and audit record together.

## Local configuration

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` from a service account that can access the configured project.
3. Set the Cloudinary credentials before permanently deleting Gallery items linked to Cloudinary. Without them, the operation fails safely and keeps the Firestore metadata retryable.
4. Keep `.dev.vars` out of source control.

Run `npm install`, `npm run types`, then `npm run dev` inside this directory. The production values must be configured as Worker secrets; do not place them in `wrangler.jsonc` or in the Vite application.

## Safety model

- `SITE_ORIGIN` limits browser CORS; every protected route still requires Firebase authorization.
- Financial writes and stock adjustments are idempotent and use Firestore update-time preconditions.
- Gallery deletion removes Cloudinary first and keeps metadata when external deletion fails.
- Danger Zone requires Owner, a recent login for job creation, a server dry-run, the exact phrase, a final checkbox, and resumable 200-document steps. Canonical account documents, Firebase Auth identities, and Cloudinary files are explicitly outside the reset job so ownership/bootstrap history cannot reactivate or lock out the Owner.
- `adminOperationKeys`, `adminOperationAudit`, `adminOperationDryRuns`, and `adminOperationJobs` are server-only collections and remain outside the reset scope.
