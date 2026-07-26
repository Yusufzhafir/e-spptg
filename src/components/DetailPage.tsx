import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { MapView } from './MapView';
import { StatusBadge } from './StatusBadge';
import { ChevronLeft, FileText, Clock, MessageSquare, File, Download, Loader2, Trash2, Send } from 'lucide-react';
import { Badge } from './ui/badge';
import { Submission } from '@/types';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { geomGeoJSONPolygonSchema } from '@/lib/validation';
import { findCenter } from '@/lib/utils';
import { trpc } from '@/trpc/client';
import { formatDate } from '@/lib/format-date';

interface DetailPageProps {
  submission: Submission;
  onBack: () => void;
}

export function DetailPage({ submission, onBack }: DetailPageProps) {
  const [openingDocumentId, setOpeningDocumentId] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');

  const { data: currentUser } = trpc.auth.me.useQuery();
  const {
    data: comments,
    isLoading: isCommentsLoading,
    refetch: refetchComments,
  } = trpc.comments.listBySubmission.useQuery({ submissionId: submission.id });

  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setNewComment('');
      void refetchComments();
      toast.success('Komentar terkirim');
    },
    onError: (error) => toast.error(error.message || 'Gagal mengirim komentar'),
  });

  const deleteCommentMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      void refetchComments();
      toast.info('Komentar dihapus');
    },
    onError: (error) => toast.error(error.message || 'Gagal menghapus komentar'),
  });

  const canDeleteComment = (commentUserId: number) => {
    if (!currentUser) return false;
    if (currentUser.peran === 'Superadmin') return true;
    if (commentUserId === currentUser.id) return true;
    if (submission.ownerUserId != null && submission.ownerUserId === currentUser.id) return true;
    if (currentUser.peran === 'Admin' && currentUser.assignedVillageId === submission.villageId) {
      return true;
    }
    return false;
  };

  const handleSubmitComment = () => {
    const content = newComment.trim();
    if (!content) {
      toast.error('Komentar tidak boleh kosong');
      return;
    }
    createCommentMutation.mutate({ submissionId: submission.id, content });
  };

  const formatCommentDate = (value: Date | string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
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

  // Riwayat dates come in mixed shapes (ISO, plain date, or locale string).
  // Format when parseable; otherwise keep the original text.
  const formatRiwayatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || '-';
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleOpenDocument = async (documentId: number) => {
    setOpeningDocumentId(documentId);

    try {
      const { signedUrl } = await openDocumentMutation.mutateAsync({ documentId });
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
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

      {/* Main Content — full-width map */}
      <div>
        <Card>
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
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
                  <p>{formatDate(submission.tanggalPengajuan)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="informasi">
            {/* 2 columns on phones so the labels stay readable, 4 from sm up */}
            <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="informasi">
                <FileText className="w-4 h-4 mr-1 sm:mr-2" />
                Informasi
              </TabsTrigger>
              <TabsTrigger value="dokumen">
                <FileText className="w-4 h-4 mr-1 sm:mr-2" />
                Dokumen
              </TabsTrigger>
              <TabsTrigger value="riwayat">
                <Clock className="w-4 h-4 mr-1 sm:mr-2" />
                Riwayat Status
              </TabsTrigger>
              <TabsTrigger value="komentar">
                <MessageSquare className="w-4 h-4 mr-1 sm:mr-2" />
                Komentar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="informasi" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                      <p className="text-sm text-gray-600">{formatRiwayatDate(item.tanggal)}</p>
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
                <div className="space-y-2">
                  <Textarea
                    placeholder="Tambahkan komentar..."
                    rows={3}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <Button
                    onClick={handleSubmitComment}
                    disabled={createCommentMutation.isPending || !newComment.trim()}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {createCommentMutation.isPending ? 'Mengirim...' : 'Kirim Komentar'}
                  </Button>
                </div>

                <div className="space-y-3">
                  {isCommentsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Memuat komentar...</span>
                    </div>
                  ) : !comments || comments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
                      <MessageSquare className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                      <p className="text-sm text-gray-600">Belum ada komentar.</p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-lg border border-gray-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-900">
                                {comment.authorName || 'Pengguna'}
                              </p>
                              {comment.authorRole && (
                                <Badge variant="outline" className="text-xs">
                                  {comment.authorRole}
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500">
                                {formatCommentDate(comment.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap wrap-break-word">
                              {comment.content}
                            </p>
                          </div>
                          {canDeleteComment(comment.userId) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteCommentMutation.mutate({ commentId: comment.id })}
                              disabled={deleteCommentMutation.isPending}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
