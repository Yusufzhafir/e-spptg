import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { UserRole, UserStatus } from '@/types';
import { db, DBTransaction } from '../db';
import { users } from '../schema';
import { invalidateUser } from '@/server/redis/cache';

/**
 * Every function here that writes a user row drops that user's cache entry
 * before returning.
 *
 * Doing it in the query layer rather than at the ~9 router call sites is
 * deliberate: `validateSessionToken` reads the user through this cache on every
 * authenticated request, so a missed invalidation means a demoted or
 * deactivated account keeps its old permissions until the TTL lapses. Putting
 * it here means a future caller cannot forget.
 */

/**
 * Look a user up by their login identifier. Emails are compared
 * case-insensitively — people type "Budi@gmail.com" and expect to get in —
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

  await invalidateUser(id);
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

  await invalidateUser(id);
  return result[0];
}

/** Record the user's last login time. */
export async function touchUserLastLogin(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  await queryDb
    .update(users)
    .set({ terakhirMasuk: new Date() })
    .where(eq(users.id, id));

  // Only a display field, but leaving it stale would make the 10-minute
  // throttle in `createTRPCContext` re-fire on every request: it compares
  // against the cached row, which would never show the write that just landed.
  await invalidateUser(id);
}

/** Columns the Pengguna table may be ordered by, sorted in Postgres. */
const USER_SORT_COLUMNS = {
  nama: users.nama,
  nipNik: users.nipNik,
  email: users.email,
  peran: users.peran,
  status: users.status,
  terakhirMasuk: users.terakhirMasuk,
  updatedAt: users.updatedAt,
} as const;

export type UserSortKey = keyof typeof USER_SORT_COLUMNS;

/**
 * One page of accounts, filtered, searched and counted in Postgres.
 *
 * `villageId` is the desa scope an Admin/Verifikator is limited to; leaving it
 * out lists everyone (Superadmin). Paging here rather than in the browser means
 * the table can never silently truncate at whatever limit the page happened to
 * request.
 */
export async function listUsersPaged(
  params: {
    villageId?: number;
    search?: string;
    peran?: string;
    status?: string;
    sortKey?: UserSortKey;
    sortDir?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {},
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const conditions = [];

  if (params.villageId != null) {
    conditions.push(eq(users.assignedVillageId, params.villageId));
  }
  if (params.peran) conditions.push(eq(users.peran, params.peran as never));
  if (params.status) conditions.push(eq(users.status, params.status as never));
  if (params.search?.trim()) {
    const pattern = `%${params.search.trim().toLowerCase()}%`;
    conditions.push(
      sql`(
        LOWER(${users.nama}) LIKE ${pattern}
        OR LOWER(${users.email}) LIKE ${pattern}
        OR LOWER(${users.nipNik}) LIKE ${pattern}
      )`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const column = USER_SORT_COLUMNS[params.sortKey ?? 'updatedAt'];
  const orderBy = params.sortDir === 'asc' ? asc(column) : desc(column);

  // `limit: 0` asks for the count alone — what the Pengaturan nav needs for its
  // record-count pill.
  const items =
    params.limit === 0
      ? []
      : await queryDb
          .select()
          .from(users)
          .where(where)
          // `id` as a tiebreak so equal values cannot swap between pages.
          .orderBy(orderBy, desc(users.id))
          .limit(params.limit ?? 50)
          .offset(params.offset ?? 0);

  const [counted] = await queryDb
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(where);

  return { items, total: counted?.count ?? 0 };
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

  // The important one: this is how peran, status and assigned desa change.
  await invalidateUser(id);
  return result[0];
}
