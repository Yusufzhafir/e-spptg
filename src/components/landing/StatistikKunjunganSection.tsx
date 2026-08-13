'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Activity, CalendarDays, Eye, Globe2, LineChart } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { Reveal } from '../Reveal';
import { AngkaBerjalan } from './AngkaBerjalan';
import { formatAngka } from '@/lib/landing-stats';

/**
 * "Statistik Kunjungan Portal" — how many people opened the public site.
 *
 * Read client-side, not prerendered: `/` is ISR'd for fifteen minutes, and a
 * frozen "aktif 5 menit terakhir" would be worse than no number at all. The
 * procedure behind it is public and returns aggregates only — counts, top
 * browsers, top referrer hosts — never a visitor address or a path.
 *
 * Everything here degrades to an empty state rather than an error: if the
 * `page_visits` table has not been migrated yet, or the query fails, the card
 * says so and the rest of the landing page is untouched.
 */
const TrenKunjunganChart = dynamic(() => import('./TrenKunjunganChart'), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-gray-100 sm:h-72" />,
});

type Tab = 'sistem' | 'lokasi' | 'rujukan';

/**
 * Referrer kinds, as the reference dashboard names them: an internal referrer is
 * navigation within the site, no referrer at all is a direct visit, and anything
 * else stands under its own host name.
 */
const RUJUKAN: Record<string, { label: string; badge: string; kelas: string }> = {
  internal: { label: 'Navigasi', badge: 'Internal', kelas: 'bg-indigo-100 text-indigo-700' },
  langsung: { label: 'Akses Langsung', badge: 'Direct', kelas: 'bg-sky-100 text-sky-700' },
  eksternal: { label: 'Lainnya', badge: 'Rujukan', kelas: 'bg-emerald-100 text-emerald-700' },
};

function BarisPersentase({
  label,
  jumlah,
  total,
  warna,
  badge,
  badgeKelas,
}: {
  label: string;
  jumlah: number;
  total: number;
  warna: string;
  badge?: string;
  badgeKelas?: string;
}) {
  const persen = total > 0 ? (jumlah / total) * 100 : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          {badge && (
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeKelas ?? ''}`}
            >
              {badge}
            </span>
          )}
          <span className="truncate text-gray-700">{label}</span>
        </span>
        <span className="shrink-0 tabular-nums text-gray-500">
          <strong className="font-semibold text-gray-900">{formatAngka(jumlah)}</strong> (
          {persen.toFixed(1)}%)
        </span>
      </div>
      <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${warna}`}
          style={{ width: `${Math.max(persen, 1)}%` }}
        />
      </div>
    </li>
  );
}

export function StatistikKunjunganSection() {
  const [tab, setTab] = useState<Tab>('sistem');

  const { data, isLoading, isError } = trpc.kunjungan.statistik.useQuery(undefined, {
    // The "aktif" tile claims a five-minute window, so the card has to keep up
    // with it; anything slower and the number would be quietly wrong.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const kartu = useMemo(
    () =>
      data
        ? [
            {
              label: 'Pengunjung Aktif',
              nilai: data.aktif,
              hint: 'Aktif 5 menit terakhir',
              icon: Activity,
              accent: 'from-rose-600 to-red-700',
            },
            {
              label: 'Hari Ini',
              nilai: data.hariIni.hits,
              badge: `${formatAngka(data.hariIni.unik)} unik`,
              icon: Eye,
              accent: 'from-emerald-800 to-emerald-700',
            },
            {
              label: 'Bulan Ini',
              nilai: data.bulanIni.hits,
              badge: `${formatAngka(data.bulanIni.unik)} unik`,
              icon: CalendarDays,
              accent: 'from-blue-700 to-indigo-600',
            },
            {
              label: 'Total Kunjungan',
              nilai: data.total.hits,
              badge: `${formatAngka(data.total.unik)} unik`,
              icon: Globe2,
              accent: 'from-amber-700 to-orange-700',
            },
          ]
        : [],
    [data]
  );

  const totalSistem = (data?.browser ?? []).reduce((sum, row) => sum + row.jumlah, 0);
  const totalOs = (data?.os ?? []).reduce((sum, row) => sum + row.jumlah, 0);
  const totalNegara = (data?.negara ?? []).reduce((sum, row) => sum + row.jumlah, 0);
  const totalKota = (data?.kota ?? []).reduce((sum, row) => sum + row.jumlah, 0);
  const totalRujukan = (data?.rujukan ?? []).reduce((sum, row) => sum + row.jumlah, 0);
  const adaLokasi = totalNegara > 0 || totalKota > 0;

  return (
    <section className="bg-gray-50/70">
      <div className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8">
        <Reveal className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            <LineChart className="h-4 w-4 text-indigo-600" />
            Statistik Kunjungan Portal SIAPTAH
          </h3>

          {isLoading ? (
            <div className="mt-6 h-64 w-full animate-pulse rounded-xl bg-gray-100" />
          ) : isError || !data ? (
            <p className="mt-4 text-sm text-gray-500">
              Statistik kunjungan belum tersedia.
            </p>
          ) : (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {kartu.map((item) => {
                  const Icon = item.icon;
                  return (
                    // Same lift as the "Data Statistik SPPTG Terdaftar" cards —
                    // the two rows read as one family, so they must behave alike.
                    <div
                      key={item.label}
                      className={`group relative h-full overflow-hidden rounded-2xl bg-gradient-to-br ${item.accent} p-5 text-white shadow-lg shadow-gray-900/5 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none`}
                    >
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-125"
                      />
                      <div className="relative flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <Icon className="h-5 w-5 shrink-0 text-white/70" />
                      </div>
                      <AngkaBerjalan
                        nilai={item.nilai}
                        format={formatAngka}
                        className="relative mt-3 block text-3xl font-bold tracking-tight tabular-nums"
                      />
                      {item.badge ? (
                        <span className="relative mt-1.5 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">
                          {item.badge}
                        </span>
                      ) : (
                        <p className="relative mt-0.5 text-xs font-medium text-white/90">
                          {item.hint}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                {/* ------------------------------------------------- Tren */}
                <div className="rounded-2xl border border-gray-200 p-4 sm:p-5">
                  <p className="text-sm font-semibold text-gray-900">
                    Tren kunjungan (15 hari terakhir)
                  </p>
                  <div className="mt-2">
                    {data.tren.length > 0 ? (
                      <TrenKunjunganChart data={data.tren} />
                    ) : (
                      <p className="py-16 text-center text-sm text-gray-500">
                        Belum ada kunjungan tercatat.
                      </p>
                    )}
                  </div>
                </div>

                {/* --------------------------------- Karakteristik + tabs */}
                <div className="rounded-2xl border border-gray-200 p-4 sm:p-5">
                  <p className="text-sm font-semibold text-gray-900">
                    Karakteristik Pengunjung
                  </p>

                  <div
                    role="tablist"
                    aria-label="Karakteristik pengunjung"
                    className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1"
                  >
                    {(
                      [
                        ['sistem', 'Sistem'],
                        ['lokasi', 'Lokasi'],
                        ['rujukan', 'Rujukan'],
                      ] as [Tab, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        onClick={() => setTab(id)}
                        className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors pointer-coarse:min-h-11 pointer-coarse:py-2.5 ${
                          tab === id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {tab === 'sistem' && (
                    <div className="mt-5 space-y-6">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Browser terpopuler
                        </p>
                        <ul className="mt-3 space-y-3">
                          {data.browser.map((row) => (
                            <BarisPersentase
                              key={row.label}
                              label={row.label}
                              jumlah={row.jumlah}
                              total={totalSistem}
                              warna="bg-indigo-500"
                            />
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Sistem operasi
                        </p>
                        <ul className="mt-3 space-y-3">
                          {data.os.map((row) => (
                            <BarisPersentase
                              key={row.label}
                              label={row.label}
                              jumlah={row.jumlah}
                              total={totalOs}
                              warna="bg-emerald-500"
                            />
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {tab === 'lokasi' &&
                    (adaLokasi ? (
                      <div className="mt-5 space-y-6">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            Negara asal
                          </p>
                          <ul className="mt-3 space-y-3">
                            {data.negara.map((row) => (
                              <BarisPersentase
                                key={row.label}
                                label={row.label}
                                jumlah={row.jumlah}
                                total={totalNegara}
                                warna="bg-orange-500"
                              />
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            Kota / kabupaten
                          </p>
                          <ul className="mt-3 space-y-3">
                            {data.kota.map((row) => (
                              <BarisPersentase
                                key={row.label}
                                label={row.label}
                                jumlah={row.jumlah}
                                total={totalKota}
                                warna="bg-amber-500"
                              />
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      // Honest about *why* it is empty: the data only exists if
                      // the proxy in front of the app sends the geo headers.
                      <p className="mt-5 text-sm leading-relaxed text-gray-500">
                        Data lokasi belum tersedia.
                      </p>
                    ))}

                  {tab === 'rujukan' && (
                    <div className="mt-5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Sumber rujukan (referrer)
                      </p>
                      <ul className="mt-3 space-y-3">
                        {data.rujukan.map((row) => {
                          const jenis = RUJUKAN[row.jenis] ?? RUJUKAN.eksternal;
                          return (
                            <BarisPersentase
                              key={`${row.jenis}-${row.label}`}
                              label={row.label || jenis.label}
                              jumlah={row.jumlah}
                              total={totalRujukan}
                              warna="bg-blue-500"
                              badge={jenis.badge}
                              badgeKelas={jenis.kelas}
                            />
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </Reveal>
      </div>
    </section>
  );
}
