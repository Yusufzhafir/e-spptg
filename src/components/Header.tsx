'use client';

import Image from 'next/image';
import Link from 'next/link';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { useAuthRole } from './AuthRoleProvider';
import { Button } from './ui/button';

interface HeaderProps {
  /** Page heading shown on the left. */
  title?: string;
}

export function Header({ title = 'Dashboard' }: HeaderProps) {
  const { isAuthenticated, isLoading } = useAuthRole();

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Brand stands in for the removed hamburger on small screens */}
          <Image
            src="/SIPETA_LOGO_NAVBAR.png"
            alt="SIAPTAH — Sistem Informasi Administrasi Pertanahan"
            width={1492}
            height={559}
            className="h-7 w-auto shrink-0 lg:hidden"
          />
          <h1 className="truncate text-lg sm:text-xl md:text-2xl text-gray-900">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isAuthenticated ? (
            // Below lg these live in the bottom nav, so avoid showing them twice
            <div className="hidden items-center gap-3 lg:flex">
              <NotificationBell />
              <UserMenu />
            </div>
          ) : (
            // Only reachable in the brief window before `auth.me` resolves, or
            // if a stale cookie got someone this far; offer the way back in.
            !isLoading && (
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" className="text-gray-700">
                  <Link href="/sign-in">Masuk</Link>
                </Button>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/sign-up">Daftar</Link>
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    </header>
  );
}
