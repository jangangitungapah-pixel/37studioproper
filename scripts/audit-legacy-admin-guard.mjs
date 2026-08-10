import {
  deleteApp,
  initializeApp,
} from 'firebase/app';

import {
  inMemoryPersistence,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from 'firebase/firestore';

import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  existsSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  createInterface,
} from 'node:readline/promises';

import {
  stdin as input,
  stdout as output,
} from 'node:process';

import {
  buildLegacyAdminGuardAuditReport,
  isLegacyAdminGuardAccount,
} from './guard-legacy-isguard-audit-core.mjs';

const AUDIT_OUTPUT_DIR =
  '.guard-migration-audit';

const BOOTSTRAP_OWNER_EMAIL =
  'marsicprod@gmail.com';

function parseEnvText(text) {
  const result = {};

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (
      !line ||
      line.startsWith('#')
    ) {
      continue;
    }

    const separatorIndex =
      line.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key =
      line
        .slice(0, separatorIndex)
        .trim();

    let value =
      line
        .slice(separatorIndex + 1)
        .trim();

    if (
      (
        value.startsWith('"') &&
        value.endsWith('"')
      ) ||
      (
        value.startsWith("'") &&
        value.endsWith("'")
      )
    ) {
      value =
        value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

async function loadFirebaseEnvironment() {
  const merged = {
    ...process.env,
  };

  for (const fileName of [
    '.env',
    '.env.local',
    '.env.development',
    '.env.development.local',
    '.env.production',
    '.env.production.local',
  ]) {
    const filePath =
      resolve(fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    const parsed =
      parseEnvText(
        await readFile(
          filePath,
          'utf8',
        ),
      );

    for (const [key, value] of Object.entries(parsed)) {
      if (!merged[key]) {
        merged[key] = value;
      }
    }
  }

  return merged;
}

async function getExpectedProjectId() {
  const firebasercPath =
    resolve('.firebaserc');

  if (!existsSync(firebasercPath)) {
    return '';
  }

  const data =
    JSON.parse(
      await readFile(
        firebasercPath,
        'utf8',
      ),
    );

  return String(
    data?.projects?.default ||
    '',
  ).trim();
}

async function promptVisible(label) {
  const rl =
    createInterface({
      input,
      output,
    });

  try {
    return (
      await rl.question(label)
    ).trim();
  } finally {
    rl.close();
  }
}

async function promptHidden(label) {
  if (
    !input.isTTY ||
    typeof input.setRawMode !== 'function'
  ) {
    throw new Error(
      'Password audit tidak diberikan. Set GUARD_AUDIT_PASSWORD untuk non-interactive shell.',
    );
  }

  return new Promise(
    (
      resolvePrompt,
      rejectPrompt,
    ) => {
      let value = '';
      const previousRawMode =
        Boolean(input.isRaw);

      function cleanup() {
        input.off(
          'data',
          handleData,
        );

        input.setRawMode(
          previousRawMode,
        );

        output.write('\n');
      }

      function handleData(chunk) {
        for (const character of String(chunk)) {
          if (character === '\u0003') {
            cleanup();

            rejectPrompt(
              new Error(
                'Audit dibatalkan.',
              ),
            );

            return;
          }

          if (
            character === '\r' ||
            character === '\n'
          ) {
            cleanup();
            resolvePrompt(value);
            return;
          }

          if (
            character === '\u0008' ||
            character === '\u007f'
          ) {
            if (value.length) {
              value =
                value.slice(0, -1);

              output.write(
                '\b \b',
              );
            }

            continue;
          }

          if (
            character >= ' '
          ) {
            value += character;
            output.write('*');
          }
        }
      }

      output.write(label);
      input.setEncoding('utf8');
      input.setRawMode(true);
      input.resume();
      input.on(
        'data',
        handleData,
      );
    },
  );
}

async function getAuditCredentials() {
  const email =
    String(
      process.env.GUARD_AUDIT_EMAIL ||
      '',
    )
      .trim()
      .toLowerCase() ||
    (
      await promptVisible(
        'Owner email untuk audit: ',
      )
    ).toLowerCase();

  const password =
    String(
      process.env.GUARD_AUDIT_PASSWORD ||
      '',
    ) ||
    await promptHidden(
      'Owner password (tidak ditampilkan): ',
    );

  if (
    !email ||
    !password
  ) {
    throw new Error(
      'Email dan password Owner wajib tersedia untuk audit.',
    );
  }

  return {
    email,
    password,
  };
}

function createFirebaseConfig(env) {
  return {
    apiKey:
      env.VITE_FIREBASE_API_KEY || '',
    authDomain:
      env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId:
      env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket:
      env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId:
      env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId:
      env.VITE_FIREBASE_APP_ID || '',
  };
}

function assertFirebaseConfig(
  config,
  expectedProjectId,
) {
  for (const key of [
    'apiKey',
    'authDomain',
    'projectId',
  ]) {
    if (!config[key]) {
      throw new Error(
        'Firebase config ' +
        key +
        ' tidak ditemukan di environment lokal.',
      );
    }
  }

  if (
    expectedProjectId &&
    config.projectId !== expectedProjectId
  ) {
    throw new Error(
      'Project Firebase tidak cocok. .firebaserc=' +
      expectedProjectId +
      ', env=' +
      config.projectId +
      '. Audit dibatalkan.',
    );
  }
}

async function assertOwnerIdentity(
  db,
  firebaseUser,
) {
  const userSnapshot =
    await getDoc(
      doc(
        db,
        'users',
        firebaseUser.uid,
      ),
    );

  const account =
    userSnapshot.exists()
      ? userSnapshot.data()
      : null;

  const bootstrapOwner =
    firebaseUser.emailVerified === true &&
    String(
      firebaseUser.email ||
      '',
    )
      .trim()
      .toLowerCase() ===
      BOOTSTRAP_OWNER_EMAIL;

  if (
    !bootstrapOwner &&
    account?.role !== 'owner'
  ) {
    throw new Error(
      'Audit harus dijalankan memakai akun Owner. Session yang diberikan bukan Owner.',
    );
  }
}

async function loadOperatorFeePeople(db) {
  const snapshot =
    await getDoc(
      doc(
        db,
        'settings',
        'operatorFees',
      ),
    );

  if (!snapshot.exists()) {
    return [];
  }

  const data =
    snapshot.data();

  return Array.isArray(data?.people)
    ? data.people
    : [];
}

async function loadAllUsers(db) {
  const snapshot =
    await getDocs(
      collection(
        db,
        'users',
      ),
    );

  return snapshot.docs.map(
    (userDoc) => ({
      id: userDoc.id,
      uid:
        userDoc.data()?.uid ||
        userDoc.id,
      ...userDoc.data(),
    }),
  );
}

async function loadAttendanceEvidenceByUid(
  db,
  legacyUsers,
) {
  const result = {};

  for (const user of legacyUsers) {
    const uid =
      String(
        user.uid ||
        user.id ||
        '',
      ).trim();

    if (!uid) {
      continue;
    }

    try {
      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              'guardAttendanceSessions',
            ),
            where(
              'guardUid',
              '==',
              uid,
            ),
          ),
        );

      result[uid] =
        snapshot.docs.map(
          (sessionDoc) => ({
            id: sessionDoc.id,
            ...sessionDoc.data(),
          }),
        );
    } catch (error) {
      result[uid] = [];

      console.warn(
        '[guard-migration] Attendance evidence gagal dibaca untuk UID ' +
        uid +
        ': ' +
        (
          error?.message ||
          String(error)
        ),
      );
    }
  }

  return result;
}

function printReportSummary(report) {
  console.log('');
  console.log('=== GP6-A Legacy Admin + isGuard Audit ===');
  console.log('Mode: READ_ONLY');
  console.log(
    'Users scanned:',
    report.summary.totalUsersScanned,
  );
  console.log(
    'Legacy admin+isGuard:',
    report.summary.legacyAdminGuardCount,
  );
  console.log(
    'Active legacy:',
    report.summary.activeLegacyAdminGuardCount,
  );
  console.log(
    'With attendance evidence:',
    report.summary.withGuardAttendanceEvidence,
  );
  console.log(
    'Valid Guard identity:',
    report.summary.withValidGuardIdentity,
  );
  console.log(
    'Need Guard identity repair:',
    report.summary.requiringGuardIdentityRepair,
  );
  console.log('');

  if (!report.accounts.length) {
    console.log(
      'Tidak ada akun role=admin + isGuard=true yang ditemukan.',
    );

    return;
  }

  console.table(
    report.accounts.map(
      (entry) => ({
        uid: entry.uid,
        email: entry.email,
        status: entry.status,
        guardId: entry.guardId || '-',
        guardLink:
          entry.guardIdentity.state,
        adminPerms:
          entry.adminPermissionEvidence.enabledCount,
        attendance:
          entry.guardAttendanceEvidence.count,
        lastAttendance:
          entry.guardAttendanceEvidence.lastAttendanceDate || '-',
        guardTargetEligible:
          entry.migrationDecision.targets.studio_guard.eligible
            ? 'YES'
            : 'NO',
      }),
    ),
  );

  console.log('');
  console.log(
    'Tidak ada akun yang dimutasi. reviewedTarget tetap null sampai direview manual.',
  );
}

async function writeAuditReport(report) {
  await mkdir(
    resolve(AUDIT_OUTPUT_DIR),
    {
      recursive: true,
    },
  );

  const timestamp =
    report.generatedAt
      .replace(/[:.]/g, '-');

  const outputPath =
    resolve(
      AUDIT_OUTPUT_DIR,
      'legacy-admin-guard-audit-' +
      timestamp +
      '.json',
    );

  await writeFile(
    outputPath,
    JSON.stringify(
      report,
      null,
      2,
    ) + '\n',
    'utf8',
  );

  return outputPath;
}

async function main() {
  const env =
    await loadFirebaseEnvironment();

  const firebaseConfig =
    createFirebaseConfig(env);

  const expectedProjectId =
    await getExpectedProjectId();

  assertFirebaseConfig(
    firebaseConfig,
    expectedProjectId,
  );

  const credentials =
    await getAuditCredentials();

  const app =
    initializeApp(
      firebaseConfig,
      'guard-legacy-audit-' +
      Date.now(),
    );

  const auth =
    initializeAuth(
      app,
      {
        persistence:
          inMemoryPersistence,
      },
    );

  const db =
    getFirestore(app);

  try {
    const credential =
      await signInWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password,
      );

    await assertOwnerIdentity(
      db,
      credential.user,
    );

    const [
      users,
      people,
    ] =
      await Promise.all([
        loadAllUsers(db),
        loadOperatorFeePeople(db),
      ]);

    const legacyUsers =
      users.filter(
        isLegacyAdminGuardAccount,
      );

    const attendanceByUid =
      await loadAttendanceEvidenceByUid(
        db,
        legacyUsers,
      );

    const report =
      buildLegacyAdminGuardAuditReport({
        attendanceByUid,
        people,
        users,
      });

    printReportSummary(report);

    const outputPath =
      await writeAuditReport(
        report,
      );

    console.log(
      'Report lokal:',
      outputPath,
    );
    console.log(
      'NO MUTATION PERFORMED.',
    );
  } finally {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } finally {
      await deleteApp(app);
    }
  }
}

main().catch((error) => {
  console.error(
    '[guard-migration] Audit gagal:',
    error?.message ||
    error,
  );

  process.exitCode = 1;
});
