import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

function read(path) {
  return readFileSync(resolve(path), 'utf8');
}

const loginSource = read('src/pages/LoginPage.jsx');
const sanitizerMatch = loginSource.match(
  /export function sanitizePortalRedirect\(rawRedirectTo\) \{([\s\S]*?)\n\}\n\nexport default function LoginPage/,
);

assert.ok(sanitizerMatch, 'Safe portal redirect sanitizer must remain exported from LoginPage.');

const sanitizePortalRedirect = Function(
  `return function sanitizePortalRedirect(rawRedirectTo) {${sanitizerMatch[1]}\n}`,
)();

for (const [input, expected] of [
  [null, ''],
  ['', ''],
  ['https://evil.example/admin', ''],
  ['//evil.example/admin', ''],
  ['/client/portal', ''],
  ['/admin/../client/portal', ''],
  ['/admin\\@evil.example', ''],
  ['/admin', '/admin'],
  ['/admin/dashboard?period=month#attention', '/admin/dashboard?period=month#attention'],
  ['/guard/attendance?from=admin', '/guard/attendance?from=admin'],
]) {
  assert.equal(
    sanitizePortalRedirect(input),
    expected,
    `Unexpected redirect sanitizer result for ${String(input)}`,
  );
}

assert.match(
  loginSource,
  /const redirectTo = sanitizePortalRedirect\([\s\S]*?searchParams\.get\('redirectTo'\)/,
  'Login must sanitize redirectTo before deriving portal intent or navigating.',
);

assert.match(
  loginSource,
  /const target = redirectTo \|\| '\/admin';/,
  'Login fallback must resolve through the canonical Admin root.',
);

const indexSource = read('index.html');
const bootstrapMatch = indexSource.match(
  /<script data-admin-theme-bootstrap>([\s\S]*?)<\/script>/,
);

assert.ok(bootstrapMatch, 'Admin theme bootstrap must run before the application module.');
assert.ok(
  indexSource.indexOf('data-admin-theme-bootstrap') < indexSource.indexOf('src="/src/main.jsx"'),
  'Theme bootstrap must execute before React is loaded.',
);

function runThemeBootstrap({ pathname = '/admin', storedPreference = null, systemDark = false } = {}) {
  const root = { dataset: {}, style: {} };
  const themeMeta = {
    content: '#050506',
    setAttribute(name, value) {
      if (name === 'content') this.content = value;
    },
  };
  const context = {
    document: {
      documentElement: root,
      querySelector(selector) {
        return selector === 'meta[name="theme-color"]' ? themeMeta : null;
      },
    },
    window: {
      localStorage: {
        getItem() {
          return storedPreference;
        },
      },
      location: { pathname },
      matchMedia() {
        return { matches: systemDark };
      },
    },
  };

  vm.runInNewContext(bootstrapMatch[1], context);
  return { root, themeMeta };
}

assert.equal(
  runThemeBootstrap().root.dataset.theme,
  'light',
  'First Admin visit must paint Light before React.',
);
assert.equal(
  runThemeBootstrap({ storedPreference: 'dark' }).root.dataset.theme,
  'dark',
  'Stored Dark preference must paint before React.',
);
assert.equal(
  runThemeBootstrap({ storedPreference: 'system', systemDark: true }).root.dataset.theme,
  'dark',
  'Stored System preference must resolve before React.',
);
assert.equal(
  runThemeBootstrap({ pathname: '/client' }).root.dataset.theme,
  undefined,
  'Admin theme bootstrap must not take ownership of Client surfaces.',
);

const adminPageSource = read('src/pages/AdminPage.jsx');
const bottomNavInvocation = adminPageSource.match(/<AdminBottomNav[\s\S]*?\/>/)?.[0] || '';

for (const prop of ['user={authState.user}', 'onLogout={handleLogout}']) {
  assert.ok(
    bottomNavInvocation.includes(prop),
    `AdminBottomNav invocation must receive ${prop}.`,
  );
}

assert.match(
  adminPageSource,
  /const isBillingQaPreview =[\s\S]*?import\.meta\.env\.DEV &&[\s\S]*?['"]billingPreview['"]/,
  'Billing QA preview must be development-only.',
);
assert.match(
  adminPageSource,
  /const isScheduleQaPreview =[\s\S]*?import\.meta\.env\.DEV &&[\s\S]*?['"]schedulePreview['"]/,
  'Schedule QA preview must be development-only.',
);
assert.match(
  adminPageSource,
  /const hasDisabledQaPreview =[\s\S]*?!import\.meta\.env\.DEV[\s\S]*?qaPreviewParams\.delete\([\s\S]*?billingPreview[\s\S]*?qaPreviewParams\.delete\([\s\S]*?schedulePreview/,
  'Production must remove QA-only preview parameters after normal auth resolution.',
);
assert.match(
  adminPageSource,
  /function AdminQaPreview[\s\S]*?admin-shell-preview[\s\S]*?<Suspense/,
  'QA preview must use the themed full-width preview shell and stable loading state.',
);

const topbarSource = read('src/components/admin/AdminTopbar.jsx');
const bottomNavSource = read('src/components/admin/AdminBottomNav.jsx');

for (const [source, surface] of [
  [topbarSource, 'desktop topbar'],
  [bottomNavSource, 'mobile More sheet'],
]) {
  for (const invariant of ['useTheme', 'toggleTheme', 'aria-pressed={isDarkTheme}']) {
    assert.ok(source.includes(invariant), `${surface} theme toggle missing: ${invariant}`);
  }
}

process.stdout.write('✅ Admin shell/auth hardening behavior contract passed.\n');
