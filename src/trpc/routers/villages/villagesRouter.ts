import { protectedProcedure, superadminProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createVillageSchema,
  updateVillageSchema,
} from '@/lib/validation';
import * as queries from '@/server/db/queries/villages';
import { TRPCError } from '@trpc/server';

export const villagesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(100),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input }) => {
      return queries.listVillages(input.limit, input.offset);
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return queries.searchVillages(input.query);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const village = await queries.getVillageById(input.id);
      if (!village) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Desa tidak ditemukan',
        });
      }
      return village;
    }),

  // Desa is master data affecting every scope, and Admins are themselves
  // desa-scoped — so only Superadmin may mutate it. This matches the UI, which
  // only shows the Desa tab to Superadmin.
  create: superadminProcedure
    .input(createVillageSchema)
    .mutation(async ({ input }) => {
      return queries.createVillage(input);
    }),

  update: superadminProcedure
    .input(
      z.object({
        id: z.number().int(),
        data: updateVillageSchema,
      })
    )
    .mutation(async ({ input }) => {
      return queries.updateVillage(input.id, input.data);
    }),

  delete: superadminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      return queries.deleteVillage(input.id);
    }),
});