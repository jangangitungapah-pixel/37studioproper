import assert from 'node:assert/strict';
import {
  defaultGuardPortalPermissions,
  adminPermissionPages,
  normalizeAdminPermissionsForRole,
} from '../src/utils/adminPermissions.js';
import {
  DEFAULT_OPERATOR_FEE_SETTINGS,
  OPERATOR_FEE_PERSON_ROLES,
  createEstimatedOperatorFeeLines,
} from '../src/settings/operatorFeeSettings.js';
import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  GUARD_ATTENDANCE_STATUSES,
  isGuardFeeLineEligibleByAttendance,
  normalizeGuardAttendanceSession,
} from '../src/services/guardAttendanceRepository.js';

const permissionKeys = adminPermissionPages.map((page) => page.key);

assert.ok(permissionKeys.includes('operator-fee'), 'operator-fee permission key harus terdaftar');
assert.ok(permissionKeys.includes('guard-attendance'), 'guard-attendance permission key harus terdaftar');
assert.equal(defaultGuardPortalPermissions['operator-fee'], false);
assert.equal(defaultGuardPortalPermissions['guard-attendance'], false);

const normalizedGuardPermissions = normalizeAdminPermissionsForRole({
  billing: true,
  customers: true,
  inventory: true,
  schedule: true,
  'guard-attendance': true,
  'operator-fee': true,
}, 'studio_guard');

assert.equal(normalizedGuardPermissions.schedule, true);
assert.equal(normalizedGuardPermissions.billing, true);
assert.equal(normalizedGuardPermissions.customers, true);
assert.equal(normalizedGuardPermissions.inventory, true);
assert.equal(normalizedGuardPermissions['operator-fee'], false);
assert.equal(normalizedGuardPermissions['guard-attendance'], false);

const guardPerson = DEFAULT_OPERATOR_FEE_SETTINGS.people.find((person) => person.role === OPERATOR_FEE_PERSON_ROLES.GUARD);
const booking = {
  bookingCode: 'BKG-TEST',
  date: '2026-06-23',
  durationHours: 2,
  id: 'booking-test',
  sessionId: 'rehearsal',
  sessionLabel: 'Rehearsal',
};
const feeLines = createEstimatedOperatorFeeLines({
  assignedPeopleByRole: {
    [OPERATOR_FEE_PERSON_ROLES.GUARD]: guardPerson,
  },
  booking,
  settings: DEFAULT_OPERATOR_FEE_SETTINGS,
});
const guardLine = feeLines.find((line) => line.payeeRole === OPERATOR_FEE_PERSON_ROLES.GUARD);

assert.ok(guardLine, 'booking rehearsal harus menghasilkan fee penjaga');
assert.equal(isGuardFeeLineEligibleByAttendance(guardLine, []), false);
assert.equal(isGuardFeeLineEligibleByAttendance({ payeeRole: OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR }, []), true);

const approvedSession = normalizeGuardAttendanceSession({
  approvalStatus: GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED,
  clockInAt: '2026-06-23T10:00:00.000Z',
  createdAt: '2026-06-23T10:00:00.000Z',
  date: booking.date,
  guardName: guardPerson.name,
  guardPersonId: guardPerson.id,
  guardUid: 'guard-uid',
  id: 'attendance-approved',
  mealEligible: true,
  status: GUARD_ATTENDANCE_STATUSES.ACTIVE,
  updatedAt: '2026-06-23T10:00:00.000Z',
});

assert.equal(isGuardFeeLineEligibleByAttendance(guardLine, [approvedSession]), true);

const rejectedSession = normalizeGuardAttendanceSession({
  ...approvedSession,
  approvalStatus: GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED,
  id: 'attendance-rejected',
  mealEligible: false,
  status: GUARD_ATTENDANCE_STATUSES.REJECTED,
});

assert.equal(isGuardFeeLineEligibleByAttendance(guardLine, [rejectedSession]), false);
