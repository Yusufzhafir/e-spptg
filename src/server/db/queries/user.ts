import { eq, sql } from 'drizzle-orm';
import { UserRole, UserStatus } from '@/types';
import { db, DBTransaction } from '../db';
import { users } from '../schema';

/**
 * Look a user up by their login identifier. Emails are compared
 * case-insensitively — people type "Budi@Pemda.go.id" and expect to get in —
 * while the stored value keeps whatever casing they registered with.
 */
export async function getUserByEmail(email: string, tx?: DBTransaction) {
  const queryDb = tx || db;
  return queryDb.query.users.findFirst({
    where: sql`lower(${users.email}) = lower(${email})`,
  });
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
  email: string;
  nama: string;
  nipNik: string;
  /** scrypt digest; null for accounts that must set one via the reset email. */
  passwordHash?: string | null;
  peran?: UserRole;
  assignedVillageId?: number | null;
  assignedKecamatan?: string | null;
  nomorHP?: string;
  status?: UserStatus;
  /**
   * Set for accounts an admin creates (the admin vouches for the address);
   * left null by self-registration, which must prove the address first.
   */
  emailVerifiedAt?: Date | null;
}, tx?: DBTransaction) {
  const queryDb = tx || db;

  const result = await queryDb
    .insert(users)
    .values({
      email: data.email,
      nama: data.nama,
      nipNik: data.nipNik,
      passwordHash: data.passwordHash ?? null,
      peran: data.peran || 'Viewer',
      assignedVillageId: data.assignedVillageId ?? null,
      assignedKecamatan: data.assignedKecamatan ?? null,
      status: data.status || 'Aktif',
      nomorHP: data.nomorHP || null,
      emailVerifiedAt: data.emailVerifiedAt ?? null,
    })
    .returning();

  return result[0];
}

/**
 * Stamp an account as having proved its email address. Idempotent: verifying an
 * already-verified account is a no-op rather than an error, so a double-clicked
 * link does not need special handling.
 */
export async function markEmailVerified(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  const result = await queryDb
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  return result[0];
}

/** Replace a user's password. Callers are responsible for revoking sessions. */
export async function setUserPassword(
  id: number,
  passwordHash: string,
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const result = await queryDb
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, id))
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
