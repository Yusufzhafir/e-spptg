import { protectedProcedure, router } from '../../init';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import * as queries from '@/server/db/queries/drafts';
import {
  saveDraftStepSchema,
  validateStepCompletion,
} from '@/lib/validation/submission-draft';

export const draftsRouter = router({
  getOrCreateCurrent: protectedProcedure.query(async ({ ctx }) => {
    const draft = await queries.getOrCreateDraft(ctx.appUser!.id);
    return {
      id: draft.id,
      currentStep: draft.currentStep,
      lastSaved: draft.lastSaved,
      payload: draft.payload,
    };
  }),

  getById: protectedProcedure
    .input(z.object({ draftId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const draft = await queries.getDraftById(
        input.draftId,
        ctx.appUser!.id
      );
      if (!draft) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Draft tidak ditemukan',
        });
      }
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
        const draft = await queries.saveDraftStep(
          input.draftId,
          ctx.appUser!.id,
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
    .query(async ({ ctx, input }) => {
      const result = validateStepCompletion(input.step, input.payload);
      return result;
    }),

  listMy: protectedProcedure.query(async ({ ctx }) => {
    const drafts = await queries.listUserDrafts(ctx.appUser!.id);
    return drafts.map((d) => ({
      id: d.id,
      currentStep: d.currentStep,
      lastSaved: d.lastSaved,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }),

  delete: protectedProcedure
    .input(z.object({ draftId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await queries.deleteDraft(input.draftId, ctx.appUser!.id);
        return {
          success: true,
          message: 'Draft berhasil dihapus',
        };
      } catch (error) {
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