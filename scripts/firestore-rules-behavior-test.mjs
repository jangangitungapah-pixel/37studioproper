import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run this test through `npm run test:rules`.');
}

const projectId = 'demo-studio37';
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const environment = await initializeTestEnvironment({
  firestore: { rules },
  projectId,
});

const permissions = (enabled = {}) => ({
  billing: false,
  bookkeeping: false,
  customers: false,
  dashboard: false,
  gallery: false,
  'guard-attendance': false,
  inventory: false,
  notifications: false,
  'operator-fee': false,
  schedule: false,
  settings: false,
  ...enabled,
});
const now = '2026-08-14T08:00:00.000Z';
const legacyGuardPermissions = permissions({ 'operator-fee': true });
delete legacyGuardPermissions['guard-attendance'];

const guardAttendanceRecord = (id) => ({
  id,
  approvalStatus: 'pending',
  approvedAt: '',
  approvedByName: '',
  approvedByUid: '',
  closedAt: '',
  clockInAt: now,
  clockInByUid: 'studio-guard',
  clockOutAt: '',
  clockOutByUid: '',
  createdAt: now,
  date: '2026-08-14',
  durationHours: 0,
  guardEmail: 'guard@example.com',
  guardName: 'Studio Guard',
  guardPersonId: 'guard-person-1',
  guardUid: 'studio-guard',
  mealAmount: 40000,
  mealEligible: false,
  mealBookkeepingEntryId: '',
  mealBookkeepingStatus: 'not_posted',
  mealPostedAt: '',
  mealPostedByUid: '',
  note: '',
  ownerActionRequired: true,
  rejectedAt: '',
  rejectedByName: '',
  rejectedByUid: '',
  rejectionReason: '',
  source: 'guardAttendance',
  status: 'pending_approval',
  updatedAt: now,
  voidedAt: '',
  voidedByUid: '',
  voidReason: '',
});

try {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const users = {
      'bootstrap-old': {
        displayName: 'Former Bootstrap Owner',
        email: 'marsicprod@gmail.com',
        permissions: permissions({ settings: true }),
        role: 'admin',
        status: 'approved',
        uid: 'bootstrap-old',
      },
      'dashboard-only': {
        displayName: 'Dashboard Only',
        email: 'dashboard@example.com',
        permissions: permissions({ dashboard: true }),
        role: 'admin',
        status: 'approved',
        uid: 'dashboard-only',
      },
      'gallery-admin': {
        displayName: 'Gallery Admin',
        email: 'gallery@example.com',
        permissions: permissions({ gallery: true }),
        role: 'admin',
        status: 'approved',
        uid: 'gallery-admin',
      },
      'guard-attendance-admin': {
        displayName: 'Guard Attendance Admin',
        email: 'guard-review@example.com',
        permissions: permissions({ 'guard-attendance': true }),
        role: 'admin',
        status: 'approved',
        uid: 'guard-attendance-admin',
      },
      'guard-attendance-denied': {
        displayName: 'Guard Attendance Denied',
        email: 'guard-denied@example.com',
        permissions: permissions({ 'guard-attendance': false, 'operator-fee': true }),
        role: 'admin',
        status: 'approved',
        uid: 'guard-attendance-denied',
      },
      'guard-attendance-legacy': {
        displayName: 'Legacy Attendance Admin',
        email: 'guard-legacy@example.com',
        permissions: legacyGuardPermissions,
        role: 'admin',
        status: 'approved',
        uid: 'guard-attendance-legacy',
      },
      'new-owner': {
        displayName: 'Canonical Owner',
        email: 'owner@example.com',
        permissions: permissions(),
        role: 'owner',
        status: 'approved',
        uid: 'new-owner',
      },
      'notifications-denied': {
        displayName: 'Notifications Denied',
        email: 'notify@example.com',
        permissions: permissions({ notifications: false, settings: true }),
        role: 'admin',
        status: 'approved',
        uid: 'notifications-denied',
      },
      'notifications-admin': {
        displayName: 'Notifications Admin',
        email: 'activity@example.com',
        permissions: permissions({ notifications: true }),
        role: 'admin',
        status: 'approved',
        uid: 'notifications-admin',
      },
      'schedule-admin': {
        displayName: 'Schedule Admin',
        email: 'schedule@example.com',
        permissions: permissions({ schedule: true }),
        role: 'admin',
        status: 'approved',
        uid: 'schedule-admin',
      },
      'settings-admin': {
        displayName: 'Settings Admin',
        email: 'settings@example.com',
        permissions: permissions({ settings: true }),
        role: 'admin',
        status: 'approved',
        uid: 'settings-admin',
      },
      'client-1': {
        displayName: 'Client',
        email: 'client@example.com',
        permissions: permissions(),
        role: 'client',
        status: 'active',
        uid: 'client-1',
      },
    };
    await Promise.all(Object.entries(users).map(([id, data]) => setDoc(doc(db, 'users', id), data)));
    await setDoc(doc(db, 'adminControl', 'ownership'), {
      currentOwnerUid: 'new-owner',
      initializedAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'settings', 'operatorFees'), { amount: 1 });
    await setDoc(doc(db, 'settings', 'studio'), {
      bankAccountHolder: 'Studio 37',
      bankAccountNumber: '123',
      bankName: 'Bank',
      paymentTerms: [],
      qrisLabel: '',
      qrisNote: '',
      studioAddress: '',
      studioName: 'Studio 37',
      studioPhone: '',
      updatedAt: now,
    });
    await setDoc(doc(db, 'bookings', 'booking-1'), {
      customer: 'Customer',
      date: '2026-08-20',
      dpAmount: 0,
      durationHours: 2,
      invoiceAmount: 500000,
      paidAmount: 0,
      paymentHistory: [],
      paymentStatus: 'pending',
      phone: '6281',
      startHour: 10,
      status: 'pending',
      total: 500000,
    });
    await setDoc(doc(db, 'customers', 'customer-1'), {
      createdAt: now,
      email: '',
      followUpStatus: 'normal',
      id: 'customer-1',
      instagram: '',
      name: 'Customer',
      notes: '',
      phone: '6281',
      phoneKey: '6281',
      updatedAt: now,
    });
    await setDoc(doc(db, 'inventoryItems', 'item-1'), {
      category: 'Cable',
      condition: 'good',
      createdAt: now,
      id: 'item-1',
      location: 'Studio',
      minStock: 1,
      name: 'Cable',
      note: '',
      quantity: 4,
      status: 'active',
      type: 'equipment',
      unit: 'pcs',
      updatedAt: now,
    });
    await setDoc(doc(db, 'bookkeepingEntries', 'manual-1'), {
      source: 'manual',
      title: 'Manual',
    });
    await setDoc(doc(db, 'gallery', 'photo-1'), {
      category: 'Studio',
      createdAt: now,
      deletedAt: now,
      description: '',
      isDeleted: true,
      isFavorite: false,
      publicId: 'studio37/gallery/photo-1',
      title: 'Photo',
      uploadedBy: 'gallery-admin',
      url: 'https://res.cloudinary.com/example/image/upload/photo-1.jpg',
    });
    await setDoc(doc(db, 'gallery', 'photo-claimed'), {
      category: 'Studio',
      createdAt: now,
      deletedAt: now,
      description: '',
      isDeleted: true,
      isFavorite: false,
      permanentDeleteKey: 'delete-key',
      permanentDeleteStartedAt: now,
      permanentDeleteStatus: 'deleting',
      publicId: 'studio37/gallery/photo-claimed',
      title: 'Claimed',
      uploadedBy: 'gallery-admin',
      url: 'https://res.cloudinary.com/example/image/upload/photo-claimed.jpg',
    });
    await setDoc(doc(db, 'notificationEvents', 'event-1'), { status: 'pending' });
    await setDoc(
      doc(db, 'guardAttendanceSessions', 'attendance-explicit'),
      guardAttendanceRecord('attendance-explicit'),
    );
    await setDoc(
      doc(db, 'guardAttendanceSessions', 'attendance-legacy'),
      guardAttendanceRecord('attendance-legacy'),
    );
    await setDoc(
      doc(db, 'guardAttendanceSessions', 'attendance-denied'),
      guardAttendanceRecord('attendance-denied'),
    );
  });

  const context = (uid, email) => environment.authenticatedContext(uid, {
    email,
    email_verified: true,
  }).firestore();
  const oldBootstrap = context('bootstrap-old', 'marsicprod@gmail.com');
  const missingBootstrap = context('bootstrap-missing', 'marsicprod@gmail.com');
  const owner = context('new-owner', 'owner@example.com');

  await assertFails(getDoc(doc(oldBootstrap, 'settings', 'operatorFees')));
  await assertFails(getDoc(doc(missingBootstrap, 'settings', 'operatorFees')));
  await assertSucceeds(getDoc(doc(owner, 'settings', 'operatorFees')));

  const dashboard = context('dashboard-only', 'dashboard@example.com');
  await assertSucceeds(getDoc(doc(dashboard, 'bookings', 'booking-1')));
  await assertFails(updateDoc(doc(dashboard, 'bookings', 'booking-1'), { date: '2026-08-21' }));
  await assertFails(updateDoc(doc(dashboard, 'customers', 'customer-1'), { name: 'Forged' }));
  await assertFails(updateDoc(doc(dashboard, 'inventoryItems', 'item-1'), { note: 'Forged' }));
  await assertFails(deleteDoc(doc(dashboard, 'bookkeepingEntries', 'manual-1')));

  const schedule = context('schedule-admin', 'schedule@example.com');
  await assertSucceeds(setDoc(doc(schedule, 'bookings', 'safe-unpaid'), {
    customer: 'Safe',
    date: '2026-08-22',
    dpAmount: 0,
    durationHours: 1,
    invoiceAmount: 500000,
    paidAmount: 0,
    paymentHistory: [],
    paymentStatus: 'pending',
    phone: '',
    startHour: 11,
    status: 'pending',
    total: 500000,
  }));
  await assertFails(setDoc(doc(schedule, 'bookings', 'forged-paid'), {
    customer: 'Forged',
    date: '2026-08-22',
    dpAmount: 500000,
    durationHours: 1,
    invoiceAmount: 0,
    paidAmount: 500000,
    paymentHistory: [{ amount: 500000 }],
    paymentStatus: 'lunas',
    phone: '',
    startHour: 12,
    status: 'lunas',
    total: 500000,
  }));

  const settingsAdmin = context('settings-admin', 'settings@example.com');
  await assertFails(updateDoc(doc(settingsAdmin, 'settings', 'studio'), { unexpected: true }));
  await assertFails(deleteDoc(doc(settingsAdmin, 'settings', 'studio')));

  const gallery = context('gallery-admin', 'gallery@example.com');
  await assertFails(updateDoc(doc(gallery, 'gallery', 'photo-1'), {
    publicId: 'studio37/gallery/another-asset',
  }));
  await assertFails(updateDoc(doc(gallery, 'gallery', 'photo-claimed'), {
    deletedAt: null,
    isDeleted: false,
  }));
  await assertFails(setDoc(doc(gallery, 'gallery', 'bad-prefix'), {
    category: 'Studio',
    createdAt: now,
    description: '',
    isDeleted: false,
    isFavorite: false,
    publicId: 'other-folder/valuable-asset',
    title: 'Bad asset',
    uploadedBy: 'gallery-admin',
    url: 'https://res.cloudinary.com/example/image/upload/bad.jpg',
  }));

  const notificationsDenied = context('notifications-denied', 'notify@example.com');
  await assertFails(getDoc(doc(notificationsDenied, 'notificationEvents', 'event-1')));

  const notificationsAdmin = context('notifications-admin', 'activity@example.com');
  const inAppActivity = {
    actorEmail: 'activity@example.com',
    actorRole: 'admin',
    actorUid: 'notifications-admin',
    attempts: 0,
    bookingId: 'booking-1',
    channel: 'in_app',
    createdAt: now,
    errorMessage: '',
    id: 'activity-valid',
    message: 'Booking baru diterima.',
    metadata: {},
    paymentProofId: '',
    priority: 'normal',
    provider: 'firestore',
    sentAt: now,
    source: 'rules-test',
    status: 'sent',
    targetMode: 'role',
    targetRole: 'admin',
    targetUid: '',
    title: 'Booking baru',
    type: 'booking_request_created',
    updatedAt: now,
    url: '/admin/requests',
  };
  await assertSucceeds(setDoc(
    doc(notificationsAdmin, 'notificationEvents', inAppActivity.id),
    inAppActivity,
  ));
  await assertFails(setDoc(
    doc(notificationsAdmin, 'notificationEvents', 'activity-push-forged'),
    {
      ...inAppActivity,
      channel: 'push',
      id: 'activity-push-forged',
      provider: 'external',
    },
  ));
  await assertFails(setDoc(
    doc(notificationsAdmin, 'notificationSubscriptions', 'notifications-admin'),
    { uid: 'notifications-admin' },
  ));

  const voidPatch = (uid) => ({
    mealEligible: false,
    ownerActionRequired: false,
    status: 'void',
    updatedAt: '2026-08-14T09:00:00.000Z',
    voidedAt: '2026-08-14T09:00:00.000Z',
    voidedByUid: uid,
    voidReason: 'Attendance dibatalkan oleh admin.',
  });
  const guardAttendanceAdmin = context(
    'guard-attendance-admin',
    'guard-review@example.com',
  );
  await assertSucceeds(updateDoc(
    doc(guardAttendanceAdmin, 'guardAttendanceSessions', 'attendance-explicit'),
    voidPatch('guard-attendance-admin'),
  ));

  const legacyAttendanceAdmin = context(
    'guard-attendance-legacy',
    'guard-legacy@example.com',
  );
  await assertSucceeds(updateDoc(
    doc(legacyAttendanceAdmin, 'guardAttendanceSessions', 'attendance-legacy'),
    voidPatch('guard-attendance-legacy'),
  ));

  const deniedAttendanceAdmin = context(
    'guard-attendance-denied',
    'guard-denied@example.com',
  );
  await assertFails(updateDoc(
    doc(deniedAttendanceAdmin, 'guardAttendanceSessions', 'attendance-denied'),
    voidPatch('guard-attendance-denied'),
  ));

  const client = context('client-1', 'client@example.com');
  const clientBooking = {
    appliedDiscounts: [],
    bookingCode: 'BKG-CLIENT-1',
    bookingId: 'BKG-CLIENT-1',
    bookingRequestStatus: 'submitted',
    clientRequestUpdatedAt: now,
    clientUid: 'client-1',
    createdAt: now,
    customer: 'Client',
    customerId: 'auth_client-1',
    customerPhoneKey: '',
    date: '2026-08-23',
    discountAmount: 0,
    dpAmount: 0,
    durationHours: 1,
    email: 'client@example.com',
    id: 'client-forged-refund',
    invoiceAmount: 100000,
    invoiceNumber: 'INV-CLIENT-1',
    lastPaymentAt: '',
    lastPaymentMethod: '',
    packageId: 'none',
    packageLabel: '',
    paidAmount: 0,
    paymentHistory: [],
    paymentMethod: '',
    paymentStatus: 'pending',
    phone: '',
    pricingMode: 'session',
    recordingTypeId: '',
    recordingTypeLabel: '',
    refundHistory: [{ amount: 100000 }],
    sessionLabel: 'Sesi Studio',
    sessionType: 'rehearsal',
    source: 'clientPortal',
    startHour: 13,
    startTimeLabel: '13:00',
    status: 'pending',
    subtotal: 100000,
    title: 'Sesi Studio',
    total: 100000,
    updatedAt: now,
  };
  const safeClientBooking = { ...clientBooking };
  delete safeClientBooking.refundHistory;
  await assertSucceeds(setDoc(doc(client, 'bookings', 'client-safe'), {
    ...safeClientBooking,
    id: 'client-safe',
  }));
  await assertFails(setDoc(doc(client, 'bookings', clientBooking.id), clientBooking));

  assert.equal(true, true);
  console.log('firestore-rules-behavior-test: PASS');
} finally {
  await environment.cleanup();
}
