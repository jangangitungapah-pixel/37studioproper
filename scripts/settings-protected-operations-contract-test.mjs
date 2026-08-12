import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(resolve('src/pages/admin/SettingsPage.jsx'), 'utf8');
const authSource = readFileSync(resolve('src/services/adminAuthRepository.js'), 'utf8');
const operationsSource = readFileSync(resolve('src/services/adminOperationsRepository.js'), 'utf8');
const feeSettingsSource = readFileSync(resolve('src/settings/operatorFeeSettings.js'), 'utf8');

for (const marker of [
  "new URLSearchParams(location.search).get('area')",
  "nextSearch.set('area', safeArea)",
  'search: `?${nextSearch.toString()}`',
  'requestedSettingsArea === resolvedActiveSubpage',
  "enabled: isOwner && resolvedActiveSubpage === 'user-settings'",
]) {
  assert.equal(pageSource.includes(marker), true, `Settings URL/access contract missing: ${marker}`);
}

for (const marker of [
  'adminOperationsRepository.createDangerZoneDryRun(',
  'adminOperationsRepository.startDangerZoneJob({',
  'adminOperationsRepository.stepDangerZoneJob(',
  'adminOperationsRepository.getDangerZoneJob(',
  'dangerJobIdFromUrl',
  'dangerEnvironment.projectId',
  'dangerEnvironment.environment',
  'dangerTotalPreserved',
  'dangerEnvironment.externalData?.firebaseAuthUsers',
  'dangerEnvironment.externalData?.cloudinaryFiles',
  'dangerConfirmText !== DANGER_ZONE_CONFIRM_TEXT',
  'finalConfirmation: dangerFinalCheck',
]) {
  assert.equal(pageSource.includes(marker), true, `Danger Zone server contract missing: ${marker}`);
}

assert.equal(pageSource.includes('getDocs(collection(firestoreDb'), false, 'Danger Zone must not enumerate Firestore from the browser.');
assert.equal(pageSource.includes('deleteDangerZoneCollection'), false, 'Danger Zone client delete loop must be removed.');
assert.equal(pageSource.includes('writeBatch(firestoreDb)'), false, 'Ownership transfer must not use a client Firestore batch.');

for (const marker of [
  'adminAuthRepository.reauthenticateCurrentAdmin({',
  'adminOperationsRepository.transferOwnership({',
  'autoComplete="current-password"',
  'type="password"',
  "setSensitiveCurrentPassword('')",
]) {
  assert.equal(pageSource.includes(marker), true, `Sensitive operation UI contract missing: ${marker}`);
}

for (const marker of [
  'export async function reauthenticateCurrentAdmin',
  'EmailAuthProvider.credential(cleanEmail, cleanPassword)',
  'reauthenticateWithPopup(currentUser, createGoogleProvider())',
  'currentUser.getIdToken(true)',
]) {
  assert.equal(authSource.includes(marker), true, `Fresh auth contract missing: ${marker}`);
}

for (const marker of [
  "'/v1/accounts/transfer-ownership'",
  "'/v1/danger-zone/dry-run'",
  "'/v1/danger-zone/jobs'",
  '/step`',
]) {
  assert.equal(operationsSource.includes(marker), true, `Admin Operations API contract missing: ${marker}`);
}

for (const marker of [
  'export function useOperatorFeeSettings({ enabled = true } = {})',
  'enabled ? hydrateOperatorFeeSettingsCache() : null',
  'if (!enabled) return undefined',
  'return enabled ? settings : null',
  'unsubscribeRemoteOperatorFeeSettings()',
]) {
  assert.equal(feeSettingsSource.includes(marker), true, `Owner fee access contract missing: ${marker}`);
}

console.log('settings-protected-operations-contract-test: PASS');
