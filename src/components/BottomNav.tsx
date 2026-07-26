'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuthRole } from './AuthRoleProvider';
import { getVisibleNavItems } from '@/lib/nav-items';
import { NotificationBell } from './NotificationBell';
import { UserButton } from '@clerk/nextjs';

interface BottomNavProps {
  /** Active nav id, derived from the route by the layout. */
  currentPage: string;
}

/**
 * Mobile/tablet navigation bar pinned to the bottom (Instagram-style): icons
 * only, no labels. Replaces the hamburger drawer below `lg`; the sidebar takes
 * over from `lg` up.
 */
export function BottomNav({ currentPage }: BottomNavProps) {
  const { user } = useAuthRole();
  // Empty until the role resolves, so restricted items never flash in.
  const items = getVisibleNavItems(user?.peran ?? null);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Navigasi utama"
    >
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex h-14 flex-1 items-center justify-center transition-colors',
                isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
              )}
            >
              <Icon className={cn('h-6 w-6', isActive && 'stroke-[2.5]')} />
            </Link>
          );
        })}

        <div className="flex h-14 flex-1 items-center justify-center">
          <NotificationBell />
        </div>
        <div className="flex h-14 flex-1 items-center justify-center">
          <UserButton />
        </div>
      </div>
    </nav>
  );
}
