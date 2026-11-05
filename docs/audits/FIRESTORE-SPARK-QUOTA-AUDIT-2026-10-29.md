# Firestore Spark Quota and Cost-Risk Audit — 2026-10-29

## Scope and boundary

This is a static source/configuration review of the working branch. It is not a report of live Firebase usage, billing, or production data, because those metrics were not queried and no production mutations were run. Firebase remains Spark-only: do not attach a Cloud Billing account, upgrade to Blaze, enable an automatic paid fallback, or deploy from this audit.

## Highest-value fix applied

- `src/services/guardAttendanceRepository.js`: `hasApprovedGuardMealForDay` previously read every attendance document for a Guard and filtered the date in JavaScript. The query now requires both `guardUid` and the exact `date`, and returns without a Firestore read if either scope key is missing.
- `scripts/guard-meal-reconciliation-contract-test.mjs`: a regression contract now requires the date filter in the Firestore query and verifies that missing scope keys do not trigger a broad read.

This reduces reads for that lookup from the Guard's entire attendance history to the matching day, subject to the number of records on that day. It does not imply every attendance or Firestore query has been optimized.

## Query patterns that can grow with retained history

The following are code-level exposure points. Actual cost depends on record counts, subscription lifetimes, change frequency, and which screens call each function.

| Area | Current source behavior | Risk | Safe follow-up |
|---|---|---|---|
| Client calendar slots | `subscribeClientCalendarSlots` listens to the entire `clientCalendarSlots` collection ordered by date | Every initial result and matching update scales with all retained slots | Pass the visible calendar date range into the subscription; subscribe only to the dates displayed and tested in the calendar |
| Notification console | `subscribeNotificationEvents({ status: 'all' })` listens to the entire event collection and sorts in JavaScript | Activity history grows indefinitely; each live listener retains an unbounded result set | Order by `createdAt`, use a bounded recent window and limit, and expose cursor-based history for older records |
| Pending payment proofs | `subscribePendingPaymentProofs` listens to every document with pending status | A large backlog can create a high initial read and a persistent listener over the entire backlog | Add a reviewed limit and cursor/page workflow; ensure approval counts and queue-state messaging do not imply unseen records are absent |
| Operator fee | `subscribeOperatorFeeEntries` subscribes to the entire ledger ordered by booking date | Historical ledger grows continuously | Use date range + cursor pagination; do not silently hide older ledger entries behind an arbitrary limit |
| Gallery | `subscribeGalleryItems` subscribes to all Gallery documents | Both the metadata result and live updates scale with the entire gallery | Add a bounded gallery view and explicit load-more/history behavior before limiting it |
| Guard attendance | `subscribeGuardAttendanceSessions` builds filters from optional guard/date/status/approval fields; callers that omit all scope fields can query the full collection | Broad Owner review paths can become expensive as attendance history grows | Make date ranges explicit for historical review and use cursor pagination for older sessions |
| Client booking history | `subscribeClientBookingsForUser` combines UID and legacy email/phone aliases without a date or result limit | A long-lived account or legacy identity can match a growing history; aliases can overlap | Keep legacy identity matching until migration is proven, then prefer canonical `clientUid`; paginate booking history |
| Schedule-slot synchronization | `syncClientCalendarSlotsFromBookings` reads all slot documents to build an ID map before reconciling | If invoked repeatedly as the schedule grows, each call has collection-sized reads | Confirm all call sites and invocation frequency; reconcile only IDs in the affected booking/date set and test stale-slot cleanup |
| Legacy customer migration | `migrateLocalCustomersToFirestore` reads all customer documents to compare IDs before importing local records | A migration can read the whole customer collection even when only a few local IDs need checking | Keep off render/repeated paths; change to ID-scoped lookups or bounded batches with tests for collision and cleanup behavior |

## APIs with optional limits

These repository functions add a Firestore `limit()` only when the caller supplies `limitCount`:

- `subscribeBookingsForAdmin` in `src/services/adminBookingRepository.js`
- `subscribeManualCustomers` in `src/services/adminCustomerRepository.js`
- `subscribeBookkeepingEntries` in `src/services/bookkeepingRepository.js`
- `subscribeInventoryItems` in `src/services/inventoryRepository.js`

The service definitions alone do not prove that every UI call site supplies a limit. The next audit should trace all call sites and add explicit cursor pagination where the UI must support full history. A fixed limit without pagination is not an acceptable fix for financial or historical workflows because it can make old records disappear from the visible result set.

## Other provider limits to budget for

These services do not inherently require Firebase Blaze in their current architecture, but each has separate limits:

- **Firebase Spark / Firestore / Hosting:** check the currently published quotas before release. The Firebase plan documentation says projects on Spark do not need payment information, and quota exhaustion for quota-limited products disables that product until the quota window resets rather than silently converting the project to Blaze.
- **Firebase App Check:** the current reCAPTCHA Enterprise setup has a finite published no-cost allowance. Monitor the provider's quota and App Check errors; never add billing as a remedy.
- **Firebase AI Logic:** retain the Gemini Developer API backend and the explicit no-billing model allowlist. Do not enable a billing-required Gemini model, Vertex/Agent Platform backend, or paid grounding/search tool without a reviewed product decision. Handle rate-limit/quota failures visibly.
- **Cloudflare Workers Free:** current published limits include 100,000 requests/day, 10 ms CPU time, and 50 subrequests per invocation. The Worker is part of the authentication/finance mutation boundary, so exhaustion must fail closed rather than bypass authorization.
- **EmailJS Free:** current plan lists 200 monthly requests. The app must show an explicit unsent/logged result when unconfigured or quota-limited; account requests remain reviewable in the Admin Portal.
- **Cloudinary Free:** current pricing lists 25 monthly credits. Confirm actual credit consumption for uploads, transformations and delivery; never silently switch to Firebase Storage.

## Required next implementation order

1. Trace and test the call sites for optional-limit APIs.
2. Add bounded date windows and cursor-based history to the unbounded listeners, with suitable indexes and UI states.
3. Replace collection-wide synchronization/migration reads with scoped document lookups after tests prove the reconciliation behavior.
4. Add operational quota visibility and test graceful quota/error states without connecting billing.
5. Review every new provider, model, SDK, config key and workflow against official pricing/plan documentation during PR review.

## Official references reviewed

- Firebase Spark pricing plan: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Firebase pricing and quotas: https://firebase.google.com/pricing
- Firestore quotas: https://firebase.google.com/docs/firestore/quotas
- Firebase AI Logic model availability and billing flags: https://firebase.google.com/docs/ai-logic/models?api=dev
- Firebase App Check reCAPTCHA provider and quotas: https://firebase.google.com/docs/app-check/web/recaptcha-provider
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- EmailJS plans: https://www.emailjs.com/pricing/
- Cloudinary pricing: https://cloudinary.com/pricing
