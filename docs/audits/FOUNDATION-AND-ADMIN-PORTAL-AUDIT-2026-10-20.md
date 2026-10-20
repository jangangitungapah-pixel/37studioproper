# 37StudioProper — Foundation & Admin Portal Audit

Date: 2026-10-20
Base: `main` at `3da18e39c03b9e3fe76b422cb2d65c3215cfeafd`
Scope: code/contract inspection. Runtime commands and browser QA have **not** been executed in this environment.

## Executive summary

The repository contains a mature Vite/React application with dedicated contract/regression scripts, client and admin routes, Firebase Authentication/Firestore, and admin operational modules. Do not start by redesigning the landing page. Establish a reproducible baseline, validate portal isolation, then continue with admin workflow QA before proceeding to client portal, logins, and public landing page.

## Confirmed repository observations

1. `main` branch API response reports `protected: false`, `protection.enabled: false`, with required status-check enforcement off. This is a repository governance risk, not proof of an application bug.
2. `package.json` provides `build`, `lint`, `test`, `test:prd`, and `test:rules`. `npm test` chains many custom regression/contract scripts; `npm run test:prd` includes security/accessibility/settings/worker contracts and Firestore emulator rules testing.
3. Routes in `src/App.jsx` are lazy-loaded. Public landing is `/`, shared admin/guard login is `/login`, client auth is `/client/login`, client workspace is `/client/portal`, public booking is `/book`, guard attendance is `/guard/attendance`, and admin routes are under `/admin/*`.
4. `src/pages/AdminPage.jsx` implements a large admin shell and explicitly resolves navigation permission in the UI. This must be validated together with server-side / Firestore enforcement; a hidden navigation item is not an authorization boundary.
5. Admin Portal PRD v3.0 specifies strict operational and security invariants, responsive desktop/mobile expectations, theme consistency, and safe handling for financially sensitive actions. Treat it as the implementation source of truth for admin work.
6. Existing Guard remediation release checklist explicitly requires automated gates and manual role-matrix QA before marking that work complete.

## Priority findings and actions

### P0 — Reproducible validation baseline
- Run `npm ci`, `npm run build`, `npm run lint`, `npm test`, and `npm run test:prd` in CI or a local Node environment.
- Capture each failing script and exact error; do not label tests passing based only on source inspection.
- Validate the Firestore rule suite with the configured emulator and confirm deployed rules correspond to reviewed repository rules.

### P0 — Portal isolation / authentication
- Manually test client, approved admin, pending/rejected admin, owner, guard, malformed/missing account, and signed-out states against direct URL entry and refresh.
- Verify session switch and logout boundaries, wrong-portal redirection, return URLs, Google redirect and phone OTP.
- Verify Firestore/server operations deny unauthorized access even if a user calls them outside the UI.
- Test owner/admin permission changes and role transitions without granting stale legacy flags access.

### P1 — Admin operational workflows
Run focused end-to-end paths: request booking → approve/reject → client status updates; invoice/payment proof → review → ledger/reconciliation; cancellation/refund → audit history; inventory adjustment → audit record; guard attendance → owner review → fee eligibility. Check loading, empty, error, success, and partial-failure states on desktop and mobile.
- Compare every admin workspace against `PRD_37Studio_Admin_Portal_UI_UX_Complete_v3.0.md`.
- Preserve business rules, ledger idempotency, audit trails, role boundaries, and reduced-motion/accessibility behavior during any UI overhaul.

### P1 — Client portal journey
- Verify client can see only their bookings and payment proofs.
- Verify public booking handoff preserves a safe intended path and does not permit cross-portal redirect.
- Test request status, payment status, cancellation, invoice detail, conversation, and latest updates after admin changes.

### P1 — Authentication entry points
- Admin/Guard login: email/password, Google, phone OTP, role-decision UX, redirect sanitization, pending/blocked/error/loading states.
- Client login: sign-up/sign-in, email/password validation, Google/phone flows if enabled, wrong-role and account conversion decisions, OTP resend and cleanup.

### P2 — Landing/public booking conversion
- Verify hero assets load, pricing reflects live admin settings, displayed opening hours match scheduling config, CTA handoff preserves intended choices, and public booking availability/errors are clear.
- Review mobile navigation and keyboard accessibility, SEO metadata, image sizing, and Core Web Vitals after workflow correctness is established.

## Commands to execute from repository root

```bash
npm ci
npm run build
npm run lint
npm test
npm run test:prd
```

For the Guard release checklist, execute the commands listed in `docs/guard-portal-remediation-release-checklist.md`, including role/security-specific scripts and manual role-matrix QA.

## Status

- [x] Inspected package scripts, core route table, current branch metadata, Admin Portal PRD, and Guard release checklist.
- [ ] Build / lint / tests executed in a Node environment.
- [ ] Browser QA completed.
- [ ] Admin workflow fixes implemented and verified.
- [ ] Client portal, authentication, and landing page QA completed.

## Important limitation

This report deliberately separates confirmed repository facts from work that requires a runnable Node/browser environment. No test result is claimed without execution. No production branch changes are made by this report.
