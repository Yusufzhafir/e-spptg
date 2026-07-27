import { and, eq, isNull } from 'drizzle-orm';
import { UserRole, UserStatus } from '@/types';
import { db, DBTransaction } from '../db';
import { users } from '../schema';


export async function getUserByClerkId(clerkUserId: string, tx?: DBTransaction) {
  const queryDb = tx || db;
  return queryDb.query.users.findFirst({
    where: eq(
      users.clerkUserId, clerkUserId
    )
  })
}

/** Any user with this email, regardless of link state. Used for dedup checks. */
export async function getUserByEmail(email: string, tx?: DBTransaction) {
  const queryDb = tx || db;
  return queryDb.query.users.findFirst({
    where: eq(users.email, email),
  });
}

/**
 * A user that was pre-registered from the app (no Clerk account linked yet)
 * whose email matches. Used to link the row on first Clerk login.
 */
export async function getPendingUserByEmail(email: string, tx?: DBTransaction) {
  const queryDb = tx || db;
  return queryDb.query.users.findFirst({
    where: and(eq(users.email, email), isNull(users.clerkUserId)),
  });
}

/** Link a pre-registered app user to a Clerk account on first login. */
export async function linkClerkAccount(
  id: number,
  clerkUserId: string,
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const result = await queryDb
    .update(users)
    .set({ clerkUserId, terakhirMasuk: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return result[0];
}

export async function getUserById(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  return queryDb.query.users.findFirst(
    {
      where : eq(users.id, id)
    }
  );
}

export async function createUser(data: {
  clerkUserId?: string | null;
  email: string;
  nama: string;
  nipNik: string;
  peran?: UserRole;
  assignedVillageId?: number | null;
  assignedKecamatan?: string | null;
  nomorHP?: string;
  status?: UserStatus;
}, tx?: DBTransaction) {
  const queryDb = tx || db;

  const result = await queryDb
    .insert(users)
    .values({
      clerkUserId: data.clerkUserId ?? null,
      email: data.email,
      nama: data.nama,
      nipNik: data.nipNik,
      peran: data.peran || 'Viewer',
      assignedVillageId: data.assignedVillageId ?? null,
      assignedKecamatan: data.assignedKecamatan ?? null,
      status: data.status || 'Aktif',
      nomorHP: data.nomorHP || null,
    })
    .returning();

  return result[0];
}

/** Record the user's last login time. */
export async function touchUserLastLogin(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  await queryDb
    .update(users)
    .set({ terakhirMasuk: new Date() })
    .where(eq(users.id, id));
}

export async function listUsers(limit = 50, offset = 0, tx?: DBTransaction) {
  const queryDb = tx || db;

  return queryDb.query.users.findMany({
    limit,
    offset,
  });
}

/** Users scoped to a single desa (for Admin/Verifikator visibility). */
export async function listUsersByVillage(
  villageId: number,
  limit = 50,
  offset = 0,
  tx?: DBTransaction
) {
  const queryDb = tx || db;

  return queryDb.query.users.findMany({
    where: eq(users.assignedVillageId, villageId),
    limit,
    offset,
  });
}

export async function updateUser(
  id: number,
  data: Partial<typeof users.$inferInsert>,
  tx?: DBTransaction
) {
  const queryDb = tx || db;

  const result = await queryDb
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  return result[0];
}
