/**
 * Permission sweep — the procedures rbac.test.ts and role-matrix.test.ts do not
 * reach, exercised as all five roles (Superadmin, Admin, Verifikator, Kecamatan,
 * Viewer).
 *
 * Covers: villages CRUD, kawasan non-SPPTG CRUD, the audit log, document reads
 * (list/download/detail incl. the SPPG-only rule for oversight roles), dashboard
 * aggregates, submission overlap reads, comment deletion rights, draft step
 * writes, and push subscriptions.
 */
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';
import type { UserRole } from '@/types';

vi.mock('@/server/db/queries/villages', () => ({
  listVillages: vi.fn(),
  searchVillages: vi.fn(),
  getVillageById: vi.fn(),
  createVillage: vi.fn(),
  updateVillage: vi.fn(),
  deleteVillage: vi.fn(),
  countVillageReferences: vi.fn(),
}));
vi.mock('@/server/db/queries/prohibitedAreas', () => ({
  listProhibitedAreas: vi.fn(),
  getProhibitedAreaById: vi.fn(),
  createProhibitedArea: vi.fn(),
  updateProhibitedArea: vi.fn(),
  deleteProhibitedArea: vi.fn(),
}));
vi.mock('@/server/db/queries/audit', () => ({
  listAuditLogs: vi.fn(),
  getAuditLogById: vi.fn(),
  listAuditActors: vi.fn(),
  deleteAuditLog: vi.fn(),
}));
vi.mock('@/server/db/queries/submissions', () => ({
  getSubmissionById: vi.fn(),
  getSubmissionOverlaps: vi.fn(),
  getKPIDataScoped: vi.fn(),
  getMonthlyStats: vi.fn(),
  updateSubmissionValidity: vi.fn(),
  listSubmissions: vi.fn(),
}));
vi.mock('@/server/db/queries/documents', () => ({
  getDocumentById: vi.fn(),
  listDocumentsBySubmission: vi.fn(),
  listDocumentsByDraft: vi.fn(),
  listAllDocuments: vi.fn(),
  deleteDocument: vi.fn(),
}));
vi.mock('@/server/db/queries/drafts', () => ({
  getDraftById: vi.fn(),
  saveDraftStep: vi.fn(),
  mergeDraftPayload: vi.fn(),
}));
vi.mock('@/server/db/queries/comments', () => ({
  getCommentById: vi.fn(),
  deleteComment: vi.fn(),
  listCommentsBySubmission: vi.fn(),
  createComment: vi.fn(),
}));
vi.mock('@/server/db/queries/push-subscriptions', () => ({
  upsertPushSubscription: vi.fn(),
  deletePushSubscriptionForUser: vi.fn(),
  hasPushSubscription: vi.fn(),
}));
vi.mock('@/server/push/webpush', () => ({
  isPushConfigured: vi.fn(() => true),
  getVapidPublicKey: vi.fn(() => 'vapid-public-key'),
}));
vi.mock('@/server/s3/s3', () => ({
  getDownloadUrl: vi.fn(async () => 'https://signed.example/doc'),
  extractS3KeyFromDocumentUrl: vi.fn(() => 'key'),
  deleteFileFromS3: vi.fn(),
  generateUploadUrl: vi.fn(),
  uploadFileToS3: vi.fn(),
  getTemplateSignedUrl: vi.fn(),
  fetchTemplatePDF: vi.fn(),
}));
// Redis is a cache in front of the queries under test; run straight through it
// so the assertions describe authorization, not cache state.
vi.mock('@/server/redis/cache', () => ({
  TTL: { dashboard: 60, villages: 60, prohibitedAreas: 60 },
  cacheKeys: {
    user: (id: number) => `user:${id}`,
    villagesList: (limit: number, offset: number) => `villages:list:${limit}:${offset}`,
    villagesAll: () => 'villages',
    prohibitedAreasList: (limit: number, offset: number) => `kawasan:list:${limit}:${offset}`,
    prohibitedAreasAll: () => 'kawasan',
    dashboardAll: () => 'dash',
  },
  cached: vi.fn(async (_key: string, _ttl: number, fn: () => unknown) => fn()),
  scopedKey: vi.fn((prefix: string, scope: unknown) => `${prefix}:${JSON.stringify(scope)}`),
  invalidateVillages: vi.fn(async () => undefined),
  invalidateProhibitedAreas: vi.fn(async () => undefined),
  invalidateDashboard: vi.fn(async () => undefined),
}));
vi.mock('@/server/postgis', () => ({
  findOverlappingSubmissions: vi.fn(async () => []),
  computeOverlaps: vi.fn(async () => []),
}));

import { villagesRouter } from './villages/villagesRouter';
import { prohibitedAreasRouter } from './prohibitedAreas/prohibitedAreasRouter';
import { auditRouter } from './audit/auditRouter';
import { documentsRouter } from './document/documentRouter';
import { submissionsRouter } from './submissions/submissionsRouter';
import { commentsRouter } from './comments/commentsRouter';
import { draftsRouter } from './drafts/draftsRouter';
import { notificationsRouter } from './notifications/notificationsRouter';
import * as villageQueries from '@/server/db/queries/villages';
import * as prohibitedAreaQueries from '@/server/db/queries/prohibitedAreas';
import * as auditQueries from '@/server/db/queries/audit';
import * as submissionQueries from '@/server/db/queries/submissions';
import * as documentQueries from '@/server/db/queries/documents';
import * as draftQueries from '@/server/db/queries/drafts';
import * as commentQueries from '@/server/db/queries/comments';
import * as pushQueries from '@/server/db/queries/push-subscriptions';

const getSubmissionByIdMock = vi.mocked(submissionQueries.getSubmissionById);
const getSubmissionOverlapsMock = vi.mocked(submissionQueries.getSubmissionOverlaps);
const getKPIDataScopedMock = vi.mocked(submissionQueries.getKPIDataScoped);
const getMonthlyStatsMock = vi.mocked(submissionQueries.getMonthlyStats);
const updateSubmissionValidityMock = vi.mocked(submissionQueries.updateSubmissionValidity);
const getDocumentByIdMock = vi.mocked(documentQueries.getDocumentById);
const listDocumentsBySubmissionMock = vi.mocked(documentQueries.listDocumentsBySubmission);
const listDocumentsByDraftMock = vi.mocked(documentQueries.listDocumentsByDraft);
const listAllDocumentsMock = vi.mocked(documentQueries.listAllDocuments);
const getDraftByIdMock = vi.mocked(draftQueries.getDraftById);
const saveDraftStepMock = vi.mocked(draftQueries.saveDraftStep);
const mergeDraftPayloadMock = vi.mocked(draftQueries.mergeDraftPayload);
const getCommentByIdMock = vi.mocked(commentQueries.getCommentById);
const deleteCommentMock = vi.mocked(commentQueries.deleteComment);
const upsertPushSubscriptionMock = vi.mocked(pushQueries.upsertPushSubscription);

type SubmissionRecord = NonNullable<Awaited<ReturnType<typeof submissionQueries.getSubmissionById>>>;
type DraftRecord = NonNullable<Awaited<ReturnType<typeof draftQueries.getDraftById>>>;
type DocumentRecord = NonNullable<Awaited<ReturnType<typeof documentQueries.getDocumentById>>>;

const VILLAGE_A = 10;
const VILLAGE_B = 20;
const KEC_A = 'Sangatta Utara';
const KEC_B = 'Bengalon';
const OWNER_ID = 4;

function ctx(
  peran: UserRole,
  userId: number,
  assignedVillageId: number | null = null,
  assignedKecamatan: string | null = null
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
    status: 'Aktif',
    nomorHP: null,
    fotoProfil: null,
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
const ADMIN_OTHER = () => ctx('Admin', 6, VILLAGE_B);
const VERIFIKATOR = () => ctx('Verifikator', 3, VILLAGE_A);
const KECAMATAN = () => ctx('Kecamatan', 5, null, KEC_A);
const VIEWER = () => ctx('Viewer', OWNER_ID);

async function expectDenied(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(TRPCError);
  await promise.catch((error: TRPCError) => {
    expect(['FORBIDDEN', 'UNAUTHORIZED', 'NOT_FOUND']).toContain(error.code);
  });
}

function submission(overrides: Partial<SubmissionRecord> = {}) {
  return {
    id: 100,
    ownerUserId: OWNER_ID,
    villageId: VILLAGE_A,
    desaKecamatan: KEC_A,
    namaPemilik: 'Budi',
    nik: '1234567890123456',
    status: 'SPPTG terdata',
    isValid: true,
    riwayat: [],
    ...overrides,
  } as unknown as SubmissionRecord;
}

function draft(overrides: Partial<DraftRecord> = {}) {
  return {
    id: 55,
    userId: OWNER_ID,
    villageId: VILLAGE_A,
    currentStep: 1,
    payload: {},
    lastSaved: new Date(),
    ...overrides,
  } as unknown as DraftRecord;
}

function document(overrides: Partial<DocumentRecord> = {}) {
  return {
    id: 900,
    filename: 'ktp.pdf',
    fileType: 'application/pdf',
    size: 1024,
    url: 'https://s3.example/bucket/submissions/KTP/ktp.pdf',
    category: 'KTP',
    submissionId: 100,
    draftId: null,
    uploadedAt: new Date(),
    isTemporary: false,
    ...overrides,
  } as unknown as DocumentRecord;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSubmissionByIdMock.mockResolvedValue(submission() as never);
  getSubmissionOverlapsMock.mockResolvedValue([] as never);
  getKPIDataScopedMock.mockResolvedValue([] as never);
  getMonthlyStatsMock.mockResolvedValue([] as never);
  updateSubmissionValidityMock.mockResolvedValue(submission() as never);
  listDocumentsBySubmissionMock.mockResolvedValue([] as never);
  listDocumentsByDraftMock.mockResolvedValue([] as never);
  listAllDocumentsMock.mockResolvedValue([] as never);
  getDraftByIdMock.mockResolvedValue(draft() as never);
  saveDraftStepMock.mockResolvedValue(draft() as never);
  mergeDraftPayloadMock.mockImplementation(
    (stored: Record<string, unknown>, incoming: Record<string, unknown>) => ({
      ...stored,
      ...incoming,
    })
  );
  deleteCommentMock.mockResolvedValue(undefined as never);
  upsertPushSubscriptionMock.mockResolvedValue(undefined as never);
  vi.mocked(villageQueries.createVillage).mockResolvedValue({ id: 1 } as never);
  vi.mocked(villageQueries.updateVillage).mockResolvedValue({ id: 1 } as never);
  vi.mocked(villageQueries.deleteVillage).mockResolvedValue({ id: 1 } as never);
  vi.mocked(villageQueries.listVillages).mockResolvedValue([] as never);
  vi.mocked(villageQueries.getVillageById).mockResolvedValue({
    id: 1,
    namaDesa: 'Sangatta Utara',
    kecamatan: KEC_A,
    kabupaten: 'Kutai Timur',
  } as never);
  vi.mocked(villageQueries.countVillageReferences).mockResolvedValue({
    pengguna: 0,
    pengajuan: 0,
    draf: 0,
  });
  vi.mocked(prohibitedAreaQueries.createProhibitedArea).mockResolvedValue({ id: 1 } as never);
  vi.mocked(prohibitedAreaQueries.updateProhibitedArea).mockResolvedValue({ id: 1 } as never);
  vi.mocked(prohibitedAreaQueries.deleteProhibitedArea).mockResolvedValue(undefined as never);
  vi.mocked(prohibitedAreaQueries.getProhibitedAreaById).mockResolvedValue({
    id: 1,
    namaKawasan: 'Kawasan Hutan',
  } as never);
  vi.mocked(auditQueries.listAuditLogs).mockResolvedValue({ items: [], total: 0 } as never);
  vi.mocked(auditQueries.getAuditLogById).mockResolvedValue(null as never);
  vi.mocked(auditQueries.listAuditActors).mockResolvedValue([] as never);
});

// ---------------------------------------------------------------------------
// Desa (villages)
// ---------------------------------------------------------------------------
describe('desa — only Superadmin may write', () => {
  const payload = {
    namaDesa: 'Desa Baru',
    kecamatan: KEC_A,
    kabupaten: 'Kutai Timur',
  };

  it('Admin, Verifikator, Kecamatan and Viewer cannot create a desa', async () => {
    for (const caller of [ADMIN, VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expectDenied(
        villagesRouter.createCaller(caller()).create(payload as never)
      );
    }
    expect(villageQueries.createVillage).not.toHaveBeenCalled();
  });

  it('Admin, Verifikator, Kecamatan and Viewer cannot update a desa', async () => {
    for (const caller of [ADMIN, VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expectDenied(
        villagesRouter
          .createCaller(caller())
          .update({ id: 1, ...payload } as never)
      );
    }
    expect(villageQueries.updateVillage).not.toHaveBeenCalled();
  });

  it('Admin, Verifikator, Kecamatan and Viewer cannot delete a desa', async () => {
    for (const caller of [ADMIN, VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expectDenied(villagesRouter.createCaller(caller()).delete({ id: 1 }));
    }
    expect(villageQueries.deleteVillage).not.toHaveBeenCalled();
  });

  it('every signed-in role may read the desa list', async () => {
    for (const caller of [SUPERADMIN, ADMIN, VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expect(
        villagesRouter.createCaller(caller()).list({ limit: 10, offset: 0 } as never)
      ).resolves.toBeDefined();
    }
  });

  // None of the village_id columns carry a foreign key, so deleting a desa that
  // is still in use orphans its staff and pengajuan instead of failing.
  it('a desa still holding pengguna/pengajuan/draft cannot be deleted', async () => {
    vi.mocked(villageQueries.countVillageReferences).mockResolvedValue({
      pengguna: 2,
      pengajuan: 5,
      draf: 1,
    });

    await expect(
      villagesRouter.createCaller(SUPERADMIN()).delete({ id: 1 })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(villageQueries.deleteVillage).not.toHaveBeenCalled();
  });

  it('the refusal names what is still attached', async () => {
    vi.mocked(villageQueries.countVillageReferences).mockResolvedValue({
      pengguna: 0,
      pengajuan: 3,
      draf: 0,
    });

    await villagesRouter
      .createCaller(SUPERADMIN())
      .delete({ id: 1 })
      .catch((error: TRPCError) => {
        expect(error.message).toContain('3 pengajuan');
        expect(error.message).not.toContain('pengguna');
      });
  });

  it('an unused desa is still deletable', async () => {
    vi.mocked(villageQueries.countVillageReferences).mockResolvedValue({
      pengguna: 0,
      pengajuan: 0,
      draf: 0,
    });

    await expect(
      villagesRouter.createCaller(SUPERADMIN()).delete({ id: 1 })
    ).resolves.toBeDefined();
    expect(villageQueries.deleteVillage).toHaveBeenCalledWith(1);
  });
});

// ---------------------------------------------------------------------------
// Kawasan non-SPPTG (prohibited areas)
// ---------------------------------------------------------------------------
describe('kawasan non-SPPTG — write is Superadmin/Admin only', () => {
  const payload = {
    namaKawasan: 'Kawasan Hutan',
    jenisKawasan: 'Kawasan Hutan',
    coordinates: [
      { latitude: 0.1, longitude: 117.1 },
      { latitude: 0.2, longitude: 117.2 },
      { latitude: 0.3, longitude: 117.1 },
    ],
  };

  it('Verifikator, Kecamatan and Viewer cannot create a kawasan', async () => {
    for (const caller of [VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expectDenied(
        prohibitedAreasRouter.createCaller(caller()).create(payload as never)
      );
    }
    expect(prohibitedAreaQueries.createProhibitedArea).not.toHaveBeenCalled();
  });

  it('Verifikator, Kecamatan and Viewer cannot update a kawasan', async () => {
    for (const caller of [VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expectDenied(
        prohibitedAreasRouter
          .createCaller(caller())
          .update({ id: 1, ...payload } as never)
      );
    }
    expect(prohibitedAreaQueries.updateProhibitedArea).not.toHaveBeenCalled();
  });

  it('Verifikator, Kecamatan and Viewer cannot delete a kawasan', async () => {
    for (const caller of [VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expectDenied(
        prohibitedAreasRouter.createCaller(caller()).delete({ id: 1 })
      );
    }
    expect(prohibitedAreaQueries.deleteProhibitedArea).not.toHaveBeenCalled();
  });

  it('Verifikator, Kecamatan and Viewer cannot run the kawasan geometry overlap check', async () => {
    for (const caller of [VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expectDenied(
        prohibitedAreasRouter.createCaller(caller()).cekGeometriTumpangTindih({
          geomGeoJSON: {
            type: 'Polygon',
            coordinates: [
              [
                [117.1, 0.1],
                [117.2, 0.2],
                [117.1, 0.3],
                [117.1, 0.1],
              ],
            ],
          },
        })
      );
    }
  });

  it('every signed-in role may read a kawasan', async () => {
    for (const caller of [SUPERADMIN, ADMIN, VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expect(
        prohibitedAreasRouter.createCaller(caller()).byId({ id: 1 })
      ).resolves.toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
describe('audit log — Superadmin only', () => {
  it('no other role can read or erase the trail', async () => {
    for (const caller of [ADMIN, VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expectDenied(auditRouter.createCaller(caller()).list({} as never));
      await expectDenied(auditRouter.createCaller(caller()).byId({ id: 1 }));
      await expectDenied(auditRouter.createCaller(caller()).filterOptions());
      await expectDenied(auditRouter.createCaller(caller()).delete({ id: 1 }));
    }
    expect(auditQueries.deleteAuditLog).not.toHaveBeenCalled();
  });

  it('Superadmin can read it', async () => {
    await expect(
      auditRouter.createCaller(SUPERADMIN()).list({} as never)
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Documents — the SPPG-only rule for oversight roles
// ---------------------------------------------------------------------------
describe('documents.listBySubmission — berkas visibility per role', () => {
  const docs = [
    document({ id: 1, category: 'KTP' }),
    document({ id: 2, category: 'KK' }),
    document({ id: 3, category: 'SPPG', filename: 'spptg.pdf' }),
  ];

  beforeEach(() => {
    listDocumentsBySubmissionMock.mockResolvedValue(docs as never);
  });

  it('Superadmin and Kecamatan see only the SPPTG certificate', async () => {
    for (const caller of [SUPERADMIN, KECAMATAN]) {
      const result = await documentsRouter
        .createCaller(caller())
        .listBySubmission({ submissionId: 100 });
      expect(result.map((d) => d.category)).toEqual(['SPPG']);
    }
  });

  it('Admin, Verifikator of that desa and the owner see every berkas', async () => {
    for (const caller of [ADMIN, VERIFIKATOR, VIEWER]) {
      const result = await documentsRouter
        .createCaller(caller())
        .listBySubmission({ submissionId: 100 });
      expect(result.map((d) => d.category)).toEqual(['KTP', 'KK', 'SPPG']);
    }
  });

  it('an Admin from another desa gets nothing at all', async () => {
    await expectDenied(
      documentsRouter
        .createCaller(ADMIN_OTHER())
        .listBySubmission({ submissionId: 100 })
    );
  });

  it('a Kecamatan from another kecamatan gets nothing at all', async () => {
    await expectDenied(
      documentsRouter
        .createCaller(ctx('Kecamatan', 7, null, KEC_B))
        .listBySubmission({ submissionId: 100 })
    );
  });
});

describe('documents — download and detail follow the same rule', () => {
  it('Superadmin and Kecamatan cannot download a KTP', async () => {
    getDocumentByIdMock.mockResolvedValue(document({ category: 'KTP' }) as never);
    for (const caller of [SUPERADMIN, KECAMATAN]) {
      await expectDenied(
        documentsRouter
          .createCaller(caller())
          .getSignedDownloadUrl({ documentId: 900 })
      );
      await expectDenied(
        documentsRouter.createCaller(caller()).getById({ documentId: 900 })
      );
    }
  });

  it('Superadmin and Kecamatan can download the SPPTG certificate', async () => {
    getDocumentByIdMock.mockResolvedValue(
      document({ category: 'SPPG', filename: 'spptg.pdf' }) as never
    );
    for (const caller of [SUPERADMIN, KECAMATAN]) {
      await expect(
        documentsRouter
          .createCaller(caller())
          .getSignedDownloadUrl({ documentId: 900 })
      ).resolves.toMatchObject({ signedUrl: expect.any(String) });
    }
  });

  it('the desa staff and the owner can download a KTP', async () => {
    getDocumentByIdMock.mockResolvedValue(document({ category: 'KTP' }) as never);
    for (const caller of [ADMIN, VERIFIKATOR, VIEWER]) {
      await expect(
        documentsRouter
          .createCaller(caller())
          .getSignedDownloadUrl({ documentId: 900 })
      ).resolves.toMatchObject({ signedUrl: expect.any(String) });
    }
  });

  it('a Viewer cannot download a berkas of somebody else pengajuan', async () => {
    getDocumentByIdMock.mockResolvedValue(document({ category: 'KTP' }) as never);
    await expectDenied(
      documentsRouter
        .createCaller(ctx('Viewer', 99))
        .getSignedDownloadUrl({ documentId: 900 })
    );
  });
});

describe('documents.listByDraft — draft berkas', () => {
  it('Kecamatan cannot read the berkas of any draft', async () => {
    await expectDenied(
      documentsRouter.createCaller(KECAMATAN()).listByDraft({ draftId: 55 })
    );
  });

  it('an Admin from another desa cannot read them', async () => {
    await expectDenied(
      documentsRouter.createCaller(ADMIN_OTHER()).listByDraft({ draftId: 55 })
    );
  });

  it('a Viewer cannot read somebody else draft berkas', async () => {
    await expectDenied(
      documentsRouter.createCaller(ctx('Viewer', 99)).listByDraft({ draftId: 55 })
    );
  });

  it('the owner and the desa staff can', async () => {
    for (const caller of [VIEWER, ADMIN, VERIFIKATOR, SUPERADMIN]) {
      await expect(
        documentsRouter.createCaller(caller()).listByDraft({ draftId: 55 })
      ).resolves.toBeDefined();
    }
  });
});

describe('documents.listAll — the file-management endpoint', () => {
  it('is refused for Verifikator, Kecamatan and Viewer', async () => {
    for (const caller of [VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expectDenied(
        documentsRouter.createCaller(caller()).listAll({} as never)
      );
    }
  });

  it('a desa-scoped Admin only reaches the berkas of their own desa', async () => {
    await expect(
      documentsRouter.createCaller(ADMIN()).listAll({} as never)
    ).resolves.toBeDefined();
    expect(listAllDocumentsMock.mock.calls[0][0]).toMatchObject({
      villageId: VILLAGE_A,
    });
  });

  it('Superadmin sees the whole system', async () => {
    await expect(
      documentsRouter.createCaller(SUPERADMIN()).listAll({} as never)
    ).resolves.toBeDefined();
    expect(listAllDocumentsMock.mock.calls[0][0].villageId).toBeUndefined();
  });

  it('an Admin with no desa assigned is refused rather than shown everything', async () => {
    await expectDenied(
      documentsRouter.createCaller(ctx('Admin', 8, null)).listAll({} as never)
    );
    expect(listAllDocumentsMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Submissions — overlaps, validity, dashboard aggregates
// ---------------------------------------------------------------------------
describe('submissions.getOverlaps — follows submission access', () => {
  it('is refused outside the caller scope', async () => {
    await expectDenied(
      submissionsRouter.createCaller(ADMIN_OTHER()).getOverlaps({ submissionId: 100 })
    );
    await expectDenied(
      submissionsRouter
        .createCaller(ctx('Kecamatan', 7, null, KEC_B))
        .getOverlaps({ submissionId: 100 })
    );
    await expectDenied(
      submissionsRouter.createCaller(ctx('Viewer', 99)).getOverlaps({ submissionId: 100 })
    );
  });

  it('is allowed inside it, for the oversight roles too', async () => {
    for (const caller of [SUPERADMIN, ADMIN, VERIFIKATOR, KECAMATAN, VIEWER]) {
      await expect(
        submissionsRouter.createCaller(caller()).getOverlaps({ submissionId: 100 })
      ).resolves.toEqual([]);
    }
  });
});

describe('submissions.updateValidity — staff of that desa only', () => {
  it('Kecamatan and Viewer cannot flip the flag', async () => {
    for (const caller of [KECAMATAN, VIEWER]) {
      await expectDenied(
        submissionsRouter
          .createCaller(caller())
          .updateValidity({ submissionId: 100, isValid: false })
      );
    }
    expect(updateSubmissionValidityMock).not.toHaveBeenCalled();
  });

  it('an Admin from another desa cannot either', async () => {
    await expectDenied(
      submissionsRouter
        .createCaller(ADMIN_OTHER())
        .updateValidity({ submissionId: 100, isValid: false })
    );
    expect(updateSubmissionValidityMock).not.toHaveBeenCalled();
  });

  it('the Verifikator of that desa can', async () => {
    await expect(
      submissionsRouter
        .createCaller(VERIFIKATOR())
        .updateValidity({ submissionId: 100, isValid: false })
    ).resolves.toMatchObject({ success: true });
  });
});

describe('dashboard aggregates — every role is counted inside its own scope', () => {
  it('kpi passes the row-level scope of each role', async () => {
    await submissionsRouter.createCaller(SUPERADMIN()).kpi({} as never);
    expect(getKPIDataScopedMock.mock.calls[0][0]).toMatchObject({ onlyValid: true });
    expect(getKPIDataScopedMock.mock.calls[0][0]).not.toHaveProperty('villageId');

    await submissionsRouter.createCaller(ADMIN()).kpi({} as never);
    expect(getKPIDataScopedMock.mock.calls[1][0]).toMatchObject({ villageId: VILLAGE_A });

    await submissionsRouter.createCaller(VERIFIKATOR()).kpi({} as never);
    expect(getKPIDataScopedMock.mock.calls[2][0]).toMatchObject({ villageId: VILLAGE_A });

    await submissionsRouter.createCaller(KECAMATAN()).kpi({} as never);
    expect(getKPIDataScopedMock.mock.calls[3][0]).toMatchObject({ scopeKecamatan: KEC_A });

    await submissionsRouter.createCaller(VIEWER()).kpi({} as never);
    expect(getKPIDataScopedMock.mock.calls[4][0]).toMatchObject({ ownerUserId: OWNER_ID });
  });

  it('monthlyStats scopes the trend chart the same way', async () => {
    await submissionsRouter.createCaller(VIEWER()).monthlyStats({} as never);
    expect(getMonthlyStatsMock.mock.calls[0][0]).toMatchObject({ ownerUserId: OWNER_ID });

    await submissionsRouter.createCaller(KECAMATAN()).monthlyStats({} as never);
    expect(getMonthlyStatsMock.mock.calls[1][0]).toMatchObject({ scopeKecamatan: KEC_A });
  });

  it('an Admin with no desa assigned is refused rather than shown everything', async () => {
    await expectDenied(
      submissionsRouter.createCaller(ctx('Admin', 8, null)).kpi({} as never)
    );
    await expectDenied(
      submissionsRouter.createCaller(ctx('Verifikator', 9, null)).monthlyStats({} as never)
    );
  });

  it('a Kecamatan with no kecamatan assigned is refused too', async () => {
    await expectDenied(
      submissionsRouter.createCaller(ctx('Kecamatan', 11, null, null)).kpi({} as never)
    );
  });
});

// ---------------------------------------------------------------------------
// Comments — who may delete
// ---------------------------------------------------------------------------
describe('comments.delete — deletion rights', () => {
  const comment = { id: 7, submissionId: 100, userId: 3, content: 'catatan' };

  beforeEach(() => {
    getCommentByIdMock.mockResolvedValue(comment as never);
  });

  it('the author may delete their own comment', async () => {
    await expect(
      commentsRouter.createCaller(VERIFIKATOR()).delete({ commentId: 7 })
    ).resolves.toMatchObject({ success: true });
  });

  it('the Admin of that desa and the Superadmin may delete it', async () => {
    for (const caller of [ADMIN, SUPERADMIN]) {
      await expect(
        commentsRouter.createCaller(caller()).delete({ commentId: 7 })
      ).resolves.toMatchObject({ success: true });
    }
  });

  it('the pengaju may delete a comment on their own pengajuan', async () => {
    await expect(
      commentsRouter.createCaller(VIEWER()).delete({ commentId: 7 })
    ).resolves.toMatchObject({ success: true });
  });

  it('another Verifikator of the same desa may not', async () => {
    await expectDenied(
      commentsRouter.createCaller(ctx('Verifikator', 12, VILLAGE_A)).delete({ commentId: 7 })
    );
    expect(deleteCommentMock).not.toHaveBeenCalled();
  });

  it('Kecamatan may not, even inside its own kecamatan', async () => {
    await expectDenied(
      commentsRouter.createCaller(KECAMATAN()).delete({ commentId: 7 })
    );
    expect(deleteCommentMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Drafts — writing a step
// ---------------------------------------------------------------------------
describe('drafts.saveStep — step and desa limits', () => {
  const step = (currentStep: number, payload: Record<string, unknown> = {}) => ({
    draftId: 55,
    currentStep,
    payload,
  });

  it('a Viewer cannot write past Step 1 even on its own draft', async () => {
    await expectDenied(
      draftsRouter.createCaller(VIEWER()).saveStep(step(2) as never)
    );
    expect(saveDraftStepMock).not.toHaveBeenCalled();
  });

  it('a Viewer can still write Step 1 of its own draft', async () => {
    await expect(
      draftsRouter.createCaller(VIEWER()).saveStep(step(1) as never)
    ).resolves.toBeDefined();
  });

  it('Kecamatan cannot write any step', async () => {
    await expectDenied(
      draftsRouter.createCaller(KECAMATAN()).saveStep(step(1) as never)
    );
  });

  it('an Admin cannot move a draft onto another desa', async () => {
    await expectDenied(
      draftsRouter
        .createCaller(ADMIN())
        .saveStep(step(2, { villageId: VILLAGE_B }) as never)
    );
    expect(saveDraftStepMock).not.toHaveBeenCalled();
  });

  it('an Admin from another desa cannot write to this draft at all', async () => {
    await expectDenied(
      draftsRouter.createCaller(ADMIN_OTHER()).saveStep(step(1) as never)
    );
  });
});

// ---------------------------------------------------------------------------
// Push subscriptions
// ---------------------------------------------------------------------------
describe('push subscriptions are bound to the calling account', () => {
  it('every role subscribes only itself', async () => {
    for (const caller of [SUPERADMIN, ADMIN, VERIFIKATOR, KECAMATAN, VIEWER]) {
      const context = caller();
      await notificationsRouter.createCaller(context).subscribePush({
        endpoint: 'https://push.example/endpoint',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      });
      const lastCall =
        upsertPushSubscriptionMock.mock.calls[
          upsertPushSubscriptionMock.mock.calls.length - 1
        ][0];
      expect(lastCall).toMatchObject({ userId: context.appUser!.id });
    }
  });
});
