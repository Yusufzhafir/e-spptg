'use client';

/**
 * Bulk import of Kawasan Non-SPPTG from one geospatial file.
 *
 * A boundary handed over by KLHK or the desa is one file holding dozens of
 * polygons under a single SK. Adding them one at a time through the single-area
 * form meant re-typing the same jenis, sumber and dasar hukum for every parcel,
 * so this takes the whole file at once: the attributes are filled in once and
 * each polygon becomes its own kawasan row, named after its placemark.
 */

import { useState, type ChangeEvent } from 'react';
import { parseGeospatialFile } from '@/lib/kmz-parser';
import { coordinatesToGeoJSON } from '@/lib/map-utils';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
import { PROHIBITED_AREA_TYPES } from '@/lib/prohibited-area-types';
import { trpc } from '@/trpc/client';
import type { GeoJSONPolygon, ProhibitedAreaType, ValidationStatus } from '@/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { SearchableSelect } from './SearchableSelect';
import { RequiredMark } from './RequiredMark';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface ParsedArea {
  key: string;
  namaKawasan: string;
  pointCount: number;
  geomGeoJSON: GeoJSONPolygon;
}

interface KawasanBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful import so the table can refetch. */
  onImported?: (created: number) => void;
}

export function KawasanBulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: KawasanBulkImportDialogProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [areas, setAreas] = useState<ParsedArea[]>([]);
  const [jenisKawasan, setJenisKawasan] = useState<ProhibitedAreaType | ''>('');
  const [sumberData, setSumberData] = useState('');
  const [dasarHukum, setDasarHukum] = useState('');
  const [tanggalEfektif, setTanggalEfektif] = useState('');
  const [statusValidasi, setStatusValidasi] = useState<ValidationStatus>('Lolos');
  const [aktifDiValidasi, setAktifDiValidasi] = useState(true);

  const utils = trpc.useUtils();
  const createBulk = trpc.prohibitedAreas.createBulk.useMutation({
    onSuccess: async (result) => {
      toast.success(`${result.created} kawasan Non-SPPTG berhasil diimpor.`);
      await Promise.all([
        utils.prohibitedAreas.listPaged.invalidate(),
        utils.prohibitedAreas.list.invalidate(),
      ]);
      onImported?.(result.created);
      handleClose(false);
    },
    onError: (error) => {
      toast.error(`Gagal mengimpor kawasan: ${error.message}`);
    },
  });

  const resetForm = () => {
    setAreas([]);
    setFileName(null);
    setJenisKawasan('');
    setSumberData('');
    setDasarHukum('');
    setTanggalEfektif('');
    setStatusValidasi('Lolos');
    setAktifDiValidasi(true);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const result = await parseGeospatialFile(file);
      if (!result.success) {
        toast.error(result.error || 'Gagal memproses file geospasial');
        return;
      }

      const parsed: ParsedArea[] = [];
      result.polygons.forEach((polygon, index) => {
        const geomGeoJSON = coordinatesToGeoJSON(
          polygon.coordinates.map((coord, pointIndex) => ({
            id: `imp-${index}-${pointIndex}`,
            latitude: coord.latitude,
            longitude: coord.longitude,
          }))
        );
        if (!geomGeoJSON) return;

        parsed.push({
          key: `area-${index}`,
          // The placemark name when the file carries one — that is what the
          // people who produced the file will look for in the table.
          namaKawasan: polygon.name?.trim() || `Kawasan Impor ${index + 1}`,
          pointCount: polygon.coordinates.length,
          geomGeoJSON,
        });
      });

      if (parsed.length === 0) {
        toast.error('Tidak ada polygon yang valid dalam file ini.');
        return;
      }

      setAreas(parsed);
      setFileName(file.name);
      toast.success(`${parsed.length} polygon terbaca dari ${file.name}.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Gagal memproses file: ${error.message}`
          : 'Gagal memproses file geospasial'
      );
    } finally {
      setIsParsing(false);
      input.value = '';
    }
  };

  const handleRename = (key: string, value: string) => {
    setAreas((prev) =>
      prev.map((area) => (area.key === key ? { ...area, namaKawasan: value } : area))
    );
  };

  const handleRemove = (key: string) => {
    setAreas((prev) => prev.filter((area) => area.key !== key));
  };

  const handleSubmit = () => {
    if (areas.length === 0) {
      toast.error('Unggah file geospasial terlebih dahulu.');
      return;
    }
    if (!jenisKawasan) {
      toast.error('Jenis kawasan wajib dipilih');
      return;
    }
    if (sumberData.trim().length < 2) {
      toast.error('Sumber data wajib diisi');
      return;
    }
    const effectiveDate = new Date(tanggalEfektif);
    if (!tanggalEfektif || Number.isNaN(effectiveDate.getTime())) {
      toast.error('Tanggal efektif wajib diisi');
      return;
    }
    const unnamed = areas.find((area) => area.namaKawasan.trim().length < 2);
    if (unnamed) {
      toast.error('Setiap kawasan harus punya nama minimal 2 karakter');
      return;
    }

    createBulk.mutate({
      jenisKawasan,
      sumberData: sumberData.trim(),
      dasarHukum: dasarHukum.trim() || undefined,
      tanggalEfektif: effectiveDate,
      statusValidasi,
      aktifDiValidasi,
      // Kawasan Non-SPPTG are always red; the colour is not user-editable.
      warna: KAWASAN_NON_SPPTG_COLOR,
      catatan: null,
      areas: areas.map((area) => ({
        namaKawasan: area.namaKawasan.trim(),
        geomGeoJSON: area.geomGeoJSON,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Impor Kawasan Non-SPPTG</DialogTitle>
          <DialogDescription>
            Unggah satu file KML/KMZ/GPX berisi banyak polygon. Setiap polygon
            menjadi satu kawasan, dengan jenis dan sumber data yang sama.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="kawasan-bulk-file">File Geospasial<RequiredMark /></Label>
            <Input
              id="kawasan-bulk-file"
              type="file"
              accept=".kml,.kmz,.gpx"
              onChange={handleFile}
              disabled={isParsing || createBulk.isPending}
              className="mt-1"
            />
            {isParsing && <p className="mt-1 text-xs text-blue-600">Memproses file...</p>}
            {fileName && !isParsing && (
              <p className="mt-1 text-xs text-gray-500">
                {areas.length} polygon terbaca dari <strong>{fileName}</strong>.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bulk-jenis">Jenis Kawasan<RequiredMark /></Label>
              <SearchableSelect
                id="bulk-jenis"
                value={jenisKawasan}
                onValueChange={(value) => setJenisKawasan(value as ProhibitedAreaType)}
                placeholder="Pilih jenis"
                searchPlaceholder="Cari jenis..."
                options={PROHIBITED_AREA_TYPES.map((jenis) => ({
                  value: jenis,
                  label: jenis,
                }))}
              />
            </div>

            <div>
              <Label htmlFor="bulk-sumber">Sumber Data<RequiredMark /></Label>
              <Input
                id="bulk-sumber"
                value={sumberData}
                onChange={(e) => setSumberData(e.target.value)}
                placeholder="Contoh: KLHK"
              />
            </div>

            <div>
              <Label htmlFor="bulk-dasar">Dasar Hukum/No. SK</Label>
              <Input
                id="bulk-dasar"
                value={dasarHukum}
                onChange={(e) => setDasarHukum(e.target.value)}
                placeholder="Contoh: SK No. 123/2020"
              />
            </div>

            <div>
              <Label htmlFor="bulk-tanggal">Tanggal Efektif<RequiredMark /></Label>
              <Input
                id="bulk-tanggal"
                type="date"
                value={tanggalEfektif}
                onChange={(e) => setTanggalEfektif(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="bulk-status">Status Validasi</Label>
              <SearchableSelect
                id="bulk-status"
                value={statusValidasi}
                onValueChange={(value) => setStatusValidasi(value as ValidationStatus)}
                placeholder="Pilih status"
                searchPlaceholder="Cari status..."
                options={[
                  { value: 'Lolos', label: 'Lolos' },
                  { value: 'Perlu Perbaikan', label: 'Perlu Perbaikan' },
                ]}
              />
            </div>

            <div className="flex items-end gap-2 pb-1">
              <Switch
                id="bulk-aktif"
                checked={aktifDiValidasi}
                onCheckedChange={setAktifDiValidasi}
              />
              <Label htmlFor="bulk-aktif" className="cursor-pointer">
                Aktif di Validasi
              </Label>
            </div>
          </div>

          {areas.length > 0 && (
            <div className="space-y-2">
              <Label>Kawasan yang akan dibuat ({areas.length})</Label>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-2">
                {areas.map((area, index) => (
                  <div key={area.key} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-xs text-gray-500">{index + 1}.</span>
                    <Input
                      value={area.namaKawasan}
                      onChange={(e) => handleRename(area.key, e.target.value)}
                      className="flex-1"
                    />
                    <span className="w-16 shrink-0 text-xs text-gray-500">
                      {area.pointCount} titik
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(area.key)}
                      className="text-red-600 hover:text-red-700"
                      aria-label={`Hapus ${area.namaKawasan} dari daftar impor`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={createBulk.isPending}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={areas.length === 0 || createBulk.isPending}
          >
            <Upload className="mr-2 h-4 w-4" />
            {createBulk.isPending
              ? 'Mengimpor...'
              : `Impor ${areas.length || ''} Kawasan`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
