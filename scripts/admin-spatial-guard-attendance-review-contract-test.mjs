import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(
  resolve('src/pages/admin/GuardAttendancePage.jsx'),
  'utf8',
);
const modalSource = readFileSync(
  resolve('src/components/guard/GuardAttendanceApprovalModal.jsx'),
  'utf8',
);
const cssSource = readFileSync(
  resolve('src/styles/modules/guard-attendance.css'),
  'utf8',
);
const repositorySource = readFileSync(
  resolve('src/services/guardAttendanceRepository.js'),
  'utf8',
);
const guardPortalSource = readFileSync(
  resolve('src/pages/guard/GuardAttendancePage.jsx'),
  'utf8',
);
const mealPanelSource = readFileSync(
  resolve('src/components/operator-fee/GuardMealReconciliationPanel.jsx'),
  'utf8',
);
const adminPageSource = readFileSync(resolve('src/pages/AdminPage.jsx'), 'utf8');
const permissionSource = readFileSync(
  resolve('src/utils/adminPermissions.js'),
  'utf8',
);
const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

for (const required of [
  'data-guard-attendance-ui="ui-10-spatial"',
  'GuardReviewHeader',
  'GuardReviewPulse',
  'GuardReviewPriority',
  'GuardReviewToolbar',
  'GuardReviewLedger',
  'GuardReviewActionDialog',
  'guard-review-ledger-columns',
  'guard-review-priority-list',
  'guard-review-command-shelf',
  'StudioSelect',
  'PaginationControls',
  'ADMIN_LIST_PAGE_SIZE',
  'getPaginationSlice',
  'Dialog.Root',
  'Dialog.Overlay',
  'Dialog.Content',
  'data-guard-attendance-dialog-ui="ui-10-spatial"',
  "{ key: 'pending', label: 'Perlu Review' }",
  "{ key: 'approved', label: 'Approved' }",
  "{ key: 'rejected', label: 'Rejected' }",
  "{ key: 'void', label: 'Void' }",
  'Menyinkronkan attendance...',
  'Attendance belum berhasil dimuat',
  'Tidak ada attendance di filter ini',
]) {
  assert.equal(pageSource.includes(required), true, 'UI-10 page contract missing: ' + required);
}

for (const required of [
  'subscribeGuardAttendanceSessions(\n        {},',
  'approveGuardAttendanceSession(session, currentUser)',
  'rejectGuardAttendanceSession(session, currentUser, reason)',
  'voidGuardAttendanceSession(session, currentUser, reason)',
  "hasAdminPagePermission(currentUser, 'guard-attendance')",
  'GUARD_ATTENDANCE_STATUSES.VOID',
  'GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED',
  'if (isMealPosted)',
  'isApproved && !isMealPosted && !isVoid',
  'Uang makan sudah posted',
  'mealEligible',
  'mealAmount',
  'rejectionReason',
  'voidReason',
  'resetFilters',
  'filteredSessions',
  'pendingSessions',
]) {
  assert.equal(pageSource.includes(required), true, 'UI-10 preserved behavior missing: ' + required);
}

for (const forbidden of [
  'window.prompt',
  'updateDoc(',
  'writeBatch(',
  "collection(firestoreDb, 'guardAttendanceSessions')",
]) {
  assert.equal(
    pageSource.includes(forbidden),
    false,
    'UI-10 page must not bypass canonical repository or native prompt: ' + forbidden,
  );
}

for (const required of [
  'data-guard-attendance-modal-ui="ui-10-spatial"',
  'Dialog.Root',
  'Dialog.Overlay',
  'Dialog.Content',
  "'/admin/guard-attendance'",
  "'/admin/operations/guard-attendance'",
  'ADMIN_GUARD_ATTENDANCE_PATHS.includes(location.pathname)',
  'subscribeGuardAttendanceSessions(',
  'approvalStatus: GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING',
  'approveGuardAttendanceSession(activeSession, currentUser)',
  'rejectGuardAttendanceSession(activeSession, currentUser, rejectReason)',
  'guard-review-attention-reason',
]) {
  assert.equal(modalSource.includes(required), true, 'UI-10 approval modal missing: ' + required);
}

assert.equal(
  modalSource.includes('window.prompt'),
  false,
  'UI-10 approval modal must use an accessible inline reason field.',
);

for (const required of [
  "ACTIVE: 'active'",
  "CLOSED: 'closed'",
  "PENDING_APPROVAL: 'pending_approval'",
  "REJECTED: 'rejected'",
  "VOID: 'void'",
  "APPROVED: 'approved'",
  "PENDING: 'pending'",
  "NOT_POSTED: 'not_posted'",
  "POSTED: 'posted'",
  'assertGuardAttendanceCanApprove',
  'assertGuardAttendanceCanReject',
  'assertGuardAttendanceCanVoid',
  'approveGuardAttendanceSession',
  'rejectGuardAttendanceSession',
  'voidGuardAttendanceSession',
  'postGuardMealToBookkeeping',
  'buildGuardMealPostingPatch',
  'await batch.commit()',
  'Absen void tidak bisa di-approve.',
  'Absen tidak bisa ditolak karena uang makan sudah diposting.',
  'Absen tidak bisa di-void karena uang makan sudah diposting.',
  'Uang makan hanya bisa diposting dari attendance approved.',
  'Selesaikan shift penjaga sebelum posting uang makan.',
]) {
  assert.equal(repositorySource.includes(required), true, 'UI-10 lifecycle contract missing: ' + required);
}

for (const required of [
  'createGuardAttendanceCheckIn',
  'closeGuardAttendanceSession',
  'subscribeGuardAttendanceSessions',
  'GUARD_ATTENDANCE_STATUSES.ACTIVE',
]) {
  assert.equal(
    guardPortalSource.includes(required),
    true,
    'UI-10 must preserve guard self-service behavior: ' + required,
  );
}

for (const required of [
  'postGuardMealToBookkeeping',
  'GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED',
  'GUARD_ATTENDANCE_STATUSES.CLOSED',
  'GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED',
  'Post Semua Uang Makan',
  'Post Uang Makan',
]) {
  assert.equal(
    mealPanelSource.includes(required),
    true,
    'UI-10 must preserve meal reconciliation behavior: ' + required,
  );
}

for (const required of [
  'UI-10 — Spatial Guard Attendance Admin Review',
  ".guard-attendance-review[data-guard-attendance-ui='ui-10-spatial']",
  '.guard-review-editorial-header',
  '.guard-review-pulse',
  '.guard-review-priority',
  '.guard-review-command-shelf',
  '.guard-review-ledger-columns',
  '.guard-review-row.is-neutral',
  '.guard-review-status.is-danger',
  '.guard-review-lock-note.is-posted',
  '.guard-review-dialog-backdrop',
  '.guard-review-attention-backdrop',
  "html[data-admin-theme-active='true'][data-theme='dark']",
  '@media (max-width: 767px)',
  '@media (max-width: 520px)',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
]) {
  assert.equal(cssSource.includes(required), true, 'UI-10 CSS contract missing: ' + required);
}

assert.match(
  cssSource,
  /\.guard-review-editorial-header\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;/,
  'UI-10 desktop editorial header must share one vertical axis.',
);
assert.match(
  cssSource,
  /\.guard-review-filter-context\s*>\s*span\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*baseline;/,
  'UI-10 result context must remain aligned on one baseline.',
);
assert.match(
  cssSource,
  /@media \(max-width:\s*767px\)[\s\S]*?\.guard-review-row\s*\{[\s\S]*?grid-template-columns:\s*28px minmax\(0, 1fr\);/,
  'UI-10 attendance rows must collapse into readable mobile cards.',
);

const ui10Start = cssSource.indexOf('/* UI-10 — Spatial Guard Attendance Admin Review */');
const ui10End = cssSource.indexOf('\n.guard-shift-shell', ui10Start);
assert.notEqual(ui10Start, -1, 'UI-10 CSS boundary start missing.');
assert.notEqual(ui10End, -1, 'UI-10 CSS boundary end missing.');
const ui10Css = cssSource.slice(ui10Start, ui10End);

for (const token of [
  '--studio-surface-1',
  '--studio-surface-2',
  '--studio-surface-floating',
  '--studio-text-primary',
  '--studio-text-secondary',
  '--studio-text-tertiary',
  '--studio-edge-soft',
  '--studio-edge-normal',
  '--studio-accent',
  '--studio-accent-soft',
  '--studio-shadow-contact',
  '--studio-shadow-floating',
  '--studio-success',
  '--studio-warning',
  '--studio-danger',
  '--studio-info',
]) {
  assert.equal(ui10Css.includes(token), true, 'UI-10 semantic token missing: ' + token);
}

assert.equal(ui10Css.includes('--auth-'), false, 'UI-10 spatial layer must not depend on legacy auth tokens.');
assert.equal(/#[0-9a-f]{3,8}\b/i.test(ui10Css), false, 'UI-10 spatial layer must not add raw hex colors.');

assert.equal(
  adminPageSource.includes("if (activeKey === 'guard-attendance') return <GuardAttendancePage currentUser={currentUser} />;"),
  true,
  'UI-10 canonical AdminPage rendering contract missing.',
);
assert.equal(
  adminPageSource.includes("goTo('/admin/operations/guard-attendance')"),
  true,
  'UI-10 canonical admin route contract missing.',
);
assert.equal(
  permissionSource.includes("key: 'guard-attendance'"),
  true,
  'UI-10 permission key contract missing.',
);
assert.equal(
  packageJson.scripts.test.includes('admin-spatial-guard-attendance-review-contract-test.mjs'),
  true,
  'UI-10 npm test registration missing.',
);

process.stdout.write('✅ Admin Spatial Guard Attendance Review UI-10 contract passed.\n');
