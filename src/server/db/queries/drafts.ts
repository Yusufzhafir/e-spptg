import { db, DBTransaction } from '../db';
import { submissionDrafts, users, villages } from '../schema';
import { and, desc, eq, or, sql } from 'drizzle-orm';

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

export async function createDraft(userId: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  const created = await queryDb
    .insert(submissionDrafts)
    .values({
      userId,
      currentStep: 1,
      payload: {},
    })
    .returning();
  return created[0];
}

export async function getDraftById(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  return queryDb.query.submissionDrafts.findFirst({
    where: eq(submissionDrafts.id, id),
  });
}

export async function saveDraftStep(
  draftId: number,
  currentStep: number,
  payloadUpdate: object,
  tx?: DBTransaction
) {
  const queryDb = tx || db;

  const draft = await getDraftById(draftId, tx);

  if (!draft) {
    throw new Error('Draft not found');
  }

  // Merge payload
  const updatedPayload = {
    ...draft.payload,
    ...payloadUpdate,
    currentStep,
  };
  const villageCandidate = (payloadUpdate as { villageId?: unknown }).villageId;
  const nextVillageId =
    typeof villageCandidate === 'number'
      ? villageCandidate
      : villageCandidate === null
        ? null
        : draft.villageId;

  const result = await queryDb
    .update(submissionDrafts)
    .set({
      payload: updatedPayload,
      villageId: nextVillageId,
      currentStep,
      lastSaved: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submissionDrafts.id, draftId))
    .returning();

  return result[0];
}

export async function listAccessibleDrafts(
  scope: {
    userId: number;
    role: 'Superadmin' | 'Admin' | 'Verifikator' | 'Viewer';
    assignedVillageId?: number;
  },
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const isSuperadmin = scope.role === 'Superadmin';
  const isViewer = scope.role === 'Viewer';

  const conditions = [];
  if (isViewer) {
    conditions.push(eq(submissionDrafts.userId, scope.userId));
  } else if (!isSuperadmin) {
    if (scope.assignedVillageId == null) {
      throw new Error('Admin/Verifikator harus ditetapkan ke desa');
    }

    conditions.push(
      or(
        eq(submissionDrafts.userId, scope.userId),
        eq(submissionDrafts.villageId, scope.assignedVillageId)
      )
    );
  }

  return queryDb
    .select({
      id: submissionDrafts.id,
      ownerUserId: submissionDrafts.userId,
      ownerName: users.nama,
      villageId: submissionDrafts.villageId,
      villageName: villages.namaDesa,
      payload: submissionDrafts.payload,
      currentStep: submissionDrafts.currentStep,
      lastSaved: submissionDrafts.lastSaved,
      createdAt: submissionDrafts.createdAt,
      updatedAt: submissionDrafts.updatedAt,
      // Extract specific fields from JSONB
      namaPemohon: sql<string | null>`${submissionDrafts.payload}->>'namaPemohon'`,
      nik: sql<string | null>`${submissionDrafts.payload}->>'nik'`,
    })
    .from(submissionDrafts)
    .leftJoin(users, eq(users.id, submissionDrafts.userId))
    .leftJoin(villages, eq(villages.id, submissionDrafts.villageId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(submissionDrafts.updatedAt));
}

export async function deleteDraft(draftId: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  const draft = await getDraftById(draftId, tx);

  if (!draft) {
    throw new Error('Draft not found');
  }

  // Only delete draft record, NOT documents
  // Documents may have been moved to submission, so we don't delete them here
  const result = await queryDb
    .delete(submissionDrafts)
    .where(eq(submissionDrafts.id, draftId))
    .returning();

  return result[0];
}
