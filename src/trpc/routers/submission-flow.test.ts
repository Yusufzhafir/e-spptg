/**
 * "Edit pengajuan" flows across roles:
 *   - editing an existing submission  (drafts.createFromSubmission)
 *   - creating a new submission from an existing one (mode: duplicate)
 *   - the status a submitted draft lands on, including Step 4 issuance
 */
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';
import type { UserRole } from '@/types';
import { deriveSubmissionStatus } from '@/lib/submission-status';

vi.mock('@/server/db/queries/submissions', () => ({
  getSubmissionById: vi.fn(),
  listSubmissions: vi.fn(),
}));
vi.mock('@/server/db/queries/drafts', () => ({
  createDraftFromSubmission: vi.fn(),
  getDraftById: vi.fn(),
  saveDraftStep: vi.fn(),
  listAccessibleDrafts: vi.fn(),
}));
vi.mock('@/server/db/queries/documents', () => ({
  listDocumentsBySubmission: vi.fn(() => Promise.resolve([])),
  cloneDocumentsToDraft: vi.fn(() => Promise.resolve([])),
}));

import { draftsRouter } from './drafts/draftsRouter';
import * as submissionQueries from '@/server/db/queries/submissions';
import * as draftQueries from '@/server/db/queries/drafts';

const getSubmissionByIdMock = vi.mocked(submissionQueries.getSubmissionById);
const createDraftMock = vi.mocked(draftQueries.createDraftFromSubmission);

const VILLAGE_A = 10;
const VILLAGE_B = 20;
const SUBMISSION_ID = 55;

function ctx(peran: UserRole, userId: number, assignedVillageId: number | null = null) {
  const appUser: NonNullable<TRPCContext['appUser']> = {
    id: userId,
    nama: `${peran} User`,
    email: `${peran.toLowerCase()}@example.com`,
    clerkUserId: `clerk-${userId}`,
    nipNik: '12345',
    peran,
    assignedVillageId,
    status: 'Aktif',
    nomorHP: null,
    terakhirMasuk: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { userId: `clerk-${userId}`, db: {} as TRPCContext['db'], appUser } satisfies TRPCContext;
}

const SUPERADMIN = () => ctx('Superadmin', 1);
const ADMIN = () => ctx('Admin', 2, VILLAGE_A);
const VERIFIKATOR = () => ctx('Verifikator', 3, VILLAGE_A);
const VIEWER = () => ctx('Viewer', 4);

beforeEach(() => {
  vi.clearAllMocks();
  getSubmissionByIdMock.mockResolvedValue({
    id: SUBMISSION_ID,
    ownerUserId: 100,
    villageId: VILLAGE_A,
    verifikator: 2,
    status: 'SPPTG terdaftar',
    payload: { namaPemohon: 'Budi', nik: '3201010101010001' },
  } as never);
  createDraftMock.mockResolvedValue({ id: 900 } as never);
});

// ---------------------------------------------------------------------------
// Edit an existing submission / create a new one from it
// ---------------------------------------------------------------------------
describe('Edit pengajuan — drafts.createFromSubmission', () => {
  it.each([
    ['Superadmin', SUPERADMIN],
    ['Admin', ADMIN],
    ['Verifikator', VERIFIKATOR],
  ])('%s can open an existing submission for editing', async (_label, makeCtx) => {
    const result = await draftsRouter
      .createCaller(makeCtx())
      .createFromSubmission({ submissionId: SUBMISSION_ID });
    expect(result.id).toBe(900);
  });

  it.each([
    ['Superadmin', SUPERADMIN],
    ['Admin', ADMIN],
    ['Verifikator', VERIFIKATOR],
  ])('%s can duplicate it as a new submission', async (_label, makeCtx) => {
    const result = await draftsRouter
      .createCaller(makeCtx())
      .createFromSubmission({ submissionId: SUBMISSION_ID, asNewSubmission: true });
    expect(result.id).toBe(900);
  });

  it('Viewer cannot edit or duplicate a submission', async () => {
    const caller = draftsRouter.createCaller(VIEWER());

    await expect(
      caller.createFromSubmission({ submissionId: SUBMISSION_ID })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.createFromSubmission({ submissionId: SUBMISSION_ID, asNewSubmission: true })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(createDraftMock).not.toHaveBeenCalled();
  });

  it('Verifikator from another desa cannot edit it', async () => {
    await expect(
      draftsRouter
        .createCaller(ctx('Verifikator', 8, VILLAGE_B))
        .createFromSubmission({ submissionId: SUBMISSION_ID })
    ).rejects.toBeInstanceOf(TRPCError);
    expect(createDraftMock).not.toHaveBeenCalled();
  });

  it('missing submission returns NOT_FOUND', async () => {
    getSubmissionByIdMock.mockResolvedValue(null as never);
    await expect(
      draftsRouter.createCaller(SUPERADMIN()).createFromSubmission({ submissionId: 404 })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ---------------------------------------------------------------------------
// Status a submitted draft lands on (incl. Step 4 issuance)
// ---------------------------------------------------------------------------
describe('status on submit — deriveSubmissionStatus', () => {
  const issued = {
    nomorSPPTG: '470/123/2026',
    tanggalTerbit: '2026-07-27',
    dokumenSPPTG: { documentId: 7 },
  };

  it('a completed Step 4 keeps the submission on terdaftar', () => {
    expect(deriveSubmissionStatus({ status: 'SPPTG terdaftar', ...issued })).toBe('SPPTG terdaftar');
    // issuance must never invent a different bucket
    expect(deriveSubmissionStatus({ status: 'SPPTG terdata', ...issued })).toBe('SPPTG terdaftar');
  });

  it.each([
    ['SPPTG terdata'],
    ['SPPTG terdaftar'],
    ['SPPTG ditolak'],
    ['SPPTG ditinjau ulang'],
  ])('keeps the Step 3 decision %s when Step 4 is incomplete', (status) => {
    expect(deriveSubmissionStatus({ status })).toBe(status);
  });

  it.each([
    ['no certificate number', { ...issued, nomorSPPTG: '' }],
    ['blank certificate number', { ...issued, nomorSPPTG: '   ' }],
    ['no issue date', { ...issued, tanggalTerbit: undefined }],
    ['no uploaded document', { ...issued, dokumenSPPTG: null }],
  ])('does not issue when %s', (_label, payload) => {
    expect(deriveSubmissionStatus({ status: 'SPPTG terdaftar', ...payload })).toBe(
      'SPPTG terdaftar'
    );
  });

  it('falls back to terdata for an unknown or missing status', () => {
    expect(deriveSubmissionStatus({})).toBe('SPPTG terdata');
    expect(deriveSubmissionStatus({ status: 'Status Ngawur' })).toBe('SPPTG terdata');
    // 'Terbit SPPTG' cannot be forced through the draft payload alone
    expect(deriveSubmissionStatus({ status: 'Terbit SPPTG' })).toBe('SPPTG terdata');
  });
});
