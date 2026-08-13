'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAngka } from '@/lib/landing-stats';

/**
 * Daily visits over the last two weeks: hits as a filled area, unique addresses
 * as a line on top.
 *
 * Recharts for the same reasons as `KecamatanCharts` — already bundled, SVG in
 * the page's own colours, and no vendor mark stamped on a government portal.
 */
export type TitikTren = { tanggal: string; hits: number; unik: number };

/** `2026-08-13` -> `13 Agu` for the axis, `13 Agustus 2026` for the tooltip. */
function formatTanggal(iso: string, panjang = false): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: panjang ? 'long' : 'short',
    ...(panjang ? { year: 'numeric' } : {}),
  }).format(parsed);
}

function KeteranganTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const nilai = (kunci: string) =>
    payload.find((item) => item.dataKey === kunci)?.value ?? 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-semibold text-gray-900">{formatTanggal(String(label), true)}</p>
      <p className="mt-1 text-xs text-gray-600">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-500" />
        {formatAngka(Number(nilai('hits')))} hits
      </p>
      <p className="text-xs text-gray-600">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
        {formatAngka(Number(nilai('unik')))} pengunjung unik
      </p>
    </div>
  );
}

export default function TrenKunjunganChart({ data }: { data: TitikTren[] }) {
  // Sorted here rather than trusted from the query, so a reordered result can
  // never draw the line backwards.
  const titik = useMemo(
    () => [...data].sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
    [data]
  );

  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={titik} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="tren-hits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="tanggal"
            tickFormatter={(value: string) => formatTanggal(value)}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            minTickGap={16}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<KeteranganTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="circle"
            formatter={(value) => (
              <span className="text-xs text-gray-600">
                {value === 'hits' ? 'Hits' : 'Pengunjung unik'}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="hits"
            stroke="#4f46e5"
            strokeWidth={2}
            fill="url(#tren-hits)"
            dot={{ r: 2.5, strokeWidth: 0, fill: '#4f46e5' }}
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="unik"
            stroke="#10b981"
            strokeWidth={2}
            fill="transparent"
            dot={{ r: 2.5, strokeWidth: 0, fill: '#10b981' }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
