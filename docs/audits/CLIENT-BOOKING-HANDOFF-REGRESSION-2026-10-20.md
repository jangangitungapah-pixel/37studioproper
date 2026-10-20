# Follow-up: Client booking handoff contract

Date: 2026-10-20

A focused regression script was added on the audit branch: `scripts/client-booking-handoff-security-regression-test.mjs`, registered at the start of `npm test`.

It covers:
- valid client booking resume path serialization/parsing;
- allowed next paths staying inside client portal/public booking;
- rejection of external, protocol-relative, admin, guard, and path-traversal-style destinations;
- booking overlap boundary behavior.

Important: the new regression script has not been executed in a Node environment here. Source inspection found that date parsing accepted impossible ISO-shaped dates and hour parsing could coerce an empty value to hour zero. The audit branch now tightens validation to require a real calendar date and an integer hour from 0 to 23. The regression test now expects impossible dates, fractional hours, and missing hours to be rejected. Runtime verification remains pending.

Run in a local Node environment:
```bash
node scripts/client-booking-handoff-security-regression-test.mjs
npm test
npm run lint
npm run build
```
