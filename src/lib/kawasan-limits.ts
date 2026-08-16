/**
 * What a Kawasan Non-SPPTG's geometry is measured by — and, deliberately, what
 * it is *not* limited by.
 *
 * **There is no ceiling on a kawasan's size.** There were two once
 * (`MAX_KAWASAN_BLOCKS`, `MAX_KAWASAN_TOTAL_POINTS`) and they were wrong in
 * principle: an SK is authoritative reference data, so when the ministry draws
 * one kawasan as 781 detached blocks over 444 000 vertices, that is what the
 * kawasan is. Refusing it made the office either split a boundary the SK does
 * not split, or leave restricted land unrecorded — and unrecorded land is
 * enforced against nobody.
 *
 * Cost is managed only where it can be managed without lying about the data:
 * the coordinate **table** pages (`KAWASAN_COORDINATE_PAGE_SIZE`), because
 * rendering a quarter of a million vertices as DOM rows helps no one. The maps
 * draw every block, the import refuses nothing, and the check runs over
 * everything.
 */

import {
  isUsablePolygon,
  MIN_POLYGON_POINTS,
  polygonLabel,
  validCoordinates,
} from './land-polygons';
import type { LandPolygon } from '@/types';

/**
 * Coordinate rows rendered at once. The table exists for correcting a boundary
 * by hand, and nobody hand-edits ten thousand vertices — but hiding them would
 * make an imported block unverifiable, so it pages instead.
 */
export const KAWASAN_COORDINATE_PAGE_SIZE = 200;

export function countKawasanPoints(polygons: readonly LandPolygon[]): number {
  return polygons.reduce((total, polygon) => total + (polygon.coordinates?.length ?? 0), 0);
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
