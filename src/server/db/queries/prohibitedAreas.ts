import { and, asc, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { db } from '../db';
import { prohibitedAreas, users } from '../schema';

export async function listProhibitedAreas(limit = 100, offset = 0) {
  const {geom,...rest} = getTableColumns(prohibitedAreas)
  return await db.select({
    ...rest,
    geom: sql`ST_AsGeoJSON(geom)`,
    diunggahOlehNama: users.nama,
  })
    .from(prohibitedAreas)
    .leftJoin(users, eq(prohibitedAreas.diunggahOleh, users.id))
    .limit(limit).offset(offset)
}

/** Columns the Kawasan table may be ordered by, sorted in Postgres. */
const AREA_SORT_COLUMNS = {
  namaKawasan: prohibitedAreas.namaKawasan,
  jenisKawasan: prohibitedAreas.jenisKawasan,
  sumberData: prohibitedAreas.sumberData,
  tanggalEfektif: prohibitedAreas.tanggalEfektif,
  statusValidasi: prohibitedAreas.statusValidasi,
  aktifDiValidasi: prohibitedAreas.aktifDiValidasi,
  updatedAt: prohibitedAreas.updatedAt,
} as const;

export type AreaSortKey = keyof typeof AREA_SORT_COLUMNS;

/**
 * One page of kawasan for the settings table, searched and counted in Postgres.
 *
 * The geometry still comes back as GeoJSON because the table offers a preview
 * of each polygon — but only for the rows on this page, not for all of them.
 */
export async function listProhibitedAreasPaged(
  params: {
    search?: string;
    jenisKawasan?: string;
    sortKey?: AreaSortKey;
    sortDir?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {}
) {
  const { geom, ...rest } = getTableColumns(prohibitedAreas);
  const conditions = [];

  if (params.jenisKawasan) {
    conditions.push(eq(prohibitedAreas.jenisKawasan, params.jenisKawasan as never));
  }
  if (params.search?.trim()) {
    const pattern = `%${params.search.trim().toLowerCase()}%`;
    conditions.push(
      sql`(
        LOWER(${prohibitedAreas.namaKawasan}) LIKE ${pattern}
        OR LOWER(${prohibitedAreas.sumberData}) LIKE ${pattern}
      )`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const column = AREA_SORT_COLUMNS[params.sortKey ?? 'updatedAt'];
  const orderBy = params.sortDir === 'asc' ? asc(column) : desc(column);

  const items = await db
    .select({ ...rest, geom: sql`ST_AsGeoJSON(geom)`, diunggahOlehNama: users.nama })
    .from(prohibitedAreas)
    .leftJoin(users, eq(prohibitedAreas.diunggahOleh, users.id))
    .where(where)
    // `id` as a tiebreak so equal values cannot swap between pages.
    .orderBy(orderBy, desc(prohibitedAreas.id))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);

  const [counted] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(prohibitedAreas)
    .where(where);

  return { items, total: counted?.count ?? 0 };
}

export async function getProhibitedAreaById(id: number) {
  const {geom,...rest} = getTableColumns(prohibitedAreas)
  return await db.select({
    ...rest,
    geom: sql`ST_AsGeoJSON(geom)`,
  }).from(prohibitedAreas).where(eq(prohibitedAreas.id, id)).limit(1)
}

export async function createProhibitedArea(
  data: typeof prohibitedAreas.$inferInsert
) {
  // Exclude `geom` from RETURNING — drizzle's geometry() type only parses Point.
  const { geom: _geom, ...columns } = getTableColumns(prohibitedAreas);
  const result = await db
    .insert(prohibitedAreas)
    .values(data)
    .returning(columns);
  return result[0];
}

export async function updateProhibitedArea(
  id: number,
  data: Partial<typeof prohibitedAreas.$inferInsert>
) {
  // Return everything except `geom`: drizzle's geometry() type only parses Point,
  // so reading a Polygon back via .returning() throws "Unsupported geometry type".
  const { geom: _geom, ...columns } = getTableColumns(prohibitedAreas);
  const result = await db
    .update(prohibitedAreas)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(prohibitedAreas.id, id))
    .returning(columns);
  return result[0];
}

export async function deleteProhibitedArea(id: number) {
  // Exclude `geom` from RETURNING — drizzle's geometry() type only parses Point.
  const { geom: _geom, ...columns } = getTableColumns(prohibitedAreas);
  const result = await db
    .delete(prohibitedAreas)
    .where(eq(prohibitedAreas.id, id))
    .returning(columns);
  return result[0];
}