import { protectedProcedure, adminProcedure, router } from '@/trpc/init';
import { z } from 'zod';
import { createUploadUrlSchema, listDocumentsSchema } from '@/lib/validations';
import * as queries from '@/server/db/queries/documents';
import * as draftQueries from '@/server/db/queries/drafts';
import { generateUploadUrl } from '@/server/s3/s3';

export const documentsRouter = router({
  createUploadUrl: protectedProcedure
    .input(createUploadUrlSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify draft belongs to user
      const draft = await draftQueries.getDraftById(
        input.draftId,
        ctx.appUser!.id
      );

      if (!draft) {
        throw new Error('Draft not found');
      }

      // Generate S3 upload URL
      const { uploadUrl, publicUrl, s3Key } = await generateUploadUrl(
        input.filename,
        input.mimeType,
        input.category
      );

      // Create document record
      const document = await queries.createDocument({
        filename: input.filename,
        fileType: input.mimeType,
        size: input.size,
        url: publicUrl,
        category: input.category as any,
        draftId: input.draftId,
        uploadedBy: ctx.appUser!.id,
        isTemporary: true,
      });

      return {
        documentId: document.id,
        uploadUrl,
        publicUrl,
      };
    }),

  listByDraft: protectedProcedure
    .input(z.object({ draftId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      // Verify draft belongs to user
      await draftQueries.getDraftById(input.draftId, ctx.appUser!.id);

      return queries.listDocumentsByDraft(input.draftId);
    }),

  listBySubmission: protectedProcedure
    .input(z.object({ submissionId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      return queries.listDocumentsBySubmission(input.submissionId);
    }),

  listAll: adminProcedure
    .input(listDocumentsSchema)
    .query(async ({ ctx, input }) => {
      const items = await queries.listAllDocuments({
        category: input.category,
        isTemporary: input.isTemporary,
        limit: input.limit,
        offset: input.offset,
      });

      return items;
    }),

  delete: protectedProcedure
    .input(z.object({ documentId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Verify ownership
      return queries.deleteDocument(input.documentId);
    }),
});