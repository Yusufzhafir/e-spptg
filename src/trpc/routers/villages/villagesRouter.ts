import { protectedProcedure, adminProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createVillageSchema,
  updateVillageSchema,
} from '@/lib/validations';
import * as queries from '@/server/db/queries/villages';

export const villagesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(100),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return queries.listVillages(input.limit, input.offset);
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      return queries.searchVillages(input.query);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      return queries.getVillageById(input.id);
    }),

  create: adminProcedure
    .input(createVillageSchema)
    .mutation(async ({ ctx, input }) => {
      return queries.createVillage(input as any);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        data: updateVillageSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      return queries.updateVillage(input.id, input.data as any);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return queries.deleteVillage(input.id);
    }),
});