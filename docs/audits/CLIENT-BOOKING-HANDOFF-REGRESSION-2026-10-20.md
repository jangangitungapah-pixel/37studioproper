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

The branch now validates raw query/hour values before numeric conversion, and validates existing slot start hours before comparing overlap. Regression assertions cover the missing query parameter, empty value, null/undefined/fractional/out-of-range target hours, and malformed existing slots.

## Verification status

- [x] Ran the targeted regression logic in an isolated Node.js workspace using a local reproduction of the branch utility and test script: `client booking handoff security regression: PASS`.
- [ ] Executed the script from a complete repository checkout.
- [ ] Ran `npm test`, `npm run lint`, and `npm run build`.
- [ ] Completed browser / Firebase emulator testing.

The isolated run verifies the targeted logic only. It is not a claim that the full repository test suite, build, lint, or runtime workflows pass.

## Run from the repository root

```bash
node scripts/client-booking-handoff-security-regression-test.mjs
npm test
npm run lint
npm run build
```
