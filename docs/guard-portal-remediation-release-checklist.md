# GP8 FINAL RELEASE CHECKLIST — Guard Portal Remediation

Status target: GP0–GP7 implemented and automated gates green.

This checklist is the final release evidence for the Guard Portal remediation workstream. It does not introduce a new role model or attendance lifecycle.

## 1. Final canonical role matrix

| Account context | Guard Portal result | Operational Clock In/Out |
| --- | --- | --- |
| Owner approved | Owner Oversight | No |
| Admin approved | Admin Cross Portal | No |
| Admin pending/rejected | Blocked | No |
| Canonical Guard (studio_guard + approved + valid guardId) | Guard Operational | Yes |
| Guard approved + broken/missing crew link | Identity Repair | New Clock In blocked; existing UID-bound checkout/history preserved |
| Guard pending/rejected | Blocked | No |
| Client active | Wrong Portal Client | No |
| Unknown/invalid account | Recovery Required | No |

Legacy compatibility retired: approved Admin with stale `isGuard=true` is still Admin and must not become operational Guard.

## 2. Automated release gates

Run from repository root:

- `node scripts/guard-portal-final-regression-contract-test.mjs`
- `node scripts/guard-wrong-portal-auth-ux-contract-test.mjs`
- `node scripts/guard-legacy-isguard-migration-contract-test.mjs`
- `node scripts/guard-identity-link-contract-test.mjs`
- `node scripts/guard-attendance-reliability-contract-test.mjs`
- `node scripts/guard-attendance-owner-review-transition-contract-test.mjs`
- `node scripts/guard-role-transition-contract-test.mjs`
- `node scripts/guard-portal-isolation-contract-test.mjs`
- `npm run lint`
- `npm test`
- `npm run build`
- `git diff HEAD^ HEAD --check`

All commands must pass before the remediation is marked DONE.

## 3. Manual role / portal QA

### Owner Oversight
- Login as Owner.
- Open `/guard/attendance`.
- Confirm Owner Oversight card is visible.
- Confirm Clock In/Out controls are not available as Owner.
- Confirm "Kembali ke Admin" works without global logout.
- Confirm "Buka Attendance Review" opens the canonical review page.

### Admin Cross Portal
- Login as approved Admin.
- Open `/guard/attendance`.
- Confirm Admin Cross Portal state is shown.
- Confirm no operational Guard controls are available.
- If the Admin has guard-attendance permission, confirm Attendance Review CTA is shown.
- Confirm no `admin + isGuard` compatibility behavior returns.

### Canonical Guard
- Login as an approved `studio_guard` linked to an active Guard/Both crew person.
- Confirm Guard profile resolves to the linked crew identity.
- Confirm Clock In creates an attendance session tied to Firebase UID and canonical guardId.
- Confirm duplicate Clock In for the same date is blocked.
- Confirm Clock Out is allowed only for the same authenticated UID.

### Identity Repair
- Temporarily deactivate, delete, or change role of the linked crew person.
- Confirm the Guard session moves to Identity Repair without requiring a new role.
- Confirm new Clock In is blocked.
- If an existing shift is open, confirm UID-bound Clock Out remains available.
- Relink to an active Guard/Both person and confirm operational state returns.

### Wrong Portal Client
- Login as Client and open `/guard/attendance`.
- Confirm Wrong Portal Client state is shown.
- Confirm CTA opens Client Portal.
- Confirm no Guard attendance controls are rendered.

### Blocked / invalid states
- Test pending/rejected Guard and Admin accounts.
- Confirm role-aware blocked copy is shown.
- Test invalid/missing account data and confirm Recovery Required state.
- Confirm no state silently mutates role or grants operational access.

## 4. Shared authentication QA

- Start from Guard Portal while signed out.
- Confirm Guard login entry opens shared `/login?portal=guard&redirectTo=/guard/attendance` intent.
- Verify Email/password login returns to Guard Portal.
- Verify Google login returns to Guard Portal.
- Verify Phone OTP returns to Guard Portal.
- Confirm Admin signup UI is hidden while Guard intent is active.
- Confirm login never self-creates a `studio_guard` role.

## 5. Owner account provisioning QA

- Create a new Admin account as Owner and confirm the primary Owner session remains active.
- Create a new Guard account linked to an active Guard/Both person.
- Confirm provisioning rejects missing, inactive, deleted, or non-Guard crew identity.
- Confirm generated Guard has zero Admin-page permissions.
- Confirm Guard → Admin transition clears guardId and stale isGuard state.
- Confirm Admin → Guard requires a valid active Guard/Both identity.

## 6. Attendance / fee regression QA

- Confirm attendance document identity remains `att__{guardUid}__{date}`.
- Confirm history remains readable after crew rename/deactivation/deletion because ownership is UID-bound.
- Confirm Owner Approve / Reject / Void transitions still work.
- Confirm approved Guard attendance continues to drive Guard fee eligibility.
- Confirm meal posting remains single-source and cannot duplicate after posting.
- Confirm rejected/void attendance cannot incorrectly activate fee or meal posting.

## 7. Firestore / security verification

- Confirm `isStudioGuardAccount()` only accepts approved `studio_guard`.
- Confirm canonical `studio_guard` user documents require non-empty guardId.
- Confirm `isGuard=true` user writes are rejected.
- Confirm Guard attendance create is tied to `request.auth.uid == data.guardUid`.
- Confirm Owner / permitted Admin review capability remains separate from Guard self-attendance capability.
- Confirm GP6 Firestore rules are deployed to project `studio-proper`.

GP8 itself changes only tests/documentation, so no additional Firestore rules deploy is required if the GP6 rules deployment is already confirmed.

## 8. Release decision

Mark Guard Portal remediation DONE only when:
- automated gates are green;
- manual role matrix is verified;
- canonical Guard Clock In/Out is verified;
- Owner review is verified;
- wrong-portal states are verified;
- identity repair is verified;
- legacy compatibility retired is verified;
- deployed Firestore rules match the repository.

If any item fails, fix only the failing invariant and rerun this checklist before release.
