const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const files = {
  firebaseJson: path.join(ROOT, 'firebase.json'),
  eslintConfig: path.join(ROOT, 'eslint.config.js'),
  functionPackage: path.join(ROOT, 'functions', 'package.json'),
  functionIndex: path.join(ROOT, 'functions', 'index.js'),
  wrangler: path.join(ROOT, 'workers', 'onesignal-notification-worker', 'wrangler.toml'),
  wranglerExample: path.join(ROOT, 'workers', 'onesignal-notification-worker', 'wrangler.toml.example'),
  docs: path.join(ROOT, 'docs', 'onesignal-pwa-setup.md'),
};

function fail(message) {
  console.error(`\n[onesignal-phase-9d-realtime-dispatcher] ${message}\n`);
  process.exit(1);
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`File tidak ditemukan: ${path.relative(ROOT, filePath)}`);
  }
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function backup(filePath, content) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.bak-${stamp}`;
  fs.writeFileSync(backupPath, content, 'utf8');
  console.log(`[backup] ${path.relative(ROOT, backupPath)}`);
}

function writeIfChanged(filePath, before, after) {
  if (before === after) {
    console.log(`[skip] ${path.relative(ROOT, filePath)} tidak berubah`);
    return false;
  }

  if (fs.existsSync(filePath)) {
    backup(filePath, before);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, after, 'utf8');
  console.log(`[write] ${path.relative(ROOT, filePath)}`);
  return true;
}

function replaceRequired(content, oldText, newText, label) {
  if (!content.includes(oldText)) {
    fail(`Anchor tidak ditemukan: ${label}`);
  }

  return content.replace(oldText, newText);
}

function patchFirebaseJson() {
  assertFile(files.firebaseJson);

  const before = fs.readFileSync(files.firebaseJson, 'utf8');
  let config;

  try {
    config = JSON.parse(before);
  } catch (error) {
    fail(`firebase.json tidak valid JSON: ${error.message}`);
  }

  config.functions = {
    source: 'functions',
    runtime: 'nodejs20',
    ignore: [
      'node_modules',
      '.git',
      'firebase-debug.log',
      'firebase-debug.*.log',
      '*.local',
    ],
  };

  const after = `${JSON.stringify(config, null, 2)}\n`;

  if (!after.includes('"functions"') || !after.includes('"source": "functions"')) {
    fail('Verifikasi firebase.json gagal: functions source tidak ditemukan.');
  }

  writeIfChanged(files.firebaseJson, before, after);
}

function patchFunctionPackage() {
  const before = readIfExists(files.functionPackage);

  const after = `${JSON.stringify({
    name: 'studio37-notification-functions',
    private: true,
    version: '0.1.0',
    type: 'commonjs',
    engines: {
      node: '20',
    },
    main: 'index.js',
    scripts: {
      lint: 'node -c index.js',
    },
    dependencies: {
      'firebase-admin': '^13.0.0',
      'firebase-functions': '^6.0.0',
    },
  }, null, 2)}\n`;

  writeIfChanged(files.functionPackage, before, after);
}

function patchFunctionIndex() {
  const before = readIfExists(files.functionIndex);

  const after = `'use strict';

const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

const oneSignalRestApiKey = defineSecret('ONESIGNAL_REST_API_KEY');

const ONE_SIGNAL_API_URL = 'https://api.onesignal.com/notifications';
const ONE_SIGNAL_APP_ID = '03b8a3dc-1adf-4dfd-8758-6fd0425d6d14';
const SITE_ORIGIN = 'https://studio-37.web.app';

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, maxLength = 1000) {
  return String(value || '').trim().slice(0, maxLength);
}

function getSiteUrl(url = '') {
  const origin = SITE_ORIGIN.replace(/\\/$/, '');
  const cleanUrl = String(url || '').trim();

  if (!cleanUrl) return origin;
  if (/^https?:\\/\\//i.test(cleanUrl)) return cleanUrl;

  return origin + '/' + cleanUrl.replace(/^\\//, '');
}

function toPlainDocs(snapshot) {
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

function isEligibleSubscription(row) {
  return Boolean(
    row &&
      row.permission === 'granted' &&
      row.optedIn === true &&
      row.subscriptionId &&
      row.isActive !== false,
  );
}

function uniqueSubscriptions(rows = []) {
  const lookup = new Map();

  rows
    .filter(isEligibleSubscription)
    .forEach((row) => {
      if (!lookup.has(row.subscriptionId)) {
        lookup.set(row.subscriptionId, row);
      }
    });

  return [...lookup.values()];
}

async function fetchRoleSubscriptions(role) {
  const [deviceSnapshot, legacySnapshot] = await Promise.all([
    db
      .collection('notificationSubscriptionDevices')
      .where('role', '==', role)
      .limit(250)
      .get(),
    db
      .collection('notificationSubscriptions')
      .where('role', '==', role)
      .limit(120)
      .get(),
  ]);

  return uniqueSubscriptions([
    ...toPlainDocs(deviceSnapshot),
    ...toPlainDocs(legacySnapshot),
  ]);
}

async function fetchUserSubscriptions(uid) {
  const [deviceSnapshot, legacySnapshot] = await Promise.all([
    db
      .collection('notificationSubscriptionDevices')
      .where('uid', '==', uid)
      .limit(80)
      .get(),
    db
      .collection('notificationSubscriptions')
      .doc(uid)
      .get(),
  ]);

  const legacyRows = legacySnapshot.exists
    ? [{ id: legacySnapshot.id, ...legacySnapshot.data() }]
    : [];

  return uniqueSubscriptions([
    ...toPlainDocs(deviceSnapshot),
    ...legacyRows,
  ]);
}

async function resolveSubscriptionsForEvent(event) {
  if (event.targetMode === 'user' && event.targetUid) {
    return fetchUserSubscriptions(event.targetUid);
  }

  if (event.targetMode === 'role' && event.targetRole && event.targetRole !== 'none') {
    return fetchRoleSubscriptions(event.targetRole);
  }

  return [];
}

function buildOneSignalPayload(event, subscriptionIds) {
  return {
    app_id: ONE_SIGNAL_APP_ID,
    contents: {
      en: event.message || 'Ada update baru dari 37 Music Studio.',
    },
    data: {
      bookingId: event.bookingId || '',
      eventId: event.id || '',
      paymentProofId: event.paymentProofId || '',
      source: event.source || '',
      type: event.type || '',
    },
    headings: {
      en: event.title || '37 Music Studio',
    },
    include_subscription_ids: subscriptionIds,
    target_channel: 'push',
    url: getSiteUrl(event.url),
  };
}

async function sendOneSignalNotification(event, subscriptions) {
  const subscriptionIds = [
    ...new Set(subscriptions.map((item) => item.subscriptionId).filter(Boolean)),
  ];

  if (!subscriptionIds.length) {
    throw new Error('No eligible OneSignal subscription IDs.');
  }

  const response = await fetch(ONE_SIGNAL_API_URL, {
    body: JSON.stringify(buildOneSignalPayload(event, subscriptionIds)),
    headers: {
      authorization: 'Key ' + oneSignalRestApiKey.value(),
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error('OneSignal API failed: ' + response.status + ' ' + text);
  }

  return {
    payload,
    subscriptionCount: subscriptionIds.length,
  };
}

async function claimPendingEvent(eventRef, eventId) {
  let claimedEvent = null;

  await db.runTransaction(async (transaction) => {
    const latestSnapshot = await transaction.get(eventRef);

    if (!latestSnapshot.exists) return;

    const latestEvent = latestSnapshot.data();

    if (latestEvent.status !== 'pending') return;

    const timestamp = nowIso();
    const patch = {
      attempts: Number(latestEvent.attempts || 0) + 1,
      dispatchSource: 'firebase-functions',
      errorMessage: '',
      processingStartedAt: timestamp,
      status: 'processing',
      updatedAt: timestamp,
    };

    transaction.update(eventRef, patch);

    claimedEvent = {
      id: latestEvent.id || eventId,
      ...latestEvent,
      ...patch,
    };
  });

  return claimedEvent;
}

async function markSent(eventRef, result) {
  await eventRef.update({
    dispatchSource: 'firebase-functions',
    errorMessage: '',
    providerResponseId: cleanText(result.payload && result.payload.id, 160),
    sentAt: nowIso(),
    status: 'sent',
    subscriptionCount: Number(result.subscriptionCount || 0),
    updatedAt: nowIso(),
  });
}

async function markFailed(eventRef, error) {
  await eventRef.update({
    dispatchSource: 'firebase-functions',
    errorMessage: cleanText(error && error.message ? error.message : error),
    status: 'failed',
    updatedAt: nowIso(),
  });
}

exports.dispatchNotificationEvent = onDocumentCreated(
  {
    document: 'notificationEvents/{eventId}',
    maxInstances: 10,
    memory: '256MiB',
    region: 'asia-southeast2',
    secrets: [oneSignalRestApiKey],
    timeoutSeconds: 30,
  },
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      logger.warn('[notification-dispatcher] Missing snapshot.');
      return;
    }

    const eventId = event.params.eventId;
    const eventRef = snapshot.ref;
    const createdEvent = snapshot.data();

    if (createdEvent.status !== 'pending') {
      logger.info('[notification-dispatcher] Skipped non-pending event.', {
        eventId,
        status: createdEvent.status,
      });
      return;
    }

    const claimedEvent = await claimPendingEvent(eventRef, eventId);

    if (!claimedEvent) {
      logger.info('[notification-dispatcher] Event already claimed or processed.', { eventId });
      return;
    }

    try {
      const subscriptions = await resolveSubscriptionsForEvent(claimedEvent);
      const result = await sendOneSignalNotification(claimedEvent, subscriptions);

      await markSent(eventRef, result);

      logger.info('[notification-dispatcher] Push sent.', {
        eventId,
        subscriptionCount: result.subscriptionCount,
      });
    } catch (error) {
      await markFailed(eventRef, error);

      logger.error('[notification-dispatcher] Push failed.', {
        eventId,
        error: error && error.message ? error.message : String(error),
      });
    }
  },
);
`;

  const required = [
    "onDocumentCreated",
    "notificationEvents/{eventId}",
    "defineSecret('ONESIGNAL_REST_API_KEY')",
    "claimPendingEvent",
    "status: 'processing'",
    "status: 'sent'",
    "status: 'failed'",
    "notificationSubscriptionDevices",
    "include_subscription_ids",
    "region: 'asia-southeast2'",
  ];

  for (const snippet of required) {
    if (!after.includes(snippet)) {
      fail(`Verifikasi functions/index.js gagal: ${snippet}`);
    }
  }

  writeIfChanged(files.functionIndex, before, after);
}

function patchEslintConfig() {
  assertFile(files.eslintConfig);

  const before = fs.readFileSync(files.eslintConfig, 'utf8');
  let after = before;

  if (!after.includes("files: ['functions/**/*.js']")) {
    const insertion = `  {
    files: ['functions/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        fetch: 'readonly',
      },
    },
  },
`;

    after = replaceRequired(
      after,
      `  {
    files: ['workers/**/*.js'],`,
      `${insertion}  {
    files: ['workers/**/*.js'],`,
      'workers eslint block anchor',
    );
  }

  if (!after.includes("files: ['functions/**/*.js']")) {
    fail('Verifikasi eslint config gagal: functions block tidak ditemukan.');
  }

  writeIfChanged(files.eslintConfig, before, after);
}

function patchWranglerFallback(filePath) {
  if (!fs.existsSync(filePath)) return;

  const before = fs.readFileSync(filePath, 'utf8');
  let after = before;

  if (!after.includes('[triggers]')) {
    fail(`Blok [triggers] tidak ditemukan di ${path.relative(ROOT, filePath)}`);
  }

  after = after.replace(
    /crons\s*=\s*\[\s*["'][^"']+["']\s*\]/,
    'crons = ["*/5 * * * *"]',
  );

  if (!after.includes('crons = ["*/5 * * * *"]')) {
    fail(`Verifikasi fallback cron gagal di ${path.relative(ROOT, filePath)}`);
  }

  writeIfChanged(filePath, before, after);
}

function patchDocs() {
  const before = readIfExists(files.docs);

  const note = `
## OS Phase 9D - Realtime Event-driven Notification Dispatcher

Phase ini menambahkan Firebase Cloud Function:

\`\`\`txt
dispatchNotificationEvent
\`\`\`

Trigger:

\`\`\`txt
notificationEvents/{eventId} created
\`\`\`

Alur baru:

\`\`\`txt
notificationEvents dibuat pending
-> Cloud Function langsung claim event menjadi processing
-> Function resolve subscription devices
-> Function kirim OneSignal
-> event jadi sent / failed
\`\`\`

Cloudflare Worker tetap dipakai sebagai fallback batch:

\`\`\`txt
*/5 * * * *
\`\`\`

Catatan keamanan:

\`\`\`txt
ONESIGNAL_REST_API_KEY disimpan sebagai Firebase Functions Secret.
Secret tidak disimpan di frontend, repo, Firestore, atau Firebase Hosting.
\`\`\`

Deploy secret:

\`\`\`powershell
firebase functions:secrets:set ONESIGNAL_REST_API_KEY
firebase deploy --only functions:dispatchNotificationEvent
\`\`\`
`;

  const after = before.includes('OS Phase 9D - Realtime Event-driven Notification Dispatcher')
    ? before
    : `${before.trimEnd()}\n\n${note.trim()}\n`;

  writeIfChanged(files.docs, before, after);
}

function main() {
  patchFirebaseJson();
  patchFunctionPackage();
  patchFunctionIndex();
  patchEslintConfig();
  patchWranglerFallback(files.wrangler);
  patchWranglerFallback(files.wranglerExample);
  patchDocs();

  console.log('\n[done] OS Phase 9D selesai: realtime notification dispatcher function ditambahkan.');
}

main();