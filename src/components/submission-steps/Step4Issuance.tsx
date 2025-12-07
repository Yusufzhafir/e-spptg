import { useState } from 'react';
import { SubmissionDraft } from '../../types';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Upload, File, X, CheckCircle2, Download, Printer, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';

interface Step4Props {
  draft: SubmissionDraft;
  onUpdateDraft: (updates: Partial<SubmissionDraft>) => void;
}

export function Step4Issuance({ draft, onUpdateDraft }: Step4Props) {
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const createUploadUrlMutation = trpc.documents.createUploadUrl.useMutation();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Format file harus PDF');
      return;
    }

    // Validate file size (10 MB)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 10) {
      toast.error('Ukuran file maksimal 10 MB');
      return;
    }

    if (!draft.id) {
      toast.error('Draf belum dimuat');
      return;
    }

    setIsUploading(true);
    try {
      const { uploadUrl, publicUrl, documentId } = await createUploadUrlMutation.mutateAsync({
        draftId: draft.id,
        category: 'SPPG',
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

      onUpdateDraft({
        dokumenSPPTG: {
          name: file.name,
          size: file.size,
          url: publicUrl,
          uploadedAt: new Date().toISOString(),
          documentId,
        },
      });
      toast.success('Dokumen SPPTG berhasil diunggah.');
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

  const handleRemoveFile = () => {
    onUpdateDraft({ dokumenSPPTG: undefined });
    toast.info('Dokumen SPPTG dihapus.');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isFormComplete = draft.dokumenSPPTG && draft.nomorSPPTG && draft.tanggalTerbit;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-2">Penerbitan SPPTG</h2>
        <p className="text-gray-600">
          Unggah softcopy SPPTG dan lengkapi informasi penerbitan.
        </p>
      </div>

      {/* Status Check */}
      {draft.status !== 'SPPTG terdaftar' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-900">
            ⚠️ Penerbitan SPPTG hanya tersedia untuk status &quot;SPPTG terdaftar&quot;. Status saat ini:{' '}
            <strong>{draft.status || 'Belum ditentukan'}</strong>
          </p>
        </div>
      )}

      {draft.status === 'SPPTG terdaftar' && (
        <>
          {/* SPPTG Document Upload */}
          <div className="space-y-3">
            <Label>
              Upload Softcopy SPPTG <span className="text-red-600">*</span>
            </Label>

            {!draft.dokumenSPPTG ? (
              <div>
                <label
                  htmlFor="spptg-file"
                  className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-12 h-12 text-gray-400 mb-3" />
                    <p className="text-sm text-gray-600">
                      <span className="text-blue-600">Klik untuk unggah</span> atau seret file ke sini
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF (Maks. 10 MB)</p>
                  </div>
                  <input
                    id="spptg-file"
                    type="file"
                    className="hidden"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>

                {isUploading && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
                    <span>Mengunggah dokumen...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <File className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{draft.dokumenSPPTG.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(draft.dokumenSPPTG.size)} • Diunggah{' '}
                        {draft.dokumenSPPTG.uploadedAt}
                      </p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <label htmlFor="replace-spptg">
                      <Button variant="ghost" size="sm" type="button" asChild>
                        <span className="cursor-pointer text-xs">Ganti</span>
                      </Button>
                      <input
                        id="replace-spptg"
                        type="file"
                        className="hidden"
                        accept=".pdf"
                        onChange={handleFileUpload}
                      />
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SPPTG Number */}
          <div className="space-y-2">
            <Label htmlFor="nomorSPPTG">
              Nomor SPPTG <span className="text-red-600">*</span>
            </Label>
            <Input
              id="nomorSPPTG"
              value={draft.nomorSPPTG || ''}
              onChange={(e) => onUpdateDraft({ nomorSPPTG: e.target.value })}
              placeholder="SPPTG/XX/123/2025"
            />
            <p className="text-xs text-gray-500">
              Masukkan nomor SPPTG sesuai format yang berlaku
            </p>
          </div>

          {/* Issue Date */}
          <div className="space-y-2">
            <Label htmlFor="tanggalTerbit">
              Tanggal Diterbitkan <span className="text-red-600">*</span>
            </Label>
            <Input
              id="tanggalTerbit"
              type="date"
              value={draft.tanggalTerbit || ''}
              onChange={(e) => onUpdateDraft({ tanggalTerbit: e.target.value })}
            />
          </div>

          {/* Summary */}
          {isFormComplete && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-900 mb-2">
                    <strong>Semua informasi penerbitan telah lengkap</strong>
                  </p>
                  <div className="space-y-1 text-sm text-green-800">
                    <p>• Dokumen SPPTG: {draft.dokumenSPPTG?.name}</p>
                    <p>• Nomor SPPTG: {draft.nomorSPPTG}</p>
                    <p>
                      • Tanggal Terbit:{' '}
                      {new Date(draft.tanggalTerbit || "").toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>ℹ️ Informasi:</strong> Setelah menekan tombol &quot;Terbitkan SPPTG&quot;, dokumen
              akan disimpan dan dapat diunduh atau dicetak. Pastikan semua informasi sudah benar
              sebelum melanjutkan.
            </p>
          </div>
        </>
      )}

      {/* Success Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-center">SPPTG Berhasil Diterbitkan</DialogTitle>
            <DialogDescription className="text-center">
              Surat Pernyataan Penguasaan Tanah dan Garapan telah berhasil diterbitkan dan dapat diunduh.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Nomor SPPTG:</span>
                <span className="text-gray-900">{draft.nomorSPPTG}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pemohon:</span>
                <span className="text-gray-900">{draft.namaPemohon}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tanggal Terbit:</span>
                <span className="text-gray-900">
                  {draft.tanggalTerbit &&
                    new Date(draft.tanggalTerbit).toLocaleDateString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full" onClick={() => toast.success('SPPTG diunduh')}>
              <Download className="w-4 h-4 mr-2" />
              Unduh SPPTG
            </Button>
            <Button variant="outline" className="w-full" onClick={() => toast.success('SPPTG dicetak')}>
              <Printer className="w-4 h-4 mr-2" />
              Cetak
            </Button>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => setIsSuccessDialogOpen(false)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Detail Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
