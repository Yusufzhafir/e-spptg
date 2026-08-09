import { db, DBTransaction } from '../db';
import { submissionDrafts, users, villages } from '../schema';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import {
  coordinatesNeedIdNormalization,
  normalizeCoordinateIds,
  type CoordinateWithOptionalId,
} from '@/lib/coordinate-ids';

/**
 * Merge a payload update into the stored payload. A null value from the
 * client means "field cleared" — the key is removed from the stored payload
 * (undefined can't be used: JSON transport drops undefined keys entirely,
 * which would silently keep the old value).
 */
export function mergeDraftPayload(
  base: Record<string, unknown>,
  update: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base, ...update };
  for (const key of Object.keys(update)) {
    if (update[key] === null) {
      delete merged[key];
    }
  }
  return merged;
}

function normalizeDraftCoordinatesPayload(
  payload: unknown
): { payload: Record<string, unknown>; changed: boolean } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { payload: {}, changed: false };
  }

  const payloadObject = payload as Record<string, unknown>;
  const rawCoordinates = payloadObject.coordinatesGeografis;
  if (!Array.isArray(rawCoordinates)) {
    return { payload: payloadObject, changed: false };
  }

  const coordinates = rawCoordinates as CoordinateWithOptionalId[];
  if (!coordinatesNeedIdNormalization(coordinates)) {
    return { payload: payloadObject, changed: false };
  }

  return {
    payload: {
      ...payloadObject,
      coordinatesGeografis: normalizeCoordinateIds(coordinates),
    },
    changed: true,
  };
}

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

export async function createDraftFromSubmission(
  params: {
    userId: number;
    villageId: number | null;
    payload: Record<string, unknown>;
    editingSubmissionId: number | null;
    currentStep?: number;
  },
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  const created = await queryDb
    .insert(submissionDrafts)
    .values({
      userId: params.userId,
      villageId: params.villageId,
      editingSubmissionId: params.editingSubmissionId,
      currentStep: params.currentStep ?? 1,
      payload: params.payload,
    })
    .returning();
  return created[0];
}

export async function getDraftById(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  const draft = await queryDb.query.submissionDrafts.findFirst({
    where: eq(submissionDrafts.id, id),
  });

  if (!draft) return draft;

  const normalized = normalizeDraftCoordinatesPayload(draft.payload);
  if (!normalized.changed) {
    return draft;
  }

  const updated = await queryDb
    .update(submissionDrafts)
    .set({
      payload: normalized.payload,
      updatedAt: new Date(),
    })
    .where(eq(submissionDrafts.id, id))
    .returning();

  return updated[0] ?? {
    ...draft,
    payload: normalized.payload,
  };
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

  // Merge payload (null values from the client clear the field)
  const mergedPayload = {
    ...mergeDraftPayload(
      draft.payload as Record<string, unknown>,
      payloadUpdate as Record<string, unknown>
    ),
    currentStep,
  };
  const normalizedPayload = normalizeDraftCoordinatesPayload(mergedPayload).payload;
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
      payload: normalizedPayload,
      villageId: nextVillageId,
      currentStep,
      lastSaved: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submissionDrafts.id, draftId))
    .returning();

  return result[0];
}

/**
 * Ordering the draft table may ask for. Sorting has to happen here rather than
 * in the browser now that the list is paged: the page on screen is not the set
 * being sorted.
 */
const DRAFT_SORT_COLUMNS = {
  namaPemohon: sql`${submissionDrafts.payload}->>'namaPemohon'`,
  nik: sql`${submissionDrafts.payload}->>'nik'`,
  currentStep: submissionDrafts.currentStep,
  lastSaved: submissionDrafts.lastSaved,
} as const;

export type DraftSortKey = keyof typeof DRAFT_SORT_COLUMNS;

export async function listAccessibleDrafts(
  scope: {
    userId: number;
    role: 'Superadmin' | 'Admin' | 'Verifikator' | 'Kecamatan' | 'Viewer';
    assignedVillageId?: number;
    search?: string;
    step?: number;
    sortKey?: DraftSortKey;
    sortDir?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  },
  tx?: DBTransaction
) {
  const queryDb = tx || db;
  // 'Kecamatan' is read-only dashboard oversight and takes no part in the
  // pengajuan workflow, so it has no drafts at all.
  if (scope.role === 'Kecamatan') return { items: [], total: 0 };

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

  // Searching the JSONB payload rather than a column: the applicant's name and
  // NIK only exist inside the draft's payload until it is filed.
  if (scope.search?.trim()) {
    const pattern = `%${scope.search.trim().toLowerCase()}%`;
    conditions.push(
      sql`(
        LOWER(COALESCE(${submissionDrafts.payload}->>'namaPemohon', '')) LIKE ${pattern}
        OR LOWER(COALESCE(${submissionDrafts.payload}->>'nik', '')) LIKE ${pattern}
        OR LOWER(COALESCE(${users.nama}, '')) LIKE ${pattern}
        OR LOWER(COALESCE(${villages.namaDesa}, '')) LIKE ${pattern}
      )`
    );
  }

  if (scope.step != null) {
    conditions.push(eq(submissionDrafts.currentStep, scope.step));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const sortColumn = DRAFT_SORT_COLUMNS[scope.sortKey ?? 'lastSaved'];
  const orderBy = scope.sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const items = await queryDb
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
    .where(where)
    // `id` as a tiebreak so rows sharing a value cannot swap between pages.
    .orderBy(orderBy, desc(submissionDrafts.id))
    .limit(scope.limit ?? 50)
    .offset(scope.offset ?? 0);

  const [counted] = await queryDb
    .select({ count: sql<number>`count(*)::int` })
    .from(submissionDrafts)
    .leftJoin(users, eq(users.id, submissionDrafts.userId))
    .leftJoin(villages, eq(villages.id, submissionDrafts.villageId))
    .where(where);

  return { items, total: counted?.count ?? 0 };
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
