'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { formatAngka, formatHektar, type LandingStatsKecamatan } from '@/lib/landing-stats';

/**
 * SPPTG terdaftar per kecamatan, as two switchable bar charts.
 *
 * Recharts rather than a heavier charting library: it is already a dependency
 * (the in-app dashboard uses it), it renders SVG that inherits the page's own
 * colours, it carries **no vendor logo or attribution mark** — which is the
 * whole reason this replaced the previous chart — and it costs nothing extra to
 * ship since the bundle is already there.
 *
 * Interaction is the point of the switch: hovering a bar highlights it and
 * shows both figures for that kecamatan at once, and the measure toggle lets one
 * chart answer "how many berkas" and "how much land" without two half-width
 * charts fighting for space on a phone.
 */

type Ukuran = 'berkas' | 'luas';

const WARNA = [
  '#2563eb',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#f97316',
];

type TitikKecamatan = {
  kecamatan: string;
  berkas: number;
  /** Hektar, rounded to the two decimals the rest of the page shows. */
  luas: number;
  luasM2: number;
};

function KeteranganTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TitikKecamatan }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-semibold text-gray-900">{row.kecamatan}</p>
      <p className="mt-1 text-xs text-gray-600">
        <strong className="font-semibold text-gray-900">{formatAngka(row.berkas)}</strong> berkas
      </p>
      <p className="text-xs text-gray-600">
        <strong className="font-semibold text-gray-900">{formatHektar(row.luasM2)}</strong> ha
      </p>
    </div>
  );
}

export function KecamatanCharts({ data }: { data: LandingStatsKecamatan[] }) {
  const [ukuran, setUkuran] = useState<Ukuran>('berkas');
  const [disorot, setDisorot] = useState<number | null>(null);

  const titik = useMemo<TitikKecamatan[]>(
    () =>
      data.map((row) => ({
        kecamatan: row.kecamatan,
        berkas: row.total,
        luas: Number((row.luasM2 / 10_000).toFixed(2)),
        luasM2: row.luasM2,
      })),
    [data]
  );

  // Wide enough that the labels stay readable, then scrolled horizontally —
  // squeezing twenty kecamatan into a phone's width makes the axis unreadable.
  const lebarMinimum = Math.max(titik.length * 68, 320);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          Statistik SPPTG terdaftar per kecamatan
        </h3>

        <div className="flex rounded-lg bg-gray-100 p-1">
          {(
            [
              ['berkas', 'Jumlah berkas'],
              ['luas', 'Luas (ha)'],
            ] as [Ukuran, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={ukuran === id}
              onClick={() => setUkuran(id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors pointer-coarse:min-h-11 pointer-coarse:py-2.5 ${
                ukuran === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div style={{ minWidth: lebarMinimum }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={titik}
              margin={{ top: 8, right: 8, bottom: 44, left: 0 }}
              onMouseLeave={() => setDisorot(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="kecamatan"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={60}
                tick={{ fontSize: 11, fill: '#4b5563' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={72}
                // Whole numbers on the axis even for hektar: two decimals on a
                // six-figure tick overflows the gutter and gets clipped, and the
                // exact figure is a hover away in the tooltip.
                tickFormatter={(value: number) => formatAngka(value)}
              />
              <Tooltip
                content={<KeteranganTooltip />}
                cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }}
              />
              <Bar
                dataKey={ukuran}
                radius={[6, 6, 0, 0]}
                maxBarSize={72}
                onMouseEnter={(_, index: number) => setDisorot(index)}
                isAnimationActive
              >
                {titik.map((row, index) => (
                  <Cell
                    key={row.kecamatan}
                    fill={WARNA[index % WARNA.length]}
                    // Everything but the hovered bar dims, which is what makes
                    // the hover readable when several bars are close in height.
                    fillOpacity={disorot === null || disorot === index ? 1 : 0.35}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* The crawlable, screen-reader-readable copy of the chart: an SVG of bars
          carries no text a search engine or a screen reader can use. */}
      <ul className="mt-6 grid gap-x-8 gap-y-2 border-t border-gray-100 pt-5 text-sm sm:grid-cols-2">
        {data.map((row) => (
          <li
            key={row.kecamatan}
            className="flex items-baseline justify-between gap-3 border-b border-gray-50 pb-1.5"
          >
            <span className="truncate font-medium text-gray-700">{row.kecamatan}</span>
            <span className="shrink-0 tabular-nums text-gray-500">
              <strong className="font-semibold text-gray-900">
                {formatAngka(row.total)}
              </strong>{' '}
              berkas · {formatHektar(row.luasM2)} ha
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
