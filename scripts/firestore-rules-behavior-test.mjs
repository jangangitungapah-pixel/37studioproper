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
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  createRepositoryOperationId,
  createRepositoryPayloadHash,
} from '../src/lib/firestoreRepositoryFoundation.js';

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
    await setDoc(doc(context.firestore(), 'bookingSessionEvents', 'session-event-1'), {
      action: 'check_in', actorName: 'Owner', actorUid: 'owner-1', bookingId: 'booking-1',
      createdAt: now, fromStatus: 'upcoming', id: 'session-event-1', reason: '',
      toStatus: 'upcoming', type: 'booking-session-event',
    });
    await setDoc(doc(context.firestore(), 'inventoryItems', 'item-1'), {
      category: 'Cable', condition: 'good', createdAt: now, id: 'item-1', location: 'Studio',
      minStock: 1, name: 'Cable', note: '', quantity: 4, status: 'active', type: 'equipment',
      unit: 'pcs', updatedAt: now,
    });
    const db = context.firestore();
    await setDoc(doc(db, 'suppliers', 'supplier-rules-1'), {
      id: 'supplier-rules-1', name: 'Supplier Rules', status: 'active', createdAt: now, updatedAt: now,
    });
    await setDoc(doc(db, 'purchaseOrders', 'po-rules-1'), {
      id: 'po-rules-1', poNumber: 'PO-RULES-1', supplierId: 'supplier-rules-1',
      supplierName: 'Supplier Rules', items: [], totalAmount: 100000, paidAmount: 0,
      status: 'ordered', orderDate: '2026-08-14', expectedAt: '', createdAt: now, updatedAt: now,
    });
    await setDoc(doc(db, 'goodsReceipts', 'receipt-rules-1'), {
      id: 'receipt-rules-1', purchaseOrderId: 'po-rules-1', poNumber: 'PO-RULES-1',
      supplierId: 'supplier-rules-1', supplierName: 'Supplier Rules', items: [],
      receivedAt: now, createdAt: now,
    });
    await setDoc(doc(db, 'procurementPayments', 'payment-rules-1'), {
      id: 'payment-rules-1', purchaseOrderId: 'po-rules-1', amount: 10000, paymentMethod: 'transfer', date: '2026-08-14', createdAt: now,
    });
    await setDoc(doc(db, 'procurementEvents', 'procurement-event-rules-1'), {
      id: 'procurement-event-rules-1', entityType: 'purchase_order', entityId: 'po-rules-1',
      action: 'created', actorUid: 'new-owner', actorName: 'Owner', createdAt: now,
    });
    await setDoc(doc(db, 'cashClosingSessions', '2026-08-14__main'), {
      businessDate: '2026-08-14', id: '2026-08-14__main', registerId: 'main', status: 'closed',
    });
    await setDoc(doc(db, 'cashClosingEvents', 'closing-event-1'), {
      action: 'closed', actorName: 'Owner', actorUid: 'new-owner', businessDate: '2026-08-14',
      closingId: '2026-08-14__main', createdAt: now, id: 'closing-event-1', reason: '',
      registerId: 'main', revision: 1, type: 'cash-closing-event',
    });
    const closedManualEntry = {
      actorName: 'Bookkeeping Admin', actorUid: 'bookkeeping-admin', amount: 20000,
      category: 'Operational', createdAt: now, date: '2026-08-14', id: 'manual-closed-date',
      idempotencyKey: 'manual-closed-date', immutable: false, note: '', paymentMethod: 'cash',
      reversalOf: '', source: 'manual', title: 'Closed date expense', type: 'expense', updatedAt: now,
    };
    await setDoc(doc(db, 'bookkeepingEntries', 'manual-closed-date'), closedManualEntry);
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
      'customers-admin': {
        displayName: 'Customer Admin',
        email: 'customer-admin@example.com',
        permissions: permissions({ customers: true }),
        role: 'admin',
        status: 'approved',
        uid: 'customers-admin',
      },
      'bookkeeping-admin': {
        displayName: 'Bookkeeping Admin',
        email: 'bookkeeping@example.com',
        permissions: permissions({ bookkeeping: true }),
        role: 'admin',
        status: 'approved',
        uid: 'bookkeeping-admin',
      },
      'inventory-admin': {
        displayName: 'Inventory Admin',
        email: 'inventory@example.com',
        permissions: permissions({ inventory: true }),
        role: 'admin',
        status: 'approved',
        uid: 'inventory-admin',
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
      'schedule-recovery-admin': {
        displayName: 'Schedule Recovery Admin',
        email: 'schedule-recovery@example.com',
        permissions: permissions({ schedule: true }),
        role: 'admin',
        status: 'approved',
        uid: 'schedule-recovery-admin',
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
    await setDoc(doc(db, 'customerFollowUpTasks', 'follow-up-rules-task'), {
      assignedToName: 'Customer Admin',
      assignedToUid: 'customers-admin',
      createdAt: now,
      customerId: 'customer-1',
      customerName: 'Customer',
      dueAt: '2026-11-05',
      id: 'follow-up-rules-task',
      revision: 1,
      status: 'open',
      updatedAt: now,
    });
    await setDoc(doc(db, 'customerFollowUpEvents', 'follow-up-rules-event'), {
      action: 'created',
      actorName: 'Owner',
      actorUid: 'new-owner',
      createdAt: now,
      customerId: 'customer-1',
      id: 'follow-up-rules-event',
      taskId: 'follow-up-rules-task',
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
  const inventoryAdmin = context('inventory-admin', 'inventory@example.com');
  const procurementBookkeeping = context('bookkeeping-admin', 'bookkeeping@example.com');
  const scheduleRecoveryAdmin = context('schedule-recovery-admin', 'schedule-recovery@example.com');

  await assertSucceeds(getDoc(doc(inventoryAdmin, 'suppliers', 'supplier-rules-1')));
  await assertSucceeds(getDoc(doc(inventoryAdmin, 'purchaseOrders', 'po-rules-1')));
  await assertSucceeds(getDoc(doc(inventoryAdmin, 'goodsReceipts', 'receipt-rules-1')));
  await assertSucceeds(getDoc(doc(inventoryAdmin, 'procurementEvents', 'procurement-event-rules-1')));
  await assertFails(getDoc(doc(inventoryAdmin, 'procurementPayments', 'payment-rules-1')));
  await assertSucceeds(getDoc(doc(procurementBookkeeping, 'procurementPayments', 'payment-rules-1')));

  await assertFails(setDoc(doc(inventoryAdmin, 'suppliers', 'supplier-browser-create'), {
    id: 'supplier-browser-create', name: 'Forged Supplier', status: 'active', createdAt: now, updatedAt: now,
  }));
  await assertFails(updateDoc(doc(inventoryAdmin, 'purchaseOrders', 'po-rules-1'), { status: 'received' }));
  await assertFails(deleteDoc(doc(inventoryAdmin, 'goodsReceipts', 'receipt-rules-1')));
  await assertFails(setDoc(doc(inventoryAdmin, 'procurementEvents', 'procurement-event-browser-create'), {
    id: 'procurement-event-browser-create', action: 'forged', createdAt: now,
  }));
  await assertFails(setDoc(doc(procurementBookkeeping, 'procurementPayments', 'payment-browser-create'), {
    id: 'payment-browser-create', amount: 5000, createdAt: now,
  }));

  await assertFails(updateDoc(doc(inventoryAdmin, 'inventoryItems', 'item-1'), {
    note: 'Direct browser mutation',
  }));
  await assertFails(setDoc(doc(inventoryAdmin, 'inventoryItems', 'browser-created-item'), {
    category: 'Cable',
    condition: 'good',
    createdAt: now,
    id: 'browser-created-item',
    location: 'Studio',
    minStock: 1,
    name: 'Browser-created Cable',
    note: '',
    quantity: 4,
    status: 'active',
    type: 'equipment',
    unit: 'pcs',
    updatedAt: now,
  }));

  await assertFails(getDoc(doc(oldBootstrap, 'settings', 'operatorFees')));
  await assertFails(getDoc(doc(missingBootstrap, 'settings', 'operatorFees')));
  await assertSucceeds(getDoc(doc(owner, 'settings', 'operatorFees')));

  const dashboard = context('dashboard-only', 'dashboard@example.com');
  await assertSucceeds(getDoc(doc(dashboard, 'bookings', 'booking-1')));
  await assertFails(updateDoc(doc(dashboard, 'bookings', 'booking-1'), { date: '2026-08-21' }));
  await assertFails(updateDoc(doc(dashboard, 'customers', 'customer-1'), { name: 'Forged' }));
  await assertFails(updateDoc(doc(dashboard, 'inventoryItems', 'item-1'), { note: 'Forged' }));
  await assertFails(deleteDoc(doc(dashboard, 'bookkeepingEntries', 'manual-1')));

  await assertFails(getDoc(doc(dashboard, 'bookingSessionEvents', 'session-event-1')));
  // Dashboard access intentionally includes read-only bookkeeping context.
  // The canonical rules expose these snapshots/events through canAccessBookkeepingData().
  await assertSucceeds(getDoc(doc(dashboard, 'cashClosingSessions', '2026-08-14__main')));
  await assertSucceeds(getDoc(doc(dashboard, 'cashClosingEvents', 'closing-event-1')));
  const closingSettingsAdmin = context('settings-admin', 'settings@example.com');
  await assertFails(getDoc(doc(closingSettingsAdmin, 'cashClosingSessions', '2026-08-14__main')));
  await assertFails(getDoc(doc(closingSettingsAdmin, 'cashClosingEvents', 'closing-event-1')));
  await assertFails(setDoc(doc(dashboard, 'bookingSessionEvents', 'session-event-forged'), {
    action: 'completed', actorName: 'Dashboard', actorUid: 'dashboard-only', bookingId: 'booking-1',
    createdAt: now, fromStatus: 'in_progress', id: 'session-event-forged', reason: '',
    toStatus: 'completed', type: 'booking-session-event',
  }));

  // Dashboard permission also grants read-only access to Customer Follow-up data.
  // Writes remain Worker-only and the unrelated Settings permission is not sufficient.
  await assertSucceeds(getDoc(doc(dashboard, 'customerFollowUpTasks', 'follow-up-rules-task')));
  await assertSucceeds(getDoc(doc(dashboard, 'customerFollowUpEvents', 'follow-up-rules-event')));
  await assertFails(getDoc(doc(closingSettingsAdmin, 'customerFollowUpTasks', 'follow-up-rules-task')));
  await assertFails(getDoc(doc(closingSettingsAdmin, 'customerFollowUpEvents', 'follow-up-rules-event')));

  const customersAdmin = context('customers-admin', 'customer-admin@example.com');
  await assertSucceeds(getDoc(doc(customersAdmin, 'customerFollowUpTasks', 'follow-up-rules-task')));
  await assertSucceeds(getDoc(doc(customersAdmin, 'customerFollowUpEvents', 'follow-up-rules-event')));
  await assertFails(setDoc(doc(customersAdmin, 'customerFollowUpTasks', 'forged-follow-up-task'), {
    assignedToName: 'Forged',
    assignedToUid: 'customers-admin',
    createdAt: now,
    customerId: 'customer-1',
    customerName: 'Customer',
    dueAt: '2026-11-05',
    id: 'forged-follow-up-task',
    revision: 1,
    status: 'open',
    updatedAt: now,
  }));
  await assertFails(updateDoc(doc(customersAdmin, 'customerFollowUpTasks', 'follow-up-rules-task'), {
    status: 'completed',
  }));
  await assertFails(deleteDoc(doc(customersAdmin, 'customerFollowUpTasks', 'follow-up-rules-task')));
  await assertFails(setDoc(doc(customersAdmin, 'customerFollowUpEvents', 'forged-follow-up-event'), {
    action: 'created',
    actorName: 'Forged',
    actorUid: 'customers-admin',
    createdAt: now,
    customerId: 'customer-1',
    id: 'forged-follow-up-event',
    taskId: 'follow-up-rules-task',
  }));
  await assertFails(updateDoc(doc(customersAdmin, 'customerFollowUpEvents', 'follow-up-rules-event'), {
    note: 'Mutated history',
  }));
  await assertFails(deleteDoc(doc(customersAdmin, 'customerFollowUpEvents', 'follow-up-rules-event')));

  const bookkeeping = context('bookkeeping-admin', 'bookkeeping@example.com');
  await assertSucceeds(getDoc(doc(bookkeeping, 'cashClosingSessions', '2026-08-14__main')));
  await assertSucceeds(getDoc(doc(bookkeeping, 'cashClosingEvents', 'closing-event-1')));
  await assertSucceeds(getDoc(doc(bookkeeping, 'bookkeepingEntries', 'manual-closed-date')));
  await assertFails(updateDoc(doc(bookkeeping, 'cashClosingSessions', '2026-08-14__main'), { status: 'reopened' }));
  await assertFails(setDoc(doc(bookkeeping, 'cashClosingEvents', 'forged-closing-event'), {
    action: 'closed', actorName: 'Forged', actorUid: 'bookkeeping-admin', businessDate: '2026-08-14',
    closingId: '2026-08-14__main', createdAt: now, id: 'forged-closing-event', reason: '',
    registerId: 'main', revision: 2, type: 'cash-closing-event',
  }));
  await assertFails(updateDoc(doc(bookkeeping, 'bookkeepingEntries', 'manual-closed-date'), { title: 'Changed after close' }));
  await assertFails(deleteDoc(doc(bookkeeping, 'bookkeepingEntries', 'manual-closed-date')));
  await assertFails(setDoc(doc(bookkeeping, 'bookkeepingEntries', 'late-manual-entry'), {
    actorName: 'Bookkeeping Admin', actorUid: 'bookkeeping-admin', amount: 30000,
    category: 'Operational', createdAt: now, date: '2026-08-14', id: 'late-manual-entry',
    idempotencyKey: 'late-manual-entry', immutable: false, note: '', paymentMethod: 'cash',
    reversalOf: '', source: 'manual', title: 'Late expense', type: 'expense', updatedAt: now,
  }));
  // Browser-style direct journal writes must remain denied. A valid write
  // needs its journal, activity fence, and immutable operation marker in one batch.
  await assertFails(setDoc(doc(bookkeeping, 'bookkeepingEntries', 'manual-open-date-direct'), {
    actorName: 'Bookkeeping Admin', actorUid: 'bookkeeping-admin', amount: 30000,
    category: 'Operational', createdAt: now, date: '2026-08-15', id: 'manual-open-date-direct',
    idempotencyKey: 'manual-open-date-direct', immutable: false, note: '', paymentMethod: 'cash',
    reversalOf: '', source: 'manual', title: 'Open date expense', type: 'expense', updatedAt: now,
  }));

  const manualRequestId = 'manual-open-date-atomic-001';
  const manualAction = 'manual-create';
  const manualPayload = {
    amount: 30000,
    category: 'Operational',
    date: '2026-08-15',
    note: '',
    paymentMethod: 'cash',
    title: 'Open date expense',
    type: 'expense',
  };
  const manualOperationId = await createRepositoryOperationId({
    actorUid: 'bookkeeping-admin',
    scope: 'bookkeeping',
    action: manualAction,
    requestId: manualRequestId,
  });
  const manualPayloadHash = await createRepositoryPayloadHash(manualPayload);
  const manualEntryId = 'manual-open-date-atomic';
  const manualClosingId = '2026-08-15__main';
  const manualEntry = {
    actorName: 'Bookkeeping Admin',
    actorUid: 'bookkeeping-admin',
    ...manualPayload,
    createdAt: now,
    id: manualEntryId,
    idempotencyKey: manualRequestId,
    immutable: false,
    operationId: manualOperationId,
    reversalOf: '',
    source: 'manual',
    sourceAction: '',
    sourceAttendanceDate: '',
    sourceAttendanceId: '',
    sourceBookingId: '',
    sourceEventId: '',
    sourceFeeEntryId: '',
    sourceGuardPersonId: '',
    sourceProofId: '',
    sourceWorkOrderId: '',
    updatedAt: now,
  };
  const manualFence = {
    activityRevision: 1,
    businessDate: '2026-08-15',
    createdAt: now,
    id: manualClosingId,
    lastActivityAt: now,
    lastActivityByUid: 'bookkeeping-admin',
    lastBookingId: '',
    lastLedgerEntryId: manualEntryId,
    lastOperationAction: manualAction,
    lastOperationId: manualOperationId,
    lastProofId: '',
    registerId: 'main',
    status: 'open',
    updatedAt: now,
  };
  const manualOperationMarker = {
    action: manualAction,
    actorUid: 'bookkeeping-admin',
    createdAt: serverTimestamp(),
    operationId: manualOperationId,
    payloadHash: manualPayloadHash,
    requestId: manualRequestId,
    resultCollection: 'bookkeepingEntries',
    resultId: manualEntryId,
    scope: 'bookkeeping',
  };
  const manualWriteBatch = writeBatch(bookkeeping);
  manualWriteBatch.set(doc(bookkeeping, 'bookkeepingEntries', manualEntryId), manualEntry);
  manualWriteBatch.set(doc(bookkeeping, 'cashClosingSessions', manualClosingId), manualFence);
  manualWriteBatch.set(
    doc(bookkeeping, 'users', 'bookkeeping-admin', 'repositoryOperations', manualOperationId),
    manualOperationMarker,
  );
  await assertSucceeds(manualWriteBatch.commit());

  const schedule = context('schedule-admin', 'schedule@example.com');
  await assertSucceeds(getDoc(doc(schedule, 'bookingSessionEvents', 'session-event-1')));
  await assertFails(setDoc(doc(schedule, 'bookingSessionEvents', 'session-event-client-write'), {
    action: 'start', actorName: 'Schedule Admin', actorUid: 'schedule-admin', bookingId: 'booking-1',
    createdAt: now, fromStatus: 'upcoming', id: 'session-event-client-write', reason: '',
    toStatus: 'in_progress', type: 'booking-session-event',
  }));
  const safeBooking = {
    appliedDiscounts: [],
    bandName: '',
    bookingCode: 'BKG-SAFE-UNPAID',
    bookingId: 'BKG-SAFE-UNPAID',
    bookingRequestStatus: 'confirmed',
    clientUid: '',
    createdAt: now,
    customer: 'Safe',
    customerId: '',
    customerIdentityMode: '',
    customerPhoneKey: '',
    date: '2026-08-22',
    discountAmount: 0,
    dpAmount: 0,
    durationHours: 1,
    email: '',
    id: 'safe-unpaid',
    initialPaymentIntent: null,
    initialPaymentLedgerStatus: 'not_required',
    invoiceAmount: 500000,
    invoiceNumber: 'INV-SAFE-UNPAID',
    lastPaymentAt: '',
    lastPaymentMethod: '',
    packageId: 'none',
    packageLabel: '',
    paidAmount: 0,
    paymentHistory: [],
    paymentMethod: '',
    paymentStatus: 'pending',
    paymentStatusCanonical: 'unpaid',
    phone: '',
    pricingMode: 'session',
    recordingTypeId: '',
    recordingTypeLabel: '',
    refundHistory: [],
    refundedAmount: 0,
    sessionLabel: 'Rehearsal',
    sessionStatus: 'scheduled',
    sessionType: 'rehearsal',
    source: 'admin',
    startHour: 11,
    startTimeLabel: '11:00',
    status: 'pending',
    subtotal: 500000,
    title: 'Safe Booking',
    total: 500000,
    updatedAt: now,
  };
  const safeBookingBatch = writeBatch(schedule);
  safeBookingBatch.set(doc(schedule, 'bookings', 'safe-unpaid'), safeBooking);
  safeBookingBatch.set(doc(schedule, 'bookingScheduleDays', '2026-08-22'), {
    date: '2026-08-22', lastBookingId: 'safe-unpaid', revision: 1, updatedAt: now,
  });
  safeBookingBatch.set(doc(schedule, 'clientCalendarSlots', 'safe-unpaid'), {
    bookingId: 'safe-unpaid', date: '2026-08-22', durationHours: 1,
    sessionLabel: 'Rehearsal', startHour: 11, status: 'pending',
    title: 'Terisi', updatedAt: now,
  });
  console.log('[rules-behavior] commit safe unpaid booking + slot + day');
  await assertSucceeds(safeBookingBatch.commit());
  await assertSucceeds(getDoc(doc(schedule, 'bookingScheduleDays', '2026-08-22')));
  await assertSucceeds(getDoc(doc(schedule, 'clientCalendarSlots', 'safe-unpaid')));
  await assertFails(setDoc(doc(schedule, 'bookingScheduleDays', 'orphan-day'), {
    date: '2026-08-25', lastBookingId: 'missing-booking', revision: 1, updatedAt: now,
  }));
  await assertFails(setDoc(doc(schedule, 'clientCalendarSlots', 'orphan-slot'), {
    bookingId: 'orphan-slot', date: '2026-08-25', durationHours: 1,
    sessionLabel: 'Orphan', startHour: 10, status: 'pending', title: 'Terisi', updatedAt: now,
  }));

  const rescheduledAt = '2026-08-14T08:15:00.000Z';
  const rescheduleBatch = writeBatch(schedule);
  rescheduleBatch.update(doc(schedule, 'bookings', 'safe-unpaid'), {
    startHour: 12,
    startTimeLabel: '12:00',
    updatedAt: rescheduledAt,
  });
  rescheduleBatch.update(doc(schedule, 'bookingScheduleDays', '2026-08-22'), {
    lastBookingId: 'safe-unpaid',
    revision: 2,
    updatedAt: rescheduledAt,
  });
  rescheduleBatch.update(doc(schedule, 'clientCalendarSlots', 'safe-unpaid'), {
    startHour: 12,
    updatedAt: rescheduledAt,
  });
  console.log('[rules-behavior] commit atomic reschedule');
  await assertSucceeds(rescheduleBatch.commit());
  await assertFails(updateDoc(doc(schedule, 'bookings', 'safe-unpaid'), {
    startHour: 13,
    startTimeLabel: '13:00',
    updatedAt: '2026-08-14T08:20:00.000Z',
  }));

  const startedAt = '2026-08-14T08:30:00.000Z';
  const startEventId = 'session-safe-start';
  const startBatch = writeBatch(schedule);
  startBatch.update(doc(schedule, 'bookings', 'safe-unpaid'), {
    actualStartAt: startedAt,
    actualStartByName: 'Schedule Admin',
    actualStartByUid: 'schedule-admin',
    lastSessionEventAt: startedAt,
    lastSessionEventId: startEventId,
    lastSessionEventType: 'start',
    sessionStatus: 'in_progress',
    updatedAt: startedAt,
  });
  startBatch.set(doc(schedule, 'bookingSessionEvents', startEventId), {
    action: 'start',
    actorName: 'Schedule Admin',
    actorUid: 'schedule-admin',
    bookingId: 'safe-unpaid',
    createdAt: startedAt,
    fromStatus: 'upcoming',
    id: startEventId,
    reason: '',
    toStatus: 'in_progress',
    type: 'booking-session-event',
  });
  console.log('[rules-behavior] commit session start + event');
  await assertSucceeds(startBatch.commit());
  await assertSucceeds(getDoc(doc(schedule, 'bookingSessionEvents', startEventId)));
  await assertFails(updateDoc(doc(schedule, 'bookingSessionEvents', startEventId), { reason: 'Mutated' }));
  await assertFails(deleteDoc(doc(schedule, 'bookingSessionEvents', startEventId)));

  const completedAt = '2026-08-14T09:30:00.000Z';
  const completeEventId = 'session-safe-complete';
  const completeBatch = writeBatch(schedule);
  completeBatch.update(doc(schedule, 'bookings', 'safe-unpaid'), {
    actualDurationMinutes: 60,
    actualEndAt: completedAt,
    actualEndByName: 'Schedule Admin',
    actualEndByUid: 'schedule-admin',
    lastSessionEventAt: completedAt,
    lastSessionEventId: completeEventId,
    lastSessionEventType: 'complete',
    sessionStatus: 'completed',
    updatedAt: completedAt,
  });
  completeBatch.set(doc(schedule, 'bookingSessionEvents', completeEventId), {
    action: 'complete',
    actorName: 'Schedule Admin',
    actorUid: 'schedule-admin',
    bookingId: 'safe-unpaid',
    createdAt: completedAt,
    fromStatus: 'in_progress',
    id: completeEventId,
    reason: '',
    toStatus: 'completed',
    type: 'booking-session-event',
  });
  console.log('[rules-behavior] commit session completion + event');
  await assertSucceeds(completeBatch.commit());

  const noShowBooking = {
    ...safeBooking,
    bookingCode: 'BKG-SAFE-NO-SHOW',
    bookingId: 'BKG-SAFE-NO-SHOW',
    date: '2026-08-25',
    id: 'safe-no-show',
    invoiceNumber: 'INV-SAFE-NO-SHOW',
    startHour: 13,
    updatedAt: now,
  };
  const noShowCreateBatch = writeBatch(schedule);
  noShowCreateBatch.set(doc(schedule, 'bookings', 'safe-no-show'), noShowBooking);
  noShowCreateBatch.set(doc(schedule, 'bookingScheduleDays', '2026-08-25'), {
    date: '2026-08-25', lastBookingId: 'safe-no-show', revision: 1, updatedAt: now,
  });
  noShowCreateBatch.set(doc(schedule, 'clientCalendarSlots', 'safe-no-show'), {
    bookingId: 'safe-no-show', date: '2026-08-25', durationHours: 1,
    sessionLabel: 'Rehearsal', startHour: 13, status: 'pending', title: 'Terisi', updatedAt: now,
  });
  console.log('[rules-behavior] commit no-show booking creation');
  await assertSucceeds(noShowCreateBatch.commit());

  const noShowAt = '2026-08-25T07:30:00.000Z';
  const noShowEventId = 'session-safe-no-show';
  const noShowBatch = writeBatch(schedule);
  noShowBatch.update(doc(schedule, 'bookings', 'safe-no-show'), {
    lastSessionEventAt: noShowAt,
    lastSessionEventId: noShowEventId,
    lastSessionEventType: 'no_show',
    noShowAt,
    noShowByName: 'Schedule Admin',
    noShowByUid: 'schedule-admin',
    noShowReason: 'Client tidak hadir',
    sessionStatus: 'no_show',
    updatedAt: noShowAt,
  });
  noShowBatch.set(doc(schedule, 'bookingSessionEvents', noShowEventId), {
    action: 'no_show',
    actorName: 'Schedule Admin',
    actorUid: 'schedule-admin',
    bookingId: 'safe-no-show',
    createdAt: noShowAt,
    fromStatus: 'upcoming',
    id: noShowEventId,
    reason: 'Client tidak hadir',
    toStatus: 'no_show',
    type: 'booking-session-event',
  });
  console.log('[rules-behavior] commit no-show action + event');
  await assertSucceeds(noShowBatch.commit());

  const paidAt = '2026-08-24T08:00:00.000Z';
  const initialPayment = {
    actorName: 'Schedule Admin',
    actorUid: 'schedule-admin',
    amount: 100000,
    createdAt: paidAt,
    date: '2026-08-24',
    id: 'payment-safe-1',
    idempotencyKey: 'manual-create-safe-paid',
    method: 'cash',
    note: 'Pembayaran awal booking',
    source: 'manual-booking-create',
  };
  const safePaidBooking = {
    ...safeBooking,
    bookingCode: 'BKG-SAFE-PAID',
    bookingId: 'BKG-SAFE-PAID',
    createdAt: paidAt,
    date: '2026-08-24',
    dpAmount: 0,
    id: 'safe-paid',
    initialPaymentIntent: initialPayment,
    initialPaymentLedgerStatus: 'pending',
    invoiceAmount: 500000,
    invoiceNumber: 'INV-SAFE-PAID',
    lastPaymentAt: '',
    lastPaymentMethod: '',
    paidAmount: 0,
    paymentHistory: [],
    paymentMethod: '',
    paymentStatus: 'pending',
    paymentStatusCanonical: 'unpaid',
    sessionStatus: 'scheduled',
    startHour: 12,
    status: 'pending',
    updatedAt: paidAt,
  };
  const initialLedgerId = 'booking-payment-safe-paid-payment-safe-1';
  const paidBookingBatch = writeBatch(schedule);
  paidBookingBatch.set(doc(schedule, 'bookings', 'safe-paid'), safePaidBooking);
  paidBookingBatch.set(doc(schedule, 'bookingScheduleDays', '2026-08-24'), {
    date: '2026-08-24', lastBookingId: 'safe-paid', revision: 1, updatedAt: paidAt,
  });
  paidBookingBatch.set(doc(schedule, 'clientCalendarSlots', 'safe-paid'), {
    bookingId: 'safe-paid', date: '2026-08-24', durationHours: 1,
    sessionLabel: 'Rehearsal', startHour: 12, status: 'pending', title: 'Terisi', updatedAt: paidAt,
  });
  console.log('[rules-behavior] create paid booking + slot before initial ledger');
  await assertSucceeds(paidBookingBatch.commit());
  await assertFails(updateDoc(doc(schedule, 'bookings', 'safe-paid'), {
    initialPaymentLedgerStatus: 'recorded',
  }));

  const initialLedger = {
    actorName: 'Schedule Admin',
    actorUid: 'schedule-admin',
    amount: 100000,
    category: 'booking',
    createdAt: paidAt,
    date: '2026-08-24',
    id: initialLedgerId,
    idempotencyKey: 'manual-create-safe-paid',
    immutable: true,
    note: 'Pembayaran awal booking',
    paymentMethod: 'cash',
    reversalOf: '',
    source: 'booking-payment',
    sourceAction: 'payment',
    sourceBookingId: 'safe-paid',
    sourceEventId: 'payment-safe-1',
    title: 'Pembayaran INV-SAFE-PAID',
    type: 'income',
    updatedAt: paidAt,
  };
  const initialLedgerBatch = writeBatch(scheduleRecoveryAdmin);
  initialLedgerBatch.update(doc(scheduleRecoveryAdmin, 'bookings', 'safe-paid'), {
    dpAmount: 100000,
    initialPaymentLedgerStatus: 'recorded',
    invoiceAmount: 400000,
    lastPaymentAt: paidAt,
    lastPaymentMethod: 'cash',
    paidAmount: 100000,
    paymentHistory: [initialPayment],
    paymentMethod: 'cash',
    paymentStatus: 'dp',
    paymentStatusCanonical: 'partial',
    status: 'dp',
  });
  initialLedgerBatch.update(doc(scheduleRecoveryAdmin, 'clientCalendarSlots', 'safe-paid'), {
    status: 'dp',
  });
  initialLedgerBatch.set(doc(scheduleRecoveryAdmin, 'bookkeepingEntries', initialLedgerId), initialLedger);
  console.log('[rules-behavior] commit initial ledger + booking pending-to-recorded transition');
  await assertSucceeds(initialLedgerBatch.commit());
  await assertFails(updateDoc(doc(schedule, 'bookings', 'safe-paid'), { total: 400000 }));
  await assertFails(setDoc(doc(schedule, 'bookkeepingEntries', 'forged-booking-payment'), {
    actorName: 'Schedule Admin', actorUid: 'schedule-admin', amount: 100000,
    category: 'booking', createdAt: paidAt, date: '2026-08-24',
    id: 'forged-booking-payment', idempotencyKey: 'forged-payment', immutable: true,
    note: '', paymentMethod: 'cash', reversalOf: '', source: 'booking-payment',
    sourceAction: 'payment', sourceBookingId: 'safe-paid', sourceEventId: 'forged',
    title: 'Forged booking payment', type: 'income', updatedAt: paidAt,
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
  console.log('[rules-behavior] create client booking request');
  await assertSucceeds(setDoc(doc(client, 'bookings', 'client-safe'), {
    ...safeClientBooking,
    id: 'client-safe',
  }));
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'bookings', 'client-refunded'), {
      ...safeClientBooking,
      id: 'client-refunded',
      invoiceStatus: 'refunded',
      paymentStatus: 'refunded',
      paymentStatusCanonical: 'refunded',
    });
  });
  const proofMetadata = {
    adminNote: '',
    amount: 50000,
    bookingCode: 'BKG-CLIENT-SAFE',
    bookingId: 'client-safe',
    category: 'dp',
    clientNote: '',
    clientUid: 'client-1',
    createdAt: now,
    customer: 'Client',
    id: 'proof-metadata-open',
    invoiceNumber: 'INV-CLIENT-SAFE',
    method: 'transfer',
    payerName: 'Client Name',
    proofFileName: '',
    proofMimeType: '',
    proofPublicId: '',
    proofUrl: '',
    reviewDecision: '',
    reviewOperationId: '',
    reviewedAt: '',
    reviewedByName: '',
    reviewedByUid: '',
    status: 'pending',
    transactionReference: 'TXN-123456',
    updatedAt: now,
  };
  await assertSucceeds(setDoc(doc(client, 'paymentProofs', 'proof-metadata-open'), proofMetadata));
  await assertFails(setDoc(doc(client, 'paymentProofs', 'proof-metadata-refunded'), {
    ...proofMetadata,
    bookingId: 'client-refunded',
    id: 'proof-metadata-refunded',
  }));
  await assertFails(setDoc(doc(client, 'bookings', clientBooking.id), clientBooking));

  const decisionAt = '2026-08-14T08:45:00.000Z';
  const decisionKey = 'decision-client-safe';
  const decisionMessageId = 'request-' + decisionKey;
  const decisionNote = 'Approved for requested slot';
  const decisionBatch = writeBatch(schedule);
  decisionBatch.update(doc(schedule, 'bookings', 'client-safe'), {
    adminResponseAt: decisionAt,
    adminResponseBy: 'schedule-admin',
    adminResponseNote: decisionNote,
    bookingRequestStatus: 'confirmed',
    requestStatus: 'confirmed',
    lastRequestDecisionKey: decisionKey,
    lastMessageId: decisionMessageId,
    lastMessageAt: decisionAt,
    lastMessagePreview: decisionNote,
    lastMessageSenderRole: 'admin',
    lastMessageReadByAdmin: true,
    lastMessageReadByClient: false,
    updatedAt: decisionAt,
  });
  decisionBatch.set(doc(schedule, 'bookingMessages', decisionMessageId), {
    id: decisionMessageId,
    bookingId: 'client-safe',
    clientUid: 'client-1',
    senderUid: 'schedule-admin',
    senderRole: 'admin',
    senderName: 'Schedule Admin',
    text: decisionNote,
    type: 'status',
    createdAt: decisionAt,
    readByAdmin: true,
    readByClient: false,
  });
  decisionBatch.set(doc(schedule, 'bookingScheduleDays', '2026-08-23'), {
    date: '2026-08-23',
    lastBookingId: 'client-safe',
    revision: 1,
    updatedAt: decisionAt,
  });
  decisionBatch.set(doc(schedule, 'clientCalendarSlots', 'client-safe'), {
    bookingId: 'client-safe',
    date: '2026-08-23',
    durationHours: 1,
    sessionLabel: 'Sesi Studio',
    startHour: 13,
    status: 'pending',
    title: 'Sesi Studio',
    updatedAt: decisionAt,
  });
  console.log('[rules-behavior] commit admin decision + message + slot + day');
  await assertSucceeds(decisionBatch.commit());
  await assertSucceeds(getDoc(doc(schedule, 'bookingMessages', decisionMessageId)));
  await assertFails(updateDoc(doc(schedule, 'bookings', 'client-safe'), {
    paymentStatus: 'lunas',
    status: 'lunas',
  }));

  assert.equal(true, true);
  console.log('firestore-rules-behavior-test: PASS');
} finally {
  await environment.cleanup();
}
