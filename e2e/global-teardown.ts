/**
 * Removes everything a run created: uploaded objects in S3 first (the DB rows
 * hold the only pointer to them), then the database rows in FK-safe order.
 *
 * Scoped strictly to rows carrying the run's `E2E-<tag>` marker.
 */
import fs from 'node:fs';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { E2E_TAG, SEED_FILE, STORAGE_STATE_DIR } from './fixtures/accounts';
import { withDb } from './fixtures/db';

/** `https://host/bucket/submissions/KTP/123-abc-file.pdf` → the key part. */
function s3KeyFromUrl(url: string): string | null {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) return null;
  const marker = `/${bucket}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : url.slice(index + marker.length);
}

async function deleteUploadedObjects(urls: string[]) {
  if (urls.length === 0) return 0;
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.S3_BUCKET_NAME) return 0;

  const s3 = new S3Client({
    region: process.env.AWS_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  });

  let removed = 0;
  for (const url of urls) {
    const key = s3KeyFromUrl(url);
    if (!key) continue;
    try {
      await s3.send(
        new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key })
      );
      removed += 1;
    } catch (error) {
      console.warn(`[e2e] could not delete ${key} from S3:`, error);
    }
  }
  return removed;
}

export default async function globalTeardown() {
  const report: Record<string, number> = {};

  await withDb(async (client) => {
    const users = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email LIKE $1`,
      [`e2e-${E2E_TAG}-%@espptg.test`]
    );
    const userIds = users.rows.map((r) => Number(r.id));

    const villages = await client.query<{ id: string }>(
      `SELECT id FROM villages WHERE nama_desa LIKE $1`,
      [`E2E-${E2E_TAG}%`]
    );
    const villageIds = villages.rows.map((r) => Number(r.id));

    const submissionIds = villageIds.length
      ? (
          await client.query<{ id: string }>(
            `SELECT id FROM submissions WHERE "villageId" = ANY($1::bigint[])`,
            [villageIds]
          )
        ).rows.map((r) => Number(r.id))
      : [];

    const draftIds = userIds.length
      ? (
          await client.query<{ id: string }>(
            `SELECT id FROM submission_drafts WHERE user_id = ANY($1::bigint[])`,
            [userIds]
          )
        ).rows.map((r) => Number(r.id))
      : [];

    // Collect the storage URLs before the rows that point at them are deleted.
    const docUrls: string[] = [];
    if (submissionIds.length || draftIds.length) {
      const docs = await client.query<{ url: string }>(
        `SELECT url FROM submissions_documents
         WHERE ($1::bigint[] IS NOT NULL AND "submissionId" = ANY($1::bigint[]))
            OR ($2::bigint[] IS NOT NULL AND "draftId" = ANY($2::bigint[]))`,
        [submissionIds.length ? submissionIds : null, draftIds.length ? draftIds : null]
      );
      docUrls.push(...docs.rows.map((r) => r.url).filter(Boolean));
    }
    report.s3Objects = await deleteUploadedObjects(docUrls);

    const run = async (label: string, sql: string, params: unknown[]) => {
      const res = await client.query(sql, params);
      report[label] = res.rowCount ?? 0;
    };

    await client.query('BEGIN');
    try {
      if (submissionIds.length) {
        await run('comments', `DELETE FROM comments WHERE submission_id = ANY($1::bigint[])`, [submissionIds]);
        await run('statusHistory', `DELETE FROM status_history WHERE "submissionId" = ANY($1::bigint[])`, [submissionIds]);
        await run('overlaps', `DELETE FROM overlap_results WHERE "submissionId" = ANY($1::bigint[])`, [submissionIds]);
        await run('notifications', `DELETE FROM notifications WHERE submission_id = ANY($1::bigint[])`, [submissionIds]);
        await run('submissionDocs', `DELETE FROM submissions_documents WHERE "submissionId" = ANY($1::bigint[])`, [submissionIds]);
        await run('submissions', `DELETE FROM submissions WHERE id = ANY($1::bigint[])`, [submissionIds]);
      }
      if (draftIds.length) {
        await run('draftDocs', `DELETE FROM submissions_documents WHERE "draftId" = ANY($1::bigint[])`, [draftIds]);
        await run('drafts', `DELETE FROM submission_drafts WHERE id = ANY($1::bigint[])`, [draftIds]);
      }
      if (villageIds.length) {
        await run('notificationsByVillage', `DELETE FROM notifications WHERE village_id = ANY($1::bigint[])`, [villageIds]);
        await run('draftsByVillage', `DELETE FROM submission_drafts WHERE village_id = ANY($1::bigint[])`, [villageIds]);
      }
      if (userIds.length) {
        await run('sessions', `DELETE FROM sessions WHERE user_id = ANY($1::bigint[])`, [userIds]);
        await run('pushSubscriptions', `DELETE FROM push_subscriptions WHERE user_id = ANY($1::bigint[])`, [userIds]);
        // The actor rows are about to disappear, so these entries would only be
        // noise in the staging trail.
        await run('auditLogs', `DELETE FROM audit_logs WHERE actor_id = ANY($1::bigint[])`, [userIds]);
      }
      await run('kawasan', `DELETE FROM prohibited_areas WHERE nama_kawasan LIKE $1`, [`E2E-${E2E_TAG}%`]);
      if (userIds.length) {
        await run('users', `DELETE FROM users WHERE id = ANY($1::bigint[])`, [userIds]);
      }
      await run('villages', `DELETE FROM villages WHERE nama_desa LIKE $1`, [`E2E-${E2E_TAG}%`]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  fs.rmSync(STORAGE_STATE_DIR, { recursive: true, force: true });
  fs.rmSync(SEED_FILE, { force: true });

  const removed = Object.entries(report)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}=${count}`)
    .join(' ');
  console.log(`[e2e] cleanup: ${removed || 'nothing to remove'}`);
}
