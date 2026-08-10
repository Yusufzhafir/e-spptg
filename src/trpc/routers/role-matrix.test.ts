/**
 * Role matrix — every procedure that rbac.test.ts does not already cover,
 * exercised as all five roles (Superadmin, Admin, Verifikator, Kecamatan,
 * Viewer).
 *
 * Covers: users, drafts, comments, documents (delete/upload scope),
 * notifications, and the coordinate overlap probe.
 */
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';
import type { UserRole } from '@/types';

vi.mock('@/server/db/queries/user', () => ({
  listUsersPaged: vi.fn(),
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock('@/server/db/queries/drafts', () => ({
  getOrCreateDraft: vi.fn(),
  createDraft: vi.fn(),
  createDraftFromSubmission: vi.fn(),
  getDraftById: vi.fn(),
  saveDraftStep: vi.fn(),
  mergeDraftPayload: vi.fn(),
  listAccessibleDrafts: vi.fn(),
  deleteDraft: vi.fn(),
}));
vi.mock('@/server/db/queries/submissions', () => ({
  getSubmissionById: vi.fn(),
  listSubmissionsForUser: vi.fn(async () => ({ items: [], total: 0 })),
}));
vi.mock('@/server/db/queries/documents', () => ({
  getDocumentById: vi.fn(),
  deleteDocument: vi.fn(),
  listDocumentsBySubmission: vi.fn(),
  listDocumentsByDraft: vi.fn(),
}));
vi.mock('@/server/db/queries/comments', () => ({
  listCommentsBySubmission: vi.fn(),
  createComment: vi.fn(),
  getCommentById: vi.fn(),
  deleteComment: vi.fn(),
}));
vi.mock('@/server/db/queries/notifications', () => ({
  listNotificationsScoped: vi.fn(),
}));
vi.mock('@/server/s3/s3', () => ({
  generateUploadUrl: vi.fn(),
  uploadFileToS3: vi.fn(),
  getTemplateSignedUrl: vi.fn(),
  fetchTemplatePDF: vi.fn(),
  getDownloadUrl: vi.fn(),
  extractS3KeyFromDocumentUrl: vi.fn(),
  deleteFileFromS3: vi.fn(),
}));
// Session revocation and outbound mail are side effects of the user mutations
// under test; stub them so the matrix exercises authorization, not Postgres/SMTP.
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
    token: 'token',
    expiresAt: new Date(Date.now() + 3_600_000),
  })),
}));

import { authRouter } from './auth/authrouter';
import { usersRouter } from './users/usersRouter';
import { draftsRouter } from './drafts/draftsRouter';
import { commentsRouter } from './comments/commentsRouter';
import { documentsRouter } from './document/documentRouter';
import { notificationsRouter } from './notifications/notificationsRouter';
import { submissionsRouter } from './submissions/submissionsRouter';
import * as userQueries from '@/server/db/queries/user';
import * as draftQueries from '@/server/db/queries/drafts';
import * as submissionQueries from '@/server/db/queries/submissions';
import * as documentQueries from '@/server/db/queries/documents';
import * as commentQueries from '@/server/db/queries/comments';
import * as notificationQueries from '@/server/db/queries/notifications';
import * as s3 from '@/server/s3/s3';
import { ACCOUNT_DEACTIVATED_MESSAGE } from '@/lib/account-status';

const getUserByIdMock = vi.mocked(userQueries.getUserById);
const updateUserMock = vi.mocked(userQueries.updateUser);
const createUserMock = vi.mocked(userQueries.createUser);
const getUserByEmailMock = vi.mocked(userQueries.getUserByEmail);
const listUsersPagedMock = vi.mocked(userQueries.listUsersPaged);
const getOrCreateDraftMock = vi.mocked(draftQueries.getOrCreateDraft);
const createDraftMock = vi.mocked(draftQueries.createDraft);
const createDraftFromSubmissionMock = vi.mocked(draftQueries.createDraftFromSubmission);
const getDraftByIdMock = vi.mocked(draftQueries.getDraftById);
const listAccessibleDraftsMock = vi.mocked(draftQueries.listAccessibleDrafts);
const deleteDraftMock = vi.mocked(draftQueries.deleteDraft);
const getSubmissionByIdMock = vi.mocked(submissionQueries.getSubmissionById);
const getDocumentByIdMock = vi.mocked(documentQueries.getDocumentById);
const deleteDocumentMock = vi.mocked(documentQueries.deleteDocument);
const listDocumentsBySubmissionMock = vi.mocked(documentQueries.listDocumentsBySubmission);
const listCommentsMock = vi.mocked(commentQueries.listCommentsBySubmission);
const createCommentMock = vi.mocked(commentQueries.createComment);
const listNotificationsScopedMock = vi.mocked(notificationQueries.listNotificationsScoped);
const extractS3KeyMock = vi.mocked(s3.extractS3KeyFromDocumentUrl);
const deleteFileFromS3Mock = vi.mocked(s3.deleteFileFromS3);

type SubmissionRecord = NonNullable<Awaited<ReturnType<typeof submissionQueries.getSubmissionById>>>;
type DraftRecord = NonNullable<Awaited<ReturnType<typeof draftQueries.getDraftById>>>;
type DocumentRecord = NonNullable<Awaited<ReturnType<typeof documentQueries.getDocumentById>>>;
type UserRecord = NonNullable<Awaited<ReturnType<typeof userQueries.getUserById>>>;

const VILLAGE_A = 10;
const VILLAGE_B = 20;
const KEC_A = 'Sukasari';

function ctx(
  peran: UserRole,
  userId: number,
  assignedVillageId: number | null = null,
  assignedKecamatan: string | null = null,
  status: 'Aktif' | 'Nonaktif' = 'Aktif'
) {
  const appUser: NonNullable<TRPCContext['appUser']> = {
    id: userId,
    nama: `${peran} User`,
    email: `${peran.toLowerCase()}@example.com`,
    passwordHash: 'scrypt$16384$8$1$c2FsdA==$aGFzaA==',
    nipNik: '12345',
    peran,
    assignedVillageId,
    assignedKecamatan,
    status,
    nomorHP: null,
    fotoProfil: null,
    // Verified: these fixtures stand in for existing, usable accounts.
    emailVerifiedAt: new Date(),
    // Akun lokal biasa: belum pernah masuk lewat SSO Kutai Timur.
    ssoSub: null,
    ssoSource: null,
    terakhirMasuk: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return {
    userId,
    db: {} as TRPCContext['db'],
    appUser,
    sessionToken: `session-${userId}`,
    resHeaders: new Headers(),
    requestMeta: { userAgent: 'vitest', ipAddress: '127.0.0.1' },
  } satisfies TRPCContext;
}

const SUPERADMIN = () => ctx('Superadmin', 1);
const ADMIN = () => ctx('Admin', 2, VILLAGE_A);
const VERIFIKATOR = () => ctx('Verifikator', 3, VILLAGE_A);
const KECAMATAN = () => ctx('Kecamatan', 5, null, KEC_A);
const VIEWER = () => ctx('Viewer', 4);

/** Assert the call is refused, whichever "no" the layer speaks. */
async function expectDenied(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(TRPCError);
  await promise.catch((error: TRPCError) => {
    expect(['FORBIDDEN', 'UNAUTHORIZED', 'NOT_FOUND']).toContain(error.code);
  });
}

function submission(overrides: Partial<SubmissionRecord> = {}) {
  return {
    id: 100,
    ownerUserId: 4,
    villageId: VILLAGE_A,
    desaKecamatan: KEC_A,
    namaPemilik: 'Budi',
    nik: '1234567890123456',
    status: 'SPPTG terdata',
    riwayat: [],
    ...overrides,
  } as unknown as SubmissionRecord;
}

function draft(overrides: Partial<DraftRecord> = {}) {
  return {
    id: 55,
    userId: 4,
    villageId: VILLAGE_A,
    currentStep: 1,
    payload: {},
    lastSaved: new Date(),
    ...overrides,
  } as unknown as DraftRecord;
}

beforeEach(() => {
  vi.clearAllMocks();
  listUsersPagedMock.mockResolvedValue({ items: [], total: 0 } as never);
  listAccessibleDraftsMock.mockResolvedValue({ items: [], total: 0 } as never);
  listCommentsMock.mockResolvedValue([] as never);
  listNotificationsScopedMock.mockResolvedValue([] as never);
  listDocumentsBySubmissionMock.mockResolvedValue([] as never);
  getOrCreateDraftMock.mockResolvedValue(draft() as never);
  createDraftMock.mockResolvedValue(draft() as never);
  createDraftFromSubmissionMock.mockResolvedValue({ id: 77 } as never);
  deleteDraftMock.mockResolvedValue(undefined as never);
  deleteDocumentMock.mockResolvedValue(undefined as never);
  extractS3KeyMock.mockReturnValue('key');
  deleteFileFromS3Mock.mockResolvedValue(undefined as never);
});

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
describe('users.list — scoped per role', () => {
  it('Superadmin lists everyone, unscoped', async () => {
    await usersRouter.createCaller(SUPERADMIN()).list({ limit: 100, offset: 0 });
    expect(listUsersPagedMock).toHaveBeenCalledWith(
      expect.objectContaining({ villageId: undefined })
    );
  });

  it('Admin and Verifikator are limited to their desa', async () => {
    await usersRouter.createCaller(ADMIN()).list({ limit: 100, offset: 0 });
    await usersRouter.createCaller(VERIFIKATOR()).list({ limit: 100, offset: 0 });
    expect(listUsersPagedMock).toHaveBeenCalledTimes(2);
    expect(listUsersPagedMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ villageId: VILLAGE_A, limit: 100, offset: 0 })
    );
  });

  it('Viewer and Kecamatan only see their own account', async () => {
    getUserByIdMock.mockResolvedValue({ id: 4 } as unknown as UserRecord);
    const viewer = await usersRouter.createCaller(VIEWER()).list({ limit: 100, offset: 0 });
    const kecamatan = await usersRouter
      .createCaller(KECAMATAN())
      .list({ limit: 100, offset: 0 });
    expect(viewer.items).toHaveLength(1);
    expect(viewer.total).toBe(1);
    expect(kecamatan.items).toHaveLength(1);
    // Never reaches the paged query: their own row comes straight from getUserById.
    expect(listUsersPagedMock).not.toHaveBeenCalled();
  });
});

describe('users.byId — must not leak accounts outside the caller scope', () => {
  it('lets anyone read their own account', async () => {
    getUserByIdMock.mockResolvedValue({ id: 4, assignedVillageId: null } as unknown as UserRecord);
    await expect(usersRouter.createCaller(VIEWER()).byId({ id: 4 })).resolves.toBeTruthy();
  });

  it('Superadmin can read any account', async () => {
    getUserByIdMock.mockResolvedValue({ id: 99, assignedVillageId: VILLAGE_B } as unknown as UserRecord);
    await expect(usersRouter.createCaller(SUPERADMIN()).byId({ id: 99 })).resolves.toBeTruthy();
  });

  it('Admin can read an account in their own desa', async () => {
    getUserByIdMock.mockResolvedValue({ id: 99, assignedVillageId: VILLAGE_A } as unknown as UserRecord);
    await expect(usersRouter.createCaller(ADMIN()).byId({ id: 99 })).resolves.toBeTruthy();
  });

  it('Admin cannot read an account from another desa', async () => {
    getUserByIdMock.mockResolvedValue({ id: 99, assignedVillageId: VILLAGE_B } as unknown as UserRecord);
    await expectDenied(usersRouter.createCaller(ADMIN()).byId({ id: 99 }));
  });

  it('Viewer cannot read somebody else account', async () => {
    getUserByIdMock.mockResolvedValue({ id: 99, assignedVillageId: VILLAGE_A } as unknown as UserRecord);
    await expectDenied(usersRouter.createCaller(VIEWER()).byId({ id: 99 }));
  });

  it('Kecamatan cannot read somebody else account', async () => {
    getUserByIdMock.mockResolvedValue({ id: 99, assignedVillageId: VILLAGE_A } as unknown as UserRecord);
    await expectDenied(usersRouter.createCaller(KECAMATAN()).byId({ id: 99 }));
  });

  it('Verifikator cannot read a colleague, even in their own desa', async () => {
    getUserByIdMock.mockResolvedValue({ id: 99, assignedVillageId: VILLAGE_A } as unknown as UserRecord);
    await expectDenied(usersRouter.createCaller(VERIFIKATOR()).byId({ id: 99 }));
  });

  it('Admin cannot read a Superadmin or Kecamatan account (neither has a desa)', async () => {
    getUserByIdMock.mockResolvedValue({ id: 1, assignedVillageId: null } as unknown as UserRecord);
    await expectDenied(usersRouter.createCaller(ADMIN()).byId({ id: 1 }));
  });
});

describe('users.detail — the account page enforces the same scope', () => {
  it('lets an Admin open an account in their own desa', async () => {
    getUserByIdMock.mockResolvedValue({ id: 99, assignedVillageId: VILLAGE_A } as unknown as UserRecord);
    await expect(
      usersRouter.createCaller(ADMIN()).detail({ id: 99 })
    ).resolves.toBeTruthy();
  });

  it.each([
    ['Admin, other desa', () => ADMIN(), VILLAGE_B],
    ['Verifikator, own desa', () => VERIFIKATOR(), VILLAGE_A],
    ['Viewer', () => VIEWER(), VILLAGE_A],
    ['Kecamatan', () => KECAMATAN(), VILLAGE_A],
  ] as const)('refuses %s', async (_label, caller, villageId) => {
    getUserByIdMock.mockResolvedValue({
      id: 99,
      assignedVillageId: villageId,
    } as unknown as UserRecord);
    await expectDenied(usersRouter.createCaller(caller()).detail({ id: 99 }));
  });

  it('always lets anyone open their own account page', async () => {
    getUserByIdMock.mockResolvedValue({ id: 4, assignedVillageId: null } as unknown as UserRecord);
    await expect(
      usersRouter.createCaller(VIEWER()).detail({ id: 4 })
    ).resolves.toBeTruthy();
  });
});

describe('users mutations — role guard', () => {
  const payload = {
    nama: 'Baru',
    email: 'baru@example.com',
    // 16 digits: a shorter one is rejected by the input schema, and these tests
    // are about the role guard that runs after it.
    nipNik: '3201010101010009',
  };

  it('Verifikator, Kecamatan and Viewer cannot create users', async () => {
    for (const caller of [VERIFIKATOR(), KECAMATAN(), VIEWER()]) {
      await expectDenied(usersRouter.createCaller(caller).create(payload));
    }
  });

  it('Verifikator, Kecamatan and Viewer cannot toggle a user status', async () => {
    getUserByIdMock.mockResolvedValue({ id: 99, peran: 'Viewer' } as unknown as UserRecord);
    for (const caller of [VERIFIKATOR(), KECAMATAN(), VIEWER()]) {
      await expectDenied(usersRouter.createCaller(caller).toggleStatus({ id: 99 }));
    }
  });

  it.each(['Superadmin', 'Admin', 'Kecamatan', 'Viewer'] as const)(
    'Admin cannot create a %s account',
    async (peran) => {
      await expectDenied(
        usersRouter.createCaller(ADMIN()).create({ ...payload, peran })
      );
    }
  );

  it('Admin can staff its own desa with a Verifikator', async () => {
    getUserByEmailMock.mockResolvedValue(undefined as never);
    createUserMock.mockImplementation(
      async (data: Record<string, unknown>) => ({ id: 99, ...data }) as never
    );

    await usersRouter
      .createCaller(ADMIN())
      .create({ ...payload, peran: 'Verifikator' });

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ peran: 'Verifikator', assignedVillageId: VILLAGE_A })
    );
  });

  it('the desa is forced to the Admin own, not the one they asked for', async () => {
    getUserByEmailMock.mockResolvedValue(undefined as never);
    createUserMock.mockResolvedValue({ id: 99 } as never);

    await expectDenied(
      usersRouter.createCaller(ADMIN()).create({
        ...payload,
        peran: 'Verifikator',
        assignedVillageId: VILLAGE_B,
      })
    );
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('an Admin with no desa cannot create anyone', async () => {
    await expectDenied(
      usersRouter
        .createCaller(ctx('Admin', 2, null))
        .create({ ...payload, peran: 'Verifikator' })
    );
  });

  it('Admin may edit a Verifikator in its desa but not change its role', async () => {
    const target = {
      id: 99,
      peran: 'Verifikator',
      assignedVillageId: VILLAGE_A,
      status: 'Aktif',
      passwordHash: null,
    } as UserRecord;
    getUserByIdMock.mockResolvedValue(target);
    updateUserMock.mockResolvedValue({ id: 99 } as never);

    await usersRouter
      .createCaller(ADMIN())
      .update({ id: 99, data: { nama: 'Nama Baru' } });
    expect(updateUserMock).toHaveBeenCalled();

    updateUserMock.mockClear();
    await expectDenied(
      usersRouter.createCaller(ADMIN()).update({ id: 99, data: { peran: 'Viewer' } })
    );
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// drafts
// ---------------------------------------------------------------------------
describe('drafts — Kecamatan takes no part in the workflow', () => {
  it('cannot get/create a working draft', async () => {
    await expectDenied(draftsRouter.createCaller(KECAMATAN()).getOrCreateCurrent());
    await expectDenied(draftsRouter.createCaller(KECAMATAN()).create());
    expect(getOrCreateDraftMock).not.toHaveBeenCalled();
    expect(createDraftMock).not.toHaveBeenCalled();
  });

  it('cannot open an edit draft from a submission in its own kecamatan', async () => {
    getSubmissionByIdMock.mockResolvedValue(submission());
    await expectDenied(
      draftsRouter.createCaller(KECAMATAN()).createFromSubmission({ submissionId: 100 })
    );
    expect(createDraftFromSubmissionMock).not.toHaveBeenCalled();
  });

  it('has no drafts to list', async () => {
    // Paged response now: an empty page and a zero count, not a bare array.
    const result = await draftsRouter.createCaller(KECAMATAN()).listMy({});
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('cannot delete a draft', async () => {
    getDraftByIdMock.mockResolvedValue(draft());
    await expectDenied(draftsRouter.createCaller(KECAMATAN()).delete({ draftId: 55 }));
    expect(deleteDraftMock).not.toHaveBeenCalled();
  });
});

describe('drafts — Viewer boundaries', () => {
  it('cannot read a draft owned by someone else', async () => {
    getDraftByIdMock.mockResolvedValue(draft({ userId: 999 }));
    await expectDenied(draftsRouter.createCaller(VIEWER()).getById({ draftId: 55 }));
  });

  it('can read its own draft', async () => {
    getDraftByIdMock.mockResolvedValue(draft({ userId: 4 }));
    await expect(
      draftsRouter.createCaller(VIEWER()).getById({ draftId: 55 })
    ).resolves.toBeTruthy();
  });

  it('cannot delete a draft owned by someone else', async () => {
    getDraftByIdMock.mockResolvedValue(draft({ userId: 999 }));
    await expectDenied(draftsRouter.createCaller(VIEWER()).delete({ draftId: 55 }));
    expect(deleteDraftMock).not.toHaveBeenCalled();
  });
});

describe('drafts — desa scope for Admin/Verifikator', () => {
  it('Admin cannot open a draft from another desa', async () => {
    getDraftByIdMock.mockResolvedValue(draft({ userId: 999, villageId: VILLAGE_B }));
    await expectDenied(draftsRouter.createCaller(ADMIN()).getById({ draftId: 55 }));
  });

  it('Verifikator can open a draft in their own desa', async () => {
    getDraftByIdMock.mockResolvedValue(draft({ userId: 999, villageId: VILLAGE_A }));
    await expect(
      draftsRouter.createCaller(VERIFIKATOR()).getById({ draftId: 55 })
    ).resolves.toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------
describe('comments — access follows the submission', () => {
  it('Kecamatan can read comments on a submission inside its kecamatan', async () => {
    getSubmissionByIdMock.mockResolvedValue(submission({ desaKecamatan: KEC_A }));
    await expect(
      commentsRouter.createCaller(KECAMATAN()).listBySubmission({ submissionId: 100 })
    ).resolves.toEqual([]);
  });

  it('Kecamatan cannot read comments from another kecamatan', async () => {
    getSubmissionByIdMock.mockResolvedValue(submission({ desaKecamatan: 'Lainnya' }));
    await expectDenied(
      commentsRouter.createCaller(KECAMATAN()).listBySubmission({ submissionId: 100 })
    );
  });

  it('Kecamatan is read-only: it cannot post a comment', async () => {
    getSubmissionByIdMock.mockResolvedValue(submission({ desaKecamatan: KEC_A }));
    await expectDenied(
      commentsRouter.createCaller(KECAMATAN()).create({ submissionId: 100, content: 'halo' })
    );
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('Viewer cannot comment on a submission it does not own', async () => {
    getSubmissionByIdMock.mockResolvedValue(submission({ ownerUserId: 999 }));
    await expectDenied(
      commentsRouter.createCaller(VIEWER()).create({ submissionId: 100, content: 'halo' })
    );
  });

  it('Viewer can comment on its own submission', async () => {
    getSubmissionByIdMock.mockResolvedValue(submission({ ownerUserId: 4 }));
    createCommentMock.mockResolvedValue({ id: 1 } as never);
    await expect(
      commentsRouter.createCaller(VIEWER()).create({ submissionId: 100, content: 'halo' })
    ).resolves.toBeTruthy();
  });

  it('Admin from another desa cannot comment', async () => {
    getSubmissionByIdMock.mockResolvedValue(submission({ villageId: VILLAGE_B }));
    await expectDenied(
      commentsRouter.createCaller(ADMIN()).create({ submissionId: 100, content: 'halo' })
    );
  });
});

// ---------------------------------------------------------------------------
// documents
// ---------------------------------------------------------------------------
describe('documents.delete — who may remove an uploaded file', () => {
  const submissionDocument = { id: 7, submissionId: 100, draftId: null, url: 'u' } as unknown as DocumentRecord;

  it('Kecamatan cannot delete a document of a submission it merely oversees', async () => {
    getDocumentByIdMock.mockResolvedValue(submissionDocument);
    getSubmissionByIdMock.mockResolvedValue(submission({ desaKecamatan: KEC_A }));
    await expectDenied(documentsRouter.createCaller(KECAMATAN()).delete({ documentId: 7 }));
    expect(deleteDocumentMock).not.toHaveBeenCalled();
    expect(deleteFileFromS3Mock).not.toHaveBeenCalled();
  });

  it('Viewer cannot delete a document of an already submitted pengajuan it owns', async () => {
    getDocumentByIdMock.mockResolvedValue(submissionDocument);
    getSubmissionByIdMock.mockResolvedValue(submission({ ownerUserId: 4 }));
    await expectDenied(documentsRouter.createCaller(VIEWER()).delete({ documentId: 7 }));
    expect(deleteDocumentMock).not.toHaveBeenCalled();
  });

  it('Verifikator of that desa may delete it', async () => {
    getDocumentByIdMock.mockResolvedValue(submissionDocument);
    getSubmissionByIdMock.mockResolvedValue(submission({ villageId: VILLAGE_A }));
    await expect(
      documentsRouter.createCaller(VERIFIKATOR()).delete({ documentId: 7 })
    ).resolves.toEqual({ success: true, message: 'Dokumen berhasil dihapus' });
  });

  it('Viewer may still delete a file from its own draft', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 8,
      submissionId: null,
      draftId: 55,
      url: 'u',
    } as unknown as DocumentRecord);
    getDraftByIdMock.mockResolvedValue(draft({ userId: 4 }));
    await expect(
      documentsRouter.createCaller(VIEWER()).delete({ documentId: 8 })
    ).resolves.toEqual({ success: true, message: 'Dokumen berhasil dihapus' });
  });
});

describe('documents — Kecamatan cannot upload into the workflow', () => {
  it('createUploadUrl is refused', async () => {
    getDraftByIdMock.mockResolvedValue(draft());
    await expectDenied(
      documentsRouter.createCaller(KECAMATAN()).createUploadUrl({
        draftId: 55,
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        size: 100,
        category: 'KTP',
      })
    );
  });
});

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------
describe('notifications.list — scope is passed through per role', () => {
  it('forwards the role scope for every role', async () => {
    await notificationsRouter.createCaller(VIEWER()).list();
    expect(listNotificationsScopedMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'Viewer', userId: 4 })
    );

    await notificationsRouter.createCaller(KECAMATAN()).list();
    expect(listNotificationsScopedMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'Kecamatan', assignedKecamatan: KEC_A })
    );

    await notificationsRouter.createCaller(ADMIN()).list();
    expect(listNotificationsScopedMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'Admin', assignedVillageId: VILLAGE_A })
    );
  });
});

// ---------------------------------------------------------------------------
// overlap probe
// ---------------------------------------------------------------------------
describe('submissions.checkOverlapsFromCoordinates — probing is staff-only', () => {
  const coordinates = [
    { latitude: -6.7, longitude: 108.5 },
    { latitude: -6.7, longitude: 108.6 },
    { latitude: -6.8, longitude: 108.6 },
  ];

  it('Viewer cannot probe arbitrary coordinates', async () => {
    await expectDenied(
      submissionsRouter.createCaller(VIEWER()).checkOverlapsFromCoordinates({ coordinates })
    );
  });

  it('Kecamatan cannot probe arbitrary coordinates', async () => {
    await expectDenied(
      submissionsRouter.createCaller(KECAMATAN()).checkOverlapsFromCoordinates({ coordinates })
    );
  });
});

// ---------------------------------------------------------------------------
// Deactivated accounts — the 'Nonaktif' flag must actually revoke access.
// `users.toggleStatus` deletes their session rows, but a request already in
// flight would still carry the old permissions, so the block lives in the tRPC
// auth middleware and has to hold for every role and every procedure.
// ---------------------------------------------------------------------------
describe('status Nonaktif — access is revoked for every role', () => {
  const DEACTIVATED: Array<[string, TRPCContext]> = [
    ['Superadmin', ctx('Superadmin', 1, null, null, 'Nonaktif')],
    ['Admin', ctx('Admin', 2, VILLAGE_A, null, 'Nonaktif')],
    ['Verifikator', ctx('Verifikator', 3, VILLAGE_A, null, 'Nonaktif')],
    ['Kecamatan', ctx('Kecamatan', 5, null, KEC_A, 'Nonaktif')],
    ['Viewer', ctx('Viewer', 4, null, null, 'Nonaktif')],
  ];

  it.each(DEACTIVATED)('%s cannot read its own profile', async (_role, caller) => {
    await expect(authRouter.createCaller(caller).me()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: ACCOUNT_DEACTIVATED_MESSAGE,
    });
  });

  it.each(DEACTIVATED)('%s cannot list submissions', async (_role, caller) => {
    await expect(
      submissionsRouter.createCaller(caller).list({ limit: 50, offset: 0 })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it.each(DEACTIVATED)('%s cannot list users', async (_role, caller) => {
    await expect(
      usersRouter.createCaller(caller).list({ limit: 100, offset: 0 })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(listUsersPagedMock).not.toHaveBeenCalled();
  });

  it('a deactivated Superadmin loses its privileged mutations too', async () => {
    const caller = ctx('Superadmin', 1, null, null, 'Nonaktif');
    await expect(
      usersRouter.createCaller(caller).toggleStatus({ id: 9 })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it('an active account is unaffected', async () => {
    listUsersPagedMock.mockResolvedValue({ items: [], total: 0 } as never);
    await expect(
      usersRouter.createCaller(SUPERADMIN()).list({ limit: 100, offset: 0 })
    ).resolves.toEqual({ items: [], total: 0 });
  });
});

describe('self-deactivation is refused', () => {
  it('Superadmin cannot toggle its own account off', async () => {
    getUserByIdMock.mockResolvedValue({
      id: 1,
      peran: 'Superadmin',
      assignedVillageId: null,
      status: 'Aktif',
      passwordHash: 'scrypt$16384$8$1$c2FsdA==$aGFzaA==',
    } as UserRecord);

    await expect(
      usersRouter.createCaller(SUPERADMIN()).toggleStatus({ id: 1 })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('nor set its own status to Nonaktif through update', async () => {
    getUserByIdMock.mockResolvedValue({
      id: 1,
      peran: 'Superadmin',
      assignedVillageId: null,
      status: 'Aktif',
      passwordHash: 'scrypt$16384$8$1$c2FsdA==$aGFzaA==',
    } as UserRecord);

    await expect(
      usersRouter.createCaller(SUPERADMIN()).update({ id: 1, data: { status: 'Nonaktif' } })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('deactivating somebody else still works', async () => {
    getUserByIdMock.mockResolvedValue({
      id: 9,
      peran: 'Admin',
      assignedVillageId: VILLAGE_A,
      status: 'Aktif',
      passwordHash: 'scrypt$16384$8$1$c2FsdA==$aGFzaA==',
    } as UserRecord);
    updateUserMock.mockResolvedValue({ id: 9 } as never);

    await usersRouter.createCaller(SUPERADMIN()).toggleStatus({ id: 9 });
    expect(updateUserMock).toHaveBeenCalledWith(9, { status: 'Nonaktif' });
  });
});
