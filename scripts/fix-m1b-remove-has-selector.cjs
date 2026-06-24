const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET = 'scripts/mobile-phase-m1b-dashboard-modern-polish.cjs';

function fail(message) {
  console.error('');
  console.error('❌ Hotfix M1B gagal.');
  console.error(message);
  console.error('');
  process.exit(1);
}

function abs(relativePath) {
  return path.join(ROOT, relativePath);
}

function assertFile(relativePath) {
  const filePath = abs(relativePath);

  if (!fs.existsSync(filePath)) {
    fail('File target tidak ditemukan: ' + relativePath);
  }

  if (!fs.statSync(filePath).isFile()) {
    fail('Target bukan file: ' + relativePath);
  }
}

function backup(relativePath) {
  const filePath = abs(relativePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(filePath, filePath + '.bak-' + stamp);
}

function main() {
  console.log('');
  console.log('🚑 Hotfix M1B - remove :has selector from generated dashboard CSS');
  console.log('');

  assertFile(TARGET);

  const filePath = abs(TARGET);
  const current = fs.readFileSync(filePath, 'utf8');

  const forbiddenBlock = [
    '.dashboard-attention-card:has(.dashboard-attention-total) {',
    '  min-height: 0;',
    '}',
    '',
  ].join('\n');

  if (!current.includes(forbiddenBlock)) {
    fail('Blok :has selector tidak ditemukan. Mungkin script sudah dipatch atau formatnya berbeda.');
  }

  const next = current.replace(forbiddenBlock, '');

  if (next.includes('.dashboard-attention-card:has(')) {
    fail('Selector :has masih tersisa setelah patch.');
  }

  backup(TARGET);
  fs.writeFileSync(filePath, next, 'utf8');

  console.log('✅ Selector :has sudah dihapus dari script M1B.');
  console.log('✅ Sekarang generated dashboard.css harus lolos forbidden CSS guard.');
  console.log('');
}

main();