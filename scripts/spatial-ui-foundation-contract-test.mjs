import assert from 'node:assert/strict';

import {
  existsSync,
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

const packageJson =
  JSON.parse(
    readFileSync(
      resolve(
        'package.json',
      ),
      'utf8',
    ),
  );

for (
  const dependency
  of [
    'motion',
    'radix-ui',
  ]
) {
  assert.equal(
    typeof packageJson
      .dependencies?.[
        dependency
      ],
    'string',
    'Missing UI-F0 dependency: ' +
      dependency,
  );
}

for (
  const forbidden
  of [
    '@mui/material',
    'antd',
    'bootstrap',
    '@chakra-ui/react',
    '@mantine/core',
  ]
) {
  assert.equal(
    Object.prototype
      .hasOwnProperty.call(
        packageJson.dependencies ||
          {},
        forbidden,
      ),
    false,
    'Full visual framework is forbidden in UI-F0: ' +
      forbidden,
  );
}

const requiredFiles = [
  'src/styles/spatial-foundation.css',
  'src/components/ui/SpatialUiProvider.jsx',
  'src/components/ui/StudioTooltip.jsx',
  'src/theme/themePreferences.js',
];

for (
  const file
  of requiredFiles
) {
  assert.equal(
    existsSync(
      resolve(
        file,
      ),
    ),
    true,
    'Missing UI-F0 foundation file: ' +
      file,
  );
}

const themePreferencesSource =
  readFileSync(
    resolve(
      'src/theme/themePreferences.js',
    ),
    'utf8',
  );

for (
  const required
  of [
    'THEME_STORAGE_KEY',
    'THEME_PREFERENCES',
    "LIGHT:\n      'light'",
    "DARK:\n      'dark'",
    "SYSTEM:\n      'system'",
    'isThemePreference',
    'getSystemTheme',
    'getInitialThemePreference',
    'resolveThemePreference',
  ]
) {
  assert.equal(
    themePreferencesSource.includes(
      required,
    ),
    true,
    'Theme preference foundation missing: ' +
      required,
  );
}

const themeSource =
  readFileSync(
    resolve(
      'src/theme/ThemeProvider.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    "from './themePreferences.js'",
    'adminThemeActive',
    'preference',
    'resolvedTheme',
    'systemTheme',
    'syncSystemTheme',
    'THEME_PREFERENCES.LIGHT',
    'THEME_PREFERENCES.DARK',
  ]
) {
  assert.equal(
    themeSource.includes(
      required,
    ),
    true,
    'ThemeProvider foundation missing: ' +
      required,
  );
}

assert.equal(
  themeSource.includes(
    'export const THEME_'
  ),
  false,
  'Theme constants must stay outside the React component module.',
);

assert.equal(
  themeSource.includes(
    'export function getSystemTheme'
  ),
  false,
  'Pure theme helpers must stay outside the React component module.',
);

assert.equal(
  (
    themeSource.match(
      /setSystemTheme\(/g,
    ) ||
    []
  ).length,
  1,
  'System theme state must only update from the media-query change callback.',
);

const adminSource =
  readFileSync(
    resolve(
      'src/pages/AdminPage.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    "import SpatialUiProvider from '../components/ui/SpatialUiProvider.jsx'",
    "import { ThemeProvider } from '../theme/ThemeProvider.jsx'",
    "import '../styles/spatial-foundation.css'",
    '<ThemeProvider>',
    '<SpatialUiProvider>',
    'data-admin-spatial-root="true"',
    'AdminSidebar',
    'AdminTopbar',
    'AdminBottomNav',
  ]
) {
  assert.equal(
    adminSource.includes(
      required,
    ),
    true,
    'Admin UI-F0 boundary missing: ' +
      required,
  );
}

const appSource =
  readFileSync(
    resolve(
      'src/App.jsx',
    ),
    'utf8',
  );

assert.equal(
  appSource.includes(
    'ThemeProvider'
  ),
  false,
  'UI-F0 ThemeProvider must stay Admin-only and must not wrap root App.',
);

assert.equal(
  appSource.includes(
    'SpatialUiProvider'
  ),
  false,
  'UI-F0 SpatialUiProvider must stay Admin-only and must not wrap root App.',
);

const spatialCss =
  readFileSync(
    resolve(
      'src/styles/spatial-foundation.css',
    ),
    'utf8',
  );

for (
  const token
  of [
    '--studio-env:',
    '--studio-canvas:',
    '--studio-surface-floating:',
    '--studio-text-primary:',
    '--studio-edge-soft:',
    '--studio-edge-normal:',
    '--studio-edge-strong:',
    '--studio-accent-hover:',
    '--studio-radius-control:',
    '--studio-radius-object:',
    '--studio-radius-surface:',
    '--studio-radius-large:',
    '--studio-shadow-contact:',
    '--studio-shadow-surface:',
    '--studio-shadow-floating:',
    '--studio-duration-fast:',
    '--studio-duration-normal:',
    '--studio-duration-slow:',
    '--studio-ease-standard:',
    '--studio-ease-out:',
    '--studio-ease-spatial:',
  ]
) {
  assert.equal(
    spatialCss.includes(
      token,
    ),
    true,
    'Spatial token missing: ' +
      token,
  );
}

assert.equal(
  spatialCss.includes(
    "html[data-admin-theme-active='true'][data-theme='dark']"
  ),
  true,
  'Dark spatial token adaptation is required.',
);

assert.equal(
  spatialCss.includes(
    '@media (prefers-reduced-motion: reduce)'
  ),
  true,
  'Reduced-motion CSS contract is required.',
);

const providerSource =
  readFileSync(
    resolve(
      'src/components/ui/SpatialUiProvider.jsx',
    ),
    'utf8',
  );

assert.equal(
  providerSource.includes(
    "from 'motion/react'"
  ),
  true,
);

assert.equal(
  providerSource.includes(
    'reducedMotion="user"'
  ),
  true,
);

assert.equal(
  providerSource.includes(
    "from 'radix-ui'"
  ),
  true,
);

const tooltipSource =
  readFileSync(
    resolve(
      'src/components/ui/StudioTooltip.jsx',
    ),
    'utf8',
  );

assert.equal(
  tooltipSource.includes(
    'Tooltip.Portal'
  ),
  true,
);

assert.equal(
  packageJson.scripts.test.includes(
    'spatial-ui-foundation-contract-test.mjs'
  ),
  true,
  'UI-F0 contract must be registered in npm test.',
);

process.stdout.write(
  '✅ Spatial UI Foundation contract passed.\n',
);
