'use client';

/**
 * Geometry editor for one Kawasan Non-SPPTG.
 *
 * A kawasan is rarely a single ring: an SK typically covers several detached
 * blocks, and the boundary file that defines them is one multi-polygon KML. The
 * editor therefore holds a *list* of polygons and emits a MultiPolygon — one
 * kawasan row, several parts.
 *
 * Only one polygon is editable at a time (Terra Draw owns a single feature); the
 * rest are drawn behind it as reference so adding a second block never looks
 * like it erased the first. Imported polygons arrive locked — the file is the
 * authority for where the boundary runs, and a nudged vertex would silently put
 * the kawasan somewhere the SK does not — but the lock is a working state, not a
 * verdict: it can be lifted per block to correct a bad import and put back
 * afterwards. It lives only in this editor's state; the saved kawasan is the
 * geometry alone, so a reopened block always comes back unlocked.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { DrawingMap, type ReferencePolygon } from './maps/DrawingMap';
import { trpc } from '@/trpc/client';
import { geoJSONToPaths } from '@/lib/map-utils';
import {
  parseGeospatialFile,
  UNLIMITED_POLYGON_POINTS,
} from '@/lib/kmz-parser';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
import type { KawasanAttributeSuggestion } from '@/lib/shapefile-attributes';
import {
  groupPolygonsIntoKawasan,
  isImportable,
  type KawasanBulkHandoff,
  type KawasanImportGroup,
} from '@/lib/kawasan-bulk-import';
import {
  createPolygonId,
  isUsablePolygon,
  MIN_POLYGON_POINTS,
  polygonLabel,
  polygonsToMultiPolygon,
  validCoordinates,
} from '@/lib/land-polygons';
import {
  checkKawasanImportSize,
  countKawasanPoints,
  KAWASAN_COORDINATE_PAGE_SIZE,
} from '@/lib/kawasan-limits';
import {
  parseUtmInputStrings,
  toLatLonFromUtm,
  toUtmFromLatLon,
} from '@/lib/utm-conversion';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Layers, Lock, LockOpen, Plus, Shapes, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  GeoJSONMultiPolygon,
  GeographicCoordinate,
  LandPolygon,
} from '@/types';

interface LocalUtmRow {
  zone: string;
  hemisphere: 'N' | 'S';
  easting: string;
  northing: string;
}

interface KawasanGeometryEditorProps {
  initialGeoJSON?: unknown;
  /**
   * The geometry, plus the block list behind it. The form needs the blocks
   * themselves — the MultiPolygon has already dropped anything incomplete, so
   * it cannot tell whether a block was left half-drawn.
   */
  onChange: (geoJSON: GeoJSONMultiPolygon | null, polygons: LandPolygon[]) => void;
  /**
   * Form fields an imported file's attribute table can fill in. Reported here,
   * decided in the form: only it knows what the officer has already typed, and
   * a file must never overwrite that.
   */
  onAttributesDetected?: (attributes: KawasanAttributeSuggestion) => void;
  /**
   * Escalate to the bulk importer when the file turns out to describe several
   * kawasan rather than several blocks of one.
   *
   * Only Tambah Kawasan passes this: editing an existing kawasan is about one
   * row, so there is nothing to split there. When it is absent the editor keeps
   * its old behaviour and loads everything as blocks of this kawasan.
   */
  onBulkImportRequested?: (handoff: KawasanBulkHandoff) => void;
  /** Exclude this area's own polygon from the reference layer (edit mode) */
  excludeAreaId?: number;
}

/** A parsed file waiting on the officer to say what it is. */
interface PendingImport {
  fileName: string;
  /** Everything in the file, as blocks of one kawasan. */
  merged: LandPolygon[];
  /** The same rings, split by the name their features carry. */
  groups: KawasanImportGroup[];
  atribut?: KawasanAttributeSuggestion;
  /** Set when the file cannot be one kawasan; the merge option is then refused. */
  mergeBlockedReason: string | null;
}

/** Colour of the other blocks of this same kawasan on the map. */
const OTHER_POLYGON_COLOR = '#a855f7';

/**
 * Read the stored geometry (Polygon or MultiPolygon, parsed or as the string
 * PostGIS returns) back into an editable polygon list.
 */
function toPolygons(geo: unknown): LandPolygon[] {
  return geoJSONToPaths(geo).map((rawRing, index) => {
    let ring = rawRing;
    // Drop the duplicated closing vertex (GeoJSON rings are closed) so the map
    // doesn't get a double-closed polygon.
    if (ring.length >= 2) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first.lat === last.lat && first.lng === last.lng) ring = ring.slice(0, -1);
    }
    return {
      id: `P-kawasan-${index}`,
      coordinates: ring.map((point, pointIndex) => ({
        id: `C-kawasan-${index}-${pointIndex}`,
        latitude: point.lat,
        longitude: point.lng,
      })),
    };
  });
}

export function KawasanGeometryEditor({
  initialGeoJSON,
  onChange,
  onAttributesDetected,
  onBulkImportRequested,
  excludeAreaId,
}: KawasanGeometryEditorProps) {
  const [polygons, setPolygons] = useState<LandPolygon[]>(() => toPolygons(initialGeoJSON));
  const [activePolygonId, setActivePolygonId] = useState<string | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(() =>
    toPolygons(initialGeoJSON).some(isUsablePolygon) ? 1 : 0
  );
  const [isParsing, setIsParsing] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const activePolygonIndex = useMemo(() => {
    const index = polygons.findIndex((polygon) => polygon.id === activePolygonId);
    return index >= 0 ? index : 0;
  }, [polygons, activePolygonId]);

  const activePolygon: LandPolygon | undefined = polygons[activePolygonIndex];
  const coordinates = useMemo(
    () => activePolygon?.coordinates ?? [],
    [activePolygon]
  );
  const isActiveLocked = Boolean(activePolygon?.locked);

  // Every kawasan and every mapped pengajuan, unpaged: this layer is what an
  // officer checks a new boundary against, so a page of it would quietly hide
  // the very clash they are looking for.
  const { data: areasData } = trpc.prohibitedAreas.geometriSemua.useQuery();
  const { data: submissionsData } = trpc.submissions.listMapPolygons.useQuery();

  const referencePolygons = useMemo<ReferencePolygon[]>(() => {
    const result: ReferencePolygon[] = [];

    // The other blocks of the kawasan being edited.
    polygons.forEach((polygon, index) => {
      if (index === activePolygonIndex) return;
      const path = validCoordinates(polygon.coordinates).map((coord) => ({
        lat: Number(coord.latitude),
        lng: Number(coord.longitude),
      }));
      if (path.length < MIN_POLYGON_POINTS) return;
      result.push({
        id: `blok-${polygon.id}`,
        path,
        strokeColor: OTHER_POLYGON_COLOR,
        fillColor: OTHER_POLYGON_COLOR,
        label: `Blok lain: ${polygonLabel(polygon, index)}`,
      });
    });

    const areas = (areasData ?? []) as Array<{
      id: number;
      namaKawasan: string;
      warna?: string | null;
      geom?: unknown;
    }>;
    areas.forEach((area) => {
      if (excludeAreaId && area.id === excludeAreaId) return;
      const color = KAWASAN_NON_SPPTG_COLOR;
      geoJSONToPaths(area.geom).forEach((path, i) => {
        result.push({
          id: `kw-${area.id}-${i}`,
          path,
          strokeColor: color,
          fillColor: color,
          label: `Non-SPPTG: ${area.namaKawasan}`,
        });
      });
    });

    // `listMapPolygons` is already filtered server-side to valid
    // terdaftar/terdata, and carries no applicant name — which suits a
    // reference layer: the officer needs to see *that* a claim is there and
    // where, not whose it is.
    const subs = (submissionsData ?? []) as Array<{
      id: number;
      status: string;
      desaNama: string | null;
      geoJSON?: unknown;
    }>;
    subs.forEach((sub) => {
      const color = sub.status === 'SPPTG terdaftar' ? '#22c55e' : '#3b82f6';
      geoJSONToPaths(sub.geoJSON).forEach((path, i) => {
        result.push({
          id: `sp-${sub.id}-${i}`,
          path,
          strokeColor: color,
          fillColor: color,
          label: `${sub.status} #${sub.id}${sub.desaNama ? ` — ${sub.desaNama}` : ''}`,
        });
      });
    });

    // No cap: every block of this kawasan, every other kawasan and every valid
    // SPPTG is drawn. A reference layer showing a subset is worse than a slow
    // one — an officer cannot tell a boundary that is absent from one that is
    // not there, and this layer exists precisely to be checked against.
    return result;
  }, [polygons, activePolygonIndex, areasData, submissionsData, excludeAreaId]);

  /** Persist a new block list and report the resulting geometry upwards. */
  const applyPolygons = useCallback(
    (next: LandPolygon[], recenter = false) => {
      setPolygons(next);
      onChange(polygonsToMultiPolygon(next), next);
      if (recenter) setRecenterSignal((v) => v + 1);
    },
    [onChange]
  );

  const updateActiveCoordinates = useCallback(
    (next: GeographicCoordinate[], recenter = false) => {
      if (polygons.length === 0) {
        applyPolygons([{ id: createPolygonId(), coordinates: next }], recenter);
        return;
      }
      applyPolygons(
        polygons.map((polygon, index) =>
          index === activePolygonIndex ? { ...polygon, coordinates: next } : polygon
        ),
        recenter
      );
    },
    [applyPolygons, polygons, activePolygonIndex]
  );

  const [coordinateSystem, setCoordinateSystem] = useState<'geografis' | 'utm'>('geografis');
  const [utmRows, setUtmRows] = useState<LocalUtmRow[]>([]);
  const [editingUtm, setEditingUtm] = useState(false);

  /**
   * The coordinate table pages.
   *
   * An imported block runs to tens of thousands of vertices, and each row here
   * is two number inputs — a block of 249 210 points (the largest ring in the
   * provincial Kawasan Hutan shapefile) is roughly three quarters of a million
   * DOM nodes, which does not render, it hangs the tab. Paging keeps every
   * vertex reachable without ever asking the browser for more than a screenful.
   */
  const [coordinatePage, setCoordinatePage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(coordinates.length / KAWASAN_COORDINATE_PAGE_SIZE));
  // Clamped rather than reset, so deleting the last row of the last page cannot
  // strand the table on a page that no longer exists.
  const safePage = Math.min(coordinatePage, pageCount - 1);
  const pageStart = safePage * KAWASAN_COORDINATE_PAGE_SIZE;
  const visibleCoordinates = useMemo(
    () => coordinates.slice(pageStart, pageStart + KAWASAN_COORDINATE_PAGE_SIZE),
    [coordinates, pageStart]
  );

  /** Move to another block and start its table at the top. */
  const selectPolygon = useCallback((polygonId: string) => {
    setActivePolygonId(polygonId);
    setCoordinatePage(0);
  }, []);

  // Derive the UTM view from the *visible* rows while not editing a cell.
  // Converting every vertex of a 100 000-point block on each keystroke is work
  // nobody can see.
  useEffect(() => {
    if (coordinateSystem !== 'utm' || editingUtm) return;

    setUtmRows(
      visibleCoordinates.map((c) => {
        const u = toUtmFromLatLon(c.latitude, c.longitude);
        return {
          zone: String(u.zone),
          hemisphere: u.hemisphere,
          easting: u.easting.toFixed(2),
          northing: u.northing.toFixed(2),
        };
      })
    );
  }, [visibleCoordinates, coordinateSystem, editingUtm]);

  const handleAddPolygon = () => {
    const created: LandPolygon = { id: createPolygonId(), coordinates: [] };
    applyPolygons([...polygons, created]);
    selectPolygon(created.id);
    toast.info('Blok baru ditambahkan. Gambar polygon-nya di peta.');
  };

  const handleRemovePolygon = (polygonId: string) => {
    const remaining = polygons.filter((polygon) => polygon.id !== polygonId);
    applyPolygons(remaining, true);
    if (activePolygonId === polygonId) {
      const next = remaining[0]?.id ?? null;
      setActivePolygonId(next);
      setCoordinatePage(0);
    }
  };

  /**
   * Flip the lock on one block, both ways — lifted to correct a bad import, put
   * back once the boundary is right. See the note at the top of this file.
   */
  const handleToggleLock = (polygonId: string) => {
    const target = polygons.find((polygon) => polygon.id === polygonId);
    if (!target) return;
    const nextLocked = !target.locked;
    // Nothing to protect yet, and a locked empty block cannot be drawn at all.
    if (nextLocked && target.coordinates.length === 0) {
      toast.error('Blok masih kosong. Gambar polygon-nya dulu sebelum dikunci.');
      return;
    }

    applyPolygons(
      polygons.map((polygon) =>
        polygon.id === polygonId ? { ...polygon, locked: nextLocked } : polygon
      )
    );
    selectPolygon(polygonId);
    toast.info(
      nextLocked
        ? 'Blok dikunci. Koordinatnya tidak dapat diubah sampai kunci dibuka lagi.'
        : 'Kunci dibuka. Koordinat blok ini sekarang dapat diubah.'
    );
  };

  const handleAddPoint = () => {
    updateActiveCoordinates([
      ...coordinates,
      { id: `C-${Date.now()}`, latitude: 0, longitude: 0 },
    ]);
    // Jump to where the new row actually landed, or "Tambah Titik" appears to
    // do nothing whenever the table is not on its last page.
    setCoordinatePage(Math.floor(coordinates.length / KAWASAN_COORDINATE_PAGE_SIZE));
  };

  const handleRemovePoint = (index: number) => {
    updateActiveCoordinates(
      coordinates.filter((_, i) => i !== index),
      true
    );
  };

  const handleGeoChange = (
    index: number,
    field: 'latitude' | 'longitude',
    value: number
  ) => {
    updateActiveCoordinates(
      coordinates.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleUtmInputChange = (index: number, field: keyof LocalUtmRow, value: string) => {
    setUtmRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const commitUtmRow = (index: number, row: LocalUtmRow) => {
    setEditingUtm(false);
    const parsed = parseUtmInputStrings(row);
    if (!parsed) {
      toast.error('Koordinat UTM tidak valid. Periksa zone, easting, dan northing.');
      return;
    }
    const latLon = toLatLonFromUtm(parsed);
    if (!latLon) {
      toast.error('Gagal mengonversi koordinat UTM.');
      return;
    }
    updateActiveCoordinates(
      coordinates.map((c, i) =>
        i === index ? { ...c, latitude: latLon.latitude, longitude: latLon.longitude } : c
      ),
      true
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  /**
   * Import every polygon in the file as a block of this kawasan. Imported blocks
   * arrive locked — see the note at the top of this file.
   *
   * The parser is still told `UNLIMITED_POLYGON_POINTS`: the 100-vertex default
   * belongs to the pengajuan wizard, whose bidang live as JSON in a draft
   * payload, while a kawasan goes straight into a PostGIS column and a Kawasan
   * Hutan traced from an SK is routinely thousands of points. What *does* apply
   * is the whole-kawasan ceiling in `kawasan-limits.ts`, checked here — and a
   * file over it is **refused, never truncated**: a kawasan silently missing
   * most of its blocks would be enforced against real pengajuan.
   */
  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const result = await parseGeospatialFile(file, {
        maxPoints: UNLIMITED_POLYGON_POINTS,
      });
      if (!result.success) {
        toast.error(result.error || 'Gagal memproses file geospasial');
        return;
      }

      const importId = Date.now().toString(36);
      const imported: LandPolygon[] = [];
      result.polygons.forEach((polygon, index) => {
        const raw = polygon.coordinates.filter(
          (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
        );
        // Drop a duplicated closing point if present
        if (raw.length >= 2) {
          const first = raw[0];
          const last = raw[raw.length - 1];
          if (first.latitude === last.latitude && first.longitude === last.longitude) {
            raw.pop();
          }
        }
        if (raw.length < MIN_POLYGON_POINTS) return;

        imported.push({
          id: `P-imp-${importId}-${index}`,
          nama: polygon.name,
          coordinates: raw.map((c, pointIndex) => ({
            id: `C-imp-${importId}-${index}-${pointIndex}`,
            latitude: c.latitude,
            longitude: c.longitude,
          })),
          locked: true,
        });
      });

      if (imported.length === 0) {
        toast.error(`File harus berisi minimal ${MIN_POLYGON_POINTS} titik koordinat per polygon`);
        return;
      }

      const fits = checkKawasanImportSize(imported);

      // Does the file describe one kawasan in several blocks, or several
      // kawasan? Its own name column is what answers that, and only the officer
      // can confirm — so when it says "several" and this page can escalate, the
      // import waits for an answer instead of guessing.
      const groups = groupPolygonsIntoKawasan(result.polygons);
      if (onBulkImportRequested && groups.length > 1) {
        setPendingImport({
          fileName: file.name,
          merged: imported,
          groups,
          atribut: result.atribut,
          mergeBlockedReason: fits.ok ? null : (fits.message ?? null),
        });
        return;
      }

      if (!fits.ok) {
        // Long on purpose: the message has to say what is wrong *and* what to
        // do about it, because the fix is in QGIS, not here.
        toast.error(fits.message!, { duration: 12000 });
        return;
      }

      applyPolygons(imported, true);
      selectPolygon(imported[0].id);
      if (result.atribut) onAttributesDetected?.(result.atribut);
      const totalPoints = imported.reduce(
        (total, polygon) => total + polygon.coordinates.length,
        0
      );
      toast.success(
        `Berhasil mengimpor ${imported.length} polygon (${totalPoints} titik). Polygon terkunci mengikuti file — buka kunci bila perlu diubah.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memproses file geospasial');
    } finally {
      setIsParsing(false);
      input.value = '';
    }
  };

  const usableCount = polygons.filter(isUsablePolygon).length;

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="kawasan-file">
          Impor KML/KMZ/GPX/Shapefile (opsional)
        </Label>
        <Input
          id="kawasan-file"
          type="file"
          accept=".kml,.kmz,.gpx,.zip"
          onChange={handleFileUpload}
          disabled={isParsing}
          className="mt-1"
        />
        <p className="mt-1 text-xs text-gray-500">
          Semua polygon dalam file akan dimuat sebagai blok kawasan ini, dan
          terkunci agar sama persis dengan file aslinya. Kunci dapat dibuka dan
          dipasang kembali per blok. Atau gambar manual di peta di bawah.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Shapefile diunggah sebagai .zip berisi berkas lengkapnya (.shp, .dbf,
          .shx, .prj, .cpg). Sertakan .prj agar koordinat UTM dikonversi ke WGS 84.
        </p>
        {isParsing && <p className="mt-1 text-xs text-blue-600">Memproses file...</p>}
      </div>

      {/* The file describes several kawasan — ask, do not guess. Merging a
          provincial SK into one row would put one name on 187 different
          kawasan; splitting a genuinely multi-block kawasan would file each of
          its blocks as a kawasan of its own. Only the officer knows which. */}
      {pendingImport && (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <Layers className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-sm text-blue-900">
                <strong>
                  File ini berisi {pendingImport.groups.length.toLocaleString('id-ID')} nama
                  kawasan yang berbeda
                </strong>
              </p>
              <p className="mt-1 text-xs text-blue-800">
                {pendingImport.fileName} — {pendingImport.merged.length.toLocaleString('id-ID')}{' '}
                polygon, {countKawasanPoints(pendingImport.merged).toLocaleString('id-ID')} titik.
                Contoh nama: {pendingImport.groups.slice(0, 3).map((g) => g.nama).join(', ')}
                {pendingImport.groups.length > 3 ? ', …' : ''}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                const handoff: KawasanBulkHandoff = {
                  fileName: pendingImport.fileName,
                  groups: pendingImport.groups,
                  atribut: pendingImport.atribut,
                };
                setPendingImport(null);
                onBulkImportRequested?.(handoff);
              }}
              className="rounded-md border border-blue-300 bg-white p-3 text-left hover:border-blue-500 hover:bg-blue-50"
            >
              <p className="text-sm font-medium text-gray-900">
                Buat {pendingImport.groups.filter(isImportable).length.toLocaleString('id-ID')}{' '}
                kawasan terpisah
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                Impor massal — satu baris kawasan per nama pada file. Pilih ini
                untuk SK yang memuat banyak kawasan sekaligus.
              </p>
            </button>

            <button
              type="button"
              disabled={pendingImport.mergeBlockedReason !== null}
              onClick={() => {
                applyPolygons(pendingImport.merged, true);
                selectPolygon(pendingImport.merged[0].id);
                if (pendingImport.atribut) onAttributesDetected?.(pendingImport.atribut);
                toast.success(
                  `${pendingImport.merged.length.toLocaleString('id-ID')} polygon dimuat sebagai blok dari satu kawasan.`
                );
                setPendingImport(null);
              }}
              className="rounded-md border border-gray-300 bg-white p-3 text-left hover:border-gray-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-gray-300"
            >
              <p className="text-sm font-medium text-gray-900">
                Gabung jadi 1 kawasan ({pendingImport.merged.length.toLocaleString('id-ID')} blok)
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                {pendingImport.mergeBlockedReason
                  ? 'Tidak dapat digabung — file terlalu besar untuk satu kawasan.'
                  : 'Semua polygon menjadi blok dari kawasan yang sedang Anda buat.'}
              </p>
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPendingImport(null)}
          >
            Batalkan impor
          </Button>
        </div>
      )}

      {/* Block selector — a kawasan may consist of several detached polygons */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shapes className="h-4 w-4 text-gray-600" />
            <p className="text-sm font-medium text-gray-900">
              Blok Kawasan ({polygons.length})
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddPolygon}>
            <Plus className="mr-1 h-4 w-4" />
            Tambah Blok
          </Button>
        </div>

        {polygons.length === 0 ? (
          <p className="text-xs text-gray-500">
            Belum ada blok. Gambar di peta, impor file, atau tambah titik koordinat.
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
                      selectPolygon(polygon.id);
                      setRecenterSignal((v) => v + 1);
                    }}
                    className="font-medium"
                  >
                    {polygonLabel(polygon, index)}
                    <span className="ml-1 font-normal text-gray-500">
                      ({polygon.coordinates.length} titik)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleLock(polygon.id)}
                    className={
                      polygon.locked
                        ? 'text-amber-600 hover:text-amber-700'
                        : 'text-gray-400 hover:text-gray-700'
                    }
                    aria-label={`${polygon.locked ? 'Buka kunci' : 'Kunci'} ${polygonLabel(polygon, index)}`}
                    title={
                      polygon.locked
                        ? 'Terkunci — klik untuk mengubah koordinat'
                        : 'Klik untuk mengunci agar koordinat tidak berubah'
                    }
                  >
                    {polygon.locked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <LockOpen className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemovePolygon(polygon.id)}
                    className="text-red-600 hover:text-red-700"
                    aria-label={`Hapus ${polygonLabel(polygon, index)}`}
                    title="Hapus blok"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activePolygon && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isActiveLocked ? (
              <p className="flex items-center gap-1.5 text-amber-700">
                <Lock className="h-3.5 w-3.5" />
                Blok ini terkunci — koordinat dan peta tidak dapat diubah. Buka kunci
                bila batasnya perlu diperbaiki.
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-gray-500">
                <LockOpen className="h-3.5 w-3.5" />
                Blok ini dapat diubah. Kunci bila batasnya sudah benar, agar tidak
                tergeser saat menggambar blok lain.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleToggleLock(activePolygon.id)}
            >
              {isActiveLocked ? (
                <>
                  <LockOpen className="mr-1 h-3.5 w-3.5" />
                  Buka Kunci
                </>
              ) : (
                <>
                  <Lock className="mr-1 h-3.5 w-3.5" />
                  Kunci Blok
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <fieldset disabled={isActiveLocked} className="min-w-0">
        <div className="flex items-center justify-between">
          <Label>
            Titik Koordinat (Long/Lat atau UTM)
            {polygons.length > 1 && activePolygon
              ? ` — ${polygonLabel(activePolygon, activePolygonIndex)}`
              : ''}
          </Label>
          <Button type="button" variant="outline" size="sm" onClick={handleAddPoint}>
            <Plus className="mr-1 h-4 w-4" />
            Tambah Titik
          </Button>
        </div>

        <RadioGroup
          value={coordinateSystem}
          onValueChange={(v) => setCoordinateSystem(v as 'geografis' | 'utm')}
          className="mt-2 flex gap-4"
          // Switching the view is reading, not editing — allowed while locked.
          disabled={false}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="geografis" id="kw-cs-geo" />
            <Label htmlFor="kw-cs-geo" className="cursor-pointer">Geografis (Lat/Long)</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="utm" id="kw-cs-utm" />
            <Label htmlFor="kw-cs-utm" className="cursor-pointer">UTM</Label>
          </div>
        </RadioGroup>

        {coordinates.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">
            Belum ada titik. Tambah titik, impor file, atau gambar di peta.
          </p>
        ) : (
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
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
                      <TableHead>Easting</TableHead>
                      <TableHead>Northing</TableHead>
                    </>
                  )}
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {coordinateSystem === 'geografis'
                  ? visibleCoordinates.map((c, pageIndex) => {
                      // Absolute position in the block — every handler below
                      // writes by index, and a page-local one would edit the
                      // wrong vertex on page 2 onwards.
                      const i = pageStart + pageIndex;
                      return (
                      <TableRow key={c.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.000001"
                            value={c.latitude || ''}
                            onChange={(e) => handleGeoChange(i, 'latitude', parseFloat(e.target.value) || 0)}
                            onBlur={() => setRecenterSignal((v) => v + 1)}
                            onKeyDown={handleKeyDown}
                            placeholder="-6.9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.000001"
                            value={c.longitude || ''}
                            onChange={(e) => handleGeoChange(i, 'longitude', parseFloat(e.target.value) || 0)}
                            onBlur={() => setRecenterSignal((v) => v + 1)}
                            onKeyDown={handleKeyDown}
                            placeholder="107.6"
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleRemovePoint(i)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })
                  : utmRows.map((r, pageIndex) => {
                      const i = pageStart + pageIndex;
                      return (
                      <TableRow key={coordinates[i]?.id ?? i}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <Input
                            className="w-16"
                            inputMode="numeric"
                            value={r.zone}
                            onFocus={() => setEditingUtm(true)}
                            onChange={(e) => handleUtmInputChange(pageIndex, 'zone', e.target.value)}
                            onBlur={(e) => commitUtmRow(i, { ...r, zone: e.currentTarget.value })}
                            onKeyDown={handleKeyDown}
                            placeholder="48"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={r.hemisphere}
                            onValueChange={(val) => {
                              handleUtmInputChange(pageIndex, 'hemisphere', val);
                              commitUtmRow(i, { ...r, hemisphere: val as 'N' | 'S' });
                            }}
                          >
                            <SelectTrigger className="w-16">
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
                            inputMode="decimal"
                            value={r.easting}
                            onFocus={() => setEditingUtm(true)}
                            onChange={(e) => handleUtmInputChange(pageIndex, 'easting', e.target.value)}
                            onBlur={(e) => commitUtmRow(i, { ...r, easting: e.currentTarget.value })}
                            onKeyDown={handleKeyDown}
                            placeholder="Easting"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            inputMode="decimal"
                            value={r.northing}
                            onFocus={() => setEditingUtm(true)}
                            onChange={(e) => handleUtmInputChange(pageIndex, 'northing', e.target.value)}
                            onBlur={(e) => commitUtmRow(i, { ...r, northing: e.currentTarget.value })}
                            onKeyDown={handleKeyDown}
                            placeholder="Northing"
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleRemovePoint(i)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        )}
      </fieldset>

      {/* Outside the fieldset on purpose: a locked block must still be
          browsable end to end — reading an imported boundary is exactly how you
          check the file was right, and `disabled` would seal it on page 1. */}
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
          <span className="text-gray-600">
            Titik {(pageStart + 1).toLocaleString('id-ID')}–
            {Math.min(pageStart + KAWASAN_COORDINATE_PAGE_SIZE, coordinates.length).toLocaleString('id-ID')}{' '}
            dari {coordinates.length.toLocaleString('id-ID')}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setCoordinatePage(safePage - 1)}
            >
              Sebelumnya
            </Button>
            <span className="text-gray-600">
              Hal. {(safePage + 1).toLocaleString('id-ID')} / {pageCount.toLocaleString('id-ID')}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setCoordinatePage(safePage + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}

      <div>
        <Label>Polygon Kawasan</Label>
        <div className="mt-1">
          <DrawingMap
            coordinates={coordinates}
            onCoordinatesChange={(coords) => updateActiveCoordinates(coords)}
            recenterSignal={recenterSignal}
            referencePolygons={referencePolygons}
            readOnly={isActiveLocked}
          />
        </div>

        {/* Legend */}
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold text-gray-900">Legenda Peta</p>
          <div className="grid grid-cols-2 gap-1">
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <span className="h-3.5 w-3.5 rounded-sm border" style={{ backgroundColor: '#f97316', borderColor: '#f97316' }} />
              Blok aktif (digambar)
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <span
                className="h-3.5 w-3.5 rounded-sm border"
                style={{ backgroundColor: OTHER_POLYGON_COLOR, borderColor: OTHER_POLYGON_COLOR }}
              />
              Blok lain kawasan ini
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <span className="h-3.5 w-3.5 rounded-sm border" style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }} />
              Kawasan Non-SPPTG lain
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <span className="h-3.5 w-3.5 rounded-sm border" style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }} />
              SPPTG terdaftar
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <span className="h-3.5 w-3.5 rounded-sm border" style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6' }} />
              SPPTG terdata
            </div>
          </div>
        </div>

        {usableCount > 0 ? (
          <p className="mt-2 text-xs text-green-600">
            ✓ Kawasan siap digunakan ({usableCount.toLocaleString('id-ID')} blok,{' '}
            {countKawasanPoints(polygons).toLocaleString('id-ID')} titik).
          </p>
        ) : (
          <p className="mt-2 text-xs text-gray-500">
            Belum ada polygon. Gambar minimal {MIN_POLYGON_POINTS} titik atau impor file.
          </p>
        )}
      </div>
    </div>
  );
}
