37Studio Proper - Repair Regression Runner V3

Purpose:
- Restore all legacy test-registration names inside package.json scripts.test, because many contract tests inspect that field.
- Keep the runner as the active npm test command.
- Make eight affected contract tests normalize CRLF text reads to LF, so Windows checkout line endings do not create false failures.

Instructions:
1. Copy repair-regression-runner-v3.mjs to the repository root.
2. Open PowerShell 7 in the repository root.
3. Run:
   node .\repair-regression-runner-v3.mjs
4. Review the backup folder printed by the script.
5. Run:
   npm test

The repair script performs preflight checks before writing. It backs up package.json and all eight test scripts to a timestamped folder under Windows TEMP. It changes no app source, Firestore rules, dependencies, and does not commit, push, merge, or deploy.
