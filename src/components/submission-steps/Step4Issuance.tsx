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
import { Upload, File, X, CheckCircle2, Download, Printer, ArrowLeft, FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';
import { generateCertificateNumber } from '@/lib/certificate-number-generator';
import { usePDFGenerator } from '@/hooks/usePDFGenerator';
import type { SPPTGPDFData } from '@/components/pdf/types';
import { buildSPPTGPDFData } from '@/lib/spptg-pdf-data';

interface Step4Props {
  draft: SubmissionDraft;
  onUpdateDraft: (updates: Partial<SubmissionDraft>) => void;
}

export function Step4Issuance({ draft, onUpdateDraft }: Step4Props) {
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedPDFUrl, setGeneratedPDFUrl] = useState<string | null>(null);

  const createUploadUrlMutation = trpc.documents.createUploadUrl.useMutation();
  const uploadFileMutation = trpc.documents.uploadFile.useMutation();
  
  // New PDF generator hook (react-pdf based)
  const { generatePDF, isGenerating: isGeneratingPDF } = usePDFGenerator();
  
  // Fetch village data if villageId is set
  const { data: villageData } = trpc.villages.byId.useQuery(
    { id: draft.villageId! },
    { enabled: !!draft.villageId }
  );

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
      // Step 1: Create document record and get s3Key
      const { documentId, s3Key } = await createUploadUrlMutation.mutateAsync({
        draftId: draft.id,
        category: 'SPPG',
        filename: file.name,
        size: file.size,
        mimeType: 'application/pdf',
      });

      // Step 2: Convert file to base64
      const fileBuffer = await file.arrayBuffer();
      const base64String = btoa(
        new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Step 3: Upload file via server-side tRPC mutation
      const uploadResult = await uploadFileMutation.mutateAsync({
        draftId: draft.id,
        documentId,
        s3Key,
        fileData: base64String,
        filename: file.name,
        mimeType: 'application/pdf',
        size: file.size,
      });

      onUpdateDraft({
        dokumenSPPTG: {
          name: file.name,
          size: file.size,
          url: uploadResult.publicUrl,
          uploadedAt: new Date().toISOString(),
          documentId,
        },
      });
      toast.success('Dokumen SPPTG berhasil diunggah.');
    } catch (error: unknown) {
      console.error('Upload error:', error);
      // Provide user-friendly error messages
      if (error instanceof Error && error.message) {
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

  /**
   * Build PDF data from draft
   */
  const buildPDFData = (): SPPTGPDFData => {
    return buildSPPTGPDFData(draft, villageData ?? null);
  };

  /**
   * Generate PDF certificate using react-pdf
   */
  const handleGeneratePDF = async () => {
    if (!draft.id) {
      toast.error('Draf belum dimuat');
      return;
    }

    // Validate required fields
    if (!draft.namaPemohon || !draft.nik) {
      toast.error('Data pemohon belum lengkap. Pastikan nama dan NIK sudah diisi.');
      return;
    }

    if (!draft.luasLahan) {
      toast.error('Data lahan belum lengkap. Pastikan luas lahan sudah dihitung.');
      return;
    }

    try {
      // Auto-generate certificate number if not set
      let certificateNumber = draft.nomorSPPTG;
      if (!certificateNumber) {
        certificateNumber = generateCertificateNumber(1, '00.00');
        onUpdateDraft({ nomorSPPTG: certificateNumber });
        toast.info(`Nomor SPPTG otomatis dihasilkan: ${certificateNumber}`);
      }

      // Auto-set issue date if not set
      let issueDate = draft.tanggalTerbit;
      if (!issueDate) {
        issueDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        onUpdateDraft({ tanggalTerbit: issueDate });
        toast.info(`Tanggal terbit otomatis diset: ${new Date(issueDate).toLocaleDateString('id-ID')}`);
      }

      // Build PDF data
      const pdfData = buildPDFData();
      
      // Update data with generated values
      pdfData.nomorSPPTG = certificateNumber;
      pdfData.tanggalPernyataan = issueDate;

      // Generate PDF using react-pdf hook
      const result = await generatePDF(pdfData, {
        includeWitnesses: true,
        includeAdministrative: true,
        includeMap: true,
      });

      setGeneratedPDFUrl(result.url);

      // Auto-upload the generated PDF
      const filename = `SPPTG_${certificateNumber.replace(/\//g, '_')}.pdf`;
      
      // Create document record and get s3Key
      const { documentId, s3Key } = await createUploadUrlMutation.mutateAsync({
        draftId: draft.id,
        category: 'SPPG',
        filename,
        size: result.size,
        mimeType: 'application/pdf',
      });

      // Upload file via server-side tRPC mutation
      const uploadResult = await uploadFileMutation.mutateAsync({
        draftId: draft.id,
        documentId,
        s3Key,
        fileData: result.base64,
        filename,
        mimeType: 'application/pdf',
        size: result.size,
      });

      // Update draft with generated document
      onUpdateDraft({
        dokumenSPPTG: {
          name: filename,
          size: result.size,
          url: uploadResult.publicUrl,
          uploadedAt: new Date().toISOString(),
          documentId,
        },
        nomorSPPTG: certificateNumber,
        tanggalTerbit: issueDate,
      });

      toast.success('PDF SPPTG berhasil dibuat dan diunggah.');
    } catch (error: unknown) {
      console.error('PDF generation error:', error);
      if (error instanceof Error && error.message) {
        toast.error(`Gagal membuat PDF: ${error.message}`);
      } else {
        toast.error('Gagal membuat PDF. Silakan coba lagi atau hubungi administrator.');
      }
    }
  };

  /**
   * Download generated PDF
   */
  const handleDownloadPDF = () => {
    if (!draft.dokumenSPPTG?.url && !generatedPDFUrl) {
      toast.error('Dokumen SPPTG belum tersedia');
      return;
    }

    const url = generatedPDFUrl || draft.dokumenSPPTG?.url;
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = draft.dokumenSPPTG?.name || 'SPPTG.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('SPPTG sedang diunduh');
  };

  /**
   * Preview PDF in new window
   */
  const handlePreviewPDF = () => {
    if (!draft.dokumenSPPTG?.url && !generatedPDFUrl) {
      toast.error('Dokumen SPPTG belum tersedia');
      return;
    }

    const url = generatedPDFUrl || draft.dokumenSPPTG?.url;
    if (url) {
      window.open(url, '_blank');
    }
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
          {/* PDF Generation Button */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  Generate PDF SPPTG Otomatis
                </h3>
                <p className="text-xs text-blue-700">
                  Klik tombol di bawah untuk membuat PDF SPPTG secara otomatis menggunakan React PDF.
                  Nomor SPPTG dan tanggal terbit akan di-generate otomatis jika belum diisi.
                </p>
              </div>
              <Button
                onClick={handleGeneratePDF}
                disabled={isGeneratingPDF || isUploading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isGeneratingPDF ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Membuat PDF...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generate PDF
                  </>
                )}
              </Button>
            </div>
          </div>

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
                    {draft.dokumenSPPTG.url && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePreviewPDF}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDownloadPDF}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </>
                    )}
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
            <Button variant="outline" className="w-full" onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              Unduh SPPTG
            </Button>
            <Button variant="outline" className="w-full" onClick={() => {
              handlePreviewPDF();
              window.print();
            }}>
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
