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

/**
 * Columns the Kawasan table may be ordered by, sorted in Postgres — one entry
 * per sortable header in the tab.
 *
 * `diunggahOleh` orders by the uploader's *name* rather than their id: the
 * column shows the name, so ordering by the number behind it would look
 * arbitrary. The join is already there for the same reason.
 */
const AREA_SORT_COLUMNS = {
  namaKawasan: prohibitedAreas.namaKawasan,
  jenisKawasan: prohibitedAreas.jenisKawasan,
  sumberData: prohibitedAreas.sumberData,
  dasarHukum: prohibitedAreas.dasarHukum,
  tanggalEfektif: prohibitedAreas.tanggalEfektif,
  diunggahOleh: users.nama,
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
    statusValidasi?: string;
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
  if (params.statusValidasi) {
    conditions.push(eq(prohibitedAreas.statusValidasi, params.statusValidasi as never));
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

  // `limit: 0` asks for the count alone — what the Pengaturan nav needs for its
  // record-count pill. Worth skipping the row entirely here: every kawasan
  // carries its whole boundary as GeoJSON.
  const items =
    params.limit === 0
      ? []
      : await db
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

/**
 * Every kawasan's geometry, for the maps that must draw all of them.
 *
 * Unpaged on purpose. The overlap check runs in PostGIS over every kawasan, so
 * a map fed a page of 500 was showing part of the answer to a question that had
 * been answered in full — an officer looking for "where are the restricted
 * areas" cannot tell a kawasan that is absent from one that does not exist.
 *
 * Only the four columns a map actually needs, so the cost is the geometry and
 * nothing else: no uploader join, no dasar hukum, no catatan.
 */
export async function listProhibitedAreaGeometries() {
  return db
    .select({
      id: prohibitedAreas.id,
      namaKawasan: prohibitedAreas.namaKawasan,
      jenisKawasan: prohibitedAreas.jenisKawasan,
      geom: sql`ST_AsGeoJSON(geom)`,
    })
    .from(prohibitedAreas);
}

/**
 * Every kawasan name on record, and nothing else.
 *
 * For the bulk importer's duplicate check: re-running the same SK would
 * otherwise quietly file a second copy of every kawasan in it, and the map
 * would then draw each boundary twice with no way to tell which row is which.
 * Deliberately not `listProhibitedAreas` — that returns each row's whole
 * geometry as GeoJSON, which for this question is megabytes to answer with a
 * string comparison.
 */
export async function listProhibitedAreaNames(): Promise<string[]> {
  const rows = await db
    .select({ namaKawasan: prohibitedAreas.namaKawasan })
    .from(prohibitedAreas);
  return rows.map((row) => row.namaKawasan);
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