import { TRPCError } from '@trpc/server';
import type { TRPCContext } from '@/trpc/context';

export type AppUser = NonNullable<TRPCContext['appUser']>;

export type DraftAccessRecord = {
  userId: number;
  villageId: number | null;
};

export type SubmissionAccessRecord = {
  ownerUserId: number | null;
  villageId: number;
};

export function isSuperadmin(user: AppUser): boolean {
  return user.peran === 'Superadmin';
}

export function isViewer(user: AppUser): boolean {
  return user.peran === 'Viewer';
}

export function isPrivilegedProcessor(user: AppUser): boolean {
  return user.peran === 'Admin' || user.peran === 'Verifikator';
}

export function requireAssignedVillageId(user: AppUser): number {
  if (!isPrivilegedProcessor(user)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Peran ini tidak memiliki cakupan desa terbatas.',
    });
  }

  if (!user.assignedVillageId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin/Verifikator harus ditetapkan ke desa sebelum mengakses pengajuan.',
    });
  }

  return user.assignedVillageId;
}

export function getSubmissionScopeForUser(user: AppUser): {
  ownerUserId?: number;
  villageId?: number;
} {
  if (isSuperadmin(user)) {
    return {};
  }

  if (isViewer(user)) {
    return { ownerUserId: user.id };
  }

  return { villageId: requireAssignedVillageId(user) };
}

export function canAccessDraft(user: AppUser, draft: DraftAccessRecord): boolean {
  if (isSuperadmin(user)) return true;
  if (isViewer(user)) return draft.userId === user.id;

  const assignedVillageId = requireAssignedVillageId(user);

  if (draft.userId === user.id) return true;
  if (draft.villageId == null) return false;
  return draft.villageId === assignedVillageId;
}

export function canAccessSubmission(
  user: AppUser,
  submission: SubmissionAccessRecord
): boolean {
  if (isSuperadmin(user)) return true;
  if (isViewer(user)) return submission.ownerUserId != null && submission.ownerUserId === user.id;

  const assignedVillageId = requireAssignedVillageId(user);
  return submission.villageId === assignedVillageId;
}

export function assertCanAccessDraft(user: AppUser, draft: DraftAccessRecord) {
  if (!canAccessDraft(user, draft)) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Draft tidak ditemukan',
    });
  }
}

export function assertCanAccessSubmission(user: AppUser, submission: SubmissionAccessRecord) {
  if (!canAccessSubmission(user, submission)) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Pengajuan tidak ditemukan',
    });
  }
}
