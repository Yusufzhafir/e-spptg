import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProhibitedArea, ProhibitedAreaType } from '../types';
import { generateStaticMapUrl } from '@/lib/map-static-api';
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
import { useTableSort, SortableHead } from './table-sort';
import { formatDate } from '@/lib/format-date';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { CreateProhibitedAreaInput, UpdateProhibitedAreaInput } from '@/types/prohibitedAreas';

interface ProhibitedAreasTabProps {
  prohibitedAreas: ProhibitedArea[];
  // Toggle "Aktif di Validasi" and delete are still handled here via a bulk update.
  onUpdateProhibitedAreas: (areas: ProhibitedArea[]) => void;
  // Add/edit now happen on dedicated pages; these remain optional for compatibility
  // with the settings page wiring and are no longer used by this tab.
  onCreateProhibitedArea?: (area: CreateProhibitedAreaInput) => void;
  onUpdateProhibitedArea?: (id: number, data: UpdateProhibitedAreaInput) => void;
  isCreating?: boolean;
  isUpdating?: boolean;
  currentUserId?: number;
}

export function ProhibitedAreasTab({
  prohibitedAreas,
  onUpdateProhibitedAreas,
}: ProhibitedAreasTabProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [jenisFilter, setJenisFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isOverlapCheckDialogOpen, setIsOverlapCheckDialogOpen] = useState(false);
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
      const geoJson =
        typeof selectedArea.geomGeoJSON === 'string'
          ? JSON.parse(selectedArea.geomGeoJSON)
          : selectedArea.geomGeoJSON;
      if (!geoJson?.coordinates?.[0]) return null;
      const coordinates = geoJson.coordinates[0].map((coord: number[]) => ({
        latitude: coord[1],
        longitude: coord[0],
      }));
      const hexColor = selectedArea.warna?.replace('#', '');
      return generateStaticMapUrl(coordinates, {
        mapType: 'terrain',
        fillColor: hexColor,
        strokeColor: hexColor,
      });
    } catch (error) {
      console.error('Gagal memuat pratinjau peta kawasan:', error);
      return null;
    }
  }, [selectedArea]);

  // Filter areas
  const filteredAreas = prohibitedAreas.filter((area) => {
    const matchesSearch =
      !searchQuery ||
      area.namaKawasan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      area.sumberData.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesJenis = jenisFilter === 'all' || area.jenisKawasan === jenisFilter;
    const matchesStatus = statusFilter === 'all' || area.statusValidasi === statusFilter;

    return matchesSearch && matchesJenis && matchesStatus;
  });

  const {
    sorted: sortedAreas,
    sortKey,
    sortDir,
    toggleSort,
  } = useTableSort<ProhibitedArea>(filteredAreas, (area, key) => {
    switch (key) {
      case 'namaKawasan':
        return area.namaKawasan?.toLowerCase();
      case 'jenisKawasan':
        return area.jenisKawasan;
      case 'sumberData':
        return area.sumberData?.toLowerCase();
      case 'dasarHukum':
        return area.dasarHukum?.toLowerCase() ?? '';
      case 'tanggalEfektif':
        return area.tanggalEfektif ? new Date(area.tanggalEfektif).getTime() : 0;
      case 'diunggahOleh':
        return String(area.diunggahOleh ?? '');
      case 'statusValidasi':
        return area.statusValidasi;
      case 'aktifDiValidasi':
        return area.aktifDiValidasi ? 1 : 0;
      default:
        return '';
    }
  });

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

    const updatedAreas = prohibitedAreas.filter((a) => a.id !== selectedArea.id);
    onUpdateProhibitedAreas(updatedAreas);
    setIsDeleteDialogOpen(false);
    setSelectedArea(null);
    // Success toast is shown by the delete mutation's onSuccess handler.
  };

  const handleToggleActive = (area: ProhibitedArea) => {
    const nextValue = !area.aktifDiValidasi;
    // Optimistically reflect the toggle immediately; the backend update +
    // refetch (handled by the parent) will confirm it.
    setOptimisticActive((prev) => ({ ...prev, [area.id]: nextValue }));
    onUpdateProhibitedAreas(
      prohibitedAreas.map((a) =>
        a.id === area.id ? { ...a, aktifDiValidasi: nextValue } : a
      )
    );
    toast.success(
      `Kawasan ${area.aktifDiValidasi ? 'dinonaktifkan' : 'diaktifkan'} di validasi.`
    );
  };

  const handleOverlapCheck = () => {
    setIsOverlapCheckDialogOpen(true);
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

  const jenisKawasanOptions: ProhibitedAreaType[] = [
    'Hutan Lindung',
    'Tanah Pemerintah',
    'Cagar Alam',
    'Kawasan Industri',
    'Fasum/Fasos',
    'Sempadan Sungai',
    'Sempadan Pantai',
    'Kawasan Rawan Bencana',
    'Aset TNI/POLRI',
    'Lainnya',
  ];

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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <SearchableSelect
            className="w-full sm:w-[200px]"
            value={jenisFilter}
            onValueChange={setJenisFilter}
            placeholder="Semua Jenis"
            searchPlaceholder="Cari jenis..."
            options={[
              { value: 'all', label: 'Semua Jenis' },
              ...jenisKawasanOptions.map((jenis) => ({ value: jenis, label: jenis })),
            ]}
          />

          <SearchableSelect
            className="w-full sm:w-[180px]"
            value={statusFilter}
            onValueChange={setStatusFilter}
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
          <Button
            onClick={handleAddArea}
            className="bg-blue-600 hover:bg-blue-700 flex-1 lg:flex-initial"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Kawasan Non‑SPPTG
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <SortableHead label="Nama Kawasan" sortKey="namaKawasan" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHead label="Jenis" sortKey="jenisKawasan" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHead label="Sumber Data" sortKey="sumberData" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHead label="Dasar Hukum" sortKey="dasarHukum" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHead label="Tanggal Efektif" sortKey="tanggalEfektif" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHead label="Diunggah Oleh" sortKey="diunggahOleh" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHead label="Status Validasi" sortKey="statusValidasi" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHead label="Aktif di Validasi" sortKey="aktifDiValidasi" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="text-center" />
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAreas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    {searchQuery || jenisFilter !== 'all' || statusFilter !== 'all'
                      ? 'Tidak ada kawasan yang ditemukan'
                      : 'Belum ada kawasan Non‑SPPTG. Unggah KML/KMZ atau gambar polygon.'}
                  </TableCell>
                </TableRow>
              ) : (
                sortedAreas.map((area) => (
                  <TableRow key={area.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: area.warna }}
                        />
                        <span>{area.namaKawasan}</span>
                      </div>
                    </TableCell>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditArea(area)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadArea(area)}
                          title="Unduh GeoJSON"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteArea(area)}
                          title="Hapus"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
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

      {/* Overlap Check Dialog */}
      <Dialog open={isOverlapCheckDialogOpen} onOpenChange={setIsOverlapCheckDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hasil Cek Tumpang Tindih</DialogTitle>
            <DialogDescription>
              Pengajuan SPPTG yang tumpang tindih dengan kawasan non-SPPTG
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="text-orange-900">
                    <strong>Ditemukan 2 pengajuan SPPTG tumpang tindih</strong>
                  </p>
                  <p className="text-sm text-orange-700 mt-1">
                    Pengajuan berikut terindikasi tumpang tindih dengan kawasan non-SPPTG yang aktif
                  </p>
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>ID Pengajuan</TableHead>
                    <TableHead>Pemilik</TableHead>
                    <TableHead>Desa/Kecamatan</TableHead>
                    <TableHead>Luas Overlap</TableHead>
                    <TableHead>Kawasan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>2025-01-0234</TableCell>
                    <TableCell>Budi Santoso</TableCell>
                    <TableCell>Sukapura, Kejaksan</TableCell>
                    <TableCell>125 m²</TableCell>
                    <TableCell>Tanah Pemerintah</TableCell>
                    <TableCell>
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                        SKT ditolak
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Buka Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2025-01-0456</TableCell>
                    <TableCell>Ahmad Fauzi</TableCell>
                    <TableCell>Karangsari, Lemahwungkuk</TableCell>
                    <TableCell>78 m²</TableCell>
                    <TableCell>Sempadan Sungai</TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                        SKT ditinjau ulang
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Buka Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOverlapCheckDialogOpen(false)}>
              Tutup
            </Button>
            <Button
              onClick={() => {
                toast.success('Pengajuan telah ditandai terindikasi overlap');
                setIsOverlapCheckDialogOpen(false);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Tandai Pengajuan Terindikasi Overlap
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
