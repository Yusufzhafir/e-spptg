import { protectedProcedure, superadminProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createVillageSchema,
  updateVillageSchema,
} from '@/lib/validation';
import * as queries from '@/server/db/queries/villages';
import { TRPCError } from '@trpc/server';
import { TTL, cacheKeys, cached, invalidateVillages } from '@/server/redis/cache';

export const villagesRouter = router({
  // Cached: reference data read on nearly every screen (the desa picker, the
  // dashboard filter, the submission wizard) and written only by a Superadmin.
  // Not scoped per role — every caller sees the same desa list — so one shared
  // entry per page is correct.
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(100),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input }) => {
      return cached(
        cacheKeys.villagesList(input.limit, input.offset),
        TTL.villages,
        () => queries.listVillages(input.limit, input.offset)
      );
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
  // Each mutation drops the village caches *and* the dashboard aggregates:
  // desa carries the kecamatan mapping the KPI scoping resolves through, so a
  // renamed or deleted desa changes those numbers too.
  create: superadminProcedure
    .input(createVillageSchema)
    .mutation(async ({ input }) => {
      const village = await queries.createVillage(input);
      await invalidateVillages();
      return village;
    }),

  update: superadminProcedure
    .input(
      z.object({
        id: z.number().int(),
        data: updateVillageSchema,
      })
    )
    .mutation(async ({ input }) => {
      const village = await queries.updateVillage(input.id, input.data);
      await invalidateVillages();
      return village;
    }),

  delete: superadminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const result = await queries.deleteVillage(input.id);
      await invalidateVillages();
      return result;
    }),
});