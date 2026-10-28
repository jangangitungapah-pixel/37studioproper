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

- [x] Targeted handoff regression script executed as part of the full repository `npm test` suite.
- [x] `npm test`, `npm run lint`, and `npm run build` passed in GitHub Actions run `40763949770` on commit `88ba4991cf710d57a72dffcafb3508795ea76cef`.
- [x] `npm run test:prd` passed, including the repository's Firestore rules contract suite.
- [ ] Completed browser/mobile QA and live staging data-flow tests.

The CI result verifies repository tests and build/lint contracts. It does not establish that browser layouts, live Firebase integrations, or concurrent booking decisions are safe.

## Run from the repository root

```bash
node scripts/client-booking-handoff-security-regression-test.mjs
npm test
npm run lint
npm run build
```
