/**
 * users.create — the account-activation contract.
 *
 * An admin cannot hand out a password: every account is created without one and
 * activated through an invite email that both sets the first password and proves
 * the address exists. These tests pin that down, because the failure mode of a
 * regression here is silent (an account nobody can sign in to, or an account
 * usable by someone who never read the invite).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';
import type { UserRole } from '@/types';

vi.mock('@/server/db/db', () => ({ db: {} }));
vi.mock('@/server/db/queries/user', () => ({
  listUsers: vi.fn(),
  listUsersByVillage: vi.fn(),
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock('@/server/auth/session', () => ({
  invalidateAllUserSessions: vi.fn(async () => undefined),
}));
vi.mock('@/server/auth/mailer', () => ({
  isMailerConfigured: vi.fn(() => true),
  sendAccountInviteEmail: vi.fn(async () => undefined),
  sendPasswordResetEmail: vi.fn(async () => undefined),
}));
vi.mock('@/server/auth/password-reset', () => ({
  createPasswordResetToken: vi.fn(async () => ({
    token: 'invite-token',
    expiresAt: new Date(Date.now() + 3_600_000),
  })),
}));

import { usersRouter } from './usersRouter';
import * as userQueries from '@/server/db/queries/user';
import * as mailer from '@/server/auth/mailer';
import * as passwordReset from '@/server/auth/password-reset';

const createUserMock = vi.mocked(userQueries.createUser);
const getUserByEmailMock = vi.mocked(userQueries.getUserByEmail);
const isMailerConfiguredMock = vi.mocked(mailer.isMailerConfigured);
const sendAccountInviteEmailMock = vi.mocked(mailer.sendAccountInviteEmail);
const createPasswordResetTokenMock = vi.mocked(passwordReset.createPasswordResetToken);

function ctx(peran: UserRole = 'Superadmin'): TRPCContext {
  return {
    userId: 1,
    db: {} as TRPCContext['db'],
    appUser: {
      id: 1,
      nama: 'Super',
      email: 'super@example.com',
      passwordHash: 'scrypt$16384$8$1$c2FsdA==$aGFzaA==',
      nipNik: '12345',
      peran,
      assignedVillageId: null,
      assignedKecamatan: null,
      status: 'Aktif',
      nomorHP: null,
      emailVerifiedAt: new Date(),
      terakhirMasuk: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    sessionToken: 'session-1',
    resHeaders: new Headers(),
    requestMeta: { userAgent: 'vitest', ipAddress: '127.0.0.1' },
  } satisfies TRPCContext;
}

const payload = {
  nama: 'Siti Rahayu',
  email: 'siti@pemda.go.id',
  nipNik: '3201010101010002',
  peran: 'Viewer' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  isMailerConfiguredMock.mockReturnValue(true);
  createPasswordResetTokenMock.mockResolvedValue({
    token: 'invite-token',
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  getUserByEmailMock.mockResolvedValue(undefined as never);
  createUserMock.mockImplementation(
    async (data: Record<string, unknown>) => ({ id: 99, ...data }) as never
  );
});

describe('users.create — invite by email', () => {
  it('creates the account without a password and unverified', async () => {
    await usersRouter.createCaller(ctx()).create(payload);

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: null, emailVerifiedAt: null })
    );
  });

  it('mails the invite as part of the save, not as a later manual step', async () => {
    const result = await usersRouter.createCaller(ctx()).create(payload);

    expect(createPasswordResetTokenMock).toHaveBeenCalledWith(99);
    expect(sendAccountInviteEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: payload.email, token: 'invite-token' })
    );
    // The mutation only resolves after the mail is handed over, so the UI can
    // state "undangan terkirim" as fact.
    expect(result.hasPassword).toBe(false);
  });

  it('ignores a password sent by a stale client rather than honouring it', async () => {
    // Zod strips unknown keys, so an old bundle still posting `password` cannot
    // resurrect the removed "sandi awal" path — the account is invited anyway.
    await usersRouter
      .createCaller(ctx())
      .create({ ...payload, password: 'Rahasia123' } as never);

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: null })
    );
    expect(sendAccountInviteEmailMock).toHaveBeenCalled();
  });

  it('refuses to create anyone when mail is not configured', async () => {
    isMailerConfiguredMock.mockReturnValue(false);

    // Without mail there is no way into the account at all, so no row is made.
    await expect(usersRouter.createCaller(ctx()).create(payload)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('reports a failed invite loudly, so nobody assumes the mail went out', async () => {
    sendAccountInviteEmailMock.mockRejectedValueOnce(new Error('SMTP down'));

    await expect(usersRouter.createCaller(ctx()).create(payload)).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
    // The account itself survives — the fix is resending, not recreating.
    expect(createUserMock).toHaveBeenCalled();
  });
});
