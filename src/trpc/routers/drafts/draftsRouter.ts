import { protectedProcedure, router } from '../../init';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import * as queries from '@/server/db/queries/drafts';
import {
  saveDraftStepSchema,
  validateStepCompletion,
} from '@/lib/validation/submission-draft';
import {
  assertCanAccessDraft,
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

        const mergedPayload = {
          ...(draftBeforeSave.payload as Record<string, unknown>),
          ...(input.payload as Record<string, unknown>),
        };

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
