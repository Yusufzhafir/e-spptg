import { eq, sql } from 'drizzle-orm';
import { db, DBTransaction } from '../db';
import { villageBoundaries } from '../schema';

type GeoJSONPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

type VillageBoundarySelectRow = {
  id: number;
  villageId: number;
  geom: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VillageBoundaryRecord = {
  id: number;
  villageId: number;
  geomGeoJSON: GeoJSONPolygon;
  createdAt: Date;
  updatedAt: Date;
};

function parseGeoJSONPolygon(value: unknown): GeoJSONPolygon | null {
  if (!value) return null;

  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { type?: unknown }).type !== 'Polygon' ||
    !Array.isArray((parsed as { coordinates?: unknown }).coordinates)
  ) {
    return null;
  }

  return parsed as GeoJSONPolygon;
}

export async function getByVillageId(
  villageId: number,
  tx?: DBTransaction
): Promise<VillageBoundaryRecord | null> {
  const queryDb = tx || db;
  const result = await queryDb
    .select({
      id: villageBoundaries.id,
      villageId: villageBoundaries.villageId,
      geom: sql<string>`ST_AsGeoJSON(${villageBoundaries.geom})`,
      createdAt: villageBoundaries.createdAt,
      updatedAt: villageBoundaries.updatedAt,
    })
    .from(villageBoundaries)
    .where(eq(villageBoundaries.villageId, villageId))
    .limit(1);

  const row = result[0] as VillageBoundarySelectRow | undefined;
  if (!row) return null;

  const geomGeoJSON = parseGeoJSONPolygon(row.geom);
  if (!geomGeoJSON) return null;

  return {
    id: row.id,
    villageId: row.villageId,
    geomGeoJSON,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function upsertByVillageId(
  villageId: number,
  geomGeoJSON: GeoJSONPolygon,
  tx?: DBTransaction
): Promise<VillageBoundaryRecord> {
  const queryDb = tx || db;
  const geoJsonText = JSON.stringify(geomGeoJSON);

  await queryDb
    .insert(villageBoundaries)
    .values({
      villageId,
      geom: sql`ST_SetSRID(ST_MakeValid(ST_GeomFromGeoJSON(${geoJsonText})), 4326)`,
    })
    .onConflictDoUpdate({
      target: villageBoundaries.villageId,
      set: {
        geom: sql`ST_SetSRID(ST_MakeValid(ST_GeomFromGeoJSON(${geoJsonText})), 4326)`,
        updatedAt: new Date(),
      },
    });

  const boundary = await getByVillageId(villageId, tx);
  if (!boundary) {
    throw new Error('Failed to read village boundary after upsert');
  }

  return boundary;
}

export async function deleteByVillageId(
  villageId: number,
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const result = await queryDb
    .delete(villageBoundaries)
    .where(eq(villageBoundaries.villageId, villageId))
    .returning({
      id: villageBoundaries.id,
      villageId: villageBoundaries.villageId,
    });

  return result[0] ?? null;
}
