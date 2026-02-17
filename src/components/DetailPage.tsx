import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MapView } from './MapView';
import { StatusBadge } from './StatusBadge';
import { ChevronLeft, FileText, Clock, MessageSquare, File, Download, Loader2 } from 'lucide-react';
import { StatusSPPTG, Submission } from '@/types';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { geomGeoJSONPolygonSchema } from '@/lib/validation';
import { findCenter } from '@/lib/utils';
import { trpc } from '@/trpc/client';

interface DetailPageProps {
  submission: Submission;
  onBack: () => void;
  onStatusChange: (id: number, status: StatusSPPTG, alasan: string) => void;
}

export function DetailPage({ submission, onBack, onStatusChange }: DetailPageProps) {
  const [newStatus, setNewStatus] = useState<StatusSPPTG | ''>('');
  const [alasan, setAlasan] = useState('');
  const [openingDocumentId, setOpeningDocumentId] = useState<number | null>(null);
  const {
    data: documents,
    isLoading: isDocumentsLoading,
    isError: isDocumentsError,
    error: documentsError,
    refetch: refetchDocuments,
  } = trpc.documents.listBySubmission.useQuery({ submissionId: submission.id });
  const openDocumentMutation = trpc.documents.getSignedDownloadUrl.useMutation();

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatUploadedAt = (dateValue: Date | string) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleString('id-ID');
  };

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

  const handleOpenDocument = async (documentId: number) => {
    const previewTab = window.open('', '_blank', 'noopener,noreferrer');
    setOpeningDocumentId(documentId);

    try {
      const { signedUrl } = await openDocumentMutation.mutateAsync({ documentId });
      if (previewTab) {
        previewTab.location.href = signedUrl;
      } else {
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      if (previewTab) {
        previewTab.close();
      }
      toast.error(error instanceof Error ? error.message : 'Gagal membuka dokumen.');
    } finally {
      setOpeningDocumentId(null);
    }
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
              <CardTitle>Detail Pengajuan SKT</CardTitle>
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
                  {submission.luasManual != null && (
                    <p className="text-xs text-gray-500 mt-1">
                      (Manual: {submission.luasManual.toLocaleString()} m²)
                    </p>
                  )}
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
                  <SelectItem value="SKT terdaftar">SKT terdaftar</SelectItem>
                  <SelectItem value="SKT terdata">SKT terdata</SelectItem>
                  <SelectItem value="SKT ditolak">SKT ditolak</SelectItem>
                  <SelectItem value="SKT ditinjau ulang">SKT ditinjau ulang</SelectItem>
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
                      {submission.luasManual != null && (
                        <p className="text-xs text-gray-500 mt-1">
                          (Manual: {submission.luasManual.toLocaleString()} m²)
                        </p>
                      )}
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
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="mb-4 text-gray-900">Dokumen pendukung</h3>

                {isDocumentsLoading && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                    <span>Memuat dokumen...</span>
                  </div>
                )}

                {isDocumentsError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p>
                      {documentsError?.message || 'Gagal memuat dokumen.'}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => refetchDocuments()}
                    >
                      Coba Lagi
                    </Button>
                  </div>
                )}

                {!isDocumentsLoading && !isDocumentsError && documents?.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
                    <FileText className="mx-auto mb-2 h-10 w-10 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Belum ada dokumen untuk pengajuan ini.
                    </p>
                  </div>
                )}

                {!isDocumentsLoading && !isDocumentsError && documents && documents.length > 0 && (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-white p-4"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <File className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                          <div className="min-w-0">
                            <p className="truncate text-sm text-gray-900">{doc.filename}</p>
                            <p className="text-xs text-gray-500">
                              {doc.category} • {formatFileSize(doc.size)} • Diunggah{' '}
                              {formatUploadedAt(doc.uploadedAt)}
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDocument(doc.id)}
                          disabled={openingDocumentId === doc.id}
                          className="inline-flex items-center gap-2"
                        >
                          {openingDocumentId === doc.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Membuka...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4" />
                              Buka
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
