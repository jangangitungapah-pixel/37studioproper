const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();

const SRC_DIR = path.join(ROOT, 'src');
const STYLES_DIR = path.join(ROOT, 'src', 'styles');
const MODULES_DIR = path.join(ROOT, 'src', 'styles', 'modules');
const AGGREGATOR = path.join(ROOT, 'src', 'styles', 'admin-auth.css');

const OUTPUT_MD = path.join(ROOT, 'docs', 'ui-precision-damage-audit.md');
const OUTPUT_JSON = path.join(ROOT, 'docs', 'ui-precision-damage-audit.json');

const IGNORE_DIRS = new Set([
  '.git',
  '.firebase',
  '.vite',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.cache',
]);

const JS_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const CSS_EXTENSIONS = new Set(['.css']);

const PROJECT_PREFIXES = [
  'access-',
  'admin-',
  'auth-',
  'badge-',
  'bento-',
  'billing-',
  'booking-',
  'bookkeeping-',
  'button-',
  'card-',
  'client-',
  'cp-',
  'customer-',
  'dashboard-',
  'empty-',
  'error-',
  'feedback-',
  'gallery-',
  'guard-',
  'guard-attendance-',
  'guard-shift-',
  'inventory-',
  'landing-',
  'loading-',
  'metric-',
  'modal-',
  'notification-',
  'notifications-',
  'operator-',
  'pwa-',
  'safe-area-',
  'schedule-',
  'settings-',
  'shell-',
  'status-',
  'studio-',
  'ui-',
];

const DYNAMIC_CLASSES = new Set([
  'is-active',
  'is-approved',
  'is-attention',
  'is-available',
  'is-booked',
  'is-broken',
  'is-cancelled',
  'is-confirmed',
  'is-create',
  'is-customer',
  'is-danger',
  'is-discount',
  'is-disetujui',
  'is-dp',
  'is-duplicate',
  'is-error',
  'is-failed',
  'is-idle',
  'is-inactive',
  'is-info',
  'is-loading',
  'is-lost',
  'is-low_stock',
  'is-lunas',
  'is-ok',
  'is-on',
  'is-own',
  'is-paid',
  'is-pending',
  'is-posted',
  'is-ready',
  'is-rejected',
  'is-review',
  'is-sent',
  'is-sidebar-collapsed',
  'is-success',
  'is-today',
  'is-total',
  'is-warning',
]);

function fail(message) {
  console.error(`\n[precision-ui-damage-audit] ${message}\n`);
  process.exit(1);
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function run(command) {
  try {
    return execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    return String(error.stdout || error.stderr || error.message || '').trim();
  }
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function walk(dir, result = []) {
  if (!fs.existsSync(dir)) return result;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) walk(absolute, result);
      continue;
    }

    if (entry.isFile()) result.push(absolute);
  }

  return result;
}

function countLines(content) {
  return content ? content.split(/\r?\n/).length : 0;
}

function unique(items) {
  return [...new Set(items)];
}

function sortText(items) {
  return [...items].sort((a, b) => a.localeCompare(b));
}

function isLikelyTailwind(token) {
  if (!token) return false;
  if (token.includes(':')) return true;
  if (token.includes('[') || token.includes(']')) return true;
  if (token.startsWith('-')) return true;

  const exact = new Set([
    'absolute',
    'block',
    'flex',
    'flex-col',
    'flex-wrap',
    'grid',
    'group',
    'hidden',
    'inline',
    'inline-flex',
    'items-center',
    'items-start',
    'items-end',
    'justify-center',
    'justify-between',
    'justify-end',
    'leading-relaxed',
    'leading-tight',
    'line-clamp-1',
    'mx-auto',
    'my-auto',
    'object-cover',
    'overflow-hidden',
    'pointer-events-none',
    'relative',
    'self-start',
    'shrink-0',
    'sticky',
    'tracking-wide',
    'tracking-wider',
    'transition-all',
    'transition-colors',
    'transition-transform',
    'uppercase',
    'w-fit',
  ]);

  if (exact.has(token)) return true;

  return [
    /^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-/,
    /^space-[xy]-/,
    /^gap(-[xy])?-/,
    /^grid-cols-/,
    /^w-/,
    /^h-/,
    /^min-w-/,
    /^min-h-/,
    /^max-w-/,
    /^max-h-/,
    /^inset-/,
    /^top-/,
    /^right-/,
    /^bottom-/,
    /^left-/,
    /^z-/,
    /^rounded($|-)/,
    /^border($|-)/,
    /^bg-/,
    /^text-/,
    /^font-/,
    /^shadow-/,
    /^opacity-/,
    /^duration-/,
    /^from-/,
    /^via-/,
    /^to-/,
    /^ring($|-)/,
    /^cursor-/,
    /^backdrop-/,
  ].some((regex) => regex.test(token));
}

function isProjectClass(token) {
  if (!token) return false;
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(token)) return false;
  if (isLikelyTailwind(token)) return false;
  if (DYNAMIC_CLASSES.has(token)) return true;
  if (token.startsWith('is-')) return true;

  return PROJECT_PREFIXES.some((prefix) => token.startsWith(prefix));
}

function tokenize(raw) {
  return String(raw || '')
    .replace(/\$\{[\s\S]*?\}/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim().replace(/^['"`]+|['"`]+$/g, ''))
    .filter(Boolean)
    .filter(isProjectClass);
}

function addMapItem(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function collectMatches(content, regex, groupIndex = 1) {
  const result = [];
  let match;

  regex.lastIndex = 0;

  while ((match = regex.exec(content)) !== null) {
    result.push(match[groupIndex] || '');
  }

  return result;
}

function stripJsComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function stripCssNoise(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/url\((?:[^()]|\([^)]*\))*\)/g, 'url()')
    .replace(/@import\s+[^;]+;/g, '')
    .replace(/['"][^'"]*['"]/g, '""');
}

function extractJsClasses(content) {
  const clean = stripJsComments(content);
  const tokens = [];

  for (const raw of collectMatches(clean, /className\s*=\s*"([^"]*)"/g)) {
    tokens.push(...tokenize(raw));
  }

  for (const raw of collectMatches(clean, /className\s*=\s*'([^']*)'/g)) {
    tokens.push(...tokenize(raw));
  }

  for (const raw of collectMatches(clean, /className\s*=\s*{\s*['"]([^'"]*)['"]\s*}/g)) {
    tokens.push(...tokenize(raw));
  }

  for (const raw of collectMatches(clean, /className\s*=\s*{\s*`([\s\S]*?)`\s*}/g)) {
    tokens.push(...tokenize(raw));

    const quoted = collectMatches(raw, /['"]([^'"]+)['"]/g);
    for (const item of quoted) tokens.push(...tokenize(item));
  }

  for (const expression of collectMatches(clean, /className\s*=\s*{([\s\S]*?)}/g)) {
    if (
      expression.includes('?') ||
      expression.includes('&&') ||
      expression.includes('||') ||
      expression.includes('clsx') ||
      expression.includes('classNames') ||
      expression.includes('cx(')
    ) {
      const quoted = collectMatches(expression, /['"`]([^'"`]+)['"`]/g);
      for (const item of quoted) tokens.push(...tokenize(item));
    }
  }

  return sortText(unique(tokens));
}

function extractCssClasses(content) {
  const clean = stripCssNoise(content);
  const tokens = collectMatches(clean, /\.([A-Za-z_][A-Za-z0-9_-]*)/g)
    .filter(isProjectClass);

  return sortText(unique(tokens));
}

function extractAggregatorImports() {
  const content = safeRead(AGGREGATOR);
  return collectMatches(content, /@import\s+['"](.+?)['"];/g);
}

function scan() {
  const jsFiles = walk(SRC_DIR).filter((filePath) => JS_EXTENSIONS.has(path.extname(filePath)));
  const cssFiles = walk(STYLES_DIR).filter((filePath) => CSS_EXTENSIONS.has(path.extname(filePath)));

  const jsxClassMap = new Map();
  const cssClassMap = new Map();
  const fileStats = [];

  for (const filePath of jsFiles) {
    const content = safeRead(filePath);
    const classes = extractJsClasses(content);
    const relativePath = rel(filePath);

    for (const className of classes) addMapItem(jsxClassMap, className, relativePath);

    fileStats.push({
      file: relativePath,
      type: 'js',
      lines: countLines(content),
      projectClassCount: classes.length,
      inlineStyleCount: (content.match(/style\s*=\s*{{/g) || []).length,
      hardcodedHexCount: (content.match(/#(?:[0-9a-fA-F]{3}){1,2}/g) || []).length,
      nativeDialogCount: (content.match(/window\.(prompt|confirm|alert)\s*\(/g) || []).length,
    });
  }

  for (const filePath of cssFiles) {
    const content = safeRead(filePath);
    const classes = extractCssClasses(content);
    const relativePath = rel(filePath);

    for (const className of classes) addMapItem(cssClassMap, className, relativePath);

    fileStats.push({
      file: relativePath,
      type: 'css',
      lines: countLines(content),
      projectClassCount: classes.length,
      inlineStyleCount: 0,
      hardcodedHexCount: (content.match(/#(?:[0-9a-fA-F]{3}){1,2}/g) || []).length,
      nativeDialogCount: 0,
    });
  }

  return { jsFiles, cssFiles, jsxClassMap, cssClassMap, fileStats };
}

function addFinding(findings, severity, area, file, problem, evidence, action, recommendation) {
  findings.push({
    severity,
    area,
    file,
    problem,
    evidence,
    action,
    recommendation,
  });
}

function severityRank(severity) {
  return { P0: 0, P1: 1, P2: 2, P3: 3, INFO: 4 }[severity] ?? 99;
}

function analyze() {
  const data = scan();
  const findings = [];

  const jsxClasses = sortText([...data.jsxClassMap.keys()]);
  const cssClasses = sortText([...data.cssClassMap.keys()]);
  const missingCssClasses = jsxClasses.filter((className) => !data.cssClassMap.has(className));
  const cssWithoutJsxClasses = cssClasses.filter((className) => !data.jsxClassMap.has(className) && !DYNAMIC_CLASSES.has(className));

  const moduleFiles = fs.existsSync(MODULES_DIR)
    ? fs.readdirSync(MODULES_DIR).filter((item) => item.endsWith('.css')).sort()
    : [];

  const importedModuleFiles = extractAggregatorImports()
    .map((item) => item.replace('./modules/', ''))
    .filter((item) => item.endsWith('.css'));

  const unimportedModules = moduleFiles.filter((fileName) => !importedModuleFiles.includes(fileName));

  const guardShiftUsed = jsxClasses.filter((className) => className.startsWith('guard-shift-'));
  const guardShiftMissing = guardShiftUsed.filter((className) => !data.cssClassMap.has(className));

  if (guardShiftMissing.length) {
    addFinding(
      findings,
      'P0',
      'Guard Styling',
      'src/pages/guard/GuardAttendancePage.jsx',
      `${guardShiftMissing.length} class guard-shift-* belum punya CSS.`,
      guardShiftMissing.join(', '),
      'CREATE/REWRITE',
      'Lengkapi src/styles/modules/guard-attendance.css.'
    );
  } else {
    addFinding(
      findings,
      'INFO',
      'Guard Styling',
      'src/pages/guard/GuardAttendancePage.jsx',
      'Semua class guard-shift-* yang terdeteksi sudah punya CSS.',
      guardShiftUsed.join(', ') || '(tidak ada guard-shift class terdeteksi)',
      'VERIFY',
      'Cek screenshot mobile karena coverage CSS tidak menjamin layout rapi.'
    );
  }

  if (missingCssClasses.length) {
    addFinding(
      findings,
      missingCssClasses.length > 30 ? 'P1' : 'P2',
      'CSS Coverage',
      'src/**/*.jsx',
      `${missingCssClasses.length} project class terdeteksi di JSX tapi tidak ada di CSS.`,
      missingCssClasses.slice(0, 80).join(', '),
      'VERIFY/CREATE/REWRITE',
      'Tambahkan CSS hanya untuk class yang benar-benar dipakai.'
    );
  }

  if (unimportedModules.length) {
    addFinding(
      findings,
      'P1',
      'CSS Import',
      'src/styles/admin-auth.css',
      `${unimportedModules.length} CSS module belum diimport aggregator.`,
      unimportedModules.join(', '),
      'VERIFY/MOVE/DELETE',
      'Import module aktif atau hapus module obsolete.'
    );
  } else {
    addFinding(
      findings,
      'INFO',
      'CSS Import',
      'src/styles/admin-auth.css',
      'Semua module CSS di src/styles/modules sudah diimport aggregator.',
      moduleFiles.join(', '),
      'KEEP',
      'Pertahankan aggregator eksplisit.'
    );
  }

  for (const item of data.fileStats.filter((entry) => entry.type === 'js' && entry.lines > 700).sort((a, b) => b.lines - a.lines)) {
    addFinding(
      findings,
      item.lines > 1200 ? 'P1' : 'P2',
      'Component Size',
      item.file,
      `File terlalu besar: ${item.lines} lines.`,
      `${item.projectClassCount} project classes`,
      'SPLIT',
      'Pecah bertahap setelah visual stabil.'
    );
  }

  for (const item of data.fileStats.filter((entry) => entry.type === 'css' && entry.lines > 900).sort((a, b) => b.lines - a.lines)) {
    addFinding(
      findings,
      item.lines > 1800 ? 'P1' : 'P2',
      'CSS Size',
      item.file,
      `CSS terlalu besar: ${item.lines} lines.`,
      `${item.projectClassCount} project classes`,
      'SPLIT/VERIFY',
      'Pecah berdasarkan subdomain/component setelah usage map akurat.'
    );
  }

  for (const item of data.fileStats.filter((entry) => entry.inlineStyleCount > 0).sort((a, b) => b.inlineStyleCount - a.inlineStyleCount)) {
    addFinding(
      findings,
      item.inlineStyleCount > 10 ? 'P1' : 'P2',
      'Inline Style',
      item.file,
      `${item.inlineStyleCount} inline style ditemukan.`,
      'style={{ ... }}',
      'REWRITE',
      'Pindahkan ke CSS class berbasis token. Prioritaskan reusable components.'
    );
  }

  for (const item of data.fileStats.filter((entry) => entry.hardcodedHexCount > 0).sort((a, b) => b.hardcodedHexCount - a.hardcodedHexCount)) {
    const isEmail = item.file.includes('emailService');

    addFinding(
      findings,
      isEmail ? 'P2' : item.hardcodedHexCount > 14 ? 'P1' : 'P2',
      'Hardcoded Color',
      item.file,
      `${item.hardcodedHexCount} hex color ditemukan.`,
      '#RRGGBB',
      'VERIFY/REWRITE',
      isEmail
        ? 'Email HTML boleh punya hex sebagai exception, tapi tetap dokumentasikan.'
        : 'Ganti warna surface/status/accent dengan token tanpa mengubah layout.'
    );
  }

  for (const item of data.fileStats.filter((entry) => entry.nativeDialogCount > 0).sort((a, b) => b.nativeDialogCount - a.nativeDialogCount)) {
    addFinding(
      findings,
      'P2',
      'Native Dialog',
      item.file,
      `${item.nativeDialogCount} window.prompt/confirm/alert ditemukan.`,
      'window.prompt / window.confirm / window.alert',
      'REWRITE',
      'Ganti ke ConfirmDialog/ReasonModal/FeedbackAlert secara bertahap.'
    );
  }

  if (cssWithoutJsxClasses.length) {
    addFinding(
      findings,
      'P2',
      'Potential Dead CSS',
      'src/styles/**/*.css',
      `${cssWithoutJsxClasses.length} project CSS class tidak ditemukan di className JSX precision scan.`,
      cssWithoutJsxClasses.slice(0, 100).join(', '),
      'VERIFY/DELETE',
      'Jangan delete massal. Verifikasi dynamic class dan third-party class dulu.'
    );
  }

  findings.sort((a, b) => {
    const severity = severityRank(a.severity) - severityRank(b.severity);
    if (severity !== 0) return severity;
    const area = a.area.localeCompare(b.area);
    if (area !== 0) return area;
    return a.file.localeCompare(b.file);
  });

  return {
    cssClasses,
    cssFiles: data.cssFiles.map(rel),
    cssWithoutJsxClasses,
    fileStats: data.fileStats,
    findings,
    guardShiftMissing,
    guardShiftUsed,
    importedModuleFiles,
    jsFiles: data.jsFiles.map(rel),
    jsxClasses,
    missingCssClasses,
    moduleFiles,
    unimportedModules,
  };
}

function renderTable(rows, columns) {
  if (!rows.length) return '_Tidak ada data._';

  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;

  const body = rows.map((row) => {
    const cells = columns.map((column) => {
      const value = typeof column.value === 'function' ? column.value(row) : row[column.value];
      return String(value ?? '')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, '<br>');
    });

    return `| ${cells.join(' | ')} |`;
  });

  return [header, divider, ...body].join('\n');
}

function renderList(items, fallback = '(none)') {
  return items.length ? items.join('\n') : fallback;
}

function renderReport(result) {
  const gitStatus = run('git status --short');
  const branch = run('git branch --show-current');
  const lastCommit = run('git log -1 --pretty=format:"%h %s"');

  const severityCounts = result.findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1;
    return acc;
  }, {});

  const largestFiles = result.fileStats
    .slice()
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 35);

  const inlineFiles = result.fileStats
    .filter((entry) => entry.inlineStyleCount > 0)
    .sort((a, b) => b.inlineStyleCount - a.inlineStyleCount);

  const hexFiles = result.fileStats
    .filter((entry) => entry.hardcodedHexCount > 0)
    .sort((a, b) => b.hardcodedHexCount - a.hardcodedHexCount)
    .slice(0, 50);

  return [
    '# UI Precision Damage Audit - 37 Studio Proper',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '## Purpose',
    '',
    'Audit ini adalah precision pass setelah audit damage pertama terlalu banyak false positive.',
    '',
    'Yang dihitung sebagai class hanya:',
    '',
    '1. className eksplisit di JSX.',
    '2. project class dengan prefix domain seperti admin-, booking-, guard-shift-, client-, studio-, dan is-*.',
    '3. bukan teks biasa.',
    '4. bukan utility Tailwind umum.',
    '',
    '## Git State',
    '',
    `- Branch: \`${branch || '-'}\``,
    `- Last commit: \`${lastCommit || '-'}\``,
    '',
    '```txt',
    gitStatus || '(clean)',
    '```',
    '',
    '## Executive Summary',
    '',
    `- JS/React files scanned: ${result.jsFiles.length}`,
    `- CSS files scanned: ${result.cssFiles.length}`,
    `- Project JSX classes detected: ${result.jsxClasses.length}`,
    `- Project CSS classes detected: ${result.cssClasses.length}`,
    `- Missing project classes in CSS: ${result.missingCssClasses.length}`,
    `- Potential dead project CSS classes: ${result.cssWithoutJsxClasses.length}`,
    `- CSS modules not imported: ${result.unimportedModules.length}`,
    `- guard-shift classes used: ${result.guardShiftUsed.length}`,
    `- guard-shift missing CSS: ${result.guardShiftMissing.length}`,
    `- Findings P0: ${severityCounts.P0 || 0}`,
    `- Findings P1: ${severityCounts.P1 || 0}`,
    `- Findings P2: ${severityCounts.P2 || 0}`,
    `- Findings INFO: ${severityCounts.INFO || 0}`,
    '',
    '## Damage Triage',
    '',
    result.guardShiftMissing.length
      ? 'Guard portal masih punya class guard-shift-* tanpa CSS. Ini P0.'
      : 'Guard portal tidak lagi terdeteksi missing CSS untuk class guard-shift-*. Lanjutkan screenshot check sebelum patch visual.',
    '',
    '## Findings',
    '',
    renderTable(result.findings, [
      { label: 'Severity', value: 'severity' },
      { label: 'Area', value: 'area' },
      { label: 'File', value: 'file' },
      { label: 'Problem', value: 'problem' },
      { label: 'Evidence', value: 'evidence' },
      { label: 'Action', value: 'action' },
      { label: 'Recommendation', value: 'recommendation' },
    ]),
    '',
    '## CSS Module Import Check',
    '',
    '### Modules Found',
    '',
    '```txt',
    renderList(result.moduleFiles),
    '```',
    '',
    '### Modules Imported',
    '',
    '```txt',
    renderList(result.importedModuleFiles),
    '```',
    '',
    '### Modules Not Imported',
    '',
    '```txt',
    renderList(result.unimportedModules),
    '```',
    '',
    '## guard-shift Coverage',
    '',
    '### guard-shift classes used in JSX',
    '',
    '```txt',
    renderList(result.guardShiftUsed),
    '```',
    '',
    '### guard-shift classes missing CSS',
    '',
    '```txt',
    renderList(result.guardShiftMissing),
    '```',
    '',
    '## Missing Project Classes in CSS',
    '',
    '```txt',
    renderList(result.missingCssClasses.slice(0, 220)),
    '```',
    '',
    '## Potential Dead Project CSS Classes',
    '',
    '```txt',
    renderList(result.cssWithoutJsxClasses.slice(0, 220)),
    '```',
    '',
    '## Largest Files',
    '',
    renderTable(largestFiles, [
      { label: 'File', value: 'file' },
      { label: 'Type', value: 'type' },
      { label: 'Lines', value: 'lines' },
      { label: 'Project Classes', value: 'projectClassCount' },
      { label: 'Inline Styles', value: 'inlineStyleCount' },
      { label: 'Hex Colors', value: 'hardcodedHexCount' },
      { label: 'Native Dialogs', value: 'nativeDialogCount' },
    ]),
    '',
    '## Inline Style Files',
    '',
    renderTable(inlineFiles, [
      { label: 'File', value: 'file' },
      { label: 'Inline Styles', value: 'inlineStyleCount' },
      { label: 'Lines', value: 'lines' },
    ]),
    '',
    '## Hardcoded Hex Files',
    '',
    renderTable(hexFiles, [
      { label: 'File', value: 'file' },
      { label: 'Hex Count', value: 'hardcodedHexCount' },
      { label: 'Lines', value: 'lines' },
    ]),
    '',
    '## Recommended Next Fix Order',
    '',
    '1. Jika guard-shift missing CSS = 0, lanjut screenshot review halaman yang paling rusak.',
    '2. Fix visual paling rusak dulu, bukan file terbesar dulu.',
    '3. Clean inline styles di shared primitives: ConfirmDialog, ErrorBoundary, AccessState, Button/Card.',
    '4. Tokenize high-impact shared CSS sebelum page-specific CSS.',
    '5. Split huge pages setelah UI stabil.',
    '6. Verify dead CSS manual sebelum delete.',
    '',
    '## Screenshot Checklist',
    '',
    '- /guard/attendance mobile',
    '- /admin/dashboard mobile',
    '- /admin/bookkeeping mobile',
    '- /admin/operator-fee mobile',
    '- /admin/notifications mobile',
    '- /client/portal mobile',
    '- /login mobile',
    '',
  ].join('\n');
}

function main() {
  if (!fs.existsSync(SRC_DIR)) fail('Folder src tidak ditemukan.');
  if (!fs.existsSync(STYLES_DIR)) fail('Folder src/styles tidak ditemukan.');
  if (!fs.existsSync(AGGREGATOR)) fail('src/styles/admin-auth.css tidak ditemukan.');

  const result = analyze();

  fs.mkdirSync(path.dirname(OUTPUT_MD), { recursive: true });
  fs.writeFileSync(OUTPUT_MD, renderReport(result), 'utf8');
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(result, null, 2), 'utf8');

  console.log('');
  console.log('[done] Precision UI damage audit selesai.');
  console.log(`Report: ${rel(OUTPUT_MD)}`);
  console.log(`JSON  : ${rel(OUTPUT_JSON)}`);
  console.log('');
  console.log('Buka report:');
  console.log('code docs/ui-precision-damage-audit.md');
}

main();