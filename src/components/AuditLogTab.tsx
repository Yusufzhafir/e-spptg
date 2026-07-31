'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { trpc } from '@/trpc/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { SearchableSelect } from './SearchableSelect';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { formatDateTime } from '@/lib/format-date';
import { ENTITY_LABEL, actionLabel } from '@/server/audit/actions';

const PAGE_SIZE = 25;

/** `null` and `undefined` have to be visibly different from the string "null". */
function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value === '' ? '(kosong)' : value;
  if (typeof value === 'boolean') return value ? 'ya' : 'tidak';
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value, null, 2);
}

type Filters = {
  search: string;
  aksi: string;
  entitas: string;
  hasil: string;
  actorId: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY: Filters = {
  search: '',
  aksi: 'all',
  entitas: 'all',
  hasil: 'all',
  actorId: 'all',
  dateFrom: '',
  dateTo: '',
};

export function AuditLogTab() {
  const utils = trpc.useUtils();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const queryInput = useMemo(
    () => ({
      search: filters.search.trim() || undefined,
      aksi: filters.aksi === 'all' ? undefined : filters.aksi,
      entitas: filters.entitas === 'all' ? undefined : filters.entitas,
      hasil:
        filters.hasil === 'all' ? undefined : (filters.hasil as 'sukses' | 'gagal'),
      actorId: filters.actorId === 'all' ? undefined : Number(filters.actorId),
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [filters, page]
  );

  const { data, isLoading, isFetching } = trpc.audit.list.useQuery(queryInput, {
    placeholderData: (previous) => previous,
  });
  const { data: options } = trpc.audit.filterOptions.useQuery();
  const { data: detail, isLoading: isLoadingDetail } = trpc.audit.byId.useQuery(
    { id: detailId ?? 0 },
    { enabled: detailId !== null }
  );

  const deleteMutation = trpc.audit.delete.useMutation({
    onSuccess: () => {
      toast.success('Entri audit dihapus. Penghapusan ini sendiri ikut tercatat.');
      void utils.audit.list.invalidate();
      setDeleteId(null);
    },
    onError: (error) => toast.error(error.message || 'Gagal menghapus entri audit.'),
  });

  const setFilter = (patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(0);
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const hasFilter = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-900">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Jejak audit seluruh perubahan data oleh pengguna, termasuk percobaan yang
            gagal. Hanya Superadmin yang dapat membukanya. Kata sandi dan token
            otomatis disensor sebelum dicatat.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor="audit-search">Cari</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              id="audit-search"
              className="pl-9"
              placeholder="Nama, email, ringkasan, atau aksi…"
              value={filters.search}
              onChange={(e) => setFilter({ search: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="audit-entitas">Jenis Data</Label>
          <SearchableSelect
            id="audit-entitas"
            value={filters.entitas}
            // Changing the data type resets the action: the action list is
            // filtered by it, so a stale selection would show zero rows with no
            // obvious reason why.
            onValueChange={(v) => setFilter({ entitas: v, aksi: 'all' })}
            searchPlaceholder="Cari jenis data..."
            options={[
              { value: 'all', label: 'Semua jenis' },
              ...Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>

        <div>
          <Label htmlFor="audit-aksi">Aksi</Label>
          <SearchableSelect
            id="audit-aksi"
            value={filters.aksi}
            onValueChange={(v) => setFilter({ aksi: v })}
            searchPlaceholder="Cari aksi..."
            options={[
              { value: 'all', label: 'Semua aksi' },
              ...(options?.aksi ?? [])
                .filter((a) => filters.entitas === 'all' || a.entitas === filters.entitas)
                .map((a) => ({ value: a.aksi, label: a.label })),
            ]}
          />
        </div>

        <div>
          <Label htmlFor="audit-pelaku">Pelaku</Label>
          <SearchableSelect
            id="audit-pelaku"
            value={filters.actorId}
            onValueChange={(v) => setFilter({ actorId: v })}
            searchPlaceholder="Cari nama atau email..."
            options={[
              { value: 'all', label: 'Semua pengguna' },
              ...(options?.pelaku ?? []).map((p) => ({
                value: String(p.id),
                label: `${p.nama} — ${p.email}`,
              })),
            ]}
          />
        </div>

        <div>
          <Label htmlFor="audit-hasil">Hasil</Label>
          <SearchableSelect
            id="audit-hasil"
            value={filters.hasil}
            onValueChange={(v) => setFilter({ hasil: v })}
            searchPlaceholder="Cari hasil..."
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'sukses', label: 'Berhasil' },
              { value: 'gagal', label: 'Gagal' },
            ]}
          />
        </div>

        <div>
          <Label htmlFor="audit-from">Dari tanggal</Label>
          <Input
            id="audit-from"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilter({ dateFrom: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="audit-to">Sampai tanggal</Label>
          <Input
            id="audit-to"
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilter({ dateTo: e.target.value })}
          />
        </div>

        {hasFilter && (
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setFilters(EMPTY);
                setPage(0);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset filter
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Pelaku</th>
              <th className="px-4 py-3">Aksi</th>
              <th className="px-4 py-3">Ringkasan</th>
              <th className="px-4 py-3">Hasil</th>
              <th className="px-4 py-3 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  {hasFilter
                    ? 'Tidak ada entri yang cocok dengan filter.'
                    : 'Belum ada aktivitas tercatat.'}
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{row.actorNama}</div>
                    <div className="text-xs text-gray-500">
                      {row.actorEmail} · {row.actorPeran}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{actionLabel(row.aksi)}</div>
                    <div className="text-xs text-gray-500">
                      {ENTITY_LABEL[row.entitas as keyof typeof ENTITY_LABEL] ?? row.entitas}
                      {row.entitasId !== null && ` #${row.entitasId}`}
                    </div>
                  </td>
                  <td className="max-w-md px-4 py-3 text-gray-700">
                    <div className="line-clamp-2">{row.ringkasan}</div>
                    {row.jumlahPerubahan > 0 && (
                      <span className="mt-1 inline-block text-xs text-blue-600">
                        {row.jumlahPerubahan} kolom berubah
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        row.hasil === 'gagal'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-green-200 bg-green-50 text-green-700'
                      }
                    >
                      {row.hasil === 'gagal' ? 'Gagal' : 'Berhasil'}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailId(row.id)}
                    >
                      Detail
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setDeleteId(row.id)}
                      aria-label={`Hapus entri audit ${row.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paging */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {total === 0
            ? 'Tidak ada entri'
            : `Menampilkan ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} dari ${total} entri`}
          {isFetching && !isLoading && ' · memuat…'}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          >
            Berikutnya
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Detail — the before/after view */}
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Aktivitas</DialogTitle>
            <DialogDescription>
              {detail ? `${actionLabel(detail.aksi)} · ${formatDateTime(detail.createdAt)}` : ''}
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetail || !detail ? (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-5">
              <dl className="grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">Pelaku</dt>
                  <dd className="font-medium text-gray-900">
                    {detail.actorNama} ({detail.actorPeran})
                  </dd>
                  <dd className="text-xs text-gray-500">{detail.actorEmail}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Aksi</dt>
                  <dd className="font-medium text-gray-900">{actionLabel(detail.aksi)}</dd>
                  <dd className="text-xs text-gray-500">{detail.aksi}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Alamat IP</dt>
                  <dd className="text-gray-900">{detail.ipAddress ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Hasil</dt>
                  <dd className="text-gray-900">
                    {detail.hasil === 'gagal' ? `Gagal — ${detail.galat ?? ''}` : 'Berhasil'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Perangkat</dt>
                  <dd className="break-all text-xs text-gray-600">
                    {detail.userAgent ?? '—'}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Ringkasan</h3>
                <p className="rounded-lg bg-white p-3 text-sm leading-relaxed text-gray-700 ring-1 ring-gray-200">
                  {detail.ringkasan}
                </p>
              </div>

              {Object.keys(detail.perubahan).length > 0 ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">
                    Perubahan ({Object.keys(detail.perubahan).length} kolom)
                  </h3>
                  <div className="overflow-x-auto rounded-lg ring-1 ring-gray-200">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2">Kolom</th>
                          <th className="px-3 py-2">Sebelum</th>
                          <th className="px-3 py-2">Sesudah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {Object.entries(detail.perubahan).map(([field, v]) => (
                          <tr key={field}>
                            <td className="px-3 py-2 font-medium text-gray-900">{field}</td>
                            <td className="px-3 py-2">
                              <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-800">
                                {renderValue(v.sebelum)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-800">
                                {renderValue(v.sesudah)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Tidak ada perbandingan kolom untuk aksi ini (misalnya penambahan,
                  penghapusan, atau aksi yang tidak mengubah baris tertentu).
                </p>
              )}

              {/* Raw snapshots, collapsed — the field table is the usual view. */}
              {Boolean(detail.sebelum || detail.sesudah) && (
                <details className="rounded-lg ring-1 ring-gray-200">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700">
                    Data mentah sebelum &amp; sesudah
                  </summary>
                  <div className="grid gap-3 border-t border-gray-200 p-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
                        Sebelum
                      </p>
                      <pre className="max-h-72 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                        {JSON.stringify(detail.sebelum, null, 2) ?? 'null'}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
                        Sesudah
                      </p>
                      <pre className="max-h-72 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                        {JSON.stringify(detail.sesudah, null, 2) ?? 'null'}
                      </pre>
                    </div>
                  </div>
                </details>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus entri audit ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Entri ini akan dihapus permanen. Perlu diketahui:{' '}
              <strong>penghapusan ini sendiri akan tercatat di jejak audit</strong>,
              lengkap dengan isi entri yang dihapus — supaya jejaknya tidak bisa
              dibersihkan tanpa bekas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
            >
              {deleteMutation.isPending ? 'Menghapus…' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
