const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const files = {
  clientPage: path.join(ROOT, 'src', 'pages', 'ClientLandingPage.jsx'),
  clientCss: path.join(ROOT, 'src', 'styles', 'client-portal-polish.css'),
};

const IMPORT_LINE = "import '../styles/client-portal-polish.css';";

function fail(message) {
  console.error(`\n[fix-client-portal-mobile-layout] ${message}\n`);
  process.exit(1);
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`File tidak ditemukan: ${path.relative(ROOT, filePath)}`);
  }
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

function ensureClientCssImport() {
  assertFile(files.clientPage);

  const before = fs.readFileSync(files.clientPage, 'utf8');
  let after = before;

  if (!after.includes(IMPORT_LINE)) {
    const adminCssImport = "import '../styles/admin-auth.css';";

    if (!after.includes(adminCssImport)) {
      fail(`Anchor import admin-auth.css tidak ditemukan di ${path.relative(ROOT, files.clientPage)}`);
    }

    after = after.replace(adminCssImport, `${adminCssImport}\n${IMPORT_LINE}`);
  }

  after = after.replace(
    /className="([^"]*\btheme-container\b[^"]*)"/g,
    (match, classNameValue) => {
      if (classNameValue.includes('client-polish-shell')) return match;

      return `className="client-polish-shell ${classNameValue}"`;
    }
  );

  if (!after.includes('client-polish-shell')) {
    fail('Gagal memasang class client-polish-shell. Cek root wrapper ClientLandingPage.jsx.');
  }

  writeIfChanged(files.clientPage, before, after);
}

function writeClientCss() {
  const before = fs.existsSync(files.clientCss)
    ? fs.readFileSync(files.clientCss, 'utf8')
    : '';

  const after = `/* === CLIENT PORTAL MOBILE POLISH: START === */

.client-polish-shell {
  --client-shell-max: 960px;
  --client-header-height: 74px;
  --client-bottom-nav-height: 84px;
  --client-gutter: clamp(16px, 4vw, 28px);
  --client-card-radius: 28px;
  --client-card-border: rgba(255, 255, 255, 0.105);
  --client-card-bg: rgba(15, 15, 17, 0.72);
  --client-card-bg-strong: rgba(18, 16, 15, 0.86);
  --client-soft-bg: rgba(255, 255, 255, 0.055);
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  overflow-x: hidden;
  color: var(--ui-text-main, #f7f3ec);
  background:
    radial-gradient(circle at 14% 0%, rgba(255, 138, 42, 0.17), transparent 26rem),
    radial-gradient(circle at 86% 92%, rgba(255, 95, 21, 0.14), transparent 26rem),
    linear-gradient(145deg, #050506 0%, #080706 52%, #170906 100%);
}

.client-polish-shell,
.client-polish-shell * {
  box-sizing: border-box;
}

.client-polish-shell > .absolute:first-child,
.client-polish-shell > [class*="absolute"][class*="blur"] {
  pointer-events: none;
  opacity: 0.72;
}

.client-polish-shell header {
  width: min(100%, var(--client-shell-max));
  min-height: var(--client-header-height);
  margin-inline: auto;
  padding: 12px var(--client-gutter) !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.075) !important;
}

.client-polish-shell header > div:first-child {
  min-width: 0;
}

.client-polish-shell header span {
  line-height: 1.1;
}

.client-polish-shell header [class*="rounded"] {
  flex: 0 0 auto;
}

.client-polish-shell main,
.client-polish-shell [data-client-main],
.client-polish-shell .client-portal-main {
  width: min(100%, var(--client-shell-max));
  margin-inline: auto;
  padding-inline: var(--client-gutter) !important;
}

.client-polish-shell section {
  min-width: 0;
}

.client-polish-shell h1,
.client-polish-shell h2,
.client-polish-shell h3,
.client-polish-shell h4,
.client-polish-shell p {
  overflow-wrap: anywhere;
}

.client-polish-shell :where(article, section, aside, form, div)[class*="rounded"] {
  max-width: 100%;
}

.client-polish-shell :where(article, section, aside, form)[class*="border"],
.client-polish-shell :where(div)[class*="border"][class*="rounded"] {
  border-color: var(--client-card-border) !important;
}

.client-polish-shell :where(article, section, aside, form)[class*="bg-"],
.client-polish-shell :where(div)[class*="bg-"][class*="rounded"] {
  backdrop-filter: blur(18px);
}

.client-polish-shell input,
.client-polish-shell textarea,
.client-polish-shell select,
.client-polish-shell button,
.client-polish-shell a {
  -webkit-tap-highlight-color: transparent;
}

.client-polish-shell input,
.client-polish-shell textarea {
  min-height: 48px;
  font-size: 16px;
}

.client-polish-shell [class*="grid"] {
  min-width: 0;
}

.client-polish-shell [class*="overflow-hidden"] {
  min-width: 0;
}

.client-polish-shell [class*="overflow-x"] {
  -webkit-overflow-scrolling: touch;
}

.client-polish-shell [class*="sticky"],
.client-polish-shell [class*="fixed"] {
  backface-visibility: hidden;
}

/* Bottom navigation polish */
.client-polish-shell nav[class*="fixed"],
.client-polish-shell [class*="fixed"][class*="bottom"] {
  left: 14px !important;
  right: 14px !important;
  bottom: calc(12px + env(safe-area-inset-bottom)) !important;
  width: auto !important;
  max-width: min(720px, calc(100vw - 28px));
  margin-inline: auto;
  min-height: var(--client-bottom-nav-height);
  padding: 10px 12px !important;
  border: 1px solid rgba(255, 255, 255, 0.105) !important;
  border-radius: 28px !important;
  background:
    linear-gradient(180deg, rgba(22, 23, 26, 0.94), rgba(7, 7, 8, 0.94)) !important;
  box-shadow:
    0 22px 70px rgba(0, 0, 0, 0.54),
    inset 0 1px 0 rgba(255, 255, 255, 0.055);
  backdrop-filter: blur(22px);
  z-index: 80 !important;
}

.client-polish-shell nav[class*="fixed"] button,
.client-polish-shell [class*="fixed"][class*="bottom"] button,
.client-polish-shell nav[class*="fixed"] a,
.client-polish-shell [class*="fixed"][class*="bottom"] a {
  min-width: 0;
  min-height: 58px;
  border-radius: 20px;
}

/* Prevent content being hidden behind bottom nav */
.client-polish-shell main,
.client-polish-shell > section,
.client-polish-shell > div:not([class*="absolute"]) {
  padding-bottom: calc(var(--client-bottom-nav-height) + 34px + env(safe-area-inset-bottom));
}

/* Client portal home cards */
.client-polish-shell [class*="grid-cols-2"] > :where(article, div)[class*="rounded"] {
  min-height: 132px;
}

.client-polish-shell [class*="grid-cols-2"] strong,
.client-polish-shell [class*="grid-cols-2"] b {
  letter-spacing: -0.03em;
}

/* Empty states */
.client-polish-shell [class*="text-center"][class*="rounded"] {
  display: grid;
  place-items: center;
}

.client-polish-shell [class*="text-center"][class*="rounded"] strong {
  color: rgba(255, 255, 255, 0.86);
}

/* Schedule tab hardening */
.client-polish-shell [aria-label*="calendar" i],
.client-polish-shell [aria-label*="jadwal" i],
.client-polish-shell [aria-labelledby*="calendar" i] {
  min-width: 0;
}

.client-polish-shell [class*="schedule"],
.client-polish-shell [class*="calendar"],
.client-polish-shell [class*="booking"] {
  max-width: 100%;
}

.client-polish-shell [class*="calendar"][class*="grid"],
.client-polish-shell [class*="schedule"][class*="grid"],
.client-polish-shell [class*="booking"][class*="grid"] {
  isolation: isolate;
}

/* The booking simulator/card must stay in normal flow, not floating above grid */
.client-polish-shell [class*="Simulasi"],
.client-polish-shell [class*="simulator"],
.client-polish-shell [class*="booking-card"],
.client-polish-shell [class*="booking-panel"] {
  position: relative;
  z-index: 2;
}

/* Reduce accidental overlap from absolute decorative layers */
.client-polish-shell [class*="absolute"][class*="inset"],
.client-polish-shell [class*="absolute"][class*="blur"] {
  pointer-events: none;
}

.client-polish-shell [class*="absolute"][class*="blur"] {
  z-index: -1;
}

/* Payment page readability */
.client-polish-shell [class*="rekening"],
.client-polish-shell [class*="payment"],
.client-polish-shell [class*="tagihan"] {
  max-width: 100%;
}

.client-polish-shell [class*="text-5xl"],
.client-polish-shell [class*="text-6xl"],
.client-polish-shell [class*="text-7xl"] {
  letter-spacing: -0.055em;
}

@media (max-width: 767px) {
  .client-polish-shell {
    --client-header-height: 70px;
    --client-bottom-nav-height: 82px;
    --client-gutter: 16px;
    font-size: 15px;
  }

  .client-polish-shell header {
    position: sticky;
    top: 0;
    z-index: 70;
    min-height: var(--client-header-height);
    background:
      linear-gradient(180deg, rgba(5, 5, 6, 0.96), rgba(5, 5, 6, 0.82));
    backdrop-filter: blur(18px);
  }

  .client-polish-shell header [class*="w-8"],
  .client-polish-shell header [class*="h-8"] {
    width: 52px !important;
    height: 52px !important;
    border-radius: 17px !important;
  }

  .client-polish-shell header span[class*="tracking"] {
    font-size: clamp(1rem, 4.5vw, 1.32rem) !important;
    letter-spacing: 0.13em !important;
    white-space: nowrap;
  }

  .client-polish-shell header > div:last-child {
    gap: 8px !important;
    min-width: 0;
    justify-content: flex-end;
  }

  .client-polish-shell header button {
    min-width: 48px;
    min-height: 48px;
  }

  .client-polish-shell main {
    padding-top: 20px !important;
  }

  .client-polish-shell main > section,
  .client-polish-shell main > div,
  .client-polish-shell > section,
  .client-polish-shell > div:not([class*="absolute"]) {
    margin-top: 0;
  }

  .client-polish-shell :where(article, section, aside, form)[class*="rounded"],
  .client-polish-shell :where(div)[class*="border"][class*="rounded"] {
    border-radius: 24px !important;
  }

  .client-polish-shell :where(article, section, aside, form)[class*="p-8"],
  .client-polish-shell :where(div)[class*="p-8"] {
    padding: 22px !important;
  }

  .client-polish-shell :where(article, section, aside, form)[class*="p-6"],
  .client-polish-shell :where(div)[class*="p-6"] {
    padding: 20px !important;
  }

  .client-polish-shell [class*="pt-24"] {
    padding-top: 42px !important;
  }

  .client-polish-shell [class*="space-y-12"] > :not([hidden]) ~ :not([hidden]) {
    margin-top: 24px !important;
  }

  .client-polish-shell [class*="space-y-8"] > :not([hidden]) ~ :not([hidden]) {
    margin-top: 18px !important;
  }

  .client-polish-shell [class*="gap-12"] {
    gap: 24px !important;
  }

  .client-polish-shell [class*="gap-8"] {
    gap: 18px !important;
  }

  .client-polish-shell [class*="gap-6"] {
    gap: 14px !important;
  }

  .client-polish-shell [class*="grid-cols-2"] {
    gap: 12px !important;
  }

  .client-polish-shell [class*="grid-cols-2"] > :where(article, div)[class*="rounded"] {
    min-height: 116px;
    padding: 18px !important;
  }

  .client-polish-shell h1 {
    font-size: clamp(2.65rem, 13vw, 4.5rem) !important;
    line-height: 0.96 !important;
  }

  .client-polish-shell h2,
  .client-polish-shell h3 {
    line-height: 1.1 !important;
  }

  .client-polish-shell p {
    line-height: 1.58 !important;
  }

  .client-polish-shell [class*="text-center"][class*="rounded"] {
    min-height: 210px;
    padding-block: 34px !important;
  }

  /* Schedule controls become compact and stacked cleanly */
  .client-polish-shell [class*="DAY"],
  .client-polish-shell [class*="WEEK"],
  .client-polish-shell [class*="MONTH"] {
    white-space: nowrap;
  }

  .client-polish-shell [class*="grid"][style*="grid-template-columns"],
  .client-polish-shell [style*="gridTemplateColumns"] {
    min-width: max-content;
  }

  .client-polish-shell [class*="overflow-x"],
  .client-polish-shell [class*="overflow-auto"] {
    border-radius: 24px;
    overscroll-behavior-x: contain;
  }

  .client-polish-shell a[href*="wa.me"] {
    min-height: 56px;
    border-radius: 18px !important;
    font-size: 0.85rem !important;
    letter-spacing: 0.02em !important;
  }

  .client-polish-shell nav[class*="fixed"] {
    display: grid !important;
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }

  .client-polish-shell nav[class*="fixed"] button,
  .client-polish-shell nav[class*="fixed"] a {
    display: grid !important;
    place-items: center;
    gap: 4px;
    padding: 7px 4px !important;
    font-size: 0.72rem !important;
    line-height: 1.1;
  }

  .client-polish-shell nav[class*="fixed"] svg {
    width: 22px;
    height: 22px;
  }
}

@media (min-width: 768px) {
  .client-polish-shell {
    padding-bottom: 0;
  }

  .client-polish-shell main {
    padding-bottom: 72px !important;
  }

  .client-polish-shell nav[class*="fixed"],
  .client-polish-shell [class*="fixed"][class*="bottom"] {
    max-width: 640px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .client-polish-shell *,
  .client-polish-shell *::before,
  .client-polish-shell *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}

/* === CLIENT PORTAL MOBILE POLISH: END === */
`;

  writeIfChanged(files.clientCss, before, after);
}

function main() {
  ensureClientCssImport();
  writeClientCss();

  console.log('\n[done] Client portal mobile layout polish sudah dipasang.');
}

main()