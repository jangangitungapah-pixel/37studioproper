import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rulesSource = readFileSync(
  resolve('firestore.rules'),
  'utf8',
);

for (const required of [
  'function validGuardAttendanceOwnerReviewAuditFields()',
  'function validGuardAttendanceOwnerApprovePatch()',
  'function validGuardAttendanceOwnerRejectPatch()',
  'function validGuardAttendanceOwnerVoidPatch()',
  'function adminReviewsGuardAttendance()',
  'validGuardAttendanceOwnerApprovePatch() &&',
  'validGuardAttendanceOwnerRejectPatch() &&',
  'validGuardAttendanceOwnerVoidPatch() &&',
  'guardAttendanceCoreIdentityUnchanged() &&',
  'guardMealNotPosted(resource.data)',
  'allow update: if guardClosesOwnAttendance() ||\n        adminReviewsGuardAttendance() || (',
]) {
  assert.equal(
    rulesSource.includes(required),
    true,
    'Owner attendance review transition marker missing: ' + required,
  );
}

assert.equal(
  rulesSource.includes(
    'adminReviewsGuardAttendance() || (\n          validGuardAttendanceSession('
  ),
  false,
  'Approve/Reject/Void must not be blocked by unrelated legacy schema fields.',
);

assert.equal(
  rulesSource.includes(
    'validGuardAttendanceSession(\n            request.resource.data,\n            attendanceId\n          ) &&\n          adminPostsGuardMeal()'
  ),
  true,
  'Meal posting must keep full schema validation.',
);

for (const required of [
  "request.resource.data.approvalStatus == 'approved'",
  "request.resource.data.approvalStatus == 'rejected'",
  "request.resource.data.status == 'void'",
  "request.resource.data.status == 'rejected'",
  "request.resource.data.status == 'active'",
  "request.resource.data.status == 'closed'",
  "request.resource.data.ownerActionRequired == false",
  "request.resource.data.mealEligible == false",
]) {
  assert.equal(
    rulesSource.includes(required),
    true,
    'Owner attendance decision invariant missing: ' + required,
  );
}

for (const required of [
  "'approvalStatus'",
  "'approvedAt'",
  "'approvedByUid'",
  "'rejectedAt'",
  "'rejectedByUid'",
  "'rejectionReason'",
  "'voidedAt'",
  "'voidedByUid'",
  "'voidReason'",
  "'updatedAt'",
]) {
  assert.equal(
    rulesSource.includes(required),
    true,
    'Owner review mutable-field allowlist marker missing: ' + required,
  );
}

const repositorySource = readFileSync(
  resolve('src/services/guardAttendanceRepository.js'),
  'utf8',
);

for (const required of [
  'approveGuardAttendanceSession',
  'rejectGuardAttendanceSession',
  'voidGuardAttendanceSession',
  'await updateDoc(',
]) {
  assert.equal(
    repositorySource.includes(required),
    true,
    'Guard attendance repository transition marker missing: ' + required,
  );
}

const pageSource = readFileSync(
  resolve('src/pages/admin/GuardAttendancePage.jsx'),
  'utf8',
);

for (const required of [
  'approveGuardAttendanceSession(session, currentUser)',
  'rejectGuardAttendanceSession(session, currentUser, reason)',
  'voidGuardAttendanceSession(session, currentUser, reason)',
]) {
  assert.equal(
    pageSource.includes(required),
    true,
    'Owner attendance page transition marker missing: ' + required,
  );
}

process.stdout.write(
  '✅ Guard Attendance Owner review transition contract passed.\n',
);
