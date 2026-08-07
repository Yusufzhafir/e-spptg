import { TRPCError } from '@trpc/server';
import type { TRPCContext } from '@/trpc/context';
import { canManageUser, type UserAccessTarget } from '@/lib/user-access';

export type AppUser = NonNullable<TRPCContext['appUser']>;

export type DraftAccessRecord = {
  userId: number;
  villageId: number | null;
};

export type SubmissionAccessRecord = {
  ownerUserId: number | null;
  villageId: number;
  /**
   * The *desa's* kecamatan (villages.kecamatan), used to scope the read-only
   * 'Kecamatan' role. Do not pass submissions.kecamatan here — that column is
   * free text captured at submission time and is often stale or empty.
   */
  desaKecamatan?: string | null;
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

/**
 * Read-only oversight of every desa in one kecamatan. Sees submissions on the
 * dashboard but processes nothing: no drafts, no status changes, no validity
 * toggle, no settings.
 */
export function isKecamatanViewer(user: AppUser): boolean {
  return user.peran === 'Kecamatan';
}

export function requireAssignedKecamatan(user: AppUser): string {
  const kecamatan = user.assignedKecamatan?.trim();
  if (!kecamatan) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Peran Kecamatan harus ditetapkan ke satu kecamatan terlebih dahulu.',
    });
  }
  return kecamatan;
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

/**
 * Mandatory row-level scope for the current user. Named `scopeKecamatan` (not
 * `kecamatan`) so it can never be confused with — or overwritten by — the
 * user-selectable kecamatan filter on the dashboard.
 */
export function getSubmissionScopeForUser(user: AppUser): {
  ownerUserId?: number;
  villageId?: number;
  scopeKecamatan?: string;
} {
  if (isSuperadmin(user)) {
    return {};
  }

  if (isViewer(user)) {
    return { ownerUserId: user.id };
  }

  if (isKecamatanViewer(user)) {
    return { scopeKecamatan: requireAssignedKecamatan(user) };
  }

  return { villageId: requireAssignedVillageId(user) };
}

/**
 * Oversight roles read a filed pengajuan to confirm the certificate exists, not
 * to inspect the applicant's identity papers. Kecamatan and Superadmin therefore
 * see only the issued SPPTG on a submission — never the KTP, KK, kwitansi or any
 * other berkas. The desa staff who actually process the berkas (Admin,
 * Verifikator) and the Viewer who owns it keep full access.
 *
 * Drafts are deliberately not covered: the wizard has to show its own uploads,
 * and Kecamatan cannot reach a draft at all (see `canAccessDraft`).
 */
export function canViewSubmissionDocumentCategory(
  user: AppUser,
  category: string
): boolean {
  if (isSuperadmin(user) || isKecamatanViewer(user)) {
    return category === 'SPPG';
  }
  return true;
}

/** True when the role only ever sees the SPPTG certificate on a submission. */
export function isCertificateOnlyDocumentViewer(user: AppUser): boolean {
  return isSuperadmin(user) || isKecamatanViewer(user);
}

export function assertCanViewSubmissionDocument(user: AppUser, category: string) {
  if (!canViewSubmissionDocumentCategory(user, category)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        'Peran Anda hanya dapat membuka dokumen SPPTG pada pengajuan ini.',
    });
  }
}

export function canAccessDraft(user: AppUser, draft: DraftAccessRecord): boolean {
  if (isSuperadmin(user)) return true;
  if (isViewer(user)) return draft.userId === user.id;
  // Kecamatan is dashboard-only: it never touches the pengajuan workflow.
  if (isKecamatanViewer(user)) return false;

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

  if (isKecamatanViewer(user)) {
    const assignedKecamatan = requireAssignedKecamatan(user);
    return (
      (submission.desaKecamatan ?? '').trim().toLowerCase() ===
      assignedKecamatan.toLowerCase()
    );
  }

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

/**
 * Guard mutations on another user's account (edit / toggle status / reset).
 * Enforces the Superadmin > Admin > Verifikator > Viewer hierarchy scoped by desa.
 */
export function assertCanManageUser(actor: AppUser, target: UserAccessTarget) {
  if (!canManageUser(actor, target)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Anda tidak memiliki izin untuk mengelola pengguna ini.',
    });
  }
}
