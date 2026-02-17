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

  it('fails when file contains more than one polygon total', async () => {
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

    const result = await parseKMLFile(createKmlFile(content));

    expect(result.success).toBe(false);
    expect(result.coordinates).toEqual([]);
    expect(result.error).toContain('tepat 1 polygon');
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
    expect(result.error).toContain('tepat 1 polygon');
  });
});

describe('parseKMZFile', () => {
  it('rejects KMZ with more than one polygon', async () => {
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

    expect(result.success).toBe(false);
    expect(result.coordinates).toEqual([]);
    expect(result.error).toContain('tepat 1 polygon');
  });
});
