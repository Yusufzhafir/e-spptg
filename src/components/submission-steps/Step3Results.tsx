import { useMemo, useState } from 'react';
import { SubmissionDraft, StatusSPPTG, FeedbackData, UploadedDocument, Submission } from '../../types';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';


import { CheckCircle2, XCircle, MapPin, AlertTriangle, Upload, File, X } from 'lucide-react';
import { toast } from 'sonner';
import { ReadOnlyMap } from '@/components/maps/ReadOnlyMap';
import { coordinatesToGeoJSON } from '@/lib/map-utils';

interface Step3Props {
  draft: SubmissionDraft;
  onUpdateDraft: (updates: Partial<SubmissionDraft>) => void;
}

const alasanOptions = [
  'Dokumen tidak lengkap',
  'Dokumen tidak sah/tidak terbaca',
  'Ketidaksesuaian identitas (NIK/nama/alamat)',
  'Koordinat/polygon tidak valid',
  'Overlap dengan Kawasan Non-SPPTG',
  'Ketidaksesuaian riwayat kepemilikan',
  'Lainnya',
];

const dokumentOptions = [
  'KTP',
  'KK',
  'Kwitansi/Hibah/Warisan',
  'Surat Permohonan',
  'Berita Acara Lapangan',
  'Pernyataan Jual Beli',
  'Asal Usul',
  'Tidak Sengketa',
];

const templateFeedback = [
  {
    label: 'Dokumen tidak lengkap',
    text: '[Dokumen tidak lengkap] Harap unggah kembali: KTP, KK, dan surat permohonan dalam format PDF yang jelas.',
  },
  {
    label: 'Koordinat tidak valid',
    text: '[Koordinat tidak valid] Periksa urutan titik dan pastikan polygon tertutup tanpa self-intersection.',
  },
  {
    label: 'Overlap Non-SPPTG',
    text: '[Overlap Non-SPPTG] Terdapat tumpang tindih dengan kawasan terlarang. Ajukan revisi polygon atau lampirkan klarifikasi legal.',
  },
];

export function Step3Results({ draft, onUpdateDraft }: Step3Props) {
  const [selectedStatus, setSelectedStatus] = useState<StatusSPPTG | ''>(draft.status || '');
  const [alasanTerpilih, setAlasanTerpilih] = useState<string[]>(draft.feedback?.alasanTerpilih || []);
  const [dokumenTidakLengkap, setDokumenTidakLengkap] = useState<string[]>(
    draft.feedback?.dokumenTidakLengkap || []
  );
  const [detailFeedback, setDetailFeedback] = useState(draft.feedback?.detailFeedback || '');
  const [tanggalTenggat, setTanggalTenggat] = useState(draft.feedback?.tanggalTenggat || '');
  const [lampiranFeedback, setLampiranFeedback] = useState<UploadedDocument | undefined>(
    draft.feedback?.lampiranFeedback
  );
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isOverlapDetailOpen, setIsOverlapDetailOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const hasOverlap = draft.overlapResults && draft.overlapResults.length > 0;
  const requiresFeedback = selectedStatus === 'SPPTG ditolak' || selectedStatus === 'SPPTG ditinjau ulang';

  const handleAlasanToggle = (alasan: string) => {
    setAlasanTerpilih((prev) =>
      prev.includes(alasan) ? prev.filter((a) => a !== alasan) : [...prev, alasan]
    );
  };

  const handleDokumenToggle = (dokumen: string) => {
    setDokumenTidakLengkap((prev) =>
      prev.includes(dokumen) ? prev.filter((d) => d !== dokumen) : [...prev, dokumen]
    );
  };

  const applyTemplate = (template: string) => {
    setDetailFeedback(template);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format file harus PDF, JPG, atau PNG');
      return;
    }

    // Validate file size (10 MB)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 10) {
      toast.error('Ukuran file maksimal 10 MB');
      return;
    }

    setIsUploading(true);
    setTimeout(() => {
      setLampiranFeedback({
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toLocaleString('id-ID'),
      });
      setIsUploading(false);
      toast.success('Lampiran feedback berhasil diunggah.');
    }, 1000);
  };

  const handleRemoveLampiran = () => {
    setLampiranFeedback(undefined);
    toast.info('Lampiran dihapus.');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSaveDecision = () => {
    if (!selectedStatus) {
      toast.error('Harap pilih status keputusan');
      return;
    }

    if (requiresFeedback) {
      if (alasanTerpilih.length === 0) {
        toast.error('Harap pilih minimal satu alasan feedback');
        return;
      }

      if (!detailFeedback || detailFeedback.length < 20) {
        toast.error('Detail feedback wajib diisi minimal 20 karakter');
        return;
      }
    }

    // Show warning if trying to approve with overlap
    if (selectedStatus === 'SPPTG terdaftar' && hasOverlap) {
      setIsConfirmDialogOpen(true);
      return;
    }

    confirmSaveDecision();
  };

  const confirmSaveDecision = () => {
    const feedbackData: FeedbackData | undefined = requiresFeedback
      ? {
        alasanTerpilih,
        dokumenTidakLengkap: alasanTerpilih.includes('Dokumen tidak lengkap')
          ? dokumenTidakLengkap
          : undefined,
        detailFeedback,
        tanggalTenggat: tanggalTenggat || undefined,
        lampiranFeedback,
        timestamp: new Date().toISOString().split('T')[0],
        pemberi: 'Bambang Supriyanto', // Mock current user
      }
      : undefined;

    onUpdateDraft({
      status: selectedStatus as StatusSPPTG,
      feedback: feedbackData,
      verifikator: 12312,
      tanggalKeputusan: new Date().toLocaleDateString('id-ID'),
    });

    setIsConfirmDialogOpen(false);
    toast.success('Keputusan berhasil disimpan.');
  };

  const documents = [
    { label: 'KTP', uploaded: !!draft.dokumenKTP },
    { label: 'KK', uploaded: !!draft.dokumenKK },
    { label: 'Kwitansi Jual Beli', uploaded: !!draft.dokumenKwitansi },
    { label: 'Surat Permohonan', uploaded: !!draft.dokumenPermohonan },
    { label: 'Berita Acara Lapangan', uploaded: !!draft.dokumenBeritaAcara },
  ];

  const mapPreviewSubmission = useMemo<Submission | null>(() => {
    const geoJSON = coordinatesToGeoJSON(draft.coordinatesGeografis || []);
    if (!geoJSON) return null;

    return {
      id: -1,
      namaPemilik: draft.namaPemohon || 'Draft',
      nik: draft.nik || '',
      alamat: draft.alamatKTP || '-',
      nomorHP: draft.juruUkur?.nomorHP || '-',
      email: '-',
      villageId: draft.villageId || 0,
      kecamatan: draft.kecamatan || '-',
      kabupaten: draft.kabupaten || '-',
      luas: draft.luasLahan || 0,
      luasManual: draft.luasManual,
      penggunaanLahan: draft.penggunaanLahan || '-',
      catatan: null,
      geoJSON,
      status: draft.status || 'SPPTG terdata',
      tanggalPengajuan: new Date(),
      verifikator: draft.verifikator || null,
      riwayat: [],
      feedback: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }, [draft]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-2">Hasil Pengajuan</h2>
        <p className="text-gray-600">
          Tinjau ringkasan pengajuan dan tentukan status keputusan.
        </p>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Data Summary */}
        <div className="space-y-6">
          {/* Applicant Data */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-gray-900 mb-3">Data Pemohon</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Nama:</span>
                <span className="text-gray-900">{draft.namaPemohon || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">NIK:</span>
                <span className="text-gray-900">{draft.nik || '-'}</span>
              </div>
            </div>
          </div>

          {/* Documents Checklist */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-gray-900 mb-3">Kelengkapan Dokumen</h3>
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{doc.label}</span>
                  {doc.uploaded ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Lengkap</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-gray-400">
                      <XCircle className="w-4 h-4" />
                      <span>Belum</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Research Team Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-gray-900 mb-3">Tim Peneliti</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Juru Ukur:</span>{' '}
                <span className="text-gray-900">{draft.juruUkur?.nama || '-'}</span>
              </div>
            </div>
          </div>

          {/* Witnesses Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-gray-900 mb-3">Saksi Batas Lahan</h3>
            {draft.saksiList.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada saksi</p>
            ) : (
              <div className="space-y-2">
                {draft.saksiList.map((saksi) => (
                  <div key={saksi.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-900">{saksi.nama}</span>
                    <Badge variant="outline" className="text-xs">
                      {saksi.sisi}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Land Area */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Luas Lahan</p>
                <p className="text-2xl text-blue-900">
                  {draft.luasLahan?.toLocaleString('id-ID') || '0'} m²
                </p>
              </div>
              <MapPin className="w-10 h-10 text-blue-600" />
            </div>
            <p className="text-xs text-blue-700 mt-2">
              {draft.coordinatesGeografis.length} titik koordinat tercatat
            </p>
          </div>

          {/* Overlap Status */}
          <div
            className={
              hasOverlap
                ? 'bg-orange-50 border border-orange-200 rounded-lg p-4'
                : 'bg-green-50 border border-green-200 rounded-lg p-4'
            }
          >
            <div className="flex items-start gap-3">
              {hasOverlap ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-orange-900">
                      <strong>Ada Tumpang Tindih</strong>
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      {draft.overlapResults.length} kawasan non-SPPTG terdeteksi
                    </p>
                    <Button
                      variant="link"
                      onClick={() => setIsOverlapDetailOpen(true)}
                      className="text-orange-700 p-0 h-auto mt-2"
                    >
                      Lihat detail overlap →
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-green-900">
                      <strong>Tidak Ada Tumpang Tindih</strong>
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Lahan tidak overlap dengan kawasan non-SPPTG
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Map Preview & Decision */}
        <div className="space-y-6">
          {/* Map Preview */}
          <div>
            <h3 className="text-gray-900 mb-3">Peta Lahan yang Diajukan</h3>
            {mapPreviewSubmission ? (
              <ReadOnlyMap
                submissions={[mapPreviewSubmission]}
                selectedSubmission={mapPreviewSubmission}
                height="24rem"
                zoom={16}
                center={{
                  lat: draft.coordinatesGeografis[0]?.latitude || -6.9175,
                  lng: draft.coordinatesGeografis[0]?.longitude || 107.6191,
                }}
              />
            ) : (
              <div className="bg-gray-100 rounded-lg border border-gray-300 h-96 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MapPin className="w-16 h-16 mx-auto mb-3 text-gray-400" />
                  <p>Pratinjau Polygon Lahan</p>
                  <p className="text-sm">Belum ada koordinat valid</p>
                </div>
              </div>
            )}
          </div>

          {/* Status Decision */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-gray-900 mb-4">Keputusan Status</h3>
            <p className="text-sm text-gray-600 mb-4">
              Pilih status berdasarkan hasil verifikasi dokumen dan lapangan.
            </p>

            <div className="space-y-4">
              <Label htmlFor="status">
                Status SPPTG <span className="text-red-600">*</span>
              </Label>
              <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val as StatusSPPTG)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SPPTG terdaftar">SPPTG terdaftar</SelectItem>
                  <SelectItem value="SPPTG terdata">SPPTG terdata</SelectItem>
                  <SelectItem value="SPPTG ditinjau ulang">SPPTG ditinjau ulang</SelectItem>
                  <SelectItem value="SPPTG ditolak">SPPTG ditolak</SelectItem>
                </SelectContent>
              </Select>

              {selectedStatus && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">
                    <strong>Status yang dipilih:</strong>
                  </p>
                  <div className="mt-2">
                    <Badge
                      className={
                        selectedStatus === 'SPPTG terdaftar'
                          ? 'bg-green-100 text-green-700'
                          : selectedStatus === 'SPPTG terdata'
                            ? 'bg-blue-100 text-blue-700'
                            : selectedStatus === 'SPPTG ditinjau ulang'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                      }
                    >
                      {selectedStatus}
                    </Badge>
                  </div>
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    {selectedStatus === 'SPPTG terdata' && (
                      <p className="text-sm text-blue-800">
                        ℹ️ Pengajuan akan disimpan dengan status terdata. Tidak perlu menerbitkan SPPTG. Anda dapat langsung submit setelah menyimpan keputusan.
                      </p>
                    )}
                    {selectedStatus === 'SPPTG ditolak' && (
                      <p className="text-sm text-blue-800">
                        ℹ️ Keputusan penolakan akan disimpan dan feedback akan dikirim ke pemohon. Tidak perlu menerbitkan SPPTG.
                      </p>
                    )}
                    {selectedStatus === 'SPPTG ditinjau ulang' && (
                      <p className="text-sm text-blue-800">
                        ℹ️ Keputusan tinjau ulang akan disimpan dan feedback akan dikirim ke pemohon. Tidak perlu menerbitkan SPPTG.
                      </p>
                    )}
                    {selectedStatus === 'SPPTG terdaftar' && (
                      <p className="text-sm text-blue-800">
                        ✓ Langkah &quot;Penerbitan SPPTG&quot; akan terbuka setelah menyimpan keputusan.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Feedback Panel */}
              {requiresFeedback && (
                <div className="border-t pt-4 space-y-4">
                  <div>
                    <h4 className="text-gray-900 mb-3">Feedback untuk Pemohon</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Berikan alasan terstruktur dan instruksi perbaikan kepada pemohon.
                    </p>
                  </div>

                  {/* Alasan Terpilih */}
                  <div>
                    <Label className="mb-2 block">
                      Alasan <span className="text-red-600">*</span>
                    </Label>
                    <div className="space-y-2">
                      {alasanOptions.map((alasan) => (
                        <div key={alasan} className="flex items-center space-x-2">
                          <Checkbox
                            id={`alasan-${alasan}`}
                            checked={alasanTerpilih.includes(alasan)}
                            onCheckedChange={() => handleAlasanToggle(alasan)}
                          />
                          <label
                            htmlFor={`alasan-${alasan}`}
                            className="text-sm cursor-pointer text-gray-700"
                          >
                            {alasan}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dokumen Tidak Lengkap */}
                  {alasanTerpilih.includes('Dokumen tidak lengkap') && (
                    <div>
                      <Label className="mb-2 block">Dokumen yang Perlu Dilengkapi</Label>
                      <div className="space-y-2">
                        {dokumentOptions.map((dokumen) => (
                          <div key={dokumen} className="flex items-center space-x-2">
                            <Checkbox
                              id={`dokumen-${dokumen}`}
                              checked={dokumenTidakLengkap.includes(dokumen)}
                              onCheckedChange={() => handleDokumenToggle(dokumen)}
                            />
                            <label
                              htmlFor={`dokumen-${dokumen}`}
                              className="text-sm cursor-pointer text-gray-700"
                            >
                              {dokumen}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Template Cepat */}
                  <div>
                    <Label className="mb-2 block">Template Cepat</Label>
                    <div className="flex flex-wrap gap-2">
                      {templateFeedback.map((template) => (
                        <Button
                          key={template.label}
                          variant="outline"
                          size="sm"
                          onClick={() => applyTemplate(template.text)}
                        >
                          {template.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Detail Feedback */}
                  <div>
                    <Label htmlFor="detailFeedback">
                      Detail Feedback <span className="text-red-600">*</span>
                    </Label>
                    <Textarea
                      id="detailFeedback"
                      value={detailFeedback}
                      onChange={(e) => setDetailFeedback(e.target.value)}
                      placeholder="Jelaskan kekurangan dokumen atau instruksi perbaikan (minimal 20 karakter)..."
                      rows={4}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {detailFeedback.length} / 20 karakter minimal
                    </p>
                  </div>

                  {/* Tanggal Tenggat */}
                  <div>
                    <Label htmlFor="tanggalTenggat">Tanggal Tenggat Perbaikan (Opsional)</Label>
                    <Input
                      id="tanggalTenggat"
                      type="date"
                      value={tanggalTenggat}
                      onChange={(e) => setTanggalTenggat(e.target.value)}
                    />
                  </div>

                  {/* Lampiran Feedback */}
                  <div>
                    <Label>Lampiran Feedback (Opsional)</Label>
                    {!lampiranFeedback ? (
                      <div className="mt-2">
                        <label
                          htmlFor="lampiran-feedback"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600">
                              <span className="text-blue-600">Klik untuk unggah</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1">PDF/JPG/PNG (Maks. 10 MB)</p>
                          </div>
                          <input
                            id="lampiran-feedback"
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 mt-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <File className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-gray-900 truncate">{lampiranFeedback.name}</p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(lampiranFeedback.size)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveLampiran}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button onClick={handleSaveDecision} className="w-full bg-blue-600 hover:bg-blue-700">
                {requiresFeedback ? 'Simpan Keputusan & Kirim Feedback' : 'Simpan Keputusan'}
              </Button>
            </div>
          </div>

          {/* Riwayat Feedback */}
          {draft.feedback && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-blue-900">
                    <strong>Feedback Terkirim</strong>
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    {draft.feedback.timestamp} oleh {draft.feedback.pemberi}
                  </p>
                  <p className="text-sm text-blue-800 mt-2 line-clamp-2">
                    {draft.feedback.detailFeedback}
                  </p>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setIsHistoryDialogOpen(true)}
                  className="text-blue-700"
                >
                  Lihat Detail
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlap Detail Dialog */}
      <Dialog open={isOverlapDetailOpen} onOpenChange={setIsOverlapDetailOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detail Tumpang Tindih</DialogTitle>
            <DialogDescription>
              Kawasan non-SPPTG yang tumpang tindih dengan lahan pengajuan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {draft.overlapResults.map((overlap, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-gray-900">{overlap.namaKawasan}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Jenis: {overlap.jenisKawasan}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Sumber: {overlap.sumber === 'Submission' ? 'SPPTG Eksisting' : 'Kawasan Non-SPPTG'}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-orange-700 border-orange-300">
                    {overlap.luasOverlap} m²
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOverlapDetailOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detail Feedback</DialogTitle>
            <DialogDescription>Feedback yang diberikan kepada pemohon</DialogDescription>
          </DialogHeader>

          {draft.feedback && (
            <div className="space-y-4">
              <div>
                <Label>Timestamp</Label>
                <p className="text-sm text-gray-900">{draft.feedback.timestamp}</p>
              </div>

              <div>
                <Label>Pemberi Feedback</Label>
                <p className="text-sm text-gray-900">{draft.feedback.pemberi}</p>
              </div>

              <div>
                <Label>Alasan Terpilih</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {draft.feedback.alasanTerpilih.map((alasan) => (
                    <Badge key={alasan} variant="outline">
                      {alasan}
                    </Badge>
                  ))}
                </div>
              </div>

              {draft.feedback.dokumenTidakLengkap && draft.feedback.dokumenTidakLengkap.length > 0 && (
                <div>
                  <Label>Dokumen yang Perlu Dilengkapi</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {draft.feedback.dokumenTidakLengkap.map((dok) => (
                      <Badge key={dok} variant="secondary">
                        {dok}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>Detail Feedback</Label>
                <p className="text-sm text-gray-900 mt-2 whitespace-pre-wrap">
                  {draft.feedback.detailFeedback}
                </p>
              </div>

              {draft.feedback.tanggalTenggat && (
                <div>
                  <Label>Tanggal Tenggat</Label>
                  <p className="text-sm text-gray-900">
                    {new Date(draft.feedback.tanggalTenggat).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              )}

              {draft.feedback.lampiranFeedback && (
                <div>
                  <Label>Lampiran</Label>
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 mt-2">
                    <div className="flex items-center gap-3">
                      <File className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{draft.feedback.lampiranFeedback.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(draft.feedback.lampiranFeedback.size)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog for Overlap Warning */}
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Peringatan Tumpang Tindih</AlertDialogTitle>
            <AlertDialogDescription>
              Lahan pengajuan ini tumpang tindih dengan {draft.overlapResults.length} kawasan
              non-SPPTG. Tetap lanjutkan dengan status &quot;SPPTG terdaftar&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSaveDecision}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
