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
import { normalizeOverlapRows } from '@/lib/overlap-results';
import {
    assertCanAccessDraft,
    assertCanAccessSubmission,
    getSubmissionScopeForUser,
    isPrivilegedProcessor,
    isViewer,
    requireAssignedVillageId,
} from '@/server/authz';

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
                    const draft = await draftQueries.getDraftById(input.draftId, tx);

                    if (!draft) {
                        throw new TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Draft tidak ditemukan',
                        });
                    }

                    assertCanAccessDraft(ctx.appUser!, {
                        userId: draft.userId,
                        villageId: draft.villageId,
                    });

                    if (isViewer(ctx.appUser!)) {
                        throw new TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Viewer tidak dapat melanjutkan pengajuan ke tahap ini.',
                        });
                    }

                    const payload = (draft.payload ?? {}) as {
                        namaPemohon?: string;
                        nik?: string;
                        alamat?: string;
                        email?: string;
                        villageId?: number;
                        kecamatan?: string;
                        kabupaten?: string;
                        luasLahan?: number;
                        luasManual?: number;
                        penggunaanLahan?: string;
                        catatan?: string | null;
                        status?: string;
                        juruUkur?: { nomorHP?: string };
                        coordinatesGeografis?: Array<{ latitude: number; longitude: number }>;
                    };

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

                    const draftVillageId =
                        draft.villageId ??
                        (typeof payload.villageId === 'number' ? payload.villageId : null);

                    if (!draftVillageId) {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'Desa pada Step 1 wajib dipilih sebelum submit.',
                        });
                    }

                    if (isPrivilegedProcessor(ctx.appUser!)) {
                        const assignedVillageId = requireAssignedVillageId(ctx.appUser!);
                        if (assignedVillageId !== draftVillageId) {
                            throw new TRPCError({
                                code: 'FORBIDDEN',
                                message: 'Anda hanya dapat memproses draft pada desa yang ditetapkan.',
                            });
                        }
                    }

                    // Build submission data
                    // Use status from draft payload if valid, otherwise default to 'SPPTG terdata'
                    const validStatuses = ['SPPTG terdata', 'SPPTG terdaftar', 'SPPTG ditolak', 'SPPTG ditinjau ulang'] as const;
                    const submissionStatus = (payload.status && validStatuses.includes(payload.status as typeof validStatuses[number]))
                        ? (payload.status as typeof validStatuses[number])
                        : 'SPPTG terdata' as const;

                    const submissionData = {
                        namaPemilik: payload.namaPemohon,
                        nik: payload.nik,
                        alamat: payload.alamat || '',
                        nomorHP: payload.juruUkur?.nomorHP || '',
                        email: payload.email || '',
                        villageId: draftVillageId,
                        kecamatan: payload.kecamatan || '',
                        kabupaten: payload.kabupaten || 'Cirebon',
                        luas: payload.luasLahan || 0,
                        luasManual: payload.luasManual || 0,
                        penggunaanLahan: payload.penggunaanLahan || '',
                        catatan: payload.catatan ?? null,
                        status: submissionStatus,
                        tanggalPengajuan: new Date(),
                        ownerUserId: draft.userId,
                        verifikator: ctx.appUser!.id,
                        geoJSON: buildGeometryFromCoordinates(payload),
                        riwayat: [
                            {
                                tanggal: new Date().toISOString(),
                                status: submissionStatus,
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
                    
                    // Delete draft after successful submission
                    // Documents have already been moved to submission, so only delete the draft record
                    await draftQueries.deleteDraft(input.draftId, tx);
                    
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
        .query(async ({ ctx, input }) => {
            const submission = await submissionQueries.getSubmissionById(input.id);
            if (!submission) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Pengajuan tidak ditemukan',
                });
            }

            assertCanAccessSubmission(ctx.appUser!, {
                ownerUserId: submission.ownerUserId,
                villageId: submission.villageId,
            });

            return submission;
        }),

    list: protectedProcedure
        .input(listSubmissionsSchema)
        .query(async ({ ctx, input }) => {
            const scope = getSubmissionScopeForUser(ctx.appUser!);
            return submissionQueries.listSubmissions({
                search: input.search,
                status: input.status,
                ownerUserId: scope.ownerUserId,
                villageId: scope.villageId,
                limit: input.limit,
                offset: input.offset,
            });
        }),

    getOverlaps: protectedProcedure
        .input(z.object({ submissionId: z.number().int() }))
        .query(async ({ ctx, input }) => {
            const submission = await submissionQueries.getSubmissionById(input.submissionId);
            if (!submission) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Pengajuan tidak ditemukan',
                });
            }

            assertCanAccessSubmission(ctx.appUser!, {
                ownerUserId: submission.ownerUserId,
                villageId: submission.villageId,
            });

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
            if (isPrivilegedProcessor(ctx.appUser!)) {
                requireAssignedVillageId(ctx.appUser!);
            }

            // Build GeoJSON polygon from coordinates
            const coords = input.coordinates.map((c) => [c.longitude, c.latitude]);
            const closedCoords = [...coords, coords[0]];
            const geoJson = {
                type: 'Polygon' as const,
                coordinates: [closedCoords],
            };

            // Query prohibited areas and existing submissions
            const geoJsonText = JSON.stringify(geoJson);
            const intersectSql = sql`
                WITH input_geom AS (
                    SELECT ST_SetSRID(ST_MakeValid(ST_GeomFromGeoJSON(${geoJsonText})), 4326) AS geom
                ),
                prohibited_geom AS (
                    SELECT
                        pa.id,
                        pa.nama_kawasan,
                        pa.jenis_kawasan,
                        ST_MakeValid(pa.geom) AS geom
                    FROM prohibited_areas pa
                    WHERE pa.aktif_di_validasi = true
                    AND pa.geom IS NOT NULL
                ),
                submission_geom AS (
                    SELECT
                        s.id,
                        s.nama_pemilik,
                        ST_MakeValid(s.geom) AS geom
                    FROM submissions s
                    WHERE s.status IN ('SPPTG terdaftar', 'SPPTG terdata')
                    AND s.geom IS NOT NULL
                )
                SELECT 
                    pg.id AS kawasan_id,
                    pg.nama_kawasan,
                    pg.jenis_kawasan::text AS jenis_kawasan,
                    ST_Area(ST_Intersection(ig.geom, pg.geom))::double precision AS luas_overlap,
                    (ST_Area(ST_Intersection(ig.geom, pg.geom)) / NULLIF(ST_Area(ig.geom), 0) * 100)::double precision as percentage_overlap,
                    'ProhibitedArea' as sumber
                FROM prohibited_geom pg
                CROSS JOIN input_geom ig
                WHERE ST_Intersects(ig.geom, pg.geom)

                UNION ALL

                SELECT
                    sg.id AS kawasan_id,
                    sg.nama_pemilik AS nama_kawasan,
                    'SPPTG Eksisting' AS jenis_kawasan,
                    ST_Area(ST_Intersection(ig.geom, sg.geom))::double precision AS luas_overlap,
                    (ST_Area(ST_Intersection(ig.geom, sg.geom)) / NULLIF(ST_Area(ig.geom), 0) * 100)::double precision as percentage_overlap,
                    'Submission' as sumber
                FROM submission_geom sg
                CROSS JOIN input_geom ig
                WHERE ST_Intersects(ig.geom, sg.geom)
            `;

            const result = await ctx.db.execute(intersectSql);
            return normalizeOverlapRows(result.rows || []);
        }),

    updateStatus: verifikatorProcedure
        .input(updateSubmissionStatusSchema)
        .mutation(async ({ ctx, input }) => {
            try {
                const submission = await submissionQueries.getSubmissionById(input.submissionId);
                if (!submission) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Pengajuan tidak ditemukan',
                    });
                }

                assertCanAccessSubmission(ctx.appUser!, {
                    ownerUserId: submission.ownerUserId,
                    villageId: submission.villageId,
                });

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
                if (error instanceof TRPCError) {
                    throw error;
                }
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Gagal memperbarui status',
                });
            }
        }),

    kpi: protectedProcedure.query(async ({ ctx }) => {
        const scope = getSubmissionScopeForUser(ctx.appUser!);
        const data = await submissionQueries.getKPIDataScoped(scope);
        const kpi = {
            'SPPTG terdata': 0,
            'SPPTG terdaftar': 0,
            'SPPTG ditolak': 0,
            'SPPTG ditinjau ulang': 0,
            'total': 0,
        };

        data.forEach((item) => {
            const count = +item.count
            if (item.status in kpi && !Number.isNaN(count)) {
                kpi[item.status as keyof typeof kpi] = count;
                kpi.total += count;
            }
        });

        return kpi;
    }),

    monthlyStats: protectedProcedure.query(async ({ ctx }) => {
        const scope = getSubmissionScopeForUser(ctx.appUser!);
        return submissionQueries.getMonthlyStats(scope);
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
