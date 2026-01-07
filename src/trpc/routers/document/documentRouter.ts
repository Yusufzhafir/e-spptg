import { z } from 'zod';
import { createUploadUrlSchema, listDocumentsSchema, uploadFileSchema, getTemplateUrlSchema } from '@/lib/validation/index';
import * as queries from '@/server/db/queries/documents';
import * as draftQueries from '@/server/db/queries/drafts';
import { generateUploadUrl, uploadFileToS3, getTemplateSignedUrl, fetchTemplatePDF } from '@/server/s3/s3';
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

      // Generate S3 key and public URL (no presigned URL - uploads handled server-side)
      const { publicUrl, s3Key } = await generateUploadUrl(
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
        s3Key, // S3 key for server-side upload
        publicUrl, // Final public URL after upload
      };
    }),

  /**
   * Upload file to S3 via server-side proxy (avoids CORS issues)
   */
  uploadFile: protectedProcedure
    .input(uploadFileSchema)
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

      // Verify document exists and belongs to draft
      const document = await queries.getDocumentById(input.documentId);
      if (!document || document.draftId !== input.draftId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Dokumen tidak ditemukan atau tidak sesuai dengan draft',
        });
      }

      // Convert base64 to buffer
      let fileBuffer: Buffer;
      try {
        // Remove data URL prefix if present (e.g., "data:image/png;base64,")
        const base64Data = input.fileData.includes(',') 
          ? input.fileData.split(',')[1] 
          : input.fileData;
        fileBuffer = Buffer.from(base64Data, 'base64');
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Format file data tidak valid (harus base64)',
        });
      }

      // Validate buffer size matches reported size
      if (fileBuffer.length !== input.size) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ukuran file tidak sesuai dengan data yang dikirim',
        });
      }

      // Upload file to S3 using the provided s3Key
      const { publicUrl } = await uploadFileToS3(
        fileBuffer,
        input.s3Key,
        input.mimeType
      );

      // Update document record with final URL
      await queries.updateDocument(input.documentId, {
        url: publicUrl,
        size: input.size,
      });

      return {
        success: true,
        publicUrl,
        message: 'File berhasil diunggah',
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

  getById: protectedProcedure
    .input(z.object({ documentId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const document = await queries.getDocumentById(input.documentId);
      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Dokumen tidak ditemukan',
        });
      }
      return document;
    }),

  /**
   * Delete a document (and optionally delete from S3)
   */
  delete: protectedProcedure
    .input(z.object({ documentId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const document = await queries.getDocumentById(input.documentId);
      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Dokumen tidak ditemukan',
        });
      }

      // Verify ownership (if draft, check user)
      if (document.draftId) {
        const draft = await draftQueries.getDraftById(
          document.draftId,
          ctx.appUser!.id
        );
        if (!draft) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Anda tidak memiliki akses ke dokumen ini',
          });
        }
      }

      await queries.deleteDocument(input.documentId);

      return {
        success: true,
        message: 'Dokumen berhasil dihapus',
      };
    }),

  /**
   * Get a signed URL for a template document
   * Signed URL expires in 1 week
   */
  getTemplateUrl: protectedProcedure
    .input(getTemplateUrlSchema)
    .mutation(async ({ input }) => {
      const signedUrl = await getTemplateSignedUrl(input.templateType);
      return { signedUrl };
    }),

  /**
   * Fetch template PDF server-side and return as base64
   * This avoids CORS issues when accessing private S3 buckets
   */
  fetchTemplatePDF: protectedProcedure
    .input(getTemplateUrlSchema)
    .mutation(async ({ input }) => {
      try {
        const pdfBuffer = await fetchTemplatePDF(input.templateType);
        // Convert buffer to base64
        const base64String = pdfBuffer.toString('base64');
        return { 
          pdfData: base64String,
          size: pdfBuffer.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch template PDF',
        });
      }
    }),
});