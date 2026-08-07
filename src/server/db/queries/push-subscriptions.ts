import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, type DBTransaction } from '../db';
import { pushSubscriptions, users, villages } from '../schema';

export type PushSubscriptionRecord = typeof pushSubscriptions.$inferSelect;

/**
 * Store (or refresh) one browser's push endpoint.
 *
 * Browsers hand out a new endpoint whenever the push service rotates it, and
 * the same endpoint can move between accounts on a shared device — so conflicts
 * update the row rather than being ignored.
 */
export async function upsertPushSubscription(
  data: {
    userId: number;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  },
  tx?: DBTransaction
) {
  const queryDb = tx || db;

  const [row] = await queryDb
    .insert(pushSubscriptions)
    .values(data)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: data.userId,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent ?? null,
        lastUsedAt: new Date(),
      },
    })
    .returning();

  return row;
}

/**
 * Turn notifications off for one browser. Scoped by user on purpose: an
 * endpoint is unguessable but it is still someone else's device address, and
 * nothing about this call needs to reach beyond the caller's own subscriptions.
 */
export async function deletePushSubscriptionForUser(
  userId: number,
  endpoint: string,
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  await queryDb
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    );
}

/** Drop endpoints the push service reported as gone (HTTP 404/410). */
export async function deletePushSubscriptionsByEndpoints(
  endpoints: string[],
  tx?: DBTransaction
) {
  if (endpoints.length === 0) return;
  const queryDb = tx || db;
  await queryDb
    .delete(pushSubscriptions)
    .where(inArray(pushSubscriptions.endpoint, endpoints));
}

export async function listPushSubscriptionsForUsers(
  userIds: number[],
  tx?: DBTransaction
): Promise<PushSubscriptionRecord[]> {
  if (userIds.length === 0) return [];
  const queryDb = tx || db;
  return queryDb
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds));
}

/** Whether this browser already has notifications switched on for this user. */
export async function hasPushSubscription(
  userId: number,
  endpoint: string,
  tx?: DBTransaction
): Promise<boolean> {
  const queryDb = tx || db;
  const rows = await queryDb
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Everyone who should hear about an event on one submission, mirroring the
 * scoping in `listNotificationsScoped` so a person is never pushed a
 * notification they cannot then open:
 *
 *  - the Viewer who owns the pengajuan,
 *  - Admin/Verifikator assigned to that desa,
 *  - Kecamatan users overseeing the desa's kecamatan,
 *  - every Superadmin.
 *
 * Deactivated accounts are skipped, and so is the actor — nobody needs a phone
 * buzz for something they just did themselves.
 */
export async function listNotificationRecipientUserIds(
  params: {
    villageId: number;
    ownerUserId: number | null;
    excludeUserId?: number | null;
  },
  tx?: DBTransaction
): Promise<number[]> {
  const queryDb = tx || db;

  const rows = await queryDb
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.status, 'Aktif'),
        sql`(
          ${users.peran} = 'Superadmin'
          OR (${users.peran} IN ('Admin', 'Verifikator') AND ${users.assignedVillageId} = ${params.villageId})
          OR (
            ${users.peran} = 'Kecamatan'
            AND LOWER(${users.assignedKecamatan}) = (
              SELECT LOWER(${villages.kecamatan}) FROM ${villages} WHERE ${villages.id} = ${params.villageId}
            )
          )
          ${params.ownerUserId != null ? sql`OR ${users.id} = ${params.ownerUserId}` : sql``}
        )`
      )
    );

  const ids = new Set(rows.map((row) => row.id));
  if (params.excludeUserId != null) ids.delete(params.excludeUserId);
  return [...ids];
}
