import { z } from 'zod';
import { createUploadUrlSchema, listDocumentsSchema } from '@/lib/validation/index';
import * as queries from '@/server/db/queries/documents';
import * as draftQueries from '@/server/db/queries/drafts';
import { generateUploadUrl } from '@/server/s3/s3';
import { TRPCError } from '@trpc/server';
import { adminProcedure, protectedProcedure, router } from '@/trpc/init';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const documentsRouter = router({
  /**
   * Generate a presigned upload URL for S3-compatible storage
   */
  createUploadUrl: protectedProcedure
    .input(createUploadUrlSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate file size
      if (input.size > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Ukuran file maksimal ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        });
      }

      // Validate mime type
      if (!ACCEPTED_MIME_TYPES.includes(input.mimeType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Tipe file hanya PDF dan gambar (JPEG, PNG, WebP)',
        });
      }

      // Verify draft belongs to user
      const draft = await draftQueries.getDraftById(
        input.draftId,
        ctx.appUser!.id
      );

      if (!draft) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Draft tidak ditemukan',
        });
      }

      // Generate S3 upload URL
      const { uploadUrl, publicUrl } = await generateUploadUrl(
        input.filename,
        input.mimeType,
        input.category
      );

      // Create document record in DB
      const document = await queries.createDocument({
        filename: input.filename,
        fileType: input.mimeType,
        size: input.size,
        url: publicUrl,
        category: input.category,
        draftId: input.draftId,
        uploadedBy: ctx.appUser!.id,
        isTemporary: true,
      });

      return {
        documentId: document.id,
        uploadUrl, // Presigned URL for client to upload to
        publicUrl, // Final public URL after upload
      };
    }),

  /**
   * List documents for a specific draft
   */
  listByDraft: protectedProcedure
    .input(z.object({ draftId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      // Verify draft belongs to user
      const draft = await draftQueries.getDraftById(
        input.draftId,
        ctx.appUser!.id
      );

      if (!draft) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Draft tidak ditemukan',
        });
      }

      const documents = await queries.listDocumentsByDraft(input.draftId);

      return documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        fileType: d.fileType,
        size: d.size,
        url: d.url,
        category: d.category,
        uploadedAt: d.uploadedAt,
      }));
    }),

  /**
   * List documents for a specific submission
   */
  listBySubmission: protectedProcedure
    .input(z.object({ submissionId: z.number().int() }))
    .query(async ({ input }) => {
      const documents = await queries.listDocumentsBySubmission(
        input.submissionId
      );

      return documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        fileType: d.fileType,
        size: d.size,
        url: d.url,
        category: d.category,
        uploadedAt: d.uploadedAt,
      }));
    }),

  /**
   * Admin: List all documents with filters
   * For file management dashboard
   */
  listAll: adminProcedure
    .input(listDocumentsSchema)
    .query(async ({ input }) => {
      const documents = await queries.listAllDocuments({
        category: input.category,
        isTemporary: input.isTemporary,
        limit: input.limit,
        offset: input.offset,
      });

      return documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        fileType: d.fileType,
        size: d.size,
        url: d.url,
        category: d.category,
        submissionId: d.submissionId,
        draftId: d.draftId,
        uploadedAt: d.uploadedAt,
        isTemporary: d.isTemporary,
      }));
    }),

  /**
   * Delete a document (and optionally delete from S3)
   */
  delete: protectedProcedure
    .input(z.object({ documentId: z.number().int() }))
    .mutation(async ({ input }) => {
      // TODO: Add ownership verification
      await queries.deleteDocument(input.documentId);

      return {
        success: true,
        message: 'Dokumen berhasil dihapus',
      };
    }),
});