'use client';

import { useMemo, useState, useTransition } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { useRouter } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DEFAULT_PAGE_SIZE, TablePager } from '@/components/table-pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Plus,
  FileEdit,
  Trash2,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { toast } from 'sonner';

type DraftSortKey = 'namaPemohon' | 'nik' | 'currentStep' | 'lastSaved';
type SortDirection = 'asc' | 'desc';

export default function DraftsListPage() {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<number | null>(null);
  const { data: currentUser } = trpc.auth.me.useQuery();
  const isPrivilegedView = currentUser ? currentUser.peran !== 'Viewer' : false;

  // Search / filter / sort / pagination (client-side)
  const [search, setSearch] = useState('');
  const [stepFilter, setStepFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<DraftSortKey>('lastSaved');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  // Paged, searched and sorted in Postgres — the list used to come back whole
  // with no limit at all, and the browser did all three.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeState] = useState<number>(DEFAULT_PAGE_SIZE);

  const listInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      step: stepFilter === 'all' ? undefined : Number(stepFilter),
      sortKey,
      sortDir,
      limit: pageSize,
      offset: page * pageSize,
    }),
    [search, stepFilter, sortKey, sortDir, page, pageSize]
  );

  const { data, isLoading, error, refetch } = trpc.drafts.listMy.useQuery(listInput, {
    placeholderData: (previous) => previous,
  });

  const pagedDrafts = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const safePage = Math.min(page, lastPage);

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(0);
  };

  /** Distinguishes "no drafts yet" from "nothing matched" once paging is server-side. */
  const hasFilter = search.trim() !== '' || stepFilter !== 'all';

  const handleSort = (key: DraftSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const sortIcon = (key: DraftSortKey) =>
    sortKey === key ? (
      sortDir === 'asc' ? (
        <ChevronUp className="w-3.5 h-3.5" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5" />
      )
    ) : (
      <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400" />
    );

  // Stays true until the draft editor has actually rendered, so the button
  // cannot be clicked a second time during the navigation itself — the mutation's
  // own isPending drops the moment the row is created, well before we leave.
  const [isOpeningDraft, startOpeningDraft] = useTransition();

  // Create draft mutation
  const createDraftMutation = trpc.drafts.create.useMutation({
    onSuccess: (data) => {
      // The success toast is raised by the draft editor once it is on screen
      // (see the `?baru=1` flag), so the confirmation lands on the page the
      // user was sent to rather than on the one they are leaving.
      startOpeningDraft(() => {
        router.push(`/app/pengajuan/draft/${data.id}?baru=1`);
      });
    },
    onError: (error) => {
      toast.error(`Gagal membuat draft: ${error.message}`);
    },
  });

  const isCreatingDraft = createDraftMutation.isPending || isOpeningDraft;

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
    // 'Kecamatan' is dashboard-only oversight — no access to the pengajuan menu.
    <RequireRole
      allowedRoles={['Superadmin', 'Admin', 'Verifikator', 'Viewer']}
      showError={true}
      redirectTo="/app"
    >
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
            disabled={isCreatingDraft}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isCreatingDraft ? 'Membuat...' : 'Buat Draft Baru'}
          </Button>
        </div>
      </div>

      {/* Search & Filter. Stays on screen while a filter is active even if it
          matches nothing — otherwise the controls vanish with no way back. */}
      {(total > 0 || hasFilter) && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Cari nama pemohon, NIK, desa..."
              className="pl-9"
            />
          </div>
          <Select
            value={stepFilter}
            onValueChange={(v) => {
              setStepFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Semua tahap" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tahap</SelectItem>
              <SelectItem value="1">Berkas</SelectItem>
              <SelectItem value="2">Lapangan</SelectItem>
              <SelectItem value="3">Hasil</SelectItem>
              <SelectItem value="4">Terbitkan SPPTG</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Drafts Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Memuat draft...</span>
          </div>
        ) : error ? (
          <div className="px-6 py-10 text-center">
            <p className="text-red-600">{error.message}</p>
          </div>
        ) : total === 0 && hasFilter ? (
          <div className="px-6 py-10 text-center text-gray-500">
            Tidak ada draft yang cocok dengan pencarian/filter.
          </div>
        ) : total > 0 ? (
          <>
          <Table className="min-w-200">
            <TableHeader>
              <TableRow>
                {isPrivilegedView && <TableHead>Pemilik</TableHead>}
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('namaPemohon')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    Nama Pemohon {sortIcon('namaPemohon')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('nik')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    NIK {sortIcon('nik')}
                  </button>
                </TableHead>
                {isPrivilegedView && <TableHead>Desa</TableHead>}
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('currentStep')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    Tahap {sortIcon('currentStep')}
                  </button>
                </TableHead>
                {isPrivilegedView && <TableHead>Validasi Step 1</TableHead>}
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('lastSaved')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    Terakhir Disimpan {sortIcon('lastSaved')}
                  </button>
                </TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedDrafts.map((draft) => (
                <TableRow key={draft.id}>
                  {isPrivilegedView && (
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-gray-900">{draft.ownerName || '-'}</p>
                        {draft.isOwnDraft && (
                          <span className="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                            Draft Saya
                          </span>
                        )}
                      </div>
                    </TableCell>
                  )}
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
                  {isPrivilegedView && (
                    <TableCell>
                      {draft.villageName || (
                        <span className="text-gray-400">Belum dipilih</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getStepLabel(draft.currentStep)}
                    </span>
                  </TableCell>
                  {isPrivilegedView && (
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                          draft.isStep1Validated
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {draft.isStep1Validated ? 'Valid' : 'Belum'}
                      </span>
                    </TableCell>
                  )}
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

          {/* Pagination */}
          <div className="border-t border-gray-200 px-4 py-3">
            <TablePager
              page={safePage}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              total={total}
              lastPage={lastPage}
              noun="draft"
            />
          </div>
          </>
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
              disabled={isCreatingDraft}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isCreatingDraft ? 'Membuat...' : 'Buat Draft Baru'}
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
    </RequireRole>
  );
}
