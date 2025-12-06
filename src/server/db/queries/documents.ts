import { DocumentCategoryEnum } from '@/types';
import { db, DBTransaction } from '../db';
import { submissions_documents } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createDocument(
  data: typeof submissions_documents.$inferInsert,
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const result = await queryDb
    .insert(submissions_documents)
    .values(data)
    .returning();
  return result[0];
}

export async function listDocumentsByDraft(draftId: number, tx?: DBTransaction) {
  const queryDb = tx || db;

  return queryDb.query.submissions_documents.findMany({
    where: eq(submissions_documents.draftId, draftId),
  });
}

export async function listDocumentsBySubmission(submissionId: number, tx?: DBTransaction) {
  const queryDb = tx || db;

  return queryDb.query.submissions_documents.findMany({
    where: eq(submissions_documents.submissionId, submissionId),
  });
}

export async function updateDocumentSubmissionId(
  documentId: number,
  submissionId: number,
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const result = await queryDb
    .update(submissions_documents)
    .set({
      submissionId,
      isTemporary: false,
      updatedAt: new Date(),
    })
    .where(eq(submissions_documents.id, documentId))
    .returning();
  return result[0];
}

export async function listAllDocuments(filters: {
  category?: DocumentCategoryEnum;
  isTemporary?: boolean;
  limit?: number;
  offset?: number;
}, tx?: DBTransaction) {
  const queryDb = tx || db;

  const { category, isTemporary, limit = 50, offset = 0 } = filters;
  const conditions = [];

  if (category) {
    conditions.push(eq(submissions_documents.category, category));
  }

  if (isTemporary !== undefined) {
    conditions.push(eq(submissions_documents.isTemporary, isTemporary));
  }

  return queryDb.query.submissions_documents.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    limit,
    offset,
  });
}

export async function deleteDocument(documentId: number, tx?: DBTransaction) {
  const queryDb = tx || db;

  const result = await queryDb
    .delete(submissions_documents)
    .where(eq(submissions_documents.id, documentId))
    .returning();
  return result[0];
}