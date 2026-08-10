import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, publicProcedure, router } from '@/trpc/init';
import {
  createUserSchema,
  nomorHPSchema,
  optionalNomorHPSchema,
} from '@/lib/validation';
import { passwordSchema } from '@/lib/password-policy';
import { isValidEmail, EMAIL_ERROR } from '@/lib/email-address';
import { positiveIntFromEnv } from '@/lib/env-number';
import * as queries from '@/server/db/queries/user';
import {
  fakeVerifyPassword,
  hashPassword,
  verifyPassword,
} from '@/server/auth/password';
import {
  createSession,
  invalidateAllUserSessions,
  invalidateSession,
  listUserSessions,
  sessionIdFromToken,
} from '@/server/auth/session';
import { clearedSessionCookie, sessionCookie } from '@/server/auth/cookies';
import {
  consumeCheckPasswordResetToken,
  createPasswordResetToken,
  markPasswordResetTokenUsed,
} from '@/server/auth/password-reset';
import {
  checkEmailVerificationToken,
  createEmailVerificationToken,
  markEmailVerificationTokenUsed,
} from '@/server/auth/email-verification';
import {
  isMailerConfigured,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from '@/server/auth/mailer';
import { consumeRateLimit, resetRateLimit } from '@/server/auth/rate-limit';
import {
  ACCOUNT_DEACTIVATED_MESSAGE,
  EMAIL_NOT_VERIFIED_MESSAGE,
} from '@/lib/account-status';
import { recordAudit } from '@/server/audit/record';
import {
  buildAvatarKey,
  MAX_AVATAR_BYTES,
  signAvatarUrl,
} from '@/server/avatar';
import { deleteFileFromS3, uploadFileToS3 } from '@/server/s3/s3';

/**
 * Sign-in and sign-up run on `publicProcedure`, which the audit middleware does
 * not cover — there is no `ctx.appUser` yet when they start. They record their
 * own entries instead. Failed logins matter most: they are the only trace of
 * someone probing an account, and they exist nowhere else in the system.
 */
const ANON_ACTOR = (email: string) => ({
  id: null,
  nama: '(belum masuk)',
  email,
  peran: '-',
});

/**
 * Login and reset both refuse to say whether an email exists — that is the whole
 * point of the generic message — so the limits are keyed on the email *and* the
 * client IP. Keying on IP alone would let one attacker's noise lock out a shared
 * office NAT; keying on email alone would let them cycle addresses freely.
 */
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const RESET_REQUEST_LIMIT = 5;
const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000;
// Registration is keyed on IP alone (there is no account yet to key on), so a
// shared office NAT puts everyone in one bucket. The window is deliberately
// short — 5 minutes rather than an hour — because a wrongly-throttled desa
// office should be able to try again over a coffee break, not the next morning.
//
// Both numbers are overridable from the environment because there is one
// legitimate case the default is simply wrong for: a training session. Fifty
// peserta registering from one venue's WiFi are fifty requests from one IP, and
// a budget of 10 stops the eleventh person with a message they cannot act on.
// Raise `REGISTER_RATE_LIMIT` for that day and take it back out afterwards —
// leaving it high permanently re-opens bulk account creation, which is the
// whole thing this limit exists to prevent.
const REGISTER_LIMIT = positiveIntFromEnv(process.env.REGISTER_RATE_LIMIT, 10);
const REGISTER_WINDOW_MS =
  positiveIntFromEnv(process.env.REGISTER_RATE_LIMIT_WINDOW_MINUTES, 5) * 60 * 1000;

/** Same text whether the email is unknown or the password is wrong. */
const INVALID_CREDENTIALS_MESSAGE = 'Email atau kata sandi salah.';

/**
 * Deliberately identical for "email tidak terdaftar" and "email terkirim".
 * Anything else turns the form into a membership check on staff email addresses.
 */
const RESET_REQUESTED_MESSAGE =
  'Jika email tersebut terdaftar, tautan atur ulang kata sandi telah dikirim. Periksa kotak masuk dan folder spam Anda.';

/**
 * Same wording for "no such account", "already verified" and "link re-sent" —
 * otherwise "kirim ulang" becomes an oracle for which addresses are registered
 * and which are still pending.
 */
const VERIFICATION_RESENT_MESSAGE =
  'Jika email tersebut terdaftar dan belum diverifikasi, tautan verifikasi baru telah dikirim. Periksa kotak masuk dan folder spam Anda.';

/** Async since the counters moved to Redis; every call site awaits it. */
async function throttle(
  key: string,
  limit: number,
  windowMs: number,
  message: string
) {
  const result = await consumeRateLimit(key, limit, windowMs);
  if (!result.allowed) {
    const minutes = Math.ceil(result.retryAfterSeconds / 60);
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `${message} Coba lagi dalam ${minutes} menit.`,
    });
  }
}

/** Shape returned to the client for the signed-in user. */
function publicUser(user: {
  id: number;
  nama: string;
  email: string;
  peran: string;
  assignedVillageId: number | null;
  assignedKecamatan: string | null;
}) {
  return {
    id: user.id,
    nama: user.nama,
    email: user.email,
    peran: user.peran,
    assignedVillageId: user.assignedVillageId,
    assignedKecamatan: user.assignedKecamatan,
  };
}

export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.appUser.id,
      nama: ctx.appUser.nama,
      email: ctx.appUser.email,
      peran: ctx.appUser.peran,
      assignedVillageId: ctx.appUser.assignedVillageId,
      assignedKecamatan: ctx.appUser.assignedKecamatan,
      nomorHP: ctx.appUser.nomorHP,
      nipNik: ctx.appUser.nipNik,
      // The stored value is a private-bucket object key; only the signed link
      // ever leaves the server.
      fotoProfilUrl: await signAvatarUrl(ctx.appUser.fotoProfil),
    };
  }),

  getUser: protectedProcedure.query(async ({ ctx }) => {
    // Never ship the row verbatim — it carries the scrypt digest, and `ssoSub`
    // is the identifier Keycloak knows this person by. Both become booleans.
    const { passwordHash, ssoSub, ...rest } = ctx.appUser;
    // `!= null` so a missing column reads as "no", never as "yes" — see the
    // same reasoning on `toClientUser` in usersRouter.
    return { ...rest, hasPassword: passwordHash != null, ssoLinked: ssoSub != null };
  }),

  // ==========================================================================
  // Registration
  // ==========================================================================

  /**
   * Public self-registration. Always lands on 'Viewer' — the role is never taken
   * from input, or anyone could mint themselves a Superadmin. An admin promotes
   * the account afterwards from Pengaturan.
   */
  register: publicProcedure
    .input(
      createUserSchema
        .pick({ email: true, nama: true, nipNik: true })
        .extend({
          password: passwordSchema,
          nomorHP: nomorHPSchema,
        })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim();
      await throttle(
        `register:${ctx.requestMeta.ipAddress ?? 'unknown'}`,
        REGISTER_LIMIT,
        REGISTER_WINDOW_MS,
        'Terlalu banyak percobaan pendaftaran.'
      );

      const existing = await queries.getUserByEmail(email);
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.',
        });
      }

      // Refuse before creating anything: an account that can never receive its
      // verification link is unusable, and silently creating it would block the
      // address from being registered again once mail is fixed.
      if (!isMailerConfigured()) {
        console.error(
          'SMTP_USER/SMTP_PASSWORD belum diatur — pendaftaran mandiri tidak dapat mengirim email verifikasi.'
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Layanan email belum dikonfigurasi sehingga pendaftaran tidak dapat diselesaikan. Hubungi administrator sistem.',
        });
      }

      const passwordHash = await hashPassword(input.password);

      let user;
      try {
        user = await queries.createUser({
          email,
          nama: input.nama.trim(),
          nipNik: input.nipNik,
          passwordHash,
          peran: 'Viewer',
          nomorHP: input.nomorHP,
          status: 'Aktif',
          // Left unverified: `login` refuses the account until the mailed link
          // is opened. Status stays 'Aktif' because that column is the admin's
          // switch, not this onboarding step.
          emailVerifiedAt: null,
        });
      } catch {
        // The unique index on users.email is the real guard: two registrations
        // submitted at once both pass the check above, and exactly one insert
        // wins. Report the loser as a duplicate rather than a 500.
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.',
        });
      }

      // No session here, deliberately. Signing the account straight in would
      // make the verification step decorative: the person would already be
      // inside the app and would never need to open the mail.
      const { token, expiresAt } = await createEmailVerificationToken(user.id);
      try {
        await sendEmailVerificationEmail({
          to: user.email,
          nama: user.nama,
          token,
          expiresAt,
        });
      } catch (error) {
        // The account exists but is unreachable. Say so plainly and point at
        // "kirim ulang" rather than leaving the person on a success screen
        // waiting for an email that was never sent.
        console.error('Gagal mengirim email verifikasi:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Akun berhasil dibuat, tetapi email verifikasi gagal dikirim. Gunakan "kirim ulang email verifikasi" di halaman masuk.',
        });
      }

      return { email: user.email, nama: user.nama, verificationSent: true as const };
    }),

  // ==========================================================================
  // Login / logout
  // ==========================================================================

  /**
   * Step 1 of the two-step sign-in form: given an email, say whether to ask for
   * a password or send the person to the reset flow instead. An account created
   * by an admin as an invite has `password_hash = NULL` — there is no password
   * to type, so asking for one would only produce a failure the user cannot act
   * on.
   *
   * ⚠️ This is, by construction, a small account-enumeration oracle: a `'reset'`
   * answer confirms the address belongs to a real, password-less account. The
   * leak is deliberately kept as narrow as the feature allows:
   *
   *   - unknown email      → 'password' (indistinguishable from a normal account;
   *                          the failure comes later, from the generic login error)
   *   - deactivated account→ 'password' (status is never revealed here)
   *   - has a password     → 'password'
   *   - invite pending     → 'reset'
   *
   * So the only fact that escapes is "this address has an unaccepted invite",
   * and it is rate-limited on email+IP like `login` is.
   */
  checkEmail: publicProcedure
    .input(z.object({ email: z.string().refine(isValidEmail, EMAIL_ERROR) }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim();
      await throttle(
        `check-email:${email.toLowerCase()}:${ctx.requestMeta.ipAddress ?? 'unknown'}`,
        LOGIN_LIMIT,
        LOGIN_WINDOW_MS,
        'Terlalu banyak percobaan masuk.'
      );

      const user = await queries.getUserByEmail(email);
      if (user && user.status === 'Aktif' && !user.passwordHash) {
        // An SSO account has no password because it never needed one. Sending it
        // to "lupa sandi" would work, but it answers the wrong question — the
        // button they want is right there on the same page.
        if (user.ssoSub) return { next: 'sso' as const };
        return { next: 'reset' as const };
      }
      return { next: 'password' as const };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().refine(isValidEmail, EMAIL_ERROR),
        // No policy check here on purpose: an old password that predates a
        // policy change must still get its owner in.
        password: z.string().min(1, 'Kata sandi wajib diisi'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim();
      const ip = ctx.requestMeta.ipAddress ?? 'unknown';
      await throttle(
        `login:${email.toLowerCase()}:${ip}`,
        LOGIN_LIMIT,
        LOGIN_WINDOW_MS,
        'Terlalu banyak percobaan masuk.'
      );

      const user = await queries.getUserByEmail(email);

      // Unknown email and password-less account both still pay for one hash, so
      // response time does not reveal which case it was.
      if (!user?.passwordHash) {
        await fakeVerifyPassword(input.password);
        await recordAudit({
          actor: ANON_ACTOR(email),
          aksi: 'auth.login',
          ringkasan: `Percobaan masuk gagal untuk ${email} (akun tidak dikenal atau belum bersandi)`,
          hasil: 'gagal',
          galat: INVALID_CREDENTIALS_MESSAGE,
          ipAddress: ctx.requestMeta.ipAddress,
          userAgent: ctx.requestMeta.userAgent,
        });
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: INVALID_CREDENTIALS_MESSAGE,
        });
      }

      const ok = await verifyPassword(input.password, user.passwordHash);
      if (!ok) {
        await recordAudit({
          actor: { id: user.id, nama: user.nama, email: user.email, peran: user.peran },
          aksi: 'auth.login',
          entitasId: user.id,
          ringkasan: `Percobaan masuk gagal untuk ${email} (kata sandi salah)`,
          hasil: 'gagal',
          galat: INVALID_CREDENTIALS_MESSAGE,
          ipAddress: ctx.requestMeta.ipAddress,
          userAgent: ctx.requestMeta.userAgent,
        });
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: INVALID_CREDENTIALS_MESSAGE,
        });
      }

      // Checked only after the password is confirmed: telling an anonymous
      // caller "akun dinonaktifkan" would confirm the address is a real account.
      if (user.status !== 'Aktif') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ACCOUNT_DEACTIVATED_MESSAGE,
        });
      }

      // Same reasoning, same placement: only someone who already proved they
      // know the password learns that this account is merely unverified.
      if (!user.emailVerifiedAt) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: EMAIL_NOT_VERIFIED_MESSAGE,
        });
      }

      await resetRateLimit(`login:${email.toLowerCase()}:${ip}`);
      // `checkEmail` runs once per visit to the sign-in form, and it has its own
      // bucket. Clearing only the login bucket meant a *successful* sign-in still
      // spent budget that was never given back: someone signing in and out ten
      // times inside ten minutes — a training session, a shared demo laptop —
      // was stopped at the very first step of the eleventh attempt without ever
      // having typed a wrong password. Success clears both counters.
      await resetRateLimit(`check-email:${email.toLowerCase()}:${ip}`);

      const { token, expiresAt } = await createSession(user.id, ctx.requestMeta);
      ctx.resHeaders?.append('set-cookie', sessionCookie(token, expiresAt));
      await queries.touchUserLastLogin(user.id);

      await recordAudit({
        actor: { id: user.id, nama: user.nama, email: user.email, peran: user.peran },
        aksi: 'auth.login',
        entitasId: user.id,
        ringkasan: `${user.nama} masuk ke sistem`,
        ipAddress: ctx.requestMeta.ipAddress,
        userAgent: ctx.requestMeta.userAgent,
      });

      return { user: publicUser(user) };
    }),

  /**
   * Public rather than protected: a deactivated or already-expired session must
   * still be able to clear its cookie, and `protectedProcedure` would refuse it.
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionToken) {
      await invalidateSession(ctx.sessionToken);
    }
    ctx.resHeaders?.append('set-cookie', clearedSessionCookie());
    return { success: true };
  }),

  // ==========================================================================
  // Email verification
  // ==========================================================================

  /** Whether a verification link is still usable, so the page can show a clear
   *  expiry notice instead of a button that will fail. */
  verifyEmailToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const found = await checkEmailVerificationToken(input.token);
      if (!found) return { valid: false as const };
      return { valid: true as const, email: found.user.email, nama: found.user.nama };
    }),

  /** Redeem the link: stamp the account verified and sign the person in. */
  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const found = await checkEmailVerificationToken(input.token);
      if (!found) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Tautan verifikasi tidak valid atau sudah kedaluwarsa. Minta tautan baru dari halaman masuk.',
        });
      }

      // Claim before writing, so two clicks on the same link cannot both pass.
      const claimed = await markEmailVerificationTokenUsed(found.token.id);
      if (!claimed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Tautan verifikasi sudah digunakan.',
        });
      }

      const user = await queries.markEmailVerified(found.user.id);

      // An admin may have deactivated the account between signup and the click.
      // Verification still stands, but it does not buy a session.
      if (user.status !== 'Aktif') {
        return { success: true, signedIn: false as const };
      }

      // Signing in here is safe in a way it was not at registration: opening
      // this link is the proof that was missing.
      const { token, expiresAt } = await createSession(user.id, ctx.requestMeta);
      ctx.resHeaders?.append('set-cookie', sessionCookie(token, expiresAt));
      await queries.touchUserLastLogin(user.id);

      return { success: true, signedIn: true as const };
    }),

  /**
   * Re-send the verification link. Answers identically for every address —
   * unknown, already verified, or genuinely pending — so it cannot be used to
   * find out which addresses have accounts.
   */
  resendVerificationEmail: publicProcedure
    .input(z.object({ email: z.string().refine(isValidEmail, EMAIL_ERROR) }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim();
      await throttle(
        `verify-resend:${email.toLowerCase()}:${ctx.requestMeta.ipAddress ?? 'unknown'}`,
        RESET_REQUEST_LIMIT,
        RESET_REQUEST_WINDOW_MS,
        'Terlalu banyak permintaan email verifikasi.'
      );

      if (!isMailerConfigured()) {
        console.error(
          'SMTP_USER/SMTP_PASSWORD belum diatur — email verifikasi tidak dapat dikirim.'
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Layanan email belum dikonfigurasi. Hubungi administrator sistem.',
        });
      }

      const user = await queries.getUserByEmail(email);

      // Nothing to send for an unknown, already-verified or deactivated account
      // — but the caller is told the same thing either way.
      if (user && user.status === 'Aktif' && !user.emailVerifiedAt) {
        const { token, expiresAt } = await createEmailVerificationToken(user.id);
        try {
          await sendEmailVerificationEmail({
            to: user.email,
            nama: user.nama,
            token,
            expiresAt,
          });
        } catch (error) {
          console.error('Gagal mengirim ulang email verifikasi:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Gagal mengirim email. Coba beberapa saat lagi.',
          });
        }
      }

      return { message: VERIFICATION_RESENT_MESSAGE };
    }),

  // ==========================================================================
  // Password management
  // ==========================================================================

  /**
   * Self-service profile edit, limited to the two contact fields a person can
   * correct about themselves.
   *
   * Deliberately narrow: `peran`, `status`, `assignedVillageId` and
   * `assignedKecamatan` decide what the account may do, and `email` is the login
   * identifier — none of them can be reached from here, so this cannot become a
   * way to escalate a role or take over an address. Those stay in Pengaturan,
   * behind `adminProcedure`.
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        nipNik: createUserSchema.shape.nipNik,
        nomorHP: optionalNomorHPSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.appUser;

      const updated = await queries.updateUser(user.id, {
        nipNik: input.nipNik,
        nomorHP: input.nomorHP ?? null,
      });

      ctx.audit.set({
        entitasId: user.id,
        ringkasan: 'Memperbarui profil sendiri (NIP/NIK, nomor HP)',
        sebelum: { nipNik: user.nipNik, nomorHP: user.nomorHP },
        sesudah: { nipNik: updated.nipNik, nomorHP: updated.nomorHP },
      });

      // Same shape as `me`, so the client can drop it straight into that cache.
      return {
        ...publicUser(updated),
        nomorHP: updated.nomorHP,
        nipNik: updated.nipNik,
      };
    }),

  /**
   * Replace the signed-in user's profile photo.
   *
   * The image arrives already cropped to 1:1 and resized by the client (see
   * `AvatarCropDialog`), so this only has to check that it is a small image of
   * an accepted type — there is no image decoder on the server to re-crop with,
   * and the UI renders the photo in a square container with `object-cover`, so
   * an odd aspect ratio can never break a layout even if one got through.
   */
  uploadAvatar: protectedProcedure
    .input(
      z.object({
        /** base64 of the cropped image, without the data: URL prefix. */
        fileData: z.string().min(1, 'Data gambar kosong'),
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.appUser;

      let buffer: Buffer;
      try {
        buffer = Buffer.from(input.fileData, 'base64');
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data gambar tidak valid.' });
      }

      if (buffer.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data gambar tidak valid.' });
      }
      if (buffer.length > MAX_AVATAR_BYTES) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Ukuran foto maksimal ${MAX_AVATAR_BYTES / 1024 / 1024} MB.`,
        });
      }

      const key = buildAvatarKey(user.id, input.mimeType);
      try {
        await uploadFileToS3(buffer, key, input.mimeType);
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengunggah foto profil. Coba lagi.',
        });
      }

      const previousKey = user.fotoProfil;
      const updated = await queries.updateUser(user.id, { fotoProfil: key });

      // Only after the row points at the new object: deleting first would leave
      // the account with a broken photo if the update failed.
      if (previousKey && previousKey !== key) {
        await deleteFileFromS3(previousKey).catch((error) => {
          console.error('Foto profil lama gagal dihapus:', error);
        });
      }

      ctx.audit.set({
        entitasId: user.id,
        ringkasan: 'Memperbarui foto profil sendiri',
        sebelum: { fotoProfil: previousKey },
        sesudah: { fotoProfil: updated.fotoProfil },
      });

      return { fotoProfilUrl: await signAvatarUrl(updated.fotoProfil) };
    }),

  /** Remove the photo and fall back to the initials avatar. */
  removeAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    const user = ctx.appUser;
    if (!user.fotoProfil) return { fotoProfilUrl: null };

    await queries.updateUser(user.id, { fotoProfil: null });
    await deleteFileFromS3(user.fotoProfil).catch((error) => {
      console.error('Foto profil gagal dihapus dari penyimpanan:', error);
    });

    ctx.audit.set({
      entitasId: user.id,
      ringkasan: 'Menghapus foto profil sendiri',
      sebelum: { fotoProfil: user.fotoProfil },
      sesudah: { fotoProfil: null },
    });

    return { fotoProfilUrl: null };
  }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi'),
        newPassword: passwordSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.appUser;

      if (!user.passwordHash) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Akun ini belum memiliki kata sandi. Gunakan tautan "Lupa kata sandi" untuk membuatnya.',
        });
      }

      const ok = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!ok) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Kata sandi saat ini salah.',
        });
      }

      if (input.currentPassword === input.newPassword) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
        });
      }

      const passwordHash = await hashPassword(input.newPassword);
      await queries.setUserPassword(user.id, passwordHash);

      // Changing a password is how someone reacts to a suspected compromise, so
      // every other device is signed out. The current one is re-issued below so
      // the user is not kicked out of the tab they are working in.
      await invalidateAllUserSessions(user.id);
      const { token, expiresAt } = await createSession(user.id, ctx.requestMeta);
      ctx.resHeaders?.append('set-cookie', sessionCookie(token, expiresAt));

      return { success: true };
    }),

  /**
   * Step 1 of "lupa sandi": mail a one-hour link. Answers the same way for every
   * input, including addresses that do not exist.
   */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().refine(isValidEmail, EMAIL_ERROR) }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim();
      await throttle(
        `reset:${email.toLowerCase()}:${ctx.requestMeta.ipAddress ?? 'unknown'}`,
        RESET_REQUEST_LIMIT,
        RESET_REQUEST_WINDOW_MS,
        'Terlalu banyak permintaan atur ulang kata sandi.'
      );

      if (!isMailerConfigured()) {
        // A misconfigured server must not silently swallow reset requests —
        // that reads as "the email never arrived" and is impossible to debug.
        console.error(
          'SMTP_USER/SMTP_PASSWORD belum diatur — permintaan reset kata sandi tidak dapat dikirim.'
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Layanan email belum dikonfigurasi. Hubungi administrator sistem.',
        });
      }

      const user = await queries.getUserByEmail(email);

      // A deactivated account gets no link: it could not sign in with the new
      // password anyway.
      if (user && user.status === 'Aktif') {
        const { token, expiresAt } = await createPasswordResetToken(user.id);
        try {
          await sendPasswordResetEmail({
            to: user.email,
            nama: user.nama,
            token,
            expiresAt,
          });
        } catch (error) {
          // Logged server-side, generic to the caller — the failure reason can
          // name an internal host or account.
          console.error('Gagal mengirim email atur ulang kata sandi:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Gagal mengirim email. Coba beberapa saat lagi.',
          });
        }
      }

      return { message: RESET_REQUESTED_MESSAGE };
    }),

  /** Whether a reset link is still usable — lets the page show a clear expiry
   *  notice instead of a form that will fail on submit. */
  verifyPasswordResetToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const found = await consumeCheckPasswordResetToken(input.token);
      if (!found) return { valid: false as const };
      return {
        valid: true as const,
        email: found.user.email,
        nama: found.user.nama,
      };
    }),

  /** Step 2 of "lupa sandi": redeem the link and set the new password. */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, 'Token tidak valid'),
        newPassword: passwordSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const found = await consumeCheckPasswordResetToken(input.token);
      if (!found) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Tautan atur ulang kata sandi tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.',
        });
      }

      // Claim the token before touching the password: if two submissions race,
      // only the one that flips `usedAt` proceeds.
      const claimed = await markPasswordResetTokenUsed(found.token.id);
      if (!claimed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Tautan atur ulang kata sandi sudah digunakan.',
        });
      }

      const passwordHash = await hashPassword(input.newPassword);
      await queries.setUserPassword(found.user.id, passwordHash);

      // Opening this link proves control of the mailbox, which is exactly what
      // verification asks for — so redeeming it verifies the address too. That
      // is what lets an admin-created account be born unverified: its invite is
      // one of these links, and without this the person would set a password
      // and then be refused at login for never having "verified".
      if (!found.user.emailVerifiedAt) {
        await queries.markEmailVerified(found.user.id);
      }

      // Whoever asked for this link may be locking an intruder out; drop every
      // existing session rather than leaving the old cookies valid.
      await invalidateAllUserSessions(found.user.id);

      // A deactivated account can set a password but not get a session out of
      // it — the admin still has to switch it back on.
      if (found.user.status !== 'Aktif') {
        return { success: true, signedIn: false as const };
      }

      const { token, expiresAt } = await createSession(found.user.id, ctx.requestMeta);
      ctx.resHeaders?.append('set-cookie', sessionCookie(token, expiresAt));
      await queries.touchUserLastLogin(found.user.id);

      return { success: true, signedIn: true as const };
    }),

  // ==========================================================================
  // Devices
  // ==========================================================================

  /** Live sessions for the signed-in user, with the current one flagged. */
  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const currentId = ctx.sessionToken ? sessionIdFromToken(ctx.sessionToken) : null;
    const rows = await listUserSessions(ctx.appUser.id);
    return rows.map((row) => ({
      // The row id is the token digest; exposing it would be handing out a
      // lookup key for someone else's session. Only "is this me" is needed.
      isCurrent: row.id === currentId,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    }));
  }),

  /** Sign out everywhere, including the current device. */
  revokeAllSessions: protectedProcedure.mutation(async ({ ctx }) => {
    await invalidateAllUserSessions(ctx.appUser.id);
    ctx.resHeaders?.append('set-cookie', clearedSessionCookie());
    return { success: true };
  }),
});
