import { protectedProcedure, adminProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createProhibitedAreaSchema,
  createProhibitedAreasBulkSchema,
  updateProhibitedAreaSchema,
} from '@/lib/validation';
import * as queries from '@/server/db/queries/prohibitedAreas';
import { findOverlappingSubmissions } from '@/server/postgis';
import { getSubmissionScopeForUser } from '@/server/authz';
import { sql, eq } from 'drizzle-orm';
import { prohibitedAreas } from '@/server/db/schema';
import { TRPCError } from '@trpc/server';
import {
  TTL,
  cacheKeys,
  cached,
  invalidateProhibitedAreas,
} from '@/server/redis/cache';
import { geometryToMultiPolygonWKT } from '@/lib/land-polygons';
import type { GeomGeoJSONArea } from '@/lib/validation';

/**
 * The kawasan's geometry as a MultiPolygon WKT literal.
 *
 * Rejects anything unusable up front with a 400 rather than letting an invalid
 * literal reach Postgres, where it would surface as an opaque 500.
 */
function areaGeometryWKT(geometry: GeomGeoJSONArea): string {
  try {
    return geometryToMultiPolygonWKT(geometry);
  } catch (error) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        error instanceof Error ? error.message : 'Format koordinat GeoJSON tidak valid',
    });
  }
}

export const prohibitedAreasRouter = router({
  // Cached: the kawasan layer is redrawn on every map render but only changes
  // when a Superadmin/Admin edits it. Same list for every role.
  //
  // Deliberately NOT caching `checkOverlaps` below — that one is scoped per
  // caller and reflects live submission geometry.
  /**
   * The whole list, cached — the wizard maps draw every kawasan as reference
   * geometry, so they need all of them, not a page.
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(100),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input }) => {
      return cached(
        cacheKeys.prohibitedAreasList(input.limit, input.offset),
        TTL.prohibitedAreas,
        () => queries.listProhibitedAreas(input.limit, input.offset)
      );
    }),

  /**
   * One page for the Kawasan table. Not cached: search, sort and page in the
   * key would make almost every request its own entry.
   */
  listPaged: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        jenisKawasan: z.string().optional(),
        statusValidasi: z.string().optional(),
        sortKey: z
          .enum([
            'namaKawasan',
            'jenisKawasan',
            'sumberData',
            'dasarHukum',
            'tanggalEfektif',
            'diunggahOleh',
            'statusValidasi',
            'aktifDiValidasi',
            'updatedAt',
          ])
          .optional(),
        sortDir: z.enum(['asc', 'desc']).optional(),
        /** 0 asks for `total` without any rows — the nav's count pill. */
        limit: z.number().int().nonnegative().max(200).default(10),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input }) => queries.listProhibitedAreasPaged(input)),

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

  /**
   * System-wide overlap report: submissions intersecting an *active* kawasan,
   * scoped to what the caller may see (superadmin = all, admin/verifikator =
   * their desa, viewer = their own submissions).
   */
  checkOverlaps: protectedProcedure.query(async ({ ctx }) => {
    const scope = getSubmissionScopeForUser(ctx.appUser!);
    return findOverlappingSubmissions(scope);
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

      // A kawasan may consist of several detached blocks, so the geometry is
      // always written as a MultiPolygon — the column's typmod would reject a
      // bare Polygon literal.
      const wkt = areaGeometryWKT(input.geomGeoJSON);

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
            geom: sql.raw(`ST_MPolyFromText('${wkt}',4326)`),
          }).returning({
            id : prohibitedAreas.id,
          })
        })
  
        await invalidateProhibitedAreas();
        ctx.audit.set({
          entitasId: result[0]?.id,
          ringkasan: `Menambah kawasan Non-SPPTG "${input.namaKawasan}" (${input.jenisKawasan})`,
          sesudah: { ...input, geomGeoJSON: undefined },
        });
        return result[0];
      }catch(error) {
        console.error(error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal membuat kawasan Non-SPPTG',
        });
      }
    }),

  /**
   * Import a whole boundary file: one kawasan row per polygon, all sharing the
   * batch's jenis/sumber/dasar hukum.
   *
   * One transaction, so a file that fails halfway leaves no half-imported
   * kawasan behind — a partial set would silently under-report overlaps on
   * every subsequent validation.
   */
  createBulk: adminProcedure
    .input(createProhibitedAreasBulkSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.appUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User tidak ditemukan',
        });
      }

      const rows = input.areas.map((area) => {
        let wkt: string;
        try {
          wkt = areaGeometryWKT(area.geomGeoJSON);
        } catch {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Polygon "${area.namaKawasan}" tidak memiliki koordinat yang valid`,
          });
        }

        return {
          namaKawasan: area.namaKawasan,
          jenisKawasan: input.jenisKawasan,
          sumberData: input.sumberData,
          dasarHukum: input.dasarHukum,
          tanggalEfektif: input.tanggalEfektif,
          diunggahOleh: ctx.appUser!.id,
          statusValidasi: input.statusValidasi ?? 'Lolos',
          aktifDiValidasi: input.aktifDiValidasi ?? true,
          warna: input.warna,
          catatan: input.catatan,
          geom: sql.raw(`ST_MPolyFromText('${wkt}',4326)`),
        };
      });

      try {
        const created = await ctx.db.transaction(async (tx) =>
          tx
            .insert(prohibitedAreas)
            .values(rows)
            .returning({ id: prohibitedAreas.id })
        );

        await invalidateProhibitedAreas();
        ctx.audit.set({
          ringkasan: `Impor ${created.length} kawasan Non-SPPTG (${input.jenisKawasan}) dari file geospasial`,
          // Names only: the geometry would bloat every audit row well past
          // anything a reader could use.
          sesudah: {
            jenisKawasan: input.jenisKawasan,
            sumberData: input.sumberData,
            namaKawasan: input.areas.map((area) => area.namaKawasan),
          },
        });
        return { created: created.length, ids: created.map((row) => row.id) };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengimpor kawasan Non-SPPTG',
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
      // Snapshot for the audit trail, taken before anything is written.
      // `getProhibitedAreaById` returns an array rather than a row (a known
      // quirk of that query), so normalise it here.
      const sebelumRaw = await queries.getProhibitedAreaById(input.id);
      const sebelumUbah = Array.isArray(sebelumRaw) ? sebelumRaw[0] : sebelumRaw;

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

        const wkt = areaGeometryWKT(input.data.geomGeoJSON);

        // Update with geometry conversion.
        // NB: only return the id — a bare .returning() reads back the `geom`
        // column, and drizzle's geometry() type only parses Point, so a Polygon
        // throws "Unsupported geometry type". (This is why create, which returns
        // { id } only, works but edit was failing.)
        const result = await ctx.db
          .update(prohibitedAreas)
          .set({
            ...Object.fromEntries(
              Object.entries(updateData).filter(([key]) => key !== 'geomGeoJSON')
            ),
            geom: sql.raw(`ST_MPolyFromText('${wkt}',4326)`),
            updatedAt: new Date(),
          })
          .where(eq(prohibitedAreas.id, input.id))
          .returning({ id: prohibitedAreas.id });

        await invalidateProhibitedAreas();
        ctx.audit.set({
          entitasId: input.id,
          ringkasan: `Mengubah kawasan Non-SPPTG #${input.id} (termasuk batas wilayah)`,
          sebelum: sebelumUbah,
          sesudah: { ...updateData, geomGeoJSON: '[batas wilayah diubah]' },
        });
        return result[0];
      }

      // Regular update without geometry change
      const updated = await queries.updateProhibitedArea(input.id, updateData);
      await invalidateProhibitedAreas();
      ctx.audit.set({
        entitasId: input.id,
        ringkasan: `Mengubah kawasan Non-SPPTG #${input.id}`,
        sebelum: sebelumUbah,
        sesudah: updated,
      });
      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const result = await queries.deleteProhibitedArea(input.id);
      await invalidateProhibitedAreas();
      return result;
    }),
});
