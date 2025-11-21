import { Home, FileText, CheckSquare, Map, BarChart3, Settings } from 'lucide-react';
import { cn } from './ui/utils';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const menuItems = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'pengajuan', label: 'Pengajuan', icon: FileText },
  { id: 'verifikasi', label: 'Verifikasi', icon: CheckSquare },
  { id: 'peta', label: 'Peta', icon: Map },
  { id: 'laporan', label: 'Laporan', icon: BarChart3 },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Map className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg text-gray-900">SPPTG Dashboard</h2>
            <p className="text-xs text-gray-500">Pemerintah Daerah</p>
          </div>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => {
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
  );
}
