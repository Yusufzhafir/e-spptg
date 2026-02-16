import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';

vi.mock('@/server/db/queries/submissions', () => ({
  getSubmissionById: vi.fn(),
  listSubmissions: vi.fn(),
}));

vi.mock('@/server/db/queries/drafts', () => ({}));
vi.mock('@/server/db/queries/documents', () => ({}));
vi.mock('@/server/postgis', () => ({
  computeOverlaps: vi.fn(),
}));

import { submissionsRouter } from './submissionsRouter';
import * as submissionQueries from '@/server/db/queries/submissions';

const getSubmissionByIdMock = vi.mocked(submissionQueries.getSubmissionById);
const listSubmissionsMock = vi.mocked(submissionQueries.listSubmissions);
type SubmissionRecord = NonNullable<
  Awaited<ReturnType<typeof submissionQueries.getSubmissionById>>
>;
type SubmissionListResult = Awaited<
  ReturnType<typeof submissionQueries.listSubmissions>
>;

function createCtx(peran: 'Viewer' | 'Admin', userId: number) {
  const appUser: NonNullable<TRPCContext['appUser']> = {
    id: userId,
    nama: 'Test User',
    email: 'test@example.com',
    clerkUserId: `clerk-${userId}`,
    nipNik: '12345',
    peran,
    status: 'Aktif',
    nomorHP: null,
    terakhirMasuk: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    userId: `clerk-${userId}`,
    db: {} as TRPCContext['db'],
    appUser,
  } satisfies TRPCContext;
}

describe('submissionsRouter access hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows byId for viewer on owned submission', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      id: 1,
      verifikator: 77,
      status: 'SPPTG terdata',
    } as SubmissionRecord);

    const caller = submissionsRouter.createCaller(createCtx('Viewer', 77));
    const result = await caller.byId({ id: 1 });

    expect(result.id).toBe(1);
  });

  it('throws NOT_FOUND for viewer on non-owned submission', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      id: 2,
      verifikator: 10,
      status: 'SPPTG terdata',
    } as SubmissionRecord);

    const caller = submissionsRouter.createCaller(createCtx('Viewer', 77));
    const promise = caller.byId({ id: 2 });

    await expect(promise).rejects.toBeInstanceOf(TRPCError);
    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('passes ownerUserId filter for viewer list', async () => {
    listSubmissionsMock.mockResolvedValue({
      items: [],
      total: 0,
    } as SubmissionListResult);

    const caller = submissionsRouter.createCaller(createCtx('Viewer', 88));
    await caller.list({ status: undefined, search: undefined, limit: 50, offset: 0 });

    expect(listSubmissionsMock).toHaveBeenCalledWith({
      search: undefined,
      status: undefined,
      ownerUserId: 88,
      limit: 50,
      offset: 0,
    });
  });

  it('does not pass ownerUserId filter for staff list', async () => {
    listSubmissionsMock.mockResolvedValue({
      items: [],
      total: 0,
    } as SubmissionListResult);

    const caller = submissionsRouter.createCaller(createCtx('Admin', 99));
    await caller.list({ status: undefined, search: undefined, limit: 50, offset: 0 });

    expect(listSubmissionsMock).toHaveBeenCalledWith({
      search: undefined,
      status: undefined,
      ownerUserId: undefined,
      limit: 50,
      offset: 0,
    });
  });
});
