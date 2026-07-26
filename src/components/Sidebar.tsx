import { cn } from '@/lib/utils';
import { Home, FileText, Settings, X } from 'lucide-react';
import { useAuthRole } from './AuthRoleProvider';
import Image from 'next/image';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  /** Mobile drawer open state (ignored on desktop, where it is always shown) */
  isOpen?: boolean;
  onClose?: () => void;
}

const menuItems = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'pengajuan', label: 'Pengajuan', icon: FileText },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
];

export function Sidebar({ currentPage, onPageChange, isOpen = false, onClose }: SidebarProps) {
  const { hasRole } = useAuthRole();
  const isViewer = hasRole('Viewer');

  // Filter out Settings menu item for Viewer role
  const filteredMenuItems = menuItems.filter((item) => {
    if (item.id === 'pengaturan' && isViewer) {
      return false;
    }
    return true;
  });

  return (
    <>
      {/* Backdrop (mobile/tablet only) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-gray-200 bg-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:min-h-screen',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="p-6">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src={'/SIPETA_LOGO.png'} alt="sipeta logo" width={40} height={40} />
              <div>
                <h2 className="text-lg text-gray-900">SIPETA</h2>
                <p className="text-xs text-gray-500">Pemerintah Daerah</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 lg:hidden"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="space-y-1">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
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
    </>
  );
}
