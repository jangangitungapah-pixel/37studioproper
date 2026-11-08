# Phase 9 — Responsive, Accessibility & Visual QA

**Status:** COMPLETE for automated browser coverage and public/unauthenticated surfaces. Authenticated staging walkthrough remains an explicit release-readiness carry-forward.

**Date:** 2026-11-07 (Asia/Jakarta)  
**Repository:** `jangangitungapah-pixel/37studioproper`  
**Branch:** `feature/ui-overhaul-premium-enterprise-2026-11-06`  
**Verified HEAD:** `358560724f7e6a0fbc7aa940b50c13dabaad2da6`

## 1. CI evidence

Quality Gates run #312 completed successfully:

- Run: https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/42289681693
- Artifact: https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/42289681693/artifacts/13540255828
- Artifact name: `phase-9-browser-accessibility-qa`
- Artifact ID: `13540255828`
- Artifact size: 92,382,120 bytes
- Retention: 7 days from upload (uploaded 2026-11-06T20:44:49Z)

All workflow steps passed: locked dependency install, Firebase CLI setup, production build, lint, regression contracts, PRD/Firestore security contracts, Playwright setup, Chromium setup, responsive browser smoke, keyboard/focus QA, and evidence upload.

## 2. Route × viewport × theme matrix

Playwright captured **162 screenshots** and emitted **162 diagnostic rows**.

| Dimension | Coverage |
|---|---|
| Routes | Landing, Public Booking, Admin Login, Guard Login, Client Login, signed-out Admin route |
| Viewports | 360, 390, 430, 768, 900, 1024, 1280, 1440, 1920 px |
| Themes | Light, Dark, System |
| Total | 6 × 9 × 3 = 162 |

Results:
- 162/162 route/viewport/theme combinations rendered and captured.
- Zero horizontal overflow reports.
- Zero unclassified console errors.
- Zero unhandled page/runtime errors.
- Zero unexpected failed network requests.
- The expected Firebase-not-configured Public Booking environment error was classified separately; it was paired with a visible calendar error state and was not treated as an unexplained console failure.
- System theme followed OS Light/Dark changes in the browser smoke.

## 3. Browser state and interaction checks

The responsive smoke exercised:
- Landing mobile navigation open/close and body scroll lock.
- Landing service shortcut selecting Rehearsal, Motion reveal completion, and planner handoff.
- Public Booking error presentation, unavailable slot suppression, header status, AI context readiness, and offline/online notice.
- Auth page offline/online feedback.
- Signed-out Admin route redirect preserving its return path.
- Horizontal overflow and browser console/request diagnostics at each matrix combination.
- Public Booking AI launcher bounding-box checks against both calendar and booking summary.
- Pending mobile booking summary document-flow and custom date picker non-overlap checks.

The CI environment did not connect to production Firebase or submit a booking.

## 4. Keyboard and focus QA

The Playwright keyboard/focus runner reported **16 PASS / 0 FAIL / 0 SKIP**, with no runtime errors.

Coverage:
1. Landing menu ARIA disclosure.
2. Landing menu Enter/Escape and focus restoration to the trigger.
3. Landing navigation link keyboard focus.
4. In-page navigation destination focus.
5. StudioSelect ArrowDown/listbox opening.
6. Disabled option skipping.
7. Home/End.
8. Typeahead.
9. Enter selection and listbox close.
10. Escape close and focus restoration.
11. Tab close and focus movement.
12. Multi-select behavior.
13. ConfirmDialog ARIA, initial focus, and scroll lock.
14. ConfirmDialog two-direction focus trap.
15. ConfirmDialog Escape and focus restoration.
16. ConfirmDialog pending state blocks Escape.

The harness runs against local Vite and local dialog callbacks. No production writes occur.

## 5. Contrast, focus-visible, and reduced motion

- Light and Dark semantic token contrast contracts pass the WCAG AA 4.5:1 threshold for the selected text/surface pairs.
- Lowest measured ratio in the selected Light pair set: **4.62:1**.
- Lowest measured ratio in the selected Dark pair set: **4.79:1**.
- Client booking wizard and Guard review actions have source-verified keyboard-visible focus indicators.
- Auth spinner and Guard pulse/dialog styles have source-verified reduced-motion handling.
- Public Booking and Role AI also contain reduced-motion CSS handling. The route matrix did not emulate reduced motion for every route, and this report does not claim a full accessibility certification.
- Modal/dropdown behavior was exercised through the dedicated ConfirmDialog and StudioSelect keyboard/focus runner.

## 6. Visual review and fixes

Representative screenshots from the CI artifact were visually inspected at 360px mobile and 1440px desktop.

Findings fixed during Phase 9:
- Public availability previously inferred slots from an empty array during subscription failure. Availability is now considered valid only after successful subscription; the error state no longer fabricates a count, selectable slots, or AI slot suggestions.
- Public Booking header no longer claims “Jadwal realtime” when the availability subscription is loading or has failed. It distinguishes loading, unknown/error, ready, and offline states.
- The Public Booking AI launcher moved into the intro layout instead of floating above calendar content. Browser checks assert it does not overlap the calendar or summary.
- A disabled/pending mobile booking summary now returns to document flow and keeps its verification explanation visible, instead of remaining fixed over the date/calendar controls.

## 7. Known limitations and carry-forward

Authenticated Admin, Client, and Guard workflow walkthroughs remain unverified. Completing those safely requires:
- An isolated Firebase **Spark/free-tier** staging project.
- A staging Hosting origin.
- An isolated staging Worker target.
- Synthetic test identities and data.
- Explicit separation from production-facing Firebase/Worker configuration.

Until that staging setup exists, do not perform authenticated acceptance writes against production. Also carry forward:
- Real live availability loading/empty/success and final booking submission acceptance.
- Client availability recheck remains snapshot-level rather than a transactional reservation lock.
- Existing ECharts/ExcelJS large-chunk warnings.
- Existing dependency audit findings from `npm ci`: 17 total (2 low, 7 moderate, 8 high). No upgrades or audit fixes were performed in Phase 9.
- GitHub Actions v4 Node runtime deprecation warnings observed in CI; no workflow action upgrades were made here.

## 8. Phase boundary

Phase 9 is complete for the tested scope, with authenticated staging validation explicitly carried forward. Phase 10 (regression, cleanup, release readiness) has **not** been started in this session.

No PR was merged, no deployment was performed, no production configuration was changed, and no production data was written.
