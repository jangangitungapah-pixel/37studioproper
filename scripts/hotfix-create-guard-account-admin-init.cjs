const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const target = path.join(ROOT, 'scripts', 'create-studio-guard-account.cjs');

function fail(message) {
  console.error(`\n[hotfix-create-guard-account-admin-init] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(target)) {
  fail('File scripts/create-studio-guard-account.cjs tidak ditemukan. Buat ulang script create account dulu kalau file sudah terhapus.');
}

const before = fs.readFileSync(target, 'utf8');

const oldText = `  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }`;

const newText = `  try {
    admin.app();
  } catch {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }`;

if (!before.includes(oldText)) {
  fail('Anchor admin.apps.length tidak ditemukan. Script mungkin sudah berubah.');
}

const after = before.replace(oldText, newText);

fs.writeFileSync(target, after, 'utf8');

console.log('[done] Firebase Admin init sudah dipatch.');