import { eq, ilike } from 'drizzle-orm';
import { db, DBTransaction } from '../db';
import { villages } from '../schema';

export async function listVillages(limit = 100, offset = 0, tx?: DBTransaction) {
  const queryDb = tx || db;
  return queryDb.query.villages.findMany({
    limit,
    offset,
  });
}

export async function getVillageById(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;

  return queryDb.query.villages.findFirst({
    where: eq(villages.id, id),
  });
}

export async function searchVillages(query: string, tx?: DBTransaction) {
  const queryDb = tx || db;

  return queryDb.query.villages.findMany({
    where: ilike(villages.namaDesa, `%${query}%`),
    limit: 50,
  });
}

export async function createVillage(data: typeof villages.$inferInsert, tx?: DBTransaction) {
  const queryDb = tx || db;

  const result = await queryDb.insert(villages).values(data).returning();
  return result[0];
}

export async function updateVillage(
  id: number,
  data: Partial<typeof villages.$inferInsert>,
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const result = await queryDb
    .update(villages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(villages.id, id))
    .returning();
  return result[0];
}

export async function deleteVillage(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  const result = await queryDb
    .delete(villages)
    .where(eq(villages.id, id))
    .returning();
  return result[0];
}