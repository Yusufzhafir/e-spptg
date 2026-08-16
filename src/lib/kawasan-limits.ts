/**
 * Ceilings for one Kawasan Non-SPPTG, and the checks that enforce them.
 *
 * A kawasan deliberately has no 100-vertex cap like a pengajuan's bidang — a
 * Kawasan Hutan traced from an SK is routinely thousands of points, and the
 * geometry goes straight into a PostGIS column rather than a JSON draft
 * payload. But "no arbitrary cap" is not the same as "no ceiling", and a real
 * file made that difference concrete: `SK_397_TAHUN_2025_KH_KALTIM.shp` — the
 * Kawasan Hutan of the whole province — is 188 features holding **1,440 rings
 * and 1.33 million vertices**, which is 51 MB of GeoJSON. Loaded into this form
 * it would freeze the tab (a quarter of a million table rows for the largest
 * block alone) and then fail on save, because no HTTP body or `sql.raw` literal
 * of that size is going anywhere.
 *
 * That file is not one kawasan. It is a provincial dataset of 188 of them, and
 * the form writes exactly one row — so it is refused with a message that says
 * so, rather than silently truncated. A boundary quietly missing most of its
 * blocks is worse than an error: it would be enforced against real pengajuan.
 *
 * The numbers below are ~1,000× the wizard's per-bidang cap, so a genuinely
 * detailed single kawasan still imports without ever meeting them.
 */

import {
  isUsablePolygon,
  MIN_POLYGON_POINTS,
  polygonLabel,
  validCoordinates,
} from './land-polygons';
import type { LandPolygon } from '@/types';

/** Detached blocks one kawasan may hold. */
export const MAX_KAWASAN_BLOCKS = 500;

/** Vertices across all blocks of one kawasan. ~3.8 MB of GeoJSON at the limit. */
export const MAX_KAWASAN_TOTAL_POINTS = 100_000;

/**
 * Coordinate rows rendered at once. The table exists for correcting a boundary
 * by hand, and nobody hand-edits ten thousand vertices — but hiding them would
 * make an imported block unverifiable, so it pages instead.
 */
export const KAWASAN_COORDINATE_PAGE_SIZE = 200;

/**
 * Maps draw **every** block, with no ceiling — deliberately.
 *
 * There was a cap here once, and it was wrong in the way that matters: the
 * overlap check runs in PostGIS over every kawasan, so a map drawing a subset
 * showed part of an answer that had already been computed in full, and an
 * officer could not tell a kawasan that was absent from one that did not exist.
 * On a page whose whole purpose is "where are the restricted areas, and who is
 * standing in them", that is worse than a slow map.
 *
 * Cost is managed where it can be managed without lying about the data: the
 * coordinate *table* pages (`KAWASAN_COORDINATE_PAGE_SIZE`), because reading
 * 250 000 vertices as DOM rows helps nobody, and `MAX_KAWASAN_TOTAL_POINTS`
 * keeps any single kawasan to a size a browser can hold at all. Do not
 * reintroduce a display cap on the map layers.
 */

export function countKawasanPoints(polygons: readonly LandPolygon[]): number {
  return polygons.reduce((total, polygon) => total + (polygon.coordinates?.length ?? 0), 0);
}

/**
 * Whether an imported set fits in one kawasan. Returns the reason when it does
 * not, phrased for the officer holding the file.
 */
export function checkKawasanImportSize(polygons: readonly LandPolygon[]): {
  ok: boolean;
  message?: string;
} {
  if (polygons.length > MAX_KAWASAN_BLOCKS) {
    return {
      ok: false,
      message:
        `File berisi ${polygons.length.toLocaleString('id-ID')} polygon, melebihi batas ` +
        `${MAX_KAWASAN_BLOCKS.toLocaleString('id-ID')} blok untuk satu kawasan. ` +
        'File sebesar ini biasanya berisi banyak kawasan sekaligus (mis. SK kawasan hutan satu provinsi) — ' +
        'pisahkan per kawasan di QGIS/ArcGIS lalu impor satu per satu.',
    };
  }

  const totalPoints = countKawasanPoints(polygons);
  if (totalPoints > MAX_KAWASAN_TOTAL_POINTS) {
    return {
      ok: false,
      message:
        `File berisi ${totalPoints.toLocaleString('id-ID')} titik koordinat, melebihi batas ` +
        `${MAX_KAWASAN_TOTAL_POINTS.toLocaleString('id-ID')} titik untuk satu kawasan. ` +
        'Sederhanakan geometri (Simplify) atau pisahkan per kawasan di QGIS/ArcGIS, lalu impor ulang.',
    };
  }

  return { ok: true };
}

/** One block that cannot be saved, and why — so the error can name it. */
export interface UnusableKawasanBlock {
  index: number;
  label: string;
  pointCount: number;
}

/**
 * Every block that would be dropped on save.
 *
 * `polygonsToMultiPolygon` silently skips a block with fewer than three usable
 * vertices, which meant a kawasan with an empty block saved as a *smaller*
 * kawasan than the one on screen — enforced against pengajuan ever after. The
 * submit path checks **all** blocks with this and refuses, naming them, instead.
 */
export function findUnusableKawasanBlocks(
  polygons: readonly LandPolygon[]
): UnusableKawasanBlock[] {
  const unusable: UnusableKawasanBlock[] = [];
  polygons.forEach((polygon, index) => {
    if (isUsablePolygon(polygon)) return;
    unusable.push({
      index,
      label: polygonLabel(polygon, index),
      pointCount: validCoordinates(polygon.coordinates ?? []).length,
    });
  });
  return unusable;
}

/** The refusal message for a set of incomplete blocks. */
export function unusableKawasanBlocksMessage(blocks: readonly UnusableKawasanBlock[]): string {
  if (blocks.length === 0) return '';
  const names = blocks.map((block) => `${block.label} (${block.pointCount} titik)`).join(', ');
  return (
    `Blok berikut belum memiliki minimal ${MIN_POLYGON_POINTS} titik koordinat yang valid: ${names}. ` +
    'Lengkapi atau hapus blok tersebut sebelum menyimpan kawasan.'
  );
}
