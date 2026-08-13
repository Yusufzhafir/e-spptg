import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DOMParser as XmldomDOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import { parseKMLFile, parseKMZFile } from './kmz-parser';

function createKmlFile(content: string, name = 'test.kml'): File {
  return new File([content], name, {
    type: 'application/vnd.google-earth.kml+xml',
  });
}

async function createKmzFile(kmlContent: string): Promise<File> {
  const zip = new JSZip();
  zip.file('doc.kml', kmlContent);
  // JSZip.loadAsync supports ArrayBuffer in Node test runtime.
  return (await zip.generateAsync({ type: 'arraybuffer' })) as unknown as File;
}

const singlePolygonKmlWithNewlines = `
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              106.800000,-6.200000,0
              106.810000,-6.210000,0
              106.820000,-6.200000,0
              106.800000,-6.200000,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
`;

beforeAll(() => {
  // Vitest runs in Node env; provide DOMParser for XML parsing tests.
  globalThis.DOMParser = XmldomDOMParser as unknown as typeof DOMParser;
});

afterAll(() => {
  delete (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
});

describe('parseKMLFile', () => {
  it('parses one polygon with newline-separated coordinates', async () => {
    const result = await parseKMLFile(createKmlFile(singlePolygonKmlWithNewlines));

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.coordinates.length).toBe(4);
    expect(result.coordinates.every((coord) => Number.isFinite(coord.latitude))).toBe(true);
    expect(result.coordinates.every((coord) => Number.isFinite(coord.longitude))).toBe(true);
  });

  it('skips placemarks without polygon and parses the valid one', async () => {
    const content = `
      <kml>
        <Document>
          <Placemark><name>Tanpa polygon</name></Placemark>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>106.8,-6.2,0 106.81,-6.21,0 106.82,-6.2,0 106.8,-6.2,0</coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    const result = await parseKMLFile(createKmlFile(content));

    expect(result.success).toBe(true);
    expect(result.coordinates.length).toBe(4);
  });

  it('fails when polygon is missing coordinates element', async () => {
    const content = `
      <kml>
        <Document>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing />
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    const result = await parseKMLFile(createKmlFile(content));

    expect(result.success).toBe(false);
    expect(result.coordinates).toEqual([]);
    expect(result.error).toContain('coordinates');
  });

  it('fails on invalid numeric coordinate tokens and does not emit NaN', async () => {
    const content = `
      <kml>
        <Document>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>106.8,-6.2,0 abc,-6.21,0 106.82,-6.2,0</coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    const result = await parseKMLFile(createKmlFile(content));

    expect(result.success).toBe(false);
    expect(result.coordinates).toEqual([]);
    expect(result.error).toContain('Koordinat tidak valid');
  });

  it('returns every polygon in the file, named after its placemark', async () => {
    const content = `
      <kml>
        <Document>
          <Placemark>
            <name>Bidang A</name>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>106.8,-6.2,0 106.81,-6.21,0 106.82,-6.2,0</coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
          <Placemark>
            <name>Bidang B</name>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>106.9,-6.3,0 106.91,-6.31,0 106.92,-6.3,0</coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    const result = await parseKMLFile(createKmlFile(content));

    expect(result.success).toBe(true);
    expect(result.polygons.map((polygon) => polygon.name)).toEqual([
      'Bidang A',
      'Bidang B',
    ]);
    expect(result.polygons[1].coordinates[0].longitude).toBe(106.9);
    // The flat result stays the first polygon for single-boundary callers.
    expect(result.coordinates).toEqual(result.polygons[0].coordinates);
  });

  it('splits a MultiGeometry placemark into one polygon per part', async () => {
    const content = `
      <kml>
        <Document>
          <Placemark>
            <name>Kawasan Hutan</name>
            <MultiGeometry>
              <Polygon>
                <outerBoundaryIs>
                  <LinearRing>
                    <coordinates>106.8,-6.2,0 106.81,-6.21,0 106.82,-6.2,0</coordinates>
                  </LinearRing>
                </outerBoundaryIs>
              </Polygon>
              <Polygon>
                <outerBoundaryIs>
                  <LinearRing>
                    <coordinates>106.9,-6.3,0 106.91,-6.31,0 106.92,-6.3,0</coordinates>
                  </LinearRing>
                </outerBoundaryIs>
              </Polygon>
            </MultiGeometry>
          </Placemark>
        </Document>
      </kml>
    `;

    const result = await parseKMLFile(createKmlFile(content));

    expect(result.success).toBe(true);
    expect(result.polygons.map((polygon) => polygon.name)).toEqual([
      'Kawasan Hutan (1)',
      'Kawasan Hutan (2)',
    ]);
  });

  it('ignores inner boundaries when reading the outer ring', async () => {
    const content = `
      <kml>
        <Document>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>106.8,-6.2,0 106.9,-6.2,0 106.9,-6.3,0 106.8,-6.2,0</coordinates>
                </LinearRing>
              </outerBoundaryIs>
              <innerBoundaryIs>
                <LinearRing>
                  <coordinates>106.84,-6.22,0 106.86,-6.22,0 106.86,-6.24,0</coordinates>
                </LinearRing>
              </innerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    const result = await parseKMLFile(createKmlFile(content));

    expect(result.success).toBe(true);
    expect(result.polygons).toHaveLength(1);
    expect(result.polygons[0].coordinates).toHaveLength(4);
  });

  it('fails when file has no polygon', async () => {
    const content = `
      <kml>
        <Document>
          <Placemark><name>Tanpa polygon</name></Placemark>
        </Document>
      </kml>
    `;

    const result = await parseKMLFile(createKmlFile(content));

    expect(result.success).toBe(false);
    expect(result.coordinates).toEqual([]);
    expect(result.polygons).toEqual([]);
    expect(result.error).toContain('Tidak ada koordinat');
  });

  it('names the offending polygon when one of several is invalid', async () => {
    const content = `
      <kml>
        <Document>
          <Placemark>
            <name>Bidang A</name>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>106.8,-6.2,0 106.81,-6.21,0 106.82,-6.2,0</coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
          <Placemark>
            <name>Bidang B</name>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>106.9,-6.3,0 106.91,-6.31,0</coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    const result = await parseKMLFile(createKmlFile(content));

    expect(result.success).toBe(false);
    expect(result.error).toContain('Bidang B');
    expect(result.error).toContain('Minimal 3 titik');
  });
});

describe('parseKMZFile', () => {
  it('returns every polygon inside the archive', async () => {
    const content = `
      <kml>
        <Document>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>106.8,-6.2,0 106.81,-6.21,0 106.82,-6.2,0</coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>106.9,-6.3,0 106.91,-6.31,0 106.92,-6.3,0</coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;
    const kmz = await createKmzFile(content);
    const result = await parseKMZFile(kmz);

    expect(result.success).toBe(true);
    expect(result.polygons).toHaveLength(2);
  });
});
