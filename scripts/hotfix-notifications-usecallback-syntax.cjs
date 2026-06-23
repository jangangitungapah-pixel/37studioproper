const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const filePath = path.join(ROOT, 'src', 'pages', 'admin', 'NotificationsPage.jsx');

function fail(message) {
  console.error(`\n[hotfix-notifications-usecallback-syntax] ${message}\n`);
  process.exit(1);
}

function backup(filePath, content) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.bak-${stamp}`;
  fs.writeFileSync(backupPath, content, 'utf8');
  console.log(`[backup] ${path.relative(ROOT, backupPath)}`);
}

function writeIfChanged(filePath, before, after) {
  if (before === after) {
    console.log(`[skip] ${path.relative(ROOT, filePath)} tidak berubah`);
    return false;
  }

  backup(filePath, before);
  fs.writeFileSync(filePath, after, 'utf8');
  console.log(`[write] ${path.relative(ROOT, filePath)}`);
  return true;
}

function main() {
  if (!fs.existsSync(filePath)) {
    fail(`File tidak ditemukan: ${path.relative(ROOT, filePath)}`);
  }

  const before = fs.readFileSync(filePath, 'utf8');
  let after = before;

  after = after.replace(
    `const handleRefreshReadiness = useCallback(async ({ includeWorker = true, reason = 'manual' } = {}) {`,
    `const handleRefreshReadiness = useCallback(async ({ includeWorker = true, reason = 'manual' } = {}) => {`,
  );

  after = after.replace(
    /const handleRefreshReadiness = useCallback\(async \(([^)]*)\) \{/,
    'const handleRefreshReadiness = useCallback(async ($1) => {',
  );

  if (!after.includes(`const handleRefreshReadiness = useCallback(async ({ includeWorker = true, reason = 'manual' } = {}) => {`)) {
    fail('Signature handleRefreshReadiness belum valid.');
  }

  if (after.includes(`} = {}) {`)) {
    fail('Masih ada callback useCallback tanpa arrow.');
  }

  if (!after.includes(`}, [currentUser?.uid, workerUrl]);`)) {
    fail('Dependency useCallback belum ditemukan.');
  }

  if (!after.includes(`}, [handleRefreshReadiness]);`)) {
    fail('Dependency useEffect readiness belum ditemukan.');
  }

  writeIfChanged(filePath, before, after);

  console.log('\n[done] Syntax useCallback NotificationsPage sudah diperbaiki.');
}

main();