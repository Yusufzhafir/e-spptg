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
 * like it erased the first. Imported polygons are locked and stay locked: the
 * file is the authority for where the boundary runs, and a nudged vertex would
 * silently put the kawasan somewhere the SK does not.
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
import { parseGeospatialFile } from '@/lib/kmz-parser';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
import {
  createPolygonId,
  isUsablePolygon,
  MIN_POLYGON_POINTS,
  polygonLabel,
  polygonsToMultiPolygon,
  validCoordinates,
} from '@/lib/land-polygons';
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
import { Lock, Plus, Shapes, Trash2 } from 'lucide-react';
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
  onChange: (geoJSON: GeoJSONMultiPolygon | null) => void;
  /** Exclude this area's own polygon from the reference layer (edit mode) */
  excludeAreaId?: number;
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
  excludeAreaId,
}: KawasanGeometryEditorProps) {
  const [polygons, setPolygons] = useState<LandPolygon[]>(() => toPolygons(initialGeoJSON));
  const [activePolygonId, setActivePolygonId] = useState<string | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(() =>
    toPolygons(initialGeoJSON).some(isUsablePolygon) ? 1 : 0
  );
  const [isParsing, setIsParsing] = useState(false);

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

  const { data: areasData } = trpc.prohibitedAreas.list.useQuery({ limit: 500, offset: 0 });
  const { data: submissionsData } = trpc.submissions.list.useQuery({ limit: 500, offset: 0 });

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

    const subs = (submissionsData?.items ?? []) as Array<{
      id: number;
      namaPemilik: string;
      status: string;
      isValid?: boolean;
      geoJSON?: unknown;
    }>;
    subs.forEach((sub) => {
      if (sub.status !== 'SPPTG terdaftar' && sub.status !== 'SPPTG terdata') return;
      if (sub.isValid === false) return;
      const color = sub.status === 'SPPTG terdaftar' ? '#22c55e' : '#3b82f6';
      geoJSONToPaths(sub.geoJSON).forEach((path, i) => {
        result.push({
          id: `sp-${sub.id}-${i}`,
          path,
          strokeColor: color,
          fillColor: color,
          label: `${sub.status}: ${sub.namaPemilik}`,
        });
      });
    });

    return result;
  }, [polygons, activePolygonIndex, areasData, submissionsData, excludeAreaId]);

  /** Persist a new block list and report the resulting geometry upwards. */
  const applyPolygons = useCallback(
    (next: LandPolygon[], recenter = false) => {
      setPolygons(next);
      onChange(polygonsToMultiPolygon(next));
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

  // Derive the UTM view from the active block while not editing a cell
  useEffect(() => {
    if (coordinateSystem !== 'utm' || editingUtm) return;

    setUtmRows(
      coordinates.map((c) => {
        const u = toUtmFromLatLon(c.latitude, c.longitude);
        return {
          zone: String(u.zone),
          hemisphere: u.hemisphere,
          easting: u.easting.toFixed(2),
          northing: u.northing.toFixed(2),
        };
      })
    );
  }, [coordinates, coordinateSystem, editingUtm]);

  const handleAddPolygon = () => {
    const created: LandPolygon = { id: createPolygonId(), coordinates: [] };
    applyPolygons([...polygons, created]);
    setActivePolygonId(created.id);
    toast.info('Blok baru ditambahkan. Gambar polygon-nya di peta.');
  };

  const handleRemovePolygon = (polygonId: string) => {
    const remaining = polygons.filter((polygon) => polygon.id !== polygonId);
    applyPolygons(remaining, true);
    if (activePolygonId === polygonId) {
      setActivePolygonId(remaining[0]?.id ?? null);
    }
  };

  const handleAddPoint = () => {
    updateActiveCoordinates([
      ...coordinates,
      { id: `C-${Date.now()}`, latitude: 0, longitude: 0 },
    ]);
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
   * are locked for good — see the note at the top of this file.
   */
  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
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

      applyPolygons(imported, true);
      setActivePolygonId(imported[0].id);
      const totalPoints = imported.reduce(
        (total, polygon) => total + polygon.coordinates.length,
        0
      );
      toast.success(
        `Berhasil mengimpor ${imported.length} polygon (${totalPoints} titik). Polygon terkunci mengikuti file.`
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
        <Label htmlFor="kawasan-file">Impor KML/KMZ/GPX (opsional)</Label>
        <Input
          id="kawasan-file"
          type="file"
          accept=".kml,.kmz,.gpx"
          onChange={handleFileUpload}
          disabled={isParsing}
          className="mt-1"
        />
        <p className="mt-1 text-xs text-gray-500">
          Semua polygon dalam file akan dimuat sebagai blok kawasan ini, dan
          terkunci agar sama persis dengan file aslinya. Atau gambar manual di peta
          di bawah.
        </p>
        {isParsing && <p className="mt-1 text-xs text-blue-600">Memproses file...</p>}
      </div>

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
                      setActivePolygonId(polygon.id);
                      setRecenterSignal((v) => v + 1);
                    }}
                    className="font-medium"
                  >
                    {polygonLabel(polygon, index)}
                    <span className="ml-1 font-normal text-gray-500">
                      ({polygon.coordinates.length} titik)
                    </span>
                  </button>
                  {polygon.locked && (
                    <Lock className="h-3 w-3 text-gray-500" aria-label="Terkunci" />
                  )}
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

        {isActiveLocked && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <Lock className="h-3.5 w-3.5" />
            Blok ini diimpor dari file dan tidak dapat diubah. Hapus blok lalu impor
            ulang bila batasnya keliru.
          </p>
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
                  ? coordinates.map((c, i) => (
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
                    ))
                  : utmRows.map((r, i) => (
                      <TableRow key={coordinates[i]?.id ?? i}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <Input
                            className="w-16"
                            inputMode="numeric"
                            value={r.zone}
                            onFocus={() => setEditingUtm(true)}
                            onChange={(e) => handleUtmInputChange(i, 'zone', e.target.value)}
                            onBlur={(e) => commitUtmRow(i, { ...r, zone: e.currentTarget.value })}
                            onKeyDown={handleKeyDown}
                            placeholder="48"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={r.hemisphere}
                            onValueChange={(val) => {
                              handleUtmInputChange(i, 'hemisphere', val);
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
                            onChange={(e) => handleUtmInputChange(i, 'easting', e.target.value)}
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
                            onChange={(e) => handleUtmInputChange(i, 'northing', e.target.value)}
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
                    ))}
              </TableBody>
            </Table>
          </div>
        )}
      </fieldset>

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
            ✓ Kawasan siap digunakan ({usableCount} blok,{' '}
            {polygons.reduce((total, polygon) => total + polygon.coordinates.length, 0)}{' '}
            titik).
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
