import { db, DBTransaction } from '../db';
import { submissionDrafts, submissions_documents } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getOrCreateDraft(userId: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  // Try to get latest draft for user
  let draft = await queryDb.query.submissionDrafts.findFirst({
    where: eq(submissionDrafts.userId, userId),
    orderBy: desc(submissionDrafts.updatedAt),
  });

  if (!draft) {
    // Create new draft
    const created = await queryDb
      .insert(submissionDrafts)
      .values({
        userId,
        currentStep: 1,
        payload: {},
      })
      .returning();
    draft = created[0];
  }

  return draft;
}

export async function getDraftById(id: number, userId: number,tx?: DBTransaction) {
  const queryDb = tx || db;
  const draft = await queryDb.query.submissionDrafts.findFirst({
    where: eq(submissionDrafts.id, id),
  });

  if (draft && draft.userId !== userId) {
    throw new Error('Unauthorized');
  }

  return draft;
}

export async function saveDraftStep(
  draftId: number,
  userId: number,
  currentStep: number,
  payloadUpdate: object,
  tx?: DBTransaction
) {
  const queryDb = tx || db;

  const draft = await getDraftById(draftId, userId,tx);

  if (!draft) {
    throw new Error('Draft not found');
  }

  // Merge payload
  const updatedPayload = {
    ...draft.payload,
    ...payloadUpdate,
    currentStep,
  };

  const result = await queryDb
    .update(submissionDrafts)
    .set({
      payload: updatedPayload,
      currentStep,
      lastSaved: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submissionDrafts.id, draftId))
    .returning();

  return result[0];
}

export async function listUserDrafts(userId: number,tx?: DBTransaction) {
  const queryDb = tx || db;

  return queryDb.query.submissionDrafts.findMany({
    where: eq(submissionDrafts.userId, userId),
    orderBy: desc(submissionDrafts.updatedAt),
  });
}

export async function deleteDraft(draftId: number, userId: number,tx?: DBTransaction) {
  const queryDb = tx || db;
  const draft = await getDraftById(draftId, userId,tx);

  if (!draft) {
    throw new Error('Draft not found');
  }

  // Also delete associated temporary documents
  await queryDb
    .delete(submissions_documents)
    .where(eq(submissions_documents.draftId, draftId));

  const result = await db
    .delete(submissionDrafts)
    .where(eq(submissionDrafts.id, draftId))
    .returning();

  return result[0];
}