import { protectedProcedure, adminProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createUserSchema,
  updateUserSchema,
} from '@/lib/validation';
import * as queries from '@/server/db/queries/user';
import { assertCanManageUser, requireAssignedVillageId } from '@/server/authz';
import { TRPCError } from '@trpc/server';
import { clerkClient } from '@clerk/nextjs/server';

type AssignableRole = 'Superadmin' | 'Admin' | 'Verifikator' | 'Kecamatan' | 'Viewer';

function normalizeAssignedVillageByRole(
  role: AssignableRole,
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

/**
 * Only the 'Kecamatan' role carries a kecamatan scope, and it is mandatory —
 * without it the account would have no data to oversee. Every other role stores
 * null so a stale value can never widen someone's access later.
 */
function normalizeAssignedKecamatanByRole(
  role: AssignableRole,
  assignedKecamatan: string | null | undefined
) {
  if (role !== 'Kecamatan') return null;

  const kecamatan = assignedKecamatan?.trim();
  if (!kecamatan) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Peran Kecamatan wajib memiliki satu kecamatan penugasan.',
    });
  }
  return kecamatan;
}

/**
 * A 'Nonaktif' account is refused by the tRPC auth middleware, so deactivating
 * yourself is an instant, self-inflicted lockout — you would not even be able to
 * undo it. Superadmins can still deactivate each other.
 */
function assertNotSelfDeactivation(
  actorId: number,
  targetId: number,
  nextStatus: 'Aktif' | 'Nonaktif'
) {
  if (actorId === targetId && nextStatus === 'Nonaktif') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Anda tidak dapat menonaktifkan akun Anda sendiri.',
    });
  }
}

export const usersRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(100),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const actor = ctx.appUser!;
      // Superadmin sees everyone; Admin/Verifikator only their own desa;
      // anyone else (Viewer) only their own account.
      if (actor.peran === 'Superadmin') {
        return queries.listUsers(input.limit, input.offset);
      }
      if (
        (actor.peran === 'Admin' || actor.peran === 'Verifikator') &&
        actor.assignedVillageId != null
      ) {
        return queries.listUsersByVillage(
          actor.assignedVillageId,
          input.limit,
          input.offset
        );
      }
      const self = await queries.getUserById(actor.id);
      return self ? [self] : [];
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

      // Same read scope as `list`: yourself always, Superadmin anyone,
      // Admin/Verifikator only their own desa. Without this, any signed-in
      // account could enumerate every user's email, NIK and phone number.
      const actor = ctx.appUser!;
      const isSelf = user.id === actor.id;
      const isSameVillage =
        (actor.peran === 'Admin' || actor.peran === 'Verifikator') &&
        actor.assignedVillageId != null &&
        user.assignedVillageId === actor.assignedVillageId;

      if (!isSelf && actor.peran !== 'Superadmin' && !isSameVillage) {
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
        nomorHP: z.string().optional(),
        status: z.enum(['Aktif', 'Nonaktif']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.appUser!;
      const isSuperadmin = actor.peran === 'Superadmin';
      // Default stays 'Viewer' so an Admin that omits `peran` is rejected below
      // rather than silently getting the one role they are allowed to create.
      const role = input.peran ?? 'Viewer';

      // An Admin staffs their own desa: Verifikator accounts, nothing else.
      // Superadmin remains the only role that can mint Admins, Kecamatan
      // oversight accounts, or Viewers.
      if (!isSuperadmin && role !== 'Verifikator') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin hanya dapat menambahkan akun Verifikator.',
        });
      }

      let assignedVillageIdInput = input.assignedVillageId;
      if (!isSuperadmin) {
        // The desa is not the Admin's to choose — it is always their own.
        const actorVillageId = requireAssignedVillageId(actor);
        if (
          input.assignedVillageId != null &&
          input.assignedVillageId !== actorVillageId
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Anda hanya dapat menambahkan Verifikator pada desa yang ditetapkan.',
          });
        }
        assignedVillageIdInput = actorVillageId;
      }

      // Prevent duplicates: the email is what links this pre-registered row to a
      // Clerk account on first login, so it must be unique.
      const existing = await queries.getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email sudah terdaftar.',
        });
      }

      const assignedVillageId = normalizeAssignedVillageByRole(
        role,
        assignedVillageIdInput
      );
      const assignedKecamatan = normalizeAssignedKecamatanByRole(
        role,
        input.assignedKecamatan
      );

      // No Clerk account yet — the user is pre-registered and will be linked by
      // email when they first log in via Clerk.
      return queries.createUser({
        clerkUserId: null,
        email: input.email,
        nama: input.nama,
        nipNik: input.nipNik,
        peran: role,
        assignedVillageId,
        assignedKecamatan,
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

      // Hierarchy + desa scope: Admin may only manage same-desa accounts strictly
      // below Admin (Verifikator/Viewer); Verifikator may manage no one.
      assertCanManageUser(ctx.appUser!, targetUser);

      if (input.data.status) {
        assertNotSelfDeactivation(ctx.appUser!.id, input.id, input.data.status);
      }

      const nextRole = input.data.peran ?? targetUser.peran;
      // Non-superadmins may not change a user's role or reassign their desa; they
      // can only edit the other fields of accounts they already manage.
      if (!isSuperadmin && input.data.peran !== undefined && input.data.peran !== targetUser.peran) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Hanya superadmin yang dapat mengubah peran pengguna.',
        });
      }
      if (
        !isSuperadmin &&
        input.data.assignedVillageId !== undefined &&
        input.data.assignedVillageId !== targetUser.assignedVillageId
      ) {
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
      const nextAssignedKecamatan = normalizeAssignedKecamatanByRole(
        nextRole,
        input.data.assignedKecamatan !== undefined
          ? input.data.assignedKecamatan
          : targetUser.assignedKecamatan
      );

      // Only sync to Clerk once the user is actually linked to a Clerk account.
      // Pre-registered users (no clerkUserId yet) get their role from the DB row,
      // which is applied to Clerk metadata when they first log in if needed.
      if (input.data.peran && targetUser.clerkUserId) {
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
        assignedKecamatan: nextAssignedKecamatan,
      });
    }),

  toggleStatus: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const user = await queries.getUserById(input.id);
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pengguna tidak ditemukan',
        });
      }
      assertCanManageUser(ctx.appUser!, user);
      const newStatus = user.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
      assertNotSelfDeactivation(ctx.appUser!.id, input.id, newStatus);
      return queries.updateUser(input.id, { status: newStatus });
    }),
});
