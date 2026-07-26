import { eq, getTableColumns, sql } from 'drizzle-orm';
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