import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rulesSource = readFileSync(
  resolve('firestore.rules'),
  'utf8',
);

function getGuardAttendanceUpdateRulesBlock(source) {
  const matchStart = source.indexOf(
    'match /guardAttendanceSessions/{attendanceId} {'
  );

  assert.notEqual(
    matchStart,
    -1,
    'Guard attendance Firestore match block must exist.',
  );

  const matchEnd = source.indexOf(
    '// <<< STUDIO37 GUARD ATTENDANCE RULES END',
    matchStart,
  );

  assert.notEqual(
    matchEnd,
    -1,
    'Guard attendance Firestore match block must have an end marker.',
  );

  const matchBlock = source.slice(matchStart, matchEnd);
  const updateStart = matchBlock.indexOf('allow update: if');

  assert.notEqual(
    updateStart,
    -1,
    'Guard attendance update rule must exist.',
  );

  const updateEnd = matchBlock.indexOf(
    'allow delete:',
    updateStart,
  );

  assert.notEqual(
    updateEnd,
    -1,
    'Guard attendance update rule must end before delete rule.',
  );

  return matchBlock.slice(updateStart, updateEnd);
}

const guardAttendanceUpdateRulesBlock =
  getGuardAttendanceUpdateRulesBlock(rulesSource);

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

const ownerReviewIndex =
  guardAttendanceUpdateRulesBlock.indexOf(
    'adminReviewsGuardAttendance()'
  );
const fullSchemaIndex =
  guardAttendanceUpdateRulesBlock.indexOf(
    'validGuardAttendanceSession('
  );
const mealPostingIndex =
  guardAttendanceUpdateRulesBlock.indexOf(
    'adminPostsGuardMeal()'
  );

assert.ok(
  ownerReviewIndex >= 0 &&
    fullSchemaIndex > ownerReviewIndex,
  'Approve/Reject/Void must be an independent OR branch before full-schema validation.',
);

assert.ok(
  mealPostingIndex > fullSchemaIndex,
  'Full-schema validation must only guard the subsequent meal-posting branch.',
);

assert.equal(
  (
    guardAttendanceUpdateRulesBlock.match(
      /validGuardAttendanceSession\(/g
    ) || []
  ).length,
  1,
  'Owner review update rule must contain exactly one full-schema validation branch.',
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
