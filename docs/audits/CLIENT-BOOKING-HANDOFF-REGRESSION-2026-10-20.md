# Follow-up: Client booking handoff contract

Date: 2026-10-20

A focused regression script was added on the audit branch: `scripts/client-booking-handoff-security-regression-test.mjs`, registered at the start of `npm test`.

It covers:
- valid client booking resume path serialization/parsing;
- allowed next paths staying inside client portal/public booking;
- rejection of external, protocol-relative, admin, guard, and path-traversal-style destinations;
- booking overlap boundary behavior.

Important: this script has not been executed in a Node environment here. Source inspection found `parseClientBookingResume` checks ISO date shape, not calendar validity; the test currently documents the current behavior. Before changing it, decide whether to tighten the parser and then update its assertion to require invalid calendar dates to return `null`.

Run in a local Node environment:
```bash
node scripts/client-booking-handoff-security-regression-test.mjs
npm test
npm run lint
npm run build
```
