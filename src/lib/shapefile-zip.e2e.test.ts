import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parseShapefileZip, zipContainsShapefile } from './shapefile-parser';

/**
 * The zip path, end to end, on shapefiles built here byte by byte.
 *
 * There is no fixture to check in and no GDAL on the box, so the .shp and .dbf
 * are written by hand — it is a small, fixed format, and having it here is what
 * lets the two things that actually matter be proven rather than assumed: that a
 * **UTM** file is reprojected to WGS 84 through its `.prj` (survey data for this
 * kabupaten arrives in zone 50N, and read as degrees it would land in the Gulf
 * of Guinea), and that a file **without** a `.prj` is refused instead of
 * silently placing a parcel there.
 */

const SHAPE_TYPE_POLYGON = 5;

/** One closed ring, written as a single-part Polygon record. */
function writeShp(ring: Array<[number, number]>): Uint8Array {
  const points = ring.length;
  // shapeType + box + numParts + numPoints + parts + points
  const contentBytes = 4 + 32 + 4 + 4 + 4 + points * 16;
  const buffer = new ArrayBuffer(100 + 8 + contentBytes);
  const view = new DataView(buffer);

  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];

  view.setInt32(0, 9994); // file code, big-endian
  view.setInt32(24, (100 + 8 + contentBytes) / 2); // length in 16-bit words
  view.setInt32(28, 1000, true); // version
  view.setInt32(32, SHAPE_TYPE_POLYGON, true);
  box.forEach((value, index) => view.setFloat64(36 + index * 8, value, true));

  view.setInt32(100, 1); // record number, big-endian
  view.setInt32(104, contentBytes / 2); // content length in words, big-endian

  let offset = 108;
  view.setInt32(offset, SHAPE_TYPE_POLYGON, true);
  offset += 4;
  box.forEach((value, index) => view.setFloat64(offset + index * 8, value, true));
  offset += 32;
  view.setInt32(offset, 1, true); // numParts
  offset += 4;
  view.setInt32(offset, points, true); // numPoints
  offset += 4;
  view.setInt32(offset, 0, true); // part 0 starts at point 0
  offset += 4;
  for (const [x, y] of ring) {
    view.setFloat64(offset, x, true);
    view.setFloat64(offset + 8, y, true);
    offset += 16;
  }

  return new Uint8Array(buffer);
}

/** dBase III with one character column, one row. */
function writeDbf(column: string, value: string): Uint8Array {
  const width = 32;
  const headerLength = 32 + 32 + 1;
  const recordLength = 1 + width;
  const buffer = new ArrayBuffer(headerLength + recordLength + 1);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint8(0, 0x03);
  view.setUint8(1, 126); // 2026
  view.setUint8(2, 2);
  view.setUint8(3, 7);
  view.setInt32(4, 1, true); // one record
  view.setInt16(8, headerLength, true);
  view.setInt16(10, recordLength, true);

  const name = column.slice(0, 10);
  for (let i = 0; i < name.length; i++) bytes[32 + i] = name.charCodeAt(i);
  view.setUint8(32 + 11, 'C'.charCodeAt(0)); // type
  view.setUint8(32 + 16, width); // field length
  view.setUint8(64, 0x0d); // field terminator

  bytes[65] = 0x20; // record not deleted
  const padded = value.padEnd(width, ' ');
  for (let i = 0; i < width; i++) bytes[66 + i] = padded.charCodeAt(i);
  bytes[bytes.length - 1] = 0x1a; // EOF

  return bytes;
}

const WGS84_PRJ =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

/** WGS 84 / UTM zone 50N — what a survey of Kutai Timur is delivered in. */
const UTM_50N_PRJ =
  'PROJCS["WGS_1984_UTM_Zone_50N",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",117.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]';

async function zipShapefile(options: {
  ring: Array<[number, number]>;
  prj?: string;
  nama?: string;
  extraFile?: string;
}): Promise<File> {
  const zip = new JSZip();
  zip.file('bidang.shp', writeShp(options.ring));
  zip.file('bidang.dbf', writeDbf('NAMOBJ', options.nama ?? 'Bidang Uji'));
  zip.file('bidang.cpg', 'UTF-8');
  if (options.prj) zip.file('bidang.prj', options.prj);
  if (options.extraFile) zip.file(options.extraFile, 'x');
  const blob = await zip.generateAsync({ type: 'arraybuffer' });
  return new File([blob], 'bidang.zip', { type: 'application/zip' });
}

/** A square around Sangatta, in degrees. */
const RING_WGS84: Array<[number, number]> = [
  [117.53, 0.52],
  [117.54, 0.52],
  [117.54, 0.53],
  [117.53, 0.53],
  [117.53, 0.52],
];

/** The same corner of the world, as UTM 50N metres. */
const RING_UTM: Array<[number, number]> = [
  [558974, 57497],
  [560087, 57497],
  [560087, 58603],
  [558974, 58603],
  [558974, 57497],
];

describe('parseShapefileZip', () => {
  it('reads a WGS 84 shapefile and its attribute name', async () => {
    const result = await parseShapefileZip(
      await zipShapefile({ ring: RING_WGS84, prj: WGS84_PRJ, nama: 'Bidang Utara' })
    );

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.polygons).toHaveLength(1);
    expect(result.polygons[0].name).toBe('Bidang Utara');
    expect(result.polygons[0].coordinates[0].longitude).toBeCloseTo(117.53, 4);
    expect(result.polygons[0].coordinates[0].latitude).toBeCloseTo(0.52, 4);
  });

  it('reprojects UTM metres to WGS 84 using the .prj', async () => {
    const result = await parseShapefileZip(
      await zipShapefile({ ring: RING_UTM, prj: UTM_50N_PRJ })
    );

    expect(result.success).toBe(true);
    const [first] = result.polygons[0].coordinates;
    // Sangatta, not the Atlantic: within a few hundred metres of the WGS 84 ring.
    expect(first.longitude).toBeCloseTo(117.53, 2);
    expect(first.latitude).toBeCloseTo(0.52, 2);
  });

  it('refuses projected coordinates when the .prj is missing', async () => {
    const result = await parseShapefileZip(await zipShapefile({ ring: RING_UTM }));

    expect(result.success).toBe(false);
    expect(result.error).toContain('.prj');
  });

  it('reads a shapefile that has no .prj but is already in degrees', async () => {
    const result = await parseShapefileZip(await zipShapefile({ ring: RING_WGS84 }));

    expect(result.success).toBe(true);
    expect(result.polygons[0].coordinates[0].longitude).toBeCloseTo(117.53, 4);
  });

  it('reports a zip with no .shp in it as such', async () => {
    const zip = new JSZip();
    zip.file('catatan.txt', 'bukan shapefile');
    const blob = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([blob], 'kosong.zip', { type: 'application/zip' });

    expect(await zipContainsShapefile(file)).toBe(false);
    expect((await parseShapefileZip(file)).success).toBe(false);
  });

  it('recognises an archive that does hold a .shp', async () => {
    expect(
      await zipContainsShapefile(await zipShapefile({ ring: RING_WGS84, prj: WGS84_PRJ }))
    ).toBe(true);
  });
});
