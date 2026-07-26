import { Home, FileText, Settings, type LucideIcon } from 'lucide-react';
import type { UserRole } from '@/types';

export type NavItem = {
  id: 'beranda' | 'pengajuan' | 'pengaturan';
  label: string;
  icon: LucideIcon;
  href: string;
  /** Roles allowed to see this item; omit for everyone. */
  allowedRoles?: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { id: 'beranda', label: 'Beranda', icon: Home, href: '/app' },
  { id: 'pengajuan', label: 'Pengajuan', icon: FileText, href: '/app/pengajuan' },
  {
    id: 'pengaturan',
    label: 'Pengaturan',
    icon: Settings,
    href: '/app/pengaturan',
    allowedRoles: ['Superadmin', 'Admin', 'Verifikator'],
  },
];

/**
 * Nav items the given role may see.
 *
 * `role` is null while the session is still loading — return nothing then, so a
 * restricted item (e.g. Pengaturan for a Viewer) never flashes on screen before
 * the role resolves.
 */
export function getVisibleNavItems(role: UserRole | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => !item.allowedRoles || item.allowedRoles.includes(role));
}
