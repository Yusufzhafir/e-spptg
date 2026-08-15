/**
 * The provincial Kawasan Hutan shapefile, end to end.
 *
 * `SK_397_TAHUN_2025_KH_KALTIM` is 188 features holding 1 440 rings and 1.33
 * million vertices — 51 MB of GeoJSON. It is not one kawasan, it is a province
 * of them, and before the ceilings in `kawasan-limits.ts` it would have frozen
 * the form and then failed on save. This test pins both halves of the answer:
 * the file still parses, and it is refused with an explanation rather than
 * loaded or silently truncated.
 *
 * Skipped unless the file is present (it is 16 MB and not in the repo):
 *   KAWASAN_SHP_FIXTURE=/path/to/SHP.zip pnpm vitest run src/lib/shp-zip-huge.e2e.test.ts
 */
import fs from 'node:fs';
import { checkKawasanImportSize, countKawasanPoints } from './kawasan-limits';
import type { LandPolygon } from '@/types';

const fixture = process.env.KAWASAN_SHP_FIXTURE;
const available = Boolean(fixture && fs.existsSync(fixture));

describe.runIf(available)('provincial Kawasan Hutan shapefile', () => {
  it('parses, and is refused as one kawasan with a message that says why', async () => {
    // shpjs reaches for `self`; it is a browser build.
    (globalThis as unknown as { self: unknown }).self = globalThis;
    const { parseShapefileZip } = await import('./shapefile-parser');
    const { UNLIMITED_POLYGON_POINTS } = await import('./kmz-parser');

    const bytes = fs.readFileSync(fixture!);
    const file = new File([bytes], 'SHP.zip', { type: 'application/zip' });

    const result = await parseShapefileZip(file, { maxPoints: UNLIMITED_POLYGON_POINTS });
    expect(result.success).toBe(true);

    const polygons: LandPolygon[] = result.polygons.map((polygon, index) => ({
      id: `p${index}`,
      nama: polygon.name,
      coordinates: polygon.coordinates,
    }));

    // The numbers this whole ceiling exists for.
    expect(polygons.length).toBeGreaterThan(1_000);
    expect(countKawasanPoints(polygons)).toBeGreaterThan(1_000_000);

    const fits = checkKawasanImportSize(polygons);
    expect(fits.ok).toBe(false);
    expect(fits.message).toMatch(/QGIS|ArcGIS/);

    // The attribute table still answers, so a file split per kawasan prefills.
    expect(result.atribut?.dasarHukum).toBe('SK 397 Tahun 2025');
    expect(result.atribut?.tanggalEfektif).toBe('2025-07-16');
  }, 120_000);

  it('splits into one kawasan per name, in batches that will actually send', async () => {
    (globalThis as unknown as { self: unknown }).self = globalThis;
    const { parseShapefileZip } = await import('./shapefile-parser');
    const { UNLIMITED_POLYGON_POINTS } = await import('./kmz-parser');
    const {
      groupPolygonsIntoKawasan,
      groupToMultiPolygon,
      isImportable,
      planKawasanImportBatches,
      BULK_IMPORT_POINT_BUDGET,
      BULK_IMPORT_MAX_ROWS,
    } = await import('./kawasan-bulk-import');

    const bytes = fs.readFileSync(fixture!);
    const file = new File([bytes], 'SHP.zip', { type: 'application/zip' });
    const result = await parseShapefileZip(file, { maxPoints: UNLIMITED_POLYGON_POINTS });

    const groups = groupPolygonsIntoKawasan(result.polygons);

    // 188 features, 1 440 rings, 187 distinct names plus the unnamed catch-all:
    // grouping by name is what turns the file into the kawasan it describes.
    expect(groups.length).toBeGreaterThan(150);
    expect(groups.length).toBeLessThan(250);
    expect(groups.reduce((total, group) => total + group.blockCount, 0)).toBe(
      result.polygons.length
    );

    // The one group that cannot be a single kawasan is the unnamed catch-all,
    // and it is flagged rather than dropped.
    const blocked = groups.filter((group) => !isImportable(group));
    expect(blocked).toHaveLength(1);
    expect(blocked[0].isUnnamed).toBe(true);

    const importable = groups.filter(isImportable);
    const batches = planKawasanImportBatches(importable);

    // Nothing lost, nothing duplicated, and every batch is sendable.
    expect(batches.flat()).toHaveLength(importable.length);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(BULK_IMPORT_MAX_ROWS);
      const points = batch.reduce((total, group) => total + group.pointCount, 0);
      // A single kawasan may exceed the budget alone; a batch of several may not.
      if (batch.length > 1) expect(points).toBeLessThanOrEqual(BULK_IMPORT_POINT_BUDGET);
      // The request body each batch becomes has to be a sane size.
      const bytesOut = JSON.stringify(batch.map(groupToMultiPolygon)).length;
      expect(bytesOut).toBeLessThan(8 * 1024 * 1024);
    }

    // Every part of every kawasan survives the trip into GeoJSON.
    for (const group of importable) {
      expect(groupToMultiPolygon(group).coordinates).toHaveLength(group.blockCount);
    }
  }, 180_000);
});
