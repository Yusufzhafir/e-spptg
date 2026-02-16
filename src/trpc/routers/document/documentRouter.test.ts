import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';

vi.mock('@/server/db/queries/documents', () => ({
  listDocumentsBySubmission: vi.fn(),
  getDocumentById: vi.fn(),
}));

vi.mock('@/server/db/queries/submissions', () => ({
  getSubmissionById: vi.fn(),
}));

vi.mock('@/server/s3/s3', () => ({
  generateUploadUrl: vi.fn(),
  uploadFileToS3: vi.fn(),
  getTemplateSignedUrl: vi.fn(),
  fetchTemplatePDF: vi.fn(),
  getDownloadUrl: vi.fn(),
  extractS3KeyFromDocumentUrl: vi.fn(),
}));

import { documentsRouter } from './documentRouter';
import * as documentQueries from '@/server/db/queries/documents';
import * as submissionQueries from '@/server/db/queries/submissions';
import * as s3Utils from '@/server/s3/s3';

const listDocumentsBySubmissionMock = vi.mocked(
  documentQueries.listDocumentsBySubmission
);
const getDocumentByIdMock = vi.mocked(documentQueries.getDocumentById);
const getSubmissionByIdMock = vi.mocked(submissionQueries.getSubmissionById);
const getDownloadUrlMock = vi.mocked(s3Utils.getDownloadUrl);
const extractS3KeyFromDocumentUrlMock = vi.mocked(
  s3Utils.extractS3KeyFromDocumentUrl
);
type SubmissionRecord = NonNullable<
  Awaited<ReturnType<typeof submissionQueries.getSubmissionById>>
>;
type DocumentRecord = NonNullable<
  Awaited<ReturnType<typeof documentQueries.getDocumentById>>
>;
type SubmissionDocuments = Awaited<
  ReturnType<typeof documentQueries.listDocumentsBySubmission>
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

describe('documentsRouter.listBySubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all documents for staff role', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      id: 11,
      verifikator: 101,
    } as SubmissionRecord);
    listDocumentsBySubmissionMock.mockResolvedValue([
      {
        id: 1,
        filename: 'ktp.pdf',
        fileType: 'application/pdf',
        size: 1024,
        url: 'https://example.com/ktp.pdf',
        category: 'KTP',
        uploadedAt: new Date('2026-01-10T00:00:00.000Z'),
      },
    ] as SubmissionDocuments);

    const caller = documentsRouter.createCaller(createCtx('Admin', 500));
    const result = await caller.listBySubmission({ submissionId: 11 });

    expect(getSubmissionByIdMock).toHaveBeenCalledWith(11);
    expect(listDocumentsBySubmissionMock).toHaveBeenCalledWith(11, {
      uploadedBy: undefined,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.filename).toBe('ktp.pdf');
  });

  it('returns only viewer-uploaded documents for owned submission', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      id: 20,
      verifikator: 300,
    } as SubmissionRecord);
    listDocumentsBySubmissionMock.mockResolvedValue([
      {
        id: 2,
        filename: 'kk.pdf',
        fileType: 'application/pdf',
        size: 2048,
        url: 'https://example.com/kk.pdf',
        category: 'KK',
        uploadedAt: new Date('2026-01-11T00:00:00.000Z'),
      },
    ] as SubmissionDocuments);

    const caller = documentsRouter.createCaller(createCtx('Viewer', 300));
    const result = await caller.listBySubmission({ submissionId: 20 });

    expect(listDocumentsBySubmissionMock).toHaveBeenCalledWith(20, {
      uploadedBy: 300,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.filename).toBe('kk.pdf');
  });

  it('throws NOT_FOUND for viewer accessing non-owned submission', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      id: 21,
      verifikator: 999,
    } as SubmissionRecord);

    const caller = documentsRouter.createCaller(createCtx('Viewer', 300));
    const promise = caller.listBySubmission({ submissionId: 21 });

    await expect(promise).rejects.toBeInstanceOf(TRPCError);
    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(listDocumentsBySubmissionMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND for missing submission', async () => {
    getSubmissionByIdMock.mockResolvedValue(null);

    const caller = documentsRouter.createCaller(createCtx('Admin', 500));

    await expect(
      caller.listBySubmission({ submissionId: 9999 })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(listDocumentsBySubmissionMock).not.toHaveBeenCalled();
  });
});

describe('documentsRouter.getSignedDownloadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns signed URL for staff role', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 5,
      submissionId: 10,
      uploadedBy: 1,
      url: 'https://example.com/bucket/file.pdf',
    } as DocumentRecord);
    getSubmissionByIdMock.mockResolvedValue({
      id: 10,
      verifikator: 100,
    } as SubmissionRecord);
    extractS3KeyFromDocumentUrlMock.mockReturnValue('submissions/KTP/file.pdf');
    getDownloadUrlMock.mockResolvedValue('https://signed.example.com/file.pdf');

    const caller = documentsRouter.createCaller(createCtx('Admin', 500));
    const result = await caller.getSignedDownloadUrl({ documentId: 5 });

    expect(extractS3KeyFromDocumentUrlMock).toHaveBeenCalledWith(
      'https://example.com/bucket/file.pdf'
    );
    expect(getDownloadUrlMock).toHaveBeenCalledWith('submissions/KTP/file.pdf', 604800);
    expect(result).toEqual({
      signedUrl: 'https://signed.example.com/file.pdf',
      expiresIn: 604800,
    });
  });

  it('returns signed URL for viewer on owned submission and own upload', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 6,
      submissionId: 11,
      uploadedBy: 300,
      url: 'https://example.com/bucket/file2.pdf',
    } as DocumentRecord);
    getSubmissionByIdMock.mockResolvedValue({
      id: 11,
      verifikator: 300,
    } as SubmissionRecord);
    extractS3KeyFromDocumentUrlMock.mockReturnValue('submissions/KK/file2.pdf');
    getDownloadUrlMock.mockResolvedValue('https://signed.example.com/file2.pdf');

    const caller = documentsRouter.createCaller(createCtx('Viewer', 300));
    const result = await caller.getSignedDownloadUrl({ documentId: 6 });

    expect(result.signedUrl).toBe('https://signed.example.com/file2.pdf');
  });

  it('throws NOT_FOUND when viewer is not document uploader', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 7,
      submissionId: 12,
      uploadedBy: 999,
      url: 'https://example.com/bucket/file3.pdf',
    } as DocumentRecord);
    getSubmissionByIdMock.mockResolvedValue({
      id: 12,
      verifikator: 300,
    } as SubmissionRecord);

    const caller = documentsRouter.createCaller(createCtx('Viewer', 300));
    const promise = caller.getSignedDownloadUrl({ documentId: 7 });

    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(getDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when viewer does not own submission', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 8,
      submissionId: 13,
      uploadedBy: 300,
      url: 'https://example.com/bucket/file4.pdf',
    } as DocumentRecord);
    getSubmissionByIdMock.mockResolvedValue({
      id: 13,
      verifikator: 999,
    } as SubmissionRecord);

    const caller = documentsRouter.createCaller(createCtx('Viewer', 300));
    const promise = caller.getSignedDownloadUrl({ documentId: 8 });

    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(getDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND for missing document', async () => {
    getDocumentByIdMock.mockResolvedValue(null);

    const caller = documentsRouter.createCaller(createCtx('Admin', 1));
    const promise = caller.getSignedDownloadUrl({ documentId: 999 });

    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(getSubmissionByIdMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when submission linked to document is missing', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 9,
      submissionId: 14,
      uploadedBy: 1,
      url: 'https://example.com/bucket/file5.pdf',
    } as DocumentRecord);
    getSubmissionByIdMock.mockResolvedValue(null);

    const caller = documentsRouter.createCaller(createCtx('Admin', 1));
    const promise = caller.getSignedDownloadUrl({ documentId: 9 });

    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(getDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('throws INTERNAL_SERVER_ERROR when URL parsing fails', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 10,
      submissionId: 15,
      uploadedBy: 1,
      url: 'not-a-valid-url',
    } as DocumentRecord);
    getSubmissionByIdMock.mockResolvedValue({
      id: 15,
      verifikator: 1,
    } as SubmissionRecord);
    extractS3KeyFromDocumentUrlMock.mockImplementation(() => {
      throw new Error('parse failed');
    });

    const caller = documentsRouter.createCaller(createCtx('Admin', 1));
    const promise = caller.getSignedDownloadUrl({ documentId: 10 });

    await expect(promise).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(getDownloadUrlMock).not.toHaveBeenCalled();
  });
});
