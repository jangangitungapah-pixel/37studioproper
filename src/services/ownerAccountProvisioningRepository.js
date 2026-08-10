import {
  deleteApp,
  initializeApp,
} from 'firebase/app';

import {
  createUserWithEmailAndPassword,
  deleteUser,
  inMemoryPersistence,
  initializeAuth,
  signOut,
  updateProfile,
} from 'firebase/auth';

import {
  deleteDoc,
  doc,
  getFirestore,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import {
  firebaseAuth,
  firebaseConfig,
  firestoreDb,
  isFirebaseConfigured,
} from '../lib/firebase.js';

import {
  buildPortalRoleTransitionPatch,
  isOwnerAdminUser,
} from '../utils/adminPermissions.js';

import {
  assertValidGuardIdentityLink,
} from '../utils/guardIdentity.js';

import {
  createAdminPermissions,
} from '../utils/accountRoles.js';

const SUPPORTED_PROVISION_ROLES =
  new Set([
    'admin',
    'studio_guard',
  ]);

function createProvisioningError(
  code,
  message,
  cause,
) {
  const error =
    new Error(
      message,
    );

  error.code =
    code;

  if (cause) {
    error.cause =
      cause;
  }

  return error;
}

function normalizeEmail(value) {
  return String(
    value ||
    '',
  )
    .trim()
    .toLowerCase();
}

function normalizeDisplayName(value) {
  return String(
    value ||
    '',
  )
    .trim()
    .slice(
      0,
      120,
    );
}

function assertOwnerSession(currentOwner) {
  if (
    !isFirebaseConfigured ||
    !firebaseAuth ||
    !firestoreDb
  ) {
    throw createProvisioningError(
      'owner-provision/firebase-unavailable',
      'Firebase belum dikonfigurasi.',
    );
  }

  const ownerUid =
    String(
      currentOwner?.uid ||
      '',
    ).trim();

  if (
    !ownerUid ||
    firebaseAuth.currentUser?.uid !==
      ownerUid ||
    !isOwnerAdminUser(
      currentOwner,
    )
  ) {
    throw createProvisioningError(
      'owner-provision/owner-required',
      'Hanya Owner aktif yang dapat membuat akun portal.',
    );
  }

  return ownerUid;
}

function validateProvisionInput({
  displayName,
  email,
  guardId,
  guardPeople = [],
  password,
  role,
}) {
  const normalizedName =
    normalizeDisplayName(
      displayName,
    );

  const normalizedEmail =
    normalizeEmail(
      email,
    );

  const normalizedPassword =
    String(
      password ||
      '',
    );

  const normalizedRole =
    String(
      role ||
      '',
    ).trim();

  const normalizedGuardId =
    String(
      guardId ||
      '',
    ).trim();

  if (!normalizedName) {
    throw createProvisioningError(
      'owner-provision/display-name-required',
      'Nama akun wajib diisi.',
    );
  }

  if (
    !normalizedEmail ||
    !normalizedEmail.includes(
      '@',
    )
  ) {
    throw createProvisioningError(
      'owner-provision/email-required',
      'Email akun belum valid.',
    );
  }

  if (
    normalizedPassword.length <
    6
  ) {
    throw createProvisioningError(
      'owner-provision/weak-password',
      'Password minimal 6 karakter.',
    );
  }

  if (
    !SUPPORTED_PROVISION_ROLES.has(
      normalizedRole,
    )
  ) {
    throw createProvisioningError(
      'owner-provision/invalid-role',
      'Role akun hanya boleh Admin atau Guard.',
    );
  }

  if (
    normalizedRole ===
      'studio_guard'
  ) {
    try {
      assertValidGuardIdentityLink(
        guardPeople,
        normalizedGuardId,
      );
    } catch (guardIdentityError) {
      throw createProvisioningError(
        'owner-provision/guard-required',
        guardIdentityError?.message ||
          'Pilih identitas crew Guard sebelum membuat akun.',
        guardIdentityError,
      );
    }
  }

  return {
    displayName:
      normalizedName,

    email:
      normalizedEmail,

    guardId:
      normalizedGuardId,

    password:
      normalizedPassword,

    role:
      normalizedRole,
  };
}

function createTemporaryAppName() {
  return (
    'owner-account-provision-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(
        36,
      )
      .slice(
        2,
        10,
      )
  );
}

function buildPendingSelfIdentity(
  firebaseUser,
  {
    displayName,
    email,
  },
) {
  const now =
    new Date()
      .toISOString();

  return {
    createdAt:
      now,

    displayName,

    email,

    permissions:
      createAdminPermissions(
        false,
      ),

    phoneNumber:
      '',

    provider:
      'password',

    role:
      'admin',

    status:
      'pending',

    uid:
      firebaseUser.uid,

    updatedAt:
      now,
  };
}

export function getOwnerProvisioningErrorMessage(error) {
  const code =
    String(
      error?.code ||
      '',
    );

  if (
    code ===
    'auth/email-already-in-use'
  ) {
    return 'Email ini sudah dipakai oleh akun Firebase lain.';
  }

  if (
    code ===
    'auth/invalid-email'
  ) {
    return 'Format email akun belum valid.';
  }

  if (
    code ===
      'auth/weak-password' ||
    code ===
      'owner-provision/weak-password'
  ) {
    return 'Password minimal 6 karakter.';
  }

  if (
    code ===
    'auth/operation-not-allowed'
  ) {
    return 'Provider Email/Password belum diaktifkan di Firebase Authentication.';
  }

  if (
    code ===
    'auth/network-request-failed'
  ) {
    return 'Koneksi ke Firebase gagal saat membuat akun.';
  }

  if (
    code ===
      'permission-denied' ||
    code ===
      'firestore/permission-denied'
  ) {
    return 'Owner tidak memiliki izin Firestore yang diperlukan untuk membuat akun ini.';
  }

  return (
    error?.message ||
    'Akun portal belum berhasil dibuat.'
  );
}

export async function provisionPortalAccount({
  currentOwner,
  displayName,
  email,
  guardId = '',
  guardPeople = [],
  password,
  role,
}) {
  const ownerUid =
    assertOwnerSession(
      currentOwner,
    );

  const input =
    validateProvisionInput({
      displayName,
      email,
      guardId,
      guardPeople,
      password,
      role,
    });

  const temporaryApp =
    initializeApp(
      firebaseConfig,
      createTemporaryAppName(),
    );

  const temporaryAuth =
    initializeAuth(
      temporaryApp,
      {
        persistence:
          inMemoryPersistence,
      },
    );

  const temporaryDb =
    getFirestore(
      temporaryApp,
    );

  let credential =
    null;

  let pendingDocCreated =
    false;

  let finalized =
    false;

  try {
    credential =
      await createUserWithEmailAndPassword(
        temporaryAuth,
        input.email,
        input.password,
      );

    await updateProfile(
      credential.user,
      {
        displayName:
          input.displayName,
      },
    );

    const pendingIdentity =
      buildPendingSelfIdentity(
        credential.user,
        input,
      );

    await setDoc(
      doc(
        temporaryDb,
        'users',
        credential.user.uid,
      ),
      pendingIdentity,
    );

    pendingDocCreated =
      true;

    if (
      firebaseAuth.currentUser?.uid !==
      ownerUid
    ) {
      throw createProvisioningError(
        'owner-provision/session-changed',
        'Session Owner berubah saat provisioning. Proses dibatalkan.',
      );
    }

    const finalRolePatch =
      buildPortalRoleTransitionPatch(
        {
          ...pendingIdentity,
          id:
            credential.user.uid,
        },
        input.role,
        {
          guardId:
            input.guardId,
          guardPeople,
        },
      );

    const finalizedAt =
      new Date()
        .toISOString();

    await updateDoc(
      doc(
        firestoreDb,
        'users',
        credential.user.uid,
      ),
      {
        ...finalRolePatch,

        displayName:
          input.displayName,

        email:
          input.email,

        phoneNumber:
          '',

        provider:
          'password',

        uid:
          credential.user.uid,

        updatedAt:
          finalizedAt,
      },
    );

    finalized =
      true;

    return {
      displayName:
        input.displayName,

      email:
        input.email,

      guardId:
        finalRolePatch.guardId ||
        null,

      role:
        finalRolePatch.role,

      status:
        finalRolePatch.status,

      uid:
        credential.user.uid,
    };
  } catch (error) {
    if (
      !finalized &&
      credential?.user
    ) {
      if (pendingDocCreated) {
        try {
          await deleteDoc(
            doc(
              firestoreDb,
              'users',
              credential.user.uid,
            ),
          );
        } catch (rollbackDocError) {
          console.error(
            '[owner-account-provision] Gagal rollback user document:',
            rollbackDocError,
          );
        }
      }

      try {
        await deleteUser(
          credential.user,
        );
      } catch (rollbackAuthError) {
        console.error(
          '[owner-account-provision] Gagal rollback Firebase Auth user:',
          rollbackAuthError,
        );
      }
    }

    throw error;
  } finally {
    try {
      if (
        temporaryAuth.currentUser
      ) {
        await signOut(
          temporaryAuth,
        );
      }
    } catch (cleanupAuthError) {
      console.warn(
        '[owner-account-provision] Temporary auth cleanup gagal:',
        cleanupAuthError,
      );
    }

    try {
      await deleteApp(
        temporaryApp,
      );
    } catch (cleanupAppError) {
      console.warn(
        '[owner-account-provision] Temporary Firebase app cleanup gagal:',
        cleanupAppError,
      );
    }
  }
}

export const ownerAccountProvisioningRepository = {
  getOwnerProvisioningErrorMessage,
  provisionPortalAccount,
};
