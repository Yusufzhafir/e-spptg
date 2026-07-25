import { protectedProcedure, router } from '../../init';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import * as queries from '@/server/db/queries/drafts';
import * as submissionQueries from '@/server/db/queries/submissions';
import * as documentQueries from '@/server/db/queries/documents';

/** Map a submission's document categories to the draft payload keys. */
const DOC_CATEGORY_TO_KEY: Record<string, string> = {
  KTP: 'dokumenKTP',
  KK: 'dokumenKK',
  Kwitansi: 'dokumenKwitansi',
  Permohonan: 'dokumenPermohonan',
  'SK Kepala Desa': 'dokumenSKKepalaDesa',
  'Berita Acara': 'dokumenBeritaAcara',
  'Pernyataan Jual Beli': 'dokumenPernyataanJualBeli',
  'Asal Usul': 'dokumenAsalUsul',
  'Tidak Sengketa': 'dokumenTidakSengketa',
  SPPG: 'dokumenSPPTG',
};

function geoJsonToCoordinates(
  geoJSON: unknown
): Array<{ id: string; latitude: number; longitude: number }> {
  const g = geoJSON as { type?: string; coordinates?: number[][][] };
  if (!g || g.type !== 'Polygon' || !Array.isArray(g.coordinates?.[0])) return [];
  let ring = g.coordinates[0].filter(
    (pt) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])
  );
  if (ring.length >= 2) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) ring = ring.slice(0, -1);
  }
  return ring.map((pt, i) => ({ id: `C-edit-${i}`, latitude: pt[1], longitude: pt[0] }));
}

type SubmissionDocumentRow = {
  id: number;
  filename: string;
  size: number;
  url: string;
  category: string;
  uploadedAt: Date | string;
};

/** Rebuild document payload fields from a submission's uploaded documents. */
function documentsToPayloadFields(documents: SubmissionDocumentRow[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const fotoLahan: unknown[] = [];
  for (const doc of documents) {
    const uploaded = {
      name: doc.filename,
      size: doc.size,
      url: doc.url,
      documentId: doc.id,
      uploadedAt:
        doc.uploadedAt instanceof Date ? doc.uploadedAt.toISOString() : String(doc.uploadedAt),
    };
    if (doc.category === 'Foto Lahan') {
      fotoLahan.push(uploaded);
      continue;
    }
    const key = DOC_CATEGORY_TO_KEY[doc.category];
    // Keep the newest per single-document category (rows arrive newest-first)
    if (key && !fields[key]) fields[key] = uploaded;
  }
  if (fotoLahan.length > 0) fields.fotoLahan = fotoLahan;
  return fields;
}
import {
  saveDraftStepSchema,
  validateStepCompletion,
} from '@/lib/validation/submission-draft';
import {
  assertCanAccessDraft,
  assertCanAccessSubmission,
  isPrivilegedProcessor,
  isViewer,
  requireAssignedVillageId,
} from '@/server/authz';

export const draftsRouter = router({
  getOrCreateCurrent: protectedProcedure.query(async ({ ctx }) => {
    if (isPrivilegedProcessor(ctx.appUser!)) {
      requireAssignedVillageId(ctx.appUser!);
    }

    const draft = await queries.getOrCreateDraft(ctx.appUser!.id);
    return {
      id: draft.id,
      currentStep: draft.currentStep,
      lastSaved: draft.lastSaved,
      payload: draft.payload,
    };
  }),

  create: protectedProcedure.mutation(async ({ ctx }) => {
    if (isPrivilegedProcessor(ctx.appUser!)) {
      requireAssignedVillageId(ctx.appUser!);
    }

    const draft = await queries.createDraft(ctx.appUser!.id);
    return { id: draft.id };
  }),

  // Create an editable draft pre-filled from an existing submission. Re-submitting
  // this draft updates the original submission in place (see submitDraft).
  createFromSubmission: protectedProcedure
    .input(z.object({ submissionId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      if (isViewer(ctx.appUser!)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Peran Viewer tidak dapat mengedit pengajuan.',
        });
      }

      const submission = await submissionQueries.getSubmissionById(input.submissionId);
      if (!submission) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pengajuan tidak ditemukan' });
      }

      assertCanAccessSubmission(ctx.appUser!, {
        ownerUserId: submission.ownerUserId,
        villageId: submission.villageId,
      });

      if (isPrivilegedProcessor(ctx.appUser!)) {
        const assignedVillageId = requireAssignedVillageId(ctx.appUser!);
        if (assignedVillageId !== submission.villageId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Anda hanya dapat mengedit pengajuan pada desa yang ditetapkan.',
          });
        }
      }

      const storedPayload =
        submission.payload &&
        typeof submission.payload === 'object' &&
        !Array.isArray(submission.payload)
          ? (submission.payload as Record<string, unknown>)
          : {};

      // Reconstruct what we can from the submission columns, geometry and its
      // uploaded documents — this fills the gaps for submissions saved before
      // payload snapshots existed, and acts as a safety net otherwise.
      const documents = (await documentQueries.listDocumentsBySubmission(
        submission.id
      )) as SubmissionDocumentRow[];

      const reconstructed: Record<string, unknown> = {
        namaPemohon: submission.namaPemilik,
        nik: submission.nik,
        alamatKTP: submission.alamat,
        email: submission.email,
        villageId: submission.villageId,
        kecamatan: submission.kecamatan,
        kabupaten: submission.kabupaten,
        penggunaanLahan: submission.penggunaanLahan,
        catatan: submission.catatan,
        luasLahan: submission.luas,
        luasManual: submission.luasManual,
        status: submission.status,
        coordinateSystem: 'geografis',
        coordinatesGeografis: geoJsonToCoordinates(submission.geoJSON),
        ...documentsToPayloadFields(documents),
      };

      // Stored payload (if any) is authoritative; reconstructed fills anything missing.
      const payload: Record<string, unknown> = { ...reconstructed, ...storedPayload };
      const storedCoords = storedPayload.coordinatesGeografis;
      if (!Array.isArray(storedCoords) || storedCoords.length < 3) {
        payload.coordinatesGeografis = reconstructed.coordinatesGeografis;
      }

      const draft = await queries.createDraftFromSubmission({
        userId: ctx.appUser!.id,
        villageId: submission.villageId,
        payload,
        editingSubmissionId: submission.id,
        currentStep: 1,
      });

      return { id: draft.id };
    }),

  getById: protectedProcedure
    .input(z.object({ draftId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const draft = await queries.getDraftById(input.draftId);
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

      return {
        id: draft.id,
        currentStep: draft.currentStep,
        lastSaved: draft.lastSaved,
        payload: draft.payload,
      };
    }),

  saveStep: protectedProcedure
    .input(saveDraftStepSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const draftBeforeSave = await queries.getDraftById(input.draftId);
        if (!draftBeforeSave) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Draft tidak ditemukan',
          });
        }

        assertCanAccessDraft(ctx.appUser!, {
          userId: draftBeforeSave.userId,
          villageId: draftBeforeSave.villageId,
        });

        if (isViewer(ctx.appUser!) && input.currentStep > 1) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Viewer hanya dapat mengisi Step 1.',
          });
        }

        const mergedPayload = queries.mergeDraftPayload(
          draftBeforeSave.payload as Record<string, unknown>,
          input.payload as Record<string, unknown>
        );

        const selectedVillageId =
          typeof mergedPayload.villageId === 'number' ? mergedPayload.villageId : null;

        if (isPrivilegedProcessor(ctx.appUser!)) {
          const assignedVillageId = requireAssignedVillageId(ctx.appUser!);
          if (selectedVillageId !== null && selectedVillageId !== assignedVillageId) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Anda hanya dapat memproses draft pada desa yang ditetapkan.',
            });
          }
        }

        if (input.currentStep > 1) {
          const step1Validation = validateStepCompletion(1, mergedPayload);
          if (!step1Validation.isValid) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Step 1 belum lengkap: ${step1Validation.errors.join(', ')}`,
            });
          }
        }

        const draft = await queries.saveDraftStep(
          input.draftId,
          input.currentStep,
          input.payload
        );

        return {
          id: draft.id,
          currentStep: draft.currentStep,
          lastSaved: draft.lastSaved,
          payload: draft.payload,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        if (error instanceof Error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  validateStep: protectedProcedure
    .input(
      z.object({
        step: z.number().int().min(1).max(4),
        payload: z.any(),
      })
    )
    .query(async ({ input }) => {
      const result = validateStepCompletion(input.step, input.payload);
      return result;
    }),

  listMy: protectedProcedure
    .output(
      z.array(
        z.object({
          id: z.number(),
          ownerUserId: z.number(),
          ownerName: z.string().nullable(),
          villageId: z.number().nullable(),
          villageName: z.string().nullable(),
          currentStep: z.number().int().min(1).max(4),
          isStep1Validated: z.boolean(),
          isOwnDraft: z.boolean(),
          lastSaved: z.date(),
          createdAt: z.date(),
          updatedAt: z.date(),
          namaPemohon: z.preprocess(
            (val) => (typeof val === 'string' ? val : null),
            z.string().nullable()
          ),
          nik: z.preprocess(
            (val) => (typeof val === 'string' ? val : null),
            z.string().nullable()
          ),
        })
      )
    )
    .query(async ({ ctx }) => {
      let assignedVillageId: number | undefined;
      if (isPrivilegedProcessor(ctx.appUser!)) {
        assignedVillageId = requireAssignedVillageId(ctx.appUser!);
      }

      const drafts = await queries.listAccessibleDrafts({
        userId: ctx.appUser!.id,
        role: ctx.appUser!.peran,
        assignedVillageId,
      });

      return drafts.map((d) => ({
        id: d.id,
        ownerUserId: d.ownerUserId,
        ownerName: d.ownerName || null,
        villageId: d.villageId ?? null,
        villageName: d.villageName || null,
        currentStep: d.currentStep,
        isStep1Validated: validateStepCompletion(1, d.payload as object).isValid,
        isOwnDraft: d.ownerUserId === ctx.appUser!.id,
        lastSaved: d.lastSaved,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        namaPemohon: d.namaPemohon || null,
        nik: d.nik || null,
      }));
    }),

  delete: protectedProcedure
    .input(z.object({ draftId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const draft = await queries.getDraftById(input.draftId);
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

        await queries.deleteDraft(input.draftId);
        return {
          success: true,
          message: 'Draft berhasil dihapus',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        if (error instanceof Error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),
});
