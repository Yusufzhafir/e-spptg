import { useState } from 'react';
import { Village } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
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
import { Search, Plus, Edit, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface VillagesTabProps {
  villages: Village[];
  onUpdateVillages: (villages: Village[]) => void;
}

export function VillagesTab({ villages, onUpdateVillages }: VillagesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [kecamatanFilter, setKecamatanFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);
  const [formData, setFormData] = useState<Partial<Village>>({});

  // Get unique kecamatan for filter
  const kecamatanOptions = Array.from(new Set(villages.map((v) => v.kecamatan))).sort();

  // Filter villages
  const filteredVillages = villages.filter((village) => {
    const matchesSearch =
      !searchQuery ||
      village.namaDesa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      village.kodeDesa.includes(searchQuery);

    const matchesKecamatan = kecamatanFilter === 'all' || village.kecamatan === kecamatanFilter;

    return matchesSearch && matchesKecamatan;
  });

  const handleAddVillage = () => {
    setFormData({
      provinsi: 'Jawa Barat',
    });
    setIsAddDialogOpen(true);
  };

  const handleEditVillage = (village: Village) => {
    setSelectedVillage(village);
    setFormData(village);
    setIsEditDialogOpen(true);
  };

  const handleDeleteVillage = (village: Village) => {
    setSelectedVillage(village);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveVillage = () => {
    if (
      !formData.kodeDesa ||
      !formData.namaDesa ||
      !formData.kecamatan ||
      !formData.kabupaten ||
      !formData.provinsi
    ) {
      toast.error('Harap lengkapi semua field yang wajib diisi');
      return;
    }

    const newVillage: Village = {
      id: `VLG-${String(villages.length + 1).padStart(3, '0')}`,
      kodeDesa: formData.kodeDesa,
      namaDesa: formData.namaDesa,
      kecamatan: formData.kecamatan,
      kabupaten: formData.kabupaten,
      provinsi: formData.provinsi,
      jumlahPengajuan: 0,
    };

    onUpdateVillages([...villages, newVillage]);
    setIsAddDialogOpen(false);
    setFormData({});
    toast.success('Desa berhasil ditambahkan.');
  };

  const handleUpdateVillage = () => {
    if (!selectedVillage) return;

    const updatedVillages = villages.map((v) =>
      v.id === selectedVillage.id ? { ...v, ...formData } : v
    );

    onUpdateVillages(updatedVillages);
    setIsEditDialogOpen(false);
    setSelectedVillage(null);
    setFormData({});
    toast.success('Desa berhasil diperbarui.');
  };

  const confirmDelete = () => {
    if (!selectedVillage) return;

    const updatedVillages = villages.filter((v) => v.id !== selectedVillage.id);
    onUpdateVillages(updatedVillages);
    setIsDeleteDialogOpen(false);
    setSelectedVillage(null);
    toast.success('Desa berhasil dihapus.');
  };

  const handleImportCSV = () => {
    setIsImportDialogOpen(true);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Mock import success
      toast.success(`File ${file.name} berhasil diimpor. 15 desa ditambahkan.`);
      setIsImportDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari desa atau kode…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={kecamatanFilter} onValueChange={setKecamatanFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Semua Kecamatan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kecamatan</SelectItem>
              {kecamatanOptions.map((kec) => (
                <SelectItem key={kec} value={kec}>
                  {kec}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={handleImportCSV}
            className="flex-1 md:flex-initial"
          >
            <Upload className="h-4 w-4 mr-2" />
            Impor CSV
          </Button>
          <Button
            onClick={handleAddVillage}
            className="bg-blue-600 hover:bg-blue-700 flex-1 md:flex-initial"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Desa
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Kode Desa (BPS)</TableHead>
              <TableHead>Nama Desa</TableHead>
              <TableHead>Kecamatan</TableHead>
              <TableHead>Kabupaten/Kota</TableHead>
              <TableHead>Provinsi</TableHead>
              <TableHead className="text-center">Jumlah Pengajuan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVillages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {searchQuery || kecamatanFilter !== 'all'
                    ? 'Tidak ada desa yang ditemukan'
                    : 'Belum ada data desa. Tambahkan desa terlebih dahulu.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredVillages.map((village) => (
                <TableRow key={village.id}>
                  <TableCell className="text-gray-900">{village.kodeDesa}</TableCell>
                  <TableCell>{village.namaDesa}</TableCell>
                  <TableCell className="text-gray-600">{village.kecamatan}</TableCell>
                  <TableCell className="text-gray-600">{village.kabupaten}</TableCell>
                  <TableCell className="text-gray-600">{village.provinsi}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700">
                      {village.jumlahPengajuan}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditVillage(village)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteVillage(village)}
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

      {/* Add Village Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Tambah Desa</DialogTitle>
            <DialogDescription>
              Tambahkan data desa baru. Semua field wajib diisi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="kodeDesa">Kode Desa (BPS) *</Label>
              <Input
                id="kodeDesa"
                value={formData.kodeDesa || ''}
                onChange={(e) => setFormData({ ...formData, kodeDesa: e.target.value })}
                placeholder="Contoh: 3201012001"
              />
            </div>

            <div>
              <Label htmlFor="namaDesa">Nama Desa *</Label>
              <Input
                id="namaDesa"
                value={formData.namaDesa || ''}
                onChange={(e) => setFormData({ ...formData, namaDesa: e.target.value })}
                placeholder="Masukkan nama desa"
              />
            </div>

            <div>
              <Label htmlFor="kecamatan">Kecamatan *</Label>
              <Input
                id="kecamatan"
                value={formData.kecamatan || ''}
                onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
                placeholder="Masukkan nama kecamatan"
              />
            </div>

            <div>
              <Label htmlFor="kabupaten">Kabupaten/Kota *</Label>
              <Input
                id="kabupaten"
                value={formData.kabupaten || ''}
                onChange={(e) => setFormData({ ...formData, kabupaten: e.target.value })}
                placeholder="Contoh: Kab. Cirebon"
              />
            </div>

            <div>
              <Label htmlFor="provinsi">Provinsi *</Label>
              <Input
                id="provinsi"
                value={formData.provinsi || ''}
                onChange={(e) => setFormData({ ...formData, provinsi: e.target.value })}
                placeholder="Contoh: Jawa Barat"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveVillage} className="bg-blue-600 hover:bg-blue-700">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Village Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Desa</DialogTitle>
            <DialogDescription>Perbarui informasi desa.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-kodeDesa">Kode Desa (BPS) *</Label>
              <Input
                id="edit-kodeDesa"
                value={formData.kodeDesa || ''}
                onChange={(e) => setFormData({ ...formData, kodeDesa: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-namaDesa">Nama Desa *</Label>
              <Input
                id="edit-namaDesa"
                value={formData.namaDesa || ''}
                onChange={(e) => setFormData({ ...formData, namaDesa: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-kecamatan">Kecamatan *</Label>
              <Input
                id="edit-kecamatan"
                value={formData.kecamatan || ''}
                onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-kabupaten">Kabupaten/Kota *</Label>
              <Input
                id="edit-kabupaten"
                value={formData.kabupaten || ''}
                onChange={(e) => setFormData({ ...formData, kabupaten: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-provinsi">Provinsi *</Label>
              <Input
                id="edit-provinsi"
                value={formData.provinsi || ''}
                onChange={(e) => setFormData({ ...formData, provinsi: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdateVillage} className="bg-blue-600 hover:bg-blue-700">
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Desa?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedVillage && selectedVillage.jumlahPengajuan > 0
                ? `Desa ${selectedVillage.namaDesa} terkait dengan ${selectedVillage.jumlahPengajuan} pengajuan. Menghapus desa akan mempertahankan pengajuan tetapi kehilangan referensi desa. Lanjutkan?`
                : `Hapus desa ${selectedVillage?.namaDesa}? Tindakan ini tidak dapat dibatalkan.`}
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

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Impor Data Desa dari CSV</DialogTitle>
            <DialogDescription>
              Unggah file CSV dengan format yang sesuai untuk mengimpor data desa secara massal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">Format kolom CSV yang diperlukan:</p>
              <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200 block">
                kode_desa, nama_desa, kecamatan, kabupaten, provinsi
              </code>
              <p className="text-xs text-gray-600 mt-2">
                Contoh: 3201012001, Cibeureum, Sukasari, Kab. Sumedang, Jawa Barat
              </p>
            </div>

            <div>
              <Label htmlFor="csv-file">Pilih File CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileImport}
                className="mt-2"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                ℹ️ Sistem akan memvalidasi duplikat kode desa dan menampilkan pratinjau sebelum
                konfirmasi impor.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
