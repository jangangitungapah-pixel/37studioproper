import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));

const requiredDependencies = [
  '@base-ui/react',
  '@hookform/resolvers',
  '@tanstack/react-table',
  'class-variance-authority',
  'clsx',
  'echarts',
  'echarts-for-react',
  'lucide-react',
  'motion',
  'react-hook-form',
  'sonner',
  'tailwind-merge',
  'zod',
];
for (const dependency of requiredDependencies) {
  assert.equal(typeof pkg.dependencies?.[dependency], 'string', 'Missing UI dependency: ' + dependency);
}
assert.equal(typeof pkg.devDependencies?.['@tailwindcss/vite'], 'string');
assert.equal(typeof pkg.devDependencies?.tailwindcss, 'string');
assert.equal(typeof pkg.devDependencies?.shadcn, 'string');
assert.equal(pkg.dependencies?.recharts, undefined, 'Recharts should be removed after Dashboard migration.');

const requiredFiles = [
  'components.json',
  'src/lib/utils.js',
  'src/components/ui/StudioMenu.jsx',
  'src/components/ui/StudioDataTable.jsx',
  'src/components/ui/StudioToaster.jsx',
  'src/components/ui/StudioChart.jsx',
  'src/components/ui/EChartsRenderer.jsx',
  'src/components/magicui/number-ticker.jsx',
  'src/hooks/useStudioForm.js',
];
for (const path of requiredFiles) {
  assert.equal(existsSync(new URL('../' + path, import.meta.url)), true, 'Missing integration file: ' + path);
}

const shadcn = JSON.parse(read('components.json'));
assert.equal(shadcn.style, 'base-nova');
assert.equal(shadcn.iconLibrary, 'lucide');
assert.equal(shadcn.tailwind.css, 'src/index.css');

const vite = read('vite.config.js');
assert.match(vite, /@tailwindcss\/vite/);
assert.match(vite, /tailwindcss\(\)/);
const stylesheet = read('src/index.css');
assert.match(stylesheet, /@import\s+["']tailwindcss["']/);
assert.match(stylesheet, /@config\s+["']\.\.\/tailwind\.config\.js["']/);

const menu = read('src/components/ui/StudioMenu.jsx');
assert.match(menu, /@base-ui\/react\/menu/);
const dataTable = read('src/components/ui/StudioDataTable.jsx');
assert.match(dataTable, /@tanstack\/react-table/);
assert.match(dataTable, /useTable/);
const form = read('src/hooks/useStudioForm.js');
assert.match(form, /react-hook-form/);
assert.match(form, /zodResolver/);
const toaster = read('src/components/ui/StudioToaster.jsx');
assert.match(toaster, /from 'sonner'/);
const ticker = read('src/components/magicui/number-ticker.jsx');
assert.match(ticker, /motion\/react/);
const button = read('src/components/ui/Button.jsx');
assert.match(button, /class-variance-authority/);
assert.match(button, /studioButtonVariants/);
const dashboard = read('src/pages/admin/DashboardPage.jsx');
assert.match(dashboard, /StudioChart/);
assert.doesNotMatch(dashboard, /from ['"]recharts['"]/);
const shell = read('src/pages/AdminPage.jsx');
assert.match(shell, /<StudioToaster\s*\/>/);
const chart = read('src/components/ui/StudioChart.jsx');
assert.match(chart, /echarts-for-react|EChartsRenderer/);

console.log('library-integration-contract-test: PASS');
