/* global process, console */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const packagePath = resolve(root, 'package.json');
const runnerPath = resolve(root, 'scripts/run-all-tests.mjs');

if (!existsSync(packagePath)) {
  throw new Error('package.json tidak ditemukan. Jalankan dari root repository.');
}
if (!existsSync(runnerPath)) {
  throw new Error('scripts/run-all-tests.mjs tidak ditemukan. Runner V3 belum terpasang.');
}

const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
pkg.scripts ??= {};
const legacy = pkg.scripts['test:serial'];
if (typeof legacy !== 'string' || !legacy.trim()) {
  throw new Error('scripts.test:serial tidak ditemukan. Tidak ada file yang diubah.');
}
if (typeof pkg.scripts.test !== 'string' || !pkg.scripts.test.startsWith('node scripts/run-all-tests.mjs')) {
  throw new Error('scripts.test bukan command Regression Runner V3. Tidak ada file yang diubah.');
}

const normalizedLegacy = legacy.replace(/(^|&&\s*)nodescripts\//g, (_, prefix) => `${prefix}node scripts/`);
const repairedTestCommand = `node scripts/run-all-tests.mjs "${normalizedLegacy.replace(/"/g, '\\"')}"`;
if (repairedTestCommand.length > 7000) {
  throw new Error(`Command npm test terlalu panjang (${repairedTestCommand.length} chars); batas aman 7000. Tidak ada file yang diubah.`);
}

const eolPatchTargets = [
  ['scripts/admin-shell-auth-hardening-contract-test.mjs', 'function read(path) {'],
  ['scripts/admin-spatial-booking-calendar-contract-test.mjs', 'function read(path) {'],
  ['scripts/admin-spatial-inventory-workspace-contract-test.mjs', 'const pageSource ='],
  ['scripts/guard-portal-session-switch-contract-test.mjs', 'function read(path) {'],
  ['scripts/operator-fee-posting-reconciliation-contract-test.mjs', 'const rulesSource ='],
  ['scripts/fee-ledger-integrity-contract-test.mjs', 'const rulesSource ='],
  ['scripts/guard-attendance-owner-review-transition-contract-test.mjs', 'const rulesSource ='],
  ['scripts/phase-8-cross-app-completion-contract-test.mjs', 'const read = (path) =>'],
];

const changes = [];
for (const [relativePath, anchor] of eolPatchTargets) {
  const filePath = resolve(root, relativePath);
  if (!existsSync(filePath)) throw new Error(`File test tidak ditemukan: ${relativePath}`);
  const original = readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  let source = original.replace(/\r\n/g, '\n');

  const fsImport = source.match(/import\s*\{[\s\S]*?\}\s*from\s*['"]node:fs['"]\s*;/m);
  if (!fsImport || !/\breadFileSync\b/.test(fsImport[0])) {
    throw new Error(`Import readFileSync dari node:fs tidak ditemukan: ${relativePath}`);
  }
  if (/\breadFileSync\s+as\s+rawReadFileSync\b/.test(fsImport[0])) {
    throw new Error(`Normalizer sudah terpasang sebagian pada ${relativePath}; periksa manual. Tidak ada file ditulis.`);
  }
  const updatedImport = fsImport[0].replace(/\breadFileSync\b/, 'readFileSync as rawReadFileSync');
  source = source.replace(fsImport[0], updatedImport);

  const occurrences = source.split(anchor).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Anchor '${anchor}' muncul ${occurrences} kali di ${relativePath}; tidak aman untuk patch otomatis.`);
  }

  const helper = `const readFileSync = (...args) => {\n  const value = rawReadFileSync(...args);\n  return typeof value === 'string' ? value.replace(/\\r\\n/g, '\\n') : value;\n};\n\n`;
  source = source.replace(anchor, `${helper}${anchor}`);
  const updated = source.replace(/\n/g, eol);
  changes.push({ filePath, relativePath, original, updated, eol });
}

const backupDir = resolve(tmpdir(), `37studioproper-runner-v3-repair-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(backupDir, { recursive: true });
const packageBackup = join(backupDir, 'package.json');
copyFileSync(packagePath, packageBackup);
for (const change of changes) {
  const backupPath = join(backupDir, change.relativePath.replaceAll('/', '__'));
  copyFileSync(change.filePath, backupPath);
}

// All validation has completed. Write the prepared files only after every target passed preflight.
for (const change of changes) writeFileSync(change.filePath, change.updated, 'utf8');
pkg.scripts['test:serial'] = normalizedLegacy;
pkg.scripts.test = repairedTestCommand;
const packageTemp = `${packagePath}.runner-repair-tmp`;
writeFileSync(packageTemp, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
renameSync(packageTemp, packagePath);

const reportPath = join(backupDir, 'REPAIR-SUMMARY.txt');
const report = [
  '37STUDIO PROPER REGRESSION RUNNER V3 REPAIR',
  '==========================================',
  `Repository: ${root}`,
  `Backup folder: ${backupDir}`,
  `package.json scripts.test length: ${repairedTestCommand.length}`,
  'npm test now invokes the runner and carries the legacy test command as an inert quoted registration manifest.',
  'The runner continues to execute scripts.test:serial, expanding nested npm run test scripts.',
  '',
  'Line-ending normalization added to these test scripts (text reads only; application source is unchanged):',
  ...changes.map((change) => `- ${change.relativePath}`),
  '',
  'No dependencies installed. No app source, Firestore rules, commit, push, merge, or deployment performed.',
].join('\r\n');
writeFileSync(reportPath, report, 'utf8');

console.log('PASS: Regression Runner compatibility repaired.');
console.log(`npm test command length: ${repairedTestCommand.length} chars (safe under Windows cmd limit).`);
console.log('Preserved full test registration list in package.json scripts.test.');
console.log(`Normalized CRLF handling in ${changes.length} contract test files.`);
console.log(`Backup and summary: ${backupDir}`);
console.log('Next: run npm test.');
