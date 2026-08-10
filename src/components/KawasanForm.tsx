'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProhibitedArea, ProhibitedAreaType, ValidationStatus } from '../types';
import { CreateProhibitedAreaInput } from '@/types/prohibitedAreas';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { KawasanGeometryEditor } from './KawasanGeometryEditor';
import { RequiredMark } from './RequiredMark';
import { FieldError } from './FieldError';
import { SearchableSelect } from './SearchableSelect';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { PROHIBITED_AREA_TYPES } from '@/lib/prohibited-area-types';

const jenisKawasanOptions: readonly ProhibitedAreaType[] = PROHIBITED_AREA_TYPES;

type KawasanFormData = Partial<Omit<ProhibitedArea, 'geomGeoJSON'>> & {
  geomGeoJSON?: { type: 'Polygon'; coordinates: [[[number, number]]] } | null;
};

interface KawasanFormProps {
  mode: 'create' | 'edit';
  initialArea?: ProhibitedArea;
  isSubmitting: boolean;
  onSubmit: (data: CreateProhibitedAreaInput) => void;
}

function buildInitialFormData(initialArea?: ProhibitedArea): KawasanFormData {
  if (!initialArea) {
    return { aktifDiValidasi: true, statusValidasi: 'Lolos', warna: KAWASAN_NON_SPPTG_COLOR };
  }
  let parsedGeoJSON: KawasanFormData['geomGeoJSON'] = null;
  if (initialArea.geomGeoJSON) {
    try {
      parsedGeoJSON =
        typeof initialArea.geomGeoJSON === 'string'
          ? JSON.parse(initialArea.geomGeoJSON)
          : (initialArea.geomGeoJSON as KawasanFormData['geomGeoJSON']);
    } catch {
      parsedGeoJSON = null;
    }
  }
  // Normalize tanggalEfektif to yyyy-mm-dd for the date input
  const tanggal = initialArea.tanggalEfektif
    ? String(initialArea.tanggalEfektif).slice(0, 10)
    : '';
  return { ...initialArea, tanggalEfektif: tanggal, geomGeoJSON: parsedGeoJSON };
}

export function KawasanForm({ mode, initialArea, isSubmitting, onSubmit }: KawasanFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<KawasanFormData>(() =>
    buildInitialFormData(initialArea)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const errorClass = (field: string) => (errors[field] ? 'border-red-500' : undefined);
  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const validate = () => {
    const next: Record<string, string> = {};
    if (!formData.namaKawasan) next.namaKawasan = 'Nama kawasan wajib diisi';
    if (!formData.jenisKawasan) next.jenisKawasan = 'Jenis kawasan wajib dipilih';
    if (!formData.sumberData) next.sumberData = 'Sumber data wajib diisi';
    if (!formData.tanggalEfektif) next.tanggalEfektif = 'Tanggal efektif wajib diisi';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      toast.error('Harap lengkapi field wajib yang ditandai merah');
      return;
    }
    if (!formData.geomGeoJSON) {
      toast.error('Harap gambar di peta atau unggah file KML/KMZ/GPX untuk geometry kawasan');
      return;
    }
    const tanggalEfektifDate = new Date(formData.tanggalEfektif ?? '');
    if (isNaN(tanggalEfektifDate.getTime())) {
      toast.error('Tanggal efektif tidak valid');
      return;
    }
    const payload: CreateProhibitedAreaInput = {
      namaKawasan: formData.namaKawasan ?? '',
      jenisKawasan: formData.jenisKawasan as ProhibitedAreaType,
      sumberData: formData.sumberData ?? '',
      dasarHukum: formData.dasarHukum || undefined,
      tanggalEfektif: tanggalEfektifDate,
      statusValidasi: (formData.statusValidasi as ValidationStatus) || 'Lolos',
      aktifDiValidasi: formData.aktifDiValidasi ?? true,
      // Kawasan Non-SPPTG are always red; the color is no longer user-editable.
      warna: KAWASAN_NON_SPPTG_COLOR,
      catatan: formData.catatan ?? null,
      geomGeoJSON: formData.geomGeoJSON,
    };
    onSubmit(payload);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/app/pengaturan/kawasan')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          {mode === 'create' ? 'Tambah Kawasan Non-SPPTG' : 'Edit Kawasan Non-SPPTG'}
        </h1>
        <p className="text-sm text-gray-600">
          {mode === 'create'
            ? 'Tambahkan kawasan yang tidak dapat diterbitkan SPPTG untuk preventive check.'
            : 'Perbarui informasi kawasan Non-SPPTG.'}
        </p>
      </div>

      {/* Two columns on desktop: geometry on the left, attributes on the right.
          Stacks on smaller screens. items-start so the shorter panel doesn't
          stretch to match the taller one. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-lg border border-gray-200 bg-white p-4">
          <KawasanGeometryEditor
            initialGeoJSON={formData.geomGeoJSON}
            excludeAreaId={mode === 'edit' ? initialArea?.id : undefined}
            onChange={(g) =>
              setFormData((prev) => ({ ...prev, geomGeoJSON: g as typeof prev.geomGeoJSON }))
            }
          />
        </div>

        <div className="lg:col-span-5 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Informasi Kawasan</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="namaKawasan">Nama Kawasan<RequiredMark /></Label>
              <Input
                id="namaKawasan"
                value={formData.namaKawasan || ''}
                onChange={(e) => { setFormData({ ...formData, namaKawasan: e.target.value }); clearError('namaKawasan'); }}
                className={errorClass('namaKawasan')}
                placeholder="Contoh: Kawasan Hutan Lindung Sangatta"
              />
              <FieldError message={errors.namaKawasan} />
            </div>

            <div>
              <Label htmlFor="jenisKawasan">Jenis Kawasan<RequiredMark /></Label>
              <SearchableSelect
                id="jenisKawasan"
                value={formData.jenisKawasan ?? ''}
                onValueChange={(value) => { clearError('jenisKawasan'); setFormData({ ...formData, jenisKawasan: value as ProhibitedAreaType }); }}
                placeholder="Pilih jenis"
                searchPlaceholder="Cari jenis..."
                className={errorClass('jenisKawasan')}
                options={jenisKawasanOptions.map((jenis) => ({ value: jenis, label: jenis }))}
              />
              <FieldError message={errors.jenisKawasan} />
            </div>

            <div>
              <Label htmlFor="sumberData">Sumber Data<RequiredMark /></Label>
              <Input
                id="sumberData"
                value={formData.sumberData || ''}
                onChange={(e) => { setFormData({ ...formData, sumberData: e.target.value }); clearError('sumberData'); }}
                className={errorClass('sumberData')}
                placeholder="Contoh: KLHK"
              />
              <FieldError message={errors.sumberData} />
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
              <Label htmlFor="tanggalEfektif">Tanggal Efektif<RequiredMark /></Label>
              <Input
                id="tanggalEfektif"
                type="date"
                value={formData.tanggalEfektif || ''}
                onChange={(e) => { setFormData({ ...formData, tanggalEfektif: e.target.value }); clearError('tanggalEfektif'); }}
                className={errorClass('tanggalEfektif')}
              />
              <FieldError message={errors.tanggalEfektif} />
            </div>

            <div>
              <Label htmlFor="statusValidasi">Status Validasi</Label>
              <SearchableSelect
                id="statusValidasi"
                value={formData.statusValidasi ?? 'Lolos'}
                onValueChange={(value) =>
                  setFormData({ ...formData, statusValidasi: value as ValidationStatus })
                }
                placeholder="Pilih status"
                searchPlaceholder="Cari status..."
                options={[
                  { value: 'Lolos', label: 'Lolos' },
                  { value: 'Perlu Perbaikan', label: 'Perlu Perbaikan' },
                ]}
              />
            </div>

            <div>
              <Label htmlFor="catatan">Catatan</Label>
              <Textarea
                id="catatan"
                value={formData.catatan || ''}
                onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                placeholder="Catatan tambahan (opsional)"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2 border-t pt-4">
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
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push('/app/pengaturan/kawasan')}
          disabled={isSubmitting}
        >
          Batal
        </Button>
        <Button
          onClick={handleSubmit}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Menyimpan...'
            : mode === 'create'
              ? 'Simpan'
              : 'Simpan Perubahan'}
        </Button>
      </div>
    </div>
  );
}
