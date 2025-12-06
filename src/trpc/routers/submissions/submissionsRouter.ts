import { protectedProcedure, verifikatorProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createSubmissionFromDraftSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
} from '@/lib/validations';
import * as submissionQueries from '@/server/db/queries/submissions';
import * as draftQueries from '@/server/db/queries/drafts';
import * as documentQueries from '@/server/db/queries/documents';
import { computeOverlaps } from '@/server/postgis';
import { sql } from 'drizzle-orm';

export const submissionsRouter = router({
  /**
   * Submit a draft and create a final submission
   * Handles:
   * - Geometry conversion
   * - Overlap detection
   * - Document relinking
   */
  submitDraft: protectedProcedure
    .input(createSubmissionFromDraftSchema)
    .mutation(async ({ ctx, input }) => {
      const draft = await draftQueries.getDraftById(
        input.draftId,
        ctx.appUser!.id
      );

      if (!draft) {
        throw new Error('Draft not found');
      }

      const payload = draft.payload as any;

      // Validate required fields
      if (!payload.namaPemohon || !payload.nik) {
        throw new Error('Missing required fields');
      }

      // Build submission data
      const submissionData = {
        namaPemilik: payload.namaPemohon,
        nik: payload.nik,
        alamat: payload.alamat || '',
        nomorHP: payload.juruUkur?.nomorHP || '',
        email: payload.email || '',
        villageId: payload.villageId || null,
        kecamatan: payload.kecamatan || '',
        kabupaten: payload.kabupaten || 'Cirebon',
        luas: payload.luasLahan || 0,
        penggunaanLahan: payload.penggunaanLahan || '',
        catatan: payload.catatan || null,
        status: 'SPPTG terdata',
        tanggalPengajuan: new Date(),
        verifikator: null,
        riwayat: [
          {
            tanggal: new Date().toISOString(),
            status: 'SPPTG terdata',
            petugas: ctx.appUser!.nama,
            alasan: null,
          },
        ],
      };

      // Get GeoJSON from coordinates
      const geoJson = buildGeometryFromCoordinates(payload);

      if (!geoJson) {
        throw new Error('No valid coordinates provided');
      }

      // Insert submission with geometry
      const submissionResult = await ctx.db
        .insert(await import('@/server/db/schema').then(m => m.submissions))
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

      // Optionally delete draft or mark as completed
      // For now, keep it for reference

      // Get overlaps to return
      const overlaps = await submissionQueries.getSubmissionOverlaps(submissionId);

      return {
        submissionId,
        status: submissionData.status,
        overlaps,
      };
    }),

  /**
   * Get a single submission by ID
   */
  byId: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const submission = await submissionQueries.getSubmissionById(input.id);
      return submission;
    }),

  /**
   * List all submissions with filters and pagination
   */
  list: protectedProcedure
    .input(listSubmissionsSchema)
    .query(async ({ ctx, input }) => {
      return submissionQueries.listSubmissions({
        search: input.search,
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Get overlaps for a submission
   */
  getOverlaps: protectedProcedure
    .input(z.object({ submissionId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      return submissionQueries.getSubmissionOverlaps(input.submissionId);
    }),

  /**
   * Update status (verifikator/admin only)
   */
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

  /**
   * Get KPI data
   */
  kpi: protectedProcedure.query(async ({ ctx }) => {
    const data = await submissionQueries.getKPIData();

    // Transform to KPI format
    const kpi = {
      'SPPTG terdata': 0,
      'SPPTG terdaftar': 0,
      'Ditolak': 0,
      'Ditinjau Ulang': 0,
      'Terbit SPPTG': 0,
    };

    let total = 0;

    data.forEach((item: any) => {
      if (item.status in kpi) {
        kpi[item.status as keyof typeof kpi] = item.count;
        total += item.count;
      }
    });

    return {
      ...kpi,
      total,
    };
  }),

  /**
   * Get monthly stats
   */
  monthlyStats: protectedProcedure.query(async ({ ctx }) => {
    return submissionQueries.getMonthlyStats();
  }),
});

/**
 * Helper: Build geometry from draft coordinates
 */
function buildGeometryFromCoordinates(payload: any): any {
  const coordinates = payload.coordinatesGeografis ||
    payload.coordinatesUTM || [];

  if (coordinates.length < 3) {
    return null;
  }

  // Convert to array format [lon, lat]
  const coords = coordinates.map((c: any) =>
    [c.longitude || c.easting, c.latitude || c.northing]
  );

  // Close the polygon
  const closedCoords = [...coords, coords[0]];

  return {
    type: 'Polygon',
    coordinates: [closedCoords],
  };
}