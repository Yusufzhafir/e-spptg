import { useState } from 'react';
import { ProhibitedArea, ProhibitedAreaType, ValidationStatus } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import {
  Search,
  Plus,
  Upload,
  Eye,
  Edit,
  Download,
  Trash2,
  MapPin,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProhibitedAreasTabProps {
  prohibitedAreas: ProhibitedArea[];
  onUpdateProhibitedAreas: (areas: ProhibitedArea[]) => void;
}

export function ProhibitedAreasTab({
  prohibitedAreas,
  onUpdateProhibitedAreas,
}: ProhibitedAreasTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [jenisFilter, setJenisFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isOverlapCheckDialogOpen, setIsOverlapCheckDialogOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<ProhibitedArea | null>(null);
  const [formData, setFormData] = useState<Partial<ProhibitedArea>>({});
  const [uploadMethod, setUploadMethod] = useState<'upload' | 'draw'>('upload');

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

  const handleAddArea = () => {
    setFormData({
      aktifDiValidasi: true,
      statusValidasi: 'Lolos',
      warna: '#3b82f6',
    });
    setUploadMethod('upload');
    setIsAddDialogOpen(true);
  };

  const handleEditArea = (area: ProhibitedArea) => {
    setSelectedArea(area);
    setFormData(area);
    setIsEditDialogOpen(true);
  };

  const handleDeleteArea = (area: ProhibitedArea) => {
    setSelectedArea(area);
    setIsDeleteDialogOpen(true);
  };

  const handlePreviewArea = (area: ProhibitedArea) => {
    setSelectedArea(area);
    setIsPreviewDialogOpen(true);
  };

  const handleSaveArea = () => {
    if (
      !formData.namaKawasan ||
      !formData.jenisKawasan ||
      !formData.sumberData ||
      !formData.tanggalEfektif
    ) {
      toast.error('Harap lengkapi semua field yang wajib diisi');
      return;
    }

    const newArea: ProhibitedArea = {
      id: new Date().getTime(),
      namaKawasan: formData.namaKawasan,
      jenisKawasan: formData.jenisKawasan as ProhibitedAreaType,
      sumberData: formData.sumberData,
      dasarHukum: formData.dasarHukum || null,
      tanggalEfektif: formData.tanggalEfektif,
      tanggalUnggah: new Date().toLocaleDateString('id-ID'),
      diunggahOleh: 0, // TODO change into user who submits
      statusValidasi: (formData.statusValidasi as ValidationStatus) || 'Lolos',
      aktifDiValidasi: formData.aktifDiValidasi ?? true,
      warna: formData.warna || '#3b82f6',
      catatan: formData.catatan || null,
      geom: null,
    };

    onUpdateProhibitedAreas([...prohibitedAreas, newArea]);
    setIsAddDialogOpen(false);
    setFormData({});
    toast.success('Kawasan Non‑SPPTG berhasil ditambahkan.');
  };

  const handleUpdateArea = () => {
    if (!selectedArea) return;

    const updatedAreas = prohibitedAreas.map((a) =>
      a.id === selectedArea.id ? { ...a, ...formData } : a
    );

    onUpdateProhibitedAreas(updatedAreas);
    setIsEditDialogOpen(false);
    setSelectedArea(null);
    setFormData({});
    toast.success('Kawasan Non-SPPTG berhasil diperbarui.');
  };

  const confirmDelete = () => {
    if (!selectedArea) return;

    const updatedAreas = prohibitedAreas.filter((a) => a.id !== selectedArea.id);
    onUpdateProhibitedAreas(updatedAreas);
    setIsDeleteDialogOpen(false);
    setSelectedArea(null);
    toast.success('Kawasan Non-SPPTG berhasil dihapus.');
  };

  const handleToggleActive = (area: ProhibitedArea) => {
    const updatedAreas = prohibitedAreas.map((a) =>
      a.id === area.id ? { ...a, aktifDiValidasi: !a.aktifDiValidasi } : a
    );
    onUpdateProhibitedAreas(updatedAreas);
    toast.success(
      `Kawasan ${area.aktifDiValidasi ? 'dinonaktifkan' : 'diaktifkan'} di validasi.`
    );
  };

  const handleOverlapCheck = () => {
    setIsOverlapCheckDialogOpen(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      toast.success(`File ${file.name} berhasil diunggah dan divalidasi.`);
    }
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

          <Select value={jenisFilter} onValueChange={setJenisFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Semua Jenis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Jenis</SelectItem>
              {jenisKawasanOptions.map((jenis) => (
                <SelectItem key={jenis} value={jenis}>
                  {jenis}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="Lolos">Lolos</SelectItem>
              <SelectItem value="Perlu Perbaikan">Perlu Perbaikan</SelectItem>
            </SelectContent>
          </Select>
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
                <TableHead>Nama Kawasan</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Sumber Data</TableHead>
                <TableHead>Dasar Hukum</TableHead>
                <TableHead>Tanggal Efektif</TableHead>
                <TableHead>Diunggah Oleh</TableHead>
                <TableHead>Status Validasi</TableHead>
                <TableHead className="text-center">Aktif di Validasi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAreas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    {searchQuery || jenisFilter !== 'all' || statusFilter !== 'all'
                      ? 'Tidak ada kawasan yang ditemukan'
                      : 'Belum ada kawasan Non‑SPPTG. Unggah KML/KMZ atau gambar polygon.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAreas.map((area) => (
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
                    <TableCell className="text-gray-600">{area.tanggalEfektif}</TableCell>
                    <TableCell className="text-gray-600">{area.diunggahOleh}</TableCell>
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
                        checked={area.aktifDiValidasi}
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
                          onClick={() => toast.success('File berhasil diunduh')}
                          title="Unduh"
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

      {/* Add Area Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Kawasan Non‑SPPTG</DialogTitle>
            <DialogDescription>
              Tambahkan kawasan yang tidak dapat diterbitkan SPPTG untuk preventive check.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={uploadMethod} onValueChange={(v) => setUploadMethod(v as "upload")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">
                <Upload className="h-4 w-4 mr-2" />
                Unggah File
              </TabsTrigger>
              <TabsTrigger value="draw">
                <MapPin className="h-4 w-4 mr-2" />
                Gambar di Peta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div>
                <Label htmlFor="kml-file">File KML/KMZ</Label>
                <Input
                  id="kml-file"
                  type="file"
                  accept=".kml,.kmz"
                  onChange={handleFileUpload}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Maks 50 MB. Geometry: Polygon/MultiPolygon. Koordinat: WGS84 (EPSG:4326)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="draw" className="space-y-4">
              <div className="bg-gray-100 rounded-lg border border-gray-300 h-64 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>Kanvas Peta Interaktif</p>
                  <p className="text-sm">Gunakan alat polygon untuk menggambar kawasan</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="namaKawasan">Nama Kawasan *</Label>
                <Input
                  id="namaKawasan"
                  value={formData.namaKawasan || ''}
                  onChange={(e) => setFormData({ ...formData, namaKawasan: e.target.value })}
                  placeholder="Contoh: Hutan Lindung Cikole"
                />
              </div>

              <div>
                <Label htmlFor="jenisKawasan">Jenis Kawasan *</Label>
                <Select
                  value={formData.jenisKawasan}
                  onValueChange={(value) =>
                    setFormData({ ...formData, jenisKawasan: value as ProhibitedAreaType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    {jenisKawasanOptions.map((jenis) => (
                      <SelectItem key={jenis} value={jenis}>
                        {jenis}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sumberData">Sumber Data *</Label>
                <Input
                  id="sumberData"
                  value={formData.sumberData || ''}
                  onChange={(e) => setFormData({ ...formData, sumberData: e.target.value })}
                  placeholder="Contoh: KLHK"
                />
              </div>

              <div>
                <Label htmlFor="dasarHukum">Dasar Hukum/No. SK</Label>
                <Input
                  id="dasarHukum"
                  value={formData.dasarHukum || ''}
                  onChange={(e) => setFormData({ ...formData, dasarHukum: e.target.value })}
                  placeholder="Contoh: SK No. 123/2020"
                />
              </div>

              <div>
                <Label htmlFor="tanggalEfektif">Tanggal Efektif *</Label>
                <Input
                  id="tanggalEfektif"
                  type="date"
                  value={formData.tanggalEfektif || ''}
                  onChange={(e) => setFormData({ ...formData, tanggalEfektif: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="warna">Warna Layer</Label>
                <div className="flex gap-2">
                  <Input
                    id="warna"
                    type="color"
                    value={formData.warna || '#3b82f6'}
                    onChange={(e) => setFormData({ ...formData, warna: e.target.value })}
                    className="h-10 w-20"
                  />
                  <Input
                    value={formData.warna || '#3b82f6'}
                    onChange={(e) => setFormData({ ...formData, warna: e.target.value })}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <Label htmlFor="catatan">Catatan</Label>
                <Textarea
                  id="catatan"
                  value={formData.catatan || ''}
                  onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                  placeholder="Catatan tambahan (opsional)"
                  rows={3}
                />
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  id="aktifDiValidasi"
                  checked={formData.aktifDiValidasi ?? true}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, aktifDiValidasi: checked })
                  }
                />
                <Label htmlFor="aktifDiValidasi" className="cursor-pointer">
                  Aktif di Validasi
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveArea} className="bg-blue-600 hover:bg-blue-700">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Area Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Kawasan Non‑SPPTG</DialogTitle>
            <DialogDescription>Perbarui informasi kawasan.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="edit-namaKawasan">Nama Kawasan *</Label>
                <Input
                  id="edit-namaKawasan"
                  value={formData.namaKawasan || ''}
                  onChange={(e) => setFormData({ ...formData, namaKawasan: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-jenisKawasan">Jenis Kawasan *</Label>
                <Select
                  value={formData.jenisKawasan}
                  onValueChange={(value) =>
                    setFormData({ ...formData, jenisKawasan: value as ProhibitedAreaType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {jenisKawasanOptions.map((jenis) => (
                      <SelectItem key={jenis} value={jenis}>
                        {jenis}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-sumberData">Sumber Data *</Label>
                <Input
                  id="edit-sumberData"
                  value={formData.sumberData || ''}
                  onChange={(e) => setFormData({ ...formData, sumberData: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-dasarHukum">Dasar Hukum/No. SK</Label>
                <Input
                  id="edit-dasarHukum"
                  value={formData.dasarHukum || ''}
                  onChange={(e) => setFormData({ ...formData, dasarHukum: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-tanggalEfektif">Tanggal Efektif *</Label>
                <Input
                  id="edit-tanggalEfektif"
                  type="date"
                  value={formData.tanggalEfektif || ''}
                  onChange={(e) => setFormData({ ...formData, tanggalEfektif: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-warna">Warna Layer</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-warna"
                    type="color"
                    value={formData.warna || '#3b82f6'}
                    onChange={(e) => setFormData({ ...formData, warna: e.target.value })}
                    className="h-10 w-20"
                  />
                  <Input
                    value={formData.warna || '#3b82f6'}
                    onChange={(e) => setFormData({ ...formData, warna: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <Label htmlFor="edit-statusValidasi">Status Validasi</Label>
                <Select
                  value={formData.statusValidasi}
                  onValueChange={(value) =>
                    setFormData({ ...formData, statusValidasi: value as ValidationStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lolos">Lolos</SelectItem>
                    <SelectItem value="Perlu Perbaikan">Perlu Perbaikan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="edit-catatan">Catatan</Label>
                <Textarea
                  id="edit-catatan"
                  value={formData.catatan || ''}
                  onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  id="edit-aktifDiValidasi"
                  checked={formData.aktifDiValidasi ?? true}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, aktifDiValidasi: checked })
                  }
                />
                <Label htmlFor="edit-aktifDiValidasi" className="cursor-pointer">
                  Aktif di Validasi
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdateArea} className="bg-blue-600 hover:bg-blue-700">
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Pratinjau Kawasan</DialogTitle>
            <DialogDescription>{selectedArea?.namaKawasan}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Map Preview */}
            <div className="bg-gray-100 rounded-lg border border-gray-300 h-96 flex items-center justify-center relative">
              <div className="text-center text-gray-500">
                <MapPin className="h-16 w-16 mx-auto mb-3 text-gray-400" />
                <p>Pratinjau Peta Kawasan</p>
                <p className="text-sm">Layer kawasan ditampilkan dengan basemap</p>
              </div>

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 border border-gray-200">
                <p className="text-xs mb-2">Legenda:</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: selectedArea?.warna, opacity: 0.6 }}
                  />
                  <span className="text-xs">{selectedArea?.jenisKawasan}</span>
                </div>
              </div>
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
                <p className="text-sm">{selectedArea?.tanggalEfektif}</p>
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
            <AlertDialogTitle>Hapus Kawasan Non‑SPPTG?</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus kawasan {selectedArea?.namaKawasan}? Data ini digunakan untuk cek tumpang
              tindih pengajuan SKT. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
