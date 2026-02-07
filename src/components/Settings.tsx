import { useState } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
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
  onUpdateUser?: (
    id: number,
    data: Partial<Pick<User, 'nama' | 'nipNik' | 'email' | 'peran' | 'nomorHP' | 'status'>>
  ) => void;
  onToggleUserStatus?: (id: number) => void;
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
  onUpdateUser,
  onToggleUserStatus,
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
  const [activeTab, setActiveTab] = useState('users');
  const { hasRole } = useAuthRole();
  const isSuperadmin = hasRole('Superadmin');

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
          <h1 className="text-gray-900">Pengaturan</h1>
          <p className="text-gray-600 mt-2">
            Kelola pengguna, data referensi desa, dan kawasan non-SPPTG untuk sistem verifikasi
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border-b border-gray-200 w-full justify-start rounded-none h-auto p-0">
          <TabsTrigger
            value="users"
            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none px-6 py-3"
          >
            Pengguna
          </TabsTrigger>
          {isSuperadmin && (
            <TabsTrigger
              value="villages"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none px-6 py-3"
            >
              Desa
            </TabsTrigger>
          )}
          <TabsTrigger
            value="prohibited"
            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none px-6 py-3"
          >
            Kawasan Non‑SPPTG
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UsersTab
            users={users}
            onUpdateUsers={onUpdateUsers}
            onUpdateUser={onUpdateUser}
            onToggleUserStatus={onToggleUserStatus}
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
