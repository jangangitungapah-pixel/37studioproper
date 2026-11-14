import { spawn } from 'node:child_process';
import { copyFileSync, createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const [rawScriptName] = process.argv.slice(2);

if (!rawScriptName) {
  console.error('Usage: node scripts/run-with-report.mjs <raw-npm-script-name>');
  process.exit(2);
}

if (typeof packageJson.scripts?.[rawScriptName] !== 'string') {
  console.error('Missing npm script: ' + rawScriptName);
  process.exit(2);
}

const safeName = rawScriptName.replace(/[^a-zA-Z0-9._-]/g, '_');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const reportDir = resolve(rootDir, 'test-results');
mkdirSync(reportDir, { recursive: true });

const reportPath = resolve(reportDir, runId + '-' + safeName + '.txt');
const latestPath = resolve(reportDir, 'latest-' + safeName + '.txt');
const report = createWriteStream(reportPath, { encoding: 'utf8' });
const startedAt = new Date();

report.write([
  '37STUDIO PROPER - LOCAL COMMAND OUTPUT',
  '======================================',
  'Command: npm run ' + rawScriptName,
  'Started: ' + startedAt.toISOString(),
  'Repository: ' + rootDir,
  'Node: ' + process.version,
  '',
  '===== COMBINED STDOUT / STDERR =====',
  '',
].join('\r\n'));

console.log('\n[REPORT] Capturing npm run ' + rawScriptName);
console.log('[REPORT] ' + reportPath + '\n');

const npmExecPath = process.env.npm_execpath;
const command = npmExecPath
  ? process.execPath
  : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const args = npmExecPath
  ? [npmExecPath, 'run', rawScriptName]
  : ['run', rawScriptName];

const child = spawn(command, args, {
  cwd: rootDir,
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
  windowsHide: true,
  shell: !npmExecPath && process.platform === 'win32',
});

let spawnError = '';

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  report.write(chunk);
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
  report.write(chunk);
});

child.on('error', (error) => {
  spawnError = error.name + ': ' + error.message;
  report.write('\r\n[PROCESS ERROR] ' + spawnError + '\r\n');
  console.error(spawnError);
});

child.on('close', (code, signal) => {
  const exitCode = code ?? 1;
  const completedAt = new Date();
  const footer = [
    '',
    '===== EXECUTION RESULT =====',
    'Completed: ' + completedAt.toISOString(),
    'Exit code: ' + exitCode,
    'Signal: ' + (signal || '(none)'),
    'Process error: ' + (spawnError || '(none)'),
    'Status: ' + (exitCode === 0 ? 'PASS' : 'FAIL'),
    '',
  ].join('\r\n');

  report.end(footer, () => {
    copyFileSync(reportPath, latestPath);
    console.log('\n[REPORT] ' + (exitCode === 0 ? 'PASS' : 'FAIL') + ' | TXT: ' + reportPath);
    console.log('[REPORT] Latest copy: ' + latestPath);
    process.exitCode = exitCode;
  });
});
