const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();

const OUTPUT_MD = path.join(ROOT, 'docs', 'ui-overhaul-damage-audit.md');
const OUTPUT_JSON = path.join(ROOT, 'docs', 'ui-overhaul-damage-audit.json');

const SRC_DIR = path.join(ROOT, 'src');
const STYLES_DIR = path.join(ROOT, 'src', 'styles');
const MODULES_DIR = path.join(ROOT, 'src', 'styles', 'modules');
const AGGREGATOR = path.join(ROOT, 'src', 'styles', 'admin-auth.css');

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

const JS_EXT = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const CSS_EXT = new Set(['.css']);

function fail(message) {
  console.error(`\n[audit-ui-overhaul-damage] ${message}\n`);
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

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function rel(filePath) {
  return toPosix(path.relative(ROOT, filePath));
}

function walk(dir, result = []) {
  if (!fs.existsSync(dir)) return result;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(absolute, result);
      continue;
    }

    if (entry.isFile()) result.push(absolute);
  }

  return result;
}

function countLines(content) {
  if (!content) return 0;
  return content.split(/\r?\n/).length;
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

function uniqueSorted(items) {
  return [...new Set(items)].sort((a, b) => a.localeCompare(b));
}

function extractJsxClasses(content) {
  const classes = [];

  const classNameRegex = /className\s*=\s*(?:"([^"]+)"|'([^']+)'|{`([^`]+)`}|{\s*['"]([^'"]+)['"]\s*})/g;
  let match = classNameRegex.exec(content);

  while (match) {
    const raw = match[1] || match[2] || match[3] || match[4] || '';

    raw
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !item.includes('${'))
      .filter((item) => !item.includes('?'))
      .filter((item) => !item.includes(':'))
      .filter((item) => !item.startsWith('['))
      .filter((item) => /^[A-Za-z0-9_-]+$/.test(item))
      .forEach((item) => classes.push(item));

    match = classNameRegex.exec(content);
  }

  // Catch common conditional string classes: condition ? 'a b' : 'c d'
  const quotedClassRegex = /['"]([A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)+)['"]/g;
  match = quotedClassRegex.exec(content);

  while (match) {
    const raw = match[1] || '';
    if (
      raw.includes(' ') &&
      !raw.includes('/') &&
      !raw.includes('.') &&
      !raw.includes('@') &&
      !raw.includes(':')
    ) {
      raw
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => /^[A-Za-z0-9_-]+$/.test(item))
        .forEach((item) => classes.push(item));
    }

    match = quotedClassRegex.exec(content);
  }

  return uniqueSorted(classes);
}

function extractCssClasses(content) {
  const classes = [];
  const classRegex = /\.([A-Za-z_-][A-Za-z0-9_-]*)/g;
  let match = classRegex.exec(content);

  while (match) {
    const className = match[1];

    if (
      className &&
      !className.match(/^\d/) &&
      !['css', 'js', 'jsx', 'png', 'jpg', 'webp', 'svg'].includes(className)
    ) {
      classes.push(className);
    }

    match = classRegex.exec(content);
  }

  return uniqueSorted(classes);
}

function extractImportsFromAggregator() {
  const content = safeRead(AGGREGATOR);
  const imports = [];
  const importRegex = /@import\s+['"](.+?)['"];/g;
  let match = importRegex.exec(content);

  while (match) {
    imports.push(match[1]);
    match = importRegex.exec(content);
  }

  return imports;
}

function getPrefix(className) {
  const parts = className.split('-');
  if (parts.length <= 1) return className;
  if (parts[0] === 'admin' && parts[1]) return parts.slice(0, 2).join('-');
  if (parts[0] === 'guard' && parts[1]) return parts.slice(0, 2).join('-');
  if (parts[0] === 'client' && parts[1]) return parts.slice(0, 2).join('-');
  if (parts[0] === 'studio' && parts[1]) return parts.slice(0, 2).join('-');
  return parts[0];
}

function isLikelyUtilityClass(className) {
  return [
    'flex',
    'grid',
    'block',
    'hidden',
    'relative',
    'absolute',
    'fixed',
    'sticky',
    'items-center',
    'justify-center',
    'justify-between',
    'gap-1',
    'gap-2',
    'gap-3',
    'gap-4',
    'w-full',
    'h-full',
    'mx-auto',
    'my-auto',
    'mb-1',
    'mb-2',
    'mb-3',
    'mb-4',
    'mt-1',
    'mt-2',
    'mt-3',
    'mt-4',
    'text-xs',
    'text-sm',
    'text-base',
    'font-semibold',
    'font-bold',
    'uppercase',
    'rounded',
    'rounded-full',
  ].includes(className) ||
    /^(p|px|py|m|mx|my|mt|mb|ml|mr)-/.test(className) ||
    /^(text|bg|border)-/.test(className) ||
    /^(sm|md|lg|xl):/.test(className);
}

function analyzeFiles() {
  const jsFiles = walk(SRC_DIR).filter((filePath) => JS_EXT.has(path.extname(filePath)));
  const cssFiles = walk(STYLES_DIR).filter((filePath) => CSS_EXT.has(path.extname(filePath)));

  const jsxClassMap = new Map();
  const cssClassMap = new Map();

  const fileStats = [];

  for (const filePath of jsFiles) {
    const content = safeRead(filePath);
    const classes = extractJsxClasses(content);

    fileStats.push({
      file: rel(filePath),
      type: 'jsx/js',
      lines: countLines(content),
      classCount: classes.length,
      inlineStyleCount: (content.match(/style\s*=\s*{{/g) || []).length,
      arbitraryHexCount: (content.match(/#(?:[0-9a-fA-F]{3}){1,2}/g) || []).length,
      windowPromptCount: (content.match(/window\.(prompt|confirm|alert)\s*\(/g) || []).length,
    });

    for (const className of classes) {
      if (!jsxClassMap.has(className)) jsxClassMap.set(className, []);
      jsxClassMap.get(className).push(rel(filePath));
    }
  }

  for (const filePath of cssFiles) {
    const content = safeRead(filePath);
    const classes = extractCssClasses(content);

    fileStats.push({
      file: rel(filePath),
      type: 'css',
      lines: countLines(content),
      classCount: classes.length,
      inlineStyleCount: 0,
      arbitraryHexCount: (content.match(/#(?:[0-9a-fA-F]{3}){1,2}/g) || []).length,
      windowPromptCount: 0,
    });

    for (const className of classes) {
      if (!cssClassMap.has(className)) cssClassMap.set(className, []);
      cssClassMap.get(className).push(rel(filePath));
    }
  }

  return {
    jsFiles,
    cssFiles,
    jsxClassMap,
    cssClassMap,
    fileStats,
  };
}

function analyzeDamage() {
  const findings = [];
  const data = analyzeFiles();

  const jsxClasses = [...data.jsxClassMap.keys()];
  const cssClasses = [...data.cssClassMap.keys()];

  const missingCssClasses = jsxClasses.filter((className) =>
    !isLikelyUtilityClass(className) &&
    !data.cssClassMap.has(className)
  );

  const deadCssClasses = cssClasses.filter((className) =>
    !data.jsxClassMap.has(className) &&
    ![
      'is-active',
      'is-open',
      'is-loading',
      'is-success',
      'is-error',
      'is-warning',
      'is-danger',
      'is-info',
      'is-approved',
      'is-pending',
      'is-rejected',
      'theme-light',
      'light',
    ].includes(className)
  );

  const imports = extractImportsFromAggregator();
  const moduleCssFiles = fs.existsSync(MODULES_DIR)
    ? fs.readdirSync(MODULES_DIR).filter((item) => item.endsWith('.css')).sort()
    : [];

  const importedModuleFiles = imports
    .map((item) => item.replace('./modules/', ''))
    .filter((item) => item.endsWith('.css'));

  const unimportedModules = moduleCssFiles.filter((fileName) => !importedModuleFiles.includes(fileName));

  if (missingCssClasses.length) {
    addFinding(
      findings,
      'P0',
      'CSS Coverage',
      'src/**/*.jsx',
      `${missingCssClasses.length} JSX class tidak ditemukan di CSS.`,
      missingCssClasses.slice(0, 40).join(', '),
      'VERIFY/CREATE/REWRITE',
      'Class yang benar-benar dipakai harus punya style di module CSS yang tepat. Class utility/Tailwind boleh di-ignore setelah verifikasi.'
    );
  }

  const guardMissing = missingCssClasses.filter((item) => item.startsWith('guard-shift'));
  if (guardMissing.length) {
    addFinding(
      findings,
      'P0',
      'Guard UI',
      'src/pages/guard/GuardAttendancePage.jsx',
      `Class guard-shift-* tidak punya CSS: ${guardMissing.length} class.`,
      guardMissing.join(', '),
      'CREATE',
      'Buat src/styles/modules/guard-attendance.css dan import di src/styles/admin-auth.css.'
    );
  }

  if (unimportedModules.length) {
    addFinding(
      findings,
      'P1',
      'CSS Import',
      'src/styles/admin-auth.css',
      `${unimportedModules.length} CSS module belum di-import aggregator.`,
      unimportedModules.join(', '),
      'VERIFY/MOVE',
      'Import module yang masih aktif atau hapus module yang obsolete.'
    );
  }

  const bigFiles = data.fileStats
    .filter((item) => item.lines > 700 && item.type !== 'css')
    .sort((a, b) => b.lines - a.lines);

  for (const file of bigFiles) {
    addFinding(
      findings,
      file.lines > 1200 ? 'P1' : 'P2',
      'Component Size',
      file.file,
      `File terlalu besar: ${file.lines} lines.`,
      `${file.classCount} classes, ${file.inlineStyleCount} inline styles`,
      'SPLIT',
      'Pecah menjadi shell, feature components, hooks, dan UI primitives.'
    );
  }

  const bigCssFiles = data.fileStats
    .filter((item) => item.lines > 900 && item.type === 'css')
    .sort((a, b) => b.lines - a.lines);

  for (const file of bigCssFiles) {
    addFinding(
      findings,
      file.lines > 1600 ? 'P1' : 'P2',
      'CSS Size',
      file.file,
      `CSS file besar: ${file.lines} lines.`,
      `${file.classCount} classes`,
      'SPLIT/VERIFY',
      'Pastikan isi file sesuai domain. Pindahkan style page-specific dari shared/base.'
    );
  }

  const inlineStyleFiles = data.fileStats
    .filter((item) => item.inlineStyleCount > 0)
    .sort((a, b) => b.inlineStyleCount - a.inlineStyleCount);

  for (const file of inlineStyleFiles) {
    addFinding(
      findings,
      file.inlineStyleCount > 15 ? 'P1' : 'P2',
      'Inline Style',
      file.file,
      `Ditemukan ${file.inlineStyleCount} inline style.`,
      'style={{ ... }}',
      'REWRITE',
      'Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten.'
    );
  }

  const arbitraryHexFiles = data.fileStats
    .filter((item) => item.arbitraryHexCount > 0)
    .sort((a, b) => b.arbitraryHexCount - a.arbitraryHexCount);

  for (const file of arbitraryHexFiles) {
    addFinding(
      findings,
      file.arbitraryHexCount > 10 ? 'P1' : 'P2',
      'Hardcoded Color',
      file.file,
      `Ditemukan ${file.arbitraryHexCount} hex color.`,
      '#RRGGBB / arbitrary color',
      'REWRITE',
      'Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi.'
    );
  }

  const promptFiles = data.fileStats
    .filter((item) => item.windowPromptCount > 0)
    .sort((a, b) => b.windowPromptCount - a.windowPromptCount);

  for (const file of promptFiles) {
    addFinding(
      findings,
      'P2',
      'UX Modal',
      file.file,
      `Ditemukan ${file.windowPromptCount} window prompt/confirm/alert.`,
      'window.prompt / window.confirm / window.alert',
      'REWRITE',
      'Ganti dengan ReasonModal, ConfirmDialog, atau FeedbackAlert yang konsisten dan mobile-friendly.'
    );
  }

  const prefixCount = {};
  for (const className of jsxClasses) {
    if (isLikelyUtilityClass(className)) continue;
    const prefix = getPrefix(className);
    prefixCount[prefix] = (prefixCount[prefix] || 0) + 1;
  }

  const suspiciousPrefixes = Object.entries(prefixCount)
    .filter(([, count]) => count >= 20)
    .sort((a, b) => b[1] - a[1]);

  for (const [prefix, count] of suspiciousPrefixes) {
    addFinding(
      findings,
      'INFO',
      'Class Prefix',
      'src/**/*.jsx',
      `Prefix class "${prefix}" muncul ${count} kali.`,
      prefix,
      'VERIFY',
      'Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable.'
    );
  }

  const deadCssSample = deadCssClasses.slice(0, 80);
  if (deadCssSample.length) {
    addFinding(
      findings,
      'P2',
      'Dead CSS',
      'src/styles/**/*.css',
      `${deadCssClasses.length} CSS class tidak ditemukan di JSX scan sederhana.`,
      deadCssSample.join(', '),
      'VERIFY/DELETE',
      'Verifikasi class dinamis dulu. Setelah aman, hapus CSS obsolete agar overhaul tidak meninggalkan puing.'
    );
  }

  return {
    ...data,
    findings,
    missingCssClasses,
    deadCssClasses,
    unimportedModules,
    moduleCssFiles,
    importedModuleFiles,
  };
}

function renderTable(rows) {
  if (!rows.length) return '_Tidak ada temuan._\n';

  const header = '| Severity | Area | File | Problem | Evidence | Action | Recommendation |\n| --- | --- | --- | --- | --- | --- | --- |';
  const body = rows.map((item) => {
    const cells = [
      item.severity,
      item.area,
      item.file,
      item.problem,
      item.evidence,
      item.action,
      item.recommendation,
    ].map((value) => String(value || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>'));

    return `| ${cells.join(' | ')} |`;
  });

  return [header, ...body].join('\n');
}

function renderFileStats(fileStats) {
  const rows = fileStats
    .slice()
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 35)
    .map((item) => `| ${item.file} | ${item.type} | ${item.lines} | ${item.classCount} | ${item.inlineStyleCount} | ${item.arbitraryHexCount} |`);

  return [
    '| File | Type | Lines | Classes | Inline Styles | Hex Colors |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...rows,
  ].join('\n');
}

function renderClassList(title, classes, classMap, limit = 120) {
  const rows = classes.slice(0, limit).map((className) => {
    const files = classMap.get(className) || [];
    return `| ${className} | ${files.slice(0, 5).join('<br>')} |`;
  });

  return [
    `## ${title}`,
    '',
    classes.length ? `Total: ${classes.length}` : 'Total: 0',
    '',
    '| Class | Files |',
    '| --- | --- |',
    ...rows,
  ].join('\n');
}

function renderReport(result) {
  const gitStatus = run('git status --short');
  const gitBranch = run('git branch --show-current');
  const lastCommit = run('git log -1 --pretty=format:"%h %s"');

  const severityCounts = result.findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1;
    return acc;
  }, {});

  return [
    '# UI Overhaul Damage Audit - 37 Studio Proper',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    'Audit ini membaca working tree lokal dan fokus pada kerusakan UI setelah overhaul.',
    '',
    'Yang dicek:',
    '',
    '1. JSX class tanpa CSS.',
    '2. CSS class tanpa JSX usage.',
    '3. CSS module yang tidak di-import aggregator.',
    '4. Inline styles.',
    '5. Hardcoded hex colors.',
    '6. File terlalu besar.',
    '7. CSS terlalu besar.',
    '8. window.prompt/confirm/alert.',
    '9. Prefix class yang tumbuh liar.',
    '',
    '## Git State',
    '',
    `- Branch: \`${gitBranch || '-'}\``,
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
    `- Missing JSX classes in CSS: ${result.missingCssClasses.length}`,
    `- CSS classes not found in JSX scan: ${result.deadCssClasses.length}`,
    `- CSS modules not imported by admin-auth.css: ${result.unimportedModules.length}`,
    `- Findings P0: ${severityCounts.P0 || 0}`,
    `- Findings P1: ${severityCounts.P1 || 0}`,
    `- Findings P2: ${severityCounts.P2 || 0}`,
    `- Findings P3: ${severityCounts.P3 || 0}`,
    `- Findings INFO: ${severityCounts.INFO || 0}`,
    '',
    '## Findings',
    '',
    renderTable(result.findings),
    '',
    '## Largest / Riskiest Files',
    '',
    renderFileStats(result.fileStats),
    '',
    '## CSS Modules',
    '',
    '### Modules Found',
    '',
    '```txt',
    result.moduleCssFiles.join('\n') || '(none)',
    '```',
    '',
    '### Modules Imported by admin-auth.css',
    '',
    '```txt',
    result.importedModuleFiles.join('\n') || '(none)',
    '```',
    '',
    '### Modules Not Imported',
    '',
    '```txt',
    result.unimportedModules.join('\n') || '(none)',
    '```',
    '',
    renderClassList('Missing JSX Classes in CSS', result.missingCssClasses, result.jsxClassMap),
    '',
    renderClassList('Potential Dead CSS Classes', result.deadCssClasses, result.cssClassMap),
    '',
    '## Recommended Fix Order',
    '',
    '1. Fix P0 missing CSS coverage first, especially guard-shift-*.',
    '2. Restore broken mobile layout before refactor.',
    '3. Remove inline styles only after visual baseline is stable.',
    '4. Extract primitives after broken pages are readable.',
    '5. Delete dead CSS only after manual verification because dynamic classes may not be detected by regex.',
    '',
    '## Manual Screenshot Checklist',
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
  if (!fs.existsSync(SRC_DIR)) {
    fail('Folder src tidak ditemukan. Jalankan script dari root repo.');
  }

  if (!fs.existsSync(AGGREGATOR)) {
    fail('src/styles/admin-auth.css tidak ditemukan.');
  }

  const result = analyzeDamage();
  const report = renderReport(result);

  fs.mkdirSync(path.dirname(OUTPUT_MD), { recursive: true });
  fs.writeFileSync(OUTPUT_MD, report, 'utf8');
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    findings: result.findings,
    missingCssClasses: result.missingCssClasses,
    deadCssClasses: result.deadCssClasses,
    unimportedModules: result.unimportedModules,
    fileStats: result.fileStats,
    moduleCssFiles: result.moduleCssFiles,
    importedModuleFiles: result.importedModuleFiles,
  }, null, 2), 'utf8');

  console.log('');
  console.log('[done] UI overhaul damage audit selesai.');
  console.log('Report: ' + rel(OUTPUT_MD));
  console.log('JSON  : ' + rel(OUTPUT_JSON));
  console.log('');
  console.log('Buka report:');
  console.log('code docs/ui-overhaul-damage-audit.md');
}

main();