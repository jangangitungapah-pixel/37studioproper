import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = process.cwd();
const sourceRoots = ['src', 'workers'];
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.jsonc']);
const failures = [];
const reportedLegacy = [];

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'coverage', '.wrangler'].includes(entry.name)) return [];
      return walk(fullPath);
    }
    return sourceExtensions.has(fullPath.slice(fullPath.lastIndexOf('.'))) ? [fullPath] : [];
  });
}

function relativePath(filePath) {
  return relative(root, filePath).split(sep).join('/');
}

function countMatches(source, pattern) {
  const matcher = new RegExp(pattern.source, pattern.flags);
  return Array.from(source.matchAll(matcher)).length;
}

// Spark-incompatible auth and email-Extension dependencies have been removed. Any remaining occurrence fails CI.
// The existing App Check Enterprise provider is separately bounded because it is Spark-eligible with a finite no-billing quota.
const rules = [
  {
    id: 'firebase-sms-phone-auth',
    description: 'Firebase phone/SMS OTP is not available on Spark',
    pattern: /\b(?:signInWithPhoneNumber|RecaptchaVerifier|PhoneAuthProvider|verifyPhoneNumber|linkWithPhoneNumber|reauthenticateWithPhoneNumber)\b/g,
    maxByPath: {},
  },
  {
    id: 'firebase-trigger-email-extension-fallback',
    description: 'Firestore mail collection fallback depends on Firebase Trigger Email Extension',
    pattern: /\b(?:collection|doc)\s*\(\s*(?:firestoreDb|db)\s*,\s*['"]mail['"]\s*\)/g,
    maxByPath: {},
  },
  {
    id: 'firebase-cloud-functions',
    description: 'Firebase Cloud Functions and callable-function SDK require Blaze',
    pattern: /\bfrom\s*['"](?:firebase\/functions|firebase-admin\/functions)['"]|\bgetFunctions\s*\(|\bhttpsCallable\s*\(|https?:\/\/[a-z0-9.-]+\.cloudfunctions\.net\b|@google-cloud\/functions(?:-framework)?/gi,
    maxByPath: {},
  },
  {
    id: 'firebase-cloud-storage',
    description: 'Firebase Storage bucket access is not available on Spark for this project setup',
    pattern: /\bfrom\s*['"]firebase\/storage['"]|\bgetStorage\s*\(|\buploadBytes\s*\(|\buploadString\s*\(|@google-cloud\/storage\b/gi,
    maxByPath: {},
  },
  {
    id: 'firebase-extension-installation',
    description: 'Firebase Extensions are not permitted in the no-billing architecture',
    pattern: /\bfirebase\s+ext:(?:install|configure)\b/gi,
    maxByPath: {},
  },
  {
    id: 'vertex-agent-platform-backend',
    description: 'Vertex/Agent Platform AI backend can require a billing account',
    pattern: /\bVertexAIBackend\b|vertexai\.googleapis\.com|aiplatform\.googleapis\.com/gi,
    maxByPath: {},
  },
  {
    id: 'app-check-enterprise-quota-hotspot',
    description: 'Keep the existing single App Check Enterprise provider; its no-billing quota is finite',
    pattern: /\bReCaptchaEnterpriseProvider\b/g,
    maxByPath: {
      'src/lib/firebase.js': 2,
    },
  },
];

const files = sourceRoots.flatMap((path) => walk(resolve(root, path)));
assert.ok(files.length > 0, 'Spark policy scanner found no source files; check repository working directory.');

for (const file of files) {
  const path = relativePath(file);
  const source = readFileSync(file, 'utf8');
  for (const rule of rules) {
    const count = countMatches(source, rule.pattern);
    if (count === 0) continue;
    const maximum = rule.maxByPath[path] ?? 0;
    if (count > maximum) {
      failures.push(
        rule.id + ': ' + path + ' has ' + count + ' occurrence(s), permitted maximum is ' + maximum + '. ' + rule.description,
      );
    } else {
      reportedLegacy.push(rule.id + ': ' + path + ' (' + count + '/' + maximum + ' current occurrence(s))');
    }
  }
}

// A Remote Config value must never be able to switch the runtime onto a
// billing-required or unreviewed model. Validate both the exact allowlist and
// the guard that consumes it.
const aiPath = resolve(root, 'src/services/firebaseAiService.js');
assert.ok(existsSync(aiPath), 'Missing Firebase AI service; review Spark model policy before removing or relocating it.');
const aiSource = readFileSync(aiPath, 'utf8');
const allowlistMatch = aiSource.match(/const SPARK_ALLOWED_MODELS = Object\.freeze\(\[([\s\S]*?)\]\);/);
if (!allowlistMatch) {
  failures.push('Firebase AI service must declare SPARK_ALLOWED_MODELS as an explicit reviewed allowlist.');
} else {
  const configuredModels = Array.from(allowlistMatch[1].matchAll(/['"]([^'"]+)['"]/g), (match) => match[1]);
  const approvedNoBillingModels = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
  ];
  if (
    configuredModels.length !== approvedNoBillingModels.length ||
    configuredModels.some((model, index) => model !== approvedNoBillingModels[index])
  ) {
    failures.push('SPARK_ALLOWED_MODELS must exactly match the reviewed no-billing model set: ' + approvedNoBillingModels.join(', '));
  }
}
const modelGuard = aiSource.match(/function isAllowedModelName\(value\)\s*\{([\s\S]*?)\n\}/);
if (!modelGuard || !/SPARK_ALLOWED_MODELS\.includes/.test(modelGuard[1])) {
  failures.push('Remote Config model overrides must be validated against SPARK_ALLOWED_MODELS.');
}
if (/VertexAIBackend|vertexai\.googleapis\.com|aiplatform\.googleapis\.com/i.test(aiSource)) {
  failures.push('Firebase AI service must remain on the Gemini Developer API backend, not Vertex/Agent Platform.');
}

// Routine CI may not deploy Firebase, install Extensions, or invoke the
// Firebase Hosting deploy action until staging isolation and approval guards exist.
const workflowRoot = resolve(root, '.github/workflows');
if (existsSync(workflowRoot)) {
  for (const workflow of readdirSync(workflowRoot).filter((name) => /\.(?:yml|yaml)$/i.test(name))) {
    const source = readFileSync(join(workflowRoot, workflow), 'utf8');
    if (/\bfirebase\s+(?:deploy|ext:install|ext:configure)\b|FirebaseExtended\/action-hosting-deploy/i.test(source)) {
      failures.push('.github/workflows/' + workflow + ' contains a Firebase deployment/Extension action before staging isolation is approved.');
    }
  }
}

if (reportedLegacy.length) {
  console.warn('Spark-compatible policy exceptions (bounded; review on provider/config changes):');
  for (const finding of reportedLegacy) console.warn('  - ' + finding);
}

if (failures.length) {
  console.error('firebase-spark-compatibility-contract-test: FAIL');
  for (const failure of failures) console.error('  - ' + failure);
  process.exitCode = 1;
} else {
  console.log('firebase-spark-compatibility-contract-test: PASS');
}
