import { and, desc, eq, sql } from 'drizzle-orm';
import { db, type DBTransaction } from '../db';
import { notifications } from '../schema';
import type { StatusSPPTG } from '@/types';

export async function createNotification(
  data: {
    submissionId: number;
    type: 'created' | 'updated';
    status: StatusSPPTG;
    namaPemilik: string;
    villageId: number;
    ownerUserId: number | null;
    actorUserId: number | null;
  },
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const [row] = await queryDb.insert(notifications).values(data).returning();
  return row;
}

/**
 * List notifications scoped by role:
 *  - Superadmin: everything
 *  - Admin/Verifikator: submissions in their assigned village
 *  - Viewer: submissions they own (submitted)
 */
export async function listNotificationsScoped(
  scope: {
    role: 'Superadmin' | 'Admin' | 'Verifikator' | 'Kecamatan' | 'Viewer';
    userId: number;
    assignedVillageId?: number | null;
    assignedKecamatan?: string | null;
  },
  limit = 30,
  tx?: DBTransaction
) {
  const queryDb = tx || db;

  const conditions = [];
  if (scope.role === 'Viewer') {
    conditions.push(eq(notifications.ownerUserId, scope.userId));
  } else if (scope.role === 'Kecamatan') {
    // Notifications carry a villageId, so resolve the kecamatan through villages.
    if (!scope.assignedKecamatan?.trim()) return [];
    conditions.push(
      sql`${notifications.villageId} IN (
        SELECT id FROM villages WHERE LOWER(kecamatan) = LOWER(${scope.assignedKecamatan.trim()})
      )`
    );
  } else if (scope.role !== 'Superadmin') {
    if (scope.assignedVillageId == null) return [];
    conditions.push(eq(notifications.villageId, scope.assignedVillageId));
  }

  return queryDb
    .select()
    .from(notifications)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
