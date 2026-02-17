import { protectedProcedure, adminProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createUserSchema,
  updateUserSchema,
} from '@/lib/validation';
import * as queries from '@/server/db/queries/user';
import { TRPCError } from '@trpc/server';
import { clerkClient } from '@clerk/nextjs/server';

function normalizeAssignedVillageByRole(
  role: 'Superadmin' | 'Admin' | 'Verifikator' | 'Viewer',
  assignedVillageId: number | null | undefined
) {
  if (role === 'Admin' || role === 'Verifikator') {
    if (assignedVillageId == null) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Admin/Verifikator wajib memiliki satu desa penugasan.',
      });
    }
    return assignedVillageId;
  }

  return null;
}

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
    .query(async ({ input }) => {
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
    .mutation(async ({ ctx, input }) => {
      const isSuperadmin = ctx.appUser!.peran === 'Superadmin';
      const role = input.peran ?? 'Viewer';
      if (!isSuperadmin && role !== 'Viewer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Hanya superadmin yang dapat membuat Admin/Verifikator.',
        });
      }
      if (!isSuperadmin && input.assignedVillageId !== undefined) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Hanya superadmin yang dapat mengatur desa penugasan.',
        });
      }

      const assignedVillageId = normalizeAssignedVillageByRole(
        role,
        input.assignedVillageId
      );

      return queries.createUser({
        clerkUserId: input.clerkUserId,
        email: input.email,
        nama: input.nama,
        nipNik: input.nipNik,
        peran: role,
        assignedVillageId,
        status: input.status,
        nomorHP: input.nomorHP,
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
    .mutation(async ({ ctx, input }) => {
      const isSuperadmin = ctx.appUser!.peran === 'Superadmin';
      const targetUser = await queries.getUserById(input.id);
      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pengguna tidak ditemukan',
        });
      }

      const nextRole = input.data.peran ?? targetUser.peran;
      if (!isSuperadmin && nextRole !== 'Viewer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Hanya superadmin yang dapat menetapkan peran Admin/Verifikator.',
        });
      }
      if (!isSuperadmin && input.data.assignedVillageId !== undefined) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Hanya superadmin yang dapat mengubah desa penugasan.',
        });
      }

      const nextAssignedVillageId = normalizeAssignedVillageByRole(
        nextRole,
        input.data.assignedVillageId !== undefined
          ? input.data.assignedVillageId
          : targetUser.assignedVillageId
      );

      if (input.data.peran) {
        
        try {
          const client = await clerkClient();
          await client.users.updateUserMetadata(targetUser.clerkUserId, {
            privateMetadata: {
              role: input.data.peran,
            },
          });
        } catch (error) {
          console.error('Gagal memperbarui role di Clerk:', error);
        }
      }

      return queries.updateUser(input.id, {
        ...input.data,
        assignedVillageId: nextAssignedVillageId,
      });
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
