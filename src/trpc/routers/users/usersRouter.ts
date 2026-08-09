import { protectedProcedure, adminProcedure, router } from '../../init';
import { z } from 'zod';
import {
  createUserSchema,
  optionalNomorHPSchema,
  updateUserSchema,
} from '@/lib/validation';
import * as queries from '@/server/db/queries/user';
import * as submissionQueries from '@/server/db/queries/submissions';
import { signAvatarUrl } from '@/server/avatar';
import { users } from '@/server/db/schema';
import { assertCanManageUser, requireAssignedVillageId } from '@/server/authz';
import { canViewUserDetail } from '@/lib/user-access';
import { TRPCError } from '@trpc/server';
import { invalidateAllUserSessions } from '@/server/auth/session';
import { clearedSessionCookie } from '@/server/auth/cookies';
import { createPasswordResetToken } from '@/server/auth/password-reset';
import {
  isMailerConfigured,
  sendAccountInviteEmail,
  sendPasswordResetEmail,
} from '@/server/auth/mailer';

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

/**
 * Strips `passwordHash` before a user row leaves the server, and replaces it
 * with the only thing the UI actually needs to know — whether the account can
 * sign in yet. Every read procedure goes through this; returning raw rows would
 * put scrypt digests for the whole desa into the browser.
 */
function toClientUser(user: typeof users.$inferSelect) {
  const { passwordHash, ...rest } = user;
  return { ...rest, hasPassword: passwordHash !== null };
}

/**
 * `toClientUser` plus a signed link for the profile photo. `fotoProfil` itself
 * is a private-bucket object key and is useless (and meaningless) to the
 * browser, so the readable link travels alongside it.
 */
async function toClientUserWithAvatar(user: typeof users.$inferSelect) {
  return { ...toClientUser(user), fotoProfilUrl: await signAvatarUrl(user.fotoProfil) };
}

/**
 * Who may read one account in full. The rule itself lives in
 * `@/lib/user-access` so the server and the UI cannot drift: whatever hides the
 * Lihat Detail button is exactly what refuses the request behind it.
 *
 * Refuses with NOT_FOUND rather than FORBIDDEN on purpose — "no such user" and
 * "not yours to see" must be indistinguishable, or the error itself confirms
 * which ids exist.
 */
function assertCanReadUser(
  actor: typeof users.$inferSelect,
  user: typeof users.$inferSelect
) {
  if (!canViewUserDetail(actor, user)) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Pengguna tidak ditemukan' });
  }
}

export const usersRouter = router({
  /**
   * One page of accounts, paged/searched/sorted in Postgres. Read scope is
   * unchanged: Superadmin sees everyone, Admin/Verifikator only their own desa,
   * anyone else only themselves — the scope simply becomes part of the query
   * rather than a choice of which function to call.
   */
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        peran: z.string().optional(),
        status: z.string().optional(),
        sortKey: z
          .enum(['nama', 'nipNik', 'email', 'peran', 'status', 'terakhirMasuk', 'updatedAt'])
          .optional(),
        sortDir: z.enum(['asc', 'desc']).optional(),
        // 1000 stays allowed while the Pengguna tab still pages in the browser;
        // it asks for the whole list in one go.
        limit: z.number().int().positive().max(1000).default(10),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const actor = ctx.appUser!;

      const isDesaScoped =
        (actor.peran === 'Admin' || actor.peran === 'Verifikator') &&
        actor.assignedVillageId != null;

      if (actor.peran !== 'Superadmin' && !isDesaScoped) {
        // Viewer, Kecamatan, or staff with no desa yet: their own row only.
        const self = await queries.getUserById(actor.id);
        return {
          items: self ? [await toClientUserWithAvatar(self)] : [],
          total: self ? 1 : 0,
        };
      }

      const { items, total } = await queries.listUsersPaged({
        villageId: isDesaScoped ? actor.assignedVillageId! : undefined,
        search: input.search,
        peran: input.peran,
        status: input.status,
        sortKey: input.sortKey,
        sortDir: input.sortDir,
        limit: input.limit,
        offset: input.offset,
      });

      return { items: await Promise.all(items.map(toClientUserWithAvatar)), total };
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

      assertCanReadUser(ctx.appUser!, user);
      return toClientUserWithAvatar(user);
    }),

  /**
   * One account in full, for Pengaturan → Pengguna → Lihat Detail: the profile
   * (photo included) plus every pengajuan connected to it.
   *
   * Read scope is the same as `byId` — a Verifikator cannot open an account
   * outside their desa, and the pengajuan list follows the account, not the
   * caller, so it is only ever reachable for an account they may already read.
   */
  detail: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        search: z.string().optional(),
        status: z.string().optional(),
        keterkaitan: z.enum(['Pemohon', 'Verifikator']).optional(),
        limit: z.number().int().positive().max(200).default(10),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await queries.getUserById(input.id);
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pengguna tidak ditemukan' });
      }

      assertCanReadUser(ctx.appUser!, user);

      // Paged in Postgres: a long-serving verifikator accumulates thousands of
      // pengajuan, and this page would otherwise load every one of them.
      const { items, total } = await submissionQueries.listSubmissionsForUser(user.id, {
        search: input.search,
        status: input.status,
        keterkaitan: input.keterkaitan,
        limit: input.limit,
        offset: input.offset,
      });

      return {
        user: await toClientUserWithAvatar(user),
        total,
        submissions: items.map((row) => ({
          ...row,
          // How this account relates to the pengajuan — a Viewer files them, an
          // Admin/Verifikator processes them, and the same person can do both.
          keterkaitan:
            row.ownerUserId === user.id ? ('Pemohon' as const) : ('Verifikator' as const),
        })),
      };
    }),

  /**
   * Create an account. There is deliberately no way for an admin to set an
   * initial password: the person is always emailed a link to choose their own,
   * so a plaintext password never travels over chat and the account is only
   * usable by whoever actually reads that inbox.
   */
  create: adminProcedure
    .input(
      createUserSchema.extend({
        nomorHP: optionalNomorHPSchema,
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

      // The email is the login identifier, so it has to be unique. The unique
      // index on the column is the real guard; this check exists to return a
      // readable message instead of a constraint violation.
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

      // The invite email is the only way into the account, so refuse up front
      // rather than creating a row nobody can ever sign in to.
      if (!isMailerConfigured()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Layanan email belum dikonfigurasi, sehingga undangan tidak dapat dikirim. Hubungi administrator sistem.',
        });
      }

      const user = await queries.createUser({
        email: input.email.trim(),
        nama: input.nama.trim(),
        nipNik: input.nipNik,
        // Always null: the account gets its first password from the invite link.
        passwordHash: null,
        peran: role,
        assignedVillageId,
        assignedKecamatan,
        status: input.status,
        nomorHP: input.nomorHP,
        // Unverified until the invite link is opened. An admin typing the
        // address is not proof it exists or belongs to the right person —
        // redeeming a link that only landed in that inbox is, and
        // `auth.resetPassword` stamps the account verified when it happens.
        emailVerifiedAt: null,
      });

      try {
        const { token, expiresAt } = await createPasswordResetToken(user.id);
        await sendAccountInviteEmail({
          to: user.email,
          nama: user.nama,
          peran: user.peran,
          token,
          expiresAt,
        });
      } catch (error) {
        // The account is already created and valid; a bounced invite is fixed
        // by the "Kirim tautan sandi" action rather than by rolling back.
        console.error('Gagal mengirim email undangan akun:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Pengguna berhasil dibuat, tetapi email undangan gagal dikirim. Kirim ulang tautan kata sandi dari daftar pengguna.',
        });
      }

      ctx.audit.set({
        entitasId: user.id,
        ringkasan: `Menambah pengguna ${user.nama} (${user.email}) sebagai ${user.peran}`,
        sesudah: toClientUser(user),
      });

      return toClientUser(user);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        data: updateUserSchema.extend({
          nomorHP: optionalNomorHPSchema,
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

      // Changing an email changes the login identifier, so it must stay unique
      // and must not be taken by somebody else's account.
      if (input.data.email && input.data.email.trim() !== targetUser.email) {
        const emailOwner = await queries.getUserByEmail(input.data.email.trim());
        if (emailOwner && emailOwner.id !== targetUser.id) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Email sudah digunakan akun lain.',
          });
        }
      }

      const updated = await queries.updateUser(input.id, {
        ...input.data,
        assignedVillageId: nextAssignedVillageId,
        assignedKecamatan: nextAssignedKecamatan,
      });

      // Deactivating through the edit dialog has to revoke access just as the
      // status toggle does, otherwise the account stays usable until its cookie
      // happens to expire.
      if (input.data.status === 'Nonaktif' && targetUser.status === 'Aktif') {
        await invalidateAllUserSessions(input.id);
      }

      // Changing your *own* role signs you out everywhere. A live session keeps
      // whatever the app shell decided at load time — nav items, route guards
      // and cached queries are all built from the old peran — so continuing in
      // place would show a UI the new role is no longer entitled to until the
      // next full reload. Signing out is the honest way to re-derive all of it,
      // and the client warns before it happens.
      const changedOwnRole =
        input.id === ctx.appUser!.id &&
        input.data.peran !== undefined &&
        input.data.peran !== targetUser.peran;

      if (changedOwnRole) {
        await invalidateAllUserSessions(input.id);
        ctx.resHeaders?.append('set-cookie', clearedSessionCookie());
      }

      ctx.audit.set({
        entitasId: input.id,
        ringkasan: `Mengubah pengguna ${targetUser.nama} (${targetUser.email})`,
        // `toClientUser` drops the scrypt digest; `redact` in the audit writer
        // would catch it anyway, but not shipping it at all is cheaper.
        sebelum: toClientUser(targetUser),
        sesudah: toClientUser(updated),
      });

      // `signedOut` rides along so the client knows to send the user to the
      // login page rather than leaving them on a page whose queries will all
      // start failing with UNAUTHORIZED.
      return { ...toClientUser(updated), signedOut: changedOwnRole };
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

      const updated = await queries.updateUser(input.id, { status: newStatus });

      // "Nonaktif" has to mean logged out now, not at the next expiry. The tRPC
      // middleware already refuses the account on every call; this closes the
      // session rows so nothing is left to replay.
      if (newStatus === 'Nonaktif') {
        await invalidateAllUserSessions(input.id);
      }

      ctx.audit.set({
        entitasId: input.id,
        ringkasan:
          newStatus === 'Nonaktif'
            ? `Menonaktifkan pengguna ${user.nama} (${user.email})`
            : `Mengaktifkan kembali pengguna ${user.nama} (${user.email})`,
        sebelum: { status: user.status },
        sesudah: { status: newStatus },
      });

      return toClientUser(updated);
    }),

  /**
   * Mail a managed user a link to set their own password — for a forgotten
   * password an admin is asked about in person, or an invite that never arrived.
   * The admin never learns the password, and the link is the same single-use,
   * one-hour token the public "lupa sandi" flow issues.
   */
  sendPasswordResetLink: adminProcedure
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

      if (!isMailerConfigured()) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Layanan email belum dikonfigurasi. Hubungi administrator sistem.',
        });
      }

      const { token, expiresAt } = await createPasswordResetToken(user.id);
      try {
        await sendPasswordResetEmail({
          to: user.email,
          nama: user.nama,
          token,
          expiresAt,
        });
      } catch (error) {
        console.error('Gagal mengirim email atur ulang kata sandi:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengirim email. Coba beberapa saat lagi.',
        });
      }

      return { email: user.email };
    }),
});
