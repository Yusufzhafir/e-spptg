
import { eq, asc, desc, and, or, sql, getTableColumns } from 'drizzle-orm';
import { db, type DBTransaction } from '../db';
import {
    submissions,
    overlapResults,
    statusHistory,
    users,
    villages,
} from '../schema';
import { FeedbackData, StatusSPPTG } from '@/types';

type SubmissionScopeFilters = {
    ownerUserId?: number;
    villageId?: number;
    /** Scope for the 'Kecamatan' role — every desa in one kecamatan. */
    scopeKecamatan?: string;
};

function buildScopeConditions(filters: SubmissionScopeFilters) {
    const conditions = [];
    if (filters.ownerUserId !== undefined) {
        conditions.push(eq(submissions.ownerUserId, filters.ownerUserId));
    }
    if (filters.villageId !== undefined) {
        conditions.push(eq(submissions.villageId, filters.villageId));
    }
    if (filters.scopeKecamatan !== undefined) {
        // Resolve the kecamatan through `villages`, NOT submissions.kecamatan:
        // that column is free text captured when the submission was created and
        // is frequently stale or empty, so matching on it silently returned
        // nothing. The desa -> kecamatan mapping in `villages` is authoritative.
        conditions.push(
            sql`${submissions.villageId} IN (
                SELECT id FROM villages WHERE LOWER(kecamatan) = LOWER(${filters.scopeKecamatan})
            )`
        );
    }
    return conditions;
}

/** Dashboard filter set shared by the list and the KPI/tren charts. */
export type SubmissionDashboardFilters = SubmissionScopeFilters & {
    search?: string;
    status?: string;
    desaId?: number;
    kecamatan?: string;
    dateFrom?: string;
    dateTo?: string;
    /** Count only submissions flagged valid (shown on the map). Used by the charts. */
    onlyValid?: boolean;
};

/**
 * Scope conditions + the dashboard's user-facing filters, so the submissions
 * list and the KPI / monthly-trend charts always describe the same data set.
 */
function buildSubmissionConditions(filters: SubmissionDashboardFilters) {
    const { search, status, desaId, kecamatan, dateFrom, dateTo, onlyValid } = filters;
    const conditions = buildScopeConditions(filters);

    if (onlyValid) {
        conditions.push(eq(submissions.isValid, true));
    }

    if (search) {
        conditions.push(
            sql`(
        ${submissions.namaPemilik} ILIKE ${`%${search}%`}
        OR ${submissions.nik} LIKE ${`%${search}%`}
        OR ${submissions.kecamatan} ILIKE ${`%${search}%`}
      )`
        );
    }

    if (status && status !== 'all') {
        conditions.push(eq(submissions.status, status as StatusSPPTG));
    }

    if (typeof desaId === 'number') {
        conditions.push(eq(submissions.villageId, desaId));
    } else if (kecamatan) {
        // Resolved through `villages` for the same reason `buildScopeConditions`
        // does it: `submissions.kecamatan` is free text captured when the
        // submission was created and is frequently stale or empty, so matching
        // on it returned zero rows for kecamatan that demonstrably have
        // submissions — the filter looked like "no data" rather than "broken".
        conditions.push(
            sql`${submissions.villageId} IN (
                SELECT id FROM villages WHERE LOWER(kecamatan) = LOWER(${kecamatan})
            )`
        );
    }

    if (dateFrom) {
        conditions.push(sql`DATE(${submissions.tanggalPengajuan}) >= ${dateFrom}`);
    }

    if (dateTo) {
        conditions.push(sql`DATE(${submissions.tanggalPengajuan}) <= ${dateTo}`);
    }

    return conditions;
}

/**
 * Get submission by ID
 */
export async function getSubmissionById(
    id: number,
    tx?: DBTransaction
) {
    const queryDb = tx || db;
    const {geom,...rest} = getTableColumns(submissions)
    // Resolve the desa name (shown instead of a raw id) and the desa's kecamatan
    // (authoritative for the 'Kecamatan' role — submissions.kecamatan is stale
    // free text and must not be used for access decisions).
    const [result] = await queryDb
        .select({ ...rest, desaNama: villages.namaDesa, desaKecamatan: villages.kecamatan })
        .from(submissions)
        .leftJoin(villages, eq(submissions.villageId, villages.id))
        .where(eq(submissions.id, id))
        .limit(1)

    return result ?? null
}

/**
 * Columns the pengajuan table may be ordered by.
 *
 * Sorting has to happen in Postgres, not in the browser: the table only ever
 * holds one page, and sorting ten rows out of four thousand would put the wrong
 * ten at the top. `desaKecamatan` and `verifikatorName` come from the joins, so
 * they are ordered by the joined column rather than the (stale) local one.
 */
export const SUBMISSION_SORT_COLUMNS = {
    id: submissions.id,
    namaPemilik: submissions.namaPemilik,
    kecamatan: villages.kecamatan,
    luas: submissions.luas,
    tanggalPengajuan: submissions.tanggalPengajuan,
    status: submissions.status,
    isValid: submissions.isValid,
    verifikator: users.nama,
    updatedAt: submissions.updatedAt,
} as const;

export type SubmissionSortKey = keyof typeof SUBMISSION_SORT_COLUMNS;

function submissionOrderBy(sortKey: SubmissionSortKey = 'updatedAt', sortDir: 'asc' | 'desc' = 'desc') {
    const column = SUBMISSION_SORT_COLUMNS[sortKey] ?? submissions.updatedAt;
    return sortDir === 'asc' ? asc(column) : desc(column);
}

export async function listSubmissions(filters: {
    search?: string;
    status?: string;
    desaId?: number;
    kecamatan?: string;
    dateFrom?: string;
    dateTo?: string;
    ownerUserId?: number;
    villageId?: number;
    scopeKecamatan?: string;
    sortKey?: SubmissionSortKey;
    sortDir?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
},
    tx?: DBTransaction
) {
    const queryDb = tx || db
    const {
        search,
        status,
        desaId,
        kecamatan,
        dateFrom,
        dateTo,
        ownerUserId,
        villageId,
        scopeKecamatan,
        sortKey,
        sortDir,
        limit = 50,
        offset = 0
    } = filters;

    const conditions = buildSubmissionConditions({
        ownerUserId,
        villageId,
        scopeKecamatan,
        search,
        status,
        desaId,
        kecamatan,
        dateFrom,
        dateTo,
    });

    const {geom,...restOfTheColumn} = getTableColumns(submissions)
    const items = await queryDb.select({
            ...restOfTheColumn,
            // Resolve the verifikator's display name; null when the user was deleted
            verifikatorName: users.nama,
            // Resolve the village's display name; null when the village was deleted
            desaNama: villages.namaDesa,
            // Authoritative kecamatan (submissions.kecamatan is stale free text)
            desaKecamatan: villages.kecamatan,
        })
        .from(submissions)
        .leftJoin(users, eq(submissions.verifikator, users.id))
        .leftJoin(villages, eq(submissions.villageId, villages.id))
        .where(
            conditions.length > 0 ? and(...conditions) : undefined
        ).offset(offset)
        .limit(limit)
        // `id` as a tiebreak: without a unique second key, rows that share a
        // value (same status, same date) can swap between pages on every query
        // and appear twice or not at all.
        .orderBy(submissionOrderBy(sortKey, sortDir), desc(submissions.id))

    const totalResult = await queryDb
        // ::int so this really is a number, matching the declared type
        .select({ count: sql<number>`count(*)::int` })
        .from(submissions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = totalResult[0]?.count ?? 0;

    return { items, total };
}

/**
 * The dashboard map's own feed, deliberately separate from the table's.
 *
 * The two want opposite things: the table wants one page of full rows, the map
 * wants every polygon in scope. Sharing one query meant either paging the map
 * (polygons vanishing as you turn pages) or loading every row to draw a map.
 *
 * Carries only what the map itself renders — the polygon plus what the popup
 * shows — so it stays light even at a few thousand rows, and honours the same
 * filters the table has applied so map and table always describe the same set.
 */
export async function listSubmissionsForMap(
    filters: {
        search?: string;
        status?: string;
        desaId?: number;
        kecamatan?: string;
        dateFrom?: string;
        dateTo?: string;
        ownerUserId?: number;
        villageId?: number;
        scopeKecamatan?: string;
        limit?: number;
    },
    tx?: DBTransaction
) {
    const queryDb = tx || db;
    const conditions = buildSubmissionConditions(filters);
    // Invalid rows are never drawn; excluding them here rather than in the
    // browser keeps the payload to what actually reaches the canvas.
    conditions.push(eq(submissions.isValid, true));

    return queryDb
        .select({
            id: submissions.id,
            namaPemilik: submissions.namaPemilik,
            status: submissions.status,
            luas: submissions.luas,
            isValid: submissions.isValid,
            villageId: submissions.villageId,
            desaNama: villages.namaDesa,
            desaKecamatan: villages.kecamatan,
            geoJSON: submissions.geoJSON,
        })
        .from(submissions)
        .leftJoin(villages, eq(submissions.villageId, villages.id))
        .where(and(...conditions))
        .limit(filters.limit ?? 5000);
}

/**
 * Where one pengajuan sits in the current result set — its 0-based row number
 * under the same filters and ordering the table is using.
 *
 * This is what keeps "buka pengajuan ini" (`?focus=`, a notification, a clicked
 * map polygon) working once the table is paged on the server: the browser holds
 * one page and cannot find a row on any other, so Postgres numbers the rows and
 * the client turns that into a page number.
 *
 * Returns null when the row is outside the caller's scope or filtered out —
 * the caller then leaves the table where it is instead of jumping nowhere.
 */
export async function findSubmissionPosition(
    submissionId: number,
    filters: {
        search?: string;
        status?: string;
        desaId?: number;
        kecamatan?: string;
        dateFrom?: string;
        dateTo?: string;
        ownerUserId?: number;
        villageId?: number;
        scopeKecamatan?: string;
        sortKey?: SubmissionSortKey;
        sortDir?: 'asc' | 'desc';
    },
    tx?: DBTransaction
): Promise<number | null> {
    const queryDb = tx || db;
    const conditions = buildSubmissionConditions(filters);

    const numbered = queryDb
        .select({
            id: submissions.id,
            // ROW_NUMBER is 1-based; the caller wants an index.
            position: sql<number>`(ROW_NUMBER() OVER (ORDER BY ${submissionOrderBy(
                filters.sortKey,
                filters.sortDir
            )}, ${desc(submissions.id)}) - 1)::int`.as('position'),
        })
        .from(submissions)
        .leftJoin(users, eq(submissions.verifikator, users.id))
        .leftJoin(villages, eq(submissions.villageId, villages.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .as('numbered');

    const [row] = await queryDb
        .select({ position: numbered.position })
        .from(numbered)
        .where(eq(numbered.id, submissionId))
        .limit(1);

    return row?.position ?? null;
}

/**
 * Every pengajuan connected to one account, for the user detail page.
 *
 * Two connections count, because the roles use the system differently: a Viewer
 * *owns* the pengajuan they filed (`owner_user_id`), while staff appear on the
 * ones they processed (`verifikator`). Matching only the first would show an
 * empty list for every Admin and Verifikator in the app.
 */
export async function listSubmissionsForUser(
    userId: number,
    params: {
        search?: string;
        status?: string;
        keterkaitan?: 'Pemohon' | 'Verifikator';
        limit?: number;
        offset?: number;
    } = {},
    tx?: DBTransaction
) {
    const queryDb = tx || db;

    const linked =
        params.keterkaitan === 'Pemohon'
            ? eq(submissions.ownerUserId, userId)
            : params.keterkaitan === 'Verifikator'
              ? eq(submissions.verifikator, userId)
              : or(
                    eq(submissions.ownerUserId, userId),
                    eq(submissions.verifikator, userId)
                );

    const conditions = [linked];
    if (params.status) conditions.push(eq(submissions.status, params.status as never));
    if (params.search?.trim()) {
        const pattern = `%${params.search.trim().toLowerCase()}%`;
        conditions.push(
            sql`(
                LOWER(${submissions.namaPemilik}) LIKE ${pattern}
                OR LOWER(COALESCE(${villages.namaDesa}, '')) LIKE ${pattern}
            )`
        );
    }

    const where = and(...conditions);

    const items = await queryDb
        .select({
            id: submissions.id,
            namaPemilik: submissions.namaPemilik,
            status: submissions.status,
            isValid: submissions.isValid,
            luas: submissions.luas,
            tanggalPengajuan: submissions.tanggalPengajuan,
            ownerUserId: submissions.ownerUserId,
            verifikator: submissions.verifikator,
            desaNama: villages.namaDesa,
            desaKecamatan: villages.kecamatan,
        })
        .from(submissions)
        .leftJoin(villages, eq(submissions.villageId, villages.id))
        .where(where)
        // `id` as a tiebreak so equal dates cannot swap between pages.
        .orderBy(desc(submissions.tanggalPengajuan), desc(submissions.id))
        .limit(params.limit ?? 10)
        .offset(params.offset ?? 0);

    const [counted] = await queryDb
        .select({ count: sql<number>`count(*)::int` })
        .from(submissions)
        .leftJoin(villages, eq(submissions.villageId, villages.id))
        .where(where);

    return { items, total: counted?.count ?? 0 };
}

/**
 * Polygons for the wizard maps — every desa, deliberately unscoped.
 *
 * Drawing a parcel means seeing what is already registered *next to* it, and
 * land does not stop at the desa boundary: an Admin or Verifikator who is shown
 * only their own desa can draw straight over a neighbouring desa's plot and
 * only find out from the overlap check, which has always run across every desa
 * (`checkOverlapsFromCoordinates`).
 *
 * Only geometry and the desa name come back — never the applicant's name, NIK
 * or contact — so widening the map does not widen access to personal data.
 *
 * The three filters match the overlap check exactly, so what the map draws and
 * what the check reports can never disagree:
 *   - `status IN ('SPPTG terdaftar', 'SPPTG terdata')` — a rejected or
 *     under-review pengajuan claims no land, so it is neither drawn nor counted
 *     as a conflict;
 *   - `is_valid = true` — an entry flagged invalid is hidden everywhere else;
 *   - a polygon must actually exist.
 */
export async function listSubmissionMapPolygons(tx?: DBTransaction) {
    const queryDb = tx || db;

    // `submissions."villageId"` is the legacy mixed-case column — quote it exactly.
    const result = await queryDb.execute(sql`
        SELECT
            s.id,
            s.status::text AS status,
            s."villageId" AS village_id,
            v.nama_desa,
            ST_AsGeoJSON(s.geom) AS geo_json
        FROM submissions s
        LEFT JOIN villages v ON v.id = s."villageId"
        WHERE s.status IN ('SPPTG terdaftar', 'SPPTG terdata')
          AND s.is_valid = true
          AND s.geom IS NOT NULL
    `);

    return (result.rows || []).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return {
            id: Number(r.id),
            status: String(r.status ?? ''),
            villageId: r.village_id == null ? null : Number(r.village_id),
            desaNama: r.nama_desa == null ? null : String(r.nama_desa),
            geoJSON: r.geo_json == null ? null : String(r.geo_json),
        };
    });
}

export async function createSubmission(
    data: typeof submissions.$inferInsert,
    tx?: DBTransaction
) {
    const queryDb = tx || db;
    // Never RETURNING the `geom` column: drizzle's geometry() type only parses
    // Point, so reading a Polygon back throws "Unsupported geometry type".
    const { geom: _geom, ...columns } = getTableColumns(submissions);
    const result = await queryDb
        .insert(submissions)
        .values(data)
        .returning(columns);
    return result[0];
}

/**
 * Toggle a submission's visual validity flag (valid/invalid).
 * When false, the submission's polygon & data are hidden from the map.
 */
export async function updateSubmissionValidity(
    id: number,
    isValid: boolean,
    tx?: DBTransaction
) {
    const queryDb = tx || db;
    const {geom, ...rest} = getTableColumns(submissions);
    const [result] = await queryDb
        .update(submissions)
        .set({ isValid, updatedAt: new Date() })
        .where(eq(submissions.id, id))
        .returning(rest);
    return result ?? null;
}

export async function updateSubmissionStatus(
    id: number,
    newStatus: StatusSPPTG,
    verifikator: number,
    alasan?: string,
    feedback?: FeedbackData,
    tx?: DBTransaction
) {
    const queryDb = tx || db;

    // Read the current status *before* writing: the UPDATE ... RETURNING row
    // already holds the new value, so using it would record statusBefore ===
    // statusAfter and make the audit trail useless.
    const [previous] = await queryDb
        .select({ status: submissions.status })
        .from(submissions)
        .where(eq(submissions.id, id))
        .limit(1);

    // Never RETURNING the `geom` column: drizzle's geometry() type only parses
    // Point, so reading a Polygon back throws "Unsupported geometry type" —
    // which previously made every status change fail.
    const { geom: _geom, ...columns } = getTableColumns(submissions);

    const result = await queryDb
        .update(submissions)
        .set({
            status: newStatus,
            verifikator,
            updatedAt: new Date(),
        })
        .where(eq(submissions.id, id))
        .returning(columns);

    if (result[0]) {
        // Insert into status_history
        await queryDb.insert(statusHistory).values({
            submissionId: id,
            statusBefore: previous?.status ?? newStatus,
            statusAfter: newStatus,
            petugas: verifikator,
            alasan,
            feedback,
        });
    }

    return result[0];
}

export async function getSubmissionOverlaps(submissionId: number, tx?: DBTransaction) {
    const queryDb = tx || db;

    // Select explicit columns instead of findMany(): the latter also reads
    // `intersectionGeom`, and drizzle's geometry() type only parses Point, so a
    // cached Polygon intersection would throw "Unsupported geometry type".
    const { intersectionGeom: _geom, ...columns } = getTableColumns(overlapResults);
    return queryDb
        .select(columns)
        .from(overlapResults)
        .where(eq(overlapResults.submissionId, submissionId));
}

/** Remove cached overlap rows for a submission (used before recomputing on edit). */
export async function deleteSubmissionOverlaps(submissionId: number, tx?: DBTransaction) {
    const queryDb = tx || db;
    await queryDb.delete(overlapResults).where(eq(overlapResults.submissionId, submissionId));
}

export async function getKPIDataScoped(filters: SubmissionDashboardFilters, tx?: DBTransaction) {
    const queryDb = tx || db;
    const conditions = buildSubmissionConditions(filters);
    const result = await queryDb
        .select({
            status: submissions.status,
            count: sql`count(*)`.mapWith(String),
        })
        .from(submissions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(submissions.status);

    return result;
}

/**
 * Per-desa breakdown for the external statistics API — counts only, no
 * applicant data. The join to `villages` is an INNER join, so submissions that
 * were never assigned a desa are left out; the totals here can therefore be
 * lower than the overall KPI total, which is the honest reading of "per desa".
 *
 * The status columns use `count(*) FILTER (...)` so the whole breakdown is one
 * pass over the table instead of five queries. `status` is cast to text because
 * comparing a pgEnum column against a bound parameter otherwise depends on
 * Postgres inferring the enum type for that parameter.
 */
export async function getStatsByVillage(
    filters: SubmissionDashboardFilters = {},
    tx?: DBTransaction
) {
    const queryDb = tx || db;
    const conditions = buildSubmissionConditions(filters);

    const countWhereStatus = (status: StatusSPPTG) =>
        sql<number>`count(*) FILTER (WHERE ${submissions.status}::text = ${status})::int`;

    return queryDb
        .select({
            desaId: villages.id,
            desa: villages.namaDesa,
            kecamatan: villages.kecamatan,
            total: sql<number>`count(*)::int`,
            terdata: countWhereStatus('SPPTG terdata'),
            terdaftar: countWhereStatus('SPPTG terdaftar'),
            ditolak: countWhereStatus('SPPTG ditolak'),
            ditinjauUlang: countWhereStatus('SPPTG ditinjau ulang'),
            terbit: countWhereStatus('Terbit SPPTG'),
        })
        .from(submissions)
        .innerJoin(villages, eq(villages.id, submissions.villageId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(villages.id, villages.namaDesa, villages.kecamatan)
        .orderBy(sql`count(*) DESC`, villages.namaDesa);
}

/**
 * Per-desa recap of **approved** SPPTG (`SPPTG terdaftar`) for the public
 * landing page.
 *
 * Deliberately its own query rather than a call into `getStatsByVillage` with a
 * status filter: this one runs for anonymous visitors, so the safe thing is a
 * select list that *cannot* return an applicant column — no nama, no NIK, no
 * alamat, no geometry, only counts and summed area per desa.
 *
 * `is_valid` is required for the same reason the dashboard requires it: a
 * pengajuan that is being re-edited is known to be superseded, and publishing it
 * would advertise a boundary the office itself no longer stands behind.
 *
 * `luas` (the area computed from the polygon) is summed rather than
 * `luas_manual`, because it is NOT NULL for every row and is what the map and
 * the overlap check are based on.
 */
export async function getRegisteredStatsByVillage(tx?: DBTransaction) {
    const queryDb = tx || db;

    return queryDb
        .select({
            desa: villages.namaDesa,
            kecamatan: villages.kecamatan,
            // Grouped per year as well, so the landing page's "Pilih Tahun
            // Laporan" filter can be applied in the browser without another
            // round trip: a year is a sum of these rows, "semua tahun" is all of
            // them. The register is a few thousand rows across a handful of
            // years, so the extra rows cost nothing.
            tahun: sql<number>`EXTRACT(YEAR FROM ${submissions.tanggalPengajuan})::int`,
            total: sql<number>`count(*)::int`,
            luasM2: sql<number>`COALESCE(SUM(${submissions.luas}), 0)::float8`,
        })
        .from(submissions)
        .innerJoin(villages, eq(villages.id, submissions.villageId))
        .where(
            and(
                sql`${submissions.status}::text = ${'SPPTG terdaftar' satisfies StatusSPPTG}`,
                eq(submissions.isValid, true)
            )
        )
        .groupBy(
            villages.id,
            villages.namaDesa,
            villages.kecamatan,
            sql`EXTRACT(YEAR FROM ${submissions.tanggalPengajuan})`
        )
        .orderBy(sql`count(*) DESC`, villages.namaDesa);
}

/**
 * Boundaries of approved SPPTG for the landing page's public map, with the four
 * fields its info window is allowed to show.
 *
 * The select list is the whole security boundary here, so it is written out
 * explicitly and deliberately short: **desa, kecamatan, luas, penggunaan lahan
 * and the year** — the parcel, not the person. `nama_pemilik`, `nik`, `alamat`,
 * `nomor_hp`, `email` and the submission id must never be added; there is no
 * caller-side filter behind this one, whatever it returns is public.
 *
 * `ST_Simplify` at ~1e-5° (roughly a metre at this latitude) keeps the payload
 * small enough to ship inside the prerendered HTML without visibly moving a
 * boundary; the map is a kabupaten-wide overview, not a survey document. The
 * limit is a backstop so the page cannot grow unbounded as the register does.
 */
export async function getRegisteredPolygons(batas = 3000, tx?: DBTransaction) {
    const queryDb = tx || db;

    const rows = await queryDb
        .select({
            geojson: sql<string>`ST_AsGeoJSON(ST_Simplify(${submissions.geom}, 0.00001), 6)`,
            desa: villages.namaDesa,
            kecamatan: villages.kecamatan,
            luas: submissions.luas,
            penggunaanLahan: submissions.penggunaanLahan,
            tahun: sql<number>`EXTRACT(YEAR FROM ${submissions.tanggalPengajuan})::int`,
        })
        .from(submissions)
        .leftJoin(villages, eq(villages.id, submissions.villageId))
        .where(
            and(
                sql`${submissions.status}::text = ${'SPPTG terdaftar' satisfies StatusSPPTG}`,
                eq(submissions.isValid, true),
                sql`${submissions.geom} IS NOT NULL`
            )
        )
        .limit(batas);

    // Parsed here rather than in the browser so a malformed row is dropped on
    // the server instead of throwing inside the map component.
    const polygons: {
        ring: number[][];
        desa: string | null;
        kecamatan: string | null;
        luasM2: number;
        penggunaanLahan: string | null;
        tahun: number | null;
    }[] = [];

    for (const row of rows) {
        if (!row.geojson) continue;
        try {
            const parsed = JSON.parse(row.geojson) as {
                type: string;
                coordinates: number[][][][] | number[][][];
            };
            const parts =
                parsed.type === 'MultiPolygon'
                    ? (parsed.coordinates as number[][][][])
                    : [parsed.coordinates as number[][][]];
            for (const part of parts) {
                // Outer ring only — holes are not meaningful at this zoom and
                // doubling the payload to draw them would be.
                const ring = part[0];
                if (!Array.isArray(ring) || ring.length < 3) continue;
                polygons.push({
                    ring,
                    desa: row.desa,
                    kecamatan: row.kecamatan,
                    // `luas` is the whole pengajuan's area; a multi-bidang row
                    // repeats it on each part rather than pretending to know how
                    // it splits, which the column does not record.
                    luasM2: row.luas,
                    penggunaanLahan: row.penggunaanLahan,
                    tahun: row.tahun,
                });
            }
        } catch {
            continue;
        }
    }

    return polygons;
}

export async function getMonthlyStats(
    filters: SubmissionDashboardFilters = {},
    tx?: DBTransaction
) {
    const queryDb = tx || db;
    const conditions = buildSubmissionConditions(filters);
    const result = await queryDb
        .select({
            month: sql<string>`TO_CHAR(${submissions.tanggalPengajuan}, 'YYYY-MM')`,
            // ::int matters — a bare count(*) is bigint, which node-postgres
            // returns as a *string*. Recharts then compares those lexically
            // ("10" < "8"), capping the Y axis at 8 and clipping bigger months.
            count: sql<number>`count(*)::int`,
        })
        .from(submissions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(sql`TO_CHAR(${submissions.tanggalPengajuan}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${submissions.tanggalPengajuan}, 'YYYY-MM')`);

    return result;
}
