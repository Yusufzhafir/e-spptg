import { UserRole } from '@/types';

/**
 * Role hierarchy for the Pengaturan → Pengguna tab: Superadmin > Admin >
 * Verifikator > Viewer. Access is scoped by role level AND assigned desa.
 *
 * Pure (no server-only imports) so it can back both the tRPC procedures and the
 * client UI, keeping visibility and edit rules identical on both sides.
 */

export type UserAccessActor = {
  id: number;
  peran: UserRole;
  assignedVillageId: number | null;
};

export type UserAccessTarget = {
  id: number;
  peran: UserRole;
  assignedVillageId: number | null;
};

const ROLE_LEVEL: Record<UserRole, number> = {
  Superadmin: 3,
  Admin: 2,
  Verifikator: 1,
  // Read-only oversight: ranks alongside Viewer, manages nobody.
  Kecamatan: 0,
  Viewer: 0,
};

/**
 * Whether `actor` may see `target` in the user list at all.
 * - Superadmin: everyone.
 * - Admin / Verifikator: only users within their own desa (never Superadmins,
 *   who have no desa, and never other-desa accounts).
 * - Viewer: only themselves.
 */
export function canViewUser(actor: UserAccessActor, target: UserAccessTarget): boolean {
  if (actor.peran === 'Superadmin') return true;
  if (actor.peran === 'Admin' || actor.peran === 'Verifikator') {
    if (actor.assignedVillageId == null) return actor.id === target.id;
    return target.assignedVillageId === actor.assignedVillageId;
  }
  return actor.id === target.id;
}

/**
 * Whether `actor` may edit / toggle / reset `target` (i.e. show action buttons).
 * - Superadmin: anyone.
 * - Admin: only accounts strictly below Admin (Verifikator/Viewer) in their own
 *   desa. Never Superadmins, never other Admins (even same desa), never other desa.
 * - Verifikator / Viewer: no one.
 */
export function canManageUser(actor: UserAccessActor, target: UserAccessTarget): boolean {
  if (actor.peran === 'Superadmin') return true;
  if (actor.peran === 'Admin') {
    if (actor.assignedVillageId == null) return false;
    return (
      target.assignedVillageId === actor.assignedVillageId &&
      ROLE_LEVEL[target.peran] < ROLE_LEVEL.Admin
    );
  }
  return false;
}
