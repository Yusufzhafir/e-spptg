'use client';

import { useState } from 'react';
import { Loader2, MonitorSmartphone } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';
import { useAuthRole } from './AuthRoleProvider';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { formatDateTime } from '@/lib/format-date';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

/**
 * Turn a raw user-agent into something a non-technical user recognises. Rough by
 * design — this is a memory aid for spotting a session that is not yours, not
 * device fingerprinting.
 */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Perangkat tidak dikenal';

  const os = /Android/i.test(userAgent)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? 'iOS'
      : /Windows/i.test(userAgent)
        ? 'Windows'
        : /Mac OS X|Macintosh/i.test(userAgent)
          ? 'macOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : 'Sistem lain';

  // Order matters: Edge and Chrome both claim "Chrome", Chrome also claims "Safari".
  const browser = /Edg\//i.test(userAgent)
    ? 'Edge'
    : /OPR\//i.test(userAgent)
      ? 'Opera'
      : /Firefox\//i.test(userAgent)
        ? 'Firefox'
        : /Chrome\//i.test(userAgent)
          ? 'Chrome'
          : /Safari\//i.test(userAgent)
            ? 'Safari'
            : 'Peramban lain';

  return `${browser} · ${os}`;
}

/** Lists the account's live sessions and offers a "sign out everywhere" escape. */
export function ActiveSessionsCard() {
  const { signOut } = useAuthRole();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: sessions, isLoading } = trpc.auth.listSessions.useQuery();

  const revokeAll = trpc.auth.revokeAllSessions.useMutation({
    onSuccess: async () => {
      toast.success('Semua sesi telah dikeluarkan.');
      // Revoking everything includes this device, so the cookie is already gone;
      // clear the cache and get out of the app shell.
      await signOut('/sign-in');
    },
    onError: (error) => toast.error(error.message || 'Gagal mengeluarkan sesi.'),
  });

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
          <MonitorSmartphone className="h-4 w-4 text-blue-600" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-900">Perangkat Aktif</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Sesi yang saat ini masih dapat mengakses akun Anda.
          </p>
        </div>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat sesi…
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada sesi aktif.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {sessions.map((session, index) => (
              <li
                key={`${session.createdAt}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {describeDevice(session.userAgent)}
                    {session.isCurrent && (
                      <Badge
                        variant="outline"
                        className="ml-2 border-green-600 bg-green-50 text-green-700"
                      >
                        Perangkat ini
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    Masuk {formatDateTime(session.createdAt)}
                    {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        variant="outline"
        className="mt-4 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        disabled={revokeAll.isPending || !sessions?.length}
        onClick={() => setConfirmOpen(true)}
      >
        {revokeAll.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Keluar dari Semua Perangkat
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keluar dari Semua Perangkat?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua sesi akan diakhiri, termasuk perangkat yang Anda pakai sekarang.
              Anda perlu masuk kembali.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeAll.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Keluar Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
