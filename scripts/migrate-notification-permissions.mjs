import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const options = {
    input: '',
    output: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--input') options.input = argv[index + 1] || '';
    if (argument === '--output') options.output = argv[index + 1] || '';
  }

  return options;
}

function getUserRecords(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.users)) return payload.users;

  throw new Error('Input harus berupa array user atau object dengan property users[].');
}

export function migrateNotificationPermissions(records) {
  const updates = [];
  const users = records.map((record) => {
    const source = record && typeof record === 'object' ? record : {};
    const permissions = source.permissions && typeof source.permissions === 'object'
      ? source.permissions
      : {};

    if (typeof permissions.notifications === 'boolean') {
      return {
        ...source,
        permissions: {
          ...permissions,
        },
      };
    }

    const notifications = permissions.settings === true;
    const userId = String(source.uid || source.id || '').trim();
    const nextRecord = {
      ...source,
      permissions: {
        ...permissions,
        notifications,
      },
    };

    updates.push({
      after: notifications,
      before: null,
      reason: 'Copied from legacy permissions.settings fallback.',
      userId,
    });

    return nextRecord;
  });

  return {
    summary: {
      changed: updates.length,
      unchanged: users.length - updates.length,
      users: users.length,
    },
    updates,
    users,
  };
}

function runCli() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.input) {
    throw new Error(
      'Gunakan --input <users.json>. Helper ini hanya bekerja pada snapshot lokal dan tidak mengakses Firestore.',
    );
  }

  const inputPath = resolve(options.input);
  const payload = JSON.parse(readFileSync(inputPath, 'utf8'));
  const migration = migrateNotificationPermissions(getUserRecords(payload));
  const report = {
    format: 'studio37-notification-permission-migration-v1',
    generatedAt: new Date().toISOString(),
    inputPath,
    ...migration,
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;

  if (options.output) {
    writeFileSync(resolve(options.output), serialized, 'utf8');
    return;
  }

  process.stdout.write(serialized);
}

const isMainModule = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  : false;

if (isMainModule) {
  runCli();
}
