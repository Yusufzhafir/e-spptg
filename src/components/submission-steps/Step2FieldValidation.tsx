"use client";
import { useState, useEffect, useCallback } from 'react';
import proj4 from 'proj4';
import {
  SubmissionDraft,
  ResearchTeamMember,
  BoundaryWitness,
  GeographicCoordinate,
  BoundaryDirection,
  CoordinateSystem,
} from '../../types';
import { trpc } from '@/trpc/client';
import { DrawingMap } from '../maps/DrawingMap';

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
import { Plus, Trash2, MapPin, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FileUploadField } from '@/components/FileUploadField';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Define UTM type for local state/handling
interface LocalUTMCoordinate {
  id: string;
  zone: string;
  hemisphere: 'N' | 'S';
  easting: number;
  northing: number;
}

interface Step2Props {
  draft: SubmissionDraft;
  onUpdateDraft: (updates: Partial<SubmissionDraft>) => void;
}

type NewWitness = { nama?: string, sisi?: BoundaryDirection };

export function Step2FieldValidation({ draft, onUpdateDraft }: Step2Props) {
  const [isOverlapDialogOpen, setIsOverlapDialogOpen] = useState(false);
  const [newWitness, setNewWitness] = useState<NewWitness>({ nama: '', sisi: '' as BoundaryDirection });
  
  // Local state for UTM coordinates to prevent rounding issues during editing
  // We sync this with draft.coordinatesGeografis whenever draft changes or user edits
  const [utmCoordinates, setUtmCoordinates] = useState<LocalUTMCoordinate[]>([]);

  // Initialize coordinate system from draft or default to geografis
  const coordinateSystem = draft.coordinateSystem || 'geografis';

  // Helper to convert Lat/Long to UTM
  const toUTM = useCallback((lat: number, lon: number): Omit<LocalUTMCoordinate, 'id'> => {
    // Calculate zone
    const zone = Math.floor((lon + 180) / 6) + 1;
    const hemisphere = lat >= 0 ? 'N' : 'S';
    
    // Define projection
    const utmProj = `+proj=utm +zone=${zone} +${hemisphere === 'S' ? 'south' : 'north'} +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
    const wgs84Proj = 'EPSG:4326';
    
    const [easting, northing] = proj4(wgs84Proj, utmProj, [lon, lat]);
    
    return {
      zone: zone.toString(),
      hemisphere,
      easting: Number(easting.toFixed(2)),
      northing: Number(northing.toFixed(2)),
    };
  }, []);

  // Helper to convert UTM to Lat/Long
  const toLatLon = useCallback((utm: LocalUTMCoordinate): { latitude: number; longitude: number } => {
    const { zone, hemisphere, easting, northing } = utm;
    const utmProj = `+proj=utm +zone=${zone} +${hemisphere === 'S' ? 'south' : 'north'} +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
    const wgs84Proj = 'EPSG:4326';
    
    try {
      const [lon, lat] = proj4(utmProj, wgs84Proj, [easting, northing]);
      return { latitude: lat, longitude: lon };
    } catch (e) {
      console.error('Projection error:', e);
      return { latitude: 0, longitude: 0 };
    }
  }, []);

  // Sync UTM local state when switching to UTM mode or when draft coordinates change externally (e.g. map draw)
  useEffect(() => {
    if (coordinateSystem === 'utm') {
      const newUtmCoords = draft.coordinatesGeografis.map(geo => {
        // Check if we already have a matching UTM coord to preserve user input precision if possible
        // But if the geo coord has changed significantly (e.g. map drag), we must re-convert
        const converted = toUTM(geo.latitude, geo.longitude);
        return {
            id: geo.id,
            ...converted
        };
      });
      setUtmCoordinates(newUtmCoords);
    }
  }, [draft.coordinatesGeografis, coordinateSystem, toUTM]);

  const handleSystemChange = (value: CoordinateSystem) => {
    onUpdateDraft({ coordinateSystem: value });
  };

  const handleAddWitness = () => {
    if (!newWitness.nama) {
      toast.error('Nama saksi harus diisi');
      return;
    }

    if (!newWitness.sisi) {
      toast.error('Sisi batas harus dipilih');
      return;
    }

    const witness: BoundaryWitness = {
      id: `W-${Date.now()}`,
      nama: newWitness.nama,
      sisi: newWitness.sisi,
    };

    onUpdateDraft({ saksiList: [...draft.saksiList, witness] });
    setNewWitness({ nama: '', sisi: '' as BoundaryDirection  });
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

  const handleUpdateCoordinate = (id: string, field: 'latitude' | 'longitude', value: number) => {
    const updated = draft.coordinatesGeografis.map((coord) =>
      coord.id === id ? { ...coord, [field]: value } : coord
    );
    onUpdateDraft({ coordinatesGeografis: updated });
  };

  const handleUpdateUTM = (id: string, field: keyof LocalUTMCoordinate, value: any) => {
    // Update local UTM state first
    const updatedUtm = utmCoordinates.map(c => 
        c.id === id ? { ...c, [field]: value } : c
    );
    setUtmCoordinates(updatedUtm);

    // Convert to Lat/Long and update draft
    const changedCoord = updatedUtm.find(c => c.id === id);
    if (changedCoord) {
        const { latitude, longitude } = toLatLon(changedCoord);
        const updatedGeo = draft.coordinatesGeografis.map(c => 
            c.id === id ? { ...c, latitude, longitude } : c
        );
        // We only update draft if valid numbers
        if (!isNaN(latitude) && !isNaN(longitude)) {
            onUpdateDraft({ coordinatesGeografis: updatedGeo });
        }
    }
  };

  const handleRemoveCoordinate = (id: string) => {
    onUpdateDraft({
      coordinatesGeografis: draft.coordinatesGeografis.filter((c) => c.id !== id),
    });
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

      {/* Research Team */}
      <div className="space-y-4">
        <h3 className="text-gray-900">Tim Peneliti</h3>

        <div className="max-w-3xl">
          <div className="space-y-3 p-4 border border-gray-200 rounded-lg">
            <h4 className="text-sm text-gray-900">Juru Ukur</h4>
            <Input
              placeholder="Nama"
              value={draft.juruUkur?.nama || ''}
              onChange={(e) =>
                onUpdateDraft({
                  juruUkur: { ...draft.juruUkur, nama: e.target.value } as ResearchTeamMember,
                })
              }
            />
            <Input
              placeholder="Jabatan"
              value={draft.juruUkur?.jabatan || ''}
              onChange={(e) =>
                onUpdateDraft({
                  juruUkur: { ...draft.juruUkur, jabatan: e.target.value } as ResearchTeamMember,
                })
              }
            />
            <Input
              placeholder="Instansi"
              value={draft.juruUkur?.instansi || ''}
              onChange={(e) =>
                onUpdateDraft({
                  juruUkur: { ...draft.juruUkur, instansi: e.target.value } as ResearchTeamMember,
                })
              }
            />
            <Input
              placeholder="Nomor HP"
              value={draft.juruUkur?.nomorHP || ''}
              onChange={(e) =>
                onUpdateDraft({
                  juruUkur: { ...draft.juruUkur, nomorHP: e.target.value } as ResearchTeamMember,
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Boundary Witnesses */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h3 className="text-gray-900">Saksi Batas Lahan</h3>

        <div className="flex gap-2">
          <Input
            placeholder="Nama saksi"
            value={newWitness.nama}
            onChange={(e) => setNewWitness({ ...newWitness, nama: e.target.value })}
            className="flex-1"
          />
          <Select
            value={newWitness.sisi}
            onValueChange={(value) =>
              setNewWitness({ ...newWitness, sisi: value as BoundaryDirection })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
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
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.saksiList.map((witness) => (
                  <TableRow key={witness.id}>
                    <TableCell>{witness.nama}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{witness.sisi}</Badge>
                    </TableCell>
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Coordinates */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-900">Titik Koordinat Patok/Pal Batas</h3>
          <Button onClick={handleAddCoordinate} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Titik
          </Button>
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
                        <RadioGroupItem value="geografis" id="cs-geografis" />
                        <Label htmlFor="cs-geografis" className="cursor-pointer">Geografis (Lat/Lon)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="utm" id="cs-utm" />
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
                          <TableRow key={coord.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.000001"
                                value={coord.latitude || ''}
                                onChange={(e) =>
                                  handleUpdateCoordinate(
                                    coord.id,
                                    'latitude',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
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
                                    'longitude',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                placeholder="107.6"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveCoordinate(coord.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                        utmCoordinates.map((coord, index) => (
                          <TableRow key={coord.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                                <Input 
                                    min="1"
                                    max="60"
                                    value={coord.zone}
                                    onChange={(e) => handleUpdateUTM(coord.id, 'zone', e.target.value)}
                                    placeholder="48"
                                    className="w-16"
                                />
                            </TableCell>
                            <TableCell>
                                <Select 
                                    value={coord.hemisphere}
                                    onValueChange={(val) => handleUpdateUTM(coord.id, 'hemisphere', val)}
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
                                type="number"
                                value={coord.easting || ''}
                                onChange={(e) =>
                                  handleUpdateUTM(coord.id, 'easting', parseFloat(e.target.value) || 0)
                                }
                                placeholder="Easting"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={coord.northing || ''}
                                onChange={(e) =>
                                  handleUpdateUTM(coord.id, 'northing', parseFloat(e.target.value) || 0)
                                }
                                placeholder="Northing"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveCoordinate(coord.id)}
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
              onCoordinatesChange={(coords) => {
                // This callback is triggered when user draws/edits on the map
                // The coordinates are already synced, just update the draft
                onUpdateDraft({
                  coordinatesGeografis: coords,
                });
              }}
            />

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

        <FileUploadField
          label="Berita Acara Validasi Lapangan"
          value={draft.dokumenBeritaAcara}
          onChange={(doc) => onUpdateDraft({ dokumenBeritaAcara: doc })}
          category="Berita Acara"
          templateType="berita_acara_validasi_lapangan.pdf"
          draftId={draft.id}
          accept=".pdf"
          maxSize={10}
        />
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
                        <TableHead>Luas Overlap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draft.overlapResults.map((overlap, index) => (
                        <TableRow key={index}>
                          <TableCell>{overlap.namaKawasan}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{overlap.jenisKawasan}</Badge>
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
