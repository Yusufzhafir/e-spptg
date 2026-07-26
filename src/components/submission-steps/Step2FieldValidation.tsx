"use client";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import {
  SubmissionDraft,
  BoundaryWitness,
  GeographicCoordinate,
  BoundaryDirection,
  CoordinateSystem,
} from '../../types';
import { trpc } from '@/trpc/client';
import { DrawingMap, type ReferencePolygon } from '../maps/DrawingMap';
import { geoJSONToPaths } from '@/lib/map-utils';
import { overlapJenisBadgeClassName } from '@/lib/overlap-results';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
import { parseKMLFile } from '@/lib/kmz-parser';
import {
  coordinatesNeedIdNormalization,
  normalizeCoordinateIds,
} from '@/lib/coordinate-ids';
import { createCoordinateRowMatcher } from '@/lib/coordinate-row-match';
import {
  parseUtmInputStrings,
  toLatLonFromUtm,
  toUtmFromLatLon,
} from '@/lib/utm-conversion';

import { Label } from '../ui/label';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Plus, Trash2, MapPin, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FileUploadField } from '@/components/FileUploadField';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Define UTM type for local state/handling
interface LocalUTMCoordinate {
  id?: string;
  zone: string;
  hemisphere: 'N' | 'S';
  easting: string;
  northing: string;
}

type UTMEditableField = 'zone' | 'easting' | 'northing';

interface EditingUtmField {
  id?: string;
  index: number;
  field: UTMEditableField;
}

interface Step2Props {
  draft: SubmissionDraft;
  onUpdateDraft: (updates: Partial<SubmissionDraft>) => void;
  onPersistDraftPatch: (
    updates: Partial<SubmissionDraft>,
    options?: { silent?: boolean }
  ) => Promise<void>;
  errors?: Record<string, string>;
}

type NewWitnessWithUsage = {
  nama?: string;
  sisi?: BoundaryDirection;
  penggunaanLahanBatas?: string;
};

function formatUtmValue(value: number): string {
  return value.toFixed(2);
}

function hasValidPolygonCoordinates(coordinates: GeographicCoordinate[]): boolean {
  const validCoordinates = coordinates.filter(
    (coord) => {
      const latitude = Number(coord.latitude);
      const longitude = Number(coord.longitude);

      return (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      );
    }
  );

  return validCoordinates.length >= 3;
}

export function Step2FieldValidation({
  draft,
  onUpdateDraft,
  onPersistDraftPatch,
  errors = {},
}: Step2Props) {
  const [isOverlapDialogOpen, setIsOverlapDialogOpen] = useState(false);
  const [isParsingKml, setIsParsingKml] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(() =>
    hasValidPolygonCoordinates(draft.coordinatesGeografis) ? 1 : 0
  );
  const [newWitness, setNewWitness] = useState<NewWitnessWithUsage>({
    nama: '',
    sisi: '' as BoundaryDirection,
    penggunaanLahanBatas: '',
  });
  
  // Local state for UTM coordinates to prevent rounding issues during editing
  // We sync this with draft.coordinatesGeografis whenever draft changes or user edits
  const [utmCoordinates, setUtmCoordinates] = useState<LocalUTMCoordinate[]>([]);
  const [editingUtmField, setEditingUtmField] = useState<EditingUtmField | null>(null);

  // Initialize coordinate system from draft or default to geografis
  const coordinateSystem = draft.coordinateSystem || 'geografis';

  useEffect(() => {
    if (!coordinatesNeedIdNormalization(draft.coordinatesGeografis)) {
      return;
    }

    onUpdateDraft({
      coordinatesGeografis: normalizeCoordinateIds(draft.coordinatesGeografis),
    });
  }, [draft.coordinatesGeografis, onUpdateDraft]);

  const toLocalUtmCoordinate = useCallback((geo: GeographicCoordinate): LocalUTMCoordinate => {
    const converted = toUtmFromLatLon(geo.latitude, geo.longitude);

    return {
      id: geo.id,
      zone: converted.zone.toString(),
      hemisphere: converted.hemisphere,
      easting: formatUtmValue(converted.easting),
      northing: formatUtmValue(converted.northing),
    };
  }, []);

  // Sync UTM local state when switching to UTM mode or when draft coordinates change externally (e.g. map draw)
  useEffect(() => {
    if (coordinateSystem === 'utm' && !editingUtmField) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcile local UTM state with external draft changes
      setUtmCoordinates(draft.coordinatesGeografis.map(toLocalUtmCoordinate));
    }
  }, [draft.coordinatesGeografis, coordinateSystem, toLocalUtmCoordinate, editingUtmField]);

  const handleSystemChange = (value: CoordinateSystem) => {
    onUpdateDraft({ coordinateSystem: value });
  };

  const triggerMapRecenter = useCallback(() => {
    setRecenterSignal((value) => value + 1);
  }, []);

  const handleAddWitness = () => {
    if (!newWitness.nama) {
      toast.error('Nama saksi harus diisi');
      return;
    }

    if (!newWitness.sisi) {
      toast.error('Sisi batas harus dipilih');
      return;
    }

    if (!newWitness.penggunaanLahanBatas?.trim()) {
      toast.error('Penggunaan batas lahan harus diisi');
      return;
    }

    const witness: BoundaryWitness = {
      id: `W-${Date.now()}`,
      nama: newWitness.nama.trim(),
      sisi: newWitness.sisi,
      penggunaanLahanBatas: newWitness.penggunaanLahanBatas.trim(),
    };

    onUpdateDraft({ saksiList: [...draft.saksiList, witness] });
    setNewWitness({
      nama: '',
      sisi: '' as BoundaryDirection,
      penggunaanLahanBatas: '',
    });
    toast.success('Saksi berhasil ditambahkan');
  };

  const handleRemoveWitness = (id: string) => {
    onUpdateDraft({ saksiList: draft.saksiList.filter((w) => w.id !== id) });
    toast.info('Saksi dihapus');
  };

  const handleAddCoordinate = () => {
    const id = `C-${Date.now()}`;
    const newCoord: GeographicCoordinate = {
      id,
      latitude: 0,
      longitude: 0,
    };
    
    // Add to draft
    onUpdateDraft({
      coordinatesGeografis: [...draft.coordinatesGeografis, newCoord],
    });
  };

  const handleUpdateCoordinate = (
    id: string | undefined,
    index: number,
    field: 'latitude' | 'longitude',
    value: number
  ) => {
    const matcher = createCoordinateRowMatcher(draft.coordinatesGeografis, id, index);
    const updated = draft.coordinatesGeografis.map((coord, coordIndex) =>
      matcher(coord, coordIndex) ? { ...coord, [field]: value } : coord
    );
    onUpdateDraft({ coordinatesGeografis: updated });
  };

  const handleGeographicCoordinateBlur = () => {
    triggerMapRecenter();
  };

  const handleGeographicCoordinateKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  const resetUtmRowFromDraft = useCallback(
    (id: string | undefined, index: number) => {
      const draftMatcher = createCoordinateRowMatcher(draft.coordinatesGeografis, id, index);
      const geoCoord = draft.coordinatesGeografis.find((coord, coordIndex) =>
        draftMatcher(coord, coordIndex)
      );
      if (!geoCoord) return;

      const resetValue = toLocalUtmCoordinate(geoCoord);
      setUtmCoordinates((prev) => {
        const utmMatcher = createCoordinateRowMatcher(prev, id, index);
        return prev.map((coord, coordIndex) =>
          utmMatcher(coord, coordIndex) ? resetValue : coord
        );
      });
    },
    [draft.coordinatesGeografis, toLocalUtmCoordinate]
  );

  const commitUtmCoordinate = useCallback(
    (id: string | undefined, index: number, override?: LocalUTMCoordinate): boolean => {
      const utmMatcher = createCoordinateRowMatcher(utmCoordinates, id, index);
      const localRow =
        override ??
        utmCoordinates.find((coord, coordIndex) =>
          utmMatcher(coord, coordIndex)
        );
      if (!localRow) return false;

      const parsed = parseUtmInputStrings(localRow);
      if (!parsed) {
        toast.error('Koordinat UTM tidak valid. Periksa zone, easting, dan northing.');
        resetUtmRowFromDraft(id, index);
        return false;
      }

      const latLon = toLatLonFromUtm(parsed);
      if (!latLon) {
        toast.error('Gagal mengonversi koordinat UTM. Periksa nilai yang dimasukkan.');
        resetUtmRowFromDraft(id, index);
        return false;
      }

      const draftMatcher = createCoordinateRowMatcher(draft.coordinatesGeografis, id, index);
      const updatedGeo = draft.coordinatesGeografis.map((coord, coordIndex) =>
        draftMatcher(coord, coordIndex)
          ? { ...coord, latitude: latLon.latitude, longitude: latLon.longitude }
          : coord
      );
      onUpdateDraft({ coordinatesGeografis: updatedGeo });
      return true;
    },
    [draft.coordinatesGeografis, onUpdateDraft, resetUtmRowFromDraft, utmCoordinates]
  );

  const getUtmRow = useCallback(
    (id: string | undefined, index: number) => {
      const matcher = createCoordinateRowMatcher(utmCoordinates, id, index);
      return utmCoordinates.find((coord, coordIndex) => matcher(coord, coordIndex));
    },
    [utmCoordinates]
  );

  const handleUpdateUTMInput = (
    id: string | undefined,
    index: number,
    field: UTMEditableField,
    value: string
  ) => {
    setUtmCoordinates((prev) => {
      const matcher = createCoordinateRowMatcher(prev, id, index);
      return prev.map((coord, coordIndex) =>
        matcher(coord, coordIndex) ? { ...coord, [field]: value } : coord
      );
    });
  };

  const handleHemisphereChange = (id: string | undefined, index: number, hemisphere: 'N' | 'S') => {
    const currentRow = getUtmRow(id, index);
    if (!currentRow) return;

    const nextRow: LocalUTMCoordinate = { ...currentRow, hemisphere };

    setUtmCoordinates((prev) => {
      const matcher = createCoordinateRowMatcher(prev, id, index);
      return prev.map((coord, coordIndex) => (matcher(coord, coordIndex) ? nextRow : coord));
    });

    const didCommit = commitUtmCoordinate(id, index, nextRow);
    if (didCommit) {
      triggerMapRecenter();
    }
  };

  const handleUtmBlur = (
    id: string | undefined,
    index: number,
    field: UTMEditableField,
    value: string
  ) => {
    const currentRow = getUtmRow(id, index);
    if (!currentRow) return;

    const nextRow: LocalUTMCoordinate = { ...currentRow, [field]: value };

    setUtmCoordinates((prev) => {
      const matcher = createCoordinateRowMatcher(prev, id, index);
      return prev.map((coord, coordIndex) => (matcher(coord, coordIndex) ? nextRow : coord));
    });

    setEditingUtmField(null);
    const didCommit = commitUtmCoordinate(id, index, nextRow);
    if (didCommit) {
      triggerMapRecenter();
    }
  };

  const handleUtmKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  const handleRemoveCoordinate = (id: string | undefined, index: number) => {
    const matcher = createCoordinateRowMatcher(draft.coordinatesGeografis, id, index);
    onUpdateDraft({
      coordinatesGeografis: draft.coordinatesGeografis.filter(
        (coord, coordIndex) => !matcher(coord, coordIndex)
      ),
    });
  };

  const normalizeImportedCoordinates = (
    coordinates: Array<{ latitude: number; longitude: number }>
  ): GeographicCoordinate[] => {
    const sanitized = coordinates.filter(
      (coord) => Number.isFinite(coord.latitude) && Number.isFinite(coord.longitude)
    );

    if (sanitized.length >= 2) {
      const first = sanitized[0];
      const last = sanitized[sanitized.length - 1];
      if (first.latitude === last.latitude && first.longitude === last.longitude) {
        sanitized.pop();
      }
    }

    const importId = Date.now();
    return sanitized.map((coord, index) => ({
      id: `C-${importId}-${index}-${crypto.randomUUID().slice(0, 8)}`,
      latitude: coord.latitude,
      longitude: coord.longitude,
    }));
  };

  const handleKmlUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.kml')) {
      toast.error('Format file tidak didukung. Harap unggah file .kml');
      input.value = '';
      return;
    }

    setIsParsingKml(true);
    try {
      const result = await parseKMLFile(file);

      if (!result.success) {
        toast.error(result.error || 'Gagal memproses file KML');
        return;
      }

      const normalizedCoordinates = normalizeImportedCoordinates(result.coordinates);
      if (normalizedCoordinates.length < 3) {
        toast.error('File KML harus berisi minimal 3 titik koordinat');
        return;
      }

      onUpdateDraft({ coordinatesGeografis: normalizedCoordinates });
      triggerMapRecenter();
      toast.success(
        `File KML berhasil diimpor. ${normalizedCoordinates.length} titik koordinat dimuat.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Gagal memproses file KML: ${error.message}`
          : 'Gagal memproses file KML'
      );
    } finally {
      setIsParsingKml(false);
      input.value = '';
    }
  };

  const calculateArea = () => {
    // Simplified area calculation (Shoelace formula)
    const coords = draft.coordinatesGeografis;
    if (coords.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      area += coords[i].longitude * coords[j].latitude;
      area -= coords[j].longitude * coords[i].latitude;
    }
    area = Math.abs(area / 2);

    // Convert to approximate m² (very rough estimate)
    const areaM2 = area * 111000 * 111000;
    return Math.round(areaM2);
  };

  const checkOverlapsMutation = trpc.submissions.checkOverlapsFromCoordinates.useMutation({
    onSuccess: (overlaps) => {
      onUpdateDraft({ 
        overlapResults: overlaps.map((o) => ({
          kawasanId: o.kawasanId,
          namaKawasan: o.namaKawasan,
          jenisKawasan: o.jenisKawasan,
          sumber: o.sumber,
          luasOverlap: o.luasOverlap,
          percentageOverlap: o.percentageOverlap,
        }))
      });
      setIsOverlapDialogOpen(true);
    },
    onError: (error) => {
      toast.error(`Gagal mengecek overlap: ${error.message}`);
    },
  });

  // Existing polygons to display as read-only reference behind the drawing:
  // Non-SPPTG prohibited areas + already-recorded SPPTG (terdaftar/terdata).
  const { data: prohibitedAreasData } = trpc.prohibitedAreas.list.useQuery({
    limit: 500,
    offset: 0,
  });
  const { data: existingSubmissionsData } = trpc.submissions.list.useQuery({
    limit: 500,
    offset: 0,
  });

  const referencePolygons = useMemo<ReferencePolygon[]>(() => {
    const result: ReferencePolygon[] = [];

    // Kawasan Non-SPPTG (prohibited areas)
    const areas = (prohibitedAreasData ?? []) as Array<{
      id: number;
      namaKawasan: string;
      warna?: string | null;
      geom?: unknown;
    }>;
    areas.forEach((area) => {
      const color = KAWASAN_NON_SPPTG_COLOR;
      geoJSONToPaths(area.geom).forEach((path, i) => {
        result.push({
          id: `kawasan-${area.id}-${i}`,
          path,
          strokeColor: color,
          fillColor: color,
          label: `Non-SPPTG: ${area.namaKawasan}`,
        });
      });
    });

    // Existing SPPTG (terdaftar = green, terdata = blue)
    const submissionItems = (existingSubmissionsData?.items ?? []) as Array<{
      id: number;
      namaPemilik: string;
      status: string;
      isValid?: boolean;
      geoJSON?: unknown;
    }>;
    submissionItems.forEach((sub) => {
      if (sub.status !== 'SPPTG terdaftar' && sub.status !== 'SPPTG terdata') {
        return;
      }
      // Hide submissions marked invalid — only valid data is shown on the map.
      if (sub.isValid === false) {
        return;
      }
      const color = sub.status === 'SPPTG terdaftar' ? '#22c55e' : '#3b82f6';
      geoJSONToPaths(sub.geoJSON).forEach((path, i) => {
        result.push({
          id: `spptg-${sub.id}-${i}`,
          path,
          strokeColor: color,
          fillColor: color,
          label: `${sub.status}: ${sub.namaPemilik}`,
        });
      });
    });

    return result;
  }, [prohibitedAreasData, existingSubmissionsData]);

  const handleCheckOverlap = () => {
    if (draft.coordinatesGeografis.length < 3) {
      toast.error('Minimal 3 titik koordinat diperlukan');
      return;
    }

    checkOverlapsMutation.mutate({
      coordinates: draft.coordinatesGeografis.map((c) => ({
        latitude: c.latitude,
        longitude: c.longitude,
      })),
    });
  };

  const luas = calculateArea();

  // Update luasLahan when coordinates change
  useEffect(() => {
    if (draft.coordinatesGeografis.length >= 3) {
      const calculatedArea = calculateArea();
      if (calculatedArea !== draft.luasLahan) {
        onUpdateDraft({ luasLahan: calculatedArea });
      }
    }
  }, [draft.coordinatesGeografis, calculateArea, onUpdateDraft, draft.luasLahan]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-2">Validasi Lapangan</h2>
        <p className="text-gray-600">
          Isi data tim peneliti, saksi batas, dan koordinat lahan hasil survey lapangan.
        </p>
      </div>

      {/* Research Team (read-only from village settings) */}
      <div className="space-y-4">
        <h3 className="text-gray-900">Tim Peneliti (Juru Ukur)</h3>
        {draft.juruUkur ? (
          <div className="max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div>
                <p className="text-xs text-gray-600">Nama</p>
                <p className="text-sm text-gray-900">{draft.juruUkur.nama}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Jabatan</p>
                <p className="text-sm text-gray-900">{draft.juruUkur.jabatan}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Instansi</p>
                <p className="text-sm text-gray-900">{draft.juruUkur.instansi || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Nomor HP</p>
                <p className="text-sm text-gray-900">{draft.juruUkur.nomorHP}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Pilih desa untuk memuat data tim peneliti dari pengaturan.
          </p>
        )}
      </div>

      {/* Boundary Witnesses */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h3 className="text-gray-900">
          Saksi Batas Lahan <span className="text-red-600">*</span>
        </h3>
        {errors.saksiList && (
          <p className="text-xs text-red-600">{errors.saksiList}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_1fr_auto] gap-2">
          <Input
            placeholder="Nama saksi"
            value={newWitness.nama}
            onChange={(e) => setNewWitness({ ...newWitness, nama: e.target.value })}
          />
          <Select
            value={newWitness.sisi}
            onValueChange={(value) =>
              setNewWitness({ ...newWitness, sisi: value as BoundaryDirection })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Sisi batas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Utara">Utara</SelectItem>
              <SelectItem value="Timur Laut">Timur Laut</SelectItem>
              <SelectItem value="Timur">Timur</SelectItem>
              <SelectItem value="Tenggara">Tenggara</SelectItem>
              <SelectItem value="Selatan">Selatan</SelectItem>
              <SelectItem value="Barat Daya">Barat Daya</SelectItem>
              <SelectItem value="Barat">Barat</SelectItem>
              <SelectItem value="Barat Laut">Barat Laut</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Penggunaan batas lahan"
            value={newWitness.penggunaanLahanBatas}
            onChange={(e) =>
              setNewWitness({ ...newWitness, penggunaanLahanBatas: e.target.value })
            }
          />
          <Button onClick={handleAddWitness}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah
          </Button>
        </div>

        {draft.saksiList.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Nama Saksi</TableHead>
                  <TableHead>Sisi Batas</TableHead>
                  <TableHead>Penggunaan Batas</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.saksiList.map((witness,i) => {
                  return (
                  <TableRow key={`${witness.id}-${i}`}>
                    <TableCell>{witness.nama}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{witness.sisi}</Badge>
                    </TableCell>
                    <TableCell>{witness.penggunaanLahanBatas || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveWitness(witness.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Land Location & Details */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h3 className="text-gray-900">Lokasi dan Detail Lahan</h3>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-600">Desa (ditentukan pada Step 1)</p>
          <p className="text-sm text-gray-900">
            {draft.villageId ? `ID Desa ${draft.villageId}` : 'Belum dipilih'}
          </p>
          <p className="text-xs text-gray-600">
            {draft.kecamatan || '-'}, {draft.kabupaten || '-'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="namaJalan">Nama Jalan</Label>
            <Input
              id="namaJalan"
              value={draft.namaJalan || ''}
              onChange={(e) => onUpdateDraft({ namaJalan: e.target.value })}
              placeholder="Masukkan nama jalan"
            />
          </div>

          <div>
            <Label htmlFor="namaGang">Nama Gang</Label>
            <Input
              id="namaGang"
              value={draft.namaGang || ''}
              onChange={(e) => onUpdateDraft({ namaGang: e.target.value })}
              placeholder="Masukkan nama gang"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nomorPersil">Nomor Persil</Label>
            <Input
              id="nomorPersil"
              value={draft.nomorPersil || ''}
              onChange={(e) => onUpdateDraft({ nomorPersil: e.target.value })}
              placeholder="Masukkan nomor persil"
            />
          </div>

          <div>
            <Label htmlFor="rtrw">RT / RW</Label>
            <Input
              id="rtrw"
              value={draft.rtrw || ''}
              onChange={(e) => onUpdateDraft({ rtrw: e.target.value })}
              placeholder="Contoh: 001/002"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="dusun">Dusun</Label>
          <Input
            id="dusun"
            value={draft.dusun || ''}
            onChange={(e) => onUpdateDraft({ dusun: e.target.value })}
            placeholder="Masukkan nama dusun"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="penggunaanLahan">Penggunaan Lahan</Label>
            <Input
              id="penggunaanLahan"
              value={draft.penggunaanLahan || ''}
              onChange={(e) => onUpdateDraft({ penggunaanLahan: e.target.value })}
              placeholder="Contoh: Pertanian, Perkebunan, dll"
            />
          </div>

          <div>
            <Label htmlFor="tahunAwalGarap">Tahun Awal Garap</Label>
            <Input
              id="tahunAwalGarap"
              type="number"
              value={draft.tahunAwalGarap || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : undefined;
                onUpdateDraft({ tahunAwalGarap: value });
              }}
              placeholder="Contoh: 2010"
              min={1900}
              max={new Date().getFullYear()}
            />
          </div>
        </div>
      </div>

      {/* Coordinates */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-900">
            Titik Koordinat Patok/Pal Batas <span className="text-red-600">*</span>
          </h3>
          <Button onClick={handleAddCoordinate} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Titik
          </Button>
        </div>
        {errors.coordinatesGeografis && (
          <p className="text-xs text-red-600">{errors.coordinatesGeografis}</p>
        )}

        <div className="space-y-1">
          <Label htmlFor="kml-coordinate-file">Impor KML (Opsional)</Label>
          <Input
            id="kml-coordinate-file"
            type="file"
            accept=".kml"
            onChange={handleKmlUpload}
            disabled={isParsingKml}
          />
          <p className="text-xs text-gray-500">
            Unggah file KML untuk menggantikan seluruh titik koordinat saat ini.
          </p>
          {isParsingKml && <p className="text-xs text-blue-600">Memproses file...</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coordinate Table */}
          <div className="space-y-3">
             <div className="flex items-center space-x-4 mb-4">
                <Label>Sistem Koordinat:</Label>
                <RadioGroup 
                    value={coordinateSystem} 
                    onValueChange={(val) => handleSystemChange(val as CoordinateSystem)}
                    className="flex space-x-4"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="geografis"
                          id="cs-geografis"
                          data-testid="coordinate-system-geografis"
                        />
                        <Label htmlFor="cs-geografis" className="cursor-pointer">Geografis (Lat/Lon)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="utm" id="cs-utm" data-testid="coordinate-system-utm" />
                        <Label htmlFor="cs-utm" className="cursor-pointer">UTM</Label>
                    </div>
                </RadioGroup>
            </div>
            
            {draft.coordinatesGeografis.length === 0 ? (
              <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Belum ada titik koordinat</p>
                <p className="text-sm">Klik &quot;Tambah Titik&quot; untuk memulai</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12">No.</TableHead>
                      {coordinateSystem === 'geografis' ? (
                          <>
                            <TableHead>Latitude</TableHead>
                            <TableHead>Longitude</TableHead>
                          </>
                      ) : (
                          <>
                            <TableHead className="w-20">Zone</TableHead>
                            <TableHead className="w-20">Hemis</TableHead>
                            <TableHead>Easting (X)</TableHead>
                            <TableHead>Northing (Y)</TableHead>
                          </>
                      )}
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coordinateSystem === 'geografis' ? (
                        draft.coordinatesGeografis.map((coord, index) => (
                          <TableRow key={`${coord.id}-${index}`}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.000001"
                                value={coord.latitude || ''}
                                onChange={(e) =>
                                  handleUpdateCoordinate(
                                    coord.id,
                                    index,
                                    'latitude',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                onBlur={handleGeographicCoordinateBlur}
                                onKeyDown={handleGeographicCoordinateKeyDown}
                                placeholder="-6.9"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.000001"
                                value={coord.longitude || ''}
                                onChange={(e) =>
                                  handleUpdateCoordinate(
                                    coord.id,
                                    index,
                                    'longitude',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                onBlur={handleGeographicCoordinateBlur}
                                onKeyDown={handleGeographicCoordinateKeyDown}
                                placeholder="107.6"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveCoordinate(coord.id, index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                        utmCoordinates.map((coord, index) => (
                         <TableRow key={`${coord.id}-${index}`}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                                <Input 
                                    min="1"
                                    max="60"
                                    type="text"
                                    inputMode="numeric"
                                    value={coord.zone}
                                    onFocus={() =>
                                      setEditingUtmField({ id: coord.id, index, field: 'zone' })
                                    }
                                    onChange={(e) => handleUpdateUTMInput(coord.id, index, 'zone', e.target.value)}
                                    onBlur={(e) =>
                                      handleUtmBlur(coord.id, index, 'zone', e.currentTarget.value)
                                    }
                                    onKeyDown={handleUtmKeyDown}
                                    placeholder="48"
                                    className="w-16"
                                    data-testid={index === 0 ? 'utm-zone-input-0' : undefined}
                                />
                            </TableCell>
                            <TableCell>
                                <Select 
                                    value={coord.hemisphere}
                                    onValueChange={(val) => handleHemisphereChange(coord.id, index, val as 'N' | 'S')}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="N">N</SelectItem>
                                        <SelectItem value="S">S</SelectItem>
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={coord.easting || ''}
                                onFocus={() =>
                                  setEditingUtmField({ id: coord.id, index, field: 'easting' })
                                }
                                onChange={(e) => handleUpdateUTMInput(coord.id, index, 'easting', e.target.value)}
                                onBlur={(e) =>
                                  handleUtmBlur(coord.id, index, 'easting', e.currentTarget.value)
                                }
                                onKeyDown={handleUtmKeyDown}
                                placeholder="Easting"
                                data-testid={index === 0 ? 'utm-easting-input-0' : undefined}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={coord.northing || ''}
                                onFocus={() =>
                                  setEditingUtmField({ id: coord.id, index, field: 'northing' })
                                }
                                onChange={(e) => handleUpdateUTMInput(coord.id, index, 'northing', e.target.value)}
                                onBlur={(e) =>
                                  handleUtmBlur(coord.id, index, 'northing', e.currentTarget.value)
                                }
                                onKeyDown={handleUtmKeyDown}
                                placeholder="Northing"
                                data-testid={index === 0 ? 'utm-northing-input-0' : undefined}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveCoordinate(coord.id, index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {draft.coordinatesGeografis.length >= 3 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <strong>Luas terhitung:</strong> {luas.toLocaleString('id-ID')} m²
                </p>
              </div>
            )}

            <div className="space-y-1">
                 <Label>Luas Manual (m²)</Label>
                 <Input
                    type="number"
                    step="0.01"
                    placeholder="Masukkan luas manual jika berbeda"
                    value={draft.luasManual || ''}
                    onChange={(e) => onUpdateDraft({ luasManual: parseFloat(e.target.value) || 0 })}
                 />
                 <p className="text-xs text-gray-500">
                    Opsional: Masukkan luas hasil pengukuran manual jika berbeda dengan perhitungan otomatis.
                 </p>
            </div>
          </div>

          {/* Map Preview */}
          <div className="space-y-3">
            <Label>Pratinjau Peta</Label>
            <DrawingMap
              coordinates={draft.coordinatesGeografis}
              recenterSignal={recenterSignal}
              referencePolygons={referencePolygons}
              onCoordinatesChange={(coords) => {
                // This callback is triggered when user draws/edits on the map
                // The coordinates are already synced, just update the draft
                onUpdateDraft({
                  coordinatesGeografis: normalizeCoordinateIds(coords),
                });
              }}
            />

            {/* Legend for reference polygons */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
              <p className="text-xs mb-2 font-semibold text-gray-900">
                Legenda Peta
              </p>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-2 text-xs text-gray-700">
                  <span className="w-3.5 h-3.5 rounded-sm border" style={{ backgroundColor: '#f97316', borderColor: '#f97316' }} />
                  Lahan yang diajukan (digambar)
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-700">
                  <span className="w-3.5 h-3.5 rounded-sm border" style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }} />
                  SPPTG terdaftar
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-700">
                  <span className="w-3.5 h-3.5 rounded-sm border" style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6' }} />
                  SPPTG terdata
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-700">
                  <span className="w-3.5 h-3.5 rounded-sm border" style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }} />
                  Kawasan Non-SPPTG
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                Polygon kawasan & SPPTG lain hanya tampil sebagai referensi (tidak dapat diedit).
              </p>
            </div>

            <Button
              onClick={handleCheckOverlap}
              variant="outline"
              className="w-full"
              disabled={draft.coordinatesGeografis.length < 3 || checkOverlapsMutation.isPending}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              {checkOverlapsMutation.isPending ? 'Mengecek...' : 'Cek Tumpang Tindih'}
            </Button>
          </div>
        </div>
      </div>

      {/* Field Documents */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h3 className="text-gray-900">Dokumen Lapangan</h3>
        <p className="text-sm text-gray-600">
          Unggah dokumen hasil validasi lapangan (format PDF, maks. 10 MB)
        </p>

        <div>
          <FileUploadField
            label="Berita Acara Validasi Lapangan"
            value={draft.dokumenBeritaAcara}
            onChange={(doc) => onPersistDraftPatch({ dokumenBeritaAcara: doc })}
            category="Berita Acara"
            templateType="berita_acara_validasi_lapangan.docx"
            draftId={draft.id}
            accept=".pdf"
            maxSize={10}
            error={Boolean(errors.dokumenBeritaAcara)}
          />
          {errors.dokumenBeritaAcara && (
            <p className="text-xs text-red-600 mt-1">{errors.dokumenBeritaAcara}</p>
          )}
        </div>
      </div>

      {/* Overlap Check Dialog */}
      <Dialog open={isOverlapDialogOpen} onOpenChange={setIsOverlapDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Hasil Cek Tumpang Tindih</DialogTitle>
            <DialogDescription>
              Pengecekan overlap dengan kawasan non-SPPTG yang aktif
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {draft.overlapResults.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-900">
                  ✓ Tidak ada tumpang tindih dengan kawasan non-SPPTG
                </p>
              </div>
            ) : (
              <>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="text-orange-900">
                        <strong>Ditemukan {draft.overlapResults.length} overlap dengan kawasan Non‑SPPTG</strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Nama Kawasan</TableHead>
                        <TableHead>Jenis</TableHead>
                        <TableHead>Sumber</TableHead>
                        <TableHead>Luas Overlap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draft.overlapResults.map((overlap, index) => (
                        <TableRow key={index}>
                          <TableCell>{overlap.namaKawasan}</TableCell>
                          <TableCell>
                            <Badge className={overlapJenisBadgeClassName(overlap)}>
                              {overlap.jenisKawasan}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {overlap.sumber === 'Submission' ? 'SPPTG Eksisting' : 'Kawasan Non-SPPTG'}
                            </Badge>
                          </TableCell>
                          <TableCell>{overlap.luasOverlap} m²</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOverlapDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
