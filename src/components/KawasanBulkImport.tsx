'use client';

/**
 * "Impor Massal Kawasan" — one boundary file in, many Kawasan Non-SPPTG out.
 *
 * The single kawasan form refuses a file like `SK_397_TAHUN_2025_KH_KALTIM`
 * because that file is not one kawasan, it is 188 of them. This screen is the
 * other answer: it groups the file by its own name column and writes one row
 * per kawasan.
 *
 * **Each kawasan is filled in on its own.** The batch could have owned the
 * attributes — a boundary file does come from one SK — but one SK is not one
 * kawasan: a single release routinely mixes Hutan Lindung with Hutan Produksi
 * and Cagar Alam, and batch-only fields left an officer either importing three
 * times or recording the wrong jenis on two thirds of the rows. So the table of
 * kawasan is the form, "Isi Cepat" is a tool that *writes into* those rows
 * rather than a layer hiding underneath them, and what a row shows is exactly
 * what will be saved.
 *
 * Three more deliberate choices.
 *
 * **The file is parsed in the browser, never uploaded.** shpjs is already here
 * and lazily loaded; sending 16 MB of zip to the server to get the same result
 * would only add a place for it to time out.
 *
 * **Nothing is imported without being shown first.** A provincial SK covers
 * kabupaten this office has no business recording, so every kawasan is listed
 * and ticked individually; groups too large to be one kawasan, and names
 * already on record, are listed too but start unticked with the reason beside
 * them.
 *
 * **The upload is batched by vertex count, not row count.** 1.33 million
 * vertices is 51 MB of JSON; batching keeps each request predictable regardless
 * of whether the next kawasan is 400 points or 40 000. Progress is reported per
 * batch, and a failure stops rather than pressing on — the officer needs to
 * know exactly how far it got.
 */

import { useMemo, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ChevronLeft,
  FileUp,
  Layers,
  Loader2,
  Pencil,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';
import { parseGeospatialFile, UNLIMITED_POLYGON_POINTS } from '@/lib/kmz-parser';
import {
  applyQuickFill,
  findRowsMissingAttributes,
  groupPolygonsIntoKawasan,
  groupToMultiPolygon,
  initialRowAttributeMap,
  isImportable,
  planKawasanImportBatches,
  summarizeImportGroups,
  type KawasanBulkHandoff,
  type KawasanImportGroup,
  type KawasanRowAttributes,
} from '@/lib/kawasan-bulk-import';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
import { PROHIBITED_AREA_TYPES } from '@/lib/prohibited-area-types';
import { formatDate } from '@/lib/format-date';
import type { ProhibitedAreaType, ValidationStatus } from '@/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { SearchableSelect } from './SearchableSelect';
import { RequiredMark } from './RequiredMark';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

/** Kawasan listed at once. A provincial file is ~190 rows; this keeps it civil. */
const PREVIEW_PAGE_SIZE = 50;

const num = (value: number) => value.toLocaleString('id-ID');

const jenisOptions = PROHIBITED_AREA_TYPES.map((jenis) => ({ value: jenis, label: jenis }));

interface KawasanBulkImportProps {
  /**
   * A file already parsed elsewhere — handed over by Tambah Kawasan when the
   * upload turned out to describe several kawasan. Re-reading a 16 MB shapefile
   * just to show the same list again is exactly the kind of wait that makes a
   * page look broken, so the groups travel instead of the file.
   */
  handoff?: KawasanBulkHandoff;
  /** Back to the single kawasan form, when this screen was reached from it. */
  onCancel?: () => void;
}

export function KawasanBulkImport({ handoff, onCancel }: KawasanBulkImportProps = {}) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [fileName, setFileName] = useState<string | null>(handoff?.fileName ?? null);
  const [isParsing, setIsParsing] = useState(false);
  const [groups, setGroups] = useState<KawasanImportGroup[]>(handoff?.groups ?? []);

  /** Per-kawasan attributes — the actual form. Keyed by group key. */
  const [rows, setRows] = useState<Record<string, KawasanRowAttributes>>(() =>
    initialRowAttributeMap(handoff?.groups ?? [], handoff?.atribut)
  );

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((handoff?.groups ?? []).filter(isImportable).map((group) => group.key))
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  /** The "Isi Cepat" form. Written into rows on demand, never read at save time. */
  const [quickFill, setQuickFill] = useState<Partial<KawasanRowAttributes>>(() => ({
    jenisKawasan: handoff?.atribut?.jenisKawasan,
    sumberData: handoff?.atribut?.sumberData ?? '',
    dasarHukum: handoff?.atribut?.dasarHukum ?? '',
    tanggalEfektif: handoff?.atribut?.tanggalEfektif ?? '',
  }));

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const { data: existingNames } = trpc.prohibitedAreas.namaTerpakai.useQuery();
  const bulkMutation = trpc.prohibitedAreas.createBulk.useMutation();

  /** Names already on record, lowercased — a re-import of the same SK. */
  const takenNames = useMemo(
    () => new Set((existingNames ?? []).map((name) => name.trim().toLowerCase())),
    [existingNames]
  );

  const summary = useMemo(() => summarizeImportGroups(groups), [groups]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(
      (group) =>
        group.nama.toLowerCase().includes(query) ||
        (rows[group.key]?.namaKawasan ?? '').toLowerCase().includes(query)
    );
  }, [groups, rows, search]);

  const pageCount = Math.max(1, Math.ceil(filteredGroups.length / PREVIEW_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleGroups = filteredGroups.slice(
    safePage * PREVIEW_PAGE_SIZE,
    safePage * PREVIEW_PAGE_SIZE + PREVIEW_PAGE_SIZE
  );

  const selectedGroups = useMemo(
    () => groups.filter((group) => selected.has(group.key)),
    [groups, selected]
  );
  const selectedPoints = selectedGroups.reduce((total, g) => total + g.pointCount, 0);
  const selectedBlocks = selectedGroups.reduce((total, g) => total + g.blockCount, 0);

  /** Selected kawasan that are still missing something they need. */
  const problems = useMemo(
    () => findRowsMissingAttributes(selectedGroups, rows),
    [selectedGroups, rows]
  );
  const problemKeys = useMemo(() => new Set(problems.map((p) => p.key)), [problems]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setImportedCount(null);
    try {
      const result = await parseGeospatialFile(file, {
        maxPoints: UNLIMITED_POLYGON_POINTS,
      });
      if (!result.success) {
        toast.error(result.error || 'Gagal memproses file geospasial');
        return;
      }

      const grouped = groupPolygonsIntoKawasan(result.polygons);
      if (grouped.length === 0) {
        toast.error('Tidak ada polygon yang dapat dikelompokkan dari file ini.');
        return;
      }

      setGroups(grouped);
      setRows(initialRowAttributeMap(grouped, result.atribut));
      setFileName(file.name);
      setPage(0);
      setSearch('');
      // Everything importable and not already on record starts ticked: that is
      // the common case, and unticking a handful beats ticking a hundred.
      setSelected(
        new Set(
          grouped
            .filter(
              (group) =>
                isImportable(group) && !takenNames.has(group.nama.trim().toLowerCase())
            )
            .map((group) => group.key)
        )
      );
      setQuickFill({
        jenisKawasan: result.atribut?.jenisKawasan,
        sumberData: result.atribut?.sumberData ?? '',
        dasarHukum: result.atribut?.dasarHukum ?? '',
        tanggalEfektif: result.atribut?.tanggalEfektif ?? '',
      });

      const blocked = grouped.filter((group) => !isImportable(group)).length;
      toast.success(
        `File berisi ${num(grouped.length)} kawasan. ` +
          (blocked > 0 ? `${num(blocked)} di antaranya terlalu besar dan ditandai.` : '')
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memproses file geospasial');
    } finally {
      setIsParsing(false);
      input.value = '';
    }
  };

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /** Tick or clear everything currently matching the search. */
  const setAllVisible = (checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const group of filteredGroups) {
        if (!isImportable(group)) continue;
        if (checked) next.add(group.key);
        else next.delete(group.key);
      }
      return next;
    });

  /**
   * Write the Isi Cepat values into every selected kawasan.
   *
   * Only the fields actually filled in are written, which is what lets an
   * officer set the tanggal for all of them without flattening the jenis each
   * was given individually.
   */
  const runQuickFill = () => {
    const patch: Partial<KawasanRowAttributes> = {};
    if (quickFill.jenisKawasan) patch.jenisKawasan = quickFill.jenisKawasan;
    if (quickFill.sumberData?.trim()) patch.sumberData = quickFill.sumberData.trim();
    if (quickFill.dasarHukum?.trim()) patch.dasarHukum = quickFill.dasarHukum.trim();
    if (quickFill.tanggalEfektif?.trim()) patch.tanggalEfektif = quickFill.tanggalEfektif;

    const fields = Object.keys(patch);
    if (fields.length === 0) {
      toast.error('Isi minimal satu kolom pada Isi Cepat terlebih dahulu.');
      return;
    }
    if (selectedGroups.length === 0) {
      toast.error('Centang dulu kawasan yang ingin diisi.');
      return;
    }

    setRows((prev) =>
      applyQuickFill(prev, selectedGroups.map((group) => group.key), patch)
    );
    toast.success(
      `${num(fields.length)} kolom diterapkan ke ${num(selectedGroups.length)} kawasan terpilih.`
    );
  };

  const updateRow = (key: string, patch: Partial<KawasanRowAttributes>) =>
    setRows((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], ...patch } } : prev));

  const handleImport = async () => {
    if (selectedGroups.length === 0) {
      toast.error('Pilih minimal satu kawasan untuk diimpor.');
      return;
    }
    if (problems.length > 0) {
      const sample = problems
        .slice(0, 3)
        .map((problem) => `${problem.nama} (${problem.missing.join(', ')})`)
        .join('; ');
      toast.error(
        `${num(problems.length)} kawasan belum lengkap: ${sample}` +
          (problems.length > 3 ? `, dan ${num(problems.length - 3)} lainnya.` : '.') +
          ' Lengkapi lewat tombol Ubah pada barisnya, atau gunakan Isi Cepat.',
        { duration: 12000 }
      );
      // Jump to the first offender so "which one?" is not a hunt.
      const index = filteredGroups.findIndex((group) => group.key === problems[0].key);
      if (index >= 0) setPage(Math.floor(index / PREVIEW_PAGE_SIZE));
      return;
    }

    const batches = planKawasanImportBatches(selectedGroups);
    setProgress({ done: 0, total: batches.length });
    setImportedCount(null);

    let created = 0;
    try {
      for (const [index, batch] of batches.entries()) {
        // The batch-level fields are a schema-level fallback only: every area
        // below carries its own values, so nothing is ever resolved from here.
        const first = rows[batch[0].key];
        const result = await bulkMutation.mutateAsync({
          jenisKawasan: first.jenisKawasan!,
          sumberData: first.sumberData.trim(),
          tanggalEfektif: new Date(first.tanggalEfektif),
          warna: KAWASAN_NON_SPPTG_COLOR,
          catatan: null,
          areas: batch.map((group) => {
            const row = rows[group.key];
            return {
              namaKawasan: row.namaKawasan.trim(),
              geomGeoJSON: groupToMultiPolygon(group),
              jenisKawasan: row.jenisKawasan!,
              sumberData: row.sumberData.trim(),
              dasarHukum: row.dasarHukum.trim() || undefined,
              tanggalEfektif: new Date(row.tanggalEfektif),
              statusValidasi: row.statusValidasi,
              aktifDiValidasi: row.aktifDiValidasi,
            };
          }),
        });
        created += result.created;
        setProgress({ done: index + 1, total: batches.length });

        // Drop what landed, so a retry after a failure does not re-file it.
        setSelected((prev) => {
          const next = new Set(prev);
          for (const group of batch) next.delete(group.key);
          return next;
        });
      }

      await utils.prohibitedAreas.invalidate();
      setImportedCount(created);
      toast.success(`${num(created)} kawasan Non-SPPTG berhasil diimpor.`);
    } catch (error) {
      await utils.prohibitedAreas.invalidate();
      setImportedCount(created);
      toast.error(
        `${error instanceof Error ? error.message : 'Impor gagal'}. ` +
          `${num(created)} kawasan sudah tersimpan; sisanya masih tercentang dan dapat diimpor ulang.`,
        { duration: 15000 }
      );
    } finally {
      setProgress(null);
    }
  };

  const isBusy = isParsing || progress !== null;
  const editingGroup = groups.find((group) => group.key === editingKey) ?? null;
  const editingRow = editingKey ? rows[editingKey] : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => (onCancel ? onCancel() : router.push('/app/pengaturan/kawasan'))}
        disabled={isBusy}
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        {onCancel ? 'Kembali ke Tambah Kawasan' : 'Kembali ke Kawasan Non-SPPTG'}
      </Button>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Impor Massal Kawasan Non-SPPTG</h1>
        <p className="text-sm text-gray-600">
          Satu file batas wilayah dipisahkan menjadi beberapa kawasan berdasarkan
          nama pada atribut file. <strong>Setiap kawasan diisi sendiri-sendiri</strong> —
          gunakan Isi Cepat bila banyak yang isiannya sama.
        </p>
      </div>

      {/* Step 1 — the file */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Pilih File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            type="file"
            accept=".kml,.kmz,.gpx,.zip"
            onChange={handleFile}
            disabled={isBusy}
          />
          <p className="text-xs text-gray-500">
            Shapefile diunggah sebagai .zip berisi berkas lengkapnya (.shp, .dbf,
            .shx, .prj, .cpg). File diproses di browser Anda — tidak diunggah ke
            server sampai Anda menekan Impor.
          </p>
          {handoff && (
            <p className="text-xs text-blue-700">
              File dari halaman Tambah Kawasan sudah dibaca dan tidak perlu
              dipilih ulang. Pilih file di atas hanya bila ingin menggantinya.
            </p>
          )}
          {isParsing && (
            <p className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Memproses file — file besar dapat memakan waktu beberapa detik…
            </p>
          )}
          {fileName && !isParsing && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">{fileName}</p>
              <p className="text-xs text-gray-600">
                {num(summary.totalGroups)} kawasan · {num(summary.totalBlocks)} blok ·{' '}
                {num(summary.totalPoints)} titik
                {summary.blockedGroups > 0 && (
                  <span className="text-amber-700">
                    {' '}
                    · {num(summary.blockedGroups)} tidak dapat diimpor
                  </span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {groups.length > 0 && (
        <>
          {/* Step 2 — the kawasan themselves. This is the form. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                2. Isi Tiap Kawasan ({num(selectedGroups.length)} dari{' '}
                {num(summary.importableGroups)} terpilih)
              </CardTitle>
              <p className="text-sm text-gray-600">
                Setiap baris disimpan persis seperti yang tertulis di sini. Tekan
                <strong> Ubah</strong> untuk mengisi satu kawasan.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {problems.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>{num(problems.length)} kawasan terpilih belum lengkap.</strong>{' '}
                    Barisnya ditandai kuning di bawah — lengkapi lewat Ubah, atau isi
                    sekaligus dengan Isi Cepat.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Cari nama kawasan…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="max-w-xs"
                />
                <Button variant="outline" size="sm" onClick={() => setAllVisible(true)}>
                  Centang semua {search ? 'hasil cari' : ''}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAllVisible(false)}>
                  Kosongkan {search ? 'hasil cari' : ''}
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table className="min-w-250">
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12" />
                      <TableHead>Nama Kawasan</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Sumber Data</TableHead>
                      <TableHead>Dasar Hukum</TableHead>
                      <TableHead>Tgl. Efektif</TableHead>
                      <TableHead className="text-right">Blok</TableHead>
                      <TableHead className="text-right">Titik</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleGroups.map((group) => {
                      const importable = isImportable(group);
                      const row = rows[group.key];
                      const duplicate = takenNames.has(
                        (row?.namaKawasan ?? group.nama).trim().toLowerCase()
                      );
                      const incomplete = problemKeys.has(group.key);

                      const missing = (label: string) => (
                        <span className="text-xs text-amber-700 italic">{label}</span>
                      );

                      return (
                        <TableRow
                          key={group.key}
                          className={
                            !importable
                              ? 'bg-gray-50'
                              : incomplete
                                ? 'bg-amber-50/60'
                                : undefined
                          }
                        >
                          <TableCell>
                            <Checkbox
                              checked={selected.has(group.key)}
                              disabled={!importable || isBusy}
                              onCheckedChange={() => toggle(group.key)}
                              aria-label={`Pilih ${group.nama}`}
                            />
                          </TableCell>
                          <TableCell className="max-w-64">
                            <p className="truncate">
                              {row?.namaKawasan?.trim() || missing('Belum diberi nama')}
                            </p>
                            {!importable && (
                              <p className="mt-0.5 text-xs text-amber-800">
                                {group.blockedReason}
                              </p>
                            )}
                            {importable && duplicate && (
                              <Badge
                                variant="outline"
                                className="mt-1 border-orange-300 text-xs text-orange-700"
                              >
                                Nama sudah ada
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row?.jenisKawasan ?? missing('Belum dipilih')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row?.sumberData?.trim() || missing('Belum diisi')}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {row?.dasarHukum?.trim() || '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row?.tanggalEfektif
                              ? formatDate(row.tanggalEfektif)
                              : missing('Belum diisi')}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {num(group.blockCount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {num(group.pointCount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!importable || isBusy}
                              onClick={() => setEditingKey(group.key)}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Ubah
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {pageCount > 1 && (
                  <div className="flex items-center justify-between border-t bg-gray-50 px-3 py-2 text-xs">
                    <span className="text-gray-600">{num(filteredGroups.length)} kawasan</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage === 0}
                        onClick={() => setPage(safePage - 1)}
                      >
                        Sebelumnya
                      </Button>
                      <span className="text-gray-600">
                        Hal. {safePage + 1} / {pageCount}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage >= pageCount - 1}
                        onClick={() => setPage(safePage + 1)}
                      >
                        Berikutnya
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Isi Cepat — a tool that writes into the rows above, not a layer
              beneath them. Placed after the table for that reason. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Isi Cepat (opsional)</CardTitle>
              <p className="text-sm text-gray-600">
                Menulis nilai di bawah ke <strong>semua kawasan yang tercentang</strong>.
                Kolom yang dibiarkan kosong tidak ikut ditimpa, jadi Anda bisa
                menyeragamkan tanggal tanpa mengubah jenis yang sudah diatur satu per
                satu.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="qf-jenis">Jenis Kawasan</Label>
                  <SearchableSelect
                    id="qf-jenis"
                    value={quickFill.jenisKawasan ?? ''}
                    onValueChange={(value) =>
                      setQuickFill((prev) => ({
                        ...prev,
                        jenisKawasan: value as ProhibitedAreaType,
                      }))
                    }
                    placeholder="Pilih jenis"
                    searchPlaceholder="Cari jenis..."
                    options={jenisOptions}
                  />
                </div>
                <div>
                  <Label htmlFor="qf-sumber">Sumber Data</Label>
                  <Input
                    id="qf-sumber"
                    value={quickFill.sumberData ?? ''}
                    onChange={(e) =>
                      setQuickFill((prev) => ({ ...prev, sumberData: e.target.value }))
                    }
                    placeholder="Contoh: KLHK"
                  />
                </div>
                <div>
                  <Label htmlFor="qf-dasar">Dasar Hukum/No. SK</Label>
                  <Input
                    id="qf-dasar"
                    value={quickFill.dasarHukum ?? ''}
                    onChange={(e) =>
                      setQuickFill((prev) => ({ ...prev, dasarHukum: e.target.value }))
                    }
                    placeholder="Contoh: SK 397 Tahun 2025"
                  />
                </div>
                <div>
                  <Label htmlFor="qf-tanggal">Tanggal Efektif</Label>
                  <Input
                    id="qf-tanggal"
                    type="date"
                    value={quickFill.tanggalEfektif ?? ''}
                    onChange={(e) =>
                      setQuickFill((prev) => ({ ...prev, tanggalEfektif: e.target.value }))
                    }
                  />
                </div>
              </div>
              <Button variant="outline" onClick={runQuickFill} disabled={isBusy}>
                <Wand2 className="mr-2 h-4 w-4" />
                Terapkan ke {num(selectedGroups.length)} kawasan terpilih
              </Button>
            </CardContent>
          </Card>

          {/* Step 3 — commit */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Impor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Akan dibuat <strong>{num(selectedGroups.length)} kawasan</strong> baru
                  ({num(selectedBlocks)} blok, {num(selectedPoints)} titik), dikirim dalam{' '}
                  {num(planKawasanImportBatches(selectedGroups).length)} batch.
                </p>
                <p className="mt-1 text-xs text-blue-800">
                  Impor massal tidak menjalankan cek tumpang tindih — data SK memang
                  saling bersinggungan. Setelah selesai, gunakan &quot;Cek Tumpang
                  Tindih&quot; untuk melihat pengajuan mana yang kini berada di dalam
                  kawasan baru.
                </p>
              </div>

              {progress && (
                <div className="space-y-1">
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600">
                    Mengimpor batch {num(progress.done)} dari {num(progress.total)}… Jangan
                    tutup halaman ini.
                  </p>
                </div>
              )}

              {importedCount !== null && progress === null && (
                <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-green-900">
                      <strong>{num(importedCount)} kawasan tersimpan.</strong>
                    </p>
                    {selectedGroups.length > 0 && (
                      <p className="mt-1 flex items-center gap-1.5 text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {num(selectedGroups.length)} kawasan belum terkirim dan masih
                        tercentang.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push('/app/pengaturan/kawasan')}
                  disabled={isBusy}
                >
                  Selesai
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isBusy || selectedGroups.length === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {progress ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mengimpor…
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-2 h-4 w-4" />
                      Impor {num(selectedGroups.length)} Kawasan
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* One kawasan's own attributes */}
      <Dialog open={editingKey !== null} onOpenChange={(open) => !open && setEditingKey(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {editingRow?.namaKawasan?.trim() || editingGroup?.nama || 'Kawasan'}
            </DialogTitle>
            {editingGroup && (
              <p className="text-sm text-gray-600">
                {num(editingGroup.blockCount)} blok · {num(editingGroup.pointCount)} titik
                {editingGroup.isUnnamed && ' · file tidak memberi nama kawasan ini'}
              </p>
            )}
          </DialogHeader>

          {editingKey && editingRow && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="row-nama">Nama Kawasan<RequiredMark /></Label>
                <Input
                  id="row-nama"
                  value={editingRow.namaKawasan}
                  onChange={(e) => updateRow(editingKey, { namaKawasan: e.target.value })}
                  placeholder="Contoh: Hutan Lindung Sangatta"
                />
              </div>
              <div>
                <Label htmlFor="row-jenis">Jenis Kawasan<RequiredMark /></Label>
                <SearchableSelect
                  id="row-jenis"
                  value={editingRow.jenisKawasan ?? ''}
                  onValueChange={(value) =>
                    updateRow(editingKey, { jenisKawasan: value as ProhibitedAreaType })
                  }
                  placeholder="Pilih jenis"
                  searchPlaceholder="Cari jenis..."
                  options={jenisOptions}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="row-sumber">Sumber Data<RequiredMark /></Label>
                  <Input
                    id="row-sumber"
                    value={editingRow.sumberData}
                    onChange={(e) => updateRow(editingKey, { sumberData: e.target.value })}
                    placeholder="Contoh: KLHK"
                  />
                </div>
                <div>
                  <Label htmlFor="row-tanggal">Tanggal Efektif<RequiredMark /></Label>
                  <Input
                    id="row-tanggal"
                    type="date"
                    value={editingRow.tanggalEfektif}
                    onChange={(e) => updateRow(editingKey, { tanggalEfektif: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="row-dasar">Dasar Hukum/No. SK</Label>
                <Input
                  id="row-dasar"
                  value={editingRow.dasarHukum}
                  onChange={(e) => updateRow(editingKey, { dasarHukum: e.target.value })}
                  placeholder="Contoh: SK 397 Tahun 2025"
                />
              </div>
              <div>
                <Label htmlFor="row-status">Status Validasi</Label>
                <SearchableSelect
                  id="row-status"
                  value={editingRow.statusValidasi}
                  onValueChange={(value) =>
                    updateRow(editingKey, { statusValidasi: value as ValidationStatus })
                  }
                  placeholder="Pilih status"
                  searchPlaceholder="Cari status..."
                  options={[
                    { value: 'Lolos', label: 'Lolos' },
                    { value: 'Perlu Perbaikan', label: 'Perlu Perbaikan' },
                  ]}
                />
              </div>
              <div className="flex items-center gap-2 border-t pt-4">
                <Switch
                  id="row-aktif"
                  checked={editingRow.aktifDiValidasi}
                  onCheckedChange={(checked) =>
                    updateRow(editingKey, { aktifDiValidasi: checked })
                  }
                />
                <Label htmlFor="row-aktif" className="cursor-pointer">
                  Aktif di Validasi
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setEditingKey(null)}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default KawasanBulkImport;
