import { useEffect, useRef, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Eye,
  Edit,
  Check,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Pencil,
  FilePlus2,
} from 'lucide-react';
import { Submission } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '@/lib/format-date';
import { useAuthRole } from './AuthRoleProvider';
import { TablePager, type ServerPagination } from './table-pagination';
import type { SubmissionSortKey } from '@/lib/validation';

export type EditMode = 'existing' | 'duplicate';

interface SubmissionsTableProps {
  submissions: Submission[];
  onViewDetail: (submission: Submission) => void;
  onEdit: (submission: Submission, mode: EditMode) => void;
  onToggleValidity: (submission: Submission) => void;
  isTogglingValidity: boolean;
  /** When set, the table pages to and highlights this submission's row */
  focusSubmissionId?: number | null;
  /**
   * 0-based position of that row in the whole result set, resolved by the
   * server. The browser holds one page and cannot find a row on any other, so
   * this is what turns "open pengajuan 812" into a page number.
   */
  focusPosition?: number | null;
  /** Changes per request, so focusing the same row twice still fires. */
  focusNonce?: number;
  /** Called once the row is on screen and scrolled to — the jump is finished. */
  onFocusSettled?: () => void;
  pagination: ServerPagination;
  sortKey: SortKey;
  sortDir: SortDirection;
  onSortChange: (key: SortKey) => void;
}

type SortKey = SubmissionSortKey;

type SortDirection = 'asc' | 'desc';

export function SubmissionsTable({
  submissions,
  onViewDetail,
  onEdit,
  onToggleValidity,
  isTogglingValidity,
  focusSubmissionId,
  focusPosition,
  focusNonce,
  onFocusSettled,
  pagination,
  sortKey,
  sortDir,
  onSortChange,
}: SubmissionsTableProps) {
  const { user: currentUser } = useAuthRole();
  // Editing (drafts.createFromSubmission) and the validity toggle both reject
  // Viewers and the read-only Kecamatan role on the server, so hide those
  // actions rather than offer a click that can only fail. Null while the
  // session loads, so nothing flashes in.
  const canProcess = Boolean(
    currentUser &&
      currentUser.peran !== 'Viewer' &&
      currentUser.peran !== 'Kecamatan'
  );
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<Submission | null>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  // `submissions` is already one page, ordered by Postgres: it arrives sorted
  // and sliced, so there is nothing left to do here but render it.
  const { page: safePage, setPage, pageSize } = pagination;

  // Jump to the row someone asked for (a clicked polygon, a notification).
  // Which page it lives on is the server's answer, not something the browser
  // can work out from the page it happens to be holding.
  useEffect(() => {
    if (focusSubmissionId == null || focusPosition == null) return;
     
    setPage(Math.floor(focusPosition / pageSize));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- respond to an external focus request
    setHighlightId(focusSubmissionId);
    // `focusNonce` is what makes asking for the same row twice work: the id and
    // its position are unchanged, so without it nothing here would re-run.
  }, [focusSubmissionId, focusPosition, focusNonce, pageSize, setPage]);

  // Scroll to the highlighted row once it is on the current page, then fade it.
  //
  // `submissions` is in the deps because changing page starts a fetch: on the
  // render right after `setPage` the new rows do not exist yet, so the ref is
  // empty. Waiting for the row rather than scrolling to nothing — and starting
  // the fade timer only once it is found — is what makes a jump to another page
  // actually land instead of silently doing nothing.
  useEffect(() => {
    if (highlightId == null) return;
    const el = rowRefs.current[highlightId];
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // The jump is done: whoever asked for it (the map popup) can stop waiting.
    onFocusSettled?.();
    const timeout = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timeout);
  }, [highlightId, safePage, submissions, onFocusSettled]);

  // Ordering is the server's job now — the parent owns the key and direction
  // because they are part of the query, not of this component's local state.
  const handleSort = onSortChange;

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (
      sortDir === 'asc' ? (
        <ChevronUp className="w-3.5 h-3.5" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5" />
      )
    ) : (
      <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400" />
    );

  const sortableHead = (label: string, key: SortKey, className?: string) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center gap-1 hover:text-gray-900"
      >
        {label} {sortIcon(key)}
      </button>
    </TableHead>
  );

  const pageItems = submissions;

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500 mb-4">Tidak ada pengajuan pada kriteria ini.</p>
        <Button variant="outline">Bersihkan filter</Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <Table className="min-w-250">
        <TableHeader>
          <TableRow>
            {sortableHead('ID', 'id')}
            {sortableHead('Pemilik', 'namaPemilik')}
            {sortableHead('Desa/Kecamatan', 'kecamatan')}
            {sortableHead('Luas (m²)', 'luas')}
            {sortableHead('Tgl Pengajuan', 'tanggalPengajuan')}
            {sortableHead('Status', 'status')}
            {sortableHead('Validasi', 'isValid')}
            {sortableHead('Verifikator', 'verifikator')}
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((submission) => (
            <TableRow
              key={submission.id}
              ref={(el) => {
                rowRefs.current[submission.id] = el;
              }}
              className={
                highlightId === submission.id
                  ? 'bg-blue-50 transition-colors'
                  : undefined
              }
            >
              <TableCell>{submission.id}</TableCell>
              <TableCell>
                <div>
                  <p>{submission.namaPemilik}</p>
                  <p className="text-xs text-gray-500">{submission.nik}</p>
                </div>
              </TableCell>
              <TableCell>
                {submission.desaNama || `Desa #${submission.villageId}`}
                {submission.desaKecamatan || submission.kecamatan
                  ? `, ${submission.desaKecamatan || submission.kecamatan}`
                  : ''}
              </TableCell>
              <TableCell>{submission.luas.toLocaleString()}</TableCell>
              <TableCell>{formatDate(submission.tanggalPengajuan)}</TableCell>
              <TableCell>
                <StatusBadge status={submission.status} />
              </TableCell>
              <TableCell>
                {submission.isValid ? (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                    <Check className="w-3 h-3 mr-1" />
                    Valid
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
                    <EyeOff className="w-3 h-3 mr-1" />
                    Invalid
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm">{submission.verifikatorName || '-'}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {canProcess && (
                    <Button
                      variant={submission.isValid ? 'outline' : 'default'}
                      size="sm"
                      disabled={isTogglingValidity}
                      onClick={() => onToggleValidity(submission)}
                      className={
                        submission.isValid
                          ? 'text-gray-700'
                          : 'bg-green-600 hover:bg-green-700'
                      }
                      title={
                        submission.isValid
                          ? 'Tandai invalid (sembunyikan dari peta)'
                          : 'Tandai valid (tampilkan di peta)'
                      }
                    >
                      {submission.isValid ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-1" />
                          Invalid
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Valid
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewDetail(submission)}
                    title="Lihat detail pengajuan"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  {canProcess && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditTarget(submission)}
                      title="Edit pengajuan"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
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
          setPageSize={pagination.setPageSize}
          total={pagination.total}
          lastPage={pagination.lastPage}
          noun="pengajuan"
        />
      </div>

      {/* Edit choice dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Pengajuan</DialogTitle>
            <DialogDescription>
              Pilih cara mengedit pengajuan{' '}
              <span className="font-medium text-gray-900">
                {editTarget?.namaPemilik}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                if (editTarget) onEdit(editTarget, 'existing');
                setEditTarget(null);
              }}
              className="flex flex-col items-start gap-2 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-blue-400 hover:bg-blue-50"
            >
              <Pencil className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">Edit yang ada</span>
              <span className="text-xs text-gray-500">
                Ubah pengajuan ini di tempat — data ter-update pada pengajuan yang sama.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (editTarget) onEdit(editTarget, 'duplicate');
                setEditTarget(null);
              }}
              className="flex flex-col items-start gap-2 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-green-400 hover:bg-green-50"
            >
              <FilePlus2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-900">Buat pengajuan baru</span>
              <span className="text-xs text-gray-500">
                Buat pengajuan baru dengan semua nilai input terisi dari pengajuan ini.
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
