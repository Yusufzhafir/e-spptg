import { protectedProcedure, verifikatorProcedure, router } from '../../init';
import { z } from 'zod';
import {
    createSubmissionFromDraftSchema,
    updateSubmissionStatusSchema,
    listSubmissionsSchema,
    dashboardFilterSchema,
} from '@/lib/validation';
import * as submissionQueries from '@/server/db/queries/submissions';
import * as draftQueries from '@/server/db/queries/drafts';
import * as documentQueries from '@/server/db/queries/documents';
import * as notificationQueries from '@/server/db/queries/notifications';
import { computeOverlaps } from '@/server/postgis';
import { sql, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { normalizeOverlapRows } from '@/lib/overlap-results';
import { deriveSubmissionStatus } from '@/lib/submission-status';
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
                        // Step 4 (Terbitkan SPPTG) results
                        nomorSPPTG?: string;
                        tanggalTerbit?: string;
                        dokumenSPPTG?: { documentId?: number } | null;
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

                    // Build submission data. See deriveSubmissionStatus: a
                    // completed Step 4 issues the certificate ('Terbit SPPTG'),
                    // otherwise the Step 3 decision applies.
                    const submissionStatus = deriveSubmissionStatus(payload);

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
                        // Snapshot the full draft payload so the submission can be edited later
                        payload: draft.payload,
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
                    const geomSql = sql.raw(`ST_PolygonFromText('POLYGON((${coordinates}))',4326)`);

                    // When the draft was opened to edit an existing submission,
                    // update that submission in place instead of creating a new one.
                    const editingSubmissionId = draft.editingSubmissionId ?? null;
                    let submissionId: number | undefined;
                    let notifOwnerUserId: number | null = draft.userId;

                    if (editingSubmissionId) {
                        const existing = await submissionQueries.getSubmissionById(editingSubmissionId, tx);
                        if (!existing) {
                            throw new TRPCError({
                                code: 'NOT_FOUND',
                                message: 'Pengajuan yang diedit tidak ditemukan',
                            });
                        }
                        assertCanAccessSubmission(ctx.appUser!, {
                            ownerUserId: existing.ownerUserId,
                            villageId: existing.villageId,
                        });
                        notifOwnerUserId = existing.ownerUserId;

                        const existingRiwayat = Array.isArray(existing.riwayat) ? existing.riwayat : [];
                        await tx
                            .update(submissionsTable)
                            .set({
                                namaPemilik: submissionData.namaPemilik,
                                nik: submissionData.nik,
                                alamat: submissionData.alamat,
                                nomorHP: submissionData.nomorHP,
                                email: submissionData.email,
                                villageId: submissionData.villageId,
                                kecamatan: submissionData.kecamatan,
                                kabupaten: submissionData.kabupaten,
                                luas: submissionData.luas,
                                luasManual: submissionData.luasManual,
                                penggunaanLahan: submissionData.penggunaanLahan,
                                catatan: submissionData.catatan,
                                status: submissionData.status,
                                verifikator: ctx.appUser!.id,
                                geoJSON: submissionData.geoJSON,
                                payload: submissionData.payload,
                                geom: geomSql,
                                riwayat: [
                                    ...existingRiwayat,
                                    {
                                        tanggal: new Date().toISOString(),
                                        status: submissionData.status,
                                        petugas: ctx.appUser!.nama,
                                        alasan: 'Pengajuan diperbarui',
                                    },
                                ],
                                updatedAt: new Date(),
                            })
                            .where(eq(submissionsTable.id, editingSubmissionId));
                        submissionId = editingSubmissionId;

                        // Clear stale overlap rows before recomputing
                        await submissionQueries.deleteSubmissionOverlaps(editingSubmissionId, tx);
                    } else {
                        const submissionResult = await tx
                            .insert(submissionsTable)
                            .values({
                                ...submissionData,
                                geom: geomSql,
                            }).returning({ id: submissionsTable.id })
                        submissionId = submissionResult[0]?.id;
                    }

                    if (!submissionId) {
                        throw new TRPCError({
                            code: 'INTERNAL_SERVER_ERROR',
                            message: 'Gagal membuat submission',
                        });
                    }

                    // Record a notification for this create/update event
                    await notificationQueries.createNotification(
                        {
                            submissionId,
                            type: editingSubmissionId ? 'updated' : 'created',
                            status: submissionData.status,
                            namaPemilik: submissionData.namaPemilik,
                            villageId: draftVillageId,
                            ownerUserId: notifOwnerUserId,
                            actorUserId: ctx.appUser!.id,
                        },
                        tx
                    );

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
                desaKecamatan: submission.desaKecamatan,
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
                desaId: input.desaId,
                kecamatan: input.kecamatan,
                dateFrom: input.dateFrom,
                dateTo: input.dateTo,
                ownerUserId: scope.ownerUserId,
                villageId: scope.villageId,
                scopeKecamatan: scope.scopeKecamatan,
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
                desaKecamatan: submission.desaKecamatan,
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
                        s.status::text AS status,
                        ST_MakeValid(s.geom) AS geom
                    FROM submissions s
                    WHERE s.status IN ('SPPTG terdaftar', 'SPPTG terdata')
                    AND s.is_valid = true
                    AND s.geom IS NOT NULL
                )
                SELECT 
                    pg.id AS kawasan_id,
                    pg.nama_kawasan,
                    pg.jenis_kawasan::text AS jenis_kawasan,
                    ST_Area(ST_Intersection(ig.geom, pg.geom)::geography)::double precision AS luas_overlap,
                    (ST_Area(ST_Intersection(ig.geom, pg.geom)::geography) / NULLIF(ST_Area(ig.geom::geography), 0) * 100)::double precision as percentage_overlap,
                    'ProhibitedArea' as sumber
                FROM prohibited_geom pg
                CROSS JOIN input_geom ig
                WHERE ST_Intersects(ig.geom, pg.geom)

                UNION ALL

                SELECT
                    sg.id AS kawasan_id,
                    sg.nama_pemilik AS nama_kawasan,
                    sg.status AS jenis_kawasan,
                    ST_Area(ST_Intersection(ig.geom, sg.geom)::geography)::double precision AS luas_overlap,
                    (ST_Area(ST_Intersection(ig.geom, sg.geom)::geography) / NULLIF(ST_Area(ig.geom::geography), 0) * 100)::double precision as percentage_overlap,
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
                    desaKecamatan: submission.desaKecamatan,
                });

                // Rejecting or sending back for revision must be justified —
                // enforce it here, not just in the UI, so a direct API call
                // cannot leave an unexplained entry in the audit trail.
                const requiresReason =
                    input.newStatus === 'SPPTG ditolak' ||
                    input.newStatus === 'SPPTG ditinjau ulang';
                if (requiresReason && !input.alasan?.trim()) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: `Alasan wajib diisi untuk status "${input.newStatus}".`,
                    });
                }

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

    updateValidity: verifikatorProcedure
        .input(z.object({
            submissionId: z.number().int(),
            isValid: z.boolean(),
        }))
        .mutation(async ({ ctx, input }) => {
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
                desaKecamatan: submission.desaKecamatan,
            });

            const result = await submissionQueries.updateSubmissionValidity(
                input.submissionId,
                input.isValid
            );
            return {
                success: true,
                submission: result,
            };
        }),

    // KPI cards + "Jumlah SPPTG per Status" chart. Accepts the dashboard filters
    // so the numbers always describe the same set as the Daftar Pengajuan table.
    kpi: protectedProcedure
        .input(dashboardFilterSchema)
        .query(async ({ ctx, input }) => {
            const scope = getSubmissionScopeForUser(ctx.appUser!);
            // onlyValid: invalid entries are hidden from the map, so counting
            // them here would contradict what the user sees.
            const data = await submissionQueries.getKPIDataScoped({
                ...input,
                ...scope,
                onlyValid: true,
            });
            const kpi = {
                'SPPTG terdata': 0,
                'SPPTG terdaftar': 0,
                'SPPTG ditolak': 0,
                'SPPTG ditinjau ulang': 0,
                'Terbit SPPTG': 0,
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

    // "Tren Pengajuan" chart — same filter set as the KPI query.
    monthlyStats: protectedProcedure
        .input(dashboardFilterSchema)
        .query(async ({ ctx, input }) => {
            const scope = getSubmissionScopeForUser(ctx.appUser!);
            return submissionQueries.getMonthlyStats({
                ...input,
                ...scope,
                onlyValid: true,
            });
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
