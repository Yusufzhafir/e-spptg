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
  /**
   * The whole list, cached — this is what fills the desa dropdowns in the
   * wizard and the dashboard filter, where every option has to be present.
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
        cacheKeys.villagesList(input.limit, input.offset),
        TTL.villages,
        () => queries.listVillages(input.limit, input.offset)
      );
    }),

  /**
   * One page for the Desa table. Deliberately not cached: with search, sort and
   * page all in the key, near enough every request would be its own entry, and
   * the cache would cost more to maintain than it saves.
   */
  listPaged: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        kecamatan: z.string().optional(),
        sortKey: z
          .enum([
            'kodeDesa',
            'namaDesa',
            'namaKepalaDesa',
            'kecamatan',
            'kabupaten',
            'provinsi',
            'updatedAt',
          ])
          .optional(),
        sortDir: z.enum(['asc', 'desc']).optional(),
        limit: z.number().int().positive().max(200).default(10),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input }) => queries.listVillagesPaged(input)),

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
    .mutation(async ({ ctx, input }) => {
      const village = await queries.createVillage(input);
      await invalidateVillages();
      ctx.audit.set({
        entitasId: village?.id,
        ringkasan: `Menambah desa ${input.namaDesa} (${input.kecamatan})`,
        sesudah: village,
      });
      return village;
    }),

  update: superadminProcedure
    .input(
      z.object({
        id: z.number().int(),
        data: updateVillageSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Read the row first purely so the audit entry can show what changed;
      // without it the trail would say "desa diubah" and nothing more.
      const sebelum = await queries.getVillageById(input.id);
      const village = await queries.updateVillage(input.id, input.data);
      await invalidateVillages();
      ctx.audit.set({
        entitasId: input.id,
        ringkasan: `Mengubah desa ${sebelum?.namaDesa ?? input.id}`,
        sebelum,
        sesudah: village,
      });
      return village;
    }),

  delete: superadminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const sebelum = await queries.getVillageById(input.id);

      // None of the village_id columns carry a foreign key, so the delete would
      // succeed and orphan whatever still points at the desa: its Admin and
      // Verifikator keep a scope that matches nothing (empty dashboard, no
      // error at all), and its pengajuan vanish from every kecamatan view.
      // Refuse while anything is still attached and say what is in the way.
      const refs = await queries.countVillageReferences(input.id);
      const inUse = [
        refs.pengguna > 0 ? `${refs.pengguna} pengguna` : null,
        refs.pengajuan > 0 ? `${refs.pengajuan} pengajuan` : null,
        refs.draf > 0 ? `${refs.draf} draft` : null,
      ].filter(Boolean);

      if (inUse.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            `Desa ${sebelum?.namaDesa ?? input.id} masih dipakai oleh ${inUse.join(', ')}. ` +
            'Pindahkan atau hapus data tersebut terlebih dahulu.',
        });
      }

      const result = await queries.deleteVillage(input.id);
      await invalidateVillages();
      ctx.audit.set({
        entitasId: input.id,
        ringkasan: `Menghapus desa ${sebelum?.namaDesa ?? input.id}`,
        sebelum,
      });
      return result;
    }),
});