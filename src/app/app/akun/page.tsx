'use client';

import { useAuthRole } from '@/components/AuthRoleProvider';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import { ActiveSessionsCard } from '@/components/ActiveSessionsCard';
import { EditProfileCard } from '@/components/EditProfileCard';

/**
 * The signed-in user's own account page: their identity details plus the things
 * they can change without an admin — NIP/NIK, nomor HP, their password and
 * their sessions.
 *
 * Nama, email, peran and desa stay in Pengaturan, where the role rules live.
 */
export default function AkunPage() {
  const { user, isLoading } = useAuthRole();

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <EditProfileCard user={user} />
      <ChangePasswordCard />
      <ActiveSessionsCard />
    </div>
  );
}
