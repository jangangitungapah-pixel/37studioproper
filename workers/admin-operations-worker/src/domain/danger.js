import { HttpError, cleanText, getIdempotencyKey } from '../lib/http.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';
import { stableDocumentId } from '../lib/firestore.js';

const CONFIRMATION_PHRASE = 'HAPUS DATA 37 STUDIO';
const DRY_RUN_TTL_MS = 15 * 60 * 1000;
const DELETE_BATCH_SIZE = 200;
const COUNT_SAFETY_LIMIT = 50_000;

export const DANGER_COLLECTIONS = Object.freeze([
  ['bookings', 'Booking & invoice'],
  ['paymentProofs', 'Bukti pembayaran'],
  ['bookingMessages', 'Pesan booking'],
  ['clientCalendarSlots', 'Slot kalender client'],
  ['customers', 'Customer profile'],
  ['bookkeepingEntries', 'Pembukuan'],
  ['operatorFeeEntries', 'Operator fee'],
  ['guardAttendanceSessions', 'Guard attendance'],
  ['inventoryItems', 'Inventory items'],
  ['inventoryMovements', 'Inventory movements'],
  ['gallery', 'Gallery metadata'],
  ['notificationEvents', 'Notification events'],
  ['notificationEventAudits', 'Notification audit'],
  ['notificationSubscriptions', 'Notification subscriptions legacy'],
  ['notificationSubscriptionDevices', 'Notification subscription devices'],
  ['mail', 'Mail queue'],
  ['settings', 'Remote app settings'],
  ['users', 'Admin/client account docs'],
]);

function environmentInfo(env, firestore) {
  return {
    environment: cleanText(env.APP_ENVIRONMENT || 'unknown', 40),
    projectId: firestore.projectId,
  };
}

async function countCollection(firestore, collectionId, ownerUid) {
  let count = 0;
  let pageToken = '';
  let preserved = 0;
  let truncated = false;

  do {
    const page = await firestore.listDocuments(collectionId, { pageSize: 500, pageToken });
    for (const document of page.documents) {
      if (collectionId === 'users') preserved += 1;
      else count += 1;
    }
    pageToken = page.nextPageToken;
    if (count + preserved >= COUNT_SAFETY_LIMIT) {
      truncated = Boolean(pageToken);
      break;
    }
  } while (pageToken);

  return { count, preserved, truncated };
}

export async function createDangerDryRun({ actor, body, env, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'danger-dry-run', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const collectionRows = [];
  for (const [collectionId, label] of DANGER_COLLECTIONS) {
    const estimate = await countCollection(firestore, collectionId, actor.uid);
    collectionRows.push({ collectionId, label, ...estimate });
  }

  const createdAt = new Date().toISOString();
  const snapshotId = await stableDocumentId('dryrun', `${actor.uid}:${key}`);
  const result = {
    ...environmentInfo(env, firestore),
    collections: collectionRows,
    createdAt,
    externalData: {
      cloudinaryFiles: 'retained',
      firebaseAuthUsers: 'retained',
    },
    expiresAt: new Date(Date.now() + DRY_RUN_TTL_MS).toISOString(),
    ownerUid: actor.uid,
    snapshotId,
    totalDocuments: collectionRows.reduce((sum, row) => sum + row.count, 0),
  };
  const committed = await commitIdempotentOperation({
    actor,
    firestore,
    key,
    result,
    targetId: snapshotId,
    type: 'danger-dry-run',
    writes: [
      firestore.setWrite('adminOperationDryRuns', snapshotId, result, { exists: false }),
    ],
  });

  return { ...committed.result, duplicate: committed.duplicate };
}

function assertDangerConfirmation(body) {
  if (String(body.confirmationPhrase || '') !== CONFIRMATION_PHRASE || body.finalConfirmation !== true) {
    throw new HttpError(
      400,
      'confirmation_required',
      'Phrase konfirmasi dan checkbox final wajib cocok.',
    );
  }
}

export async function startDangerJob({ actor, body, env, firestore, request }) {
  assertDangerConfirmation(body);
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'danger-start', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const snapshotId = cleanText(body.snapshotId, 160);
  const dryRunDocument = await firestore.getDocument('adminOperationDryRuns', snapshotId);
  const dryRun = dryRunDocument?.data;
  const currentEnvironment = environmentInfo(env, firestore);
  if (!dryRun || dryRun.ownerUid !== actor.uid) {
    throw new HttpError(409, 'dry_run_required', 'Jalankan dry-run baru sebelum reset.');
  }
  if (
    Date.parse(dryRun.expiresAt || '') <= Date.now() ||
    dryRun.projectId !== currentEnvironment.projectId ||
    dryRun.environment !== currentEnvironment.environment
  ) {
    throw new HttpError(409, 'dry_run_expired', 'Dry-run sudah kedaluwarsa atau environment berubah.');
  }

  const now = new Date().toISOString();
  const jobId = await stableDocumentId('danger', `${actor.uid}:${key}`);
  const collections = (Array.isArray(dryRun.collections) ? dryRun.collections : []).map((row) => ({
    collectionId: row.collectionId,
    deleted: 0,
    error: '',
    estimated: Number(row.count || 0),
    label: row.label,
    preserved: Number(row.preserved || 0),
    status: Number(row.count || 0) > 0 ? 'pending' : 'empty',
  }));
  const job = {
    ...currentEnvironment,
    actorName: actor.displayName,
    actorUid: actor.uid,
    collections,
    createdAt: now,
    dryRunSnapshotId: snapshotId,
    externalData: dryRun.externalData,
    id: jobId,
    status: collections.some((row) => row.status === 'pending') ? 'queued' : 'completed',
    totalDeleted: 0,
    updatedAt: now,
  };
  const result = { job };
  const committed = await commitIdempotentOperation({
    actor,
    firestore,
    key,
    result,
    targetId: jobId,
    type: 'danger-start',
    writes: [firestore.setWrite('adminOperationJobs', jobId, job, { exists: false })],
  });

  return { ...committed.result, duplicate: committed.duplicate };
}

export async function readDangerJob({ actor, firestore, jobId }) {
  const document = await firestore.getDocument('adminOperationJobs', cleanText(jobId, 160));
  if (!document || document.data.actorUid !== actor.uid) {
    throw new HttpError(404, 'job_not_found', 'Danger Zone job tidak ditemukan.');
  }
  return { job: document.data };
}

export async function runDangerJobStep({ actor, body, firestore, jobId, request }) {
  const key = getIdempotencyKey(request, body);
  const type = `danger-step:${cleanText(jobId, 160)}`;
  const existing = await readOperationResult(firestore, type, key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const jobDocument = await firestore.getDocument('adminOperationJobs', cleanText(jobId, 160));
  if (!jobDocument || jobDocument.data.actorUid !== actor.uid) {
    throw new HttpError(404, 'job_not_found', 'Danger Zone job tidak ditemukan.');
  }
  const job = jobDocument.data;
  if (job.status === 'completed') return { duplicate: true, job };

  const rows = Array.isArray(job.collections) ? job.collections.map((row) => ({ ...row })) : [];
  const activeIndex = rows.findIndex((row) => ['pending', 'running'].includes(row.status));
  const now = new Date().toISOString();
  const writes = [];

  if (activeIndex >= 0) {
    const row = rows[activeIndex];
    const page = await firestore.listDocuments(row.collectionId, { pageSize: DELETE_BATCH_SIZE });
    const deletable = page.documents.filter((document) => !(
      row.collectionId === 'users'
    ));

    if (deletable.length) {
      for (const document of deletable) {
        writes.push(firestore.deleteWrite(row.collectionId, document.id, { updateTime: document.updateTime }));
      }
      row.deleted = Number(row.deleted || 0) + deletable.length;
      row.status = 'running';
    } else {
      row.status = Number(row.deleted || 0) > 0 ? 'done' : 'empty';
    }
    rows[activeIndex] = row;
  }

  const hasRemaining = rows.some((row) => ['pending', 'running'].includes(row.status));
  const nextJob = {
    ...job,
    collections: rows,
    status: hasRemaining ? 'running' : 'completed',
    totalDeleted: rows.reduce((sum, row) => sum + Number(row.deleted || 0), 0),
    updatedAt: now,
  };
  writes.push(firestore.setWrite(
    'adminOperationJobs',
    jobDocument.id,
    nextJob,
    { updateTime: jobDocument.updateTime },
  ));
  const result = { job: nextJob };
  const committed = await commitIdempotentOperation({
    actor,
    firestore,
    key,
    result,
    targetId: jobDocument.id,
    type,
    writes,
  });

  return { ...committed.result, duplicate: committed.duplicate };
}
