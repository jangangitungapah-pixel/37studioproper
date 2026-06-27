const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SCHEDULE_CSS = 'src/styles/modules/schedule.css';

function fail(message) {
  console.error('');
  console.error('❌ Phase M2I gagal.');
  console.error(message);
  console.error('');
  process.exit(1);
}

function abs(file) {
  return path.join(ROOT, file);
}

function assertFile(file) {
  const filePath = abs(file);

  if (!fs.existsSync(filePath)) {
    fail('File tidak ditemukan: ' + file);
  }

  if (!fs.statSync(filePath).isFile()) {
    fail('Path bukan file: ' + file);
  }
}

function read(file) {
  assertFile(file);
  return fs.readFileSync(abs(file), 'utf8');
}

function backup(file) {
  const filePath = abs(file);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(filePath, filePath + '.bak-' + stamp);
}

function write(file, next) {
  const filePath = abs(file);
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';

  if (current === next) {
    console.log('✅ Tidak ada perubahan: ' + file);
    return false;
  }

  backup(file);
  fs.writeFileSync(filePath, next, 'utf8');
  console.log('✅ Ditulis: ' + file);
  return true;
}

function mustContain(content, patterns, label) {
  for (const pattern of patterns) {
    if (!content.includes(pattern)) {
      fail('Pattern wajib tidak ditemukan di ' + label + ': ' + pattern);
    }
  }
}

function mustNotContain(content, patterns, label) {
  for (const pattern of patterns) {
    if (content.includes(pattern)) {
      fail('Pattern terlarang masih ada di ' + label + ': ' + pattern);
    }
  }
}

function stripCssComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, '');
}

function assertBalancedCss(content) {
  const clean = stripCssComments(content);
  let balance = 0;

  for (let index = 0; index < clean.length; index += 1) {
    if (clean[index] === '{') balance += 1;
    if (clean[index] === '}') balance -= 1;
    if (balance < 0) {
      fail('CSS punya kurung tutup berlebih index ' + index);
    }
  }

  if (balance !== 0) {
    fail('CSS brace belum balance. Selisih: ' + balance);
  }
}

function assertNoForbiddenCss(content) {
  const forbidden = [
    '!important',
    'Montserrat',
    ':has(',
    '#050506',
    '#ff8a2a',
    '#ff5f15',
    '#fff',
    'rgba(255, 138, 42',
    'rgba(255, 255, 255',
    '0.48rem',
    '0.5rem',
    '0.52rem',
    '0.54rem',
    '0.55rem',
    '0.56rem',
    '0.58rem',
  ];

  for (const pattern of forbidden) {
    if (content.includes(pattern)) {
      fail('schedule.css masih mengandung pattern terlarang: ' + pattern);
    }
  }
}

function replaceExact(content, from, to, label) {
  if (!content.includes(from)) {
    fail('Anchor tidak ditemukan: ' + label);
  }

  return content.replace(from, to);
}

function main() {
  console.log('');
  console.log('🚦 Phase M2I - Schedule Toolbar Density + Solid Booking Grid');
  console.log('');

  let content = read(SCHEDULE_CSS);

  mustContain(content, [
    '/* Schedule: Studio OS mobile grid schedule. Owner file, no override layer. */',
    '.schedule-page {',
    '.schedule-heading-row h2 {',
    '.schedule-command-row .studio-select-trigger {',
    '.schedule-status-filter,',
    '.schedule-booking-block {',
    '.schedule-booking-block.is-pending {',
    '.schedule-booking-block.is-dp {',
    '.schedule-booking-block.is-lunas {',
  ], SCHEDULE_CSS);

  content = replaceExact(
    content,
    [
      '.schedule-page {',
      '  --schedule-time-col: 62px;',
      '  --schedule-month-day-col: 104px;',
      '  --schedule-week-day-col: 116px;',
      '  width: min(100%, 1560px);',
      '  min-width: 0;',
      '  display: grid;',
      '  gap: 11px;',
      '  margin: 0 auto;',
      '  padding-bottom: calc(96px + env(safe-area-inset-bottom));',
      '  color: var(--auth-text-main);',
      '}',
    ].join('\n'),
    [
      '.schedule-page {',
      '  --schedule-time-col: 58px;',
      '  --schedule-month-day-col: 100px;',
      '  --schedule-week-day-col: 110px;',
      '  width: min(100%, 1560px);',
      '  min-width: 0;',
      '  display: grid;',
      '  gap: 8px;',
      '  margin: 0 auto;',
      '  padding-bottom: calc(96px + env(safe-area-inset-bottom));',
      '  color: var(--auth-text-main);',
      '}',
    ].join('\n'),
    'schedule page density'
  );

  content = content.replace(
    [
      '.schedule-toolbar,',
      '.schedule-workspace,',
      '.schedule-calendar-surface {',
      '  min-width: 0;',
      '  display: grid;',
      '  gap: 10px;',
      '}',
    ].join('\n'),
    [
      '.schedule-toolbar,',
      '.schedule-workspace,',
      '.schedule-calendar-surface {',
      '  min-width: 0;',
      '  display: grid;',
      '  gap: 7px;',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-heading-row {',
      '  min-width: 0;',
      '  display: grid;',
      '  grid-template-columns: minmax(0, 1fr) auto;',
      '  align-items: center;',
      '  gap: 10px;',
      '}',
    ].join('\n'),
    [
      '.schedule-heading-row {',
      '  min-width: 0;',
      '  display: grid;',
      '  grid-template-columns: minmax(0, 1fr) auto;',
      '  align-items: center;',
      '  gap: 8px;',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-heading-row h2 {',
      '  min-width: 0;',
      '  overflow: hidden;',
      '  margin: 0;',
      '  color: var(--auth-text-strong);',
      '  font-size: clamp(1.08rem, 5.4vw, 1.38rem);',
      '  font-weight: 680;',
      '  letter-spacing: -0.042em;',
      '  line-height: 1.08;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
    ].join('\n'),
    [
      '.schedule-heading-row h2 {',
      '  min-width: 0;',
      '  overflow: hidden;',
      '  margin: 0;',
      '  color: var(--auth-text-strong);',
      '  font-size: clamp(1rem, 4.8vw, 1.22rem);',
      '  font-weight: 660;',
      '  letter-spacing: -0.038em;',
      '  line-height: 1.05;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-nav {',
      '  display: inline-grid;',
      '  grid-template-columns: 34px minmax(68px, auto) 34px;',
      '  align-items: center;',
      '  gap: 2px;',
      '  border: 1px solid var(--auth-border);',
      '  border-radius: var(--studio-radius-lg);',
      '  background: var(--auth-bg-card);',
      '  padding: 3px;',
      '}',
    ].join('\n'),
    [
      '.schedule-nav {',
      '  display: inline-grid;',
      '  grid-template-columns: 30px minmax(58px, auto) 30px;',
      '  align-items: center;',
      '  gap: 2px;',
      '  border: 1px solid var(--auth-border);',
      '  border-radius: var(--studio-radius-md);',
      '  background: var(--auth-bg-card);',
      '  padding: 2px;',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-nav button {',
      '  min-width: 0;',
      '  min-height: 34px;',
      '  display: inline-grid;',
      '  place-items: center;',
      '  border-radius: var(--studio-radius-md);',
      '  background: transparent;',
      '  color: var(--auth-text-main);',
      '  padding: 0 8px;',
      '  font-size: var(--studio-text-xs);',
      '  font-weight: 640;',
      '  white-space: nowrap;',
      '}',
    ].join('\n'),
    [
      '.schedule-nav button {',
      '  min-width: 0;',
      '  min-height: 30px;',
      '  display: inline-grid;',
      '  place-items: center;',
      '  border-radius: var(--studio-radius-sm);',
      '  background: transparent;',
      '  color: var(--auth-text-main);',
      '  padding: 0 7px;',
      '  font-size: var(--studio-text-xs);',
      '  font-weight: 620;',
      '  white-space: nowrap;',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-command-row {',
      '  min-width: 0;',
      '  display: grid;',
      '  grid-template-columns: minmax(0, 1fr) minmax(106px, auto);',
      '  align-items: stretch;',
      '  gap: 8px;',
      '}',
    ].join('\n'),
    [
      '.schedule-command-row {',
      '  min-width: 0;',
      '  display: grid;',
      '  grid-template-columns: minmax(0, 1fr) minmax(98px, auto);',
      '  align-items: stretch;',
      '  gap: 7px;',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-command-row .studio-select-trigger {',
      '  min-height: 40px;',
      '  border-radius: var(--studio-radius-lg);',
      '  padding: 5px 10px;',
      '}',
    ].join('\n'),
    [
      '.schedule-command-row .studio-select-trigger {',
      '  min-height: 34px;',
      '  border-radius: var(--studio-radius-md);',
      '  padding: 4px 9px;',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-add-button {',
      '  min-height: 40px;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 7px;',
      '  border: 1px solid var(--auth-accent);',
      '  border-radius: var(--studio-radius-lg);',
      '  background: linear-gradient(135deg, var(--auth-accent), var(--auth-accent-strong));',
      '  color: var(--studio-text-inverse);',
      '  padding: 0 12px;',
      '  font-size: var(--studio-text-xs);',
      '  font-weight: 720;',
      '  white-space: nowrap;',
      '  box-shadow: 0 10px 20px var(--studio-accent-glow);',
      '}',
    ].join('\n'),
    [
      '.schedule-add-button {',
      '  min-height: 34px;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 6px;',
      '  border: 1px solid var(--auth-accent);',
      '  border-radius: var(--studio-radius-md);',
      '  background: linear-gradient(135deg, var(--auth-accent), var(--auth-accent-strong));',
      '  color: var(--studio-text-inverse);',
      '  padding: 0 10px;',
      '  font-size: var(--studio-text-xs);',
      '  font-weight: 700;',
      '  white-space: nowrap;',
      '  box-shadow: 0 8px 16px var(--studio-accent-glow);',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-status-row {',
      '  min-width: 0;',
      '  display: grid;',
      '  grid-template-columns: repeat(3, minmax(0, 1fr));',
      '  gap: 7px;',
      '}',
    ].join('\n'),
    [
      '.schedule-status-row {',
      '  min-width: 0;',
      '  display: grid;',
      '  grid-template-columns: repeat(3, minmax(0, 1fr));',
      '  gap: 6px;',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-status-filter,',
      '.schedule-client-request-alert {',
      '  min-width: 0;',
      '  min-height: 36px;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 6px;',
      '  border: 1px solid var(--auth-border);',
      '  border-radius: var(--studio-radius-lg);',
      '  background: var(--auth-bg-card);',
      '  color: var(--auth-text-muted);',
      '  padding: 0 9px;',
      '  font-size: var(--studio-text-xs);',
      '  font-weight: 620;',
      '  white-space: nowrap;',
      '}',
    ].join('\n'),
    [
      '.schedule-status-filter,',
      '.schedule-client-request-alert {',
      '  min-width: 0;',
      '  min-height: 31px;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 5px;',
      '  border: 1px solid var(--auth-border);',
      '  border-radius: var(--studio-radius-md);',
      '  background: var(--auth-bg-card);',
      '  color: var(--auth-text-muted);',
      '  padding: 0 8px;',
      '  font-size: var(--studio-text-xs);',
      '  font-weight: 610;',
      '  white-space: nowrap;',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-upcoming-head {',
      '  min-height: 36px;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  gap: 8px;',
      '  padding: 0 2px;',
      '}',
    ].join('\n'),
    [
      '.schedule-upcoming-head {',
      '  min-height: 30px;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  gap: 8px;',
      '  padding: 0 2px;',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-upcoming-more,',
      '.schedule-upcoming-empty {',
      '  border-top: 1px solid color-mix(in srgb, var(--auth-border) 76%, transparent);',
      '  padding: 8px 2px;',
      '}',
    ].join('\n'),
    [
      '.schedule-upcoming-more,',
      '.schedule-upcoming-empty {',
      '  border-top: 1px solid color-mix(in srgb, var(--auth-border) 76%, transparent);',
      '  padding: 6px 2px;',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-slot-cell {',
      '  background: color-mix(in srgb, var(--auth-bg-soft) 40%, transparent);',
      '}',
    ].join('\n'),
    [
      '.schedule-slot-cell {',
      '  background: color-mix(in srgb, var(--auth-bg-soft) 18%, var(--auth-bg-card));',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-booking-block {',
      '  position: relative;',
      '  z-index: 18;',
      '  min-width: 0;',
      '  min-height: 0;',
      '  display: grid;',
      '  align-self: stretch;',
      '  align-content: start;',
      '  gap: 1px;',
      '  margin: 3px;',
      '  overflow: hidden;',
      '  border: 1px solid color-mix(in srgb, var(--auth-accent) 34%, var(--auth-border));',
      '  border-left: 3px solid var(--auth-accent);',
      '  border-radius: var(--studio-radius-sm);',
      '  background: var(--auth-bg-card);',
      '  color: var(--auth-text-strong);',
      '  padding: 5px 6px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '}',
    ].join('\n'),
    [
      '.schedule-booking-block {',
      '  position: relative;',
      '  z-index: 18;',
      '  min-width: 0;',
      '  min-height: 0;',
      '  display: grid;',
      '  align-self: stretch;',
      '  align-content: start;',
      '  gap: 1px;',
      '  margin: 3px;',
      '  overflow: hidden;',
      '  isolation: isolate;',
      '  border: 1px solid color-mix(in srgb, var(--auth-accent) 38%, var(--auth-border));',
      '  border-left: 3px solid var(--auth-accent);',
      '  border-radius: var(--studio-radius-sm);',
      '  background: color-mix(in srgb, var(--auth-accent) 16%, var(--auth-bg-elevated));',
      '  color: var(--auth-text-strong);',
      '  padding: 5px 6px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '  box-shadow: 0 0 0 1px color-mix(in srgb, var(--auth-bg-elevated) 80%, transparent);',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-booking-block.is-pending {',
      '  border-color: color-mix(in srgb, var(--auth-warning) 40%, var(--auth-border));',
      '  border-left-color: var(--auth-warning);',
      '  background: var(--auth-warning-soft);',
      '}',
    ].join('\n'),
    [
      '.schedule-booking-block.is-pending {',
      '  border-color: color-mix(in srgb, var(--auth-warning) 48%, var(--auth-border));',
      '  border-left-color: var(--auth-warning);',
      '  background: color-mix(in srgb, var(--auth-warning) 20%, var(--auth-bg-elevated));',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-booking-block.is-dp {',
      '  border-color: color-mix(in srgb, var(--auth-info) 40%, var(--auth-border));',
      '  border-left-color: var(--auth-info);',
      '  background: var(--auth-info-soft);',
      '}',
    ].join('\n'),
    [
      '.schedule-booking-block.is-dp {',
      '  border-color: color-mix(in srgb, var(--auth-info) 48%, var(--auth-border));',
      '  border-left-color: var(--auth-info);',
      '  background: color-mix(in srgb, var(--auth-info) 20%, var(--auth-bg-elevated));',
      '}',
    ].join('\n')
  );

  content = content.replace(
    [
      '.schedule-booking-block.is-lunas {',
      '  border-color: color-mix(in srgb, var(--auth-success) 40%, var(--auth-border));',
      '  border-left-color: var(--auth-success);',
      '  background: var(--auth-success-soft);',
      '}',
    ].join('\n'),
    [
      '.schedule-booking-block.is-lunas {',
      '  border-color: color-mix(in srgb, var(--auth-success) 52%, var(--auth-border));',
      '  border-left-color: var(--auth-success);',
      '  background: color-mix(in srgb, var(--auth-success) 22%, var(--auth-bg-elevated));',
      '}',
    ].join('\n')
  );

  assertBalancedCss(content);
  assertNoForbiddenCss(content);

  mustContain(content, [
    'background: color-mix(in srgb, var(--auth-success) 22%, var(--auth-bg-elevated));',
    'background: color-mix(in srgb, var(--auth-info) 20%, var(--auth-bg-elevated));',
    'background: color-mix(in srgb, var(--auth-warning) 20%, var(--auth-bg-elevated));',
    'min-height: 31px;',
    'min-height: 34px;',
    '--schedule-time-col: 58px;',
  ], SCHEDULE_CSS);

  mustNotContain(content, [
    'background: var(--auth-success-soft);',
    'background: var(--auth-info-soft);',
    'background: var(--auth-warning-soft);',
    '.schedule-mobile-agenda',
    '!important',
    ':has(',
  ], SCHEDULE_CSS);

  write(SCHEDULE_CSS, content);

  console.log('');
  console.log('✅ Phase M2I selesai.');
  console.log('Toolbar lebih padat dan booking block dibuat solid supaya garis hour grid tidak tembus.');
  console.log('');
}

main();