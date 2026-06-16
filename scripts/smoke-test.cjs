
const fs = require('fs');
const path = require('path');

const root = process.cwd();

const requiredFiles = [
  'index.html',
  'vite.config.js',
  'tailwind.config.js',
  'postcss.config.js',
  'eslint.config.js',
  'src/main.jsx',
  'src/App.jsx',
  'src/index.css',
  'src/theme/ThemeProvider.jsx',
  'src/theme/ThemeContainer.jsx',
];

for (const file of requiredFiles) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) {
    console.error(`❌ Missing required file: ${file}`);
    process.exit(1);
  }
}

console.log('✅ Smoke test passed. Foundation files exist.');
