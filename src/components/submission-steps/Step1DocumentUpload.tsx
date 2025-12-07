import { useState } from 'react';
import { SubmissionDraft, UploadedDocument } from '../../types';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Button } from '../ui/button';
import { Upload, File, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';

interface Step1Props {
  draft: SubmissionDraft;
  onUpdateDraft: (updates: Partial<SubmissionDraft>) => void;
}

interface FileUploadFieldProps {
  label: string;
  accept: string;
  maxSize: number; // in MB
  value?: UploadedDocument;
  onChange: (doc?: UploadedDocument) => void;
  required?: boolean;
  helpText?: string;
  category: 'KTP' | 'KK' | 'Kwitansi' | 'Permohonan' | 'SK Kepala Desa';
  draftId?: number;
}

function FileUploadField({
  label,
  accept,
  maxSize,
  value,
  onChange,
  required = true,
  helpText,
  category,
  draftId,
}: FileUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const createUploadUrlMutation = trpc.documents.createUploadUrl.useMutation();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      toast.error(`Ukuran file maksimal ${maxSize} MB`);
      return;
    }

    // Validate file type
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const acceptedExts = accept.split(',').map((ext) => ext.trim().replace('.', ''));
    if (!fileExt || !acceptedExts.includes(fileExt)) {
      toast.error(`Format file tidak sesuai. Gunakan ${accept}`);
      return;
    }

    if (!draftId) {
      toast.error('Draf belum dimuat. Silakan tunggu sebentar.');
      return;
    }

    setIsUploading(true);

    try {
      // Get presigned URL from backend
      const { uploadUrl, publicUrl, documentId } = await createUploadUrlMutation.mutateAsync({
        draftId,
        category,
        filename: file.name,
        size: file.size,
        mimeType: file.type || (fileExt === 'pdf' ? 'application/pdf' : `image/${fileExt}`),
      });

      // Upload file to S3
      // Note: Only set Content-Type header to avoid CORS preflight issues
      // The presigned URL should handle authentication
      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || (fileExt === 'pdf' ? 'application/pdf' : `image/${fileExt}`),
          },
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

      // Update draft with document info
      onChange({
        name: file.name,
        size: file.size,
        url: publicUrl,
        uploadedAt: new Date().toISOString(),
        documentId,
      });

      toast.success('Dokumen berhasil diunggah.');
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

  const handleRemove = () => {
    onChange(undefined);
    toast.info('Dokumen dihapus.');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-red-600">*</span>}
      </Label>

      {!value ? (
        <div>
          <label
            htmlFor={`file-${label}`}
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-10 h-10 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                <span className="text-blue-600">Klik untuk unggah</span> atau seret file ke sini
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {accept.toUpperCase()} (Maks. {maxSize} MB)
              </p>
            </div>
            <input
              id={`file-${label}`}
              type="file"
              className="hidden"
              accept={accept}
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
          {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <File className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900 truncate">{value.name}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(value.size)} • Diunggah {value.uploadedAt}
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <label htmlFor={`replace-${label}`}>
                <Button variant="ghost" size="sm" type="button" asChild>
                  <span className="cursor-pointer text-xs">Ganti</span>
                </Button>
                <input
                  id={`replace-${label}`}
                  type="file"
                  className="hidden"
                  accept={accept}
                  onChange={handleFileChange}
                />
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
          <span>Mengunggah...</span>
        </div>
      )}
    </div>
  );
}

export function Step1DocumentUpload({ draft, onUpdateDraft }: Step1Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-2">Pengajuan Berkas</h2>
        <p className="text-gray-600">
          Lengkapi data pemohon dan unggah dokumen pendukung yang diperlukan.
        </p>
      </div>

      {/* Applicant Data */}
      <div className="space-y-4">
        <h3 className="text-gray-900">Data Pemohon</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="namaPemohon">
              Nama Pemohon <span className="text-red-600">*</span>
            </Label>
            <Input
              id="namaPemohon"
              value={draft.namaPemohon}
              onChange={(e) => onUpdateDraft({ namaPemohon: e.target.value })}
              placeholder="Masukkan nama lengkap"
            />
          </div>

          <div>
            <Label htmlFor="nik">
              NIK <span className="text-red-600">*</span>
            </Label>
            <Input
              id="nik"
              type="text"
              value={draft.nik}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 16);
                onUpdateDraft({ nik: value });
              }}
              placeholder="Masukkan NIK (16 digit)"
              maxLength={16}
            />
            {draft.nik && draft.nik.length !== 16 && (
              <p className="text-xs text-red-600 mt-1">NIK harus 16 digit</p>
            )}
          </div>
        </div>
      </div>

      {/* Document Uploads */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h3 className="text-gray-900">Dokumen Pendukung</h3>

        <div className="grid grid-cols-1 gap-6">
          <FileUploadField
            label="Softcopy KTP"
            accept=".pdf,.jpg,.jpeg,.png"
            maxSize={10}
            value={draft.dokumenKTP}
            onChange={(doc) => onUpdateDraft({ dokumenKTP: doc })}
            helpText="Contoh: KTP_NamaPemohon_2025.pdf"
            category="KTP"
            draftId={draft.id}
          />

          <FileUploadField
            label="Softcopy KK"
            accept=".pdf,.jpg,.jpeg,.png"
            maxSize={10}
            value={draft.dokumenKK}
            onChange={(doc) => onUpdateDraft({ dokumenKK: doc })}
            helpText="Contoh: KK_NamaPemohon_2025.pdf"
            category="KK"
            draftId={draft.id}
          />

          <FileUploadField
            label="Softcopy Kwitansi Jual Beli/Hibah/Keterangan Warisan"
            accept=".pdf,.jpg,.jpeg,.png"
            maxSize={10}
            value={draft.dokumenKwitansi}
            onChange={(doc) => onUpdateDraft({ dokumenKwitansi: doc })}
            category="Kwitansi"
            draftId={draft.id}
          />

          <FileUploadField
            label="Softcopy Surat Permohonan"
            accept=".pdf"
            maxSize={10}
            value={draft.dokumenPermohonan}
            onChange={(doc) => onUpdateDraft({ dokumenPermohonan: doc })}
            category="Permohonan"
            draftId={draft.id}
          />

          <FileUploadField
            label="Surat Keputusan Kepala Desa Mengenai Tim Peneliti"
            accept=".pdf"
            maxSize={10}
            value={draft.dokumenSKKepalaDesa}
            onChange={(doc) => onUpdateDraft({ dokumenSKKepalaDesa: doc })}
            category="SK Kepala Desa"
            draftId={draft.id}
          />
        </div>
      </div>

      {/* Agreement */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <Checkbox
            id="persetujuan"
            checked={draft.persetujuanData}
            onCheckedChange={(checked) =>
              onUpdateDraft({ persetujuanData: checked as boolean })
            }
            className="mt-0.5"
          />
          <label
            htmlFor="persetujuan"
            className="text-sm text-gray-900 cursor-pointer flex-1"
          >
            Saya menyatakan bahwa data dan dokumen yang diunggah adalah benar dan dapat
            dipertanggungjawabkan.
          </label>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-700">
          <strong>ℹ️ Informasi:</strong> Semua dokumen akan divalidasi oleh tim verifikator.
          Pastikan dokumen yang diunggah jelas dan sesuai dengan ketentuan yang berlaku.
        </p>
      </div>
    </div>
  );
}
