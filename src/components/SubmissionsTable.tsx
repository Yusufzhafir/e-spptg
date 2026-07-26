import { useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Pencil,
  FilePlus2,
} from 'lucide-react';
import { Submission } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '@/lib/format-date';

export type EditMode = 'existing' | 'duplicate';

interface SubmissionsTableProps {
  submissions: Submission[];
  onViewDetail: (submission: Submission) => void;
  onEdit: (submission: Submission, mode: EditMode) => void;
  onToggleValidity: (submission: Submission) => void;
  isTogglingValidity: boolean;
  /** When set, the table pages to and highlights this submission's row */
  focusSubmissionId?: number | null;
}

type SortKey =
  | 'id'
  | 'namaPemilik'
  | 'kecamatan'
  | 'luas'
  | 'tanggalPengajuan'
  | 'status'
  | 'isValid'
  | 'verifikator'
  | 'updatedAt';

type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 10;

function getSortValue(s: Submission, key: SortKey): number | string {
  switch (key) {
    case 'id':
      return s.id;
    case 'namaPemilik':
      return (s.namaPemilik || '').toLowerCase();
    case 'kecamatan':
      return (s.kecamatan || '').toLowerCase();
    case 'luas':
      return s.luas ?? 0;
    case 'tanggalPengajuan':
      return new Date(s.tanggalPengajuan).getTime() || 0;
    case 'status':
      return s.status || '';
    case 'isValid':
      return s.isValid ? 1 : 0;
    case 'verifikator':
      return (s.verifikatorName || '').toLowerCase();
    case 'updatedAt':
      return new Date(s.updatedAt).getTime() || 0;
  }
}

export function SubmissionsTable({
  submissions,
  onViewDetail,
  onEdit,
  onToggleValidity,
  isTogglingValidity,
  focusSubmissionId,
}: SubmissionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<Submission | null>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  const sorted = useMemo(() => {
    const copy = [...submissions];
    copy.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [submissions, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Clamp at render so a shrinking data set never leaves us on a dead page.
  const safePage = Math.min(page, totalPages - 1);

  // When a map polygon is clicked, page to and highlight that row.
  useEffect(() => {
    if (focusSubmissionId == null) return;
    const index = sorted.findIndex((s) => s.id === focusSubmissionId);
    if (index === -1) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- respond to an external focus request
    setPage(Math.floor(index / PAGE_SIZE));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- respond to an external focus request
    setHighlightId(focusSubmissionId);
  }, [focusSubmissionId, sorted]);

  // Scroll to the highlighted row once it is on the current page, then fade it.
  useEffect(() => {
    if (highlightId == null) return;
    const el = rowRefs.current[highlightId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const timeout = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timeout);
  }, [highlightId, safePage]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

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

  const pageItems = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

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
                {submission.desaNama || `Desa #${submission.villageId}`}, {submission.kecamatan}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewDetail(submission)}
                    title="Lihat detail pengajuan"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditTarget(submission)}
                    title="Edit pengajuan"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
        <p className="text-sm text-gray-600">
          Menampilkan {safePage * PAGE_SIZE + 1}–
          {Math.min((safePage + 1) * PAGE_SIZE, sorted.length)} dari {sorted.length} pengajuan
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
          >
            <ChevronLeft className="w-4 h-4" />
            Sebelumnya
          </Button>
          <span className="text-sm text-gray-600">
            Hal {safePage + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage >= totalPages - 1}
          >
            Berikutnya
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
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
