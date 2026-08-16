import {
  buildGeoJSON,
  buildKML,
  GEO_EXPORT_FORMATS,
  sanitiseFilename,
  usablePolygons,
  type GeoExportFeature,
} from './geo-export';

const square: GeoExportFeature = {
  name: 'HL Sangatta',
  description: 'Jenis Kawasan: Kawasan Hutan',
  properties: {
    id: 7,
    jenisKawasan: 'Kawasan Hutan',
    dasarHukum: null,
    catatan: '',
    aktif: 'true',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [117.5, 0.5],
        [117.6, 0.5],
        [117.6, 0.6],
        [117.5, 0.5],
      ],
    ],
  },
};

describe('the three formats', () => {
  it('offers exactly geojson, kml and kmz', () => {
    expect([...GEO_EXPORT_FORMATS]).toEqual(['geojson', 'kml', 'kmz']);
  });

  it('agrees about there being nothing to export', () => {
    // The formats must not disagree: a KML that refuses and a GeoJSON that
    // happily writes an empty FeatureCollection would be the worst outcome.
    const empty: GeoExportFeature = { ...square, geometry: null };
    expect(() => buildKML([empty], { documentName: 'X' })).toThrow(/tidak ada polygon/i);
    expect(() => buildGeoJSON([empty])).toThrow(/tidak ada polygon/i);
  });
});

describe('buildKML', () => {
  it('writes lng,lat,0 tuples and closes the ring', () => {
    const kml = buildKML([square], { documentName: 'Kawasan' });
    expect(kml).toContain(
      '<coordinates>117.5,0.5,0 117.6,0.5,0 117.6,0.6,0 117.5,0.5,0</coordinates>'
    );
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
  });

  it('closes a ring the source left open', () => {
    const open: GeoExportFeature = {
      ...square,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [117.5, 0.5],
            [117.6, 0.5],
            [117.6, 0.6],
          ],
        ],
      },
    };
    const coords = buildKML([open], { documentName: 'X' });
    // First vertex repeated at the end — a KML LinearRing must close.
    expect(coords).toContain(
      '<coordinates>117.5,0.5,0 117.6,0.5,0 117.6,0.6,0 117.5,0.5,0</coordinates>'
    );
  });

  it('keeps a multi-part boundary as one feature', () => {
    const multi: GeoExportFeature = {
      ...square,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[117.5, 0.5], [117.6, 0.5], [117.6, 0.6], [117.5, 0.5]]],
          [[[118.5, 1.5], [118.6, 1.5], [118.6, 1.6], [118.5, 1.5]]],
        ],
      },
    };
    const kml = buildKML([multi], { documentName: 'X' });

    // One Placemark, two Polygons — a kawasan of forty blocks is one kawasan.
    expect(kml.match(/<Placemark>/g)).toHaveLength(1);
    expect(kml).toContain('<MultiGeometry>');
    expect(kml.match(/<Polygon>/g)).toHaveLength(2);
  });

  it('escapes XML in every value it interpolates', () => {
    const nasty: GeoExportFeature = {
      ...square,
      name: 'Hutan <Lindung> & "Cagar"',
      properties: { catatan: "O'Brien & <b>" },
    };
    const kml = buildKML([nasty], { documentName: 'A & B' });

    expect(kml).toContain('Hutan &lt;Lindung&gt; &amp; &quot;Cagar&quot;');
    expect(kml).toContain('O&apos;Brien &amp; &lt;b&gt;');
    expect(kml).not.toContain('<b>');
  });

  it('omits empty attributes rather than writing blank rows', () => {
    const kml = buildKML([square], { documentName: 'X' });
    expect(kml).toContain('<Data name="jenisKawasan">');
    // `dasarHukum: null` and `catatan: ''` say nothing and are left out.
    expect(kml).not.toContain('<Data name="dasarHukum">');
    expect(kml).not.toContain('<Data name="catatan">');
  });

  it('skips features with no boundary but keeps the ones that have it', () => {
    const kml = buildKML([{ ...square, geometry: null }, square], {
      documentName: 'X',
    });
    expect(kml.match(/<Placemark>/g)).toHaveLength(1);
  });
});

describe('buildGeoJSON', () => {
  it('writes a FeatureCollection carrying the same attributes', () => {
    const parsed = JSON.parse(buildGeoJSON([square]));

    expect(parsed.type).toBe('FeatureCollection');
    expect(parsed.features).toHaveLength(1);
    expect(parsed.features[0].properties.name).toBe('HL Sangatta');
    expect(parsed.features[0].properties.jenisKawasan).toBe('Kawasan Hutan');
    expect(parsed.features[0].geometry).toEqual(square.geometry);
    // Same omission rule as the KML side, so the two files say the same thing.
    expect(parsed.features[0].properties).not.toHaveProperty('dasarHukum');
    expect(parsed.features[0].properties).not.toHaveProperty('catatan');
  });
});

describe('usablePolygons', () => {
  it('rejects a ring that is not a boundary', () => {
    expect(
      usablePolygons({ type: 'Polygon', coordinates: [[[117.5, 0.5], [117.6, 0.5]]] })
    ).toEqual([]);
    expect(usablePolygons(null)).toEqual([]);
    expect(usablePolygons(square.geometry)).toHaveLength(1);
  });
});

describe('sanitiseFilename', () => {
  it('strips what a filesystem will not take', () => {
    expect(sanitiseFilename('HP S. Santan / Bengalon')).toBe('HP-S.-Santan-Bengalon');
    expect(sanitiseFilename('a:b*c?d"e<f>g|h')).toBe('a-b-c-d-e-f-g-h');
  });

  it('falls back rather than producing an extension-only name', () => {
    expect(sanitiseFilename('///', 'kawasan')).toBe('kawasan');
    expect(sanitiseFilename('')).toBe('export');
  });
});
