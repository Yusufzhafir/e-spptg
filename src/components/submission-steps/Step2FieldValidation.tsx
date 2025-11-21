import { useState } from 'react';
import {
  SubmissionDraft,
  ResearchTeamMember,
  BoundaryWitness,
  GeographicCoordinate,
  UploadedDocument,
  BoundaryDirection,
  OverlapResult,
} from '../../types';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
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
import { Plus, Trash2, Upload, MapPin, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Badge } from '../ui/badge';

interface Step2Props {
  draft: SubmissionDraft;
  onUpdateDraft: (updates: Partial<SubmissionDraft>) => void;
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

  const handleCheckOverlap = () => {
    // Simulate overlap check
    const mockOverlaps: OverlapResult[] = [
      {
        kawasanId: 'PA-002',
        namaKawasan: 'Tanah Pemerintah Kec. Harjamukti',
        jenisKawasan: 'Tanah Pemerintah',
        luasOverlap: 125,
      },
    ];

    // Randomly decide if there's overlap (for demo)
    const hasOverlap = Math.random() > 0.7;
    onUpdateDraft({ overlapResults: hasOverlap ? mockOverlaps : [] });
    setIsOverlapDialogOpen(true);
  };

  const luas = calculateArea();

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
                <p className="text-sm">Klik "Tambah Titik" untuk memulai</p>
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
            <div className="bg-gray-100 rounded-lg border border-gray-300 h-96 flex items-center justify-center relative">
              <div className="text-center text-gray-500">
                <MapPin className="w-16 h-16 mx-auto mb-3 text-gray-400" />
                <p>Pratinjau Polygon Lahan</p>
                <p className="text-sm">
                  {draft.coordinatesGeografis.length < 3
                    ? 'Minimal 3 titik diperlukan'
                    : `${draft.coordinatesGeografis.length} titik terdeteksi`}
                </p>
              </div>

              {/* Legend */}
              {draft.coordinatesGeografis.length >= 3 && (
                <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 border border-gray-200">
                  <p className="text-xs mb-2">Legenda:</p>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-600 opacity-60" />
                    <span className="text-xs">Polygon Lahan</span>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleCheckOverlap}
              variant="outline"
              className="w-full"
              disabled={draft.coordinatesGeografis.length < 3}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Cek Tumpang Tindih
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-sm space-y-2">
            <Label>Berita Acara Validasi Lapangan</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-600">Klik atau seret file PDF</p>
            </div>
          </div>

          <div className="text-sm space-y-2">
            <Label>Surat Pernyataan Jual Beli Lahan</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-600">Klik atau seret file PDF</p>
            </div>
          </div>

          <div className="text-sm space-y-2">
            <Label>Surat Pernyataan Asal Usul Tanah</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-600">Klik atau seret file PDF</p>
            </div>
          </div>

          <div className="text-sm space-y-2">
            <Label>Surat Pernyataan Tidak Sengketa</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-600">Klik atau seret file PDF</p>
            </div>
          </div>
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
