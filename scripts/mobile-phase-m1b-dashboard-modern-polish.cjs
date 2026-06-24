const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DASHBOARD_PAGE = 'src/pages/admin/DashboardPage.jsx';
const DASHBOARD_CSS = 'src/styles/modules/dashboard.css';

function fail(message) {
  console.error('');
  console.error('❌ Phase M1B gagal.');
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
    fail('File tidak ditemukan: ' + relativePath);
  }

  if (!fs.statSync(filePath).isFile()) {
    fail('Path bukan file: ' + relativePath);
  }
}

function read(relativePath) {
  assertFile(relativePath);
  return fs.readFileSync(abs(relativePath), 'utf8');
}

function backup(relativePath) {
  const filePath = abs(relativePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(filePath, filePath + '.bak-' + stamp);
}

function write(relativePath, nextContent) {
  const filePath = abs(relativePath);
  const currentContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';

  if (currentContent === nextContent) {
    console.log('✅ Tidak ada perubahan: ' + relativePath);
    return false;
  }

  backup(relativePath);
  fs.writeFileSync(filePath, nextContent, 'utf8');
  console.log('✅ Ditulis: ' + relativePath);
  return true;
}

function mustContain(content, patterns, fileLabel) {
  for (const pattern of patterns) {
    if (!content.includes(pattern)) {
      fail('Pattern wajib tidak ditemukan di ' + fileLabel + ': ' + pattern);
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
    const char = clean[index];

    if (char === '{') balance += 1;
    if (char === '}') balance -= 1;

    if (balance < 0) {
      fail('CSS punya kurung tutup berlebih di index ' + index);
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
      fail('dashboard.css masih mengandung pattern terlarang: ' + pattern);
    }
  }
}

function patchDashboardPageSafely() {
  let content = read(DASHBOARD_PAGE);

  mustContain(content, [
    'function DashboardChart',
    'function DashboardUpcoming',
    'function DashboardAttention',
    '<section className="dashboard-page"',
    '<section className="dashboard-hero">',
  ], DASHBOARD_PAGE);

  const before = content;

  content = content.replace(
    /<ResponsiveContainer\s+width="100%"\s+height=\{220\}>/u,
    '<ResponsiveContainer width="100%" height={200}>'
  );

  content = content.replace(
    /<ResponsiveContainer\s+width="100%"\s+height=\{260\}>/u,
    '<ResponsiveContainer width="100%" height={200}>'
  );

  if (content === before) {
    console.log('ℹ️ DashboardPage.jsx tidak diubah. Chart height sudah bukan 220/260 atau format berbeda, lanjut CSS polish.');
    return;
  }

  mustContain(content, [
    '<ResponsiveContainer width="100%" height={200}>',
  ], DASHBOARD_PAGE);

  write(DASHBOARD_PAGE, content);
}

function buildDashboardCss() {
  return `/* Admin dashboard: compact premium mobile control panel. Owner file, no override layer. */
.dashboard-page {
  --dashboard-income: var(--auth-success);
  --dashboard-income-soft: var(--auth-success-soft);
  --dashboard-expense: var(--auth-warning);
  --dashboard-expense-soft: var(--auth-warning-soft);
  --dashboard-net: var(--auth-accent);
  --dashboard-net-soft: var(--auth-accent-soft);
  --dashboard-customer: var(--studio-info);
  --dashboard-customer-soft: var(--studio-info-soft);
  --dashboard-chart-grid: color-mix(in srgb, var(--auth-border) 66%, transparent);
  --dashboard-chart-cursor: color-mix(in srgb, var(--auth-bg-soft) 72%, transparent);
  width: min(100%, 1560px);
  display: grid;
  gap: 10px;
  margin: 0 auto;
  color: var(--auth-text-main);
}

.dashboard-hero,
.dashboard-metric-card,
.dashboard-chart-card,
.dashboard-list-card,
.dashboard-mini-card {
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--auth-border) 88%, transparent);
  background: color-mix(in srgb, var(--auth-bg-card) 94%, transparent);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--studio-shadow-color) 12%, transparent);
}

.dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  border-radius: var(--studio-radius-lg);
  background:
    radial-gradient(circle at 0% 0%, var(--studio-accent-soft), transparent 24%),
    color-mix(in srgb, var(--auth-bg-card) 94%, transparent);
  padding: 10px 11px;
}

.dashboard-hero p,
.dashboard-chart-card header small,
.dashboard-list-card header small,
.dashboard-metric-card small,
.dashboard-mini-card small {
  margin: 0;
  color: var(--auth-text-muted);
  font-size: var(--studio-text-xs);
  font-weight: 660;
  letter-spacing: 0.075em;
  text-transform: uppercase;
}

.dashboard-hero h2 {
  margin: 2px 0 0;
  color: var(--auth-text-strong);
  font-size: clamp(1rem, 4.7vw, 1.28rem);
  font-weight: 680;
  letter-spacing: -0.04em;
  line-height: 1.02;
}

.dashboard-hero > div > span {
  display: none;
}

.dashboard-chart-card header > div > span {
  display: none;
}

.dashboard-hero button,
.dashboard-list-card header button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--auth-accent) 78%, var(--auth-border));
  border-radius: var(--studio-radius-full);
  background: linear-gradient(135deg, var(--auth-accent), var(--auth-accent-strong));
  color: var(--studio-text-inverse);
  padding: 0 12px;
  font: inherit;
  font-size: var(--studio-text-xs);
  font-weight: 720;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 10px 20px var(--studio-accent-glow);
}

.dashboard-hero button svg,
.dashboard-list-card header button svg {
  width: 14px;
  height: 14px;
}

.dashboard-hero button:hover,
.dashboard-list-card header button:hover {
  filter: brightness(1.04);
}

.dashboard-hero button:active,
.dashboard-list-card header button:active,
.dashboard-attention-row:active {
  transform: translateY(1px);
}

.dashboard-sync-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--auth-danger) 30%, var(--auth-border));
  border-radius: var(--studio-radius-md);
  background: var(--auth-danger-soft);
  color: var(--auth-danger);
  padding: 8px 9px;
  font-size: var(--studio-text-xs);
  font-weight: 660;
}

.dashboard-metric-grid,
.dashboard-bottom-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.dashboard-metric-card {
  position: relative;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  grid-template-areas:
    "icon label"
    "value value"
    "helper helper";
  align-items: center;
  gap: 3px 8px;
  overflow: hidden;
  border-radius: var(--studio-radius-md);
  padding: 9px;
}

.dashboard-metric-card::after {
  content: "";
  position: absolute;
  inset: auto 10px 0;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--dashboard-net);
  opacity: 0.62;
}

.dashboard-metric-card.is-billing::after {
  background: var(--dashboard-expense);
}

.dashboard-metric-card.is-bookkeeping::after {
  background: var(--dashboard-income);
}

.dashboard-metric-card.is-customer::after {
  background: var(--dashboard-customer);
}

.dashboard-metric-icon {
  grid-area: icon;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: var(--studio-radius-sm);
  background: var(--dashboard-net-soft);
  color: var(--dashboard-net);
}

.dashboard-metric-icon svg {
  width: 15px;
  height: 15px;
}

.dashboard-metric-card.is-billing .dashboard-metric-icon {
  background: var(--dashboard-expense-soft);
  color: var(--dashboard-expense);
}

.dashboard-metric-card.is-bookkeeping .dashboard-metric-icon {
  background: var(--dashboard-income-soft);
  color: var(--dashboard-income);
}

.dashboard-metric-card.is-customer .dashboard-metric-icon {
  background: var(--dashboard-customer-soft);
  color: var(--dashboard-customer);
}

.dashboard-metric-card small {
  grid-area: label;
  overflow: hidden;
  color: color-mix(in srgb, var(--auth-text-muted) 88%, transparent);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-metric-card strong {
  grid-area: value;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--auth-text-strong);
  font-size: clamp(0.92rem, 4vw, 1.08rem);
  font-weight: 680;
  letter-spacing: -0.03em;
  line-height: 1.08;
}

.dashboard-metric-card em {
  grid-area: helper;
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--auth-text-muted) 78%, transparent);
  font-size: var(--studio-text-xs);
  font-style: normal;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-main-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.dashboard-chart-card,
.dashboard-list-card {
  display: grid;
  gap: 9px;
  border-radius: var(--studio-radius-lg);
  padding: 10px;
}

.dashboard-chart-card header,
.dashboard-list-card header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
}

.dashboard-chart-card header strong,
.dashboard-list-card header strong {
  display: block;
  margin-top: 2px;
  color: var(--auth-text-strong);
  font-size: 0.96rem;
  font-weight: 680;
  letter-spacing: -0.025em;
  line-height: 1.08;
}

.dashboard-chart-filter {
  width: 96px;
  flex: 0 0 auto;
}

.dashboard-chart-filter .studio-select-trigger {
  min-height: 34px;
  border-radius: var(--studio-radius-full);
  background: color-mix(in srgb, var(--auth-bg-control) 88%, transparent);
  padding: 4px 8px;
  box-shadow: none;
}

.dashboard-chart-filter .studio-select-label,
.dashboard-chart-filter .studio-select-helper {
  display: none;
}

.dashboard-chart-filter .studio-select-copy strong {
  font-size: var(--studio-text-xs);
  font-weight: 680;
}

.dashboard-chart-shell {
  min-width: 0;
  min-height: 200px;
  overflow: hidden;
}

.dashboard-chart-shell .recharts-cartesian-grid line {
  stroke-opacity: 0.42;
}

.dashboard-chart-shell .recharts-cartesian-axis-tick-value,
.dashboard-chart-shell .recharts-legend-item-text,
.dashboard-chart-shell .recharts-tooltip-wrapper {
  font-family: var(--ui-font-sans, Inter, ui-sans-serif, system-ui, sans-serif);
}

.dashboard-chart-shell .recharts-legend-wrapper {
  display: none;
}

.dashboard-side-stack {
  min-width: 0;
  display: grid;
  gap: 10px;
}

.dashboard-mini-list,
.dashboard-attention-list {
  display: grid;
  gap: 6px;
}

.dashboard-mini-list article {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid var(--auth-border);
  padding: 7px 0;
}

.dashboard-mini-list article:last-child {
  border-bottom: 0;
}

.dashboard-mini-list article > span:first-child {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.dashboard-mini-list strong {
  overflow: hidden;
  color: var(--auth-text-strong);
  font-size: var(--studio-text-xs);
  font-weight: 660;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-mini-list small {
  color: var(--auth-text-muted);
  font-size: var(--studio-text-xs);
  font-weight: 500;
}

.dashboard-empty-copy {
  margin: 0;
  border: 1px dashed color-mix(in srgb, var(--auth-border-strong) 70%, transparent);
  border-radius: var(--studio-radius-md);
  background: color-mix(in srgb, var(--auth-bg-soft) 74%, transparent);
  color: var(--auth-text-muted);
  padding: 9px 10px;
  font-size: var(--studio-text-xs);
  line-height: 1.3;
  text-align: center;
}

.dashboard-attention-card header {
  align-items: center;
}

.dashboard-attention-card:has(.dashboard-attention-total) {
  min-height: 0;
}

.dashboard-attention-total {
  min-width: 24px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  border-radius: var(--studio-radius-full);
  background: color-mix(in srgb, var(--auth-danger-soft) 82%, transparent);
  color: var(--auth-danger);
  font-size: var(--studio-text-xs);
  font-weight: 720;
}

.dashboard-attention-row {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 24px;
  align-items: center;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--auth-border) 88%, transparent);
  border-radius: var(--studio-radius-md);
  background: color-mix(in srgb, var(--auth-bg-soft) 82%, transparent);
  color: var(--auth-text-main);
  padding: 6px 7px;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dashboard-attention-row:hover {
  border-color: var(--auth-border-strong);
  background: var(--auth-bg-card);
}

.dashboard-attention-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: var(--studio-radius-sm);
  background: var(--dashboard-net-soft);
  color: var(--dashboard-net);
}

.dashboard-attention-icon svg {
  width: 13px;
  height: 13px;
}

.dashboard-attention-row.is-billing .dashboard-attention-icon {
  background: var(--dashboard-expense-soft);
  color: var(--dashboard-expense);
}

.dashboard-attention-copy {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.dashboard-attention-copy strong {
  overflow: hidden;
  color: var(--auth-text-strong);
  font-size: var(--studio-text-xs);
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-attention-copy small {
  overflow: hidden;
  color: color-mix(in srgb, var(--auth-text-muted) 82%, transparent);
  font-size: var(--studio-text-xs);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-attention-row b {
  width: 24px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  border-radius: var(--studio-radius-full);
  background: var(--auth-bg-card);
  color: var(--auth-text-strong);
  font-size: var(--studio-text-xs);
  font-weight: 720;
}

.dashboard-bottom-grid {
  gap: 8px;
}

.dashboard-mini-card {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  grid-template-areas:
    "icon label"
    "icon value";
  align-items: center;
  gap: 1px 8px;
  border-radius: var(--studio-radius-md);
  padding: 8px;
}

.dashboard-mini-card > span {
  grid-area: icon;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: var(--studio-radius-sm);
  background: var(--dashboard-net-soft);
  color: var(--dashboard-net);
}

.dashboard-mini-card > span svg {
  width: 14px;
  height: 14px;
}

.dashboard-mini-card.is-income > span {
  background: var(--dashboard-income-soft);
  color: var(--dashboard-income);
}

.dashboard-mini-card.is-expense > span {
  background: var(--dashboard-expense-soft);
  color: var(--dashboard-expense);
}

.dashboard-mini-card small {
  grid-area: label;
  overflow: hidden;
  color: color-mix(in srgb, var(--auth-text-muted) 86%, transparent);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-mini-card strong {
  grid-area: value;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--auth-text-strong);
  font-size: 0.86rem;
  font-weight: 680;
  letter-spacing: -0.02em;
  line-height: 1.08;
}

@media (min-width: 681px) {
  .dashboard-page {
    gap: 18px;
  }

  .dashboard-hero {
    padding: 18px;
  }

  .dashboard-hero > div > span,
  .dashboard-chart-card header > div > span {
    display: block;
    max-width: 72ch;
    color: var(--auth-text-muted);
    font-size: var(--studio-text-sm);
    line-height: 1.45;
  }

  .dashboard-hero h2 {
    font-size: clamp(1.5rem, 3vw, 2.15rem);
  }

  .dashboard-metric-grid,
  .dashboard-bottom-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .dashboard-metric-card {
    grid-template-columns: 38px minmax(0, 1fr);
    grid-template-areas:
      "icon label"
      "icon value"
      "helper helper";
    border-radius: var(--studio-radius-lg);
    padding: 14px;
  }

  .dashboard-metric-icon {
    width: 38px;
    height: 38px;
  }

  .dashboard-metric-card strong {
    font-size: clamp(1rem, 2vw, 1.35rem);
  }

  .dashboard-main-grid {
    gap: 16px;
  }

  .dashboard-chart-card,
  .dashboard-list-card {
    padding: 16px;
  }

  .dashboard-chart-filter {
    width: 150px;
  }

  .dashboard-chart-filter .studio-select-label {
    display: inline;
    font-size: var(--studio-text-xs);
    letter-spacing: 0;
    text-transform: none;
  }

  .dashboard-chart-shell .recharts-legend-wrapper {
    display: block;
  }
}

@media (min-width: 1121px) {
  .dashboard-main-grid {
    grid-template-columns: minmax(0, 1.58fr) minmax(320px, 0.72fr);
  }

  .dashboard-side-stack {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }
}
`;
}

function patchDashboardCss() {
  const css = buildDashboardCss();

  assertBalancedCss(css);
  assertNoForbiddenCss(css);

  mustContain(css, [
    'compact premium mobile control panel',
    '.dashboard-chart-shell .recharts-legend-wrapper',
    '.dashboard-attention-row',
    '.dashboard-mini-card',
    '@media (min-width: 681px)',
  ], DASHBOARD_CSS);

  write(DASHBOARD_CSS, css);
}

function main() {
  console.log('');
  console.log('🚦 Phase M1B - Dashboard Mobile Modern Polish');
  console.log('');

  assertFile(DASHBOARD_PAGE);
  assertFile(DASHBOARD_CSS);

  patchDashboardPageSafely();
  patchDashboardCss();

  console.log('');
  console.log('✅ Phase M1B selesai.');
  console.log('Dashboard dipoles lebih modern dan tetap mobile-first.');
  console.log('');
}

main();