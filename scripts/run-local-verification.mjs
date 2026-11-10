import { spawn } from 'node:child_process';
import { copyFileSync, createWriteStream, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = resolve(rootDir, 'test-results');
mkdirSync(reportDir, { recursive: true });

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = resolve(reportDir, 'local-verification-' + runId + '.txt');
const latestPath = resolve(reportDir, 'latest-local-verification.txt');
const report = createWriteStream(reportPath, { encoding: 'utf8' });
const startedAt = new Date();
const installDependencies = process.argv.includes('--install');

const steps = [
  ...(installDependencies
    ? [{ name: 'Install dependencies', args: ['ci'] }]
    : []),
  { name: 'Production build', args: ['run', 'build'] },
  { name: 'ESLint', args: ['run', 'lint'] },
  { name: 'Phase 4 / PRD contracts + Firestore Rules Emulator', args: ['run', 'test:prd'] },
  { name: 'Full regression suite', args: ['test'] },
];

const npmExecPath = process.env.npm_execpath;
const executable = npmExecPath
  ? process.execPath
  : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const executablePrefix = npmExecPath ? [npmExecPath] : [];

function writeLine(value = '') {
  const line = String(value);
  process.stdout.write(line + '\n');
  report.write(line + '\r\n');
}

function formatCommand(args) {
  return (npmExecPath ? 'node ' + npmExecPath : 'npm') +
    ' ' + args.join(' ');
}

async function runStep(step, index) {
  const stepStartedAt = new Date();
  writeLine('');
  writeLine('='.repeat(76));
  writeLine('STEP ' + (index + 1) + '/' + steps.length + ': ' + step.name);
  writeLine('Started: ' + stepStartedAt.toISOString());
  writeLine('Command: ' + formatCommand(step.args));
  writeLine('-'.repeat(76));

  let processError = '';
  const exitCode = await new Promise((resolveExit) => {
    let settled = false;
    const child = spawn(executable, [...executablePrefix, ...step.args], {
      cwd: rootDir,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
      windowsHide: true,
      shell: !npmExecPath && process.platform === 'win32',
    });

    const finish = (code) => {
      if (settled) return;
      settled = true;
      resolveExit(code);
    };

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      report.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      report.write(chunk);
    });
    child.on('error', (error) => {
      processError = error.name + ': ' + error.message;
      writeLine('[PROCESS ERROR] ' + processError);
      finish(1);
    });
    child.on('close', (code, signal) => {
      if (signal) processError = 'Terminated by signal: ' + signal;
      finish(code === null ? 1 : code);
    });
  });

  const completedAt = new Date();
  const status = exitCode === 0 ? 'PASS' : 'FAIL';
  const durationMs = completedAt.getTime() - stepStartedAt.getTime();
  writeLine('');
  writeLine('RESULT: ' + status);
  writeLine('Exit code: ' + exitCode);
  writeLine('Duration: ' + (durationMs / 1000).toFixed(2) + ' seconds');
  if (processError) writeLine('Process error: ' + processError);

  return {
    name: step.name,
    status,
    exitCode,
    durationMs,
    processError,
  };
}

writeLine('37STUDIO PROPER - CONSOLIDATED LOCAL VERIFICATION');
writeLine('=================================================');
writeLine('Started: ' + startedAt.toISOString());
writeLine('Repository: ' + rootDir);
writeLine('Node: ' + process.version);
writeLine('Install dependencies: ' + (installDependencies ? 'yes (npm ci)' : 'no'));
writeLine('Steps: ' + steps.length);
writeLine('Policy: continue after failures and record every exit code.');
writeLine('Output: combined stdout and stderr in this TXT file.');
writeLine('Report: ' + reportPath);

const results = [];
for (let index = 0; index < steps.length; index += 1) {
  results.push(await runStep(steps[index], index));
}

const completedAt = new Date();
const passed = results.filter((result) => result.status === 'PASS').length;
const failed = results.length - passed;
const totalDuration = results.reduce((total, result) => total + result.durationMs, 0);

writeLine('');
writeLine('='.repeat(76));
writeLine('FINAL SUMMARY');
writeLine('Completed: ' + completedAt.toISOString());
writeLine('Total steps: ' + results.length);
writeLine('PASS: ' + passed);
writeLine('FAIL: ' + failed);
writeLine('Total duration: ' + (totalDuration / 1000).toFixed(2) + ' seconds');
writeLine('');
for (const result of results) {
  writeLine(
    result.status + ' | exit ' + result.exitCode + ' | ' +
    (result.durationMs / 1000).toFixed(2) + 's | ' + result.name,
  );
}
writeLine('');
writeLine('Full output: ' + reportPath);
writeLine('Latest copy: ' + latestPath);

await new Promise((resolveEnd) => report.end(resolveEnd));
copyFileSync(reportPath, latestPath);

process.exitCode = failed === 0 ? 0 : 1;
