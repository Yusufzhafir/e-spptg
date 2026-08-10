import { useEffect, useMemo, useState } from 'react';
import { SubmissionDraft } from '../../types';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  Upload,
  File,
  X,
  CheckCircle2,
  Download,
  FileText,
  Eye,
  FileDown,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';
import { usePDFGenerator } from '@/hooks/usePDFGenerator';
import { buildSPPTGPDFData } from '@/lib/spptg-pdf-data';
import { cn } from '@/lib/utils';
import {
  certificateLabel,
  hasNomorSPPTGBody,
  nomorSPPTGBody,
  nomorSPPTGPrefix,
  withNomorSPPTGPrefix,
} from '@/lib/nomor-spptg';

interface Step4Props {
  draft: SubmissionDraft;
  onUpdateDraft: (updates: Partial<SubmissionDraft>) => void;
  onPersistDraftPatch: (
    updates: Partial<SubmissionDraft>,
    options?: { silent?: boolean }
  ) => Promise<void>;
  errors?: Record<string, string>;
}

type GeneratedDocs = {
  pdfUrl: string;
  baseName: string;
  /**
   * Everything that went into these files, serialised.
   *
   * The download is a static blob and does not follow the form, so any later
   * edit would have the user hand over a certificate printed with stale values.
   * Comparing the whole payload rather than a couple of fields catches the ones
   * that are not typed on this step either — the overlap checklist and the juru
   * ukur on a terdata notice both come from earlier stages.
   */
  fingerprint: string;
  /** Kept out of the fingerprint so the warning can name what changed. */
  nomorSPPTG: string;
  tanggalTerbit: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-600 mt-1">{message}</p>;
}

/** "2025-07-30" → "30 Juli 2025"; keeps the raw text when it cannot be parsed. */
function formatIssueDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function Step4Issuance({
  draft,
  onUpdateDraft,
  onPersistDraftPatch,
  errors = {},
}: Step4Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocs | null>(null);

  const createUploadUrlMutation = trpc.documents.createUploadUrl.useMutation();
  const uploadFileMutation = trpc.documents.uploadFile.useMutation();
  const deleteDocumentMutation = trpc.documents.delete.useMutation();
  const openDocumentMutation = trpc.documents.getSignedDownloadUrl.useMutation();

  const { generatePDF, isGenerating: isGeneratingPDF } = usePDFGenerator();

  // Fetch village data if villageId is set
  const { data: villageData } = trpc.villages.byId.useQuery(
    { id: draft.villageId! },
    { enabled: !!draft.villageId }
  );

  /**
   * A berkas that was only ever *recorded* can still be issued a certificate,
   * but a visibly different one: its own prefix, its own title, no manual
   * softcopy, and a disclosure notice naming what the land overlaps.
   */
  const isTerdata = draft.status === 'SPPTG terdata';
  const canIssue = isTerdata || draft.status === 'SPPTG terdaftar';

  /**
   * The exact payload the certificate would be rendered from right now, and a
   * serialisation of it. Both are derived rather than assembled at click time so
   * the "Generate Ulang" prompt can compare against what was actually printed.
   */
  const pdfData = useMemo(
    () => buildSPPTGPDFData(draft, villageData ?? null),
    [draft, villageData]
  );
  const pdfFingerprint = useMemo(() => JSON.stringify(pdfData), [pdfData]);
  const nomorPrefix = nomorSPPTGPrefix(draft.status);
  const dokumenLabel = certificateLabel(draft.status);

  // Auto-fill the issue date with today's date once the draft is loaded and
  // the field is still empty. It stays user-editable afterwards.
  useEffect(() => {
    if (draft.id && !draft.tanggalTerbit) {
      onUpdateDraft({ tanggalTerbit: new Date().toISOString().split('T')[0] });
    }
  }, [draft.id, draft.tanggalTerbit, onUpdateDraft]);

  // Seed the mandatory prefix so the stored nomor carries it from the start —
  // the input renders it either way, but the PDF and the summary read the draft.
  useEffect(() => {
    if (!draft.id) return;
    const normalized = withNomorSPPTGPrefix(nomorSPPTGBody(draft.nomorSPPTG), draft.status);
    if (normalized !== draft.nomorSPPTG) {
      onUpdateDraft({ nomorSPPTG: normalized });
    }
    // draft.status is a dependency on purpose: flipping the Step 3 decision
    // re-prefixes the number instead of leaving TERDAFTAR/ on a terdata berkas.
  }, [draft.id, draft.nomorSPPTG, draft.status, onUpdateDraft]);

  const deleteDocumentById = async (documentId: number) => {
    await deleteDocumentMutation.mutateAsync({ documentId });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUpload(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading || isDeleting) return;
    const file = e.dataTransfer.files?.[0];
    if (file) await processUpload(file);
  };

  const processUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Format file harus PDF');
      return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 10) {
      toast.error('Ukuran file maksimal 10 MB');
      return;
    }

    await uploadSPPTGPdf(file, file.name, 'Dokumen SPPTG berhasil diunggah.');
  };

  /**
   * Puts a PDF on the berkas as its softcopy SPPTG.
   *
   * Takes a blob rather than a File because the terdata flow has no upload box:
   * its certificate is the one this app just generated, and it is attached
   * automatically so the document on file is provably the one that was issued.
   */
  const uploadSPPTGPdf = async (blob: Blob, filename: string, successMessage: string) => {
    if (!draft.id) {
      toast.error('Draf belum dimuat');
      return;
    }

    setIsUploading(true);
    const previousDocumentId = draft.dokumenSPPTG?.documentId;
    try {
      const { documentId, s3Key } = await createUploadUrlMutation.mutateAsync({
        draftId: draft.id,
        category: 'SPPG',
        filename,
        size: blob.size,
        mimeType: 'application/pdf',
      });

      const fileBuffer = await blob.arrayBuffer();
      const base64String = btoa(
        new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const uploadResult = await uploadFileMutation.mutateAsync({
        draftId: draft.id,
        documentId,
        s3Key,
        fileData: base64String,
        filename,
        mimeType: 'application/pdf',
        size: blob.size,
      });

      try {
        await onPersistDraftPatch(
          {
            dokumenSPPTG: {
              name: filename,
              size: blob.size,
              url: uploadResult.publicUrl,
              uploadedAt: new Date().toISOString(),
              documentId,
            },
          },
          { silent: true }
        );
      } catch (saveError) {
        try {
          await deleteDocumentById(documentId);
        } catch (rollbackError) {
          console.error('Rollback delete error:', rollbackError);
          toast.error(
            'Unggahan dibatalkan, tetapi gagal membersihkan file sementara. Hubungi administrator.'
          );
        }

        throw new Error(
          saveError instanceof Error
            ? saveError.message
            : 'Gagal menyimpan draf setelah upload'
        );
      }

      if (previousDocumentId && previousDocumentId !== documentId) {
        try {
          await deleteDocumentById(previousDocumentId);
        } catch (cleanupError) {
          console.error('Replace cleanup error:', cleanupError);
          toast.info('Dokumen baru tersimpan, tetapi dokumen lama gagal dihapus.');
        }
      }

      toast.success(successMessage);
    } catch (error: unknown) {
      console.error('Upload error:', error);
      if (error instanceof Error && error.message) {
        toast.error(error.message);
      } else {
        toast.error('Gagal mengunggah dokumen. Silakan coba lagi atau hubungi administrator jika masalah berlanjut.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = async () => {
    if (!draft.dokumenSPPTG) return;

    const previousDocument = draft.dokumenSPPTG;
    setIsDeleting(true);
    try {
      await onPersistDraftPatch({ dokumenSPPTG: undefined }, { silent: true });

      if (previousDocument.documentId) {
        try {
          await deleteDocumentById(previousDocument.documentId);
        } catch (deleteError) {
          try {
            await onPersistDraftPatch(
              { dokumenSPPTG: previousDocument },
              { silent: true }
            );
          } catch (rollbackError) {
            console.error('Rollback save error:', rollbackError);
            toast.error(
              'Gagal menghapus dokumen dan gagal mengembalikan data draf. Silakan muat ulang halaman.'
            );
            return;
          }

          console.error('Remove file delete error:', deleteError);
          toast.error('Gagal menghapus dokumen SPPTG. Perubahan draf dibatalkan.');
          return;
        }
      }

      toast.info('Dokumen SPPTG dihapus.');
    } catch (error: unknown) {
      console.error('Remove file draft save error:', error);
      if (error instanceof Error && error.message) {
        toast.error(error.message);
      } else {
        toast.error('Gagal menyimpan perubahan draf sebelum menghapus dokumen SPPTG.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const triggerBrowserDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Generate the SPPTG certificate as a PDF for download.
   * Note: nomor SPPTG and tanggal terbit are NOT auto-filled here — they use
   * whatever the user entered. The generated files are provided as download
   * links; they are NOT uploaded as the softcopy (that is uploaded manually).
   */
  const handleGenerateDocuments = async () => {
    if (!draft.id) {
      toast.error('Draf belum dimuat');
      return;
    }
    if (!draft.namaPemohon || !draft.nik) {
      toast.error('Data pemohon belum lengkap. Pastikan nama dan NIK sudah diisi.');
      return;
    }
    if (!draft.luasLahan) {
      toast.error('Data lahan belum lengkap. Pastikan luas lahan sudah dihitung.');
      return;
    }
    if (!hasNomorSPPTGBody(draft.nomorSPPTG)) {
      toast.error(`Isi Nomor SPPTG setelah awalan ${nomorPrefix} terlebih dahulu.`);
      return;
    }
    if (!draft.tanggalTerbit) {
      toast.error('Isi Tanggal Diterbitkan terlebih dahulu.');
      return;
    }

    setIsGeneratingDocs(true);
    try {
      const pdfResult = await generatePDF(pdfData, {
        includeWitnesses: true,
        // The terdata variant drops the Kepala Desa endorsement itself; leaving
        // this true keeps the flag meaning what it says for the other one.
        includeAdministrative: true,
        includeMap: true,
      });
      // Revoke any previously generated URL to avoid memory leaks
      if (generatedDocs) {
        URL.revokeObjectURL(generatedDocs.pdfUrl);
      }

      const baseName = `${isTerdata ? 'SPPTG_TERDATA' : 'SPPTG'}_${(
        draft.nomorSPPTG || 'dokumen'
      ).replace(/[\\/]/g, '_')}`;
      setGeneratedDocs({
        pdfUrl: pdfResult.url,
        baseName,
        fingerprint: pdfFingerprint,
        nomorSPPTG: withNomorSPPTGPrefix(nomorSPPTGBody(draft.nomorSPPTG), draft.status),
        tanggalTerbit: draft.tanggalTerbit,
      });

      if (isTerdata) {
        // No upload box on this variant: the certificate on file has to be the
        // one that was just generated, not a look-alike chosen by hand.
        await uploadSPPTGPdf(
          pdfResult.blob,
          `${baseName}.pdf`,
          'Dokumen SPPTG Terdata dibuat dan otomatis terlampir pada berkas.'
        );
      } else {
        toast.success('Dokumen SPPTG berhasil dibuat. Silakan unduh dalam format PDF.');
      }
    } catch (error: unknown) {
      console.error('Document generation error:', error);
      if (error instanceof Error && error.message) {
        toast.error(`Gagal membuat dokumen: ${error.message}`);
      } else {
        toast.error('Gagal membuat dokumen. Silakan coba lagi atau hubungi administrator.');
      }
    } finally {
      setIsGeneratingDocs(false);
    }
  };

  /** Download the uploaded softcopy SPPTG. */
  const handleDownloadUploaded = async () => {
    if (!draft.dokumenSPPTG?.url) {
      toast.error('Dokumen SPPTG belum tersedia');
      return;
    }

    try {
      if (draft.dokumenSPPTG.documentId) {
        const { signedUrl } = await openDocumentMutation.mutateAsync({
          documentId: draft.dokumenSPPTG.documentId,
          disposition: 'attachment',
        });
        triggerBrowserDownload(signedUrl, draft.dokumenSPPTG.name || 'SPPTG.pdf');
      } else {
        triggerBrowserDownload(draft.dokumenSPPTG.url, draft.dokumenSPPTG.name || 'SPPTG.pdf');
      }
      toast.success('SPPTG sedang diunduh');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengunduh dokumen SPPTG.');
    }
  };

  /** Preview the uploaded softcopy SPPTG in a new tab. */
  const handlePreviewUploaded = async () => {
    if (!draft.dokumenSPPTG?.url) {
      toast.error('Dokumen SPPTG belum tersedia');
      return;
    }

    try {
      if (draft.dokumenSPPTG.documentId) {
        const { signedUrl } = await openDocumentMutation.mutateAsync({
          documentId: draft.dokumenSPPTG.documentId,
        });
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      window.open(draft.dokumenSPPTG.url, '_blank', 'noopener,noreferrer');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Gagal membuka dokumen SPPTG.');
    }
  };

  const isFormComplete =
    draft.dokumenSPPTG && hasNomorSPPTGBody(draft.nomorSPPTG) && draft.tanggalTerbit;

  // The generated PDF is a fixed blob: any later edit leaves the download link
  // pointing at a certificate that no longer matches the berkas. Flag it instead
  // of letting it pass silently.
  const generatedDocsAreStale =
    generatedDocs !== null && generatedDocs.fingerprint !== pdfFingerprint;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-2">Penerbitan {dokumenLabel}</h2>
        <p className="text-gray-600">
          {isTerdata
            ? 'Lengkapi informasi penerbitan, lalu buat dokumen SPPTG Terdata. Dokumen hasil pembuatan otomatis terlampir pada berkas.'
            : 'Unggah softcopy SPPTG dan lengkapi informasi penerbitan.'}
        </p>
      </div>

      {/* SPPTG Number */}
      <div className="space-y-2">
        <Label htmlFor="nomorSPPTG">
          Nomor {dokumenLabel} <span className="text-red-600">*</span>
        </Label>
        {/* The prefix sits outside the input, not inside its value: it cannot be
            selected, backspaced over, or cursored behind. */}
        <div
          className={cn(
            'flex items-stretch overflow-hidden rounded-md border border-input bg-transparent',
            'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
            errors.nomorSPPTG && 'border-red-500'
          )}
        >
          <span
            aria-hidden="true"
            className="flex select-none items-center border-r border-input bg-gray-50 px-3 text-sm font-medium text-gray-600"
          >
            {nomorPrefix}
          </span>
          <Input
            id="nomorSPPTG"
            value={nomorSPPTGBody(draft.nomorSPPTG)}
            onChange={(e) =>
              onUpdateDraft({ nomorSPPTG: withNomorSPPTGPrefix(e.target.value, draft.status) })
            }
            placeholder="145/KTM/2026"
            aria-invalid={Boolean(errors.nomorSPPTG)}
            aria-describedby="nomorSPPTG-hint"
            className="rounded-none border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <FieldError message={errors.nomorSPPTG} />
        <p id="nomorSPPTG-hint" className="text-xs text-gray-500">
          Awalan <strong>{nomorPrefix}</strong> mengikuti status keputusan, sudah baku
          dan tidak dapat diubah. Isi nomor setelahnya sesuai format yang berlaku.
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
          aria-invalid={Boolean(errors.tanggalTerbit)}
          className={errors.tanggalTerbit ? 'border-red-500' : undefined}
        />
        <FieldError message={errors.tanggalTerbit} />
        <p className="text-xs text-gray-500">
          Terisi otomatis dengan tanggal hari ini — dapat diubah bila perlu.
        </p>
      </div>

      {/* Status Check */}
      {!canIssue && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-900">
            ⚠️ Penerbitan surat hanya tersedia untuk status &quot;SPPTG terdaftar&quot; atau
            &quot;SPPTG terdata&quot;. Status saat ini:{' '}
            <strong>{draft.status || 'Belum ditentukan'}</strong>
          </p>
        </div>
      )}

      {canIssue && (
        <>
          {isTerdata && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold">Dokumen SPPTG Terdata</p>
                  <p className="mt-1 leading-relaxed">
                    Berkas ini terbit dengan status <strong>terdata</strong>, jadi
                    dokumennya berbeda dari SPPTG terdaftar: tanpa pengesahan Kepala
                    Desa, dan memuat catatan hasil verifikasi fisik berisi daftar
                    kawasan yang bertampalan dengan lahan, ditandatangani Tim Peneliti
                    (Juru Ukur).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PDF Generation Button */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  Generate Dokumen {dokumenLabel}
                </h3>
                <p className="text-xs text-blue-700">
                  Buat dokumen {dokumenLabel} dari data pengajuan. Dokumen memakai Nomor{' '}
                  {dokumenLabel} dan Tanggal Diterbitkan yang Anda isi di atas (tidak
                  diisi otomatis).{' '}
                  {isTerdata
                    ? 'Hasilnya langsung terlampir pada berkas sebagai dokumen resmi dan dapat diunduh di bawah.'
                    : 'Hasilnya berupa tautan unduh PDF — bukan diunggah otomatis sebagai softcopy.'}
                </p>
              </div>
              <Button
                onClick={handleGenerateDocuments}
                disabled={isGeneratingDocs || isGeneratingPDF || isUploading || isDeleting}
                className={
                  generatedDocsAreStale
                    ? 'bg-amber-600 hover:bg-amber-700 flex-shrink-0'
                    : 'bg-blue-600 hover:bg-blue-700 flex-shrink-0'
                }
              >
                {isGeneratingDocs || isGeneratingPDF ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Membuat...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    {generatedDocsAreStale ? 'Generate Ulang' : 'Generate Dokumen'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Generated document download links (above the softcopy upload) */}
          {generatedDocs && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Dokumen {dokumenLabel} hasil generate
              </p>
              <p className="text-xs text-gray-500 mb-3">
                {isTerdata
                  ? 'Dokumen ini sudah terlampir otomatis pada berkas. Unduh untuk dicetak dan ditandatangani Tim Peneliti.'
                  : 'Unduh, tanda tangani/stempel bila perlu, lalu unggah kembali sebagai softcopy SPPTG di bawah.'}
              </p>

              {generatedDocsAreStale && (
                <div className="mb-3 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <div className="text-xs text-amber-900">
                    <p className="font-semibold">Ada perubahan setelah dokumen dibuat</p>
                    <p className="mt-1 leading-relaxed">
                      Dokumen di bawah dibuat dengan{' '}
                      <strong>Nomor {dokumenLabel} {generatedDocs.nomorSPPTG}</strong>,{' '}
                      <strong>tanggal {formatIssueDate(generatedDocs.tanggalTerbit)}</strong>,
                      dan data pengajuan saat itu. Klik <strong>Generate Ulang</strong> agar
                      isinya sesuai dengan data terbaru
                      {isTerdata
                        ? ' — dokumen yang terlampir akan ikut diperbarui.'
                        : ' sebelum diunduh dan diunggah.'}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    triggerBrowserDownload(generatedDocs.pdfUrl, `${generatedDocs.baseName}.pdf`)
                  }
                  className="text-red-700 border-red-200 hover:bg-red-50"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Unduh PDF
                </Button>
              </div>
            </div>
          )}

          {/* SPPTG Document Upload. The terdata variant has no upload box at
              all — its certificate is attached by the generator — so it only
              ever renders the attached-document card below. */}
          <div className="space-y-3">
            <Label>
              {isTerdata ? (
                <>Dokumen {dokumenLabel} terlampir</>
              ) : (
                <>
                  Upload Softcopy {dokumenLabel} <span className="text-red-600">*</span>
                </>
              )}
            </Label>

            {isTerdata && !draft.dokumenSPPTG ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                <p className="text-sm text-gray-600">
                  Belum ada dokumen. Klik <strong>Generate Dokumen {dokumenLabel}</strong> di
                  atas — dokumennya akan terlampir otomatis di sini.
                </p>
                <FieldError message={errors.dokumenSPPTG} />
                {isUploading && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
                    <span>Melampirkan dokumen...</span>
                  </div>
                )}
              </div>
            ) : !draft.dokumenSPPTG ? (
              <div>
                <label
                  htmlFor="spptg-file"
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isUploading && !isDeleting) setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={
                    errors.dokumenSPPTG
                      ? 'flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-red-500 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors'
                      : isDragging
                        ? 'flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-blue-500 bg-blue-50 rounded-lg cursor-pointer transition-colors'
                        : 'flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors'
                  }
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
                    disabled={isUploading || isDeleting}
                  />
                </label>
                <FieldError message={errors.dokumenSPPTG} />

                {(isUploading || isDeleting) && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
                    <span>{isUploading ? 'Mengunggah dokumen...' : 'Menghapus dokumen...'}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File className="w-6 h-6 text-blue-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{draft.dokumenSPPTG.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(draft.dokumenSPPTG.size)} • Diunggah{' '}
                        {draft.dokumenSPPTG.uploadedAt}
                      </p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {draft.dokumenSPPTG.url && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handlePreviewUploaded()}
                          disabled={openDocumentMutation.isPending || isUploading || isDeleting}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDownloadUploaded()}
                          disabled={openDocumentMutation.isPending || isUploading || isDeleting}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {/* Replacing or removing is a terdaftar-only affordance:
                        a terdata certificate is regenerated, never swapped for
                        a file someone picked. */}
                    {!isTerdata && (
                      <>
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
                            disabled={isUploading || isDeleting}
                          />
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRemoveFile()}
                          disabled={isUploading || isDeleting}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Summary — only when nomor, tanggal, and softcopy are all filled */}
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
                      • Tanggal Terbit: {formatIssueDate(draft.tanggalTerbit || '')}
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
    </div>
  );
}
