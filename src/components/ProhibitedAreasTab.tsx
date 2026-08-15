import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProhibitedArea, ProhibitedAreaType } from '../types';
import { generateStaticMapUrlForPolygons } from '@/lib/map-static-api';
import { geoJSONToPaths } from '@/lib/map-utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { SortableHead } from './table-sort';
import { TablePager } from './table-pagination';
import { useServerPagination, useTableUrlState } from './table-url-state';
import { useAuthRole } from './AuthRoleProvider';
import { formatDate, formatDateTime } from '@/lib/format-date';
import {
  deleteKawasanDraft,
  listKawasanDrafts,
  type KawasanDraftRecord,
} from '@/lib/kawasan-draft-storage';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
import { PROHIBITED_AREA_TYPES } from '@/lib/prohibited-area-types';
import { trpc } from '@/trpc/client';
import { SearchableSelect } from './SearchableSelect';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Badge } from './ui/badge';
import {
  Search,
  Plus,
  Eye,
  Edit,
  Download,
  Trash2,
  AlertTriangle,
  Shield,
  FileClock,
  FileUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { CreateProhibitedAreaInput, UpdateProhibitedAreaInput } from '@/types/prohibitedAreas';

/** Filters this table keeps in the URL, beside the search box. */
const AREA_FILTER_KEYS = ['jenis', 'status'] as const;

/** Columns `prohibitedAreas.listPaged` can order by — must match the router's enum. */
type AreaSortKey =
  | 'namaKawasan'
  | 'jenisKawasan'
  | 'sumberData'
  | 'dasarHukum'
  | 'tanggalEfektif'
  | 'diunggahOleh'
  | 'statusValidasi'
  | 'aktifDiValidasi'
  | 'updatedAt';

interface ProhibitedAreasTabProps {
  /**
   * Flip "Aktif di Validasi" on one kawasan. One row at a time on purpose: the
   * table only holds a page, so handing the parent a whole array to diff would
   * make every kawasan it cannot see look deleted.
   */
  onToggleAreaActive: (id: number, aktifDiValidasi: boolean) => void;
  onDeleteArea: (id: number) => void;
  // Add/edit now happen on dedicated pages; these remain optional for compatibility
  // with the settings page wiring and are no longer used by this tab.
  onCreateProhibitedArea?: (area: CreateProhibitedAreaInput) => void;
  onUpdateProhibitedArea?: (id: number, data: UpdateProhibitedAreaInput) => void;
  isCreating?: boolean;
  isUpdating?: boolean;
  currentUserId?: number;
}

export function ProhibitedAreasTab({
  onToggleAreaActive,
  onDeleteArea,
}: ProhibitedAreasTabProps) {
  const router = useRouter();
  const { user: currentUser } = useAuthRole();
  // create/update/delete are adminProcedure on the server. A Verifikator can
  // view kawasan but every mutating action would 403, so hide those controls
  // instead of letting them fill in a whole form and fail on save.
  const canManageKawasan =
    currentUser?.peran === 'Superadmin' || currentUser?.peran === 'Admin';

  // Search, filters, sort and paging are all resolved in Postgres; the table
  // never holds more than the page on screen.
  const table = useTableUrlState<AreaSortKey>(AREA_FILTER_KEYS, {
    key: 'updatedAt',
    dir: 'desc',
  });

  const {
    data: areasPage,
    isLoading,
    isFetching,
    error,
  } = trpc.prohibitedAreas.listPaged.useQuery(
    {
      search: table.appliedSearch || undefined,
      jenisKawasan: table.filters.jenis || undefined,
      statusValidasi: table.filters.status || undefined,
      sortKey: table.sortKey,
      sortDir: table.sortDir,
      limit: table.pageSize,
      offset: table.page * table.pageSize,
    },
    { placeholderData: (previous) => previous }
  );

  const pagination = useServerPagination(table, areasPage?.total ?? 0);

  // This officer's unfinished kawasan forms, held in this browser. Read after
  // mount — localStorage does not exist while the page prerenders.
  const [drafts, setDrafts] = useState<KawasanDraftRecord[]>([]);

  useEffect(() => {
    if (!canManageKawasan || !currentUser) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is unreadable during render
    setDrafts(listKawasanDrafts(currentUser.id));
  }, [canManageKawasan, currentUser]);

  const handleDeleteDraft = (id: string) => {
    if (!currentUser) return;
    try {
      deleteKawasanDraft(currentUser.id, id);
      setDrafts(listKawasanDrafts(currentUser.id));
      toast.success('Draft kawasan dihapus.');
    } catch {
      toast.error('Gagal menghapus draft kawasan dari browser ini.');
    }
  };

  const prohibitedAreas: ProhibitedArea[] = useMemo(
    () =>
      (areasPage?.items ?? []).map((a) => ({
        id: a.id,
        namaKawasan: a.namaKawasan,
        jenisKawasan: a.jenisKawasan,
        sumberData: a.sumberData,
        dasarHukum: a.dasarHukum,
        tanggalEfektif:
          typeof a.tanggalEfektif === 'string'
            ? a.tanggalEfektif
            : new Date(a.tanggalEfektif).toISOString(),
        tanggalUnggah:
          typeof a.tanggalUnggah === 'string'
            ? a.tanggalUnggah
            : new Date(a.tanggalUnggah).toISOString(),
        diunggahOleh: a.diunggahOleh,
        diunggahOlehNama: a.diunggahOlehNama ?? null,
        statusValidasi: a.statusValidasi,
        aktifDiValidasi: a.aktifDiValidasi,
        warna: a.warna,
        catatan: a.catatan,
        geomGeoJSON: a.geom as string | null,
        updatedAt: a.updatedAt ?? null,
      })),
    [areasPage]
  );

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<ProhibitedArea | null>(null);

  // Optimistic override for the "Aktif di Validasi" toggle (id -> value)
  const [optimisticActive, setOptimisticActive] = useState<Record<number, boolean>>({});

  // Drop optimistic entries once the refetched props catch up
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcile optimistic state with props
    setOptimisticActive((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const area of prohibitedAreas) {
        if (area.id in next && next[area.id] === area.aktifDiValidasi) {
          delete next[area.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [prohibitedAreas]);

  const previewMapUrl = useMemo(() => {
    if (!selectedArea?.geomGeoJSON) return null;
    try {
      // Every block of the kawasan, not just the first ring: a MultiPolygon
      // kawasan used to preview as one of its blocks with the rest missing.
      const polygons = geoJSONToPaths(selectedArea.geomGeoJSON).map((path, index) =>
        path.map((point, pointIndex) => ({
          id: `prev-${index}-${pointIndex}`,
          latitude: point.lat,
          longitude: point.lng,
        }))
      );
      if (polygons.length === 0) return null;

      const hexColor = KAWASAN_NON_SPPTG_COLOR.replace('#', '');
      return generateStaticMapUrlForPolygons(polygons, {
        mapType: 'terrain',
        fillColor: hexColor,
        strokeColor: hexColor,
      });
    } catch (error) {
      console.error('Gagal memuat pratinjau peta kawasan:', error);
      return null;
    }
  }, [selectedArea]);

  const handleAddArea = () => {
    router.push('/app/pengaturan/kawasan/tambah');
  };

  const handleEditArea = (area: ProhibitedArea) => {
    router.push(`/app/pengaturan/kawasan/${area.id}/edit`);
  };

  const handleDeleteArea = (area: ProhibitedArea) => {
    setSelectedArea(area);
    setIsDeleteDialogOpen(true);
  };

  const handlePreviewArea = (area: ProhibitedArea) => {
    setSelectedArea(area);
    setIsPreviewDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedArea) return;

    onDeleteArea(selectedArea.id);
    setIsDeleteDialogOpen(false);
    setSelectedArea(null);
    // Success toast is shown by the delete mutation's onSuccess handler.
  };

  const handleToggleActive = (area: ProhibitedArea) => {
    const nextValue = !area.aktifDiValidasi;
    // Optimistically reflect the toggle immediately; the backend update +
    // refetch (handled by the parent) will confirm it.
    setOptimisticActive((prev) => ({ ...prev, [area.id]: nextValue }));
    onToggleAreaActive(area.id, nextValue);
    toast.success(
      `Kawasan ${area.aktifDiValidasi ? 'dinonaktifkan' : 'diaktifkan'} di validasi.`
    );
  };

  // The overlap report is its own page now: it carries a map beside the table,
  // and an officer follows a row into a pengajuan and comes back to it — none of
  // which a dialog survives.
  const handleOverlapCheck = () => {
    router.push('/app/pengaturan/kawasan/tumpang-tindih');
  };

  const handleDownloadArea = (area: ProhibitedArea) => {
    if (!area.geomGeoJSON) {
      toast.error('Kawasan ini tidak memiliki data geometri untuk diunduh.');
      return;
    }
    let geometry: unknown;
    try {
      geometry = JSON.parse(area.geomGeoJSON);
    } catch {
      toast.error('Data geometri tidak valid.');
      return;
    }
    const featureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: area.id,
            namaKawasan: area.namaKawasan,
            jenisKawasan: area.jenisKawasan,
            sumberData: area.sumberData,
            dasarHukum: area.dasarHukum,
            statusValidasi: area.statusValidasi,
            warna: area.warna,
          },
          geometry,
        },
      ],
    };
    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], {
      type: 'application/geo+json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = area.namaKawasan.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'kawasan';
    link.href = url;
    link.download = `${safeName}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('File GeoJSON berhasil diunduh.');
  };

  const jenisKawasanOptions: readonly ProhibitedAreaType[] = PROHIBITED_AREA_TYPES;

  return (
    <div className="space-y-6">
      {/* Header Badge */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-green-600 mt-0.5" />
        <div>
          <p className="text-green-900">
            <strong>Preventif:</strong> Kawasan Non‑SPPTG dipakai untuk mencegah penerbitan SPPTG pada
            kawasan terlarang dan mendeteksi tumpang tindih lahan.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari nama kawasan atau sumber data…"
              value={table.search}
              onChange={(e) => table.setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <SearchableSelect
            className="w-full sm:w-[200px]"
            value={table.filters.jenis || 'all'}
            onValueChange={(value) => table.setFilter('jenis', value === 'all' ? '' : value)}
            placeholder="Semua Jenis"
            searchPlaceholder="Cari jenis..."
            options={[
              { value: 'all', label: 'Semua Jenis' },
              ...jenisKawasanOptions.map((jenis) => ({ value: jenis, label: jenis })),
            ]}
          />

          <SearchableSelect
            className="w-full sm:w-[180px]"
            value={table.filters.status || 'all'}
            onValueChange={(value) => table.setFilter('status', value === 'all' ? '' : value)}
            placeholder="Semua Status"
            searchPlaceholder="Cari status..."
            options={[
              { value: 'all', label: 'Semua Status' },
              { value: 'Lolos', label: 'Lolos' },
              { value: 'Perlu Perbaikan', label: 'Perlu Perbaikan' },
            ]}
          />
        </div>

        <div className="flex gap-2 w-full lg:w-auto">
          <Button
            variant="outline"
            onClick={handleOverlapCheck}
            className="flex-1 lg:flex-initial"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Cek Tumpang Tindih
          </Button>
          {canManageKawasan && (
            <Button
              variant="outline"
              onClick={() => router.push('/app/pengaturan/kawasan/impor')}
              className="flex-1 lg:flex-initial"
              title="Unggah satu file berisi banyak kawasan sekaligus"
            >
              <FileUp className="h-4 w-4 mr-2" />
              Impor Massal
            </Button>
          )}
          {canManageKawasan && (
            <Button
              onClick={handleAddArea}
              className="bg-blue-600 hover:bg-blue-700 flex-1 lg:flex-initial"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Kawasan Non‑SPPTG
            </Button>
          )}
        </div>
      </div>

      {/* Unfinished kawasan forms, if this officer has any in this browser.
          Tracing a Kawasan Hutan out of an SK rarely finishes in one sitting. */}
      {canManageKawasan && drafts.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-blue-900">
            <FileClock className="h-4 w-4" />
            Draft Kawasan Belum Selesai ({drafts.length})
          </p>
          {/* Said outright, because it is the one thing a browser-stored draft
              does differently from everything else in this app. */}
          <p className="mb-3 text-xs text-blue-800">
            Draft tersimpan di browser ini saja — tidak tersedia di perangkat lain
            dan hilang jika data situs dibersihkan.
          </p>
          <ul className="space-y-2">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {draft.payload?.namaKawasan?.trim() || 'Kawasan tanpa nama'}
                    {draft.editingAreaId !== null && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        (perubahan kawasan #{draft.editingAreaId})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-600">
                    {draft.payload?.jenisKawasan || 'Jenis belum dipilih'} · Disimpan{' '}
                    {formatDateTime(draft.lastSaved)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      // A draft started from an existing kawasan resumes on that
                      // kawasan's edit page — resuming it as a new kawasan would
                      // file the same boundary twice.
                      router.push(
                        draft.editingAreaId !== null
                          ? `/app/pengaturan/kawasan/${draft.editingAreaId}/edit?draft=${encodeURIComponent(draft.id)}`
                          : `/app/pengaturan/kawasan/tambah?draft=${encodeURIComponent(draft.id)}`
                      )
                    }
                  >
                    Lanjutkan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleDeleteDraft(draft.id)}
                    title="Hapus draft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-250">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <SortableHead label="Nama Kawasan" sortKey="namaKawasan" activeKey={table.sortKey} dir={table.sortDir} onSort={table.toggleSort} />
                <SortableHead label="Jenis" sortKey="jenisKawasan" activeKey={table.sortKey} dir={table.sortDir} onSort={table.toggleSort} />
                <SortableHead label="Sumber Data" sortKey="sumberData" activeKey={table.sortKey} dir={table.sortDir} onSort={table.toggleSort} />
                <SortableHead label="Dasar Hukum" sortKey="dasarHukum" activeKey={table.sortKey} dir={table.sortDir} onSort={table.toggleSort} />
                <SortableHead label="Tanggal Efektif" sortKey="tanggalEfektif" activeKey={table.sortKey} dir={table.sortDir} onSort={table.toggleSort} />
                <SortableHead label="Diunggah Oleh" sortKey="diunggahOleh" activeKey={table.sortKey} dir={table.sortDir} onSort={table.toggleSort} />
                <SortableHead label="Status Validasi" sortKey="statusValidasi" activeKey={table.sortKey} dir={table.sortDir} onSort={table.toggleSort} />
                <SortableHead label="Aktif di Validasi" sortKey="aktifDiValidasi" activeKey={table.sortKey} dir={table.sortDir} onSort={table.toggleSort} className="text-center" />
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prohibitedAreas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    {isLoading
                      ? 'Memuat kawasan…'
                      : error
                      ? error.message
                      : table.hasFilter
                      ? 'Tidak ada kawasan yang cocok dengan pencarian atau filter.'
                      : 'Belum ada kawasan Non‑SPPTG. Unggah KML/KMZ atau gambar polygon.'}
                  </TableCell>
                </TableRow>
              ) : (
                prohibitedAreas.map((area) => (
                  <TableRow key={area.id}>
                    <TableCell>{area.namaKawasan}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="whitespace-nowrap">
                        {area.jenisKawasan}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">{area.sumberData}</TableCell>
                    <TableCell className="text-gray-600">
                      {area.dasarHukum || '-'}
                    </TableCell>
                    <TableCell className="text-gray-600">{formatDate(area.tanggalEfektif)}</TableCell>
                    <TableCell className="text-gray-600">{area.diunggahOlehNama || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={area.statusValidasi === 'Lolos' ? 'default' : 'secondary'}
                        className={
                          area.statusValidasi === 'Lolos'
                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                            : 'bg-orange-100 text-orange-700 hover:bg-orange-100'
                        }
                      >
                        {area.statusValidasi}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={optimisticActive[area.id] ?? area.aktifDiValidasi}
                        onCheckedChange={() => handleToggleActive(area)}
                        disabled={!canManageKawasan}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewArea(area)}
                          title="Pratinjau"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canManageKawasan && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditArea(area)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadArea(area)}
                          title="Unduh GeoJSON"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canManageKawasan && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteArea(area)}
                            title="Hapus"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="border-t border-gray-200 px-4 py-3">
            <TablePager {...pagination} noun="kawasan" isBusy={isFetching} />
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Pratinjau Kawasan</DialogTitle>
            <DialogDescription>{selectedArea?.namaKawasan}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              {previewMapUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewMapUrl}
                  alt="Pratinjau peta kawasan"
                  className="h-96 w-full object-cover"
                />
              ) : (
                <div className="h-96 flex items-center justify-center bg-gray-50 text-gray-500 text-sm">
                  Pratinjau peta belum tersedia untuk kawasan ini.
                </div>
              )}
            </div>

            {/* Info */}
            <div className="grid grid-cols-1 gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-gray-600">Jenis Kawasan</p>
                <p className="text-sm">{selectedArea?.jenisKawasan}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Sumber Data</p>
                <p className="text-sm">{selectedArea?.sumberData}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Dasar Hukum</p>
                <p className="text-sm">{selectedArea?.dasarHukum || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Tanggal Efektif</p>
                <p className="text-sm">{formatDate(selectedArea?.tanggalEfektif)}</p>
              </div>
              {selectedArea?.catatan && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-600">Catatan</p>
                  <p className="text-sm">{selectedArea.catatan}</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kawasan Non-SPPTG?</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus kawasan {selectedArea?.namaKawasan}? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
