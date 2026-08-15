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

/** One submission × kawasan overlap pair, for the system-wide overlap report. */
export interface SubmissionOverlapRow {
  submissionId: number;
  /** The kawasan side of the pair, so the report can be drawn and grouped. */
  kawasanId: number;
  namaPemilik: string;
  desaNama: string | null;
  kecamatan: string;
  status: string;
  namaKawasan: string;
  jenisKawasan: string;
  luasOverlap: number;
  percentageOverlap: number;
}

/**
 * System-wide "Cek Tumpang Tindih": every submission whose polygon intersects an
 * *active* prohibited area, scoped to what the caller may see.
 *
 * Only **recorded** pengajuan count — `SPPTG terdaftar` and `SPPTG terdata`,
 * still `is_valid`. Those are the two the map draws and the two that assert a
 * claim over the land; a rejected or under-review berkas sitting inside a
 * kawasan is the system working, not a conflict to report.
 *
 * NB: areas are measured by casting to `geography` so the result is real m² —
 * plain ST_Area on SRID 4326 geometry returns square degrees.
 */
export async function findOverlappingSubmissions(
  scope: { ownerUserId?: number; villageId?: number; scopeKecamatan?: string } = {},
  tx?: DBTransaction
): Promise<SubmissionOverlapRow[]> {
  const queryDb = tx || db;

  // Only submissions that are actually shown on the map count as a conflict:
  // `is_valid = false` means the entry was flagged invalid and its polygon is
  // hidden, so reporting it as an overlap contradicts what the user can see.
  const conditions = [
    sql`pa.aktif_di_validasi = true`,
    sql`s.is_valid = true`,
    sql`s.status IN ('SPPTG terdaftar', 'SPPTG terdata')`,
  ];
  if (scope.ownerUserId !== undefined) {
    conditions.push(sql`s.owner_user_id = ${scope.ownerUserId}`);
  }
  if (scope.villageId !== undefined) {
    conditions.push(sql`s."villageId" = ${scope.villageId}`);
  }
  if (scope.scopeKecamatan !== undefined) {
    // Use the desa's kecamatan (via villages), not the stale submissions.kecamatan.
    conditions.push(sql`s."villageId" IN (SELECT id FROM villages WHERE LOWER(kecamatan) = LOWER(${scope.scopeKecamatan}))`);
  }

  const result = await queryDb.execute(sql`
    SELECT
      s.id AS submission_id,
      pa.id AS kawasan_id,
      s.nama_pemilik,
      s.kecamatan,
      s.status,
      v.nama_desa,
      pa.nama_kawasan,
      pa.jenis_kawasan,
      ST_Area(ST_Intersection(s.geom, pa.geom)::geography)::double precision AS luas_overlap,
      (
        ST_Area(ST_Intersection(s.geom, pa.geom)::geography)
        / NULLIF(ST_Area(s.geom::geography), 0) * 100
      )::double precision AS percentage_overlap
    FROM submissions s
    JOIN prohibited_areas pa ON ST_Intersects(s.geom, pa.geom)
    LEFT JOIN villages v ON v.id = s."villageId"
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY luas_overlap DESC
  `);

  return (result.rows || []).map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      submissionId: Number(r.submission_id),
      kawasanId: Number(r.kawasan_id),
      namaPemilik: String(r.nama_pemilik ?? ''),
      desaNama: r.nama_desa == null ? null : String(r.nama_desa),
      kecamatan: String(r.kecamatan ?? ''),
      status: String(r.status ?? ''),
      namaKawasan: String(r.nama_kawasan ?? ''),
      jenisKawasan: String(r.jenis_kawasan ?? ''),
      luasOverlap: Number(r.luas_overlap ?? 0),
      percentageOverlap: Number(r.percentage_overlap ?? 0),
    };
  });
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
          -- Cast to geography so the result is real m². Plain ST_Area on SRID
          -- 4326 geometry returns SQUARE DEGREES, which the UI was labelling
          -- "m²" — a 27.569 m² overlap displayed as "0.0000022 m²".
          ST_Area(ST_Intersection(s.geom, pa.geom)::geography)::double precision AS luas_overlap,
          (
            ST_Area(ST_Intersection(s.geom, pa.geom)::geography)
            / NULLIF(ST_Area(s.geom::geography), 0) * 100
          )::double precision AS percentage_overlap,
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
