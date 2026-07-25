import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';

vi.mock('@/server/db/queries/documents', () => ({
  listDocumentsBySubmission: vi.fn(),
  getDocumentById: vi.fn(),
  deleteDocument: vi.fn(),
}));

vi.mock('@/server/db/queries/drafts', () => ({
  getDraftById: vi.fn(),
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
  deleteFileFromS3: vi.fn(),
}));

import { documentsRouter } from './documentRouter';
import * as documentQueries from '@/server/db/queries/documents';
import * as draftQueries from '@/server/db/queries/drafts';
import * as submissionQueries from '@/server/db/queries/submissions';
import * as s3Utils from '@/server/s3/s3';

const listDocumentsBySubmissionMock = vi.mocked(
  documentQueries.listDocumentsBySubmission
);
const getDocumentByIdMock = vi.mocked(documentQueries.getDocumentById);
const deleteDocumentMock = vi.mocked(documentQueries.deleteDocument);
const getDraftByIdMock = vi.mocked(draftQueries.getDraftById);
const getSubmissionByIdMock = vi.mocked(submissionQueries.getSubmissionById);
const getDownloadUrlMock = vi.mocked(s3Utils.getDownloadUrl);
const extractS3KeyFromDocumentUrlMock = vi.mocked(
  s3Utils.extractS3KeyFromDocumentUrl
);
const deleteFileFromS3Mock = vi.mocked(s3Utils.deleteFileFromS3);
type DraftRecord = NonNullable<
  Awaited<ReturnType<typeof draftQueries.getDraftById>>
>;
type SubmissionRecord = NonNullable<
  Awaited<ReturnType<typeof submissionQueries.getSubmissionById>>
>;
type DocumentRecord = NonNullable<
  Awaited<ReturnType<typeof documentQueries.getDocumentById>>
>;
type SubmissionDocuments = Awaited<
  ReturnType<typeof documentQueries.listDocumentsBySubmission>
>;

function createCtx(
  peran: 'Viewer' | 'Admin',
  userId: number,
  assignedVillageId: number | null = null
) {
  const appUser: NonNullable<TRPCContext['appUser']> = {
    id: userId,
    nama: 'Test User',
    email: 'test@example.com',
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
      ownerUserId: 101,
      villageId: 55,
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

    const caller = documentsRouter.createCaller(createCtx('Admin', 500, 55));
    const result = await caller.listBySubmission({ submissionId: 11 });

    expect(getSubmissionByIdMock).toHaveBeenCalledWith(11);
    expect(listDocumentsBySubmissionMock).toHaveBeenCalledWith(11);
    expect(result).toHaveLength(1);
    expect(result[0]?.filename).toBe('ktp.pdf');
  });

  it('returns documents for viewer on owned submission', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      id: 20,
      ownerUserId: 300,
      villageId: 9,
      verifikator: 999,
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

    expect(listDocumentsBySubmissionMock).toHaveBeenCalledWith(20);
    expect(result).toHaveLength(1);
    expect(result[0]?.filename).toBe('kk.pdf');
  });

  it('throws NOT_FOUND for viewer accessing non-owned submission', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      id: 21,
      ownerUserId: 999,
      villageId: 9,
      verifikator: 999,
    } as SubmissionRecord);

    const caller = documentsRouter.createCaller(createCtx('Viewer', 300));
    const promise = caller.listBySubmission({ submissionId: 21 });

    await expect(promise).rejects.toBeInstanceOf(TRPCError);
    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(listDocumentsBySubmissionMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND for missing submission', async () => {
    getSubmissionByIdMock.mockResolvedValue(null as never);

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
      ownerUserId: 100,
      villageId: 55,
      verifikator: 100,
    } as SubmissionRecord);
    extractS3KeyFromDocumentUrlMock.mockReturnValue('submissions/KTP/file.pdf');
    getDownloadUrlMock.mockResolvedValue('https://signed.example.com/file.pdf');

    const caller = documentsRouter.createCaller(createCtx('Admin', 500, 55));
    const result = await caller.getSignedDownloadUrl({ documentId: 5 });

    expect(extractS3KeyFromDocumentUrlMock).toHaveBeenCalledWith(
      'https://example.com/bucket/file.pdf'
    );
    expect(getDownloadUrlMock).toHaveBeenCalledWith(
      'submissions/KTP/file.pdf',
      604800,
      undefined
    );
    expect(result).toEqual({
      signedUrl: 'https://signed.example.com/file.pdf',
      expiresIn: 604800,
    });
  });

  it('passes download filename when disposition is attachment', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 5,
      submissionId: 10,
      uploadedBy: 1,
      filename: 'SPPTG_123.pdf',
      url: 'https://example.com/bucket/file.pdf',
    } as DocumentRecord);
    getSubmissionByIdMock.mockResolvedValue({
      id: 10,
      ownerUserId: 100,
      villageId: 55,
      verifikator: 100,
    } as SubmissionRecord);
    extractS3KeyFromDocumentUrlMock.mockReturnValue('submissions/SPPG/file.pdf');
    getDownloadUrlMock.mockResolvedValue('https://signed.example.com/file.pdf');

    const caller = documentsRouter.createCaller(createCtx('Admin', 500, 55));
    await caller.getSignedDownloadUrl({ documentId: 5, disposition: 'attachment' });

    expect(getDownloadUrlMock).toHaveBeenCalledWith(
      'submissions/SPPG/file.pdf',
      604800,
      { downloadFilename: 'SPPTG_123.pdf' }
    );
  });

  it('returns signed URL for viewer on owned submission', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 6,
      submissionId: 11,
      uploadedBy: 300,
      url: 'https://example.com/bucket/file2.pdf',
    } as DocumentRecord);
    getSubmissionByIdMock.mockResolvedValue({
      id: 11,
      ownerUserId: 300,
      villageId: 12,
      verifikator: 777,
    } as SubmissionRecord);
    extractS3KeyFromDocumentUrlMock.mockReturnValue('submissions/KK/file2.pdf');
    getDownloadUrlMock.mockResolvedValue('https://signed.example.com/file2.pdf');

    const caller = documentsRouter.createCaller(createCtx('Viewer', 300));
    const result = await caller.getSignedDownloadUrl({ documentId: 6 });

    expect(result.signedUrl).toBe('https://signed.example.com/file2.pdf');
  });

  it('returns signed URL for staff on accessible draft document', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 7,
      submissionId: null,
      draftId: 200,
      uploadedBy: 400,
      url: 'https://example.com/bucket/draft-file.pdf',
    } as DocumentRecord);
    getDraftByIdMock.mockResolvedValue({
      id: 200,
      userId: 999,
      villageId: 55,
    } as DraftRecord);
    extractS3KeyFromDocumentUrlMock.mockReturnValue('submissions/SPPG/draft-file.pdf');
    getDownloadUrlMock.mockResolvedValue('https://signed.example.com/draft-file.pdf');

    const caller = documentsRouter.createCaller(createCtx('Admin', 500, 55));
    const result = await caller.getSignedDownloadUrl({ documentId: 7 });

    expect(getDraftByIdMock).toHaveBeenCalledWith(200);
    expect(getDownloadUrlMock).toHaveBeenCalledWith(
      'submissions/SPPG/draft-file.pdf',
      604800,
      undefined
    );
    expect(result.signedUrl).toBe('https://signed.example.com/draft-file.pdf');
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
      ownerUserId: 999,
      villageId: 12,
      verifikator: 999,
    } as SubmissionRecord);

    const caller = documentsRouter.createCaller(createCtx('Viewer', 300));
    const promise = caller.getSignedDownloadUrl({ documentId: 8 });

    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(getDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND for missing document', async () => {
    getDocumentByIdMock.mockResolvedValue(null as never);

    const caller = documentsRouter.createCaller(createCtx('Admin', 1));
    const promise = caller.getSignedDownloadUrl({ documentId: 999 });

    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(getSubmissionByIdMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when draft linked to document is missing', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 12,
      submissionId: null,
      draftId: 444,
      uploadedBy: 1,
      url: 'https://example.com/bucket/missing-draft-file.pdf',
    } as DocumentRecord);
    getDraftByIdMock.mockResolvedValue(null as never);

    const caller = documentsRouter.createCaller(createCtx('Admin', 1, 55));
    const promise = caller.getSignedDownloadUrl({ documentId: 12 });

    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(getDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when submission linked to document is missing', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 9,
      submissionId: 14,
      uploadedBy: 1,
      url: 'https://example.com/bucket/file5.pdf',
    } as DocumentRecord);
    getSubmissionByIdMock.mockResolvedValue(null as never);

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
      ownerUserId: 1,
      villageId: 55,
      verifikator: 1,
    } as SubmissionRecord);
    extractS3KeyFromDocumentUrlMock.mockImplementation(() => {
      throw new Error('parse failed');
    });

    const caller = documentsRouter.createCaller(createCtx('Admin', 1, 55));
    const promise = caller.getSignedDownloadUrl({ documentId: 10 });

    await expect(promise).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(getDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when viewer does not own draft document', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 13,
      submissionId: null,
      draftId: 555,
      uploadedBy: 1,
      url: 'https://example.com/bucket/foreign-draft-file.pdf',
    } as DocumentRecord);
    getDraftByIdMock.mockResolvedValue({
      id: 555,
      userId: 999,
      villageId: 9,
    } as DraftRecord);

    const caller = documentsRouter.createCaller(createCtx('Viewer', 300));
    const promise = caller.getSignedDownloadUrl({ documentId: 13 });

    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(getDownloadUrlMock).not.toHaveBeenCalled();
  });
});

describe('documentsRouter.delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes draft-linked document from S3 and DB', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 22,
      draftId: 44,
      submissionId: null,
      url: 'https://example.com/bucket/submissions/KTP/file.pdf',
    } as DocumentRecord);
    getDraftByIdMock.mockResolvedValue({
      id: 44,
      userId: 500,
      villageId: 55,
    } as DraftRecord);
    extractS3KeyFromDocumentUrlMock.mockReturnValue('submissions/KTP/file.pdf');
    deleteFileFromS3Mock.mockResolvedValue();
    deleteDocumentMock.mockResolvedValue({ id: 22 } as DocumentRecord);

    const caller = documentsRouter.createCaller(createCtx('Admin', 500, 55));
    const result = await caller.delete({ documentId: 22 });

    expect(extractS3KeyFromDocumentUrlMock).toHaveBeenCalledWith(
      'https://example.com/bucket/submissions/KTP/file.pdf'
    );
    expect(deleteFileFromS3Mock).toHaveBeenCalledWith('submissions/KTP/file.pdf');
    expect(deleteDocumentMock).toHaveBeenCalledWith(22);
    expect(result).toMatchObject({
      success: true,
      message: 'Dokumen berhasil dihapus',
    });
  });

  it('deletes submission-linked document for owner viewer', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 33,
      draftId: 88,
      submissionId: 71,
      url: 'https://example.com/bucket/submissions/SPPG/spptg.pdf',
    } as DocumentRecord);
    getSubmissionByIdMock.mockResolvedValue({
      id: 71,
      ownerUserId: 300,
      villageId: 12,
      verifikator: 777,
    } as SubmissionRecord);
    extractS3KeyFromDocumentUrlMock.mockReturnValue('submissions/SPPG/spptg.pdf');
    deleteFileFromS3Mock.mockResolvedValue();
    deleteDocumentMock.mockResolvedValue({ id: 33 } as DocumentRecord);

    const caller = documentsRouter.createCaller(createCtx('Viewer', 300));
    const result = await caller.delete({ documentId: 33 });

    expect(deleteFileFromS3Mock).toHaveBeenCalledWith('submissions/SPPG/spptg.pdf');
    expect(deleteDocumentMock).toHaveBeenCalledWith(33);
    expect(result.success).toBe(true);
  });

  it('returns INTERNAL_SERVER_ERROR when S3 delete fails and does not delete DB row', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 44,
      draftId: 90,
      submissionId: null,
      url: 'https://example.com/bucket/submissions/KK/kk.pdf',
    } as DocumentRecord);
    getDraftByIdMock.mockResolvedValue({
      id: 90,
      userId: 500,
      villageId: 55,
    } as DraftRecord);
    extractS3KeyFromDocumentUrlMock.mockReturnValue('submissions/KK/kk.pdf');
    deleteFileFromS3Mock.mockRejectedValue(new Error('s3 unavailable'));

    const caller = documentsRouter.createCaller(createCtx('Admin', 500, 55));
    const promise = caller.delete({ documentId: 44 });

    await expect(promise).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(deleteDocumentMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND for viewer deleting non-owned submission document', async () => {
    getDocumentByIdMock.mockResolvedValue({
      id: 55,
      draftId: 99,
      submissionId: 100,
      url: 'https://example.com/bucket/submissions/KTP/ktp.pdf',
    } as DocumentRecord);
    getSubmissionByIdMock.mockResolvedValue({
      id: 100,
      ownerUserId: 999,
      villageId: 12,
      verifikator: 777,
    } as SubmissionRecord);

    const caller = documentsRouter.createCaller(createCtx('Viewer', 300));
    const promise = caller.delete({ documentId: 55 });

    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(extractS3KeyFromDocumentUrlMock).not.toHaveBeenCalled();
    expect(deleteFileFromS3Mock).not.toHaveBeenCalled();
    expect(deleteDocumentMock).not.toHaveBeenCalled();
  });
});
