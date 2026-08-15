'use client';

/**
 * The result of "Cek Tumpang Tindih" inside the Tambah/Edit Kawasan form, plus
 * the tick box that is the only way past it.
 *
 * The two kinds of clash are listed separately on purpose. Another kawasan
 * overlapping this one is the office recording the same restricted land twice —
 * annoying, usually intentional (a Sempadan Sungai does run through a Kawasan
 * Hutan). A **pengajuan** overlapping it is somebody's registered claim about to
 * be declared restricted land, and that is the row an officer needs to read
 * before ticking anything. Merging them into one count would hide it.
 */

import { AlertTriangle, ShieldCheck, MapPin, Layers } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  summarizeKawasanConflicts,
  type KawasanGeometryConflict,
} from '@/lib/kawasan-conflicts';

interface KawasanConflictPanelProps {
  /** null = the check has not been run for the boundary currently drawn. */
  conflicts: KawasanGeometryConflict[] | null;
  isChecking: boolean;
  /** True once the drawn boundary has moved since `conflicts` was produced. */
  isStale: boolean;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
}

function formatLuas(value: number): string {
  return `${Math.round(value).toLocaleString('id-ID')} m²`;
}

function ConflictList({
  rows,
  icon,
  title,
}: {
  rows: KawasanGeometryConflict[];
  icon: React.ReactNode;
  title: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-700 uppercase">
        {icon}
        {title} ({rows.length})
      </p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={`${row.jenis}-${row.id}`}
            className="rounded-md border border-gray-200 bg-white p-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">
                  {row.nama || `#${row.id}`}
                  <span className="ml-2 font-mono text-xs text-gray-500">#{row.id}</span>
                </p>
                <p className="text-xs text-gray-600">
                  {row.keterangan || '-'}
                  {row.jenis === 'pengajuan' && row.status ? ` · ${row.status}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-900">{formatLuas(row.luasOverlap)}</p>
                <p className="text-xs text-gray-500">
                  {row.percentageOverlap.toFixed(2)}% dari kawasan ini
                </p>
              </div>
            </div>
            {row.jenis === 'kawasan' && !row.aktifDiValidasi && (
              <Badge
                variant="outline"
                className="mt-2 border-gray-300 text-xs text-gray-600"
              >
                Nonaktif di validasi
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KawasanConflictPanel({
  conflicts,
  isChecking,
  isStale,
  acknowledged,
  onAcknowledgedChange,
}: KawasanConflictPanelProps) {
  if (isChecking) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600" />
        Memeriksa tumpang tindih dengan kawasan lain dan pengajuan SPPTG…
      </div>
    );
  }

  if (conflicts === null) return null;

  // The boundary moved after the check: the result on screen describes a
  // different polygon than the one about to be saved, so it is reported as
  // out of date rather than left to look current.
  if (isStale) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          Batas kawasan berubah setelah pengecekan terakhir
        </p>
        <p className="mt-1 text-amber-800">
          Jalankan &quot;Cek Tumpang Tindih&quot; lagi untuk hasil yang sesuai
          dengan batas yang sekarang.
        </p>
      </div>
    );
  }

  if (conflicts.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="flex items-center gap-2 text-green-900">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <strong>Tidak ada tumpang tindih</strong>
        </p>
        <p className="mt-1 text-sm text-green-700">
          Batas kawasan ini tidak beririsan dengan kawasan Non-SPPTG lain maupun
          pengajuan SPPTG terdaftar/terdata yang masih valid.
        </p>
      </div>
    );
  }

  const summary = summarizeKawasanConflicts(conflicts);

  return (
    <div className="space-y-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
        <div>
          <p className="text-orange-900">
            <strong>Batas kawasan tumpang tindih dengan {summary.ringkasan}</strong>
          </p>
          <p className="mt-1 text-sm text-orange-800">
            {summary.pengajuan.length > 0
              ? 'Pengajuan SPPTG di bawah ini sudah tercatat dan masih valid. Tinjau kembali sebelum menetapkan kawasan ini.'
              : 'Periksa apakah kawasan ini memang perlu dicatat terpisah dari kawasan yang sudah ada.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <ConflictList
          rows={summary.pengajuan}
          icon={<MapPin className="h-3.5 w-3.5" />}
          title="Pengajuan SPPTG"
        />
        <ConflictList
          rows={summary.kawasan}
          icon={<Layers className="h-3.5 w-3.5" />}
          title="Kawasan Non-SPPTG"
        />
      </div>

      <div className="flex items-start gap-3 rounded-md border border-orange-300 bg-white p-3">
        <Checkbox
          id="abaikanTumpangTindih"
          checked={acknowledged}
          onCheckedChange={(checked) => onAcknowledgedChange(checked === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="abaikanTumpangTindih"
          className="cursor-pointer text-sm leading-relaxed font-normal text-gray-800"
        >
          Saya sudah meninjau tumpang tindih di atas dan tetap ingin menyimpan
          kawasan ini.
        </Label>
      </div>
    </div>
  );
}

export default KawasanConflictPanel;
