'use client';

import { UserCircle } from 'lucide-react';
import { useAuthRole } from '@/components/AuthRoleProvider';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import { ActiveSessionsCard } from '@/components/ActiveSessionsCard';
import { Badge } from '@/components/ui/badge';

/**
 * The signed-in user's own account page: read-only identity details plus the two
 * things they can change without an admin — their password and their sessions.
 *
 * Editing name/NIK/desa stays in Pengaturan, where the role rules live.
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

  const fields: Array<{ label: string; value: string }> = [
    { label: 'Nama Lengkap', value: user.nama },
    { label: 'Email', value: user.email },
    { label: 'NIP/NIK', value: user.nipNik },
    { label: 'Nomor HP', value: user.nomorHP || '—' },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
            <UserCircle className="h-4 w-4 text-blue-600" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900">Profil Saya</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Hubungi administrator untuk mengubah data ini.
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {field.label}
              </dt>
              <dd className="mt-1 break-words text-sm text-gray-900">{field.value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Peran
            </dt>
            <dd className="mt-1">
              <Badge variant="outline" className="border-blue-600 bg-blue-50 text-blue-700">
                {user.peran}
              </Badge>
            </dd>
          </div>
        </dl>
      </section>

      <ChangePasswordCard />
      <ActiveSessionsCard />
    </div>
  );
}
