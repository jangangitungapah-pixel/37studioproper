# Phase 10 — Regression, Cleanup & Release Readiness

**Status:** Phase 10 audit and evidence documentation complete. **Production release status: HOLD / NO-GO** until the security and authenticated-staging gates below are resolved or formally accepted by the release owner.

**Date:** 2026-11-07 (Asia/Jakarta)  
**Repository:** `jangangitungapah-pixel/37studioproper`  
**Branch:** `feature/ui-overhaul-premium-enterprise-2026-11-06`  
**Baseline HEAD verified before this documentation commit:** `92dfa6ca790927837fb7f65dfb3972f7adaaba71`  
**Baseline commit:** `docs: record phase 9 responsive and accessibility QA`

## 1. Executive result

The current remote branch was verified directly against GitHub. Quality Gates run #313 completed successfully on the documented Phase 9 HEAD. No Phase 9 implementation was repeated.

- Quality Gates #313: **SUCCESS**, run ID `42291337900`, HEAD `92dfa6ca790927837fb7f65dfb3972f7adaaba71`.
- CI job: build, lint, regression, and responsive browser smoke — completed successfully.
- The workflow completed its locked install, production build, lint, full regression suite, PRD/Firestore security contracts, browser matrix, keyboard/focus QA, and artifact upload.
- No source, dependency, Firebase configuration, Firestore rules, Worker, or deployment change was made in Phase 10.
- No PR was opened, no PR was merged, no deployment was performed, and no production data was written.

Evidence:
- [Quality Gates #313](https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/42291337900)
- [Phase 9 Quality Gates #312](https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/42289681693)
- [Phase 9 report](PHASE_9_RESPONSIVE_ACCESSIBILITY_QA_2026-11-07.md)

## 2. Branch history and diff review

Comparison: base `ad207cb6735fea266eb2c26fe0338e5c5e6b837f` to `92dfa6ca790927837fb7f65dfb3972f7adaaba71`.

| Measure | Result |
|---|---:|
| Commits ahead | 166 |
| Commits behind | 0 |
| Merge commits in comparison | 0 |
| Files changed | 122 |
| Source files changed | 63 |
| Test/QA scripts changed | 19 |
| Documentation files changed | 7 |
| CI workflow files changed | 2 |
| Dependency manifests changed | 2 |
| Output/evidence files changed | 23 |

The recursive tree was not truncated and contained 433 tracked blobs across 62 directories at the verified baseline. The baseline source inventory includes 83 JSX files, 37 CSS files, 96 MJS scripts, and 20 service/repository files in the Phase 8 inventory snapshot.

The 122-file comparison contains one changed service/repository path: `src/services/notificationEventRepository.js`. No `firestore.rules`, `workers/` file, Firebase initialization file, or auth/role repository was changed in the reviewed branch range. This is not a substitute for the passing security contracts; both sources of evidence are retained.

The latest branch was not protected: GitHub reported protection disabled and no required status-check contexts configured. CI passing is verified, but merge-time enforcement is not configured on this branch.

## 3. Quality gate evidence

Quality Gates #313 completed all workflow steps successfully:

| Gate | Result | Evidence |
|---|---|---|
| Locked dependency install (`npm ci`) | PASS | CI job step completed |
| Production build (`npm run build`) | PASS | 3,049 modules transformed |
| ESLint (`npm run lint`) | PASS | CI job step completed |
| Regression contracts (`npm test`) | PASS | Full suite completed, including Spark, role, booking, client, admin, guard, library, and Phase 8/9 contracts |
| PRD/security contracts (`npm run test:prd`) | PASS | Worker, CSS ownership, notification, protected operations, and related contracts |
| Firestore rules behavior | PASS | Firestore emulator under project `demo-studio37` |
| Responsive browser smoke | PASS | CI job step completed |
| Keyboard/focus QA | PASS | CI job step completed |
| Evidence upload | PASS | Artifact uploaded |

The #313 artifact upload finalized as artifact ID `13540985860` (185 files; approximately 92.4 MB):
[Quality Gates #313 artifact](https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/42291337900/artifacts/13540985860).

The underlying Phase 9 evidence remains the 162-route/viewport/theme screenshot matrix and 16 PASS / 0 FAIL / 0 SKIP keyboard/focus report documented in the Phase 9 report. The browser matrix did not verify every authenticated flow or emulate reduced motion across every route.

## 4. Dependency, license, and package-consumer audit

### Lockfile and audit findings

The lockfile is version 3 and contains 641 installed package records excluding the root package. It includes 49 package names with more than one locked version, reflecting transitive version duplication.

The #313 `npm ci` output reported:

- 605 packages audited by npm.
- **17 vulnerabilities: 2 low, 7 moderate, 8 high.**
- Deprecated transitive packages were reported, including `inflight`, `rimraf@2`, `lodash.isequal`, `glob@7`, `fstream`, `node-domexception`, `json-ptr`, and `uuid@9`.

The CI log provides the severity totals but not the advisory-by-advisory remediation report. Dependabot/code-scanning alert detail was not available through the reviewed repository read endpoint. Therefore, no CVE, affected-path, exploitability, or fix-available claim is made here.

**Decision:** no blanket `npm audit fix`, lockfile refresh, or mass package upgrade was performed. Resolve the eight high findings through a separate advisory-level review, identifying whether each is production/runtime or development-only, the affected dependency path, available patched versions, and compatibility/regression evidence.

### License metadata

The lockfile contains license metadata for 640 of 641 package records.

- One record has no license metadata: `buffers@0.1.1`.
- Several records have expressions or multiple declared options, including `jszip` (`MIT OR GPL-3.0-or-later`), `pako` (`MIT AND Zlib`), and `type-fest` (`MIT OR CC0-1.0`).
- The direct runtime and development dependencies in the root manifest all have a license value in the lockfile. Examples include MIT, Apache-2.0, ISC, and OFL-1.1 for Inter.

This is a metadata inventory, not a legal opinion or a complete notice-file audit. Confirm the source/license of `buffers@0.1.1` and preserve the selected license option for packages with expressions before declaring legal review complete.

### Approved nine UI library layers and observed consumers

| Approved layer | Evidence in source |
|---|---|
| UI Foundation: shadcn/ui + Base UI | `components.json` configures shadcn style `base-nova` and Lucide; `StudioMenu.jsx` imports `@base-ui/react/menu`. |
| Styling: Tailwind CSS v4 | `src/index.css` imports `tailwindcss`; `vite.config.js` uses `@tailwindcss/vite`. |
| Animation: Motion | `ClientLandingPage.jsx` imports from `motion/react`; the Magic UI ticker uses Motion. |
| Visual Components: Magic UI | `src/components/magicui/number-ticker.jsx`; consumed by the landing and Dashboard. |
| Icons: Lucide React | Used by shared components including `StudioSelect.jsx`, `StudioMenu.jsx`, and `Button.jsx`. |
| Notifications: Sonner | `StudioToaster.jsx` imports `Toaster` from `sonner`; mounted in the Admin shell. |
| Table: TanStack Table | `StudioDataTable.jsx` imports `useTable` and table features. |
| Charts: Apache ECharts | `StudioChart.jsx` lazy-loads `EChartsRenderer.jsx`, which registers ECharts core, chart, and canvas renderer modules. |
| Forms: React Hook Form + Zod | `useStudioForm.js` combines `useForm` and `zodResolver`. |

The library integration contract passed in #313 and asserts the core integrations, ECharts renderer, and Recharts retirement from the Dashboard. No dependency was removed because this audit did not establish a complete, safe zero-consumer proof for every legacy or utility dependency. In particular, do not remove `radix-ui` or other packages solely because a preferred layer now exists; first verify all source, worker, script, and configuration consumers.

## 5. Bundle and loading review

The production build succeeded but emitted the Vite warning for JavaScript chunks larger than 500 KB after minification.

| Chunk | Minified | Gzip |
|---|---:|---:|
| ExcelJS | 929.91 KB | 256.47 KB |
| ECharts renderer | 556.90 KB | 188.15 KB |
| Firebase | 452.14 KB | 135.95 KB |
| Main entry | 440.55 KB | 142.95 KB |

There were 116 emitted JavaScript chunks. ExcelJS and ECharts renderer are the two chunks over the 500 KB warning threshold. ECharts is already behind a lazy `StudioChart` boundary; inspect its registered chart/component set and consumers before splitting further. ExcelJS should remain feature-loaded and be evaluated for dynamic import at its actual import/export entry point.

**Decision:** no warning threshold was raised and no unsafe manual chunk override was added. Treat bundle work as targeted performance follow-up with before/after build and browser regression evidence.

## 6. Route ownership and CSS import audit

The live `src/App.jsx` route declarations match the route map in `docs/ui-rewrite-code-map.md`:

- Public landing: `/` and `/client`.
- PWA launch: `/launch`.
- Admin login: `/login`.
- Public booking: `/book`.
- Client login and portal: `/client/login`, `/client/portal`.
- Guard shortcut: `/guard` redirects to `/guard/attendance`.
- Guard workspace: `/guard/attendance`.
- Admin shell: `/admin/*`; Admin workspace pages are selected by the Admin shell rather than separate top-level React Router entries.
- Unknown route: redirect to `/login`.

The stylesheet inventory contains 37 CSS files, including five route entry stylesheets under `src/styles/routes/`, feature modules under `src/styles/modules/`, and the global token/Tailwind entry `src/index.css`. Feature page styles are imported at page/component ownership boundaries; the CSS map explicitly avoids a global aggregator loading every Admin workspace stylesheet into every route.

The following source checks passed in #313:
- `css-route-ownership-contract-test.mjs`
- `library-integration-contract-test.mjs`
- `design-system-foundation-contract-test.mjs`

No CSS or source file was deleted. The old dead-class counts in earlier precision audits were not treated as proof of current dead code. The existing route/owner maps and import contracts are the deletion evidence required before any future cleanup.

## 7. Security, tenancy, and Firebase constraints

The reviewed branch diff did not modify Firestore rules, Worker sources, Firebase initialization, or auth/role repository files. The current quality gates passed Spark compatibility, booking handoff/ownership, account role, Guard isolation, Worker security, protected Admin operations, and Firestore rules emulator contracts.

The Firebase architecture constraint remains mandatory:

- Keep Firebase on Spark/free tier. Do not enable Blaze or attach billing.
- Do not introduce Firebase Phone Auth/SMS OTP, Cloud Functions, Firebase Storage, Extensions, or billing-required AI backends.
- Keep protected Admin mutations in the existing isolated Worker architecture.
- Do not deploy CI to Firebase or Worker targets.
- Do not run acceptance writes against production.

The CI Firestore emulator uses `demo-studio37`; expected denied writes in the security tests are negative assertions, not unexplained failed gates.

## 8. Release blockers and carry-forward

| Item | Status | Release treatment |
|---|---|---|
| CI #313 | PASS | Required automated gates are green on the baseline HEAD. |
| Dependency audit | 17 findings, including 8 high | **HOLD:** obtain advisory-level detail and triage/fix or formally accept with security owner evidence. |
| Authenticated Admin / Client / Guard walkthrough | Not run | **HOLD:** requires isolated Firebase Spark staging, staging Hosting origin, isolated Worker, synthetic identities and data. |
| Live availability success/empty/loading and final booking submit | Not accepted end-to-end | **HOLD:** verify only in isolated staging; never production. |
| Client availability recheck | Snapshot-level, not a transactional reservation lock | Carry as booking concurrency risk; requires explicit product/backend decision. |
| License inventory | 1 transitive package missing license metadata | Resolve `buffers@0.1.1` source/license and review license expressions. |
| Bundle size | ExcelJS 929.91 KB, ECharts 556.90 KB | Performance follow-up; do not hide warning. |
| GitHub Actions runtime | v4 actions produce Node 20 deprecation warnings; setup-java@v4 deprecation warning | Update to supported action versions in a controlled CI-only change and rerun all gates. |
| Branch protection | No required status checks configured | Configure release branch protection/required Quality Gates before relying on CI as merge protection. |
| Reduced motion | Source rules exist; complete route matrix not emulated | Do not claim full reduced-motion verification or accessibility certification. |
| Local working tree | Not observable from this remote-only session | Do not assume the user's local checkout is clean or synchronized. |

### Safe staging prerequisite

A later authenticated walkthrough must use a separate Firebase Spark/free-tier staging project, an isolated Hosting origin, an isolated Worker target, and synthetic identities/data. Verify every environment target before testing. Do not enable Blaze, do not point staging writes to production, and do not use production identities or data.

## 9. Phase 10 decisions and boundary

Completed in this phase:
- Verified branch HEAD, CI #313, workflow job steps, and branch history.
- Reviewed the phase diff, security-sensitive paths, package/lockfile/license metadata, bundle output, approved UI library consumers, routes, and CSS ownership.
- Recorded release blockers and evidence in this report.
- Updated the roadmap with the Phase 10 outcome and next-session handoff.

Intentionally not performed:
- No mass dependency updates or `npm audit fix`.
- No dependency, CSS, source, or route deletion without complete consumer proof.
- No Firebase/Worker/configuration change.
- No staging creation or production-facing acceptance write.
- No PR creation, merge, or deployment.

**Verdict:** Phase 10 audit/reporting scope is complete. The project is **not approved for production release** until the security findings are triaged and authenticated acceptance is completed safely in isolated Spark staging, or the remaining risks are explicitly accepted by the release owner. This report does not certify the application as release-ready or fully accessible.

