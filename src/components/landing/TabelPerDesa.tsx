'use client';

import { useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, MapPin } from 'lucide-react';
import {
  formatAngka,
  formatHektar,
  rekapDesa,
  totalRekap,
  type LandingStats,
  type PilihanTahun,
} from '@/lib/landing-stats';
import { unduhWorkbook } from '@/lib/xlsx-export';
import { PilihTahun } from './PilihTahun';

/**
 * "Data SPPTG per Desa/Kelurahan" — the recap table, a year filter, and an
 * Excel export.
 *
 * The filter runs in the browser because the page already ships every
 * desa-year row (`stats.perDesa`); a round trip per year would make a static
 * page dynamic to answer a question the data already contains.
 *
 * The table and the spreadsheet are both built from `rekapDesa`, so the file
 * someone downloads can never disagree with the figures they were looking at
 * when they clicked.
 */

/** Rows shown on screen. The export always contains every desa. */
const BARIS_DITAMPILKAN = 15;

export function TabelPerDesa({ stats }: { stats: LandingStats }) {
  const [tahun, setTahun] = useState<PilihanTahun>('semua');
  const [mengekspor, setMengekspor] = useState(false);
  const [gagalEkspor, setGagalEkspor] = useState(false);

  const baris = useMemo(() => rekapDesa(stats.perDesa, tahun), [stats.perDesa, tahun]);
  const total = useMemo(() => totalRekap(baris), [baris]);
  const ditampilkan = baris.slice(0, BARIS_DITAMPILKAN);

  const labelTahun = tahun === 'semua' ? 'Semua Tahun' : String(tahun);

  const handleEkspor = async () => {
    setMengekspor(true);
    setGagalEkspor(false);
    try {
      await unduhWorkbook(
        {
          nama: `SPPTG ${labelTahun}`,
          header: ['Desa/Kelurahan', 'Kecamatan', 'Tahun', 'Berkas Terdaftar', 'Luas (Ha)', 'Luas (m2)'],
          baris: baris.map((row) => [
            row.desa,
            row.kecamatan,
            labelTahun,
            row.total,
            Number((row.luasM2 / 10_000).toFixed(2)),
            Math.round(row.luasM2),
          ]),
        },
        `Data SPPTG Terdaftar per Desa - ${labelTahun}`
      );
    } catch {
      // The export is a convenience; a failure must not take the page with it.
      setGagalEkspor(true);
    } finally {
      setMengekspor(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <h3 className="flex items-center gap-2 font-semibold text-gray-900">
        <MapPin className="h-4 w-4 text-emerald-600" />
        Data SPPTG terdaftar per desa/kelurahan
      </h3>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <PilihTahun
          tahun={tahun}
          tahunTersedia={stats.tahunTersedia}
          onPilih={setTahun}
          jumlahBaris={baris.length}
        />

        <button
          type="button"
          onClick={handleEkspor}
          disabled={mengekspor || baris.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white pointer-coarse:min-h-11 pointer-coarse:py-2.5 shadow-sm transition-colors hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mengekspor ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Export ke Excel
        </button>
      </div>

      {gagalEkspor && (
        <p className="mt-2 text-xs text-red-600">
          Gagal membuat berkas Excel. Silakan coba lagi.
        </p>
      )}

      <div className="-mx-2 mt-5 overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <caption className="sr-only">
            Jumlah dan luas SPPTG terdaftar per desa/kelurahan, {labelTahun}
          </caption>
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th scope="col" className="px-2 py-2.5 font-medium">
                Desa/Kelurahan
              </th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium">
                Berkas Terdaftar
              </th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium">
                Luas Terdaftar (Ha)
              </th>
            </tr>
          </thead>
          <tbody>
            {ditampilkan.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-2 py-8 text-center text-gray-500">
                  Tidak ada SPPTG terdaftar pada tahun {labelTahun}.
                </td>
              </tr>
            ) : (
              ditampilkan.map((row) => (
                <tr
                  key={`${row.kecamatan}-${row.desa}`}
                  className="border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50/70"
                >
                  <th
                    scope="row"
                    className="px-2 py-2.5 text-left font-medium text-gray-800"
                  >
                    {row.desa}
                    <span className="block text-xs font-normal text-gray-500">
                      Kec. {row.kecamatan}
                    </span>
                  </th>
                  <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">
                    {formatAngka(row.total)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">
                    {formatHektar(row.luasM2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {baris.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-emerald-50/60 font-semibold text-gray-900">
                <th scope="row" className="px-2 py-2.5 text-left">
                  Total Keseluruhan
                </th>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {formatAngka(total.total)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {formatHektar(total.luasM2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {baris.length > BARIS_DITAMPILKAN && (
        <p className="mt-4 text-xs text-gray-500">
          Menampilkan {BARIS_DITAMPILKAN} desa dengan SPPTG terdaftar terbanyak
          dari {formatAngka(baris.length)} desa/kelurahan; baris total dan berkas
          Excel mencakup seluruhnya.
        </p>
      )}
    </div>
  );
}
