const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SCHEDULE_PAGE = 'src/pages/admin/SchedulePage.jsx';
const SCHEDULE_CSS = 'src/styles/modules/schedule.css';

function fail(message) {
  console.error('');
  console.error('❌ Phase M2E v2 gagal.');
  console.error(message);
  console.error('');
  process.exit(1);
}

function abs(file) {
  return path.join(ROOT, file);
}

function assertFile(file) {
  const filePath = abs(file);
  if (!fs.existsSync(filePath)) fail('File tidak ditemukan: ' + file);
  if (!fs.statSync(filePath).isFile()) fail('Path bukan file: ' + file);
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
      fail('Pattern lama masih ada di ' + label + ': ' + pattern);
    }
  }
}

function replaceBetweenKeepEnd(content, startMarker, endMarker, replacement, label) {
  const start = content.indexOf(startMarker);
  if (start < 0) fail('Start marker tidak ditemukan untuk ' + label + ': ' + startMarker);

  const end = content.indexOf(endMarker, start);
  if (end < 0) fail('End marker tidak ditemukan untuk ' + label + ': ' + endMarker);

  return content.slice(0, start) + replacement + content.slice(end);
}

function stripCssComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, '');
}

function assertBalancedCss(content) {
  const clean = stripCssComments(content);
  let balance = 0;

  for (let i = 0; i < clean.length; i += 1) {
    if (clean[i] === '{') balance += 1;
    if (clean[i] === '}') balance -= 1;
    if (balance < 0) fail('CSS punya kurung tutup berlebih index ' + i);
  }

  if (balance !== 0) fail('CSS brace belum balance. Selisih: ' + balance);
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

function patchSchedulePage() {
  let content = read(SCHEDULE_PAGE);

  mustContain(content, [
    'function ScheduleMobileAgenda({',
    'function CalendarGrid({',
    '<ScheduleMobileAgenda',
    '<CalendarGrid',
    'className="schedule-calendar-surface"',
  ], SCHEDULE_PAGE);

  content = content.replace(/\u00c2\u00b7/g, '-');

  content = replaceBetweenKeepEnd(
    content,
    'function ScheduleMobileAgenda({',
    'function CalendarGrid({',
    '',
    'hapus function ScheduleMobileAgenda'
  );

  content = replaceBetweenKeepEnd(
    content,
    '          <ScheduleMobileAgenda',
    '          <CalendarGrid',
    '',
    'hapus render ScheduleMobileAgenda'
  );

  mustContain(content, [
    'function CalendarGrid({',
    '<CalendarGrid',
    'className="schedule-calendar-surface"',
  ], SCHEDULE_PAGE);

  mustNotContain(content, [
    'function ScheduleMobileAgenda({',
    '<ScheduleMobileAgenda',
    'schedule-mobile-agenda',
    'schedule-mobile-booking-list',
    'schedule-mobile-availability',
    '\u00c2\u00b7',
  ], SCHEDULE_PAGE);

  write(SCHEDULE_PAGE, content);
}

function patchScheduleCss() {
  let content = read(SCHEDULE_CSS);

  mustContain(content, [
    '/* Schedule:',
    '.schedule-page',
    '.schedule-heading-row',
    '.schedule-command-row',
    '.schedule-status-row',
    '.schedule-mobile-agenda',
    '.schedule-grid-shell',
    '@media (min-width: 768px)',
  ], SCHEDULE_CSS);

  content = replaceBetweenKeepEnd(
    content,
    '.schedule-mobile-agenda {',
    '.schedule-grid-shell {',
    '',
    'hapus CSS mobile agenda'
  );

  content = content.replace('--schedule-time-col: 86px;', '--schedule-time-col: 64px;');
  content = content.replace('--schedule-month-day-col: 86px;', '--schedule-month-day-col: 84px;');
  content = content.replace('--schedule-week-day-col: 112px;', '--schedule-week-day-col: 98px;');

  content = content.replace(
    '.schedule-grid-shell {\n  display: none;\n',
    '.schedule-grid-shell {\n'
  );

  content = content.replace(
    '.schedule-toolbar {\n  gap: 6px;\n}',
    '.schedule-toolbar {\n  gap: 10px;\n}'
  );

  content = content.replace(
    'grid-template-columns: minmax(0, 1fr) minmax(92px, auto);',
    'grid-template-columns: minmax(0, 1fr) minmax(108px, auto);'
  );

  content = content.replace(
    '.schedule-grid-scroll {\n  width: 100%;\n  overflow: auto;\n  overscroll-behavior: contain;\n  touch-action: pan-x pan-y;\n  scrollbar-width: none;\n}',
    [
      '.schedule-grid-scroll {',
      '  width: 100%;',
      '  overflow: auto;',
      '  overscroll-behavior: contain;',
      '  touch-action: pan-x pan-y;',
      '  -webkit-overflow-scrolling: touch;',
      '  scroll-behavior: smooth;',
      '  scrollbar-width: none;',
      '}',
      '',
      '.schedule-grid-scroll::-webkit-scrollbar {',
      '  display: none;',
      '}',
    ].join('\n')
  );

  content = content.replace('grid-auto-rows: minmax(46px, auto);', 'grid-auto-rows: minmax(44px, auto);');
  content = content.replaceAll('min-height: 52px;', 'min-height: 48px;');
  content = content.replaceAll('min-height: 46px;', 'min-height: 44px;');

  const mobileGridPolish = [
    '',
    '@media (max-width: 767px) {',
    '  .schedule-calendar-surface {',
    '    min-width: 0;',
    '  }',
    '',
    '  .schedule-grid-shell {',
    '    border-radius: var(--studio-radius-lg);',
    '  }',
    '',
    '  .schedule-grid {',
    '    grid-auto-rows: minmax(42px, auto);',
    '  }',
    '',
    '  .schedule-grid-corner,',
    '  .schedule-day-head {',
    '    min-height: 44px;',
    '  }',
    '',
    '  .schedule-time-cell,',
    '  .schedule-slot-cell,',
    '  .schedule-slot-button {',
    '    min-height: 42px;',
    '  }',
    '',
    '  .schedule-time-cell {',
    '    grid-template-columns: 1fr;',
    '    gap: 0;',
    '    padding-inline: 6px;',
    '  }',
    '',
    '  .schedule-time-cell svg {',
    '    display: none;',
    '  }',
    '',
    '  .schedule-booking-block {',
    '    margin: 2px;',
    '    padding: 5px 6px;',
    '  }',
    '',
    '  .schedule-booking-topline strong {',
    '    font-size: 0.6875rem;',
    '  }',
    '',
    '  .schedule-booking-title,',
    '  .schedule-booking-meta {',
    '    font-size: 0.625rem;',
    '  }',
    '}',
    '',
  ].join('\n');

  if (!content.includes('@media (max-width: 767px) {\n  .schedule-calendar-surface')) {
    content = content.replace('@media (min-width: 768px) {', mobileGridPolish + '@media (min-width: 768px) {');
  }

  assertBalancedCss(content);
  assertNoForbiddenCss(content);

  mustContain(content, [
    '.schedule-grid-shell',
    '.schedule-grid-scroll::-webkit-scrollbar',
    '@media (max-width: 767px)',
    '@media (min-width: 768px)',
  ], SCHEDULE_CSS);

  mustNotContain(content, [
    '.schedule-mobile-agenda',
    '.schedule-mobile-booking-list',
    '.schedule-mobile-availability',
    'display: none;\n  min-width: 0;\n  overflow: hidden;\n  border: 1px solid var(--auth-border);',
  ], SCHEDULE_CSS);

  write(SCHEDULE_CSS, content);
}

function main() {
  console.log('');
  console.log('🚦 Phase M2E v2 - Restore Schedule Mobile Grid');
  console.log('');

  assertFile(SCHEDULE_PAGE);
  assertFile(SCHEDULE_CSS);
  assertFile('docs/ui-rewrite-code-map.md');

  const codeMap = read('docs/ui-rewrite-code-map.md');
  mustContain(codeMap, [
    'Rewrite owners, not patches.',
    'No new override layer.',
    '37 Studio OS',
  ], 'docs/ui-rewrite-code-map.md');

  patchSchedulePage();
  patchScheduleCss();

  console.log('');
  console.log('✅ Phase M2E v2 selesai.');
  console.log('Schedule mobile balik ke calendar grid, agenda mobile dibersihkan, toolbar dibuat lebih lega.');
  console.log('');
}

main();