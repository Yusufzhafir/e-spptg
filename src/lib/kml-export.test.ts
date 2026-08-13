import {
  buildSubmissionKML,
  sanitiseFilename,
  submissionExportFilename,
  type KMLExportSubmission,
} from './kml-export';

const baseSubmission: KMLExportSubmission = {
  id: 42,
  namaPemilik: 'Budi Santoso',
  nik: '6401010101010001',
  desaNama: 'Sangatta Utara',
  desaKecamatan: 'Sangatta Utara',
  kecamatan: 'Sangatta',
  kabupaten: 'Kutai Timur',
  luas: 1250.5,
  penggunaanLahan: 'Pertanian',
  status: 'SPPTG terdaftar',
  tanggalPengajuan: new Date('2026-03-01T00:00:00.000Z'),
  geoJSON: {
    type: 'Polygon',
    coordinates: [
      [
        [117.5, 0.5],
        [117.6, 0.5],
        [117.6, 0.6],
        [117.5, 0.6],
        [117.5, 0.5],
      ],
    ],
  },
};

describe('buildSubmissionKML', () => {
  it('writes the outer ring as lng,lat,0 tuples', () => {
    const kml = buildSubmissionKML(baseSubmission);

    expect(kml).toContain(
      '<coordinates>117.5,0.5,0 117.6,0.5,0 117.6,0.6,0 117.5,0.6,0 117.5,0.5,0</coordinates>'
    );
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(kml).toContain('<outerBoundaryIs>');
  });

  it('closes an unclosed ring', () => {
    const kml = buildSubmissionKML({
      ...baseSubmission,
      geoJSON: {
        type: 'Polygon',
        coordinates: [
          [
            [117.5, 0.5],
            [117.6, 0.5],
            [117.6, 0.6],
          ],
        ],
      },
    });

    expect(kml).toContain(
      '<coordinates>117.5,0.5,0 117.6,0.5,0 117.6,0.6,0 117.5,0.5,0</coordinates>'
    );
  });

  it('carries inner rings through as holes', () => {
    const kml = buildSubmissionKML({
      ...baseSubmission,
      geoJSON: {
        type: 'Polygon',
        coordinates: [
          (baseSubmission.geoJSON!.coordinates as number[][][])[0],
          [
            [117.52, 0.52],
            [117.53, 0.52],
            [117.53, 0.53],
            [117.52, 0.52],
          ],
        ],
      },
    });

    expect(kml).toContain('<innerBoundaryIs>');
    expect(kml).toContain('117.52,0.52,0 117.53,0.52,0 117.53,0.53,0 117.52,0.52,0');
  });

  it('escapes XML metacharacters in applicant data', () => {
    const kml = buildSubmissionKML({
      ...baseSubmission,
      namaPemilik: 'Budi & <Sons>',
    });

    expect(kml).toContain('Budi &amp; &lt;Sons&gt;');
    expect(kml).not.toContain('<Sons>');
  });

  it('includes the pengajuan metadata as ExtendedData', () => {
    const kml = buildSubmissionKML(baseSubmission);

    expect(kml).toContain('<Data name="id"><value>42</value></Data>');
    expect(kml).toContain('<Data name="luas_m2"><value>1250.5</value></Data>');
    expect(kml).toContain(
      '<Data name="status"><value>SPPTG terdaftar</value></Data>'
    );
  });

  it('throws when the submission has no polygon', () => {
    expect(() => buildSubmissionKML({ ...baseSubmission, geoJSON: null })).toThrow(
      /tidak memiliki polygon/i
    );
  });

  it('throws when the ring has fewer than three points', () => {
    expect(() =>
      buildSubmissionKML({
        ...baseSubmission,
        geoJSON: {
          type: 'Polygon',
          coordinates: [
            [
              [117.5, 0.5],
              [117.6, 0.5],
            ],
          ],
        },
      })
    ).toThrow(/tidak memiliki polygon/i);
  });
});

describe('submissionExportFilename', () => {
  it('builds a filesystem-safe name', () => {
    expect(submissionExportFilename({ id: 7, namaPemilik: 'Siti Aminah' }, 'kmz')).toBe(
      'SPPTG-7-Siti-Aminah.kmz'
    );
  });

  it('strips characters filesystems reject', () => {
    expect(sanitiseFilename('A/B:C*D?"<>|')).toBe('A-B-C-D');
  });

  it('falls back when the name reduces to nothing', () => {
    expect(sanitiseFilename('///')).toBe('pengajuan');
  });
});

describe('buildSubmissionKML — pengajuan covering several bidang', () => {
  const multiBidang: KMLExportSubmission = {
    ...baseSubmission,
    geoJSON: {
      type: 'MultiPolygon',
      coordinates: [
        (baseSubmission.geoJSON!.coordinates as number[][][]),
        [
          [
            [118.1, 1.1],
            [118.2, 1.1],
            [118.2, 1.2],
            [118.1, 1.1],
          ],
        ],
      ],
    },
  };

  it('writes every bidang, wrapped in one MultiGeometry placemark', () => {
    const kml = buildSubmissionKML(multiBidang);

    expect(kml).toContain('<MultiGeometry>');
    expect(kml.match(/<Polygon>/g)).toHaveLength(2);
    expect(kml).toContain('118.1,1.1,0 118.2,1.1,0 118.2,1.2,0 118.1,1.1,0');
    // Still one feature: the pengajuan is one record wherever it is opened.
    expect(kml.match(/<Placemark>/g)).toHaveLength(1);
  });

  it('leaves a single-bidang pengajuan as a bare Polygon', () => {
    const kml = buildSubmissionKML(baseSubmission);

    expect(kml).not.toContain('<MultiGeometry>');
    expect(kml.match(/<Polygon>/g)).toHaveLength(1);
  });

  it('skips a part with too few points instead of emitting a broken ring', () => {
    const kml = buildSubmissionKML({
      ...multiBidang,
      geoJSON: {
        type: 'MultiPolygon',
        coordinates: [
          (baseSubmission.geoJSON!.coordinates as number[][][]),
          [[[118.1, 1.1], [118.2, 1.1]]],
        ],
      },
    });

    expect(kml.match(/<Polygon>/g)).toHaveLength(1);
    expect(kml).not.toContain('<MultiGeometry>');
  });

  it('still refuses a pengajuan with no usable polygon at all', () => {
    expect(() =>
      buildSubmissionKML({
        ...baseSubmission,
        geoJSON: { type: 'MultiPolygon', coordinates: [[[[117.5, 0.5]]]] },
      })
    ).toThrow(/tidak memiliki polygon/);
  });
});
