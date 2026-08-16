'use client';

/**
 * "Cek Tumpang Tindih" — every recorded pengajuan sitting inside a Kawasan
 * Non-SPPTG, as a page rather than the modal it used to be.
 *
 * A dialog was the wrong container for this: it is a report an officer reads
 * next to a map, follows into a pengajuan, and comes back to — none of which a
 * modal survives, and it could not hold a map at all.
 *
 * What the map shows is deliberately asymmetric. **Every** kawasan is drawn —
 * all of them, every block, no cap and no page — because the question being
 * asked is "where are the restricted areas, and who is in them", and a kawasan
 * with nothing in it is part of that answer. Only the pengajuan that actually
 * overlap one are drawn, because every other valid SPPTG on the map would bury
 * the handful that matter.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, AlertTriangle, Crosshair, MapPin, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';
import { geoJSONToPaths } from '@/lib/map-utils';
import { findCenter } from '@/lib/utils';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
import { ReadOnlyMap } from '@/components/maps/ReadOnlyMap';
import type { ReferencePolygon } from '@/components/maps/DrawingMap';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StatusSPPTG, Submission } from '@/types';

/** Enough of a Submission for `ReadOnlyMap` to draw and label one. */
function toMapSubmission(source: {
  id: number;
  status: string;
  villageId: number | null;
  desaNama: string | null;
  geoJSON: string | null;
  namaPemilik: string;
}): Submission | null {
  if (!source.geoJSON) return null;
  let geometry: Submission['geoJSON'];
  try {
    geometry = JSON.parse(source.geoJSON) as Submission['geoJSON'];
  } catch {
    return null;
  }

  return {
    id: source.id,
    namaPemilik: source.namaPemilik,
    nik: '',
    alamat: '-',
    nomorHP: '-',
    email: '-',
    villageId: source.villageId ?? 0,
    desaNama: source.desaNama,
    kecamatan: '',
    kabupaten: '',
    luas: 0,
    penggunaanLahan: '-',
    catatan: null,
    geoJSON: geometry,
    status: source.status as StatusSPPTG,
    isValid: true,
    tanggalPengajuan: new Date(),
    ownerUserId: null,
    verifikator: null,
    riwayat: [],
    feedback: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function KawasanOverlapReport() {
  const router = useRouter();
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);

  /**
   * "Fokus di peta" for one row. The signal is bumped per click because
   * focusing is an action — clicking the same row again after panning away has
   * to bring the map back.
   */
  const [focusTarget, setFocusTarget] = useState<unknown>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const mapCardRef = useRef<HTMLDivElement | null>(null);

  const {
    data: overlapData,
    isLoading: isLoadingOverlaps,
    isError: overlapError,
  } = trpc.prohibitedAreas.checkOverlaps.useQuery();

  // Every kawasan, overlapping or not, and *all* of them — see the note at the
  // top of this file. `geometriSemua` is unpaged on purpose: `list` returns a
  // page, and a page is not an answer to "where are the restricted areas".
  const { data: kawasanData, isLoading: isLoadingKawasan } =
    trpc.prohibitedAreas.geometriSemua.useQuery();

  // Geometry of the pengajuan; already filtered server-side to the valid
  // terdaftar/terdata ones, which is exactly the set this report concerns.
  const { data: mapPolygons, isLoading: isLoadingPolygons } =
    trpc.submissions.listMapPolygons.useQuery();

  const overlapRows = useMemo(() => overlapData ?? [], [overlapData]);

  // A pengajuan can clash with several kawasan, so the headline counts berkas,
  // not rows.
  const overlapSubmissionCount = useMemo(
    () => new Set(overlapRows.map((row) => row.submissionId)).size,
    [overlapRows]
  );
  const affectedKawasanCount = useMemo(
    () => new Set(overlapRows.map((row) => row.kawasanId)).size,
    [overlapRows]
  );

  /** Owner name per submission id, so the map popup names the same person the table does. */
  const ownerBySubmission = useMemo(() => {
    const names = new Map<number, string>();
    for (const row of overlapRows) names.set(row.submissionId, row.namaPemilik);
    return names;
  }, [overlapRows]);

  const overlappingSubmissions = useMemo<Submission[]>(() => {
    if (!mapPolygons) return [];
    return mapPolygons
      .filter((polygon) => ownerBySubmission.has(polygon.id))
      .map((polygon) =>
        toMapSubmission({
          ...polygon,
          namaPemilik: ownerBySubmission.get(polygon.id) ?? `Pengajuan #${polygon.id}`,
        })
      )
      .filter((submission): submission is Submission => submission !== null);
  }, [mapPolygons, ownerBySubmission]);

  /**
   * Every ring of every kawasan — no cap, and none is wanted here.
   *
   * The check behind this page runs in PostGIS over every kawasan, so a map
   * drawing a subset would show part of an answer already computed in full, and
   * an officer could not tell a kawasan that was absent from one that does not
   * exist. On a page that answers "where are the restricted areas, and who is
   * standing in them", that is worse than a slow map.
   */
  const kawasanReferences = useMemo<ReferencePolygon[]>(() => {
    const areas = (kawasanData ?? []) as Array<{
      id: number;
      namaKawasan: string;
      jenisKawasan: string;
      geom?: unknown;
    }>;

    return areas.flatMap((area) =>
      geoJSONToPaths(area.geom).map((path, index) => ({
        id: `kawasan-${area.id}-${index}`,
        path,
        strokeColor: KAWASAN_NON_SPPTG_COLOR,
        fillColor: KAWASAN_NON_SPPTG_COLOR,
        label: `${area.namaKawasan} (${area.jenisKawasan})`,
      }))
    );
  }, [kawasanData]);

  // Frame the conflicts when there are any, the kawasan otherwise — a map opened
  // on the default centre with everything off-screen reads as an empty map.
  const mapCenter = useMemo(() => {
    const submissionPoints = overlappingSubmissions.flatMap((submission) =>
      geoJSONToPaths(submission.geoJSON).flat()
    );
    if (submissionPoints.length > 0) return findCenter(submissionPoints);

    const kawasanPoints = kawasanReferences.flatMap((reference) => reference.path);
    return kawasanPoints.length > 0 ? findCenter(kawasanPoints) : undefined;
  }, [overlappingSubmissions, kawasanReferences]);

  const focusOnMap = useCallback(
    (submissionId: number) => {
      const submission = overlappingSubmissions.find((row) => row.id === submissionId);
      if (!submission?.geoJSON) {
        toast.error('Pengajuan ini tidak memiliki geometri untuk ditampilkan di peta.');
        return;
      }
      setSelectedSubmissionId(submissionId);
      setFocusTarget(submission.geoJSON);
      setFocusSignal((signal) => signal + 1);
      // The table sits below the map, so framing a polygon the officer cannot
      // see would look like nothing happened.
      mapCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [overlappingSubmissions]
  );

  const selectedSubmission = useMemo(
    () =>
      overlappingSubmissions.find(
        (submission) => submission.id === selectedSubmissionId
      ) ?? null,
    [overlappingSubmissions, selectedSubmissionId]
  );

  const isLoadingMap = isLoadingKawasan || isLoadingPolygons;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" onClick={() => router.push('/app/pengaturan/kawasan')}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Kembali ke Kawasan Non-SPPTG
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hasil Cek Tumpang Tindih</CardTitle>
          <p className="text-sm text-gray-600">
            Pengajuan SPPTG terdaftar dan terdata yang masih valid dan tumpang
            tindih dengan Kawasan Non-SPPTG yang aktif di validasi.
          </p>
        </CardHeader>
        <CardContent>
          {isLoadingOverlaps ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-500">
              <div className="mr-2 h-5 w-5 animate-spin rounded-full border-b-2 border-blue-600" />
              Menghitung tumpang tindih...
            </div>
          ) : overlapError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Gagal menghitung tumpang tindih. Silakan muat ulang halaman.
            </div>
          ) : overlapRows.length === 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 text-green-600" />
                <div>
                  <p className="text-green-900">
                    <strong>Tidak ada pengajuan yang tumpang tindih</strong>
                  </p>
                  <p className="mt-1 text-sm text-green-700">
                    Semua pengajuan SPPTG berada di luar kawasan Non-SPPTG yang
                    aktif.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-orange-900">
                    <strong>
                      Ditemukan {overlapSubmissionCount} pengajuan SPPTG tumpang
                      tindih pada {affectedKawasanCount} kawasan
                    </strong>
                  </p>
                  <p className="mt-1 text-sm text-orange-700">
                    Buka detail pengajuan untuk meninjau dan menentukan statusnya.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map — every kawasan, plus only the pengajuan that clash with one */}
      <Card ref={mapCardRef}>
        <CardHeader>
          <CardTitle>Peta Kawasan Non-SPPTG dan Pengajuan Tumpang Tindih</CardTitle>
          <p className="text-sm text-gray-600">
            Seluruh Kawasan Non-SPPTG ditampilkan, sedangkan pengajuan yang
            ditampilkan hanya yang tumpang tindih dengan kawasan tersebut. Klik
            polygon pengajuan untuk melihat detailnya.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingMap ? (
            <div className="flex h-128 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500">
              Memuat peta...
            </div>
          ) : kawasanReferences.length === 0 && overlappingSubmissions.length === 0 ? (
            <div className="flex h-128 flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
              <MapPin className="mb-3 h-12 w-12 text-gray-400" />
              <p>Belum ada kawasan Non-SPPTG dengan geometri untuk ditampilkan.</p>
            </div>
          ) : (
            <ReadOnlyMap
              submissions={overlappingSubmissions}
              selectedSubmission={selectedSubmission}
              referencePolygons={kawasanReferences}
              showNonSpptgLegend
              // Only what this report can ever draw. It counts `terdaftar` and
              // `terdata` and nothing else, so listing "ditolak" beside them
              // invited the reading that a rejected berkas inside a kawasan had
              // merely not turned up yet — when in fact it is excluded on
              // purpose: a rejected claim inside a restricted area is the
              // system working, not a conflict.
              legendStatuses={['SPPTG terdaftar', 'SPPTG terdata']}
              height="32rem"
              zoom={12}
              center={mapCenter}
              onPolygonClick={(submission) => setSelectedSubmissionId(submission.id)}
              focusGeoJSON={focusTarget}
              focusSignal={focusSignal}
            />
          )}

          <p className="text-xs text-gray-500">
            Peta menggambar seluruh {kawasanReferences.length.toLocaleString('id-ID')}{' '}
            blok dari semua kawasan Non-SPPTG, tanpa batas.
          </p>
        </CardContent>
      </Card>

      {/* Table — the same columns the dialog carried */}
      <Card>
        <CardHeader>
          <CardTitle>Rincian Tumpang Tindih</CardTitle>
        </CardHeader>
        <CardContent>
          {overlapRows.length === 0 ? (
            <p className="text-sm text-gray-500">
              Tidak ada data tumpang tindih untuk ditampilkan.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-205">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>ID Pengajuan</TableHead>
                    <TableHead>Pemilik</TableHead>
                    <TableHead>Desa/Kecamatan</TableHead>
                    <TableHead>Luas Overlap</TableHead>
                    <TableHead>Kawasan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Peta</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overlapRows.map((row, index) => (
                    <TableRow
                      key={`${row.submissionId}-${row.kawasanId}-${index}`}
                      className={
                        row.submissionId === selectedSubmissionId ? 'bg-orange-50' : undefined
                      }
                      onClick={() => setSelectedSubmissionId(row.submissionId)}
                    >
                      <TableCell className="font-mono text-xs">
                        #{row.submissionId}
                      </TableCell>
                      <TableCell>{row.namaPemilik}</TableCell>
                      <TableCell className="text-gray-600">
                        {row.desaNama || `Desa #${row.submissionId}`}
                        {row.kecamatan ? `, ${row.kecamatan}` : ''}
                      </TableCell>
                      <TableCell>
                        {Math.round(row.luasOverlap).toLocaleString('id-ID')} m²
                        <span className="text-xs text-gray-500">
                          {' '}
                          ({row.percentageOverlap.toFixed(2)}%)
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600">{row.namaKawasan}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status as StatusSPPTG} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Fokuskan peta ke polygon ini"
                          aria-label={`Fokuskan peta ke pengajuan #${row.submissionId}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            focusOnMap(row.submissionId);
                          }}
                        >
                          <Crosshair className="h-4 w-4 text-blue-600" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/app/pengajuan/${row.submissionId}`);
                          }}
                        >
                          Buka Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default KawasanOverlapReport;
