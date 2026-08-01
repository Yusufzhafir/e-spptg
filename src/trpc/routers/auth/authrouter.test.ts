import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';
import {
  ACCOUNT_DEACTIVATED_MESSAGE,
  EMAIL_NOT_VERIFIED_MESSAGE,
} from '@/lib/account-status';

// --- Everything that touches Postgres or SMTP is stubbed; these tests are about
// --- the decisions the router makes, not the storage underneath it.
vi.mock('@/server/db/db', () => ({ db: {} }));

const getUserByEmailMock = vi.fn();
const createUserMock = vi.fn();
const setUserPasswordMock = vi.fn();
const touchUserLastLoginMock = vi.fn();
const markEmailVerifiedMock = vi.fn();
vi.mock('@/server/db/queries/user', () => ({
  getUserByEmail: (...args: unknown[]) => getUserByEmailMock(...args),
  createUser: (...args: unknown[]) => createUserMock(...args),
  setUserPassword: (...args: unknown[]) => setUserPasswordMock(...args),
  touchUserLastLogin: (...args: unknown[]) => touchUserLastLoginMock(...args),
  markEmailVerified: (...args: unknown[]) => markEmailVerifiedMock(...args),
  getUserById: vi.fn(),
}));

const createSessionMock = vi.fn();
const invalidateSessionMock = vi.fn();
const invalidateAllUserSessionsMock = vi.fn();
vi.mock('@/server/auth/session', () => ({
  createSession: (...args: unknown[]) => createSessionMock(...args),
  invalidateSession: (...args: unknown[]) => invalidateSessionMock(...args),
  invalidateAllUserSessions: (...args: unknown[]) => invalidateAllUserSessionsMock(...args),
  listUserSessions: vi.fn(async () => []),
  sessionIdFromToken: vi.fn((token: string) => `hash-${token}`),
}));

const sendPasswordResetEmailMock = vi.fn();
const sendEmailVerificationEmailMock = vi.fn();
const isMailerConfiguredMock = vi.fn(() => true);
vi.mock('@/server/auth/mailer', () => ({
  isMailerConfigured: () => isMailerConfiguredMock(),
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
  sendEmailVerificationEmail: (...args: unknown[]) =>
    sendEmailVerificationEmailMock(...args),
  sendAccountInviteEmail: vi.fn(),
}));

const createEmailVerificationTokenMock = vi.fn();
const checkEmailVerificationTokenMock = vi.fn();
const markEmailVerificationTokenUsedMock = vi.fn();
vi.mock('@/server/auth/email-verification', () => ({
  createEmailVerificationToken: (...a: unknown[]) =>
    createEmailVerificationTokenMock(...a),
  checkEmailVerificationToken: (...a: unknown[]) =>
    checkEmailVerificationTokenMock(...a),
  markEmailVerificationTokenUsed: (...a: unknown[]) =>
    markEmailVerificationTokenUsedMock(...a),
}));

const consumeCheckPasswordResetTokenMock = vi.fn();
const createPasswordResetTokenMock = vi.fn();
const markPasswordResetTokenUsedMock = vi.fn();
vi.mock('@/server/auth/password-reset', () => ({
  consumeCheckPasswordResetToken: (...a: unknown[]) => consumeCheckPasswordResetTokenMock(...a),
  createPasswordResetToken: (...a: unknown[]) => createPasswordResetTokenMock(...a),
  markPasswordResetTokenUsed: (...a: unknown[]) => markPasswordResetTokenUsedMock(...a),
}));

import { authRouter } from './authrouter';
import { hashPassword } from '@/server/auth/password';
import { __clearRateLimits } from '@/server/auth/rate-limit';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';

const PASSWORD = 'Rahasia123';
let PASSWORD_HASH: string;

type UserRow = NonNullable<TRPCContext['appUser']>;

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 7,
    nama: 'Budi Santoso',
    email: 'budi@pemda.go.id',
    passwordHash: PASSWORD_HASH,
    nipNik: '3201010101010001',
    peran: 'Viewer',
    assignedVillageId: null,
    assignedKecamatan: null,
    status: 'Aktif',
    nomorHP: null,
    // Verified: these fixtures stand in for existing, usable accounts.
    emailVerifiedAt: new Date(),
    terakhirMasuk: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Anonymous caller with a live `resHeaders` so cookie writes are observable. */
function anonCtx(): TRPCContext {
  return {
    db: {} as TRPCContext['db'],
    userId: null,
    appUser: null,
    sessionToken: null,
    resHeaders: new Headers(),
    requestMeta: { userAgent: 'vitest', ipAddress: '198.51.100.7' },
  };
}

function signedInCtx(user: UserRow = userRow()): TRPCContext {
  return {
    db: {} as TRPCContext['db'],
    userId: user.id,
    appUser: user,
    sessionToken: 'raw-token',
    resHeaders: new Headers(),
    requestMeta: { userAgent: 'vitest', ipAddress: '198.51.100.7' },
  };
}

function setCookieHeader(ctx: TRPCContext): string | null {
  return ctx.resHeaders?.get('set-cookie') ?? null;
}

/**
 * Calls `attempt` until it is refused with TOO_MANY_REQUESTS and returns how
 * many calls succeeded first — i.e. the effective limit.
 *
 * Asserting the measured number, rather than looping a hard-coded count and
 * expecting the next one to fail, means a change to the limit shows up as a
 * readable "expected 10, got 8" instead of a mysterious failure.
 */
async function hitungBatas(
  attempt: () => Promise<unknown>,
  maxPercobaan = 60
): Promise<number> {
  for (let i = 0; i < maxPercobaan; i += 1) {
    const error = await attempt().then(
      () => null,
      (e: { code?: string }) => e
    );
    if (error?.code === 'TOO_MANY_REQUESTS') return i;
  }
  throw new Error(`tidak pernah kena rate limit dalam ${maxPercobaan} percobaan`);
}

beforeEach(async () => {
  PASSWORD_HASH ??= await hashPassword(PASSWORD);
  vi.clearAllMocks();
  __clearRateLimits();
  isMailerConfiguredMock.mockReturnValue(true);
  createSessionMock.mockResolvedValue({
    token: 'new-session-token',
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  createEmailVerificationTokenMock.mockResolvedValue({
    token: 'verify-token',
    expiresAt: new Date(Date.now() + 86_400_000),
  });
});

// ---------------------------------------------------------------------------
describe('auth.login', () => {
  it('issues a session cookie for the right password', async () => {
    getUserByEmailMock.mockResolvedValue(userRow());
    const ctx = anonCtx();

    const result = await authRouter
      .createCaller(ctx)
      .login({ email: 'budi@pemda.go.id', password: PASSWORD });

    expect(result.user.id).toBe(7);
    expect(createSessionMock).toHaveBeenCalledWith(7, ctx.requestMeta);
    expect(setCookieHeader(ctx)).toContain(`${SESSION_COOKIE_NAME}=new-session-token`);
    expect(setCookieHeader(ctx)).toContain('HttpOnly');
  });

  it('never returns the password hash to the client', async () => {
    getUserByEmailMock.mockResolvedValue(userRow());
    const result = await authRouter
      .createCaller(anonCtx())
      .login({ email: 'budi@pemda.go.id', password: PASSWORD });

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toContain('scrypt');
  });

  it('answers identically for an unknown email and a wrong password', async () => {
    getUserByEmailMock.mockResolvedValue(undefined);
    const unknown = await authRouter
      .createCaller(anonCtx())
      .login({ email: 'tidak-ada@pemda.go.id', password: PASSWORD })
      .catch((error: Error) => error);

    getUserByEmailMock.mockResolvedValue(userRow());
    const wrong = await authRouter
      .createCaller(anonCtx())
      .login({ email: 'budi@pemda.go.id', password: 'SalahSekali9' })
      .catch((error: Error) => error);

    // Same code and same wording — otherwise the form enumerates accounts.
    expect(unknown).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(wrong).toMatchObject({ code: 'UNAUTHORIZED' });
    expect((unknown as Error).message).toBe((wrong as Error).message);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('refuses an account with no password set (invite not yet accepted)', async () => {
    getUserByEmailMock.mockResolvedValue(userRow({ passwordHash: null }));

    await expect(
      authRouter.createCaller(anonCtx()).login({ email: 'budi@pemda.go.id', password: PASSWORD })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('refuses a deactivated account even with the right password', async () => {
    getUserByEmailMock.mockResolvedValue(userRow({ status: 'Nonaktif' }));

    await expect(
      authRouter.createCaller(anonCtx()).login({ email: 'budi@pemda.go.id', password: PASSWORD })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: ACCOUNT_DEACTIVATED_MESSAGE,
    });
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('throttles repeated failures for the same email and IP', async () => {
    getUserByEmailMock.mockResolvedValue(userRow());

    const batas = await hitungBatas(() =>
      authRouter
        .createCaller(anonCtx())
        .login({ email: 'budi@pemda.go.id', password: 'Salah123x' })
    );

    expect(batas, 'batas login berubah dari 10 percobaan').toBe(10);
  });

  it('matches the email case-insensitively', async () => {
    getUserByEmailMock.mockResolvedValue(userRow());
    await authRouter
      .createCaller(anonCtx())
      .login({ email: 'Budi@Pemda.go.id', password: PASSWORD });

    // Case folding is the query's job; the router must pass the address through.
    expect(getUserByEmailMock).toHaveBeenCalledWith('Budi@Pemda.go.id');
  });
});

// ---------------------------------------------------------------------------
describe('auth.checkEmail', () => {
  it('asks for a password when the account has one', async () => {
    getUserByEmailMock.mockResolvedValue(userRow());

    await expect(
      authRouter.createCaller(anonCtx()).checkEmail({ email: 'budi@pemda.go.id' })
    ).resolves.toEqual({ next: 'password' });
  });

  it('sends an account with an unaccepted invite to the reset flow', async () => {
    getUserByEmailMock.mockResolvedValue(userRow({ passwordHash: null }));

    await expect(
      authRouter.createCaller(anonCtx()).checkEmail({ email: 'budi@pemda.go.id' })
    ).resolves.toEqual({ next: 'reset' });
  });

  it('answers "password" for an unknown email, so it cannot enumerate accounts', async () => {
    getUserByEmailMock.mockResolvedValue(undefined);

    // Indistinguishable from a real account with a password; the failure comes
    // later from login's generic message.
    await expect(
      authRouter.createCaller(anonCtx()).checkEmail({ email: 'hantu@pemda.go.id' })
    ).resolves.toEqual({ next: 'password' });
  });

  it('does not reveal that an account is deactivated', async () => {
    getUserByEmailMock.mockResolvedValue(userRow({ status: 'Nonaktif' }));
    await expect(
      authRouter.createCaller(anonCtx()).checkEmail({ email: 'budi@pemda.go.id' })
    ).resolves.toEqual({ next: 'password' });

    // Even the deactivated-and-password-less combination stays on 'password':
    // 'reset' would confirm the address belongs to a real account.
    __clearRateLimits();
    getUserByEmailMock.mockResolvedValue(userRow({ status: 'Nonaktif', passwordHash: null }));
    await expect(
      authRouter.createCaller(anonCtx()).checkEmail({ email: 'budi@pemda.go.id' })
    ).resolves.toEqual({ next: 'password' });
  });

  it('is throttled, so the oracle cannot be scraped', async () => {
    getUserByEmailMock.mockResolvedValue(userRow());

    const batas = await hitungBatas(() =>
      authRouter.createCaller(anonCtx()).checkEmail({ email: 'budi@pemda.go.id' })
    );

    // Shares the login bucket size: both are guesses against the same address.
    expect(batas, 'batas cek email berubah dari 10 percobaan').toBe(10);
  });

  it('never issues a session', async () => {
    getUserByEmailMock.mockResolvedValue(userRow());
    const ctx = anonCtx();

    await authRouter.createCaller(ctx).checkEmail({ email: 'budi@pemda.go.id' });

    expect(createSessionMock).not.toHaveBeenCalled();
    expect(setCookieHeader(ctx)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('auth.register', () => {
  const payload = {
    nama: 'Siti Rahayu',
    nipNik: '3201010101010002',
    email: 'siti@pemda.go.id',
    password: PASSWORD,
  };

  it('always creates a Viewer, whatever the caller sends', async () => {
    getUserByEmailMock.mockResolvedValue(undefined);
    createUserMock.mockResolvedValue(userRow({ id: 21, email: payload.email }));

    await authRouter
      .createCaller(anonCtx())
      // A client that adds `peran` must not be able to promote itself.
      .register({ ...payload, peran: 'Superadmin' } as never);

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ peran: 'Viewer' })
    );
  });

  it('stores a hash, never the plaintext password', async () => {
    getUserByEmailMock.mockResolvedValue(undefined);
    createUserMock.mockResolvedValue(userRow({ id: 21 }));

    await authRouter.createCaller(anonCtx()).register(payload);

    const stored = createUserMock.mock.calls[0][0] as { passwordHash: string };
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
    expect(stored.passwordHash).not.toContain(PASSWORD);
  });

  it('rejects a duplicate email', async () => {
    getUserByEmailMock.mockResolvedValue(userRow());

    await expect(authRouter.createCaller(anonCtx()).register(payload)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('reports a lost insert race as a duplicate, not a 500', async () => {
    getUserByEmailMock.mockResolvedValue(undefined);
    // The unique index rejects the second concurrent insert.
    createUserMock.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(authRouter.createCaller(anonCtx()).register(payload)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('rejects a password shorter than the minimum', async () => {
    getUserByEmailMock.mockResolvedValue(undefined);

    // The minimum is 5 characters, so this has to be a genuinely short string —
    // "abcd1" is five characters with a digit and is accepted.
    await expect(
      authRouter.createCaller(anonCtx()).register({ ...payload, password: 'abc1' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('rejects a long password with no digit in it', async () => {
    getUserByEmailMock.mockResolvedValue(undefined);

    await expect(
      authRouter.createCaller(anonCtx()).register({ ...payload, password: 'sandirahasiapanjang' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('accepts a short lower-case-only password as long as it contains a digit', async () => {
    getUserByEmailMock.mockResolvedValue(undefined);
    createUserMock.mockResolvedValue(userRow({ id: 22, email: payload.email }));

    await expect(
      authRouter.createCaller(anonCtx()).register({ ...payload, password: 'abcd1' })
    ).resolves.toBeTruthy();
  });

  it('creates the account unverified and does NOT sign it in', async () => {
    getUserByEmailMock.mockResolvedValue(undefined);
    createUserMock.mockResolvedValue(userRow({ id: 21, email: payload.email }));
    const ctx = anonCtx();

    const result = await authRouter.createCaller(ctx).register(payload);

    // Signing in here would make the verification step decorative.
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(setCookieHeader(ctx)).toBeNull();
    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerifiedAt: null })
    );
    expect(result.verificationSent).toBe(true);
    expect(result.email).toBe(payload.email);
  });

  it('mails a verification link to the new address', async () => {
    getUserByEmailMock.mockResolvedValue(undefined);
    createUserMock.mockResolvedValue(userRow({ id: 21, email: payload.email }));

    await authRouter.createCaller(anonCtx()).register(payload);

    expect(createEmailVerificationTokenMock).toHaveBeenCalledWith(21);
    expect(sendEmailVerificationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: payload.email, token: 'verify-token' })
    );
  });

  it('throttles registration per IP', async () => {
    // The throttle runs before the duplicate-email check, so returning an
    // existing user keeps every attempt cheap — no scrypt hashing per loop.
    getUserByEmailMock.mockResolvedValue(userRow());

    const batas = await hitungBatas(() =>
      authRouter.createCaller(anonCtx()).register(payload)
    );
    expect(batas, 'batas pendaftaran berubah dari 10 percobaan').toBe(10);
  });

  it('refuses to create an account it cannot mail', async () => {
    isMailerConfiguredMock.mockReturnValue(false);
    getUserByEmailMock.mockResolvedValue(undefined);

    await expect(
      authRouter.createCaller(anonCtx()).register(payload)
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    // The row must not exist, or the address is blocked from ever registering.
    expect(createUserMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('auth email verification', () => {
  const unverified = () =>
    userRow({ id: 30, email: 'baru@pemda.go.id', emailVerifiedAt: null });

  it('login refuses an unverified account, with its own message', async () => {
    getUserByEmailMock.mockResolvedValue(unverified());

    const call = authRouter
      .createCaller(anonCtx())
      .login({ email: 'baru@pemda.go.id', password: PASSWORD });

    await expect(call).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: EMAIL_NOT_VERIFIED_MESSAGE,
    });
    // Distinct from deactivation: the two have different remedies, so the UI
    // can offer "kirim ulang" for one and "hubungi admin" for the other.
    expect(EMAIL_NOT_VERIFIED_MESSAGE).not.toBe(ACCOUNT_DEACTIVATED_MESSAGE);
  });

  it('verifyEmail stamps the account and signs it in', async () => {
    checkEmailVerificationTokenMock.mockResolvedValue({
      token: { id: 'digest' },
      user: unverified(),
    });
    markEmailVerificationTokenUsedMock.mockResolvedValue(true);
    markEmailVerifiedMock.mockResolvedValue(userRow({ id: 30 }));
    const ctx = anonCtx();

    const result = await authRouter.createCaller(ctx).verifyEmail({ token: 'raw' });

    expect(markEmailVerifiedMock).toHaveBeenCalledWith(30);
    expect(result).toMatchObject({ success: true, signedIn: true });
    expect(setCookieHeader(ctx)).toContain(`${SESSION_COOKIE_NAME}=new-session-token`);
  });

  it('verifyEmail rejects an unknown, expired or spent link', async () => {
    checkEmailVerificationTokenMock.mockResolvedValue(null);

    await expect(
      authRouter.createCaller(anonCtx()).verifyEmail({ token: 'raw' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(markEmailVerifiedMock).not.toHaveBeenCalled();
  });

  it('verifyEmail lets only one of two racing clicks through', async () => {
    checkEmailVerificationTokenMock.mockResolvedValue({
      token: { id: 'digest' },
      user: unverified(),
    });
    // The claiming UPDATE matched no row: someone else already spent it.
    markEmailVerificationTokenUsedMock.mockResolvedValue(false);

    await expect(
      authRouter.createCaller(anonCtx()).verifyEmail({ token: 'raw' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(markEmailVerifiedMock).not.toHaveBeenCalled();
  });

  it('verifyEmail on a deactivated account verifies but grants no session', async () => {
    checkEmailVerificationTokenMock.mockResolvedValue({
      token: { id: 'digest' },
      user: unverified(),
    });
    markEmailVerificationTokenUsedMock.mockResolvedValue(true);
    markEmailVerifiedMock.mockResolvedValue(userRow({ id: 30, status: 'Nonaktif' }));
    const ctx = anonCtx();

    const result = await authRouter.createCaller(ctx).verifyEmail({ token: 'raw' });

    expect(result).toMatchObject({ success: true, signedIn: false });
    expect(setCookieHeader(ctx)).toBeNull();
  });

  it('resend answers identically for pending, verified and unknown addresses', async () => {
    const caller = authRouter.createCaller(anonCtx());

    getUserByEmailMock.mockResolvedValue(unverified());
    const pending = await caller.resendVerificationEmail({ email: 'baru@pemda.go.id' });

    __clearRateLimits();
    getUserByEmailMock.mockResolvedValue(userRow({ emailVerifiedAt: new Date() }));
    const sudah = await authRouter
      .createCaller(anonCtx())
      .resendVerificationEmail({ email: 'lama@pemda.go.id' });

    __clearRateLimits();
    getUserByEmailMock.mockResolvedValue(undefined);
    const takAda = await authRouter
      .createCaller(anonCtx())
      .resendVerificationEmail({ email: 'hantu@pemda.go.id' });

    expect(pending.message).toBe(sudah.message);
    expect(sudah.message).toBe(takAda.message);
    // Only the genuinely pending account triggers an actual send.
    expect(sendEmailVerificationEmailMock).toHaveBeenCalledTimes(1);
  });

  it('resend is throttled', async () => {
    getUserByEmailMock.mockResolvedValue(unverified());

    let throttled = false;
    for (let i = 0; i < 8; i += 1) {
      const error = await authRouter
        .createCaller(anonCtx())
        .resendVerificationEmail({ email: 'baru@pemda.go.id' })
        .catch((e: { code: string }) => e);
      if ('code' in error && error.code === 'TOO_MANY_REQUESTS') {
        throttled = true;
        break;
      }
    }
    expect(throttled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('auth.logout', () => {
  it('deletes the session and clears the cookie', async () => {
    const ctx = signedInCtx();
    await authRouter.createCaller(ctx).logout();

    expect(invalidateSessionMock).toHaveBeenCalledWith('raw-token');
    expect(setCookieHeader(ctx)).toContain('Max-Age=0');
  });

  it('still clears the cookie when there is no session to delete', async () => {
    const ctx = anonCtx();
    await expect(authRouter.createCaller(ctx).logout()).resolves.toEqual({ success: true });
    expect(invalidateSessionMock).not.toHaveBeenCalled();
    expect(setCookieHeader(ctx)).toContain('Max-Age=0');
  });
});

// ---------------------------------------------------------------------------
describe('auth.changePassword', () => {
  it('rejects a wrong current password without writing anything', async () => {
    await expect(
      authRouter
        .createCaller(signedInCtx())
        .changePassword({ currentPassword: 'Salah123x', newPassword: 'BaruSekali9' })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(setUserPasswordMock).not.toHaveBeenCalled();
  });

  it('revokes other devices and re-issues the current session', async () => {
    const ctx = signedInCtx();
    await authRouter
      .createCaller(ctx)
      .changePassword({ currentPassword: PASSWORD, newPassword: 'BaruSekali9' });

    expect(setUserPasswordMock).toHaveBeenCalled();
    expect(invalidateAllUserSessionsMock).toHaveBeenCalledWith(7);
    // The tab doing the change must not be logged out by its own action.
    expect(setCookieHeader(ctx)).toContain(`${SESSION_COOKIE_NAME}=new-session-token`);
  });

  it('refuses reusing the current password', async () => {
    await expect(
      authRouter
        .createCaller(signedInCtx())
        .changePassword({ currentPassword: PASSWORD, newPassword: PASSWORD })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(setUserPasswordMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('auth.requestPasswordReset', () => {
  it('gives the same answer whether or not the email exists', async () => {
    getUserByEmailMock.mockResolvedValue(userRow());
    createPasswordResetTokenMock.mockResolvedValue({
      token: 'reset-token',
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    const known = await authRouter
      .createCaller(anonCtx())
      .requestPasswordReset({ email: 'budi@pemda.go.id' });

    __clearRateLimits();
    getUserByEmailMock.mockResolvedValue(undefined);
    const unknown = await authRouter
      .createCaller(anonCtx())
      .requestPasswordReset({ email: 'hantu@pemda.go.id' });

    expect(known).toEqual(unknown);
    // ...and no mail went to the address that has no account.
    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
  });

  it('sends no link to a deactivated account', async () => {
    getUserByEmailMock.mockResolvedValue(userRow({ status: 'Nonaktif' }));

    await authRouter.createCaller(anonCtx()).requestPasswordReset({ email: 'budi@pemda.go.id' });

    expect(createPasswordResetTokenMock).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it('fails loudly when mail is not configured, rather than silently dropping it', async () => {
    isMailerConfiguredMock.mockReturnValue(false);

    await expect(
      authRouter.createCaller(anonCtx()).requestPasswordReset({ email: 'budi@pemda.go.id' })
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });

  it('throttles repeated requests for the same address', async () => {
    getUserByEmailMock.mockResolvedValue(userRow());
    createPasswordResetTokenMock.mockResolvedValue({
      token: 'reset-token',
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const batas = await hitungBatas(() =>
      authRouter
        .createCaller(anonCtx())
        .requestPasswordReset({ email: 'budi@pemda.go.id' })
    );
    expect(batas, 'batas lupa sandi berubah dari 5 permintaan').toBe(5);

    await expect(
      authRouter.createCaller(anonCtx()).requestPasswordReset({ email: 'budi@pemda.go.id' })
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });
});

// ---------------------------------------------------------------------------
describe('auth.resetPassword', () => {
  const validToken = {
    token: { id: 'token-digest', usedAt: null, expiresAt: new Date(Date.now() + 600_000) },
    user: userRow(),
  };

  it('rejects an unknown or expired link', async () => {
    consumeCheckPasswordResetTokenMock.mockResolvedValue(null);

    await expect(
      authRouter.createCaller(anonCtx()).resetPassword({
        token: 'kedaluwarsa',
        newPassword: 'BaruSekali9',
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(setUserPasswordMock).not.toHaveBeenCalled();
  });

  it('refuses a link that lost the race to be claimed', async () => {
    consumeCheckPasswordResetTokenMock.mockResolvedValue(validToken);
    // Another concurrent submission already flipped `usedAt`.
    markPasswordResetTokenUsedMock.mockResolvedValue(false);

    await expect(
      authRouter
        .createCaller(anonCtx())
        .resetPassword({ token: 'reset-token', newPassword: 'BaruSekali9' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(setUserPasswordMock).not.toHaveBeenCalled();
  });

  it('sets the password, drops every old session, and signs in', async () => {
    consumeCheckPasswordResetTokenMock.mockResolvedValue(validToken);
    markPasswordResetTokenUsedMock.mockResolvedValue(true);
    const ctx = anonCtx();

    const result = await authRouter
      .createCaller(ctx)
      .resetPassword({ token: 'reset-token', newPassword: 'BaruSekali9' });

    expect(result).toEqual({ success: true, signedIn: true });
    expect(invalidateAllUserSessionsMock).toHaveBeenCalledWith(7);
    expect(setCookieHeader(ctx)).toContain(`${SESSION_COOKIE_NAME}=new-session-token`);
  });

  it('verifies the address of an account invited by an admin', async () => {
    // Admin-created accounts are born unverified and are activated only through
    // this link, so redeeming it has to stamp them verified — otherwise the
    // person sets a password and is then refused at login for being unverified.
    consumeCheckPasswordResetTokenMock.mockResolvedValue({
      ...validToken,
      user: userRow({ emailVerifiedAt: null, passwordHash: null }),
    });
    markPasswordResetTokenUsedMock.mockResolvedValue(true);

    const result = await authRouter
      .createCaller(anonCtx())
      .resetPassword({ token: 'invite-token', newPassword: 'BaruSekali9' });

    expect(markEmailVerifiedMock).toHaveBeenCalledWith(7);
    expect(result).toEqual({ success: true, signedIn: true });
  });

  it('leaves an already-verified account alone on a normal reset', async () => {
    consumeCheckPasswordResetTokenMock.mockResolvedValue(validToken);
    markPasswordResetTokenUsedMock.mockResolvedValue(true);

    await authRouter
      .createCaller(anonCtx())
      .resetPassword({ token: 'reset-token', newPassword: 'BaruSekali9' });

    expect(markEmailVerifiedMock).not.toHaveBeenCalled();
  });

  it('sets the password but grants no session to a deactivated account', async () => {
    consumeCheckPasswordResetTokenMock.mockResolvedValue({
      ...validToken,
      user: userRow({ status: 'Nonaktif' }),
    });
    markPasswordResetTokenUsedMock.mockResolvedValue(true);
    const ctx = anonCtx();

    const result = await authRouter
      .createCaller(ctx)
      .resetPassword({ token: 'reset-token', newPassword: 'BaruSekali9' });

    expect(result).toEqual({ success: true, signedIn: false });
    expect(setUserPasswordMock).toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(setCookieHeader(ctx)).toBeNull();
  });

  it('enforces the password policy on the new password', async () => {
    consumeCheckPasswordResetTokenMock.mockResolvedValue(validToken);

    await expect(
      authRouter.createCaller(anonCtx()).resetPassword({ token: 'reset-token', newPassword: 'abc' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(setUserPasswordMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('auth.me / auth.getUser', () => {
  it('never expose the password hash', async () => {
    const ctx = signedInCtx();
    const me = await authRouter.createCaller(ctx).me();
    const full = await authRouter.createCaller(ctx).getUser();

    expect(me).not.toHaveProperty('passwordHash');
    expect(full).not.toHaveProperty('passwordHash');
    expect(full.hasPassword).toBe(true);
  });

  it('reports hasPassword=false for an account still awaiting its invite', async () => {
    const full = await authRouter
      .createCaller(signedInCtx(userRow({ passwordHash: null })))
      .getUser();

    expect(full.hasPassword).toBe(false);
  });
});
