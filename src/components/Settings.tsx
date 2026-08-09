import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { PengaturanSection } from './PengaturanClient';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import { Users as UsersIcon, MapPin, ShieldAlert, ScrollText } from 'lucide-react';

/** Segmented-control tab button: raised white "pill" when active. */
const tabTriggerClass =
  'group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-white/60 hover:text-gray-900 sm:px-4';

/** Active state, applied by hand now that these are links rather than tabs. */
const tabTriggerActiveClass = 'bg-white text-blue-700 shadow-sm';

/** Record-count pill inside each nav item. */
const tabCountClass =
  'rounded-full bg-gray-200/80 px-1.5 py-0.5 text-xs leading-none tabular-nums text-gray-600 transition-colors';

const tabCountActiveClass = 'bg-blue-100 text-blue-700';
import { UsersTab } from './UsersTab';
import { VillagesTab } from './VillagesTab';
import { AuditLogTab } from './AuditLogTab';
import { ProhibitedAreasTab } from './ProhibitedAreasTab';
import { User, Village } from '../types';
import { CreateProhibitedAreaInput, UpdateProhibitedAreaInput } from '@/types/prohibitedAreas';
import { useAuthRole } from './AuthRoleProvider';
import { trpc } from '@/trpc/client';
import { useMemo } from 'react';

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
  /** Which section this route renders. */
  section: PengaturanSection;
  /**
   * The full desa reference list, cached. Each table fetches its own page, but
   * the desa and kecamatan pickers need every option, not the ones that happen
   * to be on screen.
   */
  villages: Village[];
  /**
   * The server mails an invite link; no password is ever sent from here. The
   * returned promise is what UsersTab waits on before closing its dialog.
   */
  onCreateUser?: (
    data: Pick<User, 'nama' | 'nipNik' | 'email' | 'peran' | 'assignedVillageId' | 'assignedKecamatan' | 'nomorHP' | 'status'>
  ) => void | Promise<unknown>;
  onUpdateUser?: (
    id: number,
    data: Partial<Pick<User, 'nama' | 'nipNik' | 'email' | 'peran' | 'assignedVillageId' | 'assignedKecamatan' | 'nomorHP' | 'status'>>
  ) => void;
  onToggleUserStatus?: (id: number) => void;
  onSendPasswordReset?: (id: number) => void;
  /** Row-level kawasan actions — see ProhibitedAreasTab for why they are not bulk. */
  onToggleAreaActive: (id: number, aktifDiValidasi: boolean) => void;
  onDeleteArea: (id: number) => void;
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
  section,
  villages,
  onCreateUser,
  onUpdateUser,
  onToggleUserStatus,
  onSendPasswordReset,
  onToggleAreaActive,
  onDeleteArea,
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
  const { hasRole } = useAuthRole();
  const isSuperadmin = hasRole('Superadmin');

  // Which section is open is the URL's job now, not this component's state:
  // each one is its own route, so it is bookmarkable, survives a refresh, and
  // the browser's back button walks between sections.
  const activeTab = section;

  // The pills count everything, not what is on screen — each table now fetches
  // one page, so `rows.length` would read "10" forever. `limit: 0` asks for the
  // total and no rows at all; the tables' own queries do the real work.
  const { data: usersCount } = trpc.users.list.useQuery({ limit: 0, offset: 0 });
  const { data: villagesCount } = trpc.villages.listPaged.useQuery(
    { limit: 0, offset: 0 },
    { enabled: isSuperadmin }
  );
  const { data: areasCount } = trpc.prohibitedAreas.listPaged.useQuery({ limit: 0, offset: 0 });

  const kecamatanOptions = useMemo(
    () => Array.from(new Set(villages.map((v) => v.kecamatan))).sort(),
    [villages]
  );

  const sections = [
    { id: 'pengguna', href: '/app/pengaturan/pengguna', label: 'Pengguna', icon: UsersIcon, count: usersCount?.total ?? null, show: true },
    { id: 'desa', href: '/app/pengaturan/desa', label: 'Desa', icon: MapPin, count: villagesCount?.total ?? null, show: isSuperadmin },
    { id: 'kawasan', href: '/app/pengaturan/kawasan', label: 'Kawasan Non‑SPPTG', icon: ShieldAlert, count: areasCount?.total ?? null, show: true },
    { id: 'log', href: '/app/pengaturan/log', label: 'Audit Log', icon: ScrollText, count: null, show: isSuperadmin },
  ].filter((item) => item.show);

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

      {/* Section nav — the same segmented control as before, but each item is a
          link to its own route. Scrolls sideways on narrow screens instead of
          cramming the labels together. */}
      <div className="space-y-6">
        <nav
          aria-label="Bagian pengaturan"
          className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-100/80 p-1"
        >
          {sections.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(tabTriggerClass, isActive && tabTriggerActiveClass)}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{item.label}</span>
                {item.count != null && (
                  <span className={cn(tabCountClass, isActive && tabCountActiveClass)}>
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {activeTab === 'pengguna' && (
        <div className="mt-6">
          <UsersTab
            villages={villages}
            canManageVillageAssignment={isSuperadmin}
            onCreateUser={onCreateUser}
            onUpdateUser={onUpdateUser}
            onToggleUserStatus={onToggleUserStatus}
            onSendPasswordReset={onSendPasswordReset}
          />
        </div>
        )}

        {activeTab === 'desa' && isSuperadmin && (
          <div className="mt-6">
            <VillagesTab
              kecamatanOptions={kecamatanOptions}
              onCreateVillage={onCreateVillage}
              onUpdateVillage={onUpdateVillage}
              onDeleteVillage={onDeleteVillage}
              isCreating={isCreatingVillage}
              isUpdating={isUpdatingVillage}
              isDeleting={isDeletingVillage}
            />
          </div>
        )}

        {activeTab === 'kawasan' && (
          <div className="mt-6">
            <ProhibitedAreasTab
              onToggleAreaActive={onToggleAreaActive}
              onDeleteArea={onDeleteArea}
              onCreateProhibitedArea={onCreateProhibitedArea}
              onUpdateProhibitedArea={onUpdateProhibitedArea}
              isCreating={isCreatingProhibitedArea}
              isUpdating={isUpdatingProhibitedArea}
              currentUserId={currentUserId}
            />
          </div>
        )}

        {activeTab === 'log' && isSuperadmin && (
          <div className="mt-6">
            {/* Fetches its own data — the trail is paginated and filtered
                server-side, so threading it through Settings' props would mean
                loading every entry just to render one page. */}
            <AuditLogTab />
          </div>
        )}

        {/* Desa and Audit Log are Superadmin-only. This is a courtesy, not the
            control: every `audit.*` procedure is `superadminProcedure`, and the
            village mutations are `adminProcedure`. */}
        {(activeTab === 'desa' || activeTab === 'log') && !isSuperadmin && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500">
            Bagian ini hanya dapat diakses oleh Superadmin.
          </div>
        )}
      </div>
    </div>
  );
}
