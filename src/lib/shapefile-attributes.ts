/**
 * Prefill for "Informasi Kawasan", read out of a shapefile's own attribute
 * table (`.dbf`).
 *
 * A boundary file already carries most of what the form asks for. The provincial
 * Kawasan Hutan release is the clearest case — every feature in
 * `SK_397_TAHUN_2025_KH_KALTIM` holds `SK_PNJK = "SK 397 Tahun 2025"`,
 * `TGL_PNJK = 2025-07-17` and `NM_KWS = <nama kawasan>` — so making the officer
 * retype the SK number off the file they just uploaded is asking them to copy
 * data that is already in hand, with a typo for their trouble.
 *
 * **One rule decides everything here: a field is only suggested when the file
 * agrees with itself.** A value is taken only if every feature carries the same
 * one. `NM_KWS` differing across 187 features says the file describes 187
 * kawasan, not that the first one names the kawasan being created — filling the
 * form from row 1 would put a confident, specific, wrong name on a boundary.
 * When the file disagrees, the field is left for the officer.
 *
 * Nothing here ever overwrites something already typed; the caller applies a
 * suggestion only to fields that are still empty.
 */

import {
  PROHIBITED_AREA_TYPES,
  normalizeProhibitedAreaType,
  type ProhibitedAreaType,
} from './prohibited-area-types';

/** Fields of the kawasan form a boundary file can speak to. */
export interface KawasanAttributeSuggestion {
  namaKawasan?: string;
  jenisKawasan?: ProhibitedAreaType;
  sumberData?: string;
  dasarHukum?: string;
  /** `yyyy-mm-dd`, the shape the date input holds. */
  tanggalEfektif?: string;
}

/**
 * Attribute columns per form field, lowercased.
 *
 * `NAMOBJ`/`SUMBER` are the national RBI schema; the rest are what kabupaten and
 * KLHK data actually ship (`NM_KWS`, `SK_PNJK`, `TGL_PNJK` are from the SK
 * kawasan hutan releases).
 */
/**
 * Columns that hold the name of the thing a feature outlines.
 *
 * Exported because `shapefile-parser` reads the per-feature name from the same
 * list. They were separate once, and `NM_KWS` — the column the KLHK releases
 * actually use — was in this one and not that one, so every feature of the
 * provincial SK came back unnamed and the bulk importer saw one giant kawasan
 * instead of 188. One list, so that cannot happen again.
 */
export const KAWASAN_NAME_FIELDS = [
  'nm_kws',
  'nama_kws',
  'namobj',
  'nama',
  'name',
  'nama_objek',
  'nama_kawasan',
  'namakawasan',
  'nm_kawasan',
  'label',
] as const;

const FIELD_ALIASES = {
  namaKawasan: KAWASAN_NAME_FIELDS,
  jenisKawasan: [
    'jenis',
    'jns_kws',
    'jenis_kws',
    'jenis_kawasan',
    'fungsi',
    'fungsi_kws',
    'fungsikws',
    'ket_kws',
  ],
  sumberData: ['sumber', 'sumber_data', 'sumberdata', 'walidata', 'instansi', 'src'],
  dasarHukum: [
    'sk_pnjk',
    'sk',
    'no_sk',
    'nomor_sk',
    'nosk',
    'dasar_hukum',
    'dasarhukum',
    'dsr_hukum',
    'perda',
    'peraturan',
  ],
  tanggalEfektif: [
    'tgl_pnjk',
    'tgl_sk',
    'tanggal_sk',
    'tgl_efektif',
    'tanggal',
    'tgl',
    'tgl_tetap',
  ],
} as const;

type FieldName = keyof typeof FIELD_ALIASES;

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  return String(value).trim();
}

/**
 * The one value every feature carries for this field, or undefined.
 *
 * Undefined covers three cases that all mean the same thing — the file cannot
 * answer for the kawasan being created: no such column, no feature filled it
 * in, or the features disagree.
 */
export function consistentAttribute(
  features: ReadonlyArray<Record<string, unknown> | null | undefined>,
  aliases: readonly string[],
): string | undefined {
  const values = new Set<string>();

  for (const properties of features) {
    if (!properties) continue;
    for (const [key, raw] of Object.entries(properties)) {
      if (!aliases.includes(key.trim().toLowerCase())) continue;
      const value = text(raw);
      // An empty cell is "not filled in", not a distinct answer — a file where
      // half the rows carry the SK and half are blank still agrees on the SK.
      if (value) values.add(value);
    }
  }

  return values.size === 1 ? [...values][0] : undefined;
}

/** `yyyy-mm-dd` for the date input, from the shapes a `.dbf` date arrives in. */
export function toDateInputValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // ISO / what shpjs hands back for a date column.
  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // dd/mm/yyyy and dd-mm-yyyy — day first, as Indonesian data is written.
  const dayFirst = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirst) {
    const [, day, month, year] = dayFirst;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // yyyymmdd, the plain dBase date encoding.
  const packed = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (packed) return `${packed[1]}-${packed[2]}-${packed[3]}`;

  if (!Number.isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
  return undefined;
}

/**
 * A jenis kawasan the enum actually has.
 *
 * Matched conservatively: the exact name (or a retired one, via
 * `normalizeProhibitedAreaType`), or a value that plainly contains it. A code
 * like `F_2025 = 100700` matches nothing and is left alone rather than guessed
 * at — the wrong jenis on a kawasan changes what it blocks.
 */
export function matchProhibitedAreaType(value: string): ProhibitedAreaType | undefined {
  const normalized = normalizeProhibitedAreaType(value.trim());
  const lowered = normalized.toLowerCase();
  if (!lowered) return undefined;

  const exact = PROHIBITED_AREA_TYPES.find((type) => type.toLowerCase() === lowered);
  if (exact) return exact;

  return PROHIBITED_AREA_TYPES.find((type) => lowered.includes(type.toLowerCase()));
}

/** `SK_397_TAHUN_2025_KH_KALTIM` → `SK 397 TAHUN 2025 KH KALTIM`. */
export function layerNameToLabel(layerName: string | undefined): string | undefined {
  const cleaned = (layerName ?? '')
    .replace(/\.(shp|zip)$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
}

/**
 * What a boundary file can fill in on the kawasan form.
 *
 * `fallbackName` (the layer's own file name) is used for the nama only when the
 * attribute table has no single name to give — a file named after the kawasan
 * is a better starting point than an empty required field, and unlike a
 * per-feature value it does not claim to be one specific row.
 */
export function suggestKawasanAttributes(
  features: ReadonlyArray<Record<string, unknown> | null | undefined>,
  layerName?: string
): KawasanAttributeSuggestion {
  const read = (field: FieldName) => consistentAttribute(features, FIELD_ALIASES[field]);

  const suggestion: KawasanAttributeSuggestion = {};

  const nama = read('namaKawasan') ?? layerNameToLabel(layerName);
  if (nama) suggestion.namaKawasan = nama;

  const jenisRaw = read('jenisKawasan');
  const jenis = jenisRaw ? matchProhibitedAreaType(jenisRaw) : undefined;
  if (jenis) suggestion.jenisKawasan = jenis;

  const sumber = read('sumberData');
  if (sumber) suggestion.sumberData = sumber;

  const dasar = read('dasarHukum');
  if (dasar) suggestion.dasarHukum = dasar;

  const tanggalRaw = read('tanggalEfektif');
  const tanggal = tanggalRaw ? toDateInputValue(tanggalRaw) : undefined;
  if (tanggal) suggestion.tanggalEfektif = tanggal;

  return suggestion;
}

/** Human labels for the fields a suggestion filled, for the toast. */
export const KAWASAN_ATTRIBUTE_LABELS: Record<keyof KawasanAttributeSuggestion, string> = {
  namaKawasan: 'Nama Kawasan',
  jenisKawasan: 'Jenis Kawasan',
  sumberData: 'Sumber Data',
  dasarHukum: 'Dasar Hukum',
  tanggalEfektif: 'Tanggal Efektif',
};
