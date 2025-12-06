import { z } from 'zod';
import * as submissionQueries from '@/server/db/queries/submissions';
import * as draftQueries from '@/server/db/queries/drafts';
import * as documentQueries from '@/server/db/queries/documents';
import * as userQueries from '@/server/db/queries/user';
import { computeOverlaps } from '@/server/postgis';
import { sql } from 'drizzle-orm';
import { protectedProcedure, router, verifikatorProcedure } from '@/trpc/init';
import { createSubmissionFromDraftSchema, listSubmissionsSchema, submissionDraftPayloadSchema, updateSubmissionStatusSchema } from '@/lib/validation';

export const submissionsRouter = router({
    /**
     * Submit a draft and create a final submission
     * Uses transaction to ensure atomicity
     */
    submitDraft: protectedProcedure
        .input(createSubmissionFromDraftSchema)
        .mutation(async ({ ctx, input }) => {
            // Start a transaction
            const result = await ctx.db.transaction(async (tx) => {
                // All operations use tx instead of db
                const draft = await draftQueries.getDraftById(
                    input.draftId,
                    ctx.appUser!.id,
                    tx
                );

                if (!draft) {
                    throw new Error('Draft not found');
                }
                const user = await userQueries.getUserById(draft.userId)

                if (user === undefined) {
                    throw new Error("no such user")
                }
                const payload = draft.payload;

                const { data: payloadParsed, error } = submissionDraftPayloadSchema.safeParse(payload)

                if (error) {
                    throw error
                }

                if (!payloadParsed.namaPemohon || !payloadParsed.nik) {
                    throw new Error('Missing required fields');
                }

                // Build submission data
                const submissionData = {
                    namaPemilik: payloadParsed.namaPemohon,
                    nik: payloadParsed.nik,
                    nomorHP: payloadParsed.juruUkur?.nomorHP || '',
                    email: user.email || '',
                    alamat: "",
                    villageId: 10,
                    kecamatan: '',
                    kabupaten: 'Cirebon',
                    luas: payloadParsed.luasLahan || 0,
                    penggunaanLahan: '',
                    catatan: null,
                    status: 'SPPTG terdata' as const,
                    tanggalPengajuan: new Date(),
                    verifikator: payloadParsed.verifikator,
                    riwayat: [
                        {
                            tanggal: new Date().toISOString(),
                            status: 'SPPTG terdata',
                            petugas: ctx.appUser!.nama,
                            alasan: null,
                        },
                    ],
                };

                // Get geometry from coordinates
                const geoJson = buildGeometryFromCoordinates(payloadParsed.coordinatesGeografis);

                if (!geoJson) {
                    throw new Error('No valid coordinates provided');
                }

                // Insert submission with geometry (within transaction)
                const { submissions: submissionsTable } = await import(
                    '@/server/db/schema'
                );

                const submissionResult = await tx
                    .insert(submissionsTable)
                    .values({
                        ...submissionData,
                        geom: sql`ST_GeomFromGeoJSON(${JSON.stringify(geoJson)})::geometry(Polygon, 4326)`,
                        geoJSON: geoJson,
                    })
                    .returning();

                const submissionId = submissionResult[0]?.id;

                if (!submissionId) {
                    throw new Error('Failed to create submission');
                }

                // Compute overlaps (still need to use raw SQL or a dedicated method)
                // For now, assume computeOverlaps accepts tx as well
                await computeOverlaps(submissionId, tx);

                // Move documents from draft to submission
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

                // Get overlaps to return
                const overlaps = await submissionQueries.getSubmissionOverlaps(
                    submissionId,
                    tx
                );

                return {
                    submissionId,
                    status: submissionData.status,
                    overlaps,
                };
            });

            return result;
        }),

    byId: protectedProcedure
        .input(z.object({ id: z.number().int() }))
        .query(async ({ input }) => {
            return submissionQueries.getSubmissionById(input.id);
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
            return submissionQueries.getSubmissionOverlaps(input.submissionId);
        }),

    updateStatus: verifikatorProcedure
        .input(updateSubmissionStatusSchema)
        .mutation(async ({ ctx, input }) => {
            const result = await submissionQueries.updateSubmissionStatus(
                input.submissionId,
                input.newStatus,
                ctx.appUser!.id,
                input.alasan,
                input.feedback
            );

            return result;
        }),

    kpi: protectedProcedure.query(async () => {
        const data = await submissionQueries.getKPIData();

        const kpi = {
            'SPPTG terdata': 0,
            'SPPTG terdaftar': 0,
            'Ditolak': 0,
            'Ditinjau Ulang': 0,
            'Terbit SPPTG': 0,
        };

        let total = 0;

        data.forEach((item) => {
            if (item.status in kpi) {
                kpi[item.status as keyof typeof kpi] = item.count;
                total += item.count;
            }
        });

        return { ...kpi, total };
    }),

    monthlyStats: protectedProcedure.query(async () => {
        return submissionQueries.getMonthlyStats();
    }),
});

function buildGeometryFromCoordinates(payload: {
    latitude: number;
    longitude: number;
}[]) {
    const coordinates = payload || []

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