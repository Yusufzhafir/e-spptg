import { db, DBTransaction } from './db/db';
import { sql } from 'drizzle-orm';
import { overlapResults } from './db/schema';

/**
 * Interface for overlap calculation result
 * This is what we work with in JavaScript/TypeScript
 */
export interface OverlapCalculation {
  prohibitedAreaId: number;
  namaKawasan: string;
  jenisKawasan: string;
  luasOverlap: number;
  percentageOverlap: number;
  intersectionGeom: unknown; // PostGIS geometry
}

/**
 * Find all overlapping prohibited areas and calculate their overlap metrics
 * Returns an array of overlap calculations that can be used in JavaScript
 */
export async function calculateAllOverlaps(
  submissionId: number,
  tx?: DBTransaction
): Promise<OverlapCalculation[]> {
  const queryDb = tx || db;
  
  try {
    // Single query to find overlaps and calculate all metrics
    const result = await queryDb.execute(
      sql`
        SELECT 
          pa.id AS prohibited_area_id,
          pa.nama_kawasan,
          pa.jenis_kawasan,
          ST_Area(ST_Intersection(s.geom, pa.geom))::double precision AS luas_overlap,
          (ST_Area(ST_Intersection(s.geom, pa.geom)) / NULLIF(ST_Area(s.geom), 0) * 100)::double precision AS percentage_overlap,
          ST_Intersection(s.geom, pa.geom) AS intersection_geom
        FROM submissions s
        JOIN prohibited_areas pa ON ST_Intersects(s.geom, pa.geom)
        WHERE s.id = ${submissionId}
          AND pa.aktif_di_validasi = true
      `
    );

    // Transform database results into JavaScript objects
    const overlaps: OverlapCalculation[] = (result.rows || []).map((row: unknown) => {
      const typedRow = row as Record<string, unknown>;
      return {
      prohibitedAreaId: Number(typedRow.prohibited_area_id),
      namaKawasan: String(typedRow.nama_kawasan ?? ''),
      jenisKawasan: String(typedRow.jenis_kawasan ?? ''),
      luasOverlap: Number(typedRow.luas_overlap ?? 0),
      percentageOverlap: Number(typedRow.percentage_overlap ?? 0),
      intersectionGeom: typedRow.intersection_geom,
      };
    });

    return overlaps;
  } catch (error) {
    console.error('Error calculating overlaps:', error);
    throw error;
  }
}

/**
 * Clear existing overlap results for a submission
 */
export async function clearOverlapResults(
  submissionId: number,
  tx?: DBTransaction
): Promise<void> {
  const queryDb = tx || db;
  
  await queryDb.delete(overlapResults)
    .where(sql`${overlapResults.submissionId} = ${submissionId}`);
}

/**
 * Insert overlap results into the database with explicit column mapping
 * Takes JavaScript objects from calculateAllOverlaps() and inserts them
 * This approach is easier to debug and maintain than a giant SQL query
 * 
 * For geometry, we use a subquery to get it directly from the original calculation
 * This ensures the geometry is handled correctly while maintaining explicit column mapping
 */
export async function insertOverlapResults(
  submissionId: number,
  overlaps: OverlapCalculation[],
  tx?: DBTransaction
): Promise<void> {
  const queryDb = tx || db;
  
  if (overlaps.length === 0) {
    return;
  }

  // Insert each overlap result with explicit column mapping
  // This makes it easy to debug and prevents column ordering errors
  for (const overlap of overlaps) {
    await queryDb.execute(
      sql`
        INSERT INTO overlap_results (
          "submissionId",
          "prohibitedAreaId",
          luas_overlap,
          percentage_overlap,
          nama_kawasan,
          jenis_kawasan,
          intersection_geom,
          created_at,
          updated_at
        )
        VALUES (
          ${submissionId},
          ${overlap.prohibitedAreaId},
          ${overlap.luasOverlap},
          ${overlap.percentageOverlap},
          ${overlap.namaKawasan},
          ${overlap.jenisKawasan}::prohibited_area_type,
          (
            SELECT ST_Intersection(s.geom, pa.geom)
            FROM submissions s
            CROSS JOIN prohibited_areas pa
            WHERE s.id = ${submissionId}
              AND pa.id = ${overlap.prohibitedAreaId}
          ),
          NOW(),
          NOW()
        )
      `
    );
  }
}

/**
 * Main function: Find overlapping prohibited areas and insert into overlap_results
 * This orchestrates the process:
 * 1. Calculate overlaps into JavaScript objects (easy to debug)
 * 2. Clear existing results
 * 3. Insert new results with explicit column mapping
 * 
 * This approach makes debugging easier since you can inspect the JavaScript objects
 * before insertion, and the explicit column mapping prevents ordering errors.
 */
export async function computeOverlaps(submissionId: number, tx?: DBTransaction) {
  try {
    // Step 1: Calculate all overlaps - returns JavaScript objects we can inspect/debug
    const overlaps = await calculateAllOverlaps(submissionId, tx);
    
    // Step 2: Clear existing overlap results for this submission
    await clearOverlapResults(submissionId, tx);
    
    // Step 3: Insert the calculated overlaps with explicit column mapping
    await insertOverlapResults(submissionId, overlaps, tx);

    return true;
  } catch (error) {
    console.error('Error computing overlaps:', error);
    throw error; // Re-throw to let the caller handle it properly
  }
}
