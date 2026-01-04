import { useState } from 'react';
import { UploadedDocument } from '../types';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Upload, File, X, CheckCircle2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';
import { TemplateType, TEMPLATE_FILENAME_MAP } from '@/lib/templates';

export interface FileUploadFieldProps {
  label: string;
  accept: string;
  maxSize: number; // in MB
  value?: UploadedDocument;
  onChange: (doc?: UploadedDocument) => void;
  required?: boolean;
  helpText?: string;
  category: 'KTP' | 'KK' | 'Kwitansi' | 'Permohonan' | 'SK Kepala Desa' | 'Pernyataan Jual Beli' | 'Asal Usul' | 'Tidak Sengketa' | 'Berita Acara';
  draftId?: number;
  templateType?: TemplateType;
  notes?: string | React.ReactNode;
}

export function FileUploadField({
  label,
  accept,
  maxSize,
  value,
  onChange,
  required = true,
  helpText,
  category,
  draftId,
  templateType,
  notes,
}: FileUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const createUploadUrlMutation = trpc.documents.createUploadUrl.useMutation();
  const uploadFileMutation = trpc.documents.uploadFile.useMutation();
  const getTemplateUrlMutation = trpc.documents.getTemplateUrl.useMutation();

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
      // Step 1: Create document record and get s3Key
      const { documentId, publicUrl, s3Key } = await createUploadUrlMutation.mutateAsync({
        draftId,
        category,
        filename: file.name,
        size: file.size,
        mimeType: file.type || (fileExt === 'pdf' ? 'application/pdf' : `image/${fileExt}`),
      });

      // Step 2: Convert file to base64
      const fileBuffer = await file.arrayBuffer();
      const base64String = btoa(
        new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Step 3: Upload file via server-side tRPC mutation
      const uploadResult = await uploadFileMutation.mutateAsync({
        draftId,
        documentId,
        s3Key,
        fileData: base64String,
        filename: file.name,
        mimeType: file.type || (fileExt === 'pdf' ? 'application/pdf' : `image/${fileExt}`),
        size: file.size,
      });

      // Update draft with document info
      onChange({
        name: file.name,
        size: file.size,
        url: uploadResult.publicUrl,
        uploadedAt: new Date().toISOString(),
        documentId,
      });

      toast.success('Dokumen berhasil diunggah.');
    } catch (error: any) {
      console.error('Upload error:', error);
      // Provide user-friendly error messages
      if (error.message) {
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

  const handleTemplateDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (!templateType) return;

    try {
      const { signedUrl } = await getTemplateUrlMutation.mutateAsync({ templateType });
      window.open(signedUrl, '_blank');
    } catch (error: any) {
      console.error('Template download error:', error);
      toast.error(error?.message || 'Gagal mengunduh template. Silakan coba lagi.');
    }
  };

  const getTemplateFileName = () => {
    if (templateType) {
      return TEMPLATE_FILENAME_MAP[templateType];
    }
    return 'template';
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
          {templateType && (
            <div className="mt-1">
              <a
                href="#"
                onClick={handleTemplateDownload}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                {getTemplateUrlMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-blue-600" />
                    Memuat...
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3" />
                    Unduh template: {getTemplateFileName()}
                  </>
                )}
              </a>
            </div>
          )}
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

      {notes && (
        <div className="mt-2 text-sm text-gray-600">
          {typeof notes === 'string' ? <p>{notes}</p> : notes}
        </div>
      )}
    </div>
  );
}