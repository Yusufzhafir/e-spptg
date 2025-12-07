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
            try {
                const draft = await draftQueries.getDraftById(
                    input.draftId,
                    ctx.appUser!.id
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
                const submissionResult = await ctx.db
                    .insert(submissionsTable)
                    .values({
                        ...submissionData,
                        geom: sql`ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326)`,
                    })
                    .returning();

                const submissionId = submissionResult[0]?.id;
                if (!submissionId) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Gagal membuat submission',
                    });
                }

                // Compute overlaps
                await computeOverlaps(submissionId);

                // Move documents from draft to submission
                const draftDocuments = await documentQueries.listDocumentsByDraft(
                    input.draftId
                );
                for (const doc of draftDocuments) {
                    await documentQueries.updateDocumentSubmissionId(
                        doc.id,
                        submissionId
                    );
                }

                // Get overlaps
                const overlaps = await submissionQueries.getSubmissionOverlaps(submissionId);
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

            // Query prohibited areas that intersect with this polygon
            const { prohibitedAreas } = await import('@/server/db/schema');
            const result = await ctx.db.execute(
                sql`
                    SELECT 
                        pa.id,
                        pa.nama_kawasan,
                        pa.jenis_kawasan,
                        ST_Area(ST_Intersection(
                            ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326),
                            pa.geom
                        ))::double precision as luas_overlap,
                        (ST_Area(ST_Intersection(
                            ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326),
                            pa.geom
                        )) / NULLIF(ST_Area(ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326)), 0) * 100)::double precision as percentage_overlap
                    FROM prohibited_areas pa
                    WHERE ST_Intersects(
                        ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326),
                        pa.geom
                    )
                    AND pa.aktif_di_validasi = true;
                `
            );

            return (result.rows || []).map((row: any) => ({
                kawasanId: row.id,
                namaKawasan: row.nama_kawasan,
                jenisKawasan: row.jenis_kawasan,
                luasOverlap: parseFloat(row.luas_overlap) || 0,
                percentageOverlap: row.percentage_overlap ? parseFloat(row.percentage_overlap) : undefined,
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

function buildGeometryFromCoordinates(payload: any): any {
    const coordinates = payload.coordinatesGeografis || [];
    if (coordinates.length < 3) {
        return null;
    }

    const coords = coordinates.map((c: any) => [
        c.longitude,
        c.latitude,
    ]);

    const closedCoords = [...coords, coords[0]];

    return {
        type: 'Polygon',
        coordinates: [closedCoords],
    };
}