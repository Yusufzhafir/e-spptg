'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, FileText, Search } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { UserAvatar } from '@/components/UserAvatar';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchableSelect } from '@/components/SearchableSelect';
import { DEFAULT_PAGE_SIZE, TablePager } from '@/components/table-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/format-date';
import type { StatusSPPTG } from '@/types';

const STATUS_OPTIONS = [
  'SPPTG terdata',
  'SPPTG terdaftar',
  'SPPTG ditinjau ulang',
  'SPPTG ditolak',
  'Terbit SPPTG',
] as const;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 wrap-break-word text-sm text-gray-900">{value}</dd>
    </div>
  );
}

/**
 * One account in full: photo, profile, and every pengajuan connected to it.
 *
 * Reached from the Lihat Detail icon in Pengaturan → Pengguna. The pengajuan
 * rows link into the dashboard focused on that row (`/app?focus=`), rather than
 * duplicating the detail view that already lives there.
 */
export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = Number(params.id);
  const isValidId = Number.isInteger(userId) && userId > 0;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [keterkaitanFilter, setKeterkaitanFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeState] = useState<number>(DEFAULT_PAGE_SIZE);

  // Searched, filtered and paged in Postgres: a long-serving verifikator
  // accumulates thousands of pengajuan, and this list is theirs in full.
  const { data, isLoading, error } = trpc.users.detail.useQuery(
    {
      id: userId,
      search: search.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      keterkaitan:
        keterkaitanFilter === 'all'
          ? undefined
          : (keterkaitanFilter as 'Pemohon' | 'Verifikator'),
      limit: pageSize,
      offset: page * pageSize,
    },
    { enabled: isValidId, placeholderData: (previous) => previous }
  );

  const pageRows = useMemo(() => data?.submissions ?? [], [data?.submissions]);
  const total = data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(0);
  };
  const resetToFirstPage = () => setPage(0);

  /** Distinguishes "no pengajuan at all" from "nothing matched the filter". */
  const hasFilter =
    search.trim() !== '' || statusFilter !== 'all' || keterkaitanFilter !== 'all';

  const villageLabel = useMemo(() => {
    if (!data?.user.assignedVillageId) return '—';
    // The desa name travels with the pengajuan rows; fall back to the id when
    // the account has no pengajuan to borrow a name from.
    const named = data.submissions.find((s) => s.desaNama)?.desaNama;
    return named ?? `Desa #${data.user.assignedVillageId}`;
  }, [data]);

  if (!isValidId || error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="mb-4 h-16 w-16 text-red-500" />
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Pengguna Tidak Ditemukan
        </h1>
        <p className="mb-6 text-gray-600">
          {error?.message ??
            'Pengguna yang Anda cari tidak ada atau bukan cakupan Anda.'}
        </p>
        <Button variant="outline" onClick={() => router.push('/app/pengaturan')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Pengaturan
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  const { user } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => router.push('/app/pengaturan')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Kembali ke Pengaturan
      </Button>

      {/* Profile. Stacked on a phone, side by side from `sm` up. */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          <UserAvatar
            nama={user.nama}
            email={user.email}
            fotoProfilUrl={user.fotoProfilUrl}
            className="h-24 w-24"
            textClassName="text-2xl"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900">{user.nama}</h1>
            <p className="mt-0.5 wrap-break-word text-sm text-gray-500">{user.email}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge
                variant="outline"
                className="border-blue-600 bg-blue-50 text-blue-700"
              >
                {user.peran}
              </Badge>
              <Badge
                variant="outline"
                className={
                  user.status === 'Aktif'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-500 bg-gray-50 text-gray-700'
                }
              >
                {user.status}
              </Badge>
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="NIP/NIK" value={user.nipNik} />
          <Field label="Nomor HP" value={user.nomorHP || '—'} />
          <Field label="Desa Penugasan" value={villageLabel} />
          <Field label="Kecamatan Penugasan" value={user.assignedKecamatan || '—'} />
          <Field
            label="Kata Sandi"
            value={user.hasPassword ? 'Sudah diatur' : 'Menunggu buat sandi'}
          />
          <Field label="Terakhir Masuk" value={formatDateTime(user.terakhirMasuk)} />
        </dl>
      </section>

      {/* Pengajuan connected to this account. */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
            <FileText className="h-4 w-4 text-blue-600" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900">Pengajuan Terkait</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Pengajuan yang diajukan maupun diproses oleh akun ini. Klik salah
              satu untuk membukanya di daftar pengajuan.
            </p>
          </div>
        </div>

        {total === 0 && !hasFilter ? (
          <p className="mt-5 rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            Belum ada pengajuan yang terkait dengan akun ini.
          </p>
        ) : (
          <>
            {/* Stacked on a phone, side by side from `sm` up. */}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Cari nama pemilik atau desa…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetToFirstPage();
                  }}
                  className="pl-10"
                />
              </div>

              {/* Every status, not just the ones present: the page holds one
                  slice now, so it cannot tell which statuses exist elsewhere. */}
              <SearchableSelect
                className="w-full sm:w-[200px]"
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  resetToFirstPage();
                }}
                placeholder="Semua Status"
                searchPlaceholder="Cari status..."
                options={[
                  { value: 'all', label: 'Semua Status' },
                  ...STATUS_OPTIONS.map((status) => ({ value: status, label: status })),
                ]}
              />

              <SearchableSelect
                className="w-full sm:w-[170px]"
                value={keterkaitanFilter}
                onValueChange={(value) => {
                  setKeterkaitanFilter(value);
                  resetToFirstPage();
                }}
                placeholder="Semua Keterkaitan"
                searchPlaceholder="Cari keterkaitan..."
                options={[
                  { value: 'all', label: 'Semua Keterkaitan' },
                  { value: 'Pemohon', label: 'Pemohon' },
                  { value: 'Verifikator', label: 'Verifikator' },
                ]}
              />
            </div>

            {total === 0 && (
              <p className="mt-4 rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                Tidak ada pengajuan yang cocok dengan pencarian atau filter ini.
              </p>
            )}

            {/* Cards below `md`, where an eight-column table would need to be
                scrolled sideways to read a single row. */}
            <ul className="mt-4 space-y-3 md:hidden">
              {pageRows.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/app?focus=${item.id}`)}
                    className="w-full rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate font-medium text-gray-900">
                        {item.namaPemilik}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {item.keterkaitan}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status as StatusSPPTG} />
                      <span className="text-xs text-gray-500">
                        {item.desaNama ?? '—'} • {formatDateTime(item.tanggalPengajuan)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Nama Pemilik</TableHead>
                    <TableHead>Desa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Keterkaitan</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((item) => (
                    <TableRow
                      key={item.id}
                      onClick={() => router.push(`/app?focus=${item.id}`)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium text-gray-900">
                        {item.namaPemilik}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {item.desaNama ?? '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status as StatusSPPTG} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.keterkaitan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDateTime(item.tanggalPengajuan)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4">
              <TablePager
                page={Math.min(page, lastPage)}
                setPage={setPage}
                pageSize={pageSize}
                setPageSize={setPageSize}
                total={total}
                lastPage={lastPage}
                noun="pengajuan"
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
