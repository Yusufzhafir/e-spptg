import { protectedProcedure, adminProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createProhibitedAreaSchema,
  updateProhibitedAreaSchema,
} from '@/lib/validation';
import * as queries from '@/server/db/queries/prohibitedAreas';
import { sql } from 'drizzle-orm';
import { prohibitedAreas } from '@/server/db/schema';
import { TRPCError } from '@trpc/server';

export const prohibitedAreasRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(100),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input }) => {
      return queries.listProhibitedAreas(input.limit, input.offset);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const area = await queries.getProhibitedAreaById(input.id);
      if (!area) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kawasan tidak ditemukan',
        });
      }
      return area;
    }),

  create: adminProcedure
    .input(createProhibitedAreaSchema)
    .mutation(async ({ ctx, input }) => {
      // Convert GeoJSON to geometry
      // const geomWKT = geojsonToWKT(input.geomGeoJSON);

      const result = await ctx.db
        .insert(prohibitedAreas)
        .values({
          namaKawasan: input.namaKawasan,
          jenisKawasan: input.jenisKawasan,
          sumberData: input.sumberData,
          dasarHukum: input.dasarHukum,
          tanggalEfektif: input.tanggalEfektif,
          diunggahOleh: input.diunggahOleh,
          statusValidasi: input.statusValidasi ,
          aktifDiValidasi: input.aktifDiValidasi ?? true,
          warna: input.warna,
          catatan: input.catatan,
          geom: sql`ST_GeomFromGeoJSON(${JSON.stringify(input.geomGeoJSON)})::geometry(Polygon, 4326)`,
        })
        .returning();

      return result[0];
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        data: updateProhibitedAreaSchema,
      })
    )
    .mutation(async ({ input }) => {
      return queries.updateProhibitedArea(input.id, input.data);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      return queries.deleteProhibitedArea(input.id);
    }),
});

// function geojsonToWKT(geojson: any): string {
//   if (geojson.type === 'Polygon') {
//     const coords = geojson.coordinates[0]
//       .map((coord: number[]) => `${coord[0]} ${coord[1]}`)
//       .join(', ');
//     return `POLYGON((${coords}))`;
//   }
//   throw new Error('Unsupported GeoJSON type');
// }