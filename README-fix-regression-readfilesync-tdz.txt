37Studio Proper - Fix Regression Runner readFileSync TDZ

1. Download and extract fix-regression-readfilesync-tdz.zip.
2. Copy fix-regression-readfilesync-tdz.mjs to the repository root:
   C:\Users\hazel\source\repos\37studioproper
3. Open PowerShell in the repository root and run:
   node .\fix-regression-readfilesync-tdz.mjs
4. Then run:
   npm test

The patch changes only these two test files:
- scripts/operator-fee-posting-reconciliation-contract-test.mjs
- scripts/fee-ledger-integrity-contract-test.mjs

It changes the CRLF normalization helper from a const arrow function to a hoisted
function declaration. This fixes the temporal-dead-zone error seen when earlier
module-level code calls readFileSync before the helper's declaration.

The patch creates backups in the Windows TEMP directory before writing.
It does not alter app source, package.json, dependencies, Firestore rules, or
runtime configuration. It does not commit, push, merge, or deploy anything.
