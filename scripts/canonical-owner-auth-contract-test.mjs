import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const authSource = read('src/services/adminAuthRepository.js');
const permissionsSource = read('src/utils/adminPermissions.js');
const adminPageSource = read('src/pages/AdminPage.jsx');
const appSource = read('src/App.jsx');

assert.match(authSource, /isCanonicalOwnerIdentity/);
assert.match(authSource, /doc\(firestoreDb, 'adminControl', 'ownership'\)/);
assert.match(authSource, /ownershipSnapshotReady/);
assert.match(authSource, /Role Owner akun tidak cocok dengan ownership aktif/);
assert.match(authSource, /ownershipDocUnsubscribe\(\)/);
assert.match(permissionsSource, /user\.role === 'owner'\) return user\.isOwner !== false/);

assert.doesNotMatch(adminPageSource, /oneSignal|notificationSubscription/i);
assert.doesNotMatch(appSource, /oneSignal|NotificationPermissionWidget/i);

console.log('canonical-owner-auth-contract-test: PASS');
