'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Plus, FileEdit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DraftsListPage() {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<number | null>(null);

  // Fetch user's drafts
  const { data: drafts, isLoading, refetch } = trpc.drafts.listMy.useQuery();

  // Create draft mutation
  const createDraftMutation = trpc.drafts.create.useMutation({
    onSuccess: (data) => {
      toast.success('Draft baru berhasil dibuat');
      router.push(`/app/pengajuan/draft/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Gagal membuat draft: ${error.message}`);
    },
  });

  // Delete draft mutation
  const deleteDraftMutation = trpc.drafts.delete.useMutation({
    onSuccess: () => {
      toast.success('Draft berhasil dihapus');
      refetch();
      setDeleteDialogOpen(false);
      setDraftToDelete(null);
    },
    onError: (error) => {
      toast.error(`Gagal menghapus draft: ${error.message}`);
    },
  });

  const handleCreateDraft = () => {
    createDraftMutation.mutate();
  };

  const handleContinueDraft = (draftId: number) => {
    router.push(`/app/pengajuan/draft/${draftId}`);
  };

  const handleDeleteClick = (draftId: number) => {
    setDraftToDelete(draftId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (draftToDelete) {
      deleteDraftMutation.mutate({ draftId: draftToDelete });
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStepLabel = (step: number) => {
    switch (step) {
      case 1:
        return 'Berkas';
      case 2:
        return 'Lapangan';
      case 3:
        return 'Hasil';
      case 4:
        return 'Terbitkan SPPTG';
      default:
        return `Step ${step}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/app" className="text-gray-600 hover:text-gray-900">
                Beranda
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Draft Pengajuan</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Draft Pengajuan</h1>
            <p className="text-gray-600 mt-1">
              Kelola draft pengajuan SPPTG Anda
            </p>
          </div>
          <Button
            onClick={handleCreateDraft}
            disabled={createDraftMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {createDraftMutation.isPending ? 'Membuat...' : 'Buat Draft Baru'}
          </Button>
        </div>
      </div>

      {/* Drafts Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Memuat draft...</span>
          </div>
        ) : drafts && drafts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Pemohon</TableHead>
                <TableHead>NIK</TableHead>
                <TableHead>Tahap</TableHead>
                <TableHead>Terakhir Disimpan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((draft) => (
                <TableRow key={draft.id}>
                  <TableCell className="font-medium">
                    {draft.namaPemohon || (
                      <span className="text-gray-400 italic">Draft Baru</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {draft.nik || (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getStepLabel(draft.currentStep)}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {formatDate(draft.lastSaved)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleContinueDraft(draft.id)}
                      >
                        <FileEdit className="w-4 h-4 mr-1" />
                        Lanjutkan
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(draft.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <FileEdit className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Belum ada draft
            </h3>
            <p className="text-gray-600 mb-4">
              Mulai dengan membuat draft pengajuan baru
            </p>
            <Button
              onClick={handleCreateDraft}
              disabled={createDraftMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {createDraftMutation.isPending ? 'Membuat...' : 'Buat Draft Baru'}
            </Button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus draft ini? Tindakan ini tidak dapat
              dibatalkan dan semua data dalam draft akan hilang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteDraftMutation.isPending}
            >
              {deleteDraftMutation.isPending ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

