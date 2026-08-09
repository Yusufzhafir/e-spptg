import { and, asc, desc, eq, ilike, sql, getTableColumns } from 'drizzle-orm';
import { db, DBTransaction } from '../db';
import { villages } from '../schema';

/** Columns the Desa table may be ordered by, sorted in Postgres. */
const VILLAGE_SORT_COLUMNS = {
  kodeDesa: villages.kodeDesa,
  namaDesa: villages.namaDesa,
  namaKepalaDesa: villages.namaKepalaDesa,
  kecamatan: villages.kecamatan,
  kabupaten: villages.kabupaten,
  provinsi: villages.provinsi,
  updatedAt: villages.updatedAt,
} as const;

export type VillageSortKey = keyof typeof VILLAGE_SORT_COLUMNS;

/** One page of desa, searched, sorted and counted in Postgres. */
export async function listVillagesPaged(
  params: {
    search?: string;
    kecamatan?: string;
    sortKey?: VillageSortKey;
    sortDir?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {},
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const conditions = [];

  if (params.kecamatan) conditions.push(eq(villages.kecamatan, params.kecamatan));
  if (params.search?.trim()) {
    const pattern = `%${params.search.trim().toLowerCase()}%`;
    conditions.push(
      sql`(
        LOWER(${villages.namaDesa}) LIKE ${pattern}
        OR LOWER(${villages.kodeDesa}) LIKE ${pattern}
        OR LOWER(COALESCE(${villages.namaKepalaDesa}, '')) LIKE ${pattern}
      )`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const column = VILLAGE_SORT_COLUMNS[params.sortKey ?? 'updatedAt'];
  const orderBy = params.sortDir === 'asc' ? asc(column) : desc(column);

  const items = await queryDb
    .select({
      ...getTableColumns(villages),
      jumlahPengajuan: sql<number>`(
        SELECT COUNT(*)::int FROM submissions AS sub WHERE sub."villageId" = "villages"."id"
      )`,
    })
    .from(villages)
    .where(where)
    // `id` as a tiebreak so equal values cannot swap between pages.
    .orderBy(orderBy, desc(villages.id))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);

  const [counted] = await queryDb
    .select({ count: sql<number>`count(*)::int` })
    .from(villages)
    .where(where);

  return { items, total: counted?.count ?? 0 };
}

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

/**
 * How many rows still point at this desa.
 *
 * None of these columns carry a foreign key, so deleting a desa that is still
 * in use does not fail — it silently orphans the rows: staff assigned to it keep
 * a scope that resolves to nothing (empty dashboard, no error), and its
 * pengajuan drop out of every kecamatan-scoped view.
 */
export async function countVillageReferences(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;

  // NB: the submissions village column is the legacy mixed-case "villageId".
  const rows = await queryDb.execute<{
    pengguna: number;
    pengajuan: number;
    draf: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE assigned_village_id = ${id}) AS pengguna,
      (SELECT COUNT(*)::int FROM submissions WHERE "villageId" = ${id}) AS pengajuan,
      (SELECT COUNT(*)::int FROM submission_drafts WHERE village_id = ${id}) AS draf
  `);

  const row = (Array.isArray(rows) ? rows[0] : rows?.rows?.[0]) ?? {
    pengguna: 0,
    pengajuan: 0,
    draf: 0,
  };

  return {
    pengguna: Number(row.pengguna) || 0,
    pengajuan: Number(row.pengajuan) || 0,
    draf: Number(row.draf) || 0,
  };
}

export async function deleteVillage(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  const result = await queryDb
    .delete(villages)
    .where(eq(villages.id, id))
    .returning();
  return result[0];
}