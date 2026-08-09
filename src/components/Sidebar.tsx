import { cn } from '@/lib/utils';
import { useAuthRole } from './AuthRoleProvider';
import { getVisibleNavItems } from '@/lib/nav-items';
import Image from 'next/image';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

/**
 * Desktop navigation. On mobile/tablet the BottomNav takes over, so this is
 * hidden below `lg` — there is no hamburger drawer any more.
 */
export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const { user } = useAuthRole();
  // Empty while the session loads, so a Viewer never sees Pengaturan flash in.
  const visibleMenuItems = getVisibleNavItems(user?.peran ?? null);

  return (
    // Sticky within the app-shell flex row: the nav stays put while the page
    // scrolls, and scrolls on its own only if it ever outgrows the viewport.
    <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
      <div className="p-6">
        {/* Single lockup: the wordmark and tagline are part of the artwork */}
        <div className="mb-8">
          <Image
            src="/SIPETA_LOGO_NAVBAR.png"
            alt="SIAPTAH — Sistem Informasi Administrasi Pertanahan"
            width={1492}
            height={559}
            className="h-auto w-44"
            priority
          />
        </div>

        <nav className="space-y-1">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left',
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
