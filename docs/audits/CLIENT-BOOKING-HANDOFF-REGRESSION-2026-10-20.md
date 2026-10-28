# Follow-up: Client booking handoff contract

Date: 2026-10-29

A focused regression script is registered at the start of `npm test`: `scripts/client-booking-handoff-security-regression-test.mjs`.

It covers:
- valid client booking resume path serialization/parsing;
- allowed next paths staying inside client portal/public booking;
- rejection of external, protocol-relative, admin, guard, and path-traversal-style destinations;
- impossible calendar dates and invalid/missing start hours;
- booking overlap boundaries and invalid slot times.

## Finding and fix

The first source review tightened calendar-date and integer-hour validation, but the parser still converted `params.get('bookStart')` to a number before validation. JavaScript turns an empty string or missing query value into `0`, bypassing the intended missing-hour rejection. The occupied-slot helper had the same coercion issue for an empty target hour and also treated an existing slot with an empty start hour as midnight.

The branch now validates raw query/hour values before numeric conversion, validates real calendar dates, and checks existing slot start hours before overlap comparison. Admin decision validation also rejects impossible dates and missing, fractional, out-of-range, or coerced hour values. Regression assertions cover absent/empty query parameters, invalid types, unsafe redirect destinations, and booking overlap boundaries.

## Verification status

- [x] Targeted handoff regression script passed as part of the complete repository `npm test` suite.
- [x] Latest code head `33d7c63ed0ae47c3528d88560d42d9d160d980c5` passed `npm ci`, `npm run build`, `npm run lint`, `npm test`, and `npm run test:prd` in [GitHub Actions run #59](https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/40767735630).
- [x] Worker race contracts passed for concurrent overlapping confirmations, confirmation vs. manual creation, confirmation vs. reschedule, exact boundary adjacency, required rejection reason, cancellation-request slot occupancy, and void mirror cleanup.
- [ ] Completed browser/mobile QA and live Firebase staging data-flow tests.

CI verifies repository tests, Worker contracts, build/lint, and Firestore Rules behavior. It does not replace real browser acceptance or a live staging data-flow test.

## Run from the repository root

```bash
node scripts/client-booking-handoff-security-regression-test.mjs
npm test
npm run lint
npm run build
```
