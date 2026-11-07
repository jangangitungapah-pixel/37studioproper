import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const packagePath = resolve(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const legacyScriptName = 'test:serial';
const legacyScript = packageJson.scripts?.[legacyScriptName];

if (!legacyScript) {
  console.error(`Missing package.json script: ${legacyScriptName}`);
  process.exit(2);
}

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const reportDir = resolve(tmpdir(), `37studioproper-test-report-${runId}`);
mkdirSync(reportDir, { recursive: true });

const fullReportPath = resolve(reportDir, 'FULL-TEST-OUTPUT.txt');
const summaryTxtPath = resolve(reportDir, 'SUMMARY.txt');
const summaryMdPath = resolve(reportDir, 'SUMMARY.md');
const tests = [];
const configurationErrors = [];

function expandScript(scriptName, stack = []) {
  if (stack.includes(scriptName)) {
    configurationErrors.push(`Recursive npm script reference: ${[...stack, scriptName].join(' -> ')}`);
    return;
  }

  const body = packageJson.scripts?.[scriptName];
  if (typeof body !== 'string' || !body.trim()) {
    configurationErrors.push(`Missing or empty npm script: ${scriptName}`);
    return;
  }

  for (const rawPart of body.split(/\s*&&\s*/).map((part) => part.trim()).filter(Boolean)) {
    const nested = rawPart.match(/^npm\s+run\s+([\w:.-]+)$/);
    if (nested) {
      expandScript(nested[1], [...stack, scriptName]);
      continue;
    }

    let command = rawPart;
    if (command.startsWith('nodescripts/')) {
      command = `node scripts/${command.slice('nodescripts/'.length)}`;
      configurationErrors.push(`Corrected malformed test command in memory: "${rawPart}" -> "${command}"`);
    }

    const nodeCommand = command.match(/^node\s+(.+)$/);
    if (!nodeCommand) {
      tests.push({ name: command, command: null, configError: `Unsupported test command: ${command}` });
      continue;
    }

    const relativeFile = nodeCommand[1].trim().replace(/^['"]|['"]$/g, '');
    const absoluteFile = isAbsolute(relativeFile) ? relativeFile : resolve(rootDir, relativeFile);
    tests.push({ name: relativeFile, command: absoluteFile });
  }
}

expandScript(legacyScriptName);

if (tests.length === 0) {
  console.error('No test commands were found in package.json scripts.test:serial.');
  process.exit(2);
}

const startedAt = new Date();
const header = [
  '37STUDIO PROPER - FULL REGRESSION TEST OUTPUT',
  '================================================',
  `Started: ${startedAt.toISOString()}`,
  `Repository: ${rootDir}`,
  `Node: ${process.version}`,
  `Tests discovered: ${tests.length}`,
  `Evidence folder: ${reportDir}`,
  'Execution policy: run every discovered test, continue after failures.',
  'Output policy: complete stdout and stderr for every test are written to this TXT file.',
  '',
].join('\r\n');
writeFileSync(fullReportPath, header, 'utf8');

console.log('37Studio Proper regression runner');
console.log(`Tests discovered: ${tests.length}`);
console.log('All test output will be saved to:');
console.log(fullReportPath);
console.log(`Evidence folder: ${reportDir}`);
console.log('Running tests sequentially; failures will not stop the remaining tests.\n');

const results = [];
const maxBuffer = 64 * 1024 * 1024;

for (let index = 0; index < tests.length; index += 1) {
  const test = tests[index];
  const label = `[${String(index + 1).padStart(2, '0')}/${tests.length}] ${test.name}`;
  const safeName = test.command
    ? basename(test.command).replace(/[^a-zA-Z0-9._-]/g, '_')
    : `configuration-${String(index + 1).padStart(2, '0')}.txt`;
  const logPath = resolve(reportDir, `${String(index + 1).padStart(2, '0')}-${safeName}.log`);
  const testStart = new Date();
  let stdout = '';
  let stderr = '';
  let processError = '';
  let exitCode = 0;
  let status = 'FAIL';

  appendFileSync(
    fullReportPath,
    [
      '',
      '------------------------------------------------------------',
      `TEST ${index + 1}/${tests.length}: ${test.name}`,
      `Started: ${testStart.toISOString()}`,
      `Command: ${test.command ? `${process.execPath} ${test.command}` : 'NOT RUN (configuration error)'}`,
      '------------------------------------------------------------',
      '',
    ].join('\r\n'),
    'utf8',
  );

  if (test.configError) {
    processError = test.configError;
    exitCode = 2;
  } else if (!existsSync(test.command)) {
    processError = `Test file not found: ${test.command}`;
    exitCode = 2;
  } else {
    const processResult = spawnSync(process.execPath, [test.command], {
      cwd: rootDir,
      env: process.env,
      encoding: 'utf8',
      maxBuffer,
      windowsHide: true,
    });

    stdout = processResult.stdout ?? '';
    stderr = processResult.stderr ?? '';
    if (processResult.error) {
      processError = `${processResult.error.name}: ${processResult.error.message}`;
    }
    if (processResult.signal) {
      processError += `${processError ? '\n' : ''}Terminated by signal: ${processResult.signal}`;
    }
    exitCode = processResult.error ? 1 : (processResult.status ?? 1);
  }

  status = exitCode === 0 ? 'PASS' : 'FAIL';
  const durationMs = Date.now() - testStart.getTime();
  const section = [
    '===== STDOUT =====',
    stdout || '(no stdout)',
    '===== STDERR =====',
    stderr || '(no stderr)',
    '===== RUNNER / PROCESS ERRORS =====',
    processError || '(none)',
    '===== RESULT =====',
    `Status: ${status}`,
    `Exit code: ${exitCode}`,
    `Duration: ${durationMs} ms`,
    '',
  ].join('\r\n');

  writeFileSync(logPath, section, 'utf8');
  appendFileSync(fullReportPath, `${section}\r\n`, 'utf8');
  results.push({
    name: test.name,
    status,
    exitCode,
    durationMs,
    logPath,
    processError,
  });

  console.log(`${status} ${label}${status === 'FAIL' ? ` (exit ${exitCode})` : ''} [${durationMs} ms]`);
}

const completedAt = new Date();
const passCount = results.filter((item) => item.status === 'PASS').length;
const failCount = results.length - passCount;
const totalDurationMs = results.reduce((sum, item) => sum + item.durationMs, 0);
const failedTests = results.filter((item) => item.status === 'FAIL');

const summaryLines = [
  '37STUDIO PROPER - REGRESSION TEST SUMMARY',
  '=========================================',
  `Started: ${startedAt.toISOString()}`,
  `Completed: ${completedAt.toISOString()}`,
  `Total tests: ${results.length}`,
  `PASS: ${passCount}`,
  `FAIL: ${failCount}`,
  `Test execution time: ${(totalDurationMs / 1000).toFixed(2)} seconds`,
  '',
  'ALL RESULTS',
  '------------',
  ...results.map((item, index) => `${String(index + 1).padStart(2, '0')}. ${item.status} | exit ${item.exitCode} | ${item.durationMs} ms | ${item.name}`),
  '',
  'FAILED TESTS',
  '------------',
  ...(failedTests.length
    ? failedTests.map((item) => `${item.name}\r\n  Exit code: ${item.exitCode}\r\n  Log: ${item.logPath}\r\n  Error: ${item.processError || '(see full output file)'}`)
    : ['None']),
  '',
  'CONFIGURATION NOTES',
  '-------------------',
  ...(configurationErrors.length ? configurationErrors : ['None']),
  '',
  'FULL OUTPUT FILE',
  '----------------',
  fullReportPath,
  '',
  'EVIDENCE DIRECTORY',
  '------------------',
  reportDir,
  '',
  'No source changes, commits, pushes, merges, or deployments were performed by this runner.',
  '',
];

const summaryText = summaryLines.join('\r\n');
writeFileSync(summaryTxtPath, summaryText, 'utf8');
writeFileSync(summaryMdPath, summaryLines.join('\n'), 'utf8');
appendFileSync(
  fullReportPath,
  [
    '',
    '================================================',
    'FINAL REGRESSION SUMMARY',
    '================================================',
    `Completed: ${completedAt.toISOString()}`,
    `Total: ${results.length}`,
    `PASS: ${passCount}`,
    `FAIL: ${failCount}`,
    `Total test execution time: ${(totalDurationMs / 1000).toFixed(2)} seconds`,
    `Summary TXT: ${summaryTxtPath}`,
    `Evidence folder: ${reportDir}`,
    '',
  ].join('\r\n'),
  'utf8',
);

console.log('\n=== FINAL SUMMARY ===');
console.log(`PASS: ${passCount}`);
console.log(`FAIL: ${failCount}`);
console.log(`Summary TXT: ${summaryTxtPath}`);
console.log(`FULL TEST OUTPUT TXT: ${fullReportPath}`);
console.log(`Individual logs: ${reportDir}`);

if (failCount > 0) {
  console.log('\nFailed tests:');
  for (const item of failedTests) console.log(`- ${item.name} (exit ${item.exitCode})`);
}

process.exitCode = failCount === 0 ? 0 : 1;
