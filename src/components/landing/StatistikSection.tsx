'use client';

import { BarChart3, LandPlot, MapPin, Layers, Database } from 'lucide-react';
import { Reveal } from '../Reveal';
import { AngkaBerjalan } from './AngkaBerjalan';
import { KecamatanCharts } from './KecamatanCharts';
import { TabelPerDesa } from './TabelPerDesa';
import { formatAngka, formatHektar, type LandingStats } from '@/lib/landing-stats';

/**
 * Public recap of **approved** SPPTG (`SPPTG terdaftar`).
 *
 * Only aggregates reach this component — `LandingStats` has no field for a
 * name, a NIK, an address or a polygon, so there is nothing here that could
 * identify an applicant even by accident. `SPPTG terdata` (recorded but not yet
 * decided), `ditinjau ulang` and `ditolak` are left out entirely: publishing a
 * count of rejected berkas per desa says something about people the office has
 * not finished deciding about.
 */

export function StatistikSection({ stats }: { stats: LandingStats | null }) {
  const kosong = !stats || stats.total === 0;

  const kartu = stats
    ? [
        {
          label: 'SPPTG Terdaftar',
          nilai: stats.total,
          format: formatAngka,
          unit: 'berkas',
          icon: Database,
          accent: 'from-blue-700 to-blue-600',
        },
        {
          label: 'Luas Terdaftar',
          nilai: stats.luasM2,
          format: formatHektar,
          unit: 'hektar',
          icon: LandPlot,
          accent: 'from-emerald-800 to-emerald-700',
        },
        {
          label: 'Desa/Kelurahan',
          nilai: stats.jumlahDesa,
          format: formatAngka,
          unit: 'wilayah terlayani',
          icon: MapPin,
          accent: 'from-violet-700 to-violet-600',
        },
        {
          label: 'Kecamatan',
          nilai: stats.jumlahKecamatan,
          format: formatAngka,
          unit: 'terjangkau',
          icon: Layers,
          accent: 'from-amber-700 to-orange-700',
        },
      ]
    : [];


  return (
    <section id="statistik" className="scroll-mt-20 bg-gray-50/70 sm:scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Data Terbuka
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Data Statistik SPPTG Terdaftar
          </h2>
        </Reveal>

        {kosong ? (
          <Reveal className="mx-auto mt-10 max-w-xl rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-3 font-semibold text-gray-900">
              Statistik belum tersedia
            </p>
            <p className="mt-1.5 text-sm text-gray-600">
              Rekapitulasi akan tampil di sini setelah ada SPPTG yang terdaftar.
            </p>
          </Reveal>
        ) : (
          <>
            {/* ------------------------------------------------------- KPI */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kartu.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Reveal key={item.label} delay={index * 90}>
                    {/* The lift lives on an inner element, not on <Reveal>:
                        Reveal animates `transform` over 700ms to fade the card
                        in, and hanging the hover off the same node would make
                        the lift crawl at that same speed. */}
                    <div
                      className={`group relative h-full overflow-hidden rounded-2xl bg-gradient-to-br ${item.accent} p-5 text-white shadow-lg shadow-gray-900/5 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none`}
                    >
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-125"
                      />
                      <div className="relative flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-white">
                          {item.label}
                        </p>
                        <Icon className="h-5 w-5 shrink-0 text-white/70" />
                      </div>
                      <AngkaBerjalan
                        nilai={item.nilai}
                        format={item.format}
                        className="relative mt-3 block text-3xl font-bold tracking-tight tabular-nums"
                      />
                      <p className="relative mt-0.5 text-xs font-medium uppercase tracking-wide text-white/90">
                        {item.unit}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            {/* -------------------------------------------- Per kecamatan */}
            <Reveal className="mt-6">
              <KecamatanCharts data={stats.perKecamatan} />
            </Reveal>

            {/* ----------------------------------------------- Per desa */}
            <Reveal className="mt-6">
              <TabelPerDesa stats={stats} />
            </Reveal>
          </>
        )}
      </div>
    </section>
  );
}
