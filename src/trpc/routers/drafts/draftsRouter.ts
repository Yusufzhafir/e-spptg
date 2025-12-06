import { z } from 'zod';
import * as queries from '@/server/db/queries/drafts';
import { protectedProcedure, router } from '@/trpc/init';
import { saveDraftStepSchema } from '@/lib/validations';

export const draftsRouter = router({
  getOrCreateCurrent: protectedProcedure.query(async ({ ctx }) => {
    const draft = await queries.getOrCreateDraft(ctx.appUser!.id);
    return draft;
  }),

  getById: protectedProcedure
    .input(z.object({ draftId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const draft = await queries.getDraftById(input.draftId, ctx.appUser!.id);
      return draft;
    }),

  saveStep: protectedProcedure
    .input(saveDraftStepSchema)
    .mutation(async ({ ctx, input }) => {
      const draft = await queries.saveDraftStep(
        input.draftId,
        ctx.appUser!.id,
        input.currentStep,
        input.payload
      );
      return draft;
    }),

  listMy: protectedProcedure.query(async ({ ctx }) => {
    return queries.listUserDrafts(ctx.appUser!.id);
  }),

  delete: protectedProcedure
    .input(z.object({ draftId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return queries.deleteDraft(input.draftId, ctx.appUser!.id);
    }),
});