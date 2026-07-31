import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Users as UsersIcon, MapPin, ShieldAlert } from 'lucide-react';

/** Segmented-control tab button: raised white "pill" when active. */
const tabTriggerClass =
  'group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-white/60 hover:text-gray-900 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm sm:px-4';

/** Record-count pill inside each tab. */
const tabCountClass =
  'rounded-full bg-gray-200/80 px-1.5 py-0.5 text-xs leading-none tabular-nums text-gray-600 transition-colors group-data-[state=active]:bg-blue-100 group-data-[state=active]:text-blue-700';
import { UsersTab } from './UsersTab';
import { VillagesTab } from './VillagesTab';
import { ProhibitedAreasTab } from './ProhibitedAreasTab';
import { User, Village, ProhibitedArea } from '../types';
import { CreateProhibitedAreaInput, UpdateProhibitedAreaInput } from '@/types/prohibitedAreas';
import { useAuthRole } from './AuthRoleProvider';

type CreateVillageInput = {
  kodeDesa: string;
  namaDesa: string;
  namaKepalaDesa: string;
  juruUkurNama: string;
  juruUkurJabatan: string;
  juruUkurInstansi?: string;
  juruUkurNomorHP: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
};

type UpdateVillageInput = Partial<CreateVillageInput>;



interface SettingsProps {
  users: User[];
  villages: Village[];
  prohibitedAreas: ProhibitedArea[];
  onUpdateUsers?: (users: User[]) => void;
  onCreateUser?: (
    data: Pick<User, 'nama' | 'nipNik' | 'email' | 'peran' | 'assignedVillageId' | 'assignedKecamatan' | 'nomorHP' | 'status'> & {
      /** Omitted/blank means the server emails an invite to set one instead. */
      password?: string;
    }
  ) => void;
  onUpdateUser?: (
    id: number,
    data: Partial<Pick<User, 'nama' | 'nipNik' | 'email' | 'peran' | 'assignedVillageId' | 'assignedKecamatan' | 'nomorHP' | 'status'>>
  ) => void;
  onToggleUserStatus?: (id: number) => void;
  onSendPasswordReset?: (id: number) => void;
  onUpdateVillages?: (villages: Village[]) => void; // Keep for backward compatibility
  onUpdateProhibitedAreas: (areas: ProhibitedArea[]) => void; // Changed to ProhibitedArea[] for local state updates
  // Village mutation callbacks
  onCreateVillage?: (data: CreateVillageInput) => void;
  onUpdateVillage?: (id: number, data: UpdateVillageInput) => void;
  onDeleteVillage?: (id: number) => void;
  // Prohibited area mutation callbacks
  onCreateProhibitedArea: (data: CreateProhibitedAreaInput) => void;
  onUpdateProhibitedArea: (id: number, data: UpdateProhibitedAreaInput) => void;
  // Loading states
  isCreatingVillage?: boolean;
  isUpdatingVillage?: boolean;
  isDeletingVillage?: boolean;
  isCreatingProhibitedArea?: boolean;
  isUpdatingProhibitedArea?: boolean;
  // Current user ID
  currentUserId?: number;
}

export function Settings({
  users,
  villages,
  prohibitedAreas,
  onUpdateUsers,
  onCreateUser,
  onUpdateUser,
  onToggleUserStatus,
  onSendPasswordReset,
  onUpdateVillages,
  onUpdateProhibitedAreas,
  onCreateVillage,
  onUpdateVillage,
  onDeleteVillage,
  onCreateProhibitedArea,
  onUpdateProhibitedArea,
  isCreatingVillage = false,
  isUpdatingVillage = false,
  isDeletingVillage = false,
  isCreatingProhibitedArea = false,
  isUpdatingProhibitedArea = false,
  currentUserId,
}: SettingsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    return tab === 'prohibited' || tab === 'villages' || tab === 'users' ? tab : 'users';
  });
  const { hasRole } = useAuthRole();
  const isSuperadmin = hasRole('Superadmin');

  // Keep ?tab= in sync so the URL is shareable and survives a refresh
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle tab state when user role changes or unauthorized tab access
  // Sync state during render to avoid cascading updates from useEffect
  if (activeTab === 'villages' && !isSuperadmin) {
    setActiveTab('users');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#" className="text-gray-600 hover:text-gray-900">
                Beranda
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Pengaturan</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-4">
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">Pengaturan</h1>
          <p className="mt-1 text-sm text-gray-600 sm:text-base">
            Kelola pengguna, data referensi desa, dan kawasan Non-SPPTG untuk sistem verifikasi.
          </p>
        </div>
      </div>

      {/* Tabs — segmented control; scrolls sideways on narrow screens instead of
          cramming the labels together. */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-100/80 p-1">
          <TabsTrigger value="users" className={tabTriggerClass}>
            <UsersIcon className="h-4 w-4" />
            <span>Pengguna</span>
            <span className={tabCountClass}>{users.length}</span>
          </TabsTrigger>
          {isSuperadmin && (
            <TabsTrigger value="villages" className={tabTriggerClass}>
              <MapPin className="h-4 w-4" />
              <span>Desa</span>
              <span className={tabCountClass}>{villages.length}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="prohibited" className={tabTriggerClass}>
            <ShieldAlert className="h-4 w-4" />
            <span className="whitespace-nowrap">Kawasan Non‑SPPTG</span>
            <span className={tabCountClass}>{prohibitedAreas.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UsersTab
            users={users}
            villages={villages}
            canManageVillageAssignment={isSuperadmin}
            onUpdateUsers={onUpdateUsers}
            onCreateUser={onCreateUser}
            onUpdateUser={onUpdateUser}
            onToggleUserStatus={onToggleUserStatus}
            onSendPasswordReset={onSendPasswordReset}
          />
        </TabsContent>

        {isSuperadmin && (
          <TabsContent value="villages" className="mt-6">
            <VillagesTab 
              villages={villages} 
              onUpdateVillages={onUpdateVillages}
              onCreateVillage={onCreateVillage}
              onUpdateVillage={onUpdateVillage}
              onDeleteVillage={onDeleteVillage}
              isCreating={isCreatingVillage}
              isUpdating={isUpdatingVillage}
              isDeleting={isDeletingVillage}
            />
          </TabsContent>
        )}

        <TabsContent value="prohibited" className="mt-6">
          <ProhibitedAreasTab
            prohibitedAreas={prohibitedAreas}
            onUpdateProhibitedAreas={onUpdateProhibitedAreas}
            onCreateProhibitedArea={onCreateProhibitedArea}
            onUpdateProhibitedArea={onUpdateProhibitedArea}
            isCreating={isCreatingProhibitedArea}
            isUpdating={isUpdatingProhibitedArea}
            currentUserId={currentUserId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
