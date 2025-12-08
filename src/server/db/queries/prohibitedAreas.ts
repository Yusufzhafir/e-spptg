import { eq, getTableColumns, sql } from 'drizzle-orm';
import { db } from '../db';
import { prohibitedAreas } from '../schema';

export async function listProhibitedAreas(limit = 100, offset = 0) {
  const {geom,...rest} = getTableColumns(prohibitedAreas)
  return await db.select({
    ...rest,
    geom: sql`ST_AsGeoJSON(geom)`,
  }).from(prohibitedAreas).limit(limit).offset(offset)
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
  const result = await db
    .insert(prohibitedAreas)
    .values(data)
    .returning();
  return result[0];
}

export async function updateProhibitedArea(
  id: number,
  data: Partial<typeof prohibitedAreas.$inferInsert>
) {
  const result = await db
    .update(prohibitedAreas)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(prohibitedAreas.id, id))
    .returning();
  return result[0];
}

export async function deleteProhibitedArea(id: number) {
  const result = await db
    .delete(prohibitedAreas)
    .where(eq(prohibitedAreas.id, id))
    .returning();
  return result[0];
}