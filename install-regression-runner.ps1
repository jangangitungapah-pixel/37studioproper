$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
$packagePath = Join-Path $root 'package.json'
$sourceRunner = Join-Path $PSScriptRoot 'scripts\run-all-tests.mjs'
$targetDir = Join-Path $root 'scripts'
$targetRunner = Join-Path $targetDir 'run-all-tests.mjs'

if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
    throw 'package.json tidak ditemukan. Jalankan installer dari root repository 37studioproper.'
}
if (-not (Test-Path -LiteralPath $sourceRunner -PathType Leaf)) {
    throw 'scripts\run-all-tests.mjs tidak ditemukan di dalam paket. Ekstrak seluruh isi ZIP terlebih dahulu.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js tidak ditemukan di PATH.'
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

$sourceFullPath = [System.IO.Path]::GetFullPath($sourceRunner)
$targetFullPath = [System.IO.Path]::GetFullPath($targetRunner)
$pathsAreSame = [string]::Equals(
    $sourceFullPath,
    $targetFullPath,
    [System.StringComparison]::OrdinalIgnoreCase
)

if ($pathsAreSame) {
    Write-Host 'Runner sudah berada di lokasi target; copy dilewati.'
}
else {
    Copy-Item -LiteralPath $sourceRunner -Destination $targetRunner -Force
    Write-Host "Runner disalin ke: $targetRunner"
}

if (-not (Test-Path -LiteralPath $targetRunner -PathType Leaf)) {
    throw "Runner target tidak ditemukan setelah persiapan: $targetRunner"
}

$backup = Join-Path $env:TEMP ("37studioproper-package-before-test-runner-" + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.json')
Copy-Item -LiteralPath $packagePath -Destination $backup

$patch = @'
const fs = require('node:fs');
const path = require('node:path');
const packagePath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts ??= {};

if (pkg.scripts.test === 'node scripts/run-all-tests.mjs' && pkg.scripts['test:serial']) {
  console.log('Runner sudah terpasang. package.json tidak diubah.');
  process.exit(0);
}
if (typeof pkg.scripts.test !== 'string' || !pkg.scripts.test.trim()) {
  throw new Error('scripts.test tidak ditemukan atau kosong.');
}
if (pkg.scripts['test:serial']) {
  throw new Error('scripts.test:serial sudah ada. Tidak akan menimpa script yang sudah ada.');
}

const legacy = pkg.scripts.test;
const normalized = legacy.replace(/(^|&&\s*)nodescripts\//g, (_, prefix) => `${prefix}node scripts/`);
pkg.scripts['test:serial'] = normalized;
pkg.scripts.test = 'node scripts/run-all-tests.mjs';

const temporaryPath = `${packagePath}.test-runner-tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
fs.renameSync(temporaryPath, packagePath);
console.log('scripts.test dialihkan ke runner yang mengumpulkan seluruh hasil.');
console.log('Script lama dipertahankan di scripts.test:serial.');
'@

$patch | & node -
if ($LASTEXITCODE -ne 0) {
    throw "Patch package.json gagal dengan exit code $LASTEXITCODE. Backup: $backup"
}

Write-Host "`nRunner installed: $targetRunner"
Write-Host "package.json backup: $backup"
Write-Host 'Tidak ada dependency install, commit, push, merge, atau deploy yang dijalankan.'
