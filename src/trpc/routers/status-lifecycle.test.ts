/**
 * SPPTG status lifecycle across every role.
 *
 * Covers all five statuses — 'SPPTG terdata', 'SPPTG terdaftar',
 * 'SPPTG ditinjau ulang', 'SPPTG ditolak' and 'Terbit SPPTG' — driven through
 * submissions.updateStatus as Superadmin, Admin, Verifikator and Viewer, plus
 * the desa scoping and the audit trail written for each transition.
 */
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';
import type { StatusSPPTG, UserRole } from '@/types';

vi.mock('@/server/db/queries/submissions', () => ({
  getSubmissionById: vi.fn(),
  listSubmissions: vi.fn(),
  updateSubmissionStatus: vi.fn(),
}));
vi.mock('@/server/db/queries/drafts', () => ({}));
vi.mock('@/server/db/queries/documents', () => ({}));
vi.mock('@/server/db/queries/notifications', () => ({}));
vi.mock('@/server/postgis', () => ({ computeOverlaps: vi.fn() }));

import { submissionsRouter } from './submissions/submissionsRouter';
import * as submissionQueries from '@/server/db/queries/submissions';

const getSubmissionByIdMock = vi.mocked(submissionQueries.getSubmissionById);
const updateStatusMock = vi.mocked(submissionQueries.updateSubmissionStatus);

const VILLAGE_A = 10;
const VILLAGE_B = 20;
const SUBMISSION_ID = 42;

/** Every status in the lifecycle, including the rarely-reached issuance state. */
const ALL_STATUSES: StatusSPPTG[] = [
  'SPPTG terdata',
  'SPPTG terdaftar',
  'SPPTG ditinjau ulang',
  'SPPTG ditolak',
  'Terbit SPPTG',
];

/** Statuses the UI requires a reason for. */
const REASON_REQUIRED: StatusSPPTG[] = ['SPPTG ditinjau ulang', 'SPPTG ditolak'];

function ctx(peran: UserRole, userId: number, assignedVillageId: number | null = null) {
  const appUser: NonNullable<TRPCContext['appUser']> = {
    id: userId,
    nama: `${peran} User`,
    email: `${peran.toLowerCase()}@example.com`,
    passwordHash: 'scrypt$16384$8$1$c2FsdA==$aGFzaA==',
    nipNik: '12345',
    peran,
    assignedVillageId,
    assignedKecamatan: null,
    status: 'Aktif',
    nomorHP: null,
    fotoProfil: null,
    // Verified: these fixtures stand in for existing, usable accounts.
    emailVerifiedAt: new Date(),
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
const VIEWER = () => ctx('Viewer', 4);

/** A submission sitting in desa A, awaiting a decision. */
const submissionInDesaA = {
  id: SUBMISSION_ID,
  ownerUserId: 100,
  villageId: VILLAGE_A,
  verifikator: 2,
  status: 'SPPTG terdata' as StatusSPPTG,
};

beforeEach(() => {
  vi.clearAllMocks();
  getSubmissionByIdMock.mockResolvedValue(submissionInDesaA as never);
  updateStatusMock.mockResolvedValue({ id: SUBMISSION_ID } as never);
});

// ---------------------------------------------------------------------------
// Roles that may decide a status
// ---------------------------------------------------------------------------
describe.each([
  ['Superadmin', SUPERADMIN],
  ['Admin', ADMIN],
  ['Verifikator', VERIFIKATOR],
])('%s can set every status', (_label, makeCtx) => {
  it.each(ALL_STATUSES)('sets %s', async (status) => {
    const caller = submissionsRouter.createCaller(makeCtx());
    const result = await caller.updateStatus({
      submissionId: SUBMISSION_ID,
      newStatus: status,
      alasan: REASON_REQUIRED.includes(status) ? 'Alasan pengujian' : undefined,
    });

    expect(result.success).toBe(true);
    expect(updateStatusMock).toHaveBeenCalledWith(
      SUBMISSION_ID,
      status,
      makeCtx().appUser.id, // recorded as the acting verifikator (audit trail)
      REASON_REQUIRED.includes(status) ? 'Alasan pengujian' : undefined,
      undefined
    );
  });
});

// ---------------------------------------------------------------------------
// Viewer may not decide anything
// ---------------------------------------------------------------------------
describe('Viewer cannot set any status', () => {
  it.each(ALL_STATUSES)('is forbidden from setting %s', async (status) => {
    const caller = submissionsRouter.createCaller(VIEWER());
    await expect(
      caller.updateStatus({ submissionId: SUBMISSION_ID, newStatus: status })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(updateStatusMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Desa scoping still applies to every status
// ---------------------------------------------------------------------------
describe('desa scoping applies to all statuses', () => {
  it.each(ALL_STATUSES)(
    'Verifikator from another desa cannot set %s',
    async (status) => {
      const outsider = ctx('Verifikator', 9, VILLAGE_B);
      await expect(
        submissionsRouter
          .createCaller(outsider)
          .updateStatus({ submissionId: SUBMISSION_ID, newStatus: status })
      ).rejects.toBeInstanceOf(TRPCError);
      expect(updateStatusMock).not.toHaveBeenCalled();
    }
  );

  it('Superadmin can decide on any desa', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      ...submissionInDesaA,
      villageId: VILLAGE_B,
    } as never);
    const result = await submissionsRouter
      .createCaller(SUPERADMIN())
      .updateStatus({ submissionId: SUBMISSION_ID, newStatus: 'SPPTG terdaftar' });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Feedback / reason is carried through to the audit trail
// ---------------------------------------------------------------------------
describe('rejection & revision carry their reason into the history', () => {
  it.each(REASON_REQUIRED)('%s passes alasan + feedback through', async (status) => {
    const feedback = {
      alasanTerpilih: ['Dokumen tidak lengkap'],
      detailFeedback: 'Mohon lengkapi KTP',
      timestamp: new Date().toISOString(),
      pemberi: 'Verifikator User',
    };

    await submissionsRouter.createCaller(VERIFIKATOR()).updateStatus({
      submissionId: SUBMISSION_ID,
      newStatus: status,
      alasan: 'Berkas kurang',
      feedback,
    });

    expect(updateStatusMock).toHaveBeenCalledWith(
      SUBMISSION_ID,
      status,
      3,
      'Berkas kurang',
      feedback
    );
  });
});

// ---------------------------------------------------------------------------
// Reason is mandatory for rejection / revision — enforced server-side so a
// direct API call can't leave an unexplained decision in the audit trail.
// ---------------------------------------------------------------------------
describe('reason is required for rejection & revision', () => {
  it.each(REASON_REQUIRED)('%s is rejected without alasan', async (status) => {
    await expect(
      submissionsRouter
        .createCaller(VERIFIKATOR())
        .updateStatus({ submissionId: SUBMISSION_ID, newStatus: status })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it.each(REASON_REQUIRED)('%s is rejected when alasan is only whitespace', async (status) => {
    await expect(
      submissionsRouter
        .createCaller(VERIFIKATOR())
        .updateStatus({ submissionId: SUBMISSION_ID, newStatus: status, alasan: '   ' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it.each(['SPPTG terdata', 'SPPTG terdaftar', 'Terbit SPPTG'] as StatusSPPTG[])(
    '%s does not require alasan',
    async (status) => {
      const result = await submissionsRouter
        .createCaller(VERIFIKATOR())
        .updateStatus({ submissionId: SUBMISSION_ID, newStatus: status });
      expect(result.success).toBe(true);
    }
  );
});

// ---------------------------------------------------------------------------
// Missing submissions
// ---------------------------------------------------------------------------
describe('unknown submission', () => {
  it('returns NOT_FOUND instead of writing a status', async () => {
    getSubmissionByIdMock.mockResolvedValue(undefined as never);
    await expect(
      submissionsRouter
        .createCaller(SUPERADMIN())
        .updateStatus({ submissionId: 999, newStatus: 'SPPTG terdaftar' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(updateStatusMock).not.toHaveBeenCalled();
  });
});
