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

interface SettingsProps {
  users: User[];
  villages: Village[];
  prohibitedAreas: ProhibitedArea[];
  onUpdateUsers: (users: User[]) => void;
  onUpdateVillages: (villages: Village[]) => void;
  onUpdateProhibitedAreas: (areas: ProhibitedArea[]) => void;
}

export function Settings({
  users,
  villages,
  prohibitedAreas,
  onUpdateUsers,
  onUpdateVillages,
  onUpdateProhibitedAreas,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState('users');

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
          <TabsTrigger
            value="villages"
            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none px-6 py-3"
          >
            Desa
          </TabsTrigger>
          <TabsTrigger
            value="prohibited"
            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none px-6 py-3"
          >
            Kawasan Non‑SPPTG
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UsersTab users={users} onUpdateUsers={onUpdateUsers} />
        </TabsContent>

        <TabsContent value="villages" className="mt-6">
          <VillagesTab villages={villages} onUpdateVillages={onUpdateVillages} />
        </TabsContent>

        <TabsContent value="prohibited" className="mt-6">
          <ProhibitedAreasTab
            prohibitedAreas={prohibitedAreas}
            onUpdateProhibitedAreas={onUpdateProhibitedAreas}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
