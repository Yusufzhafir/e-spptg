'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { StatusBadge } from './StatusBadge';

const SEEN_KEY = 'spptg:notif-seen-at';

function relativeTime(value: Date | string): string {
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Baru saja';
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  return `${day} hari lalu`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  const { data: notifications } = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Load / initialise the "last seen" baseline from localStorage after mount
  useEffect(() => {
    const stored = window.localStorage.getItem(SEEN_KEY);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read persisted baseline on mount
      setLastSeen(Number(stored));
    } else {
      const now = Date.now();
      window.localStorage.setItem(SEEN_KEY, String(now));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initialise baseline on first mount
      setLastSeen(now);
    }
  }, []);

  const items = notifications ?? [];
  const unreadCount =
    lastSeen == null
      ? 0
      : items.filter((n) => new Date(n.createdAt).getTime() > lastSeen).length;

  const markSeen = () => {
    const now = Date.now();
    window.localStorage.setItem(SEEN_KEY, String(now));
    setLastSeen(now);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) markSeen();
  };

  const handleClick = (submissionId: number) => {
    setOpen(false);
    router.push(`/app?focus=${submissionId}`);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative text-gray-600 transition-colors hover:text-gray-900"
          aria-label="Notifikasi"
        >
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">Notifikasi</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              Belum ada notifikasi.
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n.submissionId)}
                className="flex w-full flex-col gap-1.5 border-b px-4 py-3 text-left last:border-b-0 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {n.type === 'created' ? 'Pengajuan baru' : 'Pengajuan diperbarui'}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
                <span className="text-xs text-gray-600">{n.namaPemilik}</span>
                <StatusBadge status={n.status} />
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
