import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../../init';
import * as commentQueries from '@/server/db/queries/comments';
import * as submissionQueries from '@/server/db/queries/submissions';
import {
  assertCanAccessSubmission,
  isSuperadmin,
  type AppUser,
} from '@/server/authz';

type SubmissionRecord = { ownerUserId: number | null; villageId: number };
type CommentRecord = { userId: number };

/**
 * Delete allowed for: Superadmin, the Admin of that submission's village,
 * the submission owner (pengaju), and the comment's author.
 */
function canDeleteComment(
  user: AppUser,
  comment: CommentRecord,
  submission: SubmissionRecord
): boolean {
  if (isSuperadmin(user)) return true;
  if (comment.userId === user.id) return true;
  if (submission.ownerUserId != null && submission.ownerUserId === user.id) return true;
  if (user.peran === 'Admin' && user.assignedVillageId === submission.villageId) return true;
  return false;
}

async function loadAccessibleSubmission(user: AppUser, submissionId: number) {
  const submission = await submissionQueries.getSubmissionById(submissionId);
  if (!submission) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Pengajuan tidak ditemukan' });
  }
  assertCanAccessSubmission(user, {
    ownerUserId: submission.ownerUserId,
    villageId: submission.villageId,
  });
  return submission;
}

export const commentsRouter = router({
  listBySubmission: protectedProcedure
    .input(z.object({ submissionId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await loadAccessibleSubmission(ctx.appUser!, input.submissionId);
      return commentQueries.listCommentsBySubmission(input.submissionId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        submissionId: z.number().int(),
        content: z.string().trim().min(1, 'Komentar tidak boleh kosong').max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await loadAccessibleSubmission(ctx.appUser!, input.submissionId);
      return commentQueries.createComment({
        submissionId: input.submissionId,
        userId: ctx.appUser!.id,
        content: input.content,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ commentId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await commentQueries.getCommentById(input.commentId);
      if (!comment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Komentar tidak ditemukan' });
      }

      const submission = await loadAccessibleSubmission(ctx.appUser!, comment.submissionId);

      if (
        !canDeleteComment(
          ctx.appUser!,
          { userId: comment.userId },
          { ownerUserId: submission.ownerUserId, villageId: submission.villageId }
        )
      ) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Anda tidak berhak menghapus komentar ini.',
        });
      }

      await commentQueries.deleteComment(input.commentId);
      return { success: true };
    }),
});
