import {
  subscribeManualBookings,
} from './adminBookingRepository.js';
import {
  subscribeBookkeepingEntries,
} from './bookkeepingRepository.js';
import {
  subscribeGuardAttendanceSessions,
} from './guardAttendanceRepository.js';
import {
  subscribeInventoryItems,
} from './inventoryRepository.js';
import {
  subscribeOperatorFeeEntries,
} from './operatorFeeRepository.js';
import {
  hasAdminPagePermission,
  isOwnerAdminUser,
} from '../utils/adminPermissions.js';

const BOOKING_SURFACES = new Set([
  'dashboard',
  'requests',
  'schedule',
  'bookings',
  'customers',
  'billing',
]);

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim().slice(0, 180);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function createWindow(daysBefore = 90, daysAfter = 90) {
  const start = new Date();
  const end = new Date();
  start.setDate(start.getDate() - daysBefore);
  end.setDate(end.getDate() + daysAfter);

  return {
    endDate: dateKey(end),
    startDate: dateKey(start),
  };
}

function firstSnapshot(subscribe, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe = () => {};
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error('Waktu memuat konteks AI habis.'));
    }, timeoutMs);

    const complete = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.queueMicrotask(unsubscribe);
      callback(value);
    };

    try {
      unsubscribe = subscribe(
        (data) => complete(resolve, data),
        (error) => complete(reject, error),
      );
    } catch (error) {
      complete(reject, error);
    }
  });
}

function sanitizeBooking(booking) {
  return {
    date: cleanText(booking.date),
    durationHours: finiteNumber(booking.durationHours || booking.duration),
    paidAmount: finiteNumber(booking.paidAmount || booking.dpAmount),
    paymentStatus: cleanText(
      booking.paymentStatusCanonical || booking.paymentStatus || booking.statusPayment,
      'unpaid',
    ),
    requestStatus: cleanText(
      booking.bookingRequestStatus || booking.requestStatus,
      'unknown',
    ),
    sessionStatus: cleanText(
      booking.sessionStatus || booking.status,
      'unknown',
    ),
    service: cleanText(
      booking.sessionLabel || booking.packageLabel || booking.title,
      'Studio session',
    ),
    startHour: finiteNumber(booking.startHour),
    total: finiteNumber(booking.total),
  };
}

function sanitizeBookkeepingEntry(entry) {
  return {
    amount: finiteNumber(entry.amount || entry.totalAmount),
    category: cleanText(entry.category),
    date: cleanText(entry.date),
    direction: cleanText(entry.type || entry.direction),
    immutable: entry.immutable === true,
    source: cleanText(entry.source),
    status: cleanText(entry.status),
  };
}

function sanitizeInventoryItem(item) {
  const quantity = finiteNumber(item.quantity);
  const minimum = finiteNumber(item.minimumStock || item.minStock);

  return {
    category: cleanText(item.category),
    itemName: cleanText(item.itemName || item.name, 'Inventory item'),
    minimumStock: minimum,
    needsAttention: quantity <= minimum,
    quantity,
    status: cleanText(item.status),
    unit: cleanText(item.unit, 'pcs'),
  };
}

function sanitizeAttendance(session) {
  return {
    approvalStatus: cleanText(session.approvalStatus),
    clockInAt: cleanText(session.clockInAt),
    clockOutAt: cleanText(session.clockOutAt),
    date: cleanText(session.date),
    durationHours: finiteNumber(session.durationHours),
    guardName: cleanText(session.guardPersonName || session.guardName, 'Guard'),
    mealAmount: finiteNumber(session.mealAmount),
    status: cleanText(session.status),
  };
}

function sanitizeFeeEntry(entry) {
  return {
    amount: finiteNumber(entry.totalAmount || entry.amount),
    bookingDate: cleanText(entry.bookingDate),
    feeType: cleanText(entry.feeType || entry.type),
    postingStatus: cleanText(entry.postingStatus),
    reviewStatus: cleanText(entry.reviewStatus || entry.status),
  };
}

function summarizeBookings(bookings) {
  const today = dateKey(new Date());
  const rows = bookings.slice(0, 160).map(sanitizeBooking);

  return {
    count: rows.length,
    outstandingAmount: rows.reduce(
      (total, row) => total + Math.max(0, row.total - row.paidAmount),
      0,
    ),
    pendingRequests: rows.filter((row) => row.requestStatus === 'submitted').length,
    todayCount: rows.filter((row) => row.date === today).length,
    upcoming: rows
      .filter((row) => row.date >= today)
      .sort((first, second) => first.date.localeCompare(second.date) || first.startHour - second.startHour)
      .slice(0, 24),
    recent: rows.slice(0, 40),
  };
}

function summarizeBookkeeping(entries) {
  const rows = entries.slice(0, 150).map(sanitizeBookkeepingEntry);
  const income = rows
    .filter((entry) => ['income', 'in', 'credit', 'pemasukan'].includes(entry.direction.toLowerCase()))
    .reduce((total, entry) => total + entry.amount, 0);
  const expense = rows
    .filter((entry) => ['expense', 'out', 'debit', 'pengeluaran'].includes(entry.direction.toLowerCase()))
    .reduce((total, entry) => total + entry.amount, 0);

  return {
    count: rows.length,
    expense,
    income,
    net: income - expense,
    recent: rows.slice(0, 50),
  };
}

function summarizeInventory(items) {
  const rows = items.slice(0, 120).map(sanitizeInventoryItem);

  return {
    count: rows.length,
    items: rows,
    lowStockCount: rows.filter((item) => item.needsAttention).length,
  };
}

function summarizeAttendance(sessions) {
  const rows = sessions.slice(0, 120).map(sanitizeAttendance);

  return {
    approvedCount: rows.filter((row) => row.approvalStatus === 'approved').length,
    count: rows.length,
    pendingCount: rows.filter((row) => row.approvalStatus === 'pending').length,
    recent: rows.slice(0, 50),
    totalApprovedHours: rows
      .filter((row) => row.approvalStatus === 'approved')
      .reduce((total, row) => total + row.durationHours, 0),
  };
}

function summarizeFees(entries) {
  const rows = entries.slice(0, 120).map(sanitizeFeeEntry);

  return {
    count: rows.length,
    entries: rows.slice(0, 60),
    pendingReview: rows.filter((row) => row.reviewStatus === 'pending').length,
    totalAmount: rows.reduce((total, row) => total + row.amount, 0),
  };
}

function readNotificationSummary(summary) {
  return {
    failed: finiteNumber(summary?.failed),
    pending: finiteNumber(summary?.pending),
    processing: finiteNumber(summary?.processing),
    status: cleanText(summary?.status),
    total: finiteNumber(summary?.total),
  };
}

export async function loadAdminAiContext({
  notificationSummary,
  surface,
  user,
}) {
  const owner = isOwnerAdminUser(user);
  const context = {
    activeSurface: cleanText(surface),
    modules: {},
    notificationSummary: readNotificationSummary(notificationSummary),
    permissionScope: owner ? 'owner-all' : 'admin-explicit',
  };
  const tasks = [];
  const windowRange = createWindow();

  const wantsBookings = BOOKING_SURFACES.has(surface) || (owner && surface === 'dashboard');
  const wantsBookkeeping = surface === 'bookkeeping' || (owner && surface === 'dashboard');
  const wantsInventory = surface === 'inventory' || (owner && surface === 'dashboard');
  const wantsAttendance = surface === 'guard-attendance' || (owner && surface === 'dashboard');
  const wantsFees = surface === 'operator-fee' || (owner && surface === 'dashboard');

  if (wantsBookings && ['dashboard', 'schedule', 'customers', 'billing'].some(
    (permission) => hasAdminPagePermission(user, permission),
  )) {
    tasks.push(
      firstSnapshot((resolve, reject) => subscribeManualBookings(
        {
          ...windowRange,
          limitCount: 160,
        },
        resolve,
        reject,
      )).then((bookings) => {
        context.modules.bookings = summarizeBookings(bookings);
      }),
    );
  }

  if (wantsBookkeeping && hasAdminPagePermission(user, 'bookkeeping')) {
    tasks.push(
      firstSnapshot((resolve, reject) => subscribeBookkeepingEntries(
        {
          startDate: windowRange.startDate,
          limitCount: 150,
        },
        resolve,
        reject,
      )).then((entries) => {
        context.modules.bookkeeping = summarizeBookkeeping(entries);
      }),
    );
  }

  if (wantsInventory && hasAdminPagePermission(user, 'inventory')) {
    tasks.push(
      firstSnapshot((resolve, reject) => subscribeInventoryItems(
        { limitCount: 120 },
        resolve,
        reject,
      )).then((items) => {
        context.modules.inventory = summarizeInventory(items);
      }),
    );
  }

  if (wantsAttendance && hasAdminPagePermission(user, 'guard-attendance')) {
    tasks.push(
      firstSnapshot((resolve, reject) => subscribeGuardAttendanceSessions(
        {},
        resolve,
        reject,
      )).then((sessions) => {
        context.modules.guardAttendance = summarizeAttendance(sessions);
      }),
    );
  }

  if (wantsFees && hasAdminPagePermission(user, 'operator-fee')) {
    tasks.push(
      firstSnapshot((resolve, reject) => subscribeOperatorFeeEntries(
        resolve,
        reject,
      )).then((entries) => {
        context.modules.operatorFees = summarizeFees(entries);
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  context.contextWarnings = results
    .filter((result) => result.status === 'rejected')
    .map((result) => cleanText(result.reason?.message, 'Modul gagal dimuat'))
    .slice(0, 5);
  context.loadedModules = Object.keys(context.modules);

  return context;
}
