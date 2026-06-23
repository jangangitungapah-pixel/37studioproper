const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();

const FILES = {
  adminShellCss: 'src/styles/modules/admin-shell.css',
  primitivesOverrideCss: 'src/styles/modules/primitives-override.css',
  adminAuthCss: 'src/styles/admin-auth.css',
  adminPage: 'src/pages/AdminPage.jsx',
  adminBottomNav: 'src/components/admin/AdminBottomNav.jsx',
  adminTopbar: 'src/components/admin/AdminTopbar.jsx',
  guardCss: 'src/styles/modules/guard-attendance.css',
};

const OUTPUT_MD = path.join(ROOT, 'docs', 'transfer-mobile-shell-audit.md');
const OUTPUT_JSON = path.join(ROOT, 'docs', 'transfer-mobile-shell-audit.json');

function read(file) {
  const fullPath = path.join(ROOT, file);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
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

function countLines(content) {
  return content ? content.split(/\r?\n/).length : 0;
}

function countMatches(content, regex) {
  return (content.match(regex) || []).length;
}

function hasClass(css, className) {
  return new RegExp(`\\.${className}(?:\\s|\\.|:|,|\\{|$)`).test(css);
}

function hasString(content, needle) {
  return content.includes(needle);
}

function extractBlock(css, selector) {
  const index = css.indexOf(selector);
  if (index < 0) return '';

  const start = css.indexOf('{', index);
  if (start < 0) return '';

  let depth = 0;
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return css.slice(index, i + 1);
  }

  return '';
}

function propValue(block, prop) {
  const match = block.match(new RegExp(`${prop}\\s*:\\s*([^;]+);`));
  return match ? match[1].trim() : '';
}

function analyze() {
  const contents = Object.fromEntries(
    Object.entries(FILES).map(([key, file]) => [key, read(file)])
  );

  const adminShellCss = contents.adminShellCss;
  const adminAuthCss = contents.adminAuthCss;
  const guardCss = contents.guardCss;

  const bottomNavBlock = extractBlock(adminShellCss, '.admin-bottom-nav');
  const adminShellBlock = extractBlock(adminShellCss, '.admin-shell');
  const adminStageBlock = extractBlock(adminShellCss, '.admin-stage');
  const topbarBlock = extractBlock(adminShellCss, '.admin-topbar');
  const topbarH1Block = extractBlock(adminShellCss, '.admin-topbar h1');

  const requiredClasses = [
    'admin-shell',
    'admin-stage',
    'admin-topbar',
    'admin-bottom-nav',
    'admin-bottom-item',
    'admin-shell-icon-button',
    'admin-notification-badge',
    'admin-notification-shortcut',
    'admin-topbar-actions',
    'admin-page-loading',
  ];

  const requiredGuardClasses = [
    'guard-shift-page',
    'guard-shift-shell',
    'guard-shift-card',
    'guard-shift-hero',
    'guard-shift-main-button',
    'guard-shift-history',
  ];

  const classCoverage = requiredClasses.map((className) => ({
    className,
    inAdminShellCss: hasClass(adminShellCss, className),
    inPrimitivesOverrideCss: hasClass(contents.primitivesOverrideCss, className),
    usedInAdminPage: hasString(contents.adminPage, className),
    usedInBottomNav: hasString(contents.adminBottomNav, className),
    usedInTopbar: hasString(contents.adminTopbar, className),
  }));

  const guardCoverage = requiredGuardClasses.map((className) => ({
    className,
    inGuardCss: hasClass(guardCss, className),
  }));

  const importedModules = (adminAuthCss.match(/@import\s+['"].+?['"];/g) || [])
    .map((line) => line.replace(/@import\s+['"]|['"];/g, ''));

  const findings = [];

  if (!bottomNavBlock) {
    findings.push({
      severity: 'P1',
      area: 'Mobile Shell',
      problem: '.admin-bottom-nav block tidak ditemukan.',
      recommendation: 'Tambahkan CSS bottom nav yang scoped dan mobile-safe.',
    });
  }

  if (bottomNavBlock && propValue(bottomNavBlock, 'position') === 'fixed') {
    findings.push({
      severity: 'P1',
      area: 'Mobile Shell',
      problem: '.admin-bottom-nav fixed, rawan overlap content.',
      recommendation: 'Pastikan .admin-shell/.admin-stage/page wrapper punya padding-bottom cukup dan section terakhir punya scroll margin.',
    });
  }

  if (bottomNavBlock && propValue(bottomNavBlock, 'grid-template-columns').includes('repeat(2')) {
    findings.push({
      severity: 'P1',
      area: 'Mobile Shell',
      problem: 'Bottom nav terdeteksi repeat(2), padahal screenshot menunjukkan 4 item.',
      recommendation: 'Verifikasi override layer. Samakan CSS final dengan jumlah item aktual: Dashboard, Schedule, Billing, More.',
    });
  }

  if (topbarH1Block && propValue(topbarH1Block, 'font-size').includes('8vw')) {
    findings.push({
      severity: 'P1',
      area: 'Mobile Topbar',
      problem: 'Title mobile memakai clamp dengan 8vw, terlihat terlalu besar di screenshot.',
      recommendation: 'Compact mobile topbar: kecilkan h1 clamp, rapikan action Notifikasi/Keluar.',
    });
  }

  const missingAdminClasses = classCoverage.filter((item) =>
    !item.inAdminShellCss && !item.inPrimitivesOverrideCss
  );

  if (missingAdminClasses.length) {
    findings.push({
      severity: 'P1',
      area: 'CSS Coverage',
      problem: `${missingAdminClasses.length} admin shell class tidak ditemukan di admin-shell/primitives CSS.`,
      recommendation: missingAdminClasses.map((item) => item.className).join(', '),
    });
  }

  const missingGuardClasses = guardCoverage.filter((item) => !item.inGuardCss);

  if (missingGuardClasses.length) {
    findings.push({
      severity: 'P1',
      area: 'Guard CSS',
      problem: `${missingGuardClasses.length} guard class tidak ditemukan.`,
      recommendation: missingGuardClasses.map((item) => item.className).join(', '),
    });
  }

  const fileStats = Object.entries(FILES).map(([key, file]) => {
    const content = contents[key];
    return {
      key,
      file,
      exists: exists(file),
      lines: countLines(content),
      hexColors: countMatches(content, /#(?:[0-9a-fA-F]{3}){1,2}/g),
      inlineStyles: countMatches(content, /style\s*=\s*{{/g),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    git: {
      branch: run('git branch --show-current'),
      lastCommit: run('git log -1 --pretty=format:"%h %s"'),
      status: run('git status --short'),
    },
    importedModules,
    blocks: {
      adminShell: {
        paddingBottom: propValue(adminShellBlock, 'padding-bottom'),
      },
      adminStage: {
        padding: propValue(adminStageBlock, 'padding'),
      },
      adminTopbar: {
        position: propValue(topbarBlock, 'position'),
        margin: propValue(topbarBlock, 'margin'),
        padding: propValue(topbarBlock, 'padding'),
      },
      adminTopbarH1: {
        fontSize: propValue(topbarH1Block, 'font-size'),
        lineHeight: propValue(topbarH1Block, 'line-height'),
      },
      adminBottomNav: {
        position: propValue(bottomNavBlock, 'position'),
        left: propValue(bottomNavBlock, 'left'),
        right: propValue(bottomNavBlock, 'right'),
        bottom: propValue(bottomNavBlock, 'bottom'),
        zIndex: propValue(bottomNavBlock, 'z-index'),
        gridTemplateColumns: propValue(bottomNavBlock, 'grid-template-columns'),
        padding: propValue(bottomNavBlock, 'padding'),
        borderRadius: propValue(bottomNavBlock, 'border-radius'),
      },
    },
    classCoverage,
    guardCoverage,
    fileStats,
    findings,
  };
}

function table(rows, columns) {
  if (!rows.length) return '_Tidak ada data._';

  const head = `| ${columns.map((c) => c.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => {
    const cells = columns.map((c) => String(row[c.key] ?? '').replace(/\|/g, '\\|'));
    return `| ${cells.join(' | ')} |`;
  });

  return [head, sep, ...body].join('\n');
}

function render(report) {
  return [
    '# Transfer Mobile Shell Audit - 37 Studio Proper',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Git State',
    '',
    `- Branch: \`${report.git.branch || '-'}\``,
    `- Last commit: \`${report.git.lastCommit || '-'}\``,
    '',
    '```txt',
    report.git.status || '(clean)',
    '```',
    '',
    '## Summary',
    '',
    'Audit ini dibuat untuk sesi chat baru agar konteks mobile shell tidak hilang.',
    '',
    'Fokus utama:',
    '',
    '1. Bottom nav overlap.',
    '2. Topbar terlalu besar.',
    '3. CSS coverage class admin shell.',
    '4. Guard CSS coverage.',
    '5. File terkait yang berisiko.',
    '',
    '## Findings',
    '',
    table(report.findings, [
      { label: 'Severity', key: 'severity' },
      { label: 'Area', key: 'area' },
      { label: 'Problem', key: 'problem' },
      { label: 'Recommendation', key: 'recommendation' },
    ]),
    '',
    '## CSS Blocks Snapshot',
    '',
    '```json',
    JSON.stringify(report.blocks, null, 2),
    '```',
    '',
    '## Admin Shell Class Coverage',
    '',
    table(report.classCoverage, [
      { label: 'Class', key: 'className' },
      { label: 'admin-shell.css', key: 'inAdminShellCss' },
      { label: 'primitives-override.css', key: 'inPrimitivesOverrideCss' },
      { label: 'AdminPage', key: 'usedInAdminPage' },
      { label: 'BottomNav', key: 'usedInBottomNav' },
      { label: 'Topbar', key: 'usedInTopbar' },
    ]),
    '',
    '## Guard CSS Coverage',
    '',
    table(report.guardCoverage, [
      { label: 'Class', key: 'className' },
      { label: 'guard-attendance.css', key: 'inGuardCss' },
    ]),
    '',
    '## File Stats',
    '',
    table(report.fileStats, [
      { label: 'File', key: 'file' },
      { label: 'Exists', key: 'exists' },
      { label: 'Lines', key: 'lines' },
      { label: 'Hex Colors', key: 'hexColors' },
      { label: 'Inline Styles', key: 'inlineStyles' },
    ]),
    '',
    '## Recommended Next Phase',
    '',
    'PHASE UI-D1A: Admin Mobile Shell Rescue',
    '',
    'Goal:',
    '',
    '1. Fix bottom nav overlap lintas halaman.',
    '2. Compact mobile topbar.',
    '3. Tambah safe bottom area.',
    '4. Jangan ubah business logic.',
    '5. Jangan refactor page besar dulu.',
    '',
  ].join('\n');
}

function main() {
  const report = analyze();

  fs.mkdirSync(path.dirname(OUTPUT_MD), { recursive: true });
  fs.writeFileSync(OUTPUT_MD, render(report), 'utf8');
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), 'utf8');

  console.log('[done] transfer mobile shell audit selesai');
  console.log('Report: docs/transfer-mobile-shell-audit.md');
  console.log('JSON  : docs/transfer-mobile-shell-audit.json');
}

main();