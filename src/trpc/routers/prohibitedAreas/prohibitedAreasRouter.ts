import { protectedProcedure, adminProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createProhibitedAreaSchema,
  updateProhibitedAreaSchema,
} from '@/lib/validation';
import * as queries from '@/server/db/queries/prohibitedAreas';
import { sql, eq } from 'drizzle-orm';
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
      if (!ctx.appUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User tidak ditemukan',
        });
      }

      // Validate GeoJSON structure
      if (!input.geomGeoJSON || input.geomGeoJSON.type !== 'Polygon') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'GeoJSON harus berupa Polygon',
        });
      }

      if (!input.geomGeoJSON.coordinates || !Array.isArray(input.geomGeoJSON.coordinates[0])) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Format koordinat GeoJSON tidak valid',
        });
      }

            // Explicitly ensure all coordinates are valid numbers
      const sanitizedCoords = input.geomGeoJSON.coordinates[0].map((c) => {
        const lon = Number(c[0]);
        const lat = Number(c[1]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Koordinat harus berupa angka yang valid',
          });
        }
        return `${lon} ${lat}`;
      }).join(',');

      try {
        const result = await ctx.db.transaction(async (tx) => {
          return await tx.insert(prohibitedAreas).values({
            namaKawasan: input.namaKawasan,
            jenisKawasan: input.jenisKawasan,
            sumberData: input.sumberData,
            dasarHukum: input.dasarHukum,
            tanggalEfektif: input.tanggalEfektif,
            diunggahOleh: ctx.appUser.id, // Use authenticated user ID from context
            statusValidasi: input.statusValidasi ?? 'Lolos',
            aktifDiValidasi: input.aktifDiValidasi ?? true,
            warna: input.warna,
            catatan: input.catatan,
            geom: sql.raw(`ST_PolygonFromText('POLYGON((${sanitizedCoords}))',4326)`),
          }).returning({
            id : prohibitedAreas.id,
          })
        })
  
        return result[0];
      }catch(error) {
        console.error(error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal membuat kawasan Non-SPPTG',
        });
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        data: updateProhibitedAreaSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate GeoJSON if provided
      if (input.data.geomGeoJSON) {
        if (input.data.geomGeoJSON.type !== 'Polygon') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'GeoJSON harus berupa Polygon',
          });
        }

        if (!input.data.geomGeoJSON.coordinates || !Array.isArray(input.data.geomGeoJSON.coordinates[0])) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Format koordinat GeoJSON tidak valid',
          });
        }
      }

      // Convert GeoJSON to geometry if provided
      const updateData: Record<string, unknown> = { ...input.data };
      if (input.data.geomGeoJSON) {
        // Use direct SQL update for geometry conversion
        const area = await queries.getProhibitedAreaById(input.id);
        if (!area) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Kawasan tidak ditemukan',
          });
        }

        const sanitizedCoords = input.data.geomGeoJSON.coordinates[0].map((c) => {
          const lon = Number(c[0]);
          const lat = Number(c[1]);
          if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Koordinat harus berupa angka yang valid',
            });
          }
          return `${lon} ${lat}`;
        }).join(',');

        // Update with geometry conversion
        const result = await ctx.db
          .update(prohibitedAreas)
          .set({
            ...Object.fromEntries(
              Object.entries(updateData).filter(([key]) => key !== 'geomGeoJSON')
            ),
            geom: sql`ST_PolygonFromText('POLYGON((${sanitizedCoords}))',4326)`,
            updatedAt: new Date(),
          })
          .where(eq(prohibitedAreas.id, input.id))
          .returning();

        return result[0];
      }

      // Regular update without geometry change
      return queries.updateProhibitedArea(input.id, updateData);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      return queries.deleteProhibitedArea(input.id);
    }),
});
