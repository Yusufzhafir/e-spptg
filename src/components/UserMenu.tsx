'use client';

import Link from 'next/link';
import { KeyRound, LogOut, User as UserIcon } from 'lucide-react';
import { useAuthRole } from './AuthRoleProvider';
import { UserAvatar } from './UserAvatar';
import { Skeleton } from './ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

/**
 * Account menu in the header and the bottom nav: who you are, links to the
 * account page, and the sign-out action.
 */
export function UserMenu() {
  const { user, isLoading, signOut, isSigningOut } = useAuthRole();

  if (isLoading && !user) {
    return <Skeleton className="h-9 w-9 rounded-full" />;
  }

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu akun"
          className="rounded-full transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <UserAvatar
            nama={user.nama}
            email={user.email}
            fotoProfilUrl={user.fotoProfilUrl}
            className="h-9 w-9"
            textClassName="text-sm"
          />
        </button>
      </DropdownMenuTrigger>

      {/* Same treatment as the notification panel: full width on a phone, where
          this trigger lives in the bottom nav, and a compact menu from `sm` up. */}
      <DropdownMenuContent
        align="end"
        collisionPadding={12}
        className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:w-60 sm:max-w-none"
      >
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-gray-900">{user.nama}</p>
          <p className="truncate text-xs text-gray-500">{user.email}</p>
          <p className="mt-1 inline-flex rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
            {user.peran}
          </p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/app/akun" className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" />
            Profil Saya
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/app/akun#kata-sandi" className="cursor-pointer">
            <KeyRound className="mr-2 h-4 w-4" />
            Ubah Kata Sandi
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={isSigningOut}
          onSelect={(event) => {
            // Radix closes the menu on select and would unmount this item
            // mid-await; keep it open until the request settles.
            event.preventDefault();
            void signOut('/');
          }}
          className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isSigningOut ? 'Keluar…' : 'Keluar'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
