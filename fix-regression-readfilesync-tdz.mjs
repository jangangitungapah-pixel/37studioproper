import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const targets = [
  'scripts/operator-fee-posting-reconciliation-contract-test.mjs',
  'scripts/fee-ledger-integrity-contract-test.mjs',
];

const oldHelper = String.raw`const readFileSync = (...args) => {
  const value = rawReadFileSync(...args);
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n') : value;
};`;
const functionHelper = String.raw`function readFileSync(...args) {
  const value = rawReadFileSync(...args);
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n') : value;
}`;

const prepared = [];
for (const relativePath of targets) {
  const filePath = resolve(root, relativePath);
  if (!existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${relativePath}. Tidak ada file yang diubah.`);
  }

  const original = readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const normalized = original.replace(/\r\n/g, '\n');

  if (!/\breadFileSync\s+as\s+rawReadFileSync\b/.test(normalized)) {
    throw new Error(`Alias rawReadFileSync tidak ditemukan pada ${relativePath}. Tidak ada file yang diubah.`);
  }

  const matchCount = normalized.split(oldHelper).length - 1;
  if (matchCount !== 1) {
    throw new Error(`Wrapper const ditemukan ${matchCount} kali pada ${relativePath}; ekspektasi tepat 1. Tidak ada file yang diubah.`);
  }
  if (normalized.includes('function readFileSync(...args)')) {
    throw new Error(`Wrapper function sudah ada pada ${relativePath}. Tidak ada file yang diubah.`);
  }

  const updated = normalized.replace(oldHelper, functionHelper).replace(/\n/g, eol);
  prepared.push({ filePath, relativePath, original, updated });
}

const backupDir = resolve(tmpdir(), `37studioproper-readfilesync-tdz-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(backupDir, { recursive: true });
for (const item of prepared) {
  copyFileSync(item.filePath, join(backupDir, item.relativePath.replaceAll('/', '__')));
}

for (const item of prepared) {
  writeFileSync(item.filePath, item.updated, 'utf8');
}

const summary = [
  '37STUDIO PROPER - READFILESYNC TDZ FIX',
  '======================================',
  `Repository: ${root}`,
  `Backup: ${backupDir}`,
  '',
  'Updated wrapper from const arrow function to a hoisted function declaration:',
  ...targets.map((path) => `- ${path}`),
  '',
  'This fixes ReferenceError: Cannot access readFileSync before initialization.',
  'Only the two regression test scripts above were changed.',
  'No application source, package.json, dependencies, Firestore rules, or runtime config changed.',
  'No commit, push, merge, or deployment performed.',
  '',
  'Next: run npm test. Expected previous two TDZ failures to clear; review any remaining test failures independently.',
].join('\r\n');
const summaryPath = join(backupDir, 'FIX-SUMMARY.txt');
writeFileSync(summaryPath, summary, 'utf8');

console.log('PASS: readFileSync TDZ patch applied.');
console.log('Updated files:');
for (const item of prepared) console.log(`- ${item.relativePath}`);
console.log(`Backup and summary: ${backupDir}`);
console.log('Next: npm test');
