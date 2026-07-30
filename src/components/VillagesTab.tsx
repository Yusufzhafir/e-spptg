import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Village } from '../types';
import { trpc } from '@/trpc/client';
import { StatusBadge } from './StatusBadge';
import { Eye, ExternalLink } from 'lucide-react';
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
import { useTableSort, SortableHead } from './table-sort';
import { RequiredMark } from './RequiredMark';
import { FieldError } from './FieldError';
import { createVillageSchema } from '@/lib/validation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { SearchableSelect } from './SearchableSelect';
import { WilayahSelect, WilayahValue } from './WilayahSelect';
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
import { normalizePhoneNumber } from '@/lib/phone-number';

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

interface VillagesTabProps {
  villages: Village[];
  onUpdateVillages?: (villages: Village[]) => void; // Keep for backward compatibility
  onCreateVillage?: (data: CreateVillageInput) => void;
  onUpdateVillage?: (id: number, data: UpdateVillageInput) => void;
  onDeleteVillage?: (id: number) => void;
  isCreating?: boolean;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function VillagesTab({ 
  villages, 
  onUpdateVillages,
  onCreateVillage,
  onUpdateVillage,
  onDeleteVillage,
  isCreating = false,
  isUpdating = false,
  isDeleting = false,
}: VillagesTabProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [kecamatanFilter, setKecamatanFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isSubmissionsDialogOpen, setIsSubmissionsDialogOpen] = useState(false);
  const [submissionsVillage, setSubmissionsVillage] = useState<Village | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);

  const { data: villageSubmissions, isLoading: isLoadingSubmissions } =
    trpc.submissions.list.useQuery(
      { desaId: submissionsVillage?.id ?? 0, limit: 100, offset: 0 },
      { enabled: isSubmissionsDialogOpen && submissionsVillage != null }
    );

  const openSubmissionsDialog = (village: Village) => {
    setSubmissionsVillage(village);
    setIsSubmissionsDialogOpen(true);
  };

  const goToSubmission = (submissionId: number) => {
    setIsSubmissionsDialogOpen(false);
    router.push(`/app?focus=${submissionId}`);
  };
  const [formData, setFormData] = useState<Partial<Village>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const errorClass = (field: string) => (errors[field] ? 'border-red-500' : undefined);
  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  /** Tidy "+62 812…" into 08xxxxxxxxxx once the field loses focus. */
  const normalizeJuruUkurNomorHP = (value: string) => {
    const normalized = normalizePhoneNumber(value);
    if (normalized !== value) {
      setFormData((prev) => ({ ...prev, juruUkurNomorHP: normalized }));
    }
  };

  const validateVillage = () => {
    const result = createVillageSchema.safeParse({
      kodeDesa: formData.kodeDesa ?? '',
      namaDesa: formData.namaDesa ?? '',
      namaKepalaDesa: formData.namaKepalaDesa ?? '',
      juruUkurNama: formData.juruUkurNama ?? '',
      juruUkurJabatan: formData.juruUkurJabatan ?? '',
      juruUkurInstansi: formData.juruUkurInstansi ?? undefined,
      juruUkurNomorHP: formData.juruUkurNomorHP ?? '',
      kecamatan: formData.kecamatan ?? '',
      kabupaten: formData.kabupaten ?? '',
      provinsi: formData.provinsi ?? '',
    });
    const next: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? '');
        if (field && !next[field]) next[field] = issue.message;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

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

  const {
    sorted: sortedVillages,
    sortKey,
    sortDir,
    toggleSort,
  } = useTableSort<Village>(filteredVillages, (village, key) => {
    switch (key) {
      case 'kodeDesa':
        return village.kodeDesa;
      case 'namaDesa':
        return village.namaDesa?.toLowerCase();
      case 'namaKepalaDesa':
        return village.namaKepalaDesa?.toLowerCase();
      case 'kecamatan':
        return village.kecamatan?.toLowerCase();
      case 'kabupaten':
        return village.kabupaten?.toLowerCase();
      case 'provinsi':
        return village.provinsi?.toLowerCase();
      case 'jumlahPengajuan':
        return village.jumlahPengajuan ?? 0;
      case 'updatedAt':
        return village.updatedAt ? new Date(village.updatedAt).getTime() : 0;
      default:
        return '';
    }
  }, { key: 'updatedAt', dir: 'desc' });

  const handleWilayahChange = (patch: WilayahValue) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    (Object.keys(patch) as (keyof WilayahValue)[]).forEach((field) => clearError(field));
  };

  const handleAddVillage = () => {
    setErrors({});
    setFormData({});
    setIsAddDialogOpen(true);
  };

  const handleEditVillage = (village: Village) => {
    setErrors({});
    setSelectedVillage(village);
    setFormData(village);
    setIsEditDialogOpen(true);
  };

  const handleDeleteVillage = (village: Village) => {
    setSelectedVillage(village);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveVillage = () => {
    if (!validateVillage()) {
      toast.error('Harap lengkapi field wajib yang ditandai merah');
      return;
    }

    if (onCreateVillage) {
      // Use TRPC mutation callback
      onCreateVillage({
        kodeDesa: formData.kodeDesa ?? '',
        namaDesa: formData.namaDesa ?? '',
        namaKepalaDesa: formData.namaKepalaDesa ?? '',
        juruUkurNama: formData.juruUkurNama ?? '',
        juruUkurJabatan: formData.juruUkurJabatan ?? '',
        juruUkurInstansi: formData.juruUkurInstansi || undefined,
        juruUkurNomorHP: formData.juruUkurNomorHP ?? '',
        kecamatan: formData.kecamatan ?? '',
        kabupaten: formData.kabupaten ?? '',
        provinsi: formData.provinsi ?? '',
      });
      setIsAddDialogOpen(false);
      setFormData({});
    } else if (onUpdateVillages) {
      // Fallback to old behavior for backward compatibility
      const newVillage: Village = {
        id: new Date().getTime(),
        kodeDesa: formData.kodeDesa ?? '',
        namaDesa: formData.namaDesa ?? '',
        namaKepalaDesa: formData.namaKepalaDesa ?? '',
        juruUkurNama: formData.juruUkurNama ?? '',
        juruUkurJabatan: formData.juruUkurJabatan ?? '',
        juruUkurInstansi: formData.juruUkurInstansi || undefined,
        juruUkurNomorHP: formData.juruUkurNomorHP ?? '',
        kecamatan: formData.kecamatan ?? '',
        kabupaten: formData.kabupaten ?? '',
        provinsi: formData.provinsi ?? '',
        jumlahPengajuan: 0,
      };
      onUpdateVillages([...villages, newVillage]);
      setIsAddDialogOpen(false);
      setFormData({});
      toast.success('Desa berhasil ditambahkan.');
    }
  };

  const handleUpdateVillage = () => {
    if (!selectedVillage) return;

    if (!validateVillage()) {
      toast.error('Harap lengkapi field wajib yang ditandai merah');
      return;
    }

    if (onUpdateVillage) {
      // Use TRPC mutation callback
      onUpdateVillage(selectedVillage.id, {
        kodeDesa: formData.kodeDesa ?? '',
        namaDesa: formData.namaDesa ?? '',
        namaKepalaDesa: formData.namaKepalaDesa ?? '',
        juruUkurNama: formData.juruUkurNama ?? '',
        juruUkurJabatan: formData.juruUkurJabatan ?? '',
        juruUkurInstansi: formData.juruUkurInstansi || undefined,
        juruUkurNomorHP: formData.juruUkurNomorHP ?? '',
        kecamatan: formData.kecamatan ?? '',
        kabupaten: formData.kabupaten ?? '',
        provinsi: formData.provinsi ?? '',
      });
      setIsEditDialogOpen(false);
      setSelectedVillage(null);
      setFormData({});
    } else if (onUpdateVillages) {
      // Fallback to old behavior for backward compatibility
      const updatedVillages = villages.map((v) =>
        v.id === selectedVillage.id ? { ...v, ...formData } : v
      );
      onUpdateVillages(updatedVillages);
      setIsEditDialogOpen(false);
      setSelectedVillage(null);
      setFormData({});
      toast.success('Desa berhasil diperbarui.');
    }
  };

  const confirmDelete = () => {
    if (!selectedVillage) return;

    if (onDeleteVillage) {
      // Use TRPC mutation callback
      onDeleteVillage(selectedVillage.id);
      setIsDeleteDialogOpen(false);
      setSelectedVillage(null);
    } else if (onUpdateVillages) {
      // Fallback to old behavior for backward compatibility
      const updatedVillages = villages.filter((v) => v.id !== selectedVillage.id);
      onUpdateVillages(updatedVillages);
      setIsDeleteDialogOpen(false);
      setSelectedVillage(null);
      toast.success('Desa berhasil dihapus.');
    }
  };

  const handleImportCSV = () => {
    setIsImportDialogOpen(true);
  };

  const REQUIRED_CSV_HEADERS = [
    'kode_desa',
    'nama_desa',
    'nama_kepala_desa',
    'juru_ukur_nama',
    'juru_ukur_jabatan',
    'juru_ukur_nomor_hp',
    'kecamatan',
    'kabupaten',
    'provinsi',
  ] as const;

  const HEADER_TO_FIELD: Record<string, keyof CreateVillageInput> = {
    kode_desa: 'kodeDesa',
    nama_desa: 'namaDesa',
    nama_kepala_desa: 'namaKepalaDesa',
    juru_ukur_nama: 'juruUkurNama',
    juru_ukur_jabatan: 'juruUkurJabatan',
    juru_ukur_instansi: 'juruUkurInstansi',
    juru_ukur_nomor_hp: 'juruUkurNomorHP',
    kecamatan: 'kecamatan',
    kabupaten: 'kabupaten',
    provinsi: 'provinsi',
  };

  // Minimal CSV line splitter that respects double-quoted fields.
  const splitCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map((c) => c.trim());
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    // Reset the input so re-selecting the same file re-triggers onChange.
    input.value = '';
    if (!file) return;

    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.error('Gagal membaca file. Pastikan file CSV valid.');
      return;
    }

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      toast.error('File CSV kosong atau tidak memiliki baris data.');
      return;
    }

    const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
    const missingHeaders = REQUIRED_CSV_HEADERS.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      toast.error(`Format CSV tidak sesuai. Kolom wajib hilang: ${missingHeaders.join(', ')}.`);
      return;
    }

    const parsedVillages: CreateVillageInput[] = [];
    const rowErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i]);
      const record: Record<string, string> = {};
      headers.forEach((header, idx) => {
        const field = HEADER_TO_FIELD[header];
        if (field) record[field] = cells[idx] ?? '';
      });

      const result = createVillageSchema.safeParse({
        kodeDesa: record.kodeDesa ?? '',
        namaDesa: record.namaDesa ?? '',
        namaKepalaDesa: record.namaKepalaDesa ?? '',
        juruUkurNama: record.juruUkurNama ?? '',
        juruUkurJabatan: record.juruUkurJabatan ?? '',
        juruUkurInstansi: record.juruUkurInstansi || undefined,
        juruUkurNomorHP: record.juruUkurNomorHP ?? '',
        kecamatan: record.kecamatan ?? '',
        kabupaten: record.kabupaten ?? '',
        provinsi: record.provinsi ?? '',
      });

      if (result.success) {
        parsedVillages.push(result.data as CreateVillageInput);
      } else {
        const firstIssue = result.error.issues[0];
        rowErrors.push(`Baris ${i + 1}: ${firstIssue?.message ?? 'data tidak valid'}`);
      }
    }

    if (rowErrors.length > 0) {
      toast.error(
        `Impor dibatalkan. ${rowErrors.length} baris tidak valid. ${rowErrors.slice(0, 3).join('; ')}${rowErrors.length > 3 ? '…' : ''}`
      );
      return;
    }

    if (parsedVillages.length === 0) {
      toast.error('Tidak ada data desa yang valid untuk diimpor.');
      return;
    }

    if (!onCreateVillage) {
      toast.error('Impor tidak tersedia saat ini.');
      return;
    }
    parsedVillages.forEach((village) => onCreateVillage(village));
    toast.success(`${parsedVillages.length} desa berhasil diimpor.`);
    setIsImportDialogOpen(false);
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

          <SearchableSelect
            className="w-full sm:w-[200px]"
            value={kecamatanFilter}
            onValueChange={setKecamatanFilter}
            placeholder="Semua Kecamatan"
            searchPlaceholder="Cari kecamatan..."
            options={[
              { value: 'all', label: 'Semua Kecamatan' },
              ...kecamatanOptions.map((kec) => ({ value: kec, label: kec })),
            ]}
          />
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
        <Table className="min-w-225">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <SortableHead label="Kode Desa (BPS)" sortKey="kodeDesa" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHead label="Nama Desa" sortKey="namaDesa" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHead label="Kepala Desa" sortKey="namaKepalaDesa" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHead label="Kecamatan" sortKey="kecamatan" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHead label="Kabupaten/Kota" sortKey="kabupaten" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHead label="Provinsi" sortKey="provinsi" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHead label="Jumlah Pengajuan" sortKey="jumlahPengajuan" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="text-center" />
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedVillages.length === 0 ? (
              <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  {searchQuery || kecamatanFilter !== 'all'
                    ? 'Tidak ada desa yang ditemukan'
                    : 'Belum ada data desa. Tambahkan desa terlebih dahulu.'}
                </TableCell>
              </TableRow>
            ) : (
              sortedVillages.map((village) => (
                <TableRow key={village.id}>
                  <TableCell className="text-gray-900">{village.kodeDesa}</TableCell>
                  <TableCell>{village.namaDesa}</TableCell>
                  <TableCell className="text-gray-600">{village.namaKepalaDesa || '-'}</TableCell>
                  <TableCell className="text-gray-600">{village.kecamatan}</TableCell>
                  <TableCell className="text-gray-600">{village.kabupaten}</TableCell>
                  <TableCell className="text-gray-600">{village.provinsi}</TableCell>
                  <TableCell className="text-center">
                    {village.jumlahPengajuan > 0 ? (
                      <button
                        type="button"
                        onClick={() => openSubmissionsDialog(village)}
                        title="Lihat daftar pengajuan"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        {village.jumlahPengajuan}
                      </button>
                    ) : (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 text-gray-400">
                        0
                      </span>
                    )}
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
              <Label htmlFor="kodeDesa">Kode Desa (BPS)<RequiredMark /></Label>
              <Input
                id="kodeDesa"
                value={formData.kodeDesa || ''}
                onChange={(e) => { setFormData({ ...formData, kodeDesa: e.target.value }); clearError('kodeDesa'); }}
                className={errorClass('kodeDesa')}
                placeholder="Contoh: 3201012001"
              />
              <FieldError message={errors.kodeDesa} />
            </div>

            <div>
              <Label htmlFor="namaDesa">Nama Desa<RequiredMark /></Label>
              <Input
                id="namaDesa"
                value={formData.namaDesa || ''}
                onChange={(e) => { setFormData({ ...formData, namaDesa: e.target.value }); clearError('namaDesa'); }}
                className={errorClass('namaDesa')}
                placeholder="Masukkan nama desa"
              />
              <FieldError message={errors.namaDesa} />
            </div>

            <div>
              <Label htmlFor="namaKepalaDesa">Nama Kepala Desa<RequiredMark /></Label>
              <Input
                id="namaKepalaDesa"
                value={formData.namaKepalaDesa || ''}
                onChange={(e) => { setFormData({ ...formData, namaKepalaDesa: e.target.value }); clearError('namaKepalaDesa'); }}
                className={errorClass('namaKepalaDesa')}
                placeholder="Masukkan nama kepala desa"
              />
              <FieldError message={errors.namaKepalaDesa} />
            </div>

            <WilayahSelect
              value={{
                provinsi: formData.provinsi ?? undefined,
                kabupaten: formData.kabupaten ?? undefined,
                kecamatan: formData.kecamatan ?? undefined,
              }}
              onChange={handleWilayahChange}
              errors={{
                provinsi: errors.provinsi,
                kabupaten: errors.kabupaten,
                kecamatan: errors.kecamatan,
              }}
            />

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm text-gray-900">Tim Peneliti (Juru Ukur)</h4>
              <div>
                <Label htmlFor="juruUkurNama">Nama Juru Ukur<RequiredMark /></Label>
                <Input
                  id="juruUkurNama"
                  value={formData.juruUkurNama || ''}
                  onChange={(e) => { setFormData({ ...formData, juruUkurNama: e.target.value }); clearError('juruUkurNama'); }}
                className={errorClass('juruUkurNama')}
                  placeholder="Masukkan nama juru ukur"
                />
                <FieldError message={errors.juruUkurNama} />
              </div>
              <div>
                <Label htmlFor="juruUkurJabatan">Jabatan<RequiredMark /></Label>
                <Input
                  id="juruUkurJabatan"
                  value={formData.juruUkurJabatan || ''}
                  onChange={(e) => { setFormData({ ...formData, juruUkurJabatan: e.target.value }); clearError('juruUkurJabatan'); }}
                className={errorClass('juruUkurJabatan')}
                  placeholder="Masukkan jabatan juru ukur"
                />
                <FieldError message={errors.juruUkurJabatan} />
              </div>
              <div>
                <Label htmlFor="juruUkurInstansi">Instansi</Label>
                <Input
                  id="juruUkurInstansi"
                  value={formData.juruUkurInstansi || ''}
                  onChange={(e) => setFormData({ ...formData, juruUkurInstansi: e.target.value })}
                  placeholder="Masukkan instansi (opsional)"
                />
              </div>
              <div>
                <Label htmlFor="juruUkurNomorHP">Nomor HP<RequiredMark /></Label>
                <Input
                  id="juruUkurNomorHP"
                  value={formData.juruUkurNomorHP || ''}
                  onChange={(e) => { setFormData({ ...formData, juruUkurNomorHP: e.target.value }); clearError('juruUkurNomorHP'); }}
                  onBlur={(e) => normalizeJuruUkurNomorHP(e.target.value)}
                className={errorClass('juruUkurNomorHP')}
                  placeholder="08xxxxxxxxxx, 021xxxxxxx, atau 05xxxxxxxx"
                />
                <FieldError message={errors.juruUkurNomorHP} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsAddDialogOpen(false)}
              disabled={isCreating}
            >
              Batal
            </Button>
            <Button 
              onClick={handleSaveVillage} 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isCreating}
            >
              {isCreating ? 'Menyimpan...' : 'Simpan'}
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
              <Label htmlFor="edit-kodeDesa">Kode Desa (BPS)<RequiredMark /></Label>
              <Input
                id="edit-kodeDesa"
                value={formData.kodeDesa || ''}
                onChange={(e) => { setFormData({ ...formData, kodeDesa: e.target.value }); clearError('kodeDesa'); }}
                className={errorClass('kodeDesa')}
              />
              <FieldError message={errors.kodeDesa} />
            </div>

            <div>
              <Label htmlFor="edit-namaDesa">Nama Desa<RequiredMark /></Label>
              <Input
                id="edit-namaDesa"
                value={formData.namaDesa || ''}
                onChange={(e) => { setFormData({ ...formData, namaDesa: e.target.value }); clearError('namaDesa'); }}
                className={errorClass('namaDesa')}
              />
              <FieldError message={errors.namaDesa} />
            </div>

            <div>
              <Label htmlFor="edit-namaKepalaDesa">Nama Kepala Desa<RequiredMark /></Label>
              <Input
                id="edit-namaKepalaDesa"
                value={formData.namaKepalaDesa || ''}
                onChange={(e) => { setFormData({ ...formData, namaKepalaDesa: e.target.value }); clearError('namaKepalaDesa'); }}
                className={errorClass('namaKepalaDesa')}
              />
              <FieldError message={errors.namaKepalaDesa} />
            </div>

            <WilayahSelect
              idPrefix="edit-"
              value={{
                provinsi: formData.provinsi ?? undefined,
                kabupaten: formData.kabupaten ?? undefined,
                kecamatan: formData.kecamatan ?? undefined,
              }}
              onChange={handleWilayahChange}
              errors={{
                provinsi: errors.provinsi,
                kabupaten: errors.kabupaten,
                kecamatan: errors.kecamatan,
              }}
            />

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm text-gray-900">Tim Peneliti (Juru Ukur)</h4>
              <div>
                <Label htmlFor="edit-juruUkurNama">Nama Juru Ukur<RequiredMark /></Label>
                <Input
                  id="edit-juruUkurNama"
                  value={formData.juruUkurNama || ''}
                  onChange={(e) => { setFormData({ ...formData, juruUkurNama: e.target.value }); clearError('juruUkurNama'); }}
                className={errorClass('juruUkurNama')}
                />
                <FieldError message={errors.juruUkurNama} />
              </div>
              <div>
                <Label htmlFor="edit-juruUkurJabatan">Jabatan<RequiredMark /></Label>
                <Input
                  id="edit-juruUkurJabatan"
                  value={formData.juruUkurJabatan || ''}
                  onChange={(e) => { setFormData({ ...formData, juruUkurJabatan: e.target.value }); clearError('juruUkurJabatan'); }}
                className={errorClass('juruUkurJabatan')}
                />
                <FieldError message={errors.juruUkurJabatan} />
              </div>
              <div>
                <Label htmlFor="edit-juruUkurInstansi">Instansi</Label>
                <Input
                  id="edit-juruUkurInstansi"
                  value={formData.juruUkurInstansi || ''}
                  onChange={(e) => setFormData({ ...formData, juruUkurInstansi: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-juruUkurNomorHP">Nomor HP<RequiredMark /></Label>
                <Input
                  id="edit-juruUkurNomorHP"
                  value={formData.juruUkurNomorHP || ''}
                  onChange={(e) => { setFormData({ ...formData, juruUkurNomorHP: e.target.value }); clearError('juruUkurNomorHP'); }}
                  onBlur={(e) => normalizeJuruUkurNomorHP(e.target.value)}
                className={errorClass('juruUkurNomorHP')}
                  placeholder="08xxxxxxxxxx, 021xxxxxxx, atau 05xxxxxxxx"
                />
                <FieldError message={errors.juruUkurNomorHP} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isUpdating}
            >
              Batal
            </Button>
            <Button 
              onClick={handleUpdateVillage} 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isUpdating}
            >
              {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
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
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? 'Menghapus...' : 'Hapus'}
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
              <p className="text-sm text-gray-700 mb-2">Format kolom CSV yang diperlukan (baris pertama adalah header):</p>
              <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200 block overflow-x-auto whitespace-nowrap">
                kode_desa, nama_desa, nama_kepala_desa, juru_ukur_nama, juru_ukur_jabatan, juru_ukur_instansi, juru_ukur_nomor_hp, kecamatan, kabupaten, provinsi
              </code>
              <p className="text-xs text-gray-600 mt-2">
                Contoh: 3201012001, Cibeureum, H. Ahmad, Budi Santoso, Juru Ukur, BPN, 081234567890, Sukasari, Kab. Sumedang, Jawa Barat
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Kolom <code>juru_ukur_instansi</code> opsional. Format nomor HP: 08xxx atau +62xxx.
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
                ℹ️ Setiap baris divalidasi terlebih dahulu. Jika ada baris yang formatnya tidak
                sesuai, seluruh impor dibatalkan dan tidak ada desa yang ditambahkan.
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

      {/* Village Submissions Dialog */}
      <Dialog open={isSubmissionsDialogOpen} onOpenChange={setIsSubmissionsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Daftar Pengajuan</DialogTitle>
            <DialogDescription>
              {submissionsVillage
                ? `Pengajuan SPPTG yang terkait dengan Desa ${submissionsVillage.namaDesa}.`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoadingSubmissions ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2" />
                Memuat pengajuan...
              </div>
            ) : !villageSubmissions || villageSubmissions.items.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                Tidak ada pengajuan untuk desa ini.
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <Table className="min-w-150">
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>ID</TableHead>
                      <TableHead>Pemilik</TableHead>
                      <TableHead>Status SPPTG</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {villageSubmissions.items.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-mono text-xs text-gray-600">
                          #{submission.id}
                        </TableCell>
                        <TableCell>{submission.namaPemilik}</TableCell>
                        <TableCell>
                          <StatusBadge status={submission.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => goToSubmission(submission.id)}
                            title="Lihat selengkapnya"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Lihat
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubmissionsDialogOpen(false)}>
              Tutup
            </Button>
            {submissionsVillage ? (
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setIsSubmissionsDialogOpen(false);
                  router.push(`/app?desaId=${submissionsVillage.id}`);
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Lihat Selengkapnya
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
