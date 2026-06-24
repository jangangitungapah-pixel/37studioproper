const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const CLIENT_LANDING_PAGE = 'src/pages/ClientLandingPage.jsx';
const CLIENT_LANDING_CSS = 'src/styles/client-landing.css';

const OLD_STYLES = [
  'src/styles/client-portal-polish.css',
  'src/styles/client-landing-compact.css',
];

const REQUIRED_FILES = [
  'docs/ui-rewrite-code-map.md',
  CLIENT_LANDING_PAGE,
  ...OLD_STYLES,
];

function fail(message) {
  console.error('');
  console.error('❌ Phase 9 gagal.');
  console.error(message);
  console.error('');
  process.exit(1);
}

function absolutePath(relativePath) {
  return path.join(ROOT, relativePath);
}

function assertFileExists(relativePath) {
  const filePath = absolutePath(relativePath);

  if (!fs.existsSync(filePath)) {
    fail('File wajib tidak ditemukan: ' + relativePath);
  }

  if (!fs.statSync(filePath).isFile()) {
    fail('Path wajib bukan file: ' + relativePath);
  }
}

function readUtf8(relativePath) {
  assertFileExists(relativePath);
  return fs.readFileSync(absolutePath(relativePath), 'utf8');
}

function ensureDir(relativePath) {
  fs.mkdirSync(path.dirname(absolutePath(relativePath)), { recursive: true });
}

function createBackup(relativePath) {
  const filePath = absolutePath(relativePath);
  if (!fs.existsSync(filePath)) return;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(filePath, filePath + '.bak-' + stamp);
}

function writeIfChanged(relativePath, nextContent) {
  ensureDir(relativePath);

  const filePath = absolutePath(relativePath);
  const currentContent = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf8')
    : null;

  if (currentContent === nextContent) {
    console.log('✅ Tidak ada perubahan: ' + relativePath);
    return false;
  }

  createBackup(relativePath);
  fs.writeFileSync(filePath, nextContent, 'utf8');
  console.log('✅ Ditulis: ' + relativePath);
  return true;
}

function deleteIfExists(relativePath) {
  const filePath = absolutePath(relativePath);

  if (!fs.existsSync(filePath)) {
    console.log('✅ Sudah tidak ada: ' + relativePath);
    return false;
  }

  createBackup(relativePath);
  fs.unlinkSync(filePath);
  console.log('🗑️ Dihapus: ' + relativePath);
  return true;
}

function verifyContains(content, patterns, fileLabel) {
  for (const pattern of patterns) {
    if (!content.includes(pattern)) {
      fail('Pattern wajib tidak ditemukan di ' + fileLabel + ': ' + pattern);
    }
  }
}

function verifyNotContains(content, patterns, fileLabel) {
  for (const pattern of patterns) {
    if (content.includes(pattern)) {
      fail('Pattern terlarang masih ditemukan di ' + fileLabel + ': ' + pattern);
    }
  }
}

function replaceIfPresent(content, search, replacement) {
  return content.includes(search) ? content.replace(search, replacement) : content;
}

function replaceAllIfPresent(content, search, replacement) {
  return content.split(search).join(replacement);
}

function stripCssComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, '');
}

function assertBalancedCss(content, fileLabel) {
  const clean = stripCssComments(content);
  let balance = 0;

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];

    if (char === '{') balance += 1;
    if (char === '}') balance -= 1;

    if (balance < 0) {
      fail('CSS punya kurung tutup berlebih di ' + fileLabel + ' index ' + index);
    }
  }

  if (balance !== 0) {
    fail('CSS brace belum balance di ' + fileLabel + '. Selisih block: ' + balance);
  }
}

function assertNoForbiddenCss(content, fileLabel) {
  const forbidden = [
    '!important',
    'Montserrat',
    '#050506',
    '#ff8a2a',
    '#ff5f15',
    'rgba(255, 138, 42',
    '0.48rem',
    '0.5rem',
    '0.52rem',
    '0.54rem',
    '0.56rem',
    '0.58rem',
  ];

  for (const pattern of forbidden) {
    if (content.includes(pattern)) {
      fail(fileLabel + ' masih mengandung pattern terlarang: ' + pattern);
    }
  }
}

function walkFiles(dir, result = []) {
  const absoluteDir = absolutePath(dir);
  if (!fs.existsSync(absoluteDir)) return result;

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const absoluteEntry = path.join(absoluteDir, entry.name);
    const relativeEntry = path.relative(ROOT, absoluteEntry).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
      walkFiles(relativeEntry, result);
      continue;
    }

    if (entry.isFile() && /\.(jsx?|tsx?|css)$/.test(entry.name)) {
      result.push(relativeEntry);
    }
  }

  return result;
}

function assertNoOldStyleImportsRemain() {
  const files = walkFiles('src');
  const oldImportFragments = [
    'client-portal-polish.css',
    'client-landing-compact.css',
  ];

  for (const file of files) {
    const content = readUtf8(file);

    for (const fragment of oldImportFragments) {
      if (content.includes(fragment)) {
        fail('Masih ada referensi style lama di ' + file + ': ' + fragment);
      }
    }
  }
}

function patchClientLandingPage() {
  let content = readUtf8(CLIENT_LANDING_PAGE);

  verifyContains(content, [
    "import '../styles/admin-auth.css';",
    "import '../styles/client-portal-polish.css';",
    "import '../styles/client-landing-compact.css';",
    'export default function ClientLandingPage()',
    'async function handleBookingAction',
    'const whatsappUrl = useMemo',
    'return (',
  ], CLIENT_LANDING_PAGE);

  content = content.replace(
    [
      "import '../styles/admin-auth.css';",
      "import '../styles/client-portal-polish.css';",
      "import '../styles/client-landing-compact.css';",
    ].join('\n'),
    [
      "import '../styles/admin-auth.css';",
      "import '../styles/client-landing.css';",
    ].join('\n')
  );

  const oldLoading = [
    '    return (',
    '      <div className="min-h-screen bg-[#050506] flex items-center justify-center font-sans">',
    '        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#ff8a2a]/10 to-transparent pointer-events-none blur-[120px]" />',
    '        <div className="flex flex-col items-center gap-4 z-10">',
    '          <LoaderCircle className="animate-spin text-[#ff8a2a]" size={36} />',
    '          <p className="text-sm text-[#f7f3ec]/60 tracking-wider">Memuat portal...</p>',
    '        </div>',
    '      </div>',
    '    );',
  ].join('\n');

  const newLoading = [
    '    return (',
    '      <div className="client-landing-loading theme-container">',
    '        <div className="client-landing-bg-glow" aria-hidden="true" />',
    '        <div className="client-landing-loading-card">',
    '          <LoaderCircle className="client-landing-spin" size={36} />',
    '          <p>Memuat portal...</p>',
    '        </div>',
    '      </div>',
    '    );',
  ].join('\n');

  content = replaceIfPresent(content, oldLoading, newLoading);

  content = replaceIfPresent(
    content,
    '<div className="client-landing-compact client-polish-shell theme-container min-h-screen bg-[#050506] text-[var(--ui-text-main)] overflow-x-hidden">',
    '<div className="client-landing-page theme-container">'
  );

  content = replaceIfPresent(
    content,
    '<div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#ff8a2a]/10 to-transparent pointer-events-none blur-[120px]" />',
    '<div className="client-landing-bg-glow" aria-hidden="true" />'
  );

  content = replaceIfPresent(
    content,
    '<header className="relative w-full max-w-6xl mx-auto px-4 py-5 flex items-center justify-between border-b border-[var(--ui-border)] z-10">',
    '<header className="client-landing-header">'
  );

  content = replaceIfPresent(
    content,
    '<div className="flex items-center gap-2">',
    '<div className="client-landing-brand">'
  );

  content = replaceIfPresent(
    content,
    '<div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--ui-accent-strong)] to-[var(--ui-accent)] flex items-center justify-center shadow-lg shadow-orange-500/20">',
    '<div className="client-landing-brand-mark">'
  );

  content = replaceIfPresent(
    content,
    '<Volume2 className="text-white w-5 h-5" />',
    '<Volume2 size={20} />'
  );

  content = replaceIfPresent(
    content,
    '<span className="font-semibold text-lg tracking-wider text-white">37 MUSIC</span>',
    '<span className="client-landing-brand-text">37 MUSIC</span>'
  );

  content = replaceIfPresent(
    content,
    '<nav className="hidden md:flex items-center gap-6 text-sm text-[var(--ui-text-muted)] font-medium">',
    '<nav className="client-landing-nav">'
  );

  content = replaceAllIfPresent(
    content,
    'className="hover:text-white transition-colors"',
    'className="client-landing-nav-link"'
  );

  content = replaceAllIfPresent(
    content,
    'className="px-4 py-2 rounded-full bg-gradient-to-r from-[var(--ui-accent-strong)] to-[var(--ui-accent)] hover:opacity-90 text-white text-xs font-bold tracking-wider flex items-center gap-1.5 shadow-lg shadow-orange-500/10 transition-all hover:scale-[1.02]"',
    'className="client-landing-top-action is-primary"'
  );

  content = replaceIfPresent(
    content,
    'className="px-3 py-2 rounded-full bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-white/70 hover:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-all"',
    'className="client-landing-top-action is-secondary"'
  );

  content = replaceIfPresent(
    content,
    '<main className="relative w-full max-w-6xl mx-auto px-4 pt-12 pb-20 z-10">',
    '<main className="client-landing-main">'
  );

  content = replaceIfPresent(
    content,
    '<section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">',
    '<section className="client-landing-hero">'
  );

  content = replaceIfPresent(
    content,
    '<div className="lg:col-span-7 space-y-6 text-center lg:text-left">',
    '<div className="client-landing-hero-copy">'
  );

  content = replaceIfPresent(
    content,
    '<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] text-xs text-[var(--ui-accent)] font-semibold tracking-wide">',
    '<div className="client-landing-kicker">'
  );

  const oldHeroTitle = [
    '            <h1 ',
    '              className="text-5xl md:text-7xl text-white leading-tight font-normal tracking-wide drop-shadow-md select-none"',
    '              style={{ fontFamily: "\'RetroFloral\', sans-serif" }}',
    '            >',
  ].join('\n');

  content = replaceIfPresent(content, oldHeroTitle, '            <h1 className="client-landing-hero-title">');

  content = replaceIfPresent(
    content,
    '<span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--ui-accent)] via-orange-400 to-amber-500">Studio</span>',
    '<span className="client-landing-hero-accent">Studio</span>'
  );

  content = replaceIfPresent(
    content,
    '<p className="text-base md:text-lg text-[var(--ui-text-muted)] max-w-xl mx-auto lg:mx-0 leading-relaxed">',
    '<p className="client-landing-hero-text">'
  );

  content = replaceIfPresent(
    content,
    '<div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">',
    '<div className="client-landing-hero-actions">'
  );

  content = replaceIfPresent(
    content,
    'className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-[var(--ui-accent-strong)] to-[var(--ui-accent)] text-white font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-orange-600/30 hover:shadow-orange-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all"',
    'className="client-landing-button is-primary"'
  );

  content = replaceIfPresent(
    content,
    'className="w-full sm:w-auto px-8 py-4 rounded-full bg-[var(--ui-surface-soft)] hover:bg-[var(--ui-control)] text-white border border-[var(--ui-border)] font-bold text-sm tracking-wider flex items-center justify-center gap-2 hover:border-[var(--ui-border-strong)] transition-all"',
    'className="client-landing-button is-secondary"'
  );

  content = replaceIfPresent(
    content,
    '<div className="lg:col-span-5 relative w-full aspect-[4/3] sm:aspect-video lg:aspect-square rounded-2xl overflow-hidden border border-[var(--ui-border)] shadow-2xl shadow-black/80">',
    '<div className="client-landing-hero-visual">'
  );

  content = replaceIfPresent(
    content,
    'className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-700 ease-out"',
    'className="client-landing-hero-image"'
  );

  content = replaceIfPresent(
    content,
    '<div className="absolute inset-0 bg-gradient-to-t from-[#050506]/90 via-[#050506]/20 to-transparent" />',
    '<div className="client-landing-hero-overlay" aria-hidden="true" />'
  );

  content = replaceIfPresent(
    content,
    '<div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[var(--ui-bg-elevated)] backdrop-blur-md border border-[var(--ui-border)] flex items-center justify-between">',
    '<div className="client-landing-hours-card">'
  );

  verifyContains(content, [
    "import '../styles/client-landing.css';",
    'client-landing-page',
    'client-landing-header',
    'client-landing-main',
    'client-landing-hero',
    'client-landing-button',
    'handleBookingAction',
    'whatsappUrl',
  ], CLIENT_LANDING_PAGE);

  verifyNotContains(content, [
    "import '../styles/client-portal-polish.css';",
    "import '../styles/client-landing-compact.css';",
    'client-polish-shell',
    'client-landing-compact',
    'style={{ fontFamily',
  ], CLIENT_LANDING_PAGE);

  writeIfChanged(CLIENT_LANDING_PAGE, content);
}

function buildClientLandingCss() {
  return [
    '/* Client Landing: Studio OS public booking surface. Owner file, no override layer. */',
    '.client-landing-page,',
    '.client-landing-loading {',
    '  position: relative;',
    '  min-height: 100dvh;',
    '  isolation: isolate;',
    '  overflow-x: hidden;',
    '  background:',
    '    radial-gradient(circle at 14% 0%, var(--studio-accent-soft), transparent 28rem),',
    '    radial-gradient(circle at 86% 92%, var(--studio-accent-glow), transparent 28rem),',
    '    linear-gradient(145deg, var(--studio-bg-app), var(--studio-bg-page) 54%, var(--studio-bg-shell));',
    '  color: var(--auth-text-main);',
    '  font-family: var(--ui-font-sans);',
    '}',
    '',
    '.client-landing-loading {',
    '  display: grid;',
    '  place-items: center;',
    '  padding: 18px;',
    '}',
    '',
    '.client-landing-loading-card {',
    '  position: relative;',
    '  z-index: 1;',
    '  display: grid;',
    '  justify-items: center;',
    '  gap: 14px;',
    '  color: var(--auth-text-muted);',
    '  font-size: var(--studio-text-sm);',
    '  letter-spacing: 0.08em;',
    '}',
    '',
    '.client-landing-spin {',
    '  color: var(--auth-accent);',
    '  animation: client-landing-spin 0.8s linear infinite;',
    '}',
    '',
    '.client-landing-bg-glow {',
    '  position: absolute;',
    '  inset: 0 0 auto;',
    '  height: 500px;',
    '  pointer-events: none;',
    '  background: radial-gradient(circle at 18% 0%, var(--studio-accent-glow), transparent 34rem);',
    '  filter: blur(80px);',
    '  opacity: 0.8;',
    '}',
    '',
    '.client-landing-header,',
    '.client-landing-main {',
    '  position: relative;',
    '  z-index: 1;',
    '  width: min(100%, 1180px);',
    '  margin: 0 auto;',
    '  padding-inline: clamp(14px, 4vw, 28px);',
    '}',
    '',
    '.client-landing-header {',
    '  min-height: 70px;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: space-between;',
    '  gap: 14px;',
    '  border-bottom: 1px solid var(--auth-border);',
    '  padding-block: 12px;',
    '}',
    '',
    '.client-landing-brand,',
    '.client-landing-nav,',
    '.client-landing-top-action,',
    '.client-landing-button,',
    '.client-landing-kicker,',
    '.client-landing-hours-card,',
    '.client-landing-hours-card > div:last-child {',
    '  display: inline-flex;',
    '  align-items: center;',
    '}',
    '',
    '.client-landing-brand {',
    '  min-width: 0;',
    '  gap: 10px;',
    '}',
    '',
    '.client-landing-brand-mark {',
    '  width: 36px;',
    '  height: 36px;',
    '  display: grid;',
    '  place-items: center;',
    '  border-radius: var(--studio-radius-md);',
    '  background: linear-gradient(135deg, var(--auth-accent), var(--auth-accent-strong));',
    '  color: var(--studio-text-inverse);',
    '  box-shadow: 0 16px 34px var(--studio-accent-glow);',
    '}',
    '',
    '.client-landing-brand-text {',
    '  color: var(--auth-text-strong);',
    '  font-size: 1rem;',
    '  font-weight: 820;',
    '  letter-spacing: 0.14em;',
    '  white-space: nowrap;',
    '}',
    '',
    '.client-landing-nav {',
    '  gap: 20px;',
    '}',
    '',
    '.client-landing-nav-link {',
    '  color: var(--auth-text-muted);',
    '  font-size: var(--studio-text-sm);',
    '  font-weight: 680;',
    '  text-decoration: none;',
    '}',
    '',
    '.client-landing-nav-link:hover {',
    '  color: var(--auth-text-strong);',
    '}',
    '',
    '.client-landing-top-action,',
    '.client-landing-button {',
    '  min-height: 42px;',
    '  justify-content: center;',
    '  gap: 8px;',
    '  border: 1px solid var(--auth-border);',
    '  border-radius: var(--studio-radius-full);',
    '  background: var(--auth-bg-control);',
    '  color: var(--auth-text-main);',
    '  padding: 0 14px;',
    '  font-size: var(--studio-text-xs);',
    '  font-weight: 800;',
    '  text-decoration: none;',
    '  letter-spacing: 0.06em;',
    '  cursor: pointer;',
    '}',
    '',
    '.client-landing-top-action.is-primary,',
    '.client-landing-button.is-primary {',
    '  border-color: var(--auth-accent);',
    '  background: linear-gradient(135deg, var(--auth-accent), var(--auth-accent-strong));',
    '  color: var(--studio-text-inverse);',
    '  box-shadow: 0 16px 34px var(--studio-accent-glow);',
    '}',
    '',
    '.client-landing-top-action.is-secondary {',
    '  color: var(--auth-text-muted);',
    '}',
    '',
    '.client-landing-top-action.is-secondary:hover {',
    '  border-color: color-mix(in srgb, var(--auth-danger) 30%, var(--auth-border));',
    '  background: var(--auth-danger-soft);',
    '  color: var(--auth-danger);',
    '}',
    '',
    '.client-landing-main {',
    '  padding-block: clamp(28px, 5vw, 64px) clamp(52px, 8vw, 90px);',
    '}',
    '',
    '.client-landing-main > section {',
    '  scroll-margin-top: 88px;',
    '}',
    '',
    '.client-landing-main > section + section {',
    '  padding-top: clamp(42px, 8vw, 88px);',
    '}',
    '',
    '.client-landing-hero {',
    '  display: grid;',
    '  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);',
    '  align-items: center;',
    '  gap: clamp(24px, 5vw, 56px);',
    '}',
    '',
    '.client-landing-hero-copy {',
    '  min-width: 0;',
    '  display: grid;',
    '  justify-items: start;',
    '  gap: 18px;',
    '}',
    '',
    '.client-landing-kicker {',
    '  gap: 8px;',
    '  border: 1px solid var(--auth-border);',
    '  border-radius: var(--studio-radius-full);',
    '  background: var(--auth-bg-soft);',
    '  color: var(--auth-accent);',
    '  padding: 7px 12px;',
    '  font-size: var(--studio-text-xs);',
    '  font-weight: 760;',
    '  letter-spacing: 0.08em;',
    '}',
    '',
    '.client-landing-hero-title {',
    '  max-width: 9ch;',
    '  margin: 0;',
    '  color: var(--auth-text-strong);',
    '  font-size: clamp(3rem, 10vw, 5.35rem);',
    '  font-weight: 780;',
    '  letter-spacing: -0.07em;',
    '  line-height: 0.9;',
    '  user-select: none;',
    '}',
    '',
    '.client-landing-hero-accent {',
    '  color: var(--auth-accent);',
    '}',
    '',
    '.client-landing-hero-text {',
    '  max-width: 55ch;',
    '  margin: 0;',
    '  color: var(--auth-text-muted);',
    '  font-size: clamp(0.95rem, 2vw, 1.08rem);',
    '  line-height: 1.65;',
    '}',
    '',
    '.client-landing-hero-actions {',
    '  display: flex;',
    '  flex-wrap: wrap;',
    '  align-items: center;',
    '  gap: 12px;',
    '  padding-top: 8px;',
    '}',
    '',
    '.client-landing-button {',
    '  min-height: 48px;',
    '  border-radius: var(--studio-radius-lg);',
    '  padding-inline: 22px;',
    '}',
    '',
    '.client-landing-hero-visual {',
    '  position: relative;',
    '  aspect-ratio: 1 / 1;',
    '  overflow: hidden;',
    '  border: 1px solid var(--auth-border);',
    '  border-radius: var(--studio-radius-2xl);',
    '  background: var(--auth-bg-card);',
    '  box-shadow: var(--studio-shadow-float);',
    '}',
    '',
    '.client-landing-hero-image {',
    '  width: 100%;',
    '  height: 100%;',
    '  object-fit: cover;',
    '  object-position: center;',
    '  transition: transform 700ms ease;',
    '}',
    '',
    '.client-landing-hero-visual:hover .client-landing-hero-image {',
    '  transform: scale(1.05);',
    '}',
    '',
    '.client-landing-hero-overlay {',
    '  position: absolute;',
    '  inset: 0;',
    '  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--studio-bg-page) 86%, transparent));',
    '}',
    '',
    '.client-landing-hours-card {',
    '  position: absolute;',
    '  left: 16px;',
    '  right: 16px;',
    '  bottom: 16px;',
    '  justify-content: space-between;',
    '  gap: 12px;',
    '  border: 1px solid var(--auth-border);',
    '  border-radius: var(--studio-radius-lg);',
    '  background: color-mix(in srgb, var(--auth-bg-elevated) 88%, transparent);',
    '  padding: 14px;',
    '  backdrop-filter: blur(14px);',
    '}',
    '',
    '.client-landing-hours-card p {',
    '  margin: 0;',
    '  color: var(--auth-text-muted);',
    '  font-size: var(--studio-text-xs);',
    '  font-weight: 760;',
    '  letter-spacing: 0.08em;',
    '  text-transform: uppercase;',
    '}',
    '',
    '.client-landing-hours-card h3 {',
    '  margin: 3px 0 0;',
    '  color: var(--auth-text-strong);',
    '  font-size: var(--studio-text-sm);',
    '}',
    '',
    '.client-landing-hours-card > div:last-child {',
    '  gap: 6px;',
    '  border: 1px solid var(--auth-border-strong);',
    '  border-radius: var(--studio-radius-md);',
    '  background: var(--auth-accent-soft);',
    '  color: var(--auth-accent);',
    '  padding: 7px 10px;',
    '  font-size: var(--studio-text-xs);',
    '  font-weight: 760;',
    '}',
    '',
    '.client-landing-page :where(section[id]) > div:first-child {',
    '  display: grid;',
    '  justify-items: center;',
    '  gap: 8px;',
    '  text-align: center;',
    '}',
    '',
    '.client-landing-page :where(section[id]) h2 {',
    '  color: var(--auth-accent);',
    '}',
    '',
    '.client-landing-page :where(section[id]) h3,',
    '.client-landing-page :where(h4, h5) {',
    '  color: var(--auth-text-strong);',
    '}',
    '',
    '.client-landing-page :where(section[id]) p {',
    '  color: var(--auth-text-muted);',
    '  line-height: 1.55;',
    '}',
    '',
    '.client-landing-page :where(input, textarea) {',
    '  min-height: 44px;',
    '  font-size: 16px;',
    '}',
    '',
    '.client-landing-page :where(input, textarea):focus {',
    '  box-shadow: 0 0 0 4px var(--auth-accent-soft);',
    '}',
    '',
    '.client-landing-page :where(.bg-\\[\\#ff8a2a\\], .bg-\\[var\\(--ui-accent\\)\\]) {',
    '  background: var(--auth-accent);',
    '}',
    '',
    '@keyframes client-landing-spin {',
    '  to {',
    '    transform: rotate(360deg);',
    '  }',
    '}',
    '',
    '@media (max-width: 900px) {',
    '  .client-landing-hero {',
    '    grid-template-columns: 1fr;',
    '  }',
    '',
    '  .client-landing-hero-copy {',
    '    justify-items: center;',
    '    text-align: center;',
    '  }',
    '',
    '  .client-landing-hero-visual {',
    '    aspect-ratio: 16 / 10;',
    '  }',
    '}',
    '',
    '@media (max-width: 767px) {',
    '  .client-landing-header {',
    '    position: sticky;',
    '    top: 0;',
    '    z-index: var(--z-sticky);',
    '    min-height: 58px;',
    '    background: color-mix(in srgb, var(--studio-bg-page) 92%, transparent);',
    '    backdrop-filter: blur(18px);',
    '  }',
    '',
    '  .client-landing-nav {',
    '    display: none;',
    '  }',
    '',
    '  .client-landing-brand-mark {',
    '    width: 32px;',
    '    height: 32px;',
    '  }',
    '',
    '  .client-landing-brand-text {',
    '    font-size: 0.84rem;',
    '  }',
    '',
    '  .client-landing-top-action {',
    '    min-height: 36px;',
    '    padding-inline: 11px;',
    '  }',
    '',
    '  .client-landing-main {',
    '    padding-block-start: 24px;',
    '  }',
    '',
    '  .client-landing-hero-copy {',
    '    justify-items: start;',
    '    text-align: left;',
    '  }',
    '',
    '  .client-landing-hero-title {',
    '    font-size: clamp(2.55rem, 15vw, 3.45rem);',
    '    max-width: 8ch;',
    '  }',
    '',
    '  .client-landing-hero-text {',
    '    max-width: 100%;',
    '  }',
    '',
    '  .client-landing-hero-actions,',
    '  .client-landing-button {',
    '    width: 100%;',
    '  }',
    '',
    '  .client-landing-hero-visual {',
    '    display: none;',
    '  }',
    '',
    '  .client-landing-page :where(section[id]) > div:first-child {',
    '    justify-items: start;',
    '    text-align: left;',
    '  }',
    '',
    '  .client-landing-main > section + section {',
    '    padding-top: 42px;',
    '  }',
    '}',
  ].join('\n') + '\n';
}

function writeClientLandingCss() {
  const css = buildClientLandingCss();

  assertBalancedCss(css, CLIENT_LANDING_CSS);
  assertNoForbiddenCss(css, CLIENT_LANDING_CSS);

  verifyContains(css, [
    '.client-landing-page',
    '.client-landing-header',
    '.client-landing-hero',
    '.client-landing-button',
    '.client-landing-loading',
  ], CLIENT_LANDING_CSS);

  writeIfChanged(CLIENT_LANDING_CSS, css);
}

function main() {
  console.log('');
  console.log('🚦 Phase 9 - Client Landing Owner Migration');
  console.log('');

  REQUIRED_FILES.forEach(assertFileExists);

  const codeMap = readUtf8('docs/ui-rewrite-code-map.md');
  verifyContains(codeMap, [
    'Rewrite owners, not patches.',
    'No new override layer.',
    '37 Studio OS',
  ], 'docs/ui-rewrite-code-map.md');

  patchClientLandingPage();
  writeClientLandingCss();

  OLD_STYLES.forEach(deleteIfExists);
  assertNoOldStyleImportsRemain();

  const finalLanding = readUtf8(CLIENT_LANDING_PAGE);
  verifyContains(finalLanding, [
    "import '../styles/client-landing.css';",
    'client-landing-page',
    'client-landing-main',
  ], CLIENT_LANDING_PAGE);

  verifyNotContains(finalLanding, [
    "import '../styles/client-portal-polish.css';",
    "import '../styles/client-landing-compact.css';",
    'client-polish-shell',
    'client-landing-compact',
  ], CLIENT_LANDING_PAGE);

  console.log('');
  console.log('✅ Phase 9 selesai.');
  console.log('Client landing sudah dimigrasi ke owner CSS tunggal.');
  console.log('');
  console.log('Next: Phase 10 - Settings + Gallery remaining admin surfaces.');
  console.log('');
}

main();