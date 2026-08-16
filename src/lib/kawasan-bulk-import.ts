/**
 * Splitting one boundary file into many Kawasan Non-SPPTG.
 *
 * A KLHK release like `SK_397_TAHUN_2025_KH_KALTIM` is not one kawasan — it is
 * a whole province of them, 188 named areas across 1 440 rings. The single
 * kawasan form refuses it for exactly that reason, and this is the other half
 * of the answer: **the file's own name attribute is what says where one kawasan
 * ends and the next begins**, so grouping on it turns one upload into the
 * hundred-odd rows it was always describing.
 *
 * Two things this module refuses to do, both because guessing here writes wrong
 * reference data that is then enforced against real pengajuan:
 *
 * 1. **It never merges features that disagree on the name.** Two rings labelled
 *    `TN Kutai` are two blocks of one kawasan; a ring labelled `HP S. Santan`
 *    is a different kawasan, full stop.
 * 2. **It never refuses a group for being large.** An SK is authoritative: if
 *    the ministry drew one kawasan as 781 detached blocks over 444 000
 *    vertices, that is what the kawasan is, and making the office split it in
 *    QGIS would file something the SK does not say. The geometry goes straight
 *    into a PostGIS column, so there is no editor that has to render it first.
 */

import type { ParsedPolygon } from './kmz-parser';
import { MIN_POLYGON_POINTS } from './land-polygons';
import type { KawasanAttributeSuggestion } from './shapefile-attributes';
import type { ProhibitedAreaType } from './prohibited-area-types';
import type { ValidationStatus } from '@/types';

/** Label for features whose name column is blank. */
export const UNNAMED_KAWASAN_LABEL = '(Tanpa nama)';

/** One kawasan-to-be: every block in the file that carried the same name. */
export interface KawasanImportGroup {
  /** Stable id for React keys and selection. */
  key: string;
  /** Nama kawasan as it will be saved — the file's own value. */
  nama: string;
  /** True when the file left the name blank; the officer must supply one. */
  isUnnamed: boolean;
  blocks: ParsedPolygon[];
  blockCount: number;
  pointCount: number;
  /**
   * Why this group cannot be saved, or `null` — which is now always.
   *
   * Kept because the preview still renders it: nothing is refused on size any
   * more, but a future blocker (a geometry PostGIS rejects, say) has a place to
   * be reported rather than silently dropping a kawasan.
   */
  blockedReason: string | null;
}

/**
 * Group a parsed file into one entry per kawasan.
 *
 * Order follows the file: the first appearance of a name fixes that kawasan's
 * position in the list, so the preview reads in the same order as the layer's
 * attribute table.
 */
export function groupPolygonsIntoKawasan(
  polygons: readonly ParsedPolygon[]
): KawasanImportGroup[] {
  const byName = new Map<string, ParsedPolygon[]>();

  for (const polygon of polygons) {
    // A ring under three vertices is not a boundary; it would be dropped on
    // save anyway, and counting it would overstate the group in the preview.
    if (polygon.coordinates.length < MIN_POLYGON_POINTS) continue;

    // `featureName` over `name`: the latter carries per-ring numbering
    // (`TN Kutai (1)`), which would file each block of a kawasan as a kawasan
    // of its own. Falls back to `name` for readers that set only that (KML).
    const nama = (polygon.featureName ?? polygon.name ?? '').trim();
    const existing = byName.get(nama);
    if (existing) existing.push(polygon);
    else byName.set(nama, [polygon]);
  }

  return [...byName.entries()].map(([nama, blocks], index) => ({
    key: `grp-${index}`,
    nama: nama || UNNAMED_KAWASAN_LABEL,
    isUnnamed: nama === '',
    blocks,
    blockCount: blocks.length,
    pointCount: blocks.reduce((total, block) => total + block.coordinates.length, 0),
    // Nothing is refused on size. A kawasan of 781 blocks and 444 000 vertices
    // is one kawasan in the SK it came from, and the import writes it straight
    // into a PostGIS column — there is no editor to render it and no reason to
    // make the office split a boundary the ministry did not.
    blockedReason: null,
  }));
}

/** A group the officer may actually tick. */
export function isImportable(group: KawasanImportGroup): boolean {
  return group.blockedReason === null;
}

/**
 * A file that turned out to describe several kawasan, handed from the single
 * kawasan form to the bulk importer.
 *
 * Carries the already-parsed groups rather than the file: re-reading a 16 MB
 * shapefile to show the same list twice is the kind of thing that makes a page
 * look broken.
 */
export interface KawasanBulkHandoff {
  fileName: string;
  groups: KawasanImportGroup[];
  atribut?: KawasanAttributeSuggestion;
}

/**
 * Vertices allowed in one request.
 *
 * The whole provincial file is 1.33 million points — 51 MB of JSON — which no
 * HTTP body is going to carry. Batching by *points* rather than by row count is
 * what makes the request size predictable: one kawasan of 40 000 vertices and
 * forty of 1 000 cost the same to send, and a fixed "20 rows per request" would
 * be fine for one and hopeless for the other.
 */
export const BULK_IMPORT_POINT_BUDGET = 40_000;

/** Rows per request, so a batch of tiny kawasan is still a sane transaction. */
export const BULK_IMPORT_MAX_ROWS = 25;

/**
 * Split the chosen kawasan into requests that will actually fit.
 *
 * A kawasan larger than the whole budget gets a batch of its own rather than
 * being refused: nothing is capped on size any more, so the planner's job is
 * only to stop *several* large ones sharing one request.
 */
export function planKawasanImportBatches(
  groups: readonly KawasanImportGroup[],
  pointBudget: number = BULK_IMPORT_POINT_BUDGET,
  maxRows: number = BULK_IMPORT_MAX_ROWS
): KawasanImportGroup[][] {
  const batches: KawasanImportGroup[][] = [];
  let current: KawasanImportGroup[] = [];
  let currentPoints = 0;

  for (const group of groups) {
    const wouldExceed =
      current.length > 0 &&
      (currentPoints + group.pointCount > pointBudget || current.length >= maxRows);

    if (wouldExceed) {
      batches.push(current);
      current = [];
      currentPoints = 0;
    }

    current.push(group);
    currentPoints += group.pointCount;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

/** GeoJSON MultiPolygon for one group — its blocks become the parts. */
export function groupToMultiPolygon(group: KawasanImportGroup): {
  type: 'MultiPolygon';
  coordinates: number[][][][];
} {
  return {
    type: 'MultiPolygon',
    coordinates: group.blocks.map((block) => {
      const ring = block.coordinates.map((coordinate) => [
        coordinate.longitude,
        coordinate.latitude,
      ]);
      // GeoJSON rings close; the parsers hand back open ones.
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
        ring.push([first[0], first[1]]);
      }
      return [ring];
    }),
  };
}

/**
 * The attributes one imported kawasan is saved with.
 *
 * **Every kawasan carries its own set.** The batch could have owned them — a
 * boundary file does come from one SK — but *one SK* is not *one kawasan*: a
 * single release routinely mixes Hutan Lindung with Hutan Produksi and Cagar
 * Alam, and a batch-only form left an officer either importing three times or
 * recording the wrong jenis on two thirds of the rows. So these are per row,
 * and the shared form is a fill tool that writes into them rather than a
 * separate layer underneath them: what a row shows is what will be saved.
 */
export interface KawasanRowAttributes {
  namaKawasan: string;
  jenisKawasan?: ProhibitedAreaType;
  sumberData: string;
  dasarHukum: string;
  /** `yyyy-mm-dd`, the shape the date input holds. */
  tanggalEfektif: string;
  statusValidasi: ValidationStatus;
  aktifDiValidasi: boolean;
}

/** Field labels, for naming what is missing or what a quick fill will write. */
export const KAWASAN_ROW_FIELD_LABELS: Record<keyof KawasanRowAttributes, string> = {
  namaKawasan: 'Nama Kawasan',
  jenisKawasan: 'Jenis Kawasan',
  sumberData: 'Sumber Data',
  dasarHukum: 'Dasar Hukum',
  tanggalEfektif: 'Tanggal Efektif',
  statusValidasi: 'Status Validasi',
  aktifDiValidasi: 'Aktif di Validasi',
};

/**
 * A row's starting values.
 *
 * The nama comes from the group — the file's own name for it — and never from a
 * shared field: naming every row of a bulk import identically is the exact
 * mistake this whole feature exists to avoid. `atribut` fills the rest only
 * where the file agreed with itself across every feature (see
 * `shapefile-attributes.ts`), so a suggestion here is never one feature's value
 * passed off as the file's.
 */
export function initialRowAttributes(
  group: KawasanImportGroup,
  atribut?: KawasanAttributeSuggestion
): KawasanRowAttributes {
  return {
    // A placeholder is not a name; leave it blank so the row reads as
    // incomplete rather than as a kawasan called "(Tanpa nama)".
    namaKawasan: group.isUnnamed ? '' : group.nama,
    jenisKawasan: atribut?.jenisKawasan,
    sumberData: atribut?.sumberData ?? '',
    dasarHukum: atribut?.dasarHukum ?? '',
    tanggalEfektif: atribut?.tanggalEfektif ?? '',
    statusValidasi: 'Lolos',
    aktifDiValidasi: true,
  };
}

/** Build the starting table for a whole file. */
export function initialRowAttributeMap(
  groups: readonly KawasanImportGroup[],
  atribut?: KawasanAttributeSuggestion
): Record<string, KawasanRowAttributes> {
  const rows: Record<string, KawasanRowAttributes> = {};
  for (const group of groups) rows[group.key] = initialRowAttributes(group, atribut);
  return rows;
}

/**
 * Write a partial set of values into the named rows.
 *
 * Only the keys actually present in `patch` are written — that is what makes
 * "isi cepat" able to set the tanggal for every kawasan without flattening the
 * jenis each of them was given individually.
 */
export function applyQuickFill(
  rows: Readonly<Record<string, KawasanRowAttributes>>,
  keys: readonly string[],
  patch: Partial<KawasanRowAttributes>
): Record<string, KawasanRowAttributes> {
  const next = { ...rows };
  for (const key of keys) {
    const current = next[key];
    if (!current) continue;
    next[key] = { ...current, ...patch };
  }
  return next;
}

/** One selected kawasan that still cannot be saved, and what it is missing. */
export interface KawasanRowProblem {
  key: string;
  nama: string;
  missing: string[];
}

/**
 * Every selected kawasan whose own attributes are still incomplete.
 *
 * Checked per row, which is the only place it *can* be checked now: there is no
 * shared value standing behind a blank one, so a row left empty is a row that
 * would be saved empty.
 */
export function findRowsMissingAttributes(
  groups: readonly KawasanImportGroup[],
  rows: Readonly<Record<string, KawasanRowAttributes>>
): KawasanRowProblem[] {
  const problems: KawasanRowProblem[] = [];

  for (const group of groups) {
    const row = rows[group.key];
    const missing: string[] = [];

    if (!row) {
      problems.push({ key: group.key, nama: group.nama, missing: ['semua isian'] });
      continue;
    }

    // The server refuses a name under two characters.
    if (row.namaKawasan.trim().length < 2) missing.push(KAWASAN_ROW_FIELD_LABELS.namaKawasan);
    if (!row.jenisKawasan) missing.push(KAWASAN_ROW_FIELD_LABELS.jenisKawasan);
    if (row.sumberData.trim().length < 2) missing.push(KAWASAN_ROW_FIELD_LABELS.sumberData);
    if (Number.isNaN(new Date(row.tanggalEfektif).getTime())) {
      missing.push(KAWASAN_ROW_FIELD_LABELS.tanggalEfektif);
    }

    if (missing.length > 0) {
      problems.push({
        key: group.key,
        nama: row.namaKawasan.trim() || group.nama,
        missing,
      });
    }
  }

  return problems;
}

export interface KawasanImportSummary {
  totalGroups: number;
  importableGroups: number;
  blockedGroups: number;
  totalBlocks: number;
  totalPoints: number;
}

export function summarizeImportGroups(
  groups: readonly KawasanImportGroup[]
): KawasanImportSummary {
  return {
    totalGroups: groups.length,
    importableGroups: groups.filter(isImportable).length,
    blockedGroups: groups.filter((group) => !isImportable(group)).length,
    totalBlocks: groups.reduce((total, group) => total + group.blockCount, 0),
    totalPoints: groups.reduce((total, group) => total + group.pointCount, 0),
  };
}

