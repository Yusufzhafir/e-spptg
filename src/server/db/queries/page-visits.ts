import { sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db, type DBTransaction } from '../db';
import { pageVisits } from '../schema';

/**
 * Reads and writes for the public visit counter (`page_visits`).
 *
 * Every read here returns **counts only**. The `ip` column is used inside
 * `COUNT(DISTINCT ...)` and nowhere else — no function in this file selects it,
 * so no caller can accidentally hand a visitor address to the browser.
 *
 * All the windows are computed in Postgres against `Asia/Makassar` (WITA), not
 * against the app server's clock: "hari ini" has to mean the day it is in Kutai
 * Timur, whatever timezone the container happens to run in.
 */

/**
 * Inlined as a literal rather than bound as a parameter, and that is load
 * bearing: `GROUP BY` matches the select list by *expression*, and Postgres
 * cannot prove that `AT TIME ZONE $1` and `AT TIME ZONE $4` are the same thing
 * even when both carry the same value — the grouped query fails with "must
 * appear in the GROUP BY clause". A hardcoded constant is also the only reason
 * inlining is safe here; nothing user-supplied ever reaches this string.
 */
const ZONA = sql.raw(`'Asia/Makassar'`);

export type VisitRow = {
  path: string;
  ip: string | null;
  rujukanJenis: string;
  rujukanHost: string | null;
  browser: string;
  os: string;
  perangkat: string;
  negara: string | null;
  kota: string | null;
};

export async function catatKunjungan(row: VisitRow, tx?: DBTransaction) {
  const queryDb = tx || db;
  await queryDb.insert(pageVisits).values(row);
}

/** Hits and unique addresses inside one window. */
type Hitungan = { hits: number; unik: number };

const HITUNGAN_KOSONG: Hitungan = { hits: 0, unik: 0 };

export type VisitStatsRaw = {
  aktif: number;
  hariIni: Hitungan;
  bulanIni: Hitungan;
  total: Hitungan;
  tren: { tanggal: string; hits: number; unik: number }[];
  browser: { label: string; jumlah: number }[];
  os: { label: string; jumlah: number }[];
  negara: { label: string; jumlah: number }[];
  kota: { label: string; jumlah: number }[];
  rujukan: { label: string; jenis: string; jumlah: number }[];
};

/** How many days the trend chart covers, matching the reference dashboard. */
export const HARI_TREN = 15;

/**
 * Everything the "Statistik Kunjungan" card shows, in four round trips.
 *
 * The counters are one query rather than four: the windows are nested (5 minutes
 * ⊂ today ⊂ this month ⊂ all time), so `FILTER` clauses over a single scan give
 * the same numbers as four scans would.
 */
export async function getVisitStats(tx?: DBTransaction): Promise<VisitStatsRaw> {
  const queryDb = tx || db;

  const waktuLokal = sql`(${pageVisits.waktu} AT TIME ZONE 'UTC' AT TIME ZONE ${ZONA})`;
  const sekarangLokal = sql`(now() AT TIME ZONE ${ZONA})`;

  const [counters] = await queryDb
    .select({
      aktif: sql<number>`COUNT(DISTINCT ${pageVisits.ip}) FILTER (WHERE ${pageVisits.waktu} >= now() - interval '5 minutes')::int`,
      hitsHariIni: sql<number>`COUNT(*) FILTER (WHERE ${waktuLokal}::date = ${sekarangLokal}::date)::int`,
      unikHariIni: sql<number>`COUNT(DISTINCT ${pageVisits.ip}) FILTER (WHERE ${waktuLokal}::date = ${sekarangLokal}::date)::int`,
      hitsBulanIni: sql<number>`COUNT(*) FILTER (WHERE date_trunc('month', ${waktuLokal}) = date_trunc('month', ${sekarangLokal}))::int`,
      unikBulanIni: sql<number>`COUNT(DISTINCT ${pageVisits.ip}) FILTER (WHERE date_trunc('month', ${waktuLokal}) = date_trunc('month', ${sekarangLokal}))::int`,
      hitsTotal: sql<number>`COUNT(*)::int`,
      unikTotal: sql<number>`COUNT(DISTINCT ${pageVisits.ip})::int`,
    })
    .from(pageVisits);

  const tren = await queryDb
    .select({
      tanggal: sql<string>`to_char(${waktuLokal}::date, 'YYYY-MM-DD')`,
      hits: sql<number>`COUNT(*)::int`,
      unik: sql<number>`COUNT(DISTINCT ${pageVisits.ip})::int`,
    })
    .from(pageVisits)
    .where(
      sql`${waktuLokal}::date > ${sekarangLokal}::date - ${sql.raw(String(HARI_TREN))}`
    )
    .groupBy(sql`${waktuLokal}::date`)
    .orderBy(sql`${waktuLokal}::date`);

  // One pass per dimension. `label` is always a column of this table, never
  // anything derived from an untrusted string at query time.
  const teratas = async (kolom: PgColumn, batas: number) =>
    queryDb
      .select({
        label: sql<string>`COALESCE(${kolom}, 'Tidak diketahui')`,
        jumlah: sql<number>`COUNT(*)::int`,
      })
      .from(pageVisits)
      .where(sql`${kolom} IS NOT NULL`)
      .groupBy(kolom)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(batas);

  const [browser, os, negara, kota] = await Promise.all([
    teratas(pageVisits.browser, 5),
    teratas(pageVisits.os, 5),
    teratas(pageVisits.negara, 5),
    teratas(pageVisits.kota, 5),
  ]);

  // Referrers are grouped by kind first so that "Navigasi" (internal) and
  // "Akses Langsung" (direct) stay single rows instead of an empty host each.
  const rujukan = await queryDb
    .select({
      jenis: pageVisits.rujukanJenis,
      label: sql<string>`COALESCE(${pageVisits.rujukanHost}, '')`,
      jumlah: sql<number>`COUNT(*)::int`,
    })
    .from(pageVisits)
    .groupBy(pageVisits.rujukanJenis, pageVisits.rujukanHost)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(6);

  return {
    aktif: counters?.aktif ?? 0,
    hariIni: counters
      ? { hits: counters.hitsHariIni, unik: counters.unikHariIni }
      : HITUNGAN_KOSONG,
    bulanIni: counters
      ? { hits: counters.hitsBulanIni, unik: counters.unikBulanIni }
      : HITUNGAN_KOSONG,
    total: counters ? { hits: counters.hitsTotal, unik: counters.unikTotal } : HITUNGAN_KOSONG,
    tren,
    browser,
    os,
    negara,
    kota,
    rujukan,
  };
}

/**
 * How long a visit row is kept. Raw addresses are personal data, so the table
 * is not an archive: anything older than this is deleted by `hapusKunjunganLama`
 * on the next write, which keeps the retention promise true without a cron.
 */
export const VISIT_RETENTION_DAYS = 400;

export async function hapusKunjunganLama(tx?: DBTransaction) {
  const queryDb = tx || db;
  await queryDb
    .delete(pageVisits)
    .where(
      sql`${pageVisits.waktu} < now() - ${sql.raw(`interval '${VISIT_RETENTION_DAYS} days'`)}`
    );
}
