import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MapView } from './MapView';
import { StatusBadge } from './StatusBadge';
import { ChevronLeft, FileText, Clock, MessageSquare, File } from 'lucide-react';
import { StatusSPPTG, Submission } from '@/types';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { geomGeoJSONPolygonSchema } from '@/lib/validation';
import { findCenter } from '@/lib/utils';

interface DetailPageProps {
  submission: Submission;
  onBack: () => void;
  onStatusChange: (id: number, status: StatusSPPTG, alasan: string) => void;
}

export function DetailPage({ submission, onBack, onStatusChange }: DetailPageProps) {
  const [newStatus, setNewStatus] = useState<StatusSPPTG | ''>('');
  const [alasan, setAlasan] = useState('');

  const handleStatusChange = () => {
    if (!newStatus) {
      toast.error('Pilih status terlebih dahulu');
      return;
    }

    if ((newStatus === 'SPPTG ditolak' || newStatus === 'SPPTG ditinjau ulang') && !alasan.trim()) {
      toast.error('Alasan wajib diisi untuk status ini');
      return;
    }

    onStatusChange(submission.id, newStatus, alasan);
    toast.success('Perubahan status berhasil disimpan');
    setNewStatus('');
    setAlasan('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Kembali ke Dashboard
        </Button>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Detail Pengajuan SPPTG</CardTitle>
              <p className="text-sm text-gray-600 mt-1">ID: {submission.id}</p>
            </div>
            <StatusBadge status={submission.status} />
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Map */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Peta Lokasi Lahan</CardTitle>
          </CardHeader>
          <CardContent>
            <MapView
              submissions={[submission]}
              selectedSubmission={submission}
              height="500px"
              center={findCenter(
                geomGeoJSONPolygonSchema
                  .parse(submission.geoJSON)
                  .coordinates[0]
                  .map(([lng, lat]) => ({ lng, lat }))
              )}
              zoom={15}
            />

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="mb-3">Metadata Lahan</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Luas</p>
                  <p>{submission.luas.toLocaleString()} m²</p>
                </div>
                <div>
                  <p className="text-gray-600">Penggunaan</p>
                  <p>{submission.penggunaanLahan}</p>
                </div>
                <div>
                  <p className="text-gray-600">Lokasi</p>
                  <p>
                    {submission.villageId}, {submission.kecamatan}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Tanggal Pengajuan</p>
                  <p>{submission.tanggalPengajuan.toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Verification Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Panel Verifikasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Ubah Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as StatusSPPTG)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status baru" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SKT terdaftar">SPPTG terdaftar</SelectItem>
                  <SelectItem value="SKT terdata">SPPTG terdata</SelectItem>
                  <SelectItem value="SKT ditolak">SPPTG ditolak</SelectItem>
                  <SelectItem value="SKT ditinjau ulang">SPPTG ditinjau ulang</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alasan">
                Alasan {(newStatus === 'SPPTG ditolak' || newStatus === 'SPPTG ditinjau ulang') && '*'}
              </Label>
              <Textarea
                id="alasan"
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Masukkan alasan perubahan status..."
                rows={4}
                className={
                  (newStatus === 'SPPTG ditolak' || newStatus === 'SPPTG ditinjau ulang') && !alasan
                    ? 'border-red-300'
                    : ''
                }
              />
              {(newStatus === 'SPPTG ditolak' || newStatus === 'SPPTG ditinjau ulang') && (
                <p className="text-xs text-red-600">Wajib diisi untuk status ini</p>
              )}
            </div>

            <Button onClick={handleStatusChange} className="w-full">
              Simpan Perubahan
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="informasi">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="informasi">
                <FileText className="w-4 h-4 mr-2" />
                Informasi
              </TabsTrigger>
              <TabsTrigger value="dokumen">
                <FileText className="w-4 h-4 mr-2" />
                Dokumen
              </TabsTrigger>
              <TabsTrigger value="riwayat">
                <Clock className="w-4 h-4 mr-2" />
                Riwayat Status
              </TabsTrigger>
              <TabsTrigger value="komentar">
                <MessageSquare className="w-4 h-4 mr-2" />
                Komentar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="informasi" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="mb-4">Data Pemilik</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Nama Pemilik</p>
                      <p>{submission.namaPemilik}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">NIK</p>
                      <p>{submission.nik}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Alamat</p>
                      <p>{submission.alamat}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Nomor HP</p>
                      <p>{submission.nomorHP}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p>{submission.email}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-4">Data Lahan</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Desa</p>
                      <p>{submission.villageId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Kecamatan</p>
                      <p>{submission.kecamatan}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Kabupaten</p>
                      <p>{submission.kabupaten}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Luas</p>
                      <p>{submission.luas.toLocaleString()} m²</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Penggunaan Lahan</p>
                      <p>{submission.penggunaanLahan}</p>
                    </div>
                    {submission.catatan && (
                      <div>
                        <p className="text-sm text-gray-600">Catatan</p>
                        <p>{submission.catatan}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dokumen" className="mt-4">
              <div className="p-8 text-center bg-gray-50 rounded-lg">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Dokumen pendukung</p>
                <Button variant="link" className="mt-2">
                  Lihat Dokumen
                </Button>

                <a
                  href="/E-SPPTG dan Lampiran.pdf"
                  download
                  className='w-full bg-white border rounded-2xl border-dashed flex p-4 cursor-pointer'
                >
                  <File />
                  <div className='w-full'>
                    dokumen spptg
                  </div>
                </a>
              </div>
            </TabsContent>

            <TabsContent value="riwayat" className="mt-4">
              <div className="space-y-4">
                {submission.riwayat.map((item, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <StatusBadge status={item.status} />
                      <p className="text-sm text-gray-600">{item.tanggal}</p>
                    </div>
                    <p className="text-sm">Petugas: {item.petugas}</p>
                    {item.alasan && (
                      <p className="text-sm text-gray-700 mt-2">
                        <span className="text-gray-600">Alasan:</span> {item.alasan}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="komentar" className="mt-4">
              <div className="space-y-4">
                <Textarea placeholder="Tambahkan komentar internal..." rows={3} />
                <Button>Kirim Komentar</Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
