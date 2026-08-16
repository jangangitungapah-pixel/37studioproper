import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const firebaseSource = read('src/lib/firebase.js');
const aiServiceSource = read('src/services/firebaseAiService.js');
const contextServiceSource = read('src/services/roleAiContextService.js');
const safeContextSource = read('src/utils/roleAiContext.js');
const assistantSource = read('src/components/ai/RoleAiAssistant.jsx');
const clientSource = read('src/pages/ClientPortalPage.jsx');
const publicBookingSource = read('src/pages/PublicBookingPage.jsx');
const guardSource = read('src/pages/guard/GuardAttendancePage.jsx');
const adminSource = read('src/pages/AdminPage.jsx');

assert.match(firebaseSource, /initializeAppCheck/);
assert.match(firebaseSource, /ReCaptchaEnterpriseProvider/);
assert.match(firebaseSource, /VITE_FIREBASE_APPCHECK_SITE_KEY/);

assert.match(aiServiceSource, /from 'firebase\/ai'/);
assert.match(aiServiceSource, /GoogleAIBackend/);
assert.match(aiServiceSource, /useLimitedUseAppCheckTokens/);
assert.match(aiServiceSource, /getRemoteConfig/);
assert.match(aiServiceSource, /studio37_ai_model/);
assert.match(aiServiceSource, /gemini-3\.7-flash/);
assert.match(aiServiceSource, /generateContentStream/);
assert.match(aiServiceSource, /isRetryableAiError/);
assert.match(aiServiceSource, /responseMimeType: 'application\/json'/);
assert.match(aiServiceSource, /responseSchema: briefSchema/);
assert.match(aiServiceSource, /image\/jpeg/);
assert.match(aiServiceSource, /7 \* 1024 \* 1024/);

for (const forbiddenWrite of [
  'addDoc(',
  'setDoc(',
  'updateDoc(',
  'deleteDoc(',
  'writeBatch(',
  'runTransaction(',
]) {
  assert.equal(
    aiServiceSource.includes(forbiddenWrite),
    false,
    `AI service must stay read-only: ${forbiddenWrite}`,
  );
}

assert.match(contextServiceSource, /hasAdminPagePermission/);
assert.match(contextServiceSource, /isOwnerAdminUser/);
assert.match(contextServiceSource, /Promise\.allSettled/);
assert.match(safeContextSource, /tanpa email, telepon, UID, atau URL bukti pembayaran/);
assert.doesNotMatch(safeContextSource, /\.email|phoneNumber|proofUrl/);

assert.match(assistantSource, /role="dialog"/);
assert.match(assistantSource, /AI dapat keliru/);
assert.match(assistantSource, /Firebase App Check menolak koneksi AI/);
assert.match(assistantSource, /Model AI sedang padat untuk sementara/);
assert.match(assistantSource, /accept="image\/jpeg,image\/png,image\/webp"/);
assert.match(assistantSource, /Buat briefing otomatis/);

assert.match(clientSource, /role="client"/);
assert.match(publicBookingSource, /surface="public-booking"/);
assert.match(publicBookingSource, /Konteks publik tanpa identitas pengunjung/);
assert.match(guardSource, /role=\{isOwnerOversight \? 'owner' : 'guard'\}/);
assert.match(adminSource, /isOwnerAdminUser\(authState\.user\) \? 'owner' : 'admin'/);
assert.match(adminSource, /loadAdminAiContext/);

console.log('firebase-ai-role-copilot-contract-test: PASS');
