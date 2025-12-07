"use client";
import { useState, useEffect, useRef } from 'react';
import {
  SubmissionDraft,
  ResearchTeamMember,
  BoundaryWitness,
  GeographicCoordinate,
  BoundaryDirection,
  OverlapResult,
  UploadedDocument,
} from '../../types';
import { trpc } from '@/trpc/client';
import dynamic from 'next/dynamic';
import type { Map } from 'leaflet';

// Dynamically import Leaflet components
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Polygon = dynamic(() => import('react-leaflet').then((mod) => mod.Polygon), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });

import 'leaflet/dist/leaflet.css';

// Component to capture map instance - must be rendered inside MapContainer
const MapInstanceCapture = dynamic(
  () =>
    import('react-leaflet').then((mod) => {
      const { useMap } = mod;
      return function MapInstanceCaptureComponent({
        mapRef,
      }: {
        mapRef: React.MutableRefObject<Map | null>;
      }) {
        const map = useMap();
        useEffect(() => {
          if (map) {
            mapRef.current = map;
          }
          return () => {
            mapRef.current = null;
          };
        }, [map, mapRef]);
        return null;
      };
    }),
  { ssr: false }
);

// Component to handle map click events - must be rendered inside MapContainer
const MapClickHandler = dynamic(
  () =>
    import('react-leaflet').then((mod) => {
      const { useMapEvents } = mod;
      return function MapClickHandlerComponent({
        onCoordinateAdd,
      }: {
        onCoordinateAdd: (lat: number, lng: number) => void;
      }) {
        useMapEvents({
          click: (e: any) => {
            const { lat, lng } = e.latlng;
            onCoordinateAdd(lat, lng);
          },
        });
        return null;
      };
    }),
  { ssr: false }
);

function InteractiveMap({
  coordinates,
  onCoordinateAdd,
  onCoordinateRemove,
}: {
  coordinates: GeographicCoordinate[];
  onCoordinateAdd: (lat: number, lng: number) => void;
  onCoordinateRemove: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef<Map | null>(null);
  const mapIdRef = useRef<string>(`interactive-map-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [center, setCenter] = useState<[number, number]>(
    coordinates.length > 0
      ? [coordinates[0].latitude, coordinates[0].longitude]
      : [-6.7100, 108.5550]
  );

  useEffect(() => {
    setMounted(true);
    
    // Fix Leaflet icon configuration on client side only
    if (typeof window !== 'undefined') {
      import('leaflet').then((L) => {
        delete (L.default.Icon.Default.prototype as any)._getIconUrl;
        L.default.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });
      });
    }
    
    // Cleanup function to destroy map on unmount
    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
          mapRef.current = null;
        } catch (error) {
          // Map might already be destroyed, ignore error
          console.warn('Error cleaning up map:', error);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (coordinates.length > 0) {
      setCenter([coordinates[0].latitude, coordinates[0].longitude]);
    }
  }, [coordinates]);

  if (!mounted) {
    return (
      <div className="bg-gray-100 rounded-lg border border-gray-300 h-96 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <MapPin className="w-16 h-16 mx-auto mb-3 text-gray-400" />
          <p>Memuat peta...</p>
        </div>
      </div>
    );
  }

  const polygonPositions: [number, number][] =
    coordinates.length >= 3
      ? coordinates.map((c) => [c.latitude, c.longitude] as [number, number])
      : [];

  return (
    <div 
      id={mapIdRef.current}
      className="bg-gray-100 rounded-lg border border-gray-300 h-96 relative"
    >
      {/* <MapContainer 
        key={mapIdRef.current}
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }} 
        scrollWheelZoom={true}
      >
        <MapInstanceCapture mapRef={mapRef} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onCoordinateAdd={onCoordinateAdd} />
        {polygonPositions.length >= 3 && (
          <Polygon
            positions={polygonPositions}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.3,
              weight: 2,
            }}
          />
        )}
        {coordinates.map((coord, index) => (
          <Marker
            key={coord.id}
            position={[coord.latitude, coord.longitude]}
            eventHandlers={{
              click: () => {
                if (confirm(`Hapus titik ${index + 1}?`)) {
                  onCoordinateRemove(coord.id);
                }
              },
            }}
          />
        ))}
      </MapContainer> */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 border border-gray-200 z-[1000]">
        <p className="text-xs mb-2 font-semibold">Instruksi:</p>
        <p className="text-xs text-gray-600">Klik pada peta untuk menambahkan titik koordinat</p>
        <p className="text-xs text-gray-600">Klik marker untuk menghapus titik</p>
        <p className="text-xs text-gray-500 mt-2">
          {coordinates.length < 3
            ? `Minimal 3 titik diperlukan (${coordinates.length}/3)`
            : `${coordinates.length} titik terdeteksi`}
        </p>
      </div>
    </div>
  );
}
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
import { Plus, Trash2, Upload, MapPin, AlertTriangle, File, X, CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { Button } from '../ui/button';

interface Step2Props {
  draft: SubmissionDraft;
  onUpdateDraft: (updates: Partial<SubmissionDraft>) => void;
}

function DocumentUploadField({
  label,
  value,
  onChange,
  category,
  draftId,
}: {
  label: string;
  value?: UploadedDocument;
  onChange: (doc?: UploadedDocument) => void;
  category: 'Berita Acara' | 'Pernyataan Jual Beli' | 'Asal Usul' | 'Tidak Sengketa';
  draftId?: number;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const createUploadUrlMutation = trpc.documents.createUploadUrl.useMutation();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 10 MB');
      return;
    }

    if (file.type !== 'application/pdf') {
      toast.error('Format file harus PDF');
      return;
    }

    if (!draftId) {
      toast.error('Draf belum dimuat');
      return;
    }

    setIsUploading(true);
    try {
      const { uploadUrl, publicUrl, documentId } = await createUploadUrlMutation.mutateAsync({
        draftId,
        category,
        filename: file.name,
        size: file.size,
        mimeType: 'application/pdf',
      });

      // Upload file to S3
      // Note: Only set Content-Type header to avoid CORS preflight issues
      // The presigned URL should handle authentication
      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': 'application/pdf' },
        });
      } catch (fetchError: any) {
        // Check for CORS or network errors
        if (fetchError.name === 'TypeError' || fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('CORS')) {
          throw new Error('Gagal mengunggah file: Masalah koneksi atau konfigurasi server (CORS). Silakan hubungi administrator.');
        }
        throw fetchError;
      }

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => 'Unknown error');
        throw new Error(`Gagal mengunggah file ke server: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      onChange({
        name: file.name,
        size: file.size,
        url: publicUrl,
        uploadedAt: new Date().toISOString(),
        documentId,
      });
      toast.success('Dokumen berhasil diunggah');
    } catch (error: any) {
      console.error('Upload error:', error);
      // Provide user-friendly error messages
      if (error.message?.includes('CORS') || error.message?.includes('koneksi')) {
        toast.error(error.message);
      } else if (error.message) {
        toast.error(error.message);
      } else {
        toast.error('Gagal mengunggah dokumen. Silakan coba lagi atau hubungi administrator jika masalah berlanjut.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="text-sm space-y-2">
      <Label>{label}</Label>
      {!value ? (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
          <Upload className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-xs text-gray-600">Klik atau seret file PDF</p>
          <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} disabled={isUploading} />
        </label>
      ) : (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <File className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900 truncate">{value.name}</p>
              <p className="text-xs text-gray-500">{(value.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange(undefined)} className="text-red-600">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      {isUploading && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-blue-600" />
          <span>Mengunggah...</span>
        </div>
      )}
    </div>
  );
}

export function Step2FieldValidation({ draft, onUpdateDraft }: Step2Props) {
  const [isOverlapDialogOpen, setIsOverlapDialogOpen] = useState(false);
  const [newWitness, setNewWitness] = useState({ nama: '', sisi: 'Utara' as BoundaryDirection });

  const handleAddWitness = () => {
    if (!newWitness.nama) {
      toast.error('Nama saksi harus diisi');
      return;
    }

    const witness: BoundaryWitness = {
      id: `W-${Date.now()}`,
      nama: newWitness.nama,
      sisi: newWitness.sisi,
    };

    onUpdateDraft({ saksiList: [...draft.saksiList, witness] });
    setNewWitness({ nama: '', sisi: 'Utara' });
    toast.success('Saksi berhasil ditambahkan');
  };

  const handleRemoveWitness = (id: string) => {
    onUpdateDraft({ saksiList: draft.saksiList.filter((w) => w.id !== id) });
    toast.info('Saksi dihapus');
  };

  const handleAddCoordinate = () => {
    const newCoord: GeographicCoordinate = {
      id: `C-${Date.now()}`,
      latitude: 0,
      longitude: 0,
    };
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
  }, [draft.coordinatesGeografis]);

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="space-y-3 p-4 border border-gray-200 rounded-lg">
            <h4 className="text-sm text-gray-900">Pihak BPD</h4>
            <Input
              placeholder="Nama"
              value={draft.pihakBPD?.nama || ''}
              onChange={(e) =>
                onUpdateDraft({
                  pihakBPD: { ...draft.pihakBPD, nama: e.target.value } as ResearchTeamMember,
                })
              }
            />
            <Input
              placeholder="Jabatan"
              value={draft.pihakBPD?.jabatan || ''}
              onChange={(e) =>
                onUpdateDraft({
                  pihakBPD: { ...draft.pihakBPD, jabatan: e.target.value } as ResearchTeamMember,
                })
              }
            />
            <Input
              placeholder="Nomor HP"
              value={draft.pihakBPD?.nomorHP || ''}
              onChange={(e) =>
                onUpdateDraft({
                  pihakBPD: { ...draft.pihakBPD, nomorHP: e.target.value } as ResearchTeamMember,
                })
              }
            />
          </div>

          <div className="space-y-3 p-4 border border-gray-200 rounded-lg">
            <h4 className="text-sm text-gray-900">Kepala Dusun Setempat</h4>
            <Input
              placeholder="Nama"
              value={draft.kepalaDusun?.nama || ''}
              onChange={(e) =>
                onUpdateDraft({
                  kepalaDusun: { ...draft.kepalaDusun, nama: e.target.value } as ResearchTeamMember,
                })
              }
            />
            <Input
              placeholder="Nomor HP"
              value={draft.kepalaDusun?.nomorHP || ''}
              onChange={(e) =>
                onUpdateDraft({
                  kepalaDusun: { ...draft.kepalaDusun, nomorHP: e.target.value } as ResearchTeamMember,
                })
              }
            />
          </div>

          <div className="space-y-3 p-4 border border-gray-200 rounded-lg">
            <h4 className="text-sm text-gray-900">RT Setempat</h4>
            <Input
              placeholder="Nama"
              value={draft.rtSetempat?.nama || ''}
              onChange={(e) =>
                onUpdateDraft({
                  rtSetempat: { ...draft.rtSetempat, nama: e.target.value } as ResearchTeamMember,
                })
              }
            />
            <Input
              placeholder="Nomor HP"
              value={draft.rtSetempat?.nomorHP || ''}
              onChange={(e) =>
                onUpdateDraft({
                  rtSetempat: { ...draft.rtSetempat, nomorHP: e.target.value } as ResearchTeamMember,
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
              <SelectItem value="Timur">Timur</SelectItem>
              <SelectItem value="Selatan">Selatan</SelectItem>
              <SelectItem value="Barat">Barat</SelectItem>
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
            <Label>Sistem Koordinat: Geografis (Lat, Lon)</Label>
            
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
                      <TableHead className="w-16">No.</TableHead>
                      <TableHead>Latitude</TableHead>
                      <TableHead>Longitude</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draft.coordinatesGeografis.map((coord, index) => (
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
                    ))}
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
          </div>

          {/* Map Preview */}
          <div className="space-y-3">
            <Label>Pratinjau Peta</Label>
            <InteractiveMap
              coordinates={draft.coordinatesGeografis}
              onCoordinateAdd={(lat, lng) => {
                const newCoord: GeographicCoordinate = {
                  id: `C-${Date.now()}`,
                  latitude: lat,
                  longitude: lng,
                };
                onUpdateDraft({
                  coordinatesGeografis: [...draft.coordinatesGeografis, newCoord],
                });
              }}
              onCoordinateRemove={(id) => {
                onUpdateDraft({
                  coordinatesGeografis: draft.coordinatesGeografis.filter((c) => c.id !== id),
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

        <DocumentUploadField
          label="Berita Acara Validasi Lapangan"
          value={draft.dokumenBeritaAcara}
          onChange={(doc) => onUpdateDraft({ dokumenBeritaAcara: doc })}
          category="Berita Acara"
          draftId={draft.id}
        />
        <DocumentUploadField
          label="Surat Pernyataan Jual Beli Lahan"
          value={draft.dokumenPernyataanJualBeli}
          onChange={(doc) => onUpdateDraft({ dokumenPernyataanJualBeli: doc })}
          category="Pernyataan Jual Beli"
          draftId={draft.id}
        />
        <DocumentUploadField
          label="Surat Pernyataan Asal Usul Tanah"
          value={draft.dokumenAsalUsul}
          onChange={(doc) => onUpdateDraft({ dokumenAsalUsul: doc })}
          category="Asal Usul"
          draftId={draft.id}
        />
        <DocumentUploadField
          label="Surat Pernyataan Tidak Sengketa"
          value={draft.dokumenTidakSengketa}
          onChange={(doc) => onUpdateDraft({ dokumenTidakSengketa: doc })}
          category="Tidak Sengketa"
          draftId={draft.id}
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
