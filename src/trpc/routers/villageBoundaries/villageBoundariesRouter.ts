import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { upsertVillageBoundarySchema } from '@/lib/validation';
import * as villageQueries from '@/server/db/queries/villages';
import * as villageBoundaryQueries from '@/server/db/queries/villageBoundaries';
import { adminProcedure, protectedProcedure, router } from '../../init';

export const villageBoundariesRouter = router({
  byVillageId: protectedProcedure
    .input(
      z.object({
        villageId: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      const village = await villageQueries.getVillageById(input.villageId);
      if (!village) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Desa tidak ditemukan',
        });
      }

      return villageBoundaryQueries.getByVillageId(input.villageId);
    }),

  upsert: adminProcedure
    .input(upsertVillageBoundarySchema)
    .mutation(async ({ input }) => {
      const village = await villageQueries.getVillageById(input.villageId);
      if (!village) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Desa tidak ditemukan',
        });
      }

      return villageBoundaryQueries.upsertByVillageId(
        input.villageId,
        input.geomGeoJSON
      );
    }),

  delete: adminProcedure
    .input(
      z.object({
        villageId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const village = await villageQueries.getVillageById(input.villageId);
      if (!village) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Desa tidak ditemukan',
        });
      }

      const deleted = await villageBoundaryQueries.deleteByVillageId(
        input.villageId
      );

      return { deleted: Boolean(deleted) };
    }),
});
