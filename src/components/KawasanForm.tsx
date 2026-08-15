'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProhibitedArea, ProhibitedAreaType, ValidationStatus } from '../types';
import { CreateProhibitedAreaInput } from '@/types/prohibitedAreas';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
import { type KawasanGeometryConflict } from '@/lib/kawasan-conflicts';
import {
  findUnusableKawasanBlocks,
  unusableKawasanBlocksMessage,
} from '@/lib/kawasan-limits';
import { geoJSONToPaths } from '@/lib/map-utils';
import {
  KAWASAN_ATTRIBUTE_LABELS,
  type KawasanAttributeSuggestion,
} from '@/lib/shapefile-attributes';
import type { KawasanBulkHandoff } from '@/lib/kawasan-bulk-import';
import {
  deleteKawasanDraft,
  kawasanDraftSaveErrorMessage,
  saveKawasanDraft,
} from '@/lib/kawasan-draft-storage';
import { trpc } from '@/trpc/client';
import { useAuthRole } from './AuthRoleProvider';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { KawasanGeometryEditor } from './KawasanGeometryEditor';
import { KawasanConflictPanel } from './KawasanConflictPanel';
import { RequiredMark } from './RequiredMark';
import { FieldError } from './FieldError';
import { SearchableSelect } from './SearchableSelect';
import { ArrowLeft, AlertTriangle, Save, Shapes } from 'lucide-react';
import { toast } from 'sonner';
import { PROHIBITED_AREA_TYPES } from '@/lib/prohibited-area-types';
import type { KawasanDraftPayload } from '@/lib/validation';
import type { GeoJSONMultiPolygon, LandPolygon } from '@/types';

const jenisKawasanOptions: readonly ProhibitedAreaType[] = PROHIBITED_AREA_TYPES;

type KawasanFormData = Partial<Omit<ProhibitedArea, 'geomGeoJSON'>> & {
  /** MultiPolygon: a kawasan may consist of several detached blocks. */
  geomGeoJSON?: GeoJSONMultiPolygon | null;
};

/** What the page needs to know beyond the kawasan itself when saving. */
export interface KawasanSubmitOptions {
  /**
   * The officer ticked "tetap lanjutkan" on a non-empty overlap result. The
   * server refuses an overlapping boundary without it, so this is a decision
   * being transmitted, not a UI detail.
   */
  abaikanTumpangTindih: boolean;
}

interface KawasanFormProps {
  mode: 'create' | 'edit';
  initialArea?: ProhibitedArea;
  /** Resuming a browser-stored draft: its local id and the form state it held. */
  initialDraftId?: string;
  initialDraft?: KawasanDraftPayload;
  isSubmitting: boolean;
  /**
   * Called once the kawasan is ready to be written. `onSaved` must be invoked
   * by the page after the mutation succeeds so the form can clear its draft —
   * a draft left behind offers a "Lanjutkan" that files the same boundary a
   * second time.
   */
  onSubmit: (
    data: CreateProhibitedAreaInput,
    options: KawasanSubmitOptions,
    onSaved: () => void
  ) => void;
  /**
   * The uploaded file turned out to hold several kawasan. Passed only by
   * Tambah Kawasan, which swaps itself for the bulk importer; without it the
   * editor loads such a file as blocks of this one kawasan, as before.
   */
  onBulkImportRequested?: (handoff: KawasanBulkHandoff) => void;
}

function buildInitialFormData(
  initialArea?: ProhibitedArea,
  initialDraft?: KawasanDraftPayload
): KawasanFormData {
  // A resumed draft is the newer state by definition — it is what the officer
  // last had on screen — so it wins over the saved kawasan it was started from.
  if (initialDraft) {
    return {
      ...initialDraft,
      dasarHukum: initialDraft.dasarHukum ?? undefined,
      catatan: initialDraft.catatan ?? null,
      warna: KAWASAN_NON_SPPTG_COLOR,
      geomGeoJSON: (initialDraft.geomGeoJSON ?? null) as KawasanFormData['geomGeoJSON'],
    };
  }
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

/**
 * Blocks of a stored geometry, so an edit screen knows how many there are
 * before the officer touches anything. Only the count and usability matter
 * here — the editor owns the authoritative list once it mounts.
 */
function blocksFromGeometry(geometry: unknown): LandPolygon[] {
  return geoJSONToPaths(geometry).map((ring, index) => ({
    id: `P-init-${index}`,
    coordinates: ring.map((point, pointIndex) => ({
      id: `C-init-${index}-${pointIndex}`,
      latitude: point.lat,
      longitude: point.lng,
    })),
  }));
}

export function KawasanForm({
  mode,
  initialArea,
  initialDraftId,
  initialDraft,
  isSubmitting,
  onSubmit,
  onBulkImportRequested,
}: KawasanFormProps) {
  const router = useRouter();
  const { user: currentUser } = useAuthRole();
  const [formData, setFormData] = useState<KawasanFormData>(() =>
    buildInitialFormData(initialArea, initialDraft)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * The kawasan's blocks, mirrored from the editor.
   *
   * The MultiPolygon alone is not enough to validate with: `polygonsToMultiPolygon`
   * has already dropped every block that had fewer than three usable vertices,
   * so a kawasan with a half-drawn block looks complete by the time it reaches
   * here. Seeded from the stored geometry so an edit or a resumed draft starts
   * with its blocks known, rather than waiting for the first user action.
   */
  const [polygons, setPolygons] = useState<LandPolygon[]>(() =>
    blocksFromGeometry(buildInitialFormData(initialArea, initialDraft).geomGeoJSON)
  );

  // Draft id, once there is one: the first "Simpan Draft" mints it and every
  // later save overwrites the same entry, rather than leaving a trail of
  // half-finished kawasan behind.
  const [draftId, setDraftId] = useState<string | undefined>(initialDraftId);

  // Overlap check state. `checkedVersion` is the boundary the result belongs to
  // — without it an acknowledgement given for one polygon would authorise
  // saving a different one. A counter rather than a hash of the geometry: a
  // kawasan runs to tens of thousands of vertices, and fingerprinting that on
  // every render is work proportional to the boundary for a question that is
  // just "did it change".
  const [conflicts, setConflicts] = useState<KawasanGeometryConflict[] | null>(null);
  const [geometryVersion, setGeometryVersion] = useState(0);
  const [checkedVersion, setCheckedVersion] = useState<number | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const isCheckStale = conflicts !== null && checkedVersion !== geometryVersion;
  const hasFreshCheck = conflicts !== null && !isCheckStale;

  /** A block exists (and one is therefore selected) — see `KawasanGeometryEditor`. */
  const hasBlocks = polygons.length > 0;

  const checkMutation = trpc.prohibitedAreas.cekGeometriTumpangTindih.useMutation();

  const errorClass = (field: string) => (errors[field] ? 'border-red-500' : undefined);
  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  /**
   * Take a new boundary from the editor and retire whatever the overlap check
   * last said: the result described the old polygon, and so did the tick box.
   */
  const handleGeometryChange = (
    geometry: GeoJSONMultiPolygon | null,
    nextPolygons: LandPolygon[]
  ) => {
    setFormData((prev) => ({ ...prev, geomGeoJSON: geometry }));
    setPolygons(nextPolygons);
    setGeometryVersion((version) => version + 1);
    setAcknowledged(false);
  };

  /**
   * Apply what an imported file's attribute table offered — to empty fields
   * only.
   *
   * Never overwriting is the whole contract: an officer who typed the nama and
   * then imported the boundary must not find their nama replaced by the file's.
   * The toast names what was filled, because a form that silently grows values
   * is worse than one that asks.
   */
  const handleAttributesDetected = (attributes: KawasanAttributeSuggestion) => {
    const filled: string[] = [];

    setFormData((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(attributes) as Array<
        [keyof KawasanAttributeSuggestion, string | undefined]
      >) {
        if (!value) continue;
        const existing = String(next[key] ?? '').trim();
        if (existing) continue;
        next[key] = value as never;
        filled.push(KAWASAN_ATTRIBUTE_LABELS[key]);
        clearError(key);
      }
      return next;
    });

    if (filled.length > 0) {
      toast.info(
        `Informasi kawasan terisi dari atribut file: ${filled.join(', ')}. Periksa dan sesuaikan bila perlu.`,
        { duration: 8000 }
      );
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!formData.namaKawasan) next.namaKawasan = 'Nama kawasan wajib diisi';
    if (!formData.jenisKawasan) next.jenisKawasan = 'Jenis kawasan wajib dipilih';
    if (!formData.sumberData) next.sumberData = 'Sumber data wajib diisi';
    if (!formData.tanggalEfektif) next.tanggalEfektif = 'Tanggal efektif wajib diisi';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** The form as a draft: everything optional, nothing validated. */
  const draftPayload = (): KawasanDraftPayload => ({
    namaKawasan: formData.namaKawasan || undefined,
    jenisKawasan: (formData.jenisKawasan as ProhibitedAreaType) || undefined,
    sumberData: formData.sumberData || undefined,
    dasarHukum: formData.dasarHukum || undefined,
    tanggalEfektif: formData.tanggalEfektif || undefined,
    statusValidasi: (formData.statusValidasi as ValidationStatus) || undefined,
    aktifDiValidasi: formData.aktifDiValidasi ?? true,
    catatan: formData.catatan ?? null,
    geomGeoJSON: formData.geomGeoJSON ?? null,
  });

  const handleSaveDraft = () => {
    if (!currentUser) {
      toast.error('Sesi tidak dikenali. Muat ulang halaman lalu coba lagi.');
      return;
    }
    try {
      const saved = saveKawasanDraft(currentUser.id, {
        id: draftId,
        editingAreaId: mode === 'edit' ? (initialArea?.id ?? null) : null,
        payload: draftPayload(),
      });
      setDraftId(saved.id);
      toast.success(
        'Draft kawasan tersimpan di browser ini. Anda bisa melanjutkannya nanti.'
      );
    } catch (error) {
      // A quota failure is real here — an SK boundary is thousands of vertices
      // — and a silent one would look like a successful save.
      toast.error(kawasanDraftSaveErrorMessage(error));
    }
  };

  /**
   * Run the check against the boundary currently drawn. Returns the rows, or
   * null when it could not run — the caller must not treat that as "clear".
   */
  const runOverlapCheck = async (): Promise<KawasanGeometryConflict[] | null> => {
    if (!formData.geomGeoJSON) {
      toast.error('Gambar atau unggah batas kawasan terlebih dahulu.');
      return null;
    }
    try {
      const result = await checkMutation.mutateAsync({
        geomGeoJSON: formData.geomGeoJSON,
        // A kawasan cannot overlap itself; without this every edit would report
        // a 100% clash with the row being edited.
        excludeAreaId: mode === 'edit' ? initialArea?.id : undefined,
      });
      setConflicts(result);
      setCheckedVersion(geometryVersion);
      // A fresh result is a fresh decision: whatever was ticked applied to the
      // previous one.
      setAcknowledged(false);
      return result;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Gagal memeriksa tumpang tindih.'
      );
      return null;
    }
  };

  const handleCheckOverlap = async () => {
    const result = await runOverlapCheck();
    if (!result) return;
    if (result.length === 0) {
      toast.success('Tidak ada tumpang tindih pada batas kawasan ini.');
    } else {
      toast.warning(`Ditemukan ${result.length} objek yang tumpang tindih.`);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error('Harap lengkapi field wajib yang ditandai merah');
      return;
    }
    if (!hasBlocks || !formData.geomGeoJSON) {
      toast.error('Harap gambar di peta atau unggah file KML/KMZ/GPX/Shapefile untuk geometry kawasan');
      return;
    }

    // Every block, not just the drawn ones. `polygonsToMultiPolygon` silently
    // skips a block under three vertices, so without this a kawasan with a
    // half-drawn block saved as a *smaller* kawasan than the one on screen —
    // and that smaller boundary is what would be enforced against pengajuan.
    const unusable = findUnusableKawasanBlocks(polygons);
    if (unusable.length > 0) {
      toast.error(unusableKawasanBlocksMessage(unusable), { duration: 10000 });
      return;
    }

    const tanggalEfektifDate = new Date(formData.tanggalEfektif ?? '');
    if (isNaN(tanggalEfektifDate.getTime())) {
      toast.error('Tanggal efektif tidak valid');
      return;
    }

    // Saving always checks. If the officer never pressed the button — or moved
    // a vertex since — the check runs here, and a clash stops this attempt so
    // the result can actually be read before it is waved through.
    const wasAcknowledged = hasFreshCheck && acknowledged;
    const result = hasFreshCheck ? conflicts! : await runOverlapCheck();
    if (result === null) return;

    if (result.length > 0 && !wasAcknowledged) {
      toast.error(
        'Batas kawasan tumpang tindih. Tinjau hasilnya lalu centang konfirmasi untuk tetap menyimpan.'
      );
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
    onSubmit(payload, { abaikanTumpangTindih: result.length > 0 }, () => {
      // The draft has become a kawasan. Cleared only once the save actually
      // succeeded — dropping it on the attempt would throw the work away
      // whenever the server refused.
      if (draftId !== undefined && currentUser) {
        try {
          deleteKawasanDraft(currentUser.id, draftId);
        } catch {
          // Nothing to do: the kawasan is saved either way, and a stale draft
          // is a nuisance, not a failure worth interrupting the officer for.
        }
      }
    });
  };

  const isBusy = isSubmitting || checkMutation.isPending;

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
        {draftId !== undefined && (
          <p className="mt-1 text-xs text-gray-500">
            Draft tersimpan di browser ini — tekan &quot;Simpan Draft&quot; untuk
            memperbarui. Draft dihapus otomatis setelah kawasan disimpan, dan
            tidak ikut berpindah ke perangkat atau browser lain.
          </p>
        )}
      </div>

      {/* Two columns on desktop: geometry on the left, attributes on the right.
          Stacks on smaller screens. items-start so the shorter panel doesn't
          stretch to match the taller one. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-lg border border-gray-200 bg-white p-4">
          <KawasanGeometryEditor
            initialGeoJSON={formData.geomGeoJSON}
            excludeAreaId={mode === 'edit' ? initialArea?.id : undefined}
            onChange={handleGeometryChange}
            onAttributesDetected={handleAttributesDetected}
            onBulkImportRequested={onBulkImportRequested}
          />
        </div>

        {/* Informasi Kawasan appears only once a Blok Kawasan exists — and one
            always is selected by then, since the editor activates the first
            block automatically. The attributes describe a boundary; asking for
            them before there is one puts the form in the wrong order, and on an
            import they are prefilled from the file's own attribute table. */}
        {!hasBlocks ? (
          <div className="lg:col-span-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <Shapes className="mx-auto mb-3 h-8 w-8 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Informasi Kawasan</h2>
            <p className="mt-1 text-sm text-gray-600">
              Tambahkan atau impor <strong>Blok Kawasan</strong> terlebih dahulu.
              Isian informasi kawasan akan muncul di sini setelah blok tersedia.
            </p>
          </div>
        ) : (
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
        )}
      </div>

      {/* Overlap check — against other kawasan and against recorded pengajuan */}
      <KawasanConflictPanel
        conflicts={conflicts}
        isChecking={checkMutation.isPending}
        isStale={isCheckStale}
        acknowledged={acknowledged}
        onAcknowledgedChange={setAcknowledged}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => router.push('/app/pengaturan/kawasan')}
          disabled={isBusy}
        >
          Batal
        </Button>
        <Button variant="outline" onClick={handleSaveDraft} disabled={isBusy}>
          <Save className="mr-2 h-4 w-4" />
          Simpan Draft
        </Button>
        <Button
          variant="outline"
          onClick={handleCheckOverlap}
          disabled={isBusy || !formData.geomGeoJSON}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          {checkMutation.isPending ? 'Memeriksa...' : 'Cek Tumpang Tindih'}
        </Button>
        <Button
          onClick={handleSubmit}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={isBusy}
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
