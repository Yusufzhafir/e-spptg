import { protectedProcedure, adminProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createUserSchema,
  updateUserSchema,
} from '@/lib/validation';
import * as queries from '@/server/db/queries/user';
import { TRPCError } from '@trpc/server';

export const usersRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(100),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input }) => {
      return queries.listUsers(input.limit, input.offset);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const user = await queries.getUserById(input.id);
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pengguna tidak ditemukan',
        });
      }
      return user;
    }),

  create: adminProcedure
    .input(
      createUserSchema.extend({
        clerkUserId: z.string().min(1, 'Clerk User ID diperlukan'),
        nomorHP: z.string().optional(),
        status: z.enum(['Aktif', 'Nonaktif']).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return queries.createUser({
        clerkUserId: input.clerkUserId,
        email: input.email,
        nama: input.nama,
        nipNik: input.nipNik,
        peran: input.peran,
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        data: updateUserSchema.extend({
          nomorHP: z.string().optional(),
          status: z.enum(['Aktif', 'Nonaktif']).optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      return queries.updateUser(input.id, input.data);
    }),

  toggleStatus: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const user = await queries.getUserById(input.id);
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pengguna tidak ditemukan',
        });
      }
      const newStatus = user.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
      return queries.updateUser(input.id, { status: newStatus });
    }),
});
