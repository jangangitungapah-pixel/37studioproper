const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const FILE = path.join(
  ROOT,
  'scripts',
  'admin-spatial-shell-hardening-contract-test.mjs',
);

function fail(message) {
  console.error('');
  console.error(
    '❌ [ui0e-contract-fix] ' +
      message,
  );
  console.error('');

  process.exit(1);
}

if (
  !fs.existsSync(
    FILE,
  )
) {
  fail(
    'Contract file tidak ditemukan.',
  );
}

const source =
  fs
    .readFileSync(
      FILE,
      'utf8',
    )
    .replace(
      /\r\n/g,
      '\n',
    );

const oldBlock = `assert.equal(
  bottomNavSource.includes(
    '/\\\\\\\\b\\\\\\\\w/g'
  ),
  false,
  'Escaped mobile account formatter regression must stay removed.',
);

assert.equal(
  bottomNavSource.includes(
    '/\\\\b\\\\w/g'
  ),
  true,
  'Mobile account role formatter must use word-boundary title case.',
);`;

const newBlock = `const validRoleTitleCasePattern =
  String.raw\`/\\\\b\\\\w/g\`;

const escapedRoleTitleCaseRegression =
  String.raw\`/\\\\\\\\b\\\\\\\\w/g\`;

assert.equal(
  bottomNavSource.includes(
    escapedRoleTitleCaseRegression,
  ),
  false,
  'Over-escaped mobile account formatter regression must stay removed.',
);

assert.equal(
  bottomNavSource.includes(
    validRoleTitleCasePattern,
  ),
  true,
  'Mobile account role formatter must use word-boundary title case.',
);`;

if (
  source.includes(
    'const validRoleTitleCasePattern ='
  )
) {
  console.log(
    'ℹ️ Contract already repaired.',
  );

  process.exit(0);
}

if (
  !source.includes(
    oldBlock,
  )
) {
  fail(
    'Target assertion block tidak ditemukan. Source mungkin sudah berubah.',
  );
}

const next =
  source.replace(
    oldBlock,
    newBlock,
  );

if (
  !next.includes(
    'String.raw`/\\\\b\\\\w/g`'
  ) ||
  !next.includes(
    'String.raw`/\\\\\\\\b\\\\\\\\w/g`'
  )
) {
  fail(
    'Post-replacement validation gagal.',
  );
}

fs.writeFileSync(
  FILE,
  next,
  'utf8',
);

console.log('');
console.log(
  '✅ UI-0E role regex contract repaired.',
);
console.log('');
console.log(
  'Implementation source intentionally untouched.',
);
console.log(
  'Valid regex and over-escaped regression are now compared literally.',
);