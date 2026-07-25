import { desc, eq } from 'drizzle-orm';
import { db, type DBTransaction } from '../db';
import { comments, users } from '../schema';

/** List comments for a submission (newest first) with author info. */
export async function listCommentsBySubmission(
  submissionId: number,
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  return queryDb
    .select({
      id: comments.id,
      submissionId: comments.submissionId,
      userId: comments.userId,
      content: comments.content,
      createdAt: comments.createdAt,
      authorName: users.nama,
      authorRole: users.peran,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.submissionId, submissionId))
    .orderBy(desc(comments.createdAt));
}

export async function createComment(
  data: { submissionId: number; userId: number; content: string },
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const [row] = await queryDb.insert(comments).values(data).returning();
  return row;
}

export async function getCommentById(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  const [row] = await queryDb
    .select()
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);
  return row ?? null;
}

export async function deleteComment(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  const [row] = await queryDb
    .delete(comments)
    .where(eq(comments.id, id))
    .returning();
  return row ?? null;
}
