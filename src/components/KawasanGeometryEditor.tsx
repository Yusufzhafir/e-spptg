'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { DrawingMap, type ReferencePolygon } from './maps/DrawingMap';
import { trpc } from '@/trpc/client';
import { coordinatesToGeoJSON, geoJSONToPaths } from '@/lib/map-utils';
import { parseGeospatialFile } from '@/lib/kmz-parser';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
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
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { GeoJSONPolygon, GeographicCoordinate } from '@/types';

interface LocalUtmRow {
  zone: string;
  hemisphere: 'N' | 'S';
  easting: string;
  northing: string;
}

interface KawasanGeometryEditorProps {
  initialGeoJSON?: unknown;
  onChange: (geoJSON: GeoJSONPolygon | null) => void;
  /** Exclude this area's own polygon from the reference layer (edit mode) */
  excludeAreaId?: number;
}

function toCoordinates(geo: unknown): GeographicCoordinate[] {
  const paths = geoJSONToPaths(geo);
  let ring = paths[0] ?? [];
  // Drop the duplicated closing vertex (GeoJSON rings are closed) so the map
  // doesn't get a double-closed polygon.
  if (ring.length >= 2) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) ring = ring.slice(0, -1);
  }
  return ring.map((p, i) => ({ id: `C-kawasan-${i}`, latitude: p.lat, longitude: p.lng }));
}

export function KawasanGeometryEditor({
  initialGeoJSON,
  onChange,
  excludeAreaId,
}: KawasanGeometryEditorProps) {
  const [coordinates, setCoordinates] = useState<GeographicCoordinate[]>(() =>
    toCoordinates(initialGeoJSON)
  );
  const [recenterSignal, setRecenterSignal] = useState(() =>
    toCoordinates(initialGeoJSON).length >= 3 ? 1 : 0
  );
  const [isParsing, setIsParsing] = useState(false);

  const { data: areasData } = trpc.prohibitedAreas.list.useQuery({ limit: 500, offset: 0 });
  const { data: submissionsData } = trpc.submissions.list.useQuery({ limit: 500, offset: 0 });

  const referencePolygons = useMemo<ReferencePolygon[]>(() => {
    const result: ReferencePolygon[] = [];

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
  }, [areasData, submissionsData, excludeAreaId]);

  const handleCoordinatesChange = (coords: GeographicCoordinate[]) => {
    setCoordinates(coords);
    onChange(coordinatesToGeoJSON(coords));
  };

  const [coordinateSystem, setCoordinateSystem] = useState<'geografis' | 'utm'>('geografis');
  const [utmRows, setUtmRows] = useState<LocalUtmRow[]>([]);
  const [editingUtm, setEditingUtm] = useState(false);

  // Derive the UTM view from the coordinates while not actively editing a cell
  useEffect(() => {
    if (coordinateSystem !== 'utm' || editingUtm) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror coords into the UTM view
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

  const applyCoordinates = (next: GeographicCoordinate[], recenter = false) => {
    setCoordinates(next);
    onChange(coordinatesToGeoJSON(next));
    if (recenter) setRecenterSignal((v) => v + 1);
  };

  const handleAddPoint = () => {
    applyCoordinates([
      ...coordinates,
      { id: `C-${Date.now()}`, latitude: 0, longitude: 0 },
    ]);
  };

  const handleRemovePoint = (index: number) => {
    applyCoordinates(
      coordinates.filter((_, i) => i !== index),
      true
    );
  };

  const handleGeoChange = (
    index: number,
    field: 'latitude' | 'longitude',
    value: number
  ) => {
    applyCoordinates(
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
    applyCoordinates(
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

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const result = await parseGeospatialFile(file);
      if (!result.success || !result.coordinates || result.coordinates.length === 0) {
        toast.error(result.error || 'Gagal memproses file geospasial');
        return;
      }

      const raw = result.coordinates.filter(
        (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
      );
      // Drop a duplicated closing point if present
      if (raw.length >= 2) {
        const first = raw[0];
        const last = raw[raw.length - 1];
        if (first.latitude === last.latitude && first.longitude === last.longitude) raw.pop();
      }
      if (raw.length < 3) {
        toast.error('File harus berisi minimal 3 titik koordinat');
        return;
      }

      const coords: GeographicCoordinate[] = raw.map((c, i) => ({
        id: `C-imp-${i}`,
        latitude: c.latitude,
        longitude: c.longitude,
      }));
      setCoordinates(coords);
      onChange(coordinatesToGeoJSON(coords));
      setRecenterSignal((v) => v + 1);
      toast.success(`Berhasil mengimpor ${coords.length} titik koordinat.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memproses file geospasial');
    } finally {
      setIsParsing(false);
      input.value = '';
    }
  };

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
          Impor otomatis menggambar polygon di peta. Atau gambar manual di peta di bawah.
        </p>
        {isParsing && <p className="mt-1 text-xs text-blue-600">Memproses file...</p>}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>Titik Koordinat (Long/Lat atau UTM)</Label>
          <Button type="button" variant="outline" size="sm" onClick={handleAddPoint}>
            <Plus className="mr-1 h-4 w-4" />
            Tambah Titik
          </Button>
        </div>

        <RadioGroup
          value={coordinateSystem}
          onValueChange={(v) => setCoordinateSystem(v as 'geografis' | 'utm')}
          className="mt-2 flex gap-4"
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
      </div>

      <div>
        <Label>Polygon Kawasan</Label>
        <div className="mt-1">
          <DrawingMap
            coordinates={coordinates}
            onCoordinatesChange={handleCoordinatesChange}
            recenterSignal={recenterSignal}
            referencePolygons={referencePolygons}
          />
        </div>

        {/* Legend */}
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold text-gray-900">Legenda Peta</p>
          <div className="grid grid-cols-2 gap-1">
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <span className="h-3.5 w-3.5 rounded-sm border" style={{ backgroundColor: '#f97316', borderColor: '#f97316' }} />
              Kawasan yang digambar
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

        {coordinates.length >= 3 ? (
          <p className="mt-2 text-xs text-green-600">
            ✓ Polygon siap digunakan ({coordinates.length} titik).
          </p>
        ) : (
          <p className="mt-2 text-xs text-gray-500">
            Belum ada polygon. Gambar minimal 3 titik atau impor file.
          </p>
        )}
      </div>
    </div>
  );
}
