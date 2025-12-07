import { protectedProcedure, adminProcedure, router } from '../../init';
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

  create: adminProcedure
    .input(createVillageSchema)
    .mutation(async ({ input }) => {
      return queries.createVillage(input);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        data: updateVillageSchema,
      })
    )
    .mutation(async ({ input }) => {
      return queries.updateVillage(input.id, input.data);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      return queries.deleteVillage(input.id);
    }),
});