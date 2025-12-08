import { eq } from 'drizzle-orm';
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

export async function getUserById(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  return queryDb.query.users.findFirst(
    {
      where : eq(users.id, id)
    }
  );
}

export async function createUser(data: {
  clerkUserId: string;
  email: string;
  nama: string;
  nipNik: string;
  peran?: UserRole
  nomorHP?: string;
  status?: UserStatus;
}, tx?: DBTransaction) {
  const queryDb = tx || db;

  const result = await queryDb
    .insert(users)
    .values({
      clerkUserId: data.clerkUserId,
      email: data.email,
      nama: data.nama,
      nipNik: data.nipNik,
      peran: data.peran || 'Viewer',
      status: data.status || 'Aktif',
      nomorHP: data.nomorHP || null,
    })
    .returning();

  return result[0];
}

export async function listUsers(limit = 50, offset = 0, tx?: DBTransaction) {
  const queryDb = tx || db;

  return queryDb.query.users.findMany({
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