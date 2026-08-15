import { protectedProcedure, adminProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createProhibitedAreaSchema,
  createProhibitedAreasBulkSchema,
  updateProhibitedAreaSchema,
} from '@/lib/validation';
import * as queries from '@/server/db/queries/prohibitedAreas';
import {
  findKawasanGeometryConflicts,
  findOverlappingSubmissions,
  type KawasanGeometryConflict,
} from '@/server/postgis';
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
import {
  MAX_KAWASAN_BLOCKS,
  MAX_KAWASAN_TOTAL_POINTS,
} from '@/lib/kawasan-limits';
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

/**
 * Refuse a kawasan whose geometry is past what one row may hold.
 *
 * The bulk importer already checks this before it offers a group for import,
 * but that check is in the browser: this is the one a caller cannot skip.
 * Counting rings and vertices off the GeoJSON directly, rather than rebuilding
 * an editor's polygon list, keeps it cheap on a batch of a hundred kawasan.
 */
function assertKawasanGeometryWithinLimits(
  geometry: GeomGeoJSONArea,
  namaKawasan: string
): void {
  const parts =
    geometry.type === 'MultiPolygon'
      ? (geometry.coordinates as number[][][][])
      : [geometry.coordinates as number[][][]];

  let blocks = 0;
  let points = 0;
  for (const rings of parts) {
    const outer = rings?.[0];
    if (!Array.isArray(outer)) continue;
    blocks += 1;
    points += outer.length;
  }

  if (blocks > MAX_KAWASAN_BLOCKS) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Kawasan "${namaKawasan}" memiliki ${blocks} blok, melebihi batas ${MAX_KAWASAN_BLOCKS} blok per kawasan.`,
    });
  }
  if (points > MAX_KAWASAN_TOTAL_POINTS) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Kawasan "${namaKawasan}" memiliki ${points.toLocaleString('id-ID')} titik, melebihi batas ${MAX_KAWASAN_TOTAL_POINTS.toLocaleString('id-ID')} titik per kawasan.`,
    });
  }
}

/**
 * Refuse a save that would put a kawasan on top of another kawasan or a
 * recorded pengajuan, unless the officer ticked "tetap lanjutkan".
 *
 * This runs on the server even though the form checks first, and that is the
 * point: the tick box is a decision, not a client-side formality, so a caller
 * that skips the UI cannot write an overlapping kawasan by simply not asking.
 */
async function assertNoBlockingConflicts(params: {
  wkt: string;
  excludeAreaId?: number;
  abaikan: boolean;
}): Promise<KawasanGeometryConflict[]> {
  const conflicts = await findKawasanGeometryConflicts(params.wkt, {
    excludeAreaId: params.excludeAreaId,
  });
  if (conflicts.length === 0 || params.abaikan) return conflicts;

  const kawasanCount = conflicts.filter((row) => row.jenis === 'kawasan').length;
  const pengajuanCount = conflicts.length - kawasanCount;
  const parts: string[] = [];
  if (kawasanCount > 0) parts.push(`${kawasanCount} kawasan Non-SPPTG`);
  if (pengajuanCount > 0) parts.push(`${pengajuanCount} pengajuan SPPTG`);

  throw new TRPCError({
    code: 'CONFLICT',
    message: `Batas kawasan ini tumpang tindih dengan ${parts.join(' dan ')}. Jalankan "Cek Tumpang Tindih" lalu centang konfirmasi untuk tetap melanjutkan.`,
  });
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
   * Every kawasan's geometry, for maps — no paging.
   *
   * The overlap check runs in PostGIS over every kawasan, so a map that drew a
   * page of them was showing part of an answer that had been computed in full.
   * Cached like `list`, and invalidated by the same `invalidateProhibitedAreas`.
   */
  geometriSemua: protectedProcedure.query(async () =>
    cached(
      cacheKeys.prohibitedAreasGeometries(),
      TTL.prohibitedAreas,
      () => queries.listProhibitedAreaGeometries()
    )
  ),

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

  /**
   * "Cek Tumpang Tindih" for a boundary still being drawn — what the kawasan
   * form runs before it will save, against other kawasan and against recorded
   * pengajuan at once.
   *
   * A mutation rather than a query purely for transport: a kawasan traced from
   * an SK runs to thousands of vertices, and a query would put that geometry in
   * the URL. It writes nothing, so it is exempt from the usual "queries read,
   * mutations write" reading — the audit middleware will record it as an
   * inspection, which is fair enough.
   */
  cekGeometriTumpangTindih: adminProcedure
    .input(
      z.object({
        geomGeoJSON: createProhibitedAreaSchema.shape.geomGeoJSON,
        /** The kawasan being edited — excluded, since it cannot overlap itself. */
        excludeAreaId: z.number().int().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const wkt = areaGeometryWKT(input.geomGeoJSON);
      return findKawasanGeometryConflicts(wkt, {
        excludeAreaId: input.excludeAreaId,
      });
    }),

  /** Existing kawasan names, so the bulk importer can flag a re-import. */
  namaTerpakai: adminProcedure.query(async () => queries.listProhibitedAreaNames()),

  create: adminProcedure
    .input(
      createProhibitedAreaSchema.extend({
        /**
         * The officer ticked "tetap lanjutkan" on the overlap warning. Without
         * it an overlapping boundary is refused outright.
         */
        abaikanTumpangTindih: z.boolean().optional(),
      })
    )
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

      // Refuse an overlapping boundary unless it was acknowledged. Deliberately
      // outside the try below: its CONFLICT must reach the client as it is,
      // not be swallowed into a generic 500.
      const conflicts = await assertNoBlockingConflicts({
        wkt,
        abaikan: input.abaikanTumpangTindih === true,
      });

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
          ringkasan:
            `Menambah kawasan Non-SPPTG "${input.namaKawasan}" (${input.jenisKawasan})` +
            (conflicts.length > 0
              ? ` — disimpan meski tumpang tindih dengan ${conflicts.length} objek`
              : ''),
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
   * Import part of a boundary file: one kawasan row per named kawasan, all
   * sharing the batch's jenis/sumber/dasar hukum.
   *
   * One transaction per request, so a batch that fails halfway leaves no
   * half-imported kawasan behind — a partial set would silently under-report
   * overlaps on every subsequent validation. A whole provincial file arrives as
   * several such requests (its 1.33 million vertices do not fit one body), so
   * "all or nothing" holds per batch, not across the upload; the client reports
   * how far it got and the officer can re-run the rest.
   *
   * **No overlap check runs here, deliberately.** `create` refuses an
   * overlapping boundary unless it is acknowledged, because there someone is
   * drawing one kawasan and a clash means they may be recording land twice. A
   * bulk import is the opposite situation: it is an SK being loaded as
   * authoritative reference data, its areas legitimately touch each other and
   * whatever is already recorded, and running the check per kawasan would be a
   * hundred PostGIS queries over a million vertices to ask a question nobody
   * asked. Use Pengaturan → Kawasan → "Cek Tumpang Tindih" afterwards to see
   * which pengajuan the new kawasan now cover.
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

        // The same ceilings the single-kawasan form enforces, applied here too:
        // the client checks before it offers a kawasan for import, and a caller
        // that skips the UI must not be able to write a row the editor could
        // never open again.
        assertKawasanGeometryWithinLimits(area.geomGeoJSON, area.namaKawasan);

        return {
          namaKawasan: area.namaKawasan,
          // Each kawasan's own value where it has one, the batch's otherwise.
          // `??` rather than `||` throughout: an override of `false` on
          // `aktifDiValidasi` is a decision, not an absence.
          jenisKawasan: area.jenisKawasan ?? input.jenisKawasan,
          sumberData: area.sumberData ?? input.sumberData,
          dasarHukum: area.dasarHukum ?? input.dasarHukum,
          tanggalEfektif: area.tanggalEfektif ?? input.tanggalEfektif,
          diunggahOleh: ctx.appUser!.id,
          statusValidasi: area.statusValidasi ?? input.statusValidasi ?? 'Lolos',
          aktifDiValidasi: area.aktifDiValidasi ?? input.aktifDiValidasi ?? true,
          warna: input.warna,
          catatan: input.catatan,
          // Bound parameter, not `sql.raw` interpolation: these boundaries come
          // straight off an uploaded file, and a WKT literal must never be able
          // to become SQL.
          geom: sql`ST_MPolyFromText(${wkt},4326)`,
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
        /** See `create` — the officer ticked "tetap lanjutkan". */
        abaikanTumpangTindih: z.boolean().optional(),
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

        // Same gate as `create`, minus this kawasan itself — a boundary always
        // overlaps the row it is replacing.
        const conflicts = await assertNoBlockingConflicts({
          wkt,
          excludeAreaId: input.id,
          abaikan: input.abaikanTumpangTindih === true,
        });

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
          ringkasan:
            `Mengubah kawasan Non-SPPTG #${input.id} (termasuk batas wilayah)` +
            (conflicts.length > 0
              ? ` — disimpan meski tumpang tindih dengan ${conflicts.length} objek`
              : ''),
          sebelum: sebelumUbah,
          sesudah: { ...updateData, geomGeoJSON: '[batas wilayah diubah]' },
        });
        return result[0];
      }

      // Regular update without geometry change — the boundary is untouched, so
      // there is nothing new to check for overlaps.
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
