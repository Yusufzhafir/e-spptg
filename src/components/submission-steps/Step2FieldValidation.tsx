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
  LandPolygon,
} from '../../types';
import { trpc } from '@/trpc/client';
import { useAuthRole } from '../AuthRoleProvider';
import { DrawingMap, type ReferencePolygon } from '../maps/DrawingMap';
import { geoJSONToPaths } from '@/lib/map-utils';
import {
  describeOverlapSources,
  overlapJenisBadgeClassName,
  overlapSourceLabel,
} from '@/lib/overlap-results';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
import { parseKMLFile } from '@/lib/kmz-parser';
import {
  createPolygonId,
  draftPolygons,
  isUsablePolygon,
  MIN_POLYGON_POINTS,
  polygonLabel,
  polygonsPatch,
  totalPolygonArea,
  validCoordinates,
} from '@/lib/land-polygons';
import { normalizeCoordinateIds } from '@/lib/coordinate-ids';
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
import {
  Plus,
  Trash2,
  MapPin,
  AlertTriangle,
  Pencil,
  X,
  Check,
  Lock,
  Shapes,
  Users,
} from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';
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
  /**
   * Look, don't touch. Used for the Viewer tracking a berkas that has already
   * moved past this stage: every control is disabled at the DOM level, and the
   * map drops into display-only mode so the polygon cannot be redrawn.
   */
  readOnly?: boolean;
}

type NewWitnessWithUsage = {
  nama?: string;
  sisi?: BoundaryDirection;
  penggunaanLahanBatas?: string;
  umur?: string;
  pekerjaan?: string;
  alamat?: string;
};

const EMPTY_WITNESS_FORM: NewWitnessWithUsage = {
  nama: '',
  sisi: '' as BoundaryDirection,
  penggunaanLahanBatas: '',
  umur: '',
  pekerjaan: '',
  alamat: '',
};

const BOUNDARY_DIRECTIONS: BoundaryDirection[] = [
  'Utara',
  'Timur Laut',
  'Timur',
  'Tenggara',
  'Selatan',
  'Barat Daya',
  'Barat',
  'Barat Laut',
];

const BOUNDARY_DIRECTION_OPTIONS = BOUNDARY_DIRECTIONS.map((direction) => ({
  value: direction,
  label: direction,
}));

function formatUtmValue(value: number): string {
  return value.toFixed(2);
}

/**
 * An optional measurement input. Clearing the box stores `undefined`, not 0 —
 * "not measured" and "measured as zero" are different things, and the draft
 * schema rejects a non-positive number anyway.
 */
function parseMeasurement(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Colour of the other bidang of this same pengajuan on the map. */
const OTHER_POLYGON_COLOR = '#a855f7';

export function Step2FieldValidation({
  draft,
  onUpdateDraft,
  onPersistDraftPatch,
  errors = {},
  readOnly = false,
}: Step2Props) {
  const { hasAnyRole } = useAuthRole();
  const [isOverlapDialogOpen, setIsOverlapDialogOpen] = useState(false);
  const [isParsingKml, setIsParsingKml] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(() =>
    draftPolygons(draft).some(isUsablePolygon) ? 1 : 0
  );
  const [newWitness, setNewWitness] = useState<NewWitnessWithUsage>(EMPTY_WITNESS_FORM);
  // Set while an existing witness is being edited; the form doubles as the edit form.
  const [editingWitnessId, setEditingWitnessId] = useState<string | null>(null);
  
  // Local state for UTM coordinates to prevent rounding issues during editing
  // We sync this with draft.coordinatesGeografis whenever draft changes or user edits
  const [utmCoordinates, setUtmCoordinates] = useState<LocalUTMCoordinate[]>([]);
  const [editingUtmField, setEditingUtmField] = useState<EditingUtmField | null>(null);

  // Which bidang the coordinate table and the drawing tool are pointed at. The
  // rest render behind it as read-only reference.
  const [activePolygonId, setActivePolygonId] = useState<string | null>(null);

  // Initialize coordinate system from draft or default to geografis
  const coordinateSystem = draft.coordinateSystem || 'geografis';

  // Keyed on the geometry fields, not the whole draft: `draft` gets a new
  // identity on every keystroke in this step, and a fresh `polygons` array
  // cascades into `referencePolygons`, which makes the map tear down and rebuild
  // every kawasan and SPPTG polygon it is drawing as reference.
  const polygons = useMemo(
    () => draftPolygons(draft),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the geometry matters here
    [draft.polygons, draft.coordinatesGeografis]
  );

  const activePolygonIndex = useMemo(() => {
    const index = polygons.findIndex((polygon) => polygon.id === activePolygonId);
    // Falls back to the first bidang whenever the selected one is gone (deleted,
    // or replaced wholesale by a KML import).
    return index >= 0 ? index : 0;
  }, [polygons, activePolygonId]);

  const activePolygon: LandPolygon | undefined = polygons[activePolygonIndex];
  // Memoised: a fresh `[]` on every render would re-run every effect and
  // callback keyed on the active bidang's coordinates.
  const activeCoordinates = useMemo(
    () => activePolygon?.coordinates ?? [],
    [activePolygon]
  );
  const isActiveLocked = Boolean(activePolygon?.locked);
  // The coordinate table and the map are frozen for a Viewer *and* for a bidang
  // whose vertices came from a KML: the file is the survey record.
  const coordinatesReadOnly = readOnly || isActiveLocked;

  /** Persist a new polygon list, keeping the mirrored fields in step. */
  const applyPolygons = useCallback(
    (next: LandPolygon[]) => {
      onUpdateDraft(polygonsPatch(next));
    },
    [onUpdateDraft]
  );

  /** Replace the coordinates of the bidang currently being edited. */
  const updateActiveCoordinates = useCallback(
    (coordinates: GeographicCoordinate[]) => {
      if (polygons.length === 0) {
        applyPolygons([{ id: createPolygonId(), coordinates }]);
        return;
      }
      applyPolygons(
        polygons.map((polygon, index) =>
          index === activePolygonIndex ? { ...polygon, coordinates } : polygon
        )
      );
    },
    [applyPolygons, polygons, activePolygonIndex]
  );

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

  // Sync UTM local state when switching to UTM mode, when the active bidang
  // changes, or when its coordinates change externally (map draw, KML import)
  useEffect(() => {
    if (coordinateSystem === 'utm' && !editingUtmField) {
      setUtmCoordinates(activeCoordinates.map(toLocalUtmCoordinate));
    }
  }, [activeCoordinates, coordinateSystem, toLocalUtmCoordinate, editingUtmField]);

  const handleSystemChange = (value: CoordinateSystem) => {
    onUpdateDraft({ coordinateSystem: value });
  };

  const triggerMapRecenter = useCallback(() => {
    setRecenterSignal((value) => value + 1);
  }, []);

  const resetWitnessForm = () => {
    setNewWitness(EMPTY_WITNESS_FORM);
    setEditingWitnessId(null);
  };

  /** Adds a new witness, or saves the one currently being edited. */
  const handleSaveWitness = () => {
    if (!newWitness.nama?.trim()) {
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

    // Umur/pekerjaan/alamat are optional — a surveyor often records a saksi in
    // the field without them, and the certificate prints a blank dotted line
    // just as the paper form did. Only the range is enforced when a value is
    // actually given.
    const umurRaw = newWitness.umur?.trim();
    const umur = umurRaw ? parseInt(umurRaw, 10) : undefined;
    if (umurRaw && (!Number.isFinite(umur) || umur! < 1 || umur! > 150)) {
      toast.error('Umur saksi harus antara 1 dan 150');
      return;
    }

    const witness: BoundaryWitness = {
      id: editingWitnessId || `W-${Date.now()}`,
      nama: newWitness.nama.trim(),
      sisi: newWitness.sisi,
      penggunaanLahanBatas: newWitness.penggunaanLahanBatas.trim(),
      umur,
      pekerjaan: newWitness.pekerjaan?.trim() || undefined,
      alamat: newWitness.alamat?.trim() || undefined,
    };

    if (editingWitnessId) {
      onUpdateDraft({
        saksiList: draft.saksiList.map((w) =>
          w.id === editingWitnessId ? witness : w
        ),
      });
      toast.success('Data saksi berhasil diperbarui');
    } else {
      onUpdateDraft({ saksiList: [...draft.saksiList, witness] });
      toast.success('Saksi berhasil ditambahkan');
    }

    resetWitnessForm();
  };

  const handleEditWitness = (witness: BoundaryWitness) => {
    setEditingWitnessId(witness.id);
    setNewWitness({
      nama: witness.nama,
      sisi: witness.sisi,
      penggunaanLahanBatas: witness.penggunaanLahanBatas,
      umur: witness.umur ? String(witness.umur) : '',
      pekerjaan: witness.pekerjaan || '',
      alamat: witness.alamat || '',
    });
  };

  const handleRemoveWitness = (id: string) => {
    onUpdateDraft({ saksiList: draft.saksiList.filter((w) => w.id !== id) });
    // Editing the row that just disappeared would silently re-add it on save.
    if (editingWitnessId === id) {
      resetWitnessForm();
    }
    toast.info('Saksi dihapus');
  };

  const handleAddCoordinate = () => {
    const newCoord: GeographicCoordinate = {
      id: `C-${Date.now()}`,
      latitude: 0,
      longitude: 0,
    };

    updateActiveCoordinates([...activeCoordinates, newCoord]);
  };

  const handleUpdateCoordinate = (
    id: string | undefined,
    index: number,
    field: 'latitude' | 'longitude',
    value: number
  ) => {
    const matcher = createCoordinateRowMatcher(activeCoordinates, id, index);
    updateActiveCoordinates(
      activeCoordinates.map((coord, coordIndex) =>
        matcher(coord, coordIndex) ? { ...coord, [field]: value } : coord
      )
    );
  };

  /** Start a new, empty bidang and point the editor at it. */
  const handleAddPolygon = () => {
    const created: LandPolygon = { id: createPolygonId(), coordinates: [] };
    applyPolygons([...polygons, created]);
    setActivePolygonId(created.id);
    toast.info('Bidang baru ditambahkan. Gambar polygon-nya di peta.');
  };

  const handleRemovePolygon = (polygonId: string) => {
    const remaining = polygons.filter((polygon) => polygon.id !== polygonId);
    applyPolygons(remaining);
    if (activePolygonId === polygonId) {
      setActivePolygonId(remaining[0]?.id ?? null);
    }
    toast.info('Bidang dihapus');
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
      const draftMatcher = createCoordinateRowMatcher(activeCoordinates, id, index);
      const geoCoord = activeCoordinates.find((coord, coordIndex) =>
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
    [activeCoordinates, toLocalUtmCoordinate]
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

      const draftMatcher = createCoordinateRowMatcher(activeCoordinates, id, index);
      updateActiveCoordinates(
        activeCoordinates.map((coord, coordIndex) =>
          draftMatcher(coord, coordIndex)
            ? { ...coord, latitude: latLon.latitude, longitude: latLon.longitude }
            : coord
        )
      );
      return true;
    },
    [activeCoordinates, updateActiveCoordinates, resetUtmRowFromDraft, utmCoordinates]
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
    const matcher = createCoordinateRowMatcher(activeCoordinates, id, index);
    updateActiveCoordinates(
      activeCoordinates.filter((coord, coordIndex) => !matcher(coord, coordIndex))
    );
  };

  const normalizeImportedCoordinates = (
    coordinates: Array<{ latitude: number; longitude: number }>,
    importId: string
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

    return sanitized.map((coord, index) => ({
      id: `C-${importId}-${index}`,
      latitude: coord.latitude,
      longitude: coord.longitude,
    }));
  };

  /**
   * Import every polygon in the file — a surveyor's KML routinely carries all the
   * bidang of one claim. The imported bidang replace the current list and come in
   * locked: the file is the survey record, so its vertices are not something to
   * nudge by hand afterwards (the lock can be lifted per bidang).
   */
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

      const importId = Date.now().toString(36);
      const imported: LandPolygon[] = [];
      result.polygons.forEach((parsed, index) => {
        const coordinates = normalizeImportedCoordinates(
          parsed.coordinates,
          `${importId}-${index}`
        );
        if (coordinates.length < MIN_POLYGON_POINTS) return;
        imported.push({
          id: `P-${importId}-${index}`,
          nama: parsed.name,
          coordinates,
          locked: true,
        });
      });

      if (imported.length === 0) {
        toast.error(
          `File KML harus berisi minimal ${MIN_POLYGON_POINTS} titik koordinat per polygon`
        );
        return;
      }

      applyPolygons(imported);
      setActivePolygonId(imported[0].id);
      triggerMapRecenter();
      const totalPoints = imported.reduce(
        (total, polygon) => total + polygon.coordinates.length,
        0
      );
      toast.success(
        `File KML berhasil diimpor: ${imported.length} bidang, ${totalPoints} titik koordinat. Polygon terkunci.`
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
  /**
   * The processing roles see every desa's polygons, not just their own: a plot
   * can sit right on the desa boundary, and the overlap check has always looked
   * across all of them. A Viewer opening this step read-only keeps the
   * desa-scoped list — `listMapPolygons` is not theirs to call.
   */
  const canSeeAllVillages = hasAnyRole(['Superadmin', 'Admin', 'Verifikator']);
  const { data: allVillagePolygons } = trpc.submissions.listMapPolygons.useQuery(
    undefined,
    { enabled: canSeeAllVillages }
  );
  const { data: existingSubmissionsData } = trpc.submissions.list.useQuery(
    { limit: 500, offset: 0 },
    { enabled: !canSeeAllVillages }
  );

  const referencePolygons = useMemo<ReferencePolygon[]>(() => {
    const result: ReferencePolygon[] = [];

    // The other bidang of this same pengajuan. Only one polygon is editable at a
    // time (Terra Draw owns a single feature), so the rest are drawn as static
    // reference — otherwise adding a second bidang would look like it erased the
    // first.
    polygons.forEach((polygon, index) => {
      if (index === activePolygonIndex) return;
      const path = validCoordinates(polygon.coordinates).map((coord) => ({
        lat: Number(coord.latitude),
        lng: Number(coord.longitude),
      }));
      if (path.length < MIN_POLYGON_POINTS) return;
      result.push({
        id: `bidang-${polygon.id}`,
        path,
        strokeColor: OTHER_POLYGON_COLOR,
        fillColor: OTHER_POLYGON_COLOR,
        label: `Bidang lain: ${polygonLabel(polygon, index)}`,
      });
    });

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

    // Existing SPPTG (terdaftar = green, terdata = blue). `listMapPolygons` has
    // already dropped the rejected, under-review and invalid ones server-side;
    // the desa-scoped fallback still has to filter them here.
    const submissionItems: Array<{
      id: number;
      status: string;
      geoJSON?: unknown;
      label: string;
    }> = canSeeAllVillages
      ? (allVillagePolygons ?? []).map((sub) => ({
          id: sub.id,
          status: sub.status,
          geoJSON: sub.geoJSON,
          // No applicant name here: the desa is what tells a surveyor whose
          // territory the neighbouring plot belongs to.
          label: sub.desaNama ? `${sub.status} — ${sub.desaNama}` : sub.status,
        }))
      : ((existingSubmissionsData?.items ?? []) as Array<{
          id: number;
          namaPemilik: string;
          status: string;
          isValid?: boolean;
          geoJSON?: unknown;
        }>)
          .filter(
            (sub) =>
              (sub.status === 'SPPTG terdaftar' || sub.status === 'SPPTG terdata') &&
              sub.isValid !== false
          )
          .map((sub) => ({
            id: sub.id,
            status: sub.status,
            geoJSON: sub.geoJSON,
            label: `${sub.status}: ${sub.namaPemilik}`,
          }));

    submissionItems.forEach((sub) => {
      const color = sub.status === 'SPPTG terdaftar' ? '#22c55e' : '#3b82f6';
      geoJSONToPaths(sub.geoJSON).forEach((path, i) => {
        result.push({
          id: `spptg-${sub.id}-${i}`,
          path,
          strokeColor: color,
          fillColor: color,
          label: sub.label,
        });
      });
    });

    return result;
  }, [
    polygons,
    activePolygonIndex,
    prohibitedAreasData,
    existingSubmissionsData,
    allVillagePolygons,
    canSeeAllVillages,
  ]);

  /** Bidang complete enough to be checked, measured and submitted. */
  const usablePolygons = useMemo(
    () => polygons.filter(isUsablePolygon),
    [polygons]
  );

  const handleCheckOverlap = () => {
    if (usablePolygons.length === 0) {
      toast.error(`Minimal ${MIN_POLYGON_POINTS} titik koordinat diperlukan`);
      return;
    }

    // Every bidang is checked in one call: a claim overlaps a kawasan if any of
    // its parcels does, and checking only the active one would clear a pengajuan
    // whose second bidang sits inside a Kawasan Hutan.
    checkOverlapsMutation.mutate({
      // The draft id lets the server leave out the pengajuan this draft is
      // editing — otherwise the new boundary is reported as clashing with the
      // berkas's own filed polygon.
      draftId: draft.id,
      polygons: usablePolygons.map((polygon) =>
        validCoordinates(polygon.coordinates).map((coord) => ({
          latitude: coord.latitude,
          longitude: coord.longitude,
        }))
      ),
    });
  };

  const luas = useMemo(() => totalPolygonArea(polygons), [polygons]);

  // Keep luasLahan in step with the drawn bidang (sum across all of them)
  useEffect(() => {
    if (usablePolygons.length === 0) return;
    if (luas !== draft.luasLahan) {
      onUpdateDraft({ luasLahan: luas });
    }
  }, [luas, usablePolygons.length, onUpdateDraft, draft.luasLahan]);

  return (
    // `disabled` on the fieldset cascades to every input, select and button
    // inside — a single, unbypassable switch instead of threading a flag through
    // dozens of controls. The map is not a form control, so it gets `readOnly`
    // passed explicitly below. `min-w-0` keeps the browser's default fieldset
    // sizing from breaking the grids inside.
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-2">Validasi Lapangan</h2>
        <p className="text-gray-600">
          {readOnly
            ? 'Data tim peneliti, saksi batas, dan koordinat lahan hasil survey lapangan.'
            : 'Isi data tim peneliti, saksi batas, dan koordinat lahan hasil survey lapangan.'}
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
      <fieldset disabled={readOnly} className="space-y-4 pt-4 border-t border-gray-200 min-w-0">
        <h3 className="text-gray-900">
          Saksi Batas Lahan {!readOnly && <span className="text-red-600">*</span>}
        </h3>
        {errors.saksiList && (
          <p className="text-xs text-red-600">{errors.saksiList}</p>
        )}

        {/* The add/edit form is pure input — nothing to read here. */}
        {!readOnly && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">
                {editingWitnessId ? 'Ubah Data Saksi' : 'Tambah Saksi'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="saksiNama">
                  Nama Saksi <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="saksiNama"
                  placeholder="Nama lengkap saksi"
                  value={newWitness.nama || ''}
                  onChange={(e) =>
                    setNewWitness({ ...newWitness, nama: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="saksiSisi">
                  Sisi Batas <span className="text-red-600">*</span>
                </Label>
                <SearchableSelect
                  id="saksiSisi"
                  options={BOUNDARY_DIRECTION_OPTIONS}
                  value={newWitness.sisi}
                  onValueChange={(value) =>
                    setNewWitness({ ...newWitness, sisi: value as BoundaryDirection })
                  }
                  placeholder="Pilih sisi batas"
                  searchPlaceholder="Cari sisi batas..."
                  emptyText="Sisi batas tidak ditemukan."
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="saksiPenggunaan">
                  Penggunaan Batas <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="saksiPenggunaan"
                  placeholder="Contoh: Sawah, Jalan desa"
                  value={newWitness.penggunaanLahanBatas || ''}
                  onChange={(e) =>
                    setNewWitness({
                      ...newWitness,
                      penggunaanLahanBatas: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="saksiUmur">Umur (opsional)</Label>
                <Input
                  id="saksiUmur"
                  type="number"
                  placeholder="Contoh: 45"
                  min={1}
                  max={150}
                  value={newWitness.umur || ''}
                  onChange={(e) =>
                    setNewWitness({ ...newWitness, umur: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="saksiPekerjaan">Pekerjaan (opsional)</Label>
                <Input
                  id="saksiPekerjaan"
                  placeholder="Contoh: Petani"
                  value={newWitness.pekerjaan || ''}
                  onChange={(e) =>
                    setNewWitness({ ...newWitness, pekerjaan: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="saksiAlamat">Alamat (opsional)</Label>
                <Input
                  id="saksiAlamat"
                  placeholder="Alamat sesuai KTP"
                  value={newWitness.alamat || ''}
                  onChange={(e) =>
                    setNewWitness({ ...newWitness, alamat: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {editingWitnessId && (
                <Button type="button" variant="outline" onClick={resetWitnessForm}>
                  <X className="w-4 h-4 mr-2" />
                  Batal
                </Button>
              )}
              <Button type="button" onClick={handleSaveWitness}>
                {editingWitnessId ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Simpan Perubahan
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Nothing was rendered here at all when the list was empty, so a berkas
            with no saksi looked the same as one whose saksi were simply below
            the fold — and the omission only surfaced as a validation error on
            the way to the next step. */}
        {draft.saksiList.length === 0 && (
          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Belum ada saksi batas lahan
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {readOnly
                    ? 'Pengajuan ini tidak mencantumkan satu pun saksi batas lahan.'
                    : 'Minimal 1 saksi diperlukan sebelum lanjut ke tahap berikutnya. Isi formulir di atas lalu klik "Tambah" — jumlah saksi tidak dibatasi.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {draft.saksiList.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <Table className="min-w-150">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Nama Saksi</TableHead>
                  <TableHead>Sisi Batas</TableHead>
                  <TableHead>Penggunaan Batas</TableHead>
                  <TableHead>Umur</TableHead>
                  <TableHead>Pekerjaan</TableHead>
                  <TableHead>Alamat</TableHead>
                  {!readOnly && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.saksiList.map((witness,i) => {
                  return (
                  <TableRow
                    key={`${witness.id}-${i}`}
                    className={
                      editingWitnessId === witness.id ? 'bg-blue-50' : undefined
                    }
                  >
                    <TableCell>{witness.nama}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{witness.sisi}</Badge>
                    </TableCell>
                    <TableCell>{witness.penggunaanLahanBatas || '-'}</TableCell>
                    <TableCell>{witness.umur || '-'}</TableCell>
                    <TableCell>{witness.pekerjaan || '-'}</TableCell>
                    <TableCell>{witness.alamat || '-'}</TableCell>
                    {!readOnly && (
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditWitness(witness)}
                          className="text-blue-600 hover:text-blue-700"
                          aria-label={`Ubah data saksi ${witness.nama}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveWitness(witness.id)}
                          className="text-red-600 hover:text-red-700"
                          aria-label={`Hapus saksi ${witness.nama}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </fieldset>

      {/* Land Location & Details */}
      <fieldset disabled={readOnly} className="space-y-4 pt-4 border-t border-gray-200 min-w-0">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="statusTanah">Status Tanah</Label>
            <Input
              id="statusTanah"
              value={draft.statusTanah || ''}
              onChange={(e) => onUpdateDraft({ statusTanah: e.target.value })}
              placeholder="Contoh: Tanah Negara, Tanah Ulayat"
            />
          </div>

          <div>
            <Label htmlFor="tahunPerolehan">Tahun Perolehan</Label>
            <Input
              id="tahunPerolehan"
              type="number"
              value={draft.tahunPerolehan || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : undefined;
                onUpdateDraft({ tahunPerolehan: value });
              }}
              placeholder="Contoh: 2005"
              min={1900}
              max={new Date().getFullYear()}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="asalPerolehan">Asal Perolehan</Label>
          <Input
            id="asalPerolehan"
            value={draft.asalPerolehan || ''}
            onChange={(e) => onUpdateDraft({ asalPerolehan: e.target.value })}
            placeholder="Contoh: jual beli dengan Bapak Ahmad, warisan orang tua"
          />
          <p className="mt-1 text-xs text-gray-500">
            Dicetak pada SPPTG: &quot;saya peroleh dari ... sejak tahun ...&quot;.
            Kosongkan bila akan diisi manual.
          </p>
        </div>
      </fieldset>

      {/* Coordinates */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-900">
            Titik Koordinat Patok/Pal Batas{' '}
            {!readOnly && <span className="text-red-600">*</span>}
          </h3>
          {!readOnly && (
            <Button
              onClick={handleAddCoordinate}
              variant="outline"
              size="sm"
              disabled={coordinatesReadOnly}
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah Titik
            </Button>
          )}
        </div>
        {errors.coordinatesGeografis && (
          <p className="text-xs text-red-600">{errors.coordinatesGeografis}</p>
        )}

        {!readOnly && (
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
            Unggah file KML untuk menggantikan seluruh bidang saat ini. File dengan
            banyak polygon akan dimuat sebagai beberapa bidang sekaligus, dan
            terkunci agar sama persis dengan file aslinya.
          </p>
          {isParsingKml && <p className="text-xs text-blue-600">Memproses file...</p>}
        </div>
        )}

        {/* Bidang (polygon) selector — a pengajuan may cover several parcels */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shapes className="w-4 h-4 text-gray-600" />
              <p className="text-sm font-medium text-gray-900">
                Bidang Lahan ({polygons.length || 0})
              </p>
            </div>
            {!readOnly && (
              <Button onClick={handleAddPolygon} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Bidang
              </Button>
            )}
          </div>

          {polygons.length === 0 ? (
            <p className="text-xs text-gray-500">
              Belum ada bidang. Gambar polygon di peta, impor KML, atau tambah titik
              koordinat.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {polygons.map((polygon, index) => {
                const isActive = index === activePolygonIndex;
                return (
                  <div
                    key={polygon.id}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                      isActive
                        ? 'border-orange-400 bg-orange-50 text-orange-900'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActivePolygonId(polygon.id);
                        triggerMapRecenter();
                      }}
                      className="font-medium"
                    >
                      {polygonLabel(polygon, index)}
                      <span className="ml-1 font-normal text-gray-500">
                        ({polygon.coordinates.length} titik)
                      </span>
                    </button>
                    {polygon.locked && (
                      <Lock className="w-3 h-3 text-gray-500" aria-label="Terkunci" />
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemovePolygon(polygon.id)}
                        className="text-red-600 hover:text-red-700"
                        aria-label={`Hapus ${polygonLabel(polygon, index)}`}
                        title="Hapus bidang"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isActiveLocked && !readOnly && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700">
              <Lock className="w-3.5 h-3.5" />
              Bidang ini diimpor dari file KML dan tidak dapat diubah. Hapus bidang
              lalu impor ulang bila koordinatnya keliru.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coordinate Table — always the active bidang */}
          <div className="space-y-3 min-w-0">
            {/* Only the coordinates themselves are frozen for an imported
                bidang — the measurements below are hand-recorded either way. */}
            <fieldset disabled={coordinatesReadOnly} className="space-y-3 min-w-0">
             {polygons.length > 1 && (
               <p className="text-xs text-gray-600">
                 Menampilkan koordinat{' '}
                 <strong>
                   {activePolygon ? polygonLabel(activePolygon, activePolygonIndex) : '-'}
                 </strong>
                 . Pilih bidang lain di atas untuk mengubahnya.
               </p>
             )}
             <div className="flex items-center space-x-4 mb-4">
                <Label>Sistem Koordinat:</Label>
                <RadioGroup
                    value={coordinateSystem}
                    onValueChange={(val) => handleSystemChange(val as CoordinateSystem)}
                    // Explicit rather than relying on the fieldset: Radix drives
                    // its own roving-focus/keyboard selection, so the group has
                    // to be told it is disabled.
                    disabled={coordinatesReadOnly}
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
            
            {activeCoordinates.length === 0 ? (
              <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Belum ada titik koordinat</p>
                <p className="text-sm">Klik &quot;Tambah Titik&quot; untuk memulai</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <Table className="min-w-150">
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
                      {!readOnly && <TableHead className="w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coordinateSystem === 'geografis' ? (
                        activeCoordinates.map((coord, index) => (
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
                            {!readOnly && (
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
                            )}
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

            </fieldset>

            {usablePolygons.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <strong>Luas terhitung:</strong> {luas.toLocaleString('id-ID')} m²
                </p>
                {usablePolygons.length > 1 && (
                  <p className="text-xs text-blue-700 mt-1">
                    Total dari {usablePolygons.length} bidang.
                  </p>
                )}
              </div>
            )}

            {/* Hand measurements taken at the patok. They stand beside the drawn
                boundary rather than feeding it: the area on the certificate still
                comes from the polygon (or Luas Manual). */}
            <fieldset disabled={readOnly} className="space-y-3 min-w-0">
              <div className="space-y-1">
                 <Label htmlFor="luasManual">Luas Manual (m²)</Label>
                 <Input
                    id="luasManual"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="panjangLahan">Panjang (m)</Label>
                  <Input
                    id="panjangLahan"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="Contoh: 40"
                    value={draft.panjangLahan ?? ''}
                    onChange={(e) =>
                      onUpdateDraft({
                        panjangLahan: parseMeasurement(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="lebarLahan">Lebar (m)</Label>
                  <Input
                    id="lebarLahan"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="Contoh: 25"
                    value={draft.lebarLahan ?? ''}
                    onChange={(e) =>
                      onUpdateDraft({
                        lebarLahan: parseMeasurement(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Opsional: ukuran hasil pengukuran di lapangan. Tidak mengubah luas
                terhitung dari polygon.
              </p>
            </fieldset>
          </div>

          {/* Map Preview — draws the active bidang, shows the rest behind it */}
          <div className="space-y-3">
            <Label>
              Pratinjau Peta
              {polygons.length > 1 && activePolygon
                ? ` — ${polygonLabel(activePolygon, activePolygonIndex)}`
                : ''}
            </Label>
            <DrawingMap
              coordinates={activeCoordinates}
              recenterSignal={recenterSignal}
              referencePolygons={referencePolygons}
              readOnly={coordinatesReadOnly}
              onCoordinatesChange={(coords) => {
                // This callback is triggered when user draws/edits on the map.
                // It only ever concerns the bidang currently selected.
                updateActiveCoordinates(normalizeCoordinateIds(coords));
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
                  Bidang aktif (digambar)
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-700">
                  <span
                    className="w-3.5 h-3.5 rounded-sm border"
                    style={{ backgroundColor: OTHER_POLYGON_COLOR, borderColor: OTHER_POLYGON_COLOR }}
                  />
                  Bidang lain pengajuan ini
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
                Polygon kawasan, SPPTG lain, dan bidang lain hanya tampil sebagai
                referensi (tidak dapat diedit di sini).
              </p>
            </div>

            {/* Staff-only: checkOverlapsFromCoordinates is a verifikatorProcedure,
                so for a Viewer this button could only ever produce a FORBIDDEN
                error. It also sits outside the read-only fieldset (that fieldset
                stops at the coordinate table so Google's map controls keep
                working), which is why it needs its own guard. */}
            {!readOnly && (
              <Button
                onClick={handleCheckOverlap}
                variant="outline"
                className="w-full"
                disabled={usablePolygons.length === 0 || checkOverlapsMutation.isPending}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                {checkOverlapsMutation.isPending
                  ? 'Mengecek...'
                  : usablePolygons.length > 1
                    ? `Cek Tumpang Tindih (${usablePolygons.length} bidang)`
                    : 'Cek Tumpang Tindih'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Field Documents */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h3 className="text-gray-900">Dokumen Lapangan</h3>
        <p className="text-sm text-gray-600">
          {readOnly
            ? 'Dokumen hasil validasi lapangan.'
            : 'Unggah dokumen hasil validasi lapangan (format PDF, maks. 10 MB)'}
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
            readOnly={readOnly}
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
              Pengecekan overlap dengan kawasan Non-SPPTG yang aktif dan SPPTG
              yang sudah terdata/terdaftar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {draft.overlapResults.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-900">
                  ✓ Tidak ada tumpang tindih dengan kawasan Non-SPPTG maupun
                  SPPTG eksisting
                </p>
              </div>
            ) : (
              <>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="text-orange-900">
                        <strong>
                          Ditemukan {draft.overlapResults.length} tumpang tindih:{' '}
                          {describeOverlapSources(draft.overlapResults)}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table className="min-w-150">
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
                              {overlapSourceLabel(overlap)}
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
