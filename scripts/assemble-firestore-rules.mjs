import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modules = [
  'firestore/rules/core.rules',
  'firestore/rules/domains/guard-attendance.rules',
  'firestore/rules/domains/accounts-and-identity.rules',
  'firestore/rules/domains/booking-and-scheduling.rules',
  'firestore/rules/domains/finance-and-bookkeeping.rules',
  'firestore/rules/domains/inventory-and-maintenance.rules',
  'firestore/rules/domains/gallery-and-operations.rules',
  'firestore/rules/domains/notifications.rules',
  'firestore/rules/domains/procurement.rules',
  'firestore/rules/domains/customer-follow-up.rules',
  'firestore/rules/fallback.rules',
];

const sections = await Promise.all(modules.map(async (path) => {
  const content = await readFile(resolve(root, path), 'utf8');
  return content.replace(/\s+$/, '');
}));
const output = sections.map((section, index) => index === 1 || index === 3 ? section + '\n' : section).join('\n');
await writeFile(resolve(root, 'firestore.rules'), output, 'utf8');
process.stdout.write(
  'Firestore Rules assembled from ' + modules.length + ' ordered source modules (' +
  output.length + ' characters).\n',
);
