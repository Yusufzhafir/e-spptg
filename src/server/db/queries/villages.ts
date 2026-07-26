import { eq, ilike, sql, getTableColumns } from 'drizzle-orm';
import { db, DBTransaction } from '../db';
import { villages } from '../schema';

export async function listVillages(limit = 100, offset = 0, tx?: DBTransaction) {
  const queryDb = tx || db;
  // Count submissions per village. NB: the submissions village column is the
  // legacy mixed-case "villageId" (must be quoted exactly).
  return queryDb
    .select({
      ...getTableColumns(villages),
      // NB: interpolating ${villages.id} here renders as the *unqualified* "id",
      // which inside the subquery binds to submissions.id instead of the outer
      // villages.id (drizzle does not qualify base-table columns in a single-table
      // select). Reference the outer column explicitly via the table name so the
      // correlation is correct. The submissions alias avoids any "id" ambiguity.
      jumlahPengajuan: sql<number>`(
        SELECT COUNT(*)::int FROM submissions AS sub WHERE sub."villageId" = "villages"."id"
      )`,
    })
    .from(villages)
    .limit(limit)
    .offset(offset);
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