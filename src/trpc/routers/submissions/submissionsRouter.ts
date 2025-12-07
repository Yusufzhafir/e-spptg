import { protectedProcedure, verifikatorProcedure, router } from '../../init';
import { z } from 'zod';
import {
    createSubmissionFromDraftSchema,
    updateSubmissionStatusSchema,
    listSubmissionsSchema,
} from '@/lib/validation';
import * as submissionQueries from '@/server/db/queries/submissions';
import * as draftQueries from '@/server/db/queries/drafts';
import * as documentQueries from '@/server/db/queries/documents';
import { computeOverlaps } from '@/server/postgis';
import { sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const submissionsRouter = router({
    /**
     * Submit a draft and create a final submission
     * Uses transaction to ensure atomicity
     */
    submitDraft: protectedProcedure
        .input(createSubmissionFromDraftSchema)
        .mutation(async ({ ctx, input }) => {
            // Wrap all database operations in a transaction
            // This ensures that if any operation fails, all changes are rolled back
            return await ctx.db.transaction(async (tx) => {
                try {
                    const draft = await draftQueries.getDraftById(
                        input.draftId,
                        ctx.appUser!.id,
                        tx
                    );

                    if (!draft) {
                        throw new TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Draft tidak ditemukan',
                        });
                    }

                    const payload = draft.payload as any;

                    // Validate required fields
                    if (!payload.namaPemohon || !payload.nik) {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'Nama dan NIK pemohon diperlukan',
                        });
                    }

                    if (!payload.coordinatesGeografis || payload.coordinatesGeografis.length < 3) {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'Minimal 3 titik koordinat diperlukan',
                        });
                    }

                    // Build submission data
                    const submissionData = {
                        namaPemilik: payload.namaPemohon,
                        nik: payload.nik,
                        alamat: payload.alamat || '',
                        nomorHP: payload.juruUkur?.nomorHP || '',
                        email: payload.email || '',
                        villageId: payload.villageId || 1, // Default to first village
                        kecamatan: payload.kecamatan || '',
                        kabupaten: payload.kabupaten || 'Cirebon',
                        luas: payload.luasLahan || 0,
                        penggunaanLahan: payload.penggunaanLahan || '',
                        catatan: payload.catatan ?? null,
                        status: 'SPPTG terdata' as const,
                        tanggalPengajuan: new Date(),
                        verifikator: ctx.appUser!.id,
                        geoJSON: buildGeometryFromCoordinates(payload),
                        riwayat: [
                            {
                                tanggal: new Date().toISOString(),
                                status: 'SPPTG terdata',
                                petugas: ctx.appUser!.nama,
                                alasan: null,
                            },
                        ],
                    };

                    // Get GeoJSON
                    const geoJson = submissionData.geoJSON;
                    if (!geoJson) {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'Koordinat tidak valid',
                        });
                    }

                    // Insert submission with geometry
                    const { submissions: submissionsTable } = await import(
                        '@/server/db/schema'
                    );

                    const coordinates = geoJson.coordinates[0].map((c) => `${c[0]} ${c[1]}`).join(',')

                    const submissionResult = await tx
                        .insert(submissionsTable)
                        .values({
                            ...submissionData,
                            geom: sql.raw(`ST_PolygonFromText('POLYGON((${coordinates}))',4326)`),
                        }).returning({ id: submissionsTable.id })

                    console.log("this is submissionResult", submissionResult)
                    const submissionId = submissionResult[0]?.id;

                    if (!submissionId) {
                        throw new TRPCError({
                            code: 'INTERNAL_SERVER_ERROR',
                            message: 'Gagal membuat submission',
                        });
                    }

                    // Compute overlaps (pass transaction)
                    await computeOverlaps(submissionId, tx);

                    // Move documents from draft to submission (pass transaction)
                    const draftDocuments = await documentQueries.listDocumentsByDraft(
                        input.draftId,
                        tx
                    );
                    for (const doc of draftDocuments) {
                        await documentQueries.updateDocumentSubmissionId(
                            doc.id,
                            submissionId,
                            tx
                        );
                    }

                    // Get overlaps (pass transaction)
                    const overlaps = await submissionQueries.getSubmissionOverlaps(submissionId, tx);
                    return {
                        submissionId,
                        status: submissionData.status,
                        overlaps: overlaps.map((o) => ({
                            kawasanId: o.prohibitedAreaId,
                            namaKawasan: o.namaKawasan,
                            jenisKawasan: o.jenisKawasan,
                            luasOverlap: o.luasOverlap,
                            percentageOverlap: o.percentageOverlap,
                        })),
                    };
                } catch (error) {
                    if (error instanceof TRPCError) throw error;
                    console.error('Error submitting draft:', error);
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Gagal menyimpan pengajuan',
                    });
                }
            });
        }),

    byId: protectedProcedure
        .input(z.object({ id: z.number().int() }))
        .query(async ({ input }) => {
            const submission = await submissionQueries.getSubmissionById(input.id);
            if (!submission) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Pengajuan tidak ditemukan',
                });
            }
            return submission;
        }),

    list: protectedProcedure
        .input(listSubmissionsSchema)
        .query(async ({ input }) => {
            return submissionQueries.listSubmissions({
                search: input.search,
                status: input.status,
                limit: input.limit,
                offset: input.offset,
            });
        }),

    getOverlaps: protectedProcedure
        .input(z.object({ submissionId: z.number().int() }))
        .query(async ({ input }) => {
            const overlaps = await submissionQueries.getSubmissionOverlaps(
                input.submissionId
            );
            return overlaps.map((o) => ({
                kawasanId: o.prohibitedAreaId,
                namaKawasan: o.namaKawasan,
                jenisKawasan: o.jenisKawasan,
                luasOverlap: o.luasOverlap,
                percentageOverlap: o.percentageOverlap,
            }));
        }),

    checkOverlapsFromCoordinates: protectedProcedure
        .input(z.object({
            coordinates: z.array(z.object({
                latitude: z.number(),
                longitude: z.number(),
            })).min(3),
        }))
        .mutation(async ({ ctx, input }) => {
            // Build GeoJSON polygon from coordinates
            const coords = input.coordinates.map((c) => [c.longitude, c.latitude]);
            const closedCoords = [...coords, coords[0]];
            const geoJson = {
                type: 'Polygon' as const,
                coordinates: [closedCoords],
            };

            // Define Zod schema for validation of database result rows
            const OverlapResultSchema = z.object({
                kawasan_id: z.number().or(z.string()).transform((v) => Number(v)), // ID might be numeric or string from DB
                nama_kawasan: z.string(),
                jenis_kawasan: z.string(),
                luas_overlap: z.number().nullable().transform((v) => v === null ? 0 : Number(v)),
                percentage_overlap: z.number().nullable().optional().transform((v) => v === null ? undefined : Number(v)),
                sumber: z.enum(['ProhibitedArea', 'Submission']),
            });

            const OverlapResultArraySchema = z.array(OverlapResultSchema);

            // Query prohibited areas and existing submissions
            const intersectSql = sql`
                -- Prohibited areas
                SELECT 
                    pa.id AS kawasan_id,
                    pa.nama_kawasan,
                    pa.jenis_kawasan,
                    ST_Area(ST_Intersection(
                        ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326),
                        pa.geom
                    ))::double precision AS luas_overlap,
                    (ST_Area(ST_Intersection(
                        ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326),
                        pa.geom
                    )) / NULLIF(ST_Area(ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326)), 0) * 100)::double precision as percentage_overlap,
                    'ProhibitedArea' as sumber
                FROM prohibited_areas pa
                WHERE ST_Intersects(
                    ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326),
                    pa.geom
                )
                AND pa.aktif_di_validasi = true

                UNION ALL

                -- Existing submissions (SPPTG Terdata or SPPTG Terdaftar)
                SELECT
                    s.id AS kawasan_id,
                    s.nama_pemohon AS nama_kawasan,
                    'SPPTG Eksisting' AS jenis_kawasan,
                    ST_Area(ST_Intersection(
                        ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326),
                        s.geom
                    ))::double precision AS luas_overlap,
                    (ST_Area(ST_Intersection(
                        ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326),
                        s.geom
                    )) / NULLIF(ST_Area(ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326)), 0) * 100)::double precision as percentage_overlap,
                    'Submission' as sumber
                FROM submissions s
                WHERE 
                    s.status IN ('SPPTG terdaftar', 'SPPTG terdata')
                    AND s.geom IS NOT NULL
                    AND ST_Intersects(
                        ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326),
                        s.geom
                    )
            `;

            const result = await ctx.db.execute(intersectSql);

            // Validate and transform result using Zod
            const overlaps = OverlapResultArraySchema.parse(result.rows || []);

            return overlaps.map((row) => ({
                kawasanId: row.kawasan_id,
                namaKawasan: row.nama_kawasan,
                jenisKawasan: row.jenis_kawasan,
                luasOverlap: row.luas_overlap,
                percentageOverlap: row.percentage_overlap,
                sumber: row.sumber,
            }));
        }),

    updateStatus: verifikatorProcedure
        .input(updateSubmissionStatusSchema)
        .mutation(async ({ ctx, input }) => {
            try {
                const result = await submissionQueries.updateSubmissionStatus(
                    input.submissionId,
                    input.newStatus,
                    ctx.appUser!.id,
                    input.alasan,
                    input.feedback
                );
                return {
                    success: true,
                    submission: result,
                };
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Gagal memperbarui status',
                });
            }
        }),

    kpi: protectedProcedure.query(async ({ ctx }) => {
        const data = await submissionQueries.getKPIData();
        const kpi = {
            'SPPTG terdata': 0,
            'SPPTG terdaftar': 0,
            'SPPTG ditolak': 0,
            'SPPTG ditinjau ulang': 0,
            total: 0,
        };

        data.forEach((item: any) => {
            if (item.status in kpi) {
                kpi[item.status as keyof typeof kpi] = item.count;
                kpi.total += item.count;
            }
        });

        return kpi;
    }),

    monthlyStats: protectedProcedure.query(async ({ ctx }) => {
        return submissionQueries.getMonthlyStats();
    }),
});

function buildGeometryFromCoordinates(payload: object) {
    if (!('coordinatesGeografis' in payload) || !Array.isArray(payload.coordinatesGeografis)) {
        return null
    }
    const coordinates = payload.coordinatesGeografis || [];
    if (coordinates.length < 3) {
        return null;
    }

    const coords = coordinates.map((c) => [
        c.longitude,
        c.latitude,
    ]);

    const closedCoords = [...coords, coords[0]];

    return {
        type: 'Polygon',
        coordinates: [closedCoords],
    };
}