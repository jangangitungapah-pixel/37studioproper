# Guard Portal × Admin Portal — GP-0 Flow Baseline

Baseline commit: `ec6f0f12a79a01f8aad9b2b026b2985ffe1d9b8d`  
Phase: `GP-0 — Baseline Contract & Flow Freeze`  
Date: `2026-08-11`

This file is an audit artifact. It records current behavior and target boundaries
before the Guard Portal access model is changed.

## CURRENT ACCESS MATRIX

| Account context | Admin Portal | Guard Portal today | Primary ambiguity |
| --- | --- | --- | --- |
| Owner | Allowed | Generic Guard blocked state | Owner is incorrectly treated like an unapproved Guard |
| Admin | Allowed by permissions | Generic Guard blocked state unless legacy `isGuard=true` | Cross-portal state is not role-aware |
| Studio Guard | Redirected away from Admin shell | Operational attendance | Correct isolation; must be preserved |
| Client | Wrong Admin portal | Generic Guard blocked state | Guard route lacks canonical wrong-portal handling |
| Legacy Admin + `isGuard` | Admin allowed | Compatibility operational | Mixed role/capability model remains technical debt |

Canonical audit shorthand:

- Owner -> current: generic blocked; target: OWNER_OVERSIGHT
- Admin -> current: generic blocked; target: REDIRECT_ADMIN
- Studio Guard -> current: operational; target: GUARD_OPERATIONAL
- Client -> current: generic blocked; target: WRONG_PORTAL_CLIENT
- Legacy Admin + isGuard -> current: compatibility operational; target: MIGRATION_REQUIRED

## CURRENT POLICY LOCATION

Current canonical `getPortalAccess()` models:

- `admin`
- `client`

Guard Portal access is still decided inside
`src/pages/guard/GuardAttendancePage.jsx`.

That page currently performs direct:

- `onAuthStateChanged`
- `signInWithEmailAndPassword`
- `GoogleAuthProvider`
- `signInWithPopup`
- `signOut`
- `getDoc(users/{uid})`

This duplication is recorded for GP-2 remediation.

## LEGACY ADMIN + isGuard REFERENCES

Runtime compatibility is currently present in:

- `src/pages/guard/GuardAttendancePage.jsx`
- `src/components/admin/AdminTopbar.jsx`
- `firestore.rules`

This is compatibility debt only. New UI/logic must not reintroduce mixed
Admin + Guard as a canonical product model.

## EXISTING INVARIANTS TO PRESERVE

- `studio_guard` owns zero Admin-page permissions.
- Direct `/admin` access by `studio_guard` redirects to `/guard/attendance`.
- Guard attendance create remains bound to the authenticated Guard UID.
- Guard self-checkout remains bound to the attendance owner UID.
- Owner/admin attendance review authority remains permission/rule protected.
- Meal reconciliation lifecycle must remain unchanged.

## TARGET BOUNDARIES

Future phases must converge on:

- Owner: Admin home base + read-only `OWNER_OVERSIGHT` inside Guard Portal.
- Admin: Admin Portal actor; Guard route returns role-aware Admin context.
- Studio Guard: isolated `GUARD_OPERATIONAL` actor with explicit `guardId`.
- Client: role-aware wrong-portal state.
- Legacy Admin + `isGuard`: audited and explicitly migrated before compatibility
  is removed.

Portal switching must not sign the Firebase user out.
Global logout must remain a separate explicit account action.

## GP-0 RUNTIME GUARD

No runtime behavior change in GP-0.

GP-0 may only add:

- this baseline audit artifact;
- the targeted baseline contract;
- npm test registration for that contract.

Any runtime or UI change belongs to GP-1 or later.
