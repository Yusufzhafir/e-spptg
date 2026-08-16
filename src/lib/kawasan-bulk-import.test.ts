import {
  applyQuickFill,
  BULK_IMPORT_MAX_ROWS,
  findRowsMissingAttributes,
  groupPolygonsIntoKawasan,
  initialRowAttributeMap,
  groupToMultiPolygon,
  isImportable,
  planKawasanImportBatches,
  summarizeImportGroups,
  UNNAMED_KAWASAN_LABEL,
} from './kawasan-bulk-import';
import type { ParsedPolygon } from './kmz-parser';

/** A ring of `points` vertices, named as a feature in the file would be. */
function ring(name: string | undefined, points = 4): ParsedPolygon {
  return {
    name,
    coordinates: Array.from({ length: points }, (_, index) => ({
      id: `${name ?? 'x'}-${index}`,
      latitude: 0.1 + index * 0.001,
      longitude: 117.1 + index * 0.001,
    })),
  };
}

describe('groupPolygonsIntoKawasan', () => {
  it('makes one kawasan per name and keeps its rings as blocks', () => {
    const groups = groupPolygonsIntoKawasan([
      ring('TN Kutai'),
      ring('HP S. Santan'),
      ring('TN Kutai'),
      ring('TN Kutai'),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].nama).toBe('TN Kutai');
    expect(groups[0].blockCount).toBe(3);
    expect(groups[1].nama).toBe('HP S. Santan');
    expect(groups[1].blockCount).toBe(1);
  });

  it('keeps the file order of first appearance', () => {
    const groups = groupPolygonsIntoKawasan([ring('B'), ring('A'), ring('B')]);
    expect(groups.map((group) => group.nama)).toEqual(['B', 'A']);
  });

  it('never merges kawasan that disagree on the name', () => {
    const groups = groupPolygonsIntoKawasan([ring('HL Sangatta'), ring('HL Sangatta ')]);
    // Trimmed, so trailing whitespace is not a second kawasan…
    expect(groups).toHaveLength(1);
    // …but a genuinely different name is.
    expect(groupPolygonsIntoKawasan([ring('HL Sangatta'), ring('HL Sangata')])).toHaveLength(2);
  });

  it('collects unnamed features under one labelled group, flagged as such', () => {
    const groups = groupPolygonsIntoKawasan([ring(undefined), ring(''), ring('  ')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].nama).toBe(UNNAMED_KAWASAN_LABEL);
    expect(groups[0].isUnnamed).toBe(true);
    expect(groups[0].blockCount).toBe(3);
  });

  it('skips rings that are not a boundary at all', () => {
    const groups = groupPolygonsIntoKawasan([ring('A', 4), ring('A', 2), ring('A', 1)]);
    expect(groups[0].blockCount).toBe(1);
    expect(groups[0].pointCount).toBe(4);
  });

  it('refuses nothing for being large', () => {
    // An SK that draws one kawasan as hundreds of blocks over hundreds of
    // thousands of vertices is describing one kawasan; splitting it in QGIS
    // would file something the SK does not say.
    const groups = groupPolygonsIntoKawasan([
      ring('Sangat Besar', 450_000),
      ring('Biasa', 500),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.every(isImportable)).toBe(true);
    expect(groups.every((group) => group.blockedReason === null)).toBe(true);
  });
});

describe('planKawasanImportBatches', () => {
  it('keeps a batch under the vertex budget', () => {
    const groups = groupPolygonsIntoKawasan([
      ring('A', 30_000),
      ring('B', 30_000),
      ring('C', 30_000),
    ]);
    const batches = planKawasanImportBatches(groups, 40_000);

    expect(batches).toHaveLength(3);
    expect(batches.flat()).toHaveLength(3);
  });

  it('packs small kawasan together', () => {
    const groups = groupPolygonsIntoKawasan(
      Array.from({ length: 10 }, (_, i) => ring(`K${i}`, 100))
    );
    expect(planKawasanImportBatches(groups, 40_000)).toHaveLength(1);
  });

  it('caps rows per request even when the vertices are tiny', () => {
    const groups = groupPolygonsIntoKawasan(
      Array.from({ length: BULK_IMPORT_MAX_ROWS * 2 + 1 }, (_, i) => ring(`K${i}`, 4))
    );
    const batches = planKawasanImportBatches(groups);

    expect(batches).toHaveLength(3);
    for (const batch of batches) expect(batch.length).toBeLessThanOrEqual(BULK_IMPORT_MAX_ROWS);
  });

  it('gives a kawasan larger than the budget a batch of its own, never drops it', () => {
    const groups = groupPolygonsIntoKawasan([ring('Kecil', 100), ring('Besar', 90_000)]);
    const batches = planKawasanImportBatches(groups, 40_000);

    expect(batches.flat()).toHaveLength(2);
    expect(batches.some((batch) => batch.length === 1 && batch[0].nama === 'Besar')).toBe(true);
  });

  it('has nothing to send for an empty selection', () => {
    expect(planKawasanImportBatches([])).toEqual([]);
  });
});

describe('groupToMultiPolygon', () => {
  it('turns each block into a part and closes its ring', () => {
    const [group] = groupPolygonsIntoKawasan([ring('A', 4), ring('A', 5)]);
    const geometry = groupToMultiPolygon(group);

    expect(geometry.type).toBe('MultiPolygon');
    expect(geometry.coordinates).toHaveLength(2);

    for (const [outer] of geometry.coordinates) {
      // GeoJSON rings must close; the parsers hand back open ones.
      expect(outer[0]).toEqual(outer[outer.length - 1]);
    }
    // 4 vertices in, 5 out once closed — and lon/lat order, not lat/lon.
    expect(geometry.coordinates[0][0]).toHaveLength(5);
    expect(geometry.coordinates[0][0][0][0]).toBeCloseTo(117.1);
    expect(geometry.coordinates[0][0][0][1]).toBeCloseTo(0.1);
  });

  it('leaves an already-closed ring alone', () => {
    const closed: ParsedPolygon = {
      name: 'A',
      coordinates: [
        { id: '1', latitude: 0.1, longitude: 117.1 },
        { id: '2', latitude: 0.2, longitude: 117.2 },
        { id: '3', latitude: 0.3, longitude: 117.1 },
        { id: '4', latitude: 0.1, longitude: 117.1 },
      ],
    };
    const [group] = groupPolygonsIntoKawasan([closed]);
    expect(groupToMultiPolygon(group).coordinates[0][0]).toHaveLength(4);
  });
});

describe('per-kawasan attributes', () => {
  // Two characters minimum — the server refuses a shorter nama, so a one-letter
  // fixture would be testing the wrong thing.
  const groups = () =>
    groupPolygonsIntoKawasan([ring('TN Kutai', 10), ring('HL Sangatta', 10), ring(undefined, 10)]);

  it('starts each kawasan from its own name, never a shared one', () => {
    const rows = initialRowAttributeMap(groups());
    const [a, b, unnamed] = groups();

    expect(rows[a.key].namaKawasan).toBe('TN Kutai');
    expect(rows[b.key].namaKawasan).toBe('HL Sangatta');
    // A placeholder is not a name — left blank so the row reads as incomplete.
    expect(rows[unnamed.key].namaKawasan).toBe('');
  });

  it('seeds the rest from what the file agreed on, but never the nama', () => {
    const rows = initialRowAttributeMap(groups(), {
      namaKawasan: 'JANGAN DIPAKAI',
      dasarHukum: 'SK 397 Tahun 2025',
      tanggalEfektif: '2025-07-16',
      jenisKawasan: 'Kawasan Hutan',
    });
    const [a] = groups();

    expect(rows[a.key].dasarHukum).toBe('SK 397 Tahun 2025');
    expect(rows[a.key].tanggalEfektif).toBe('2025-07-16');
    expect(rows[a.key].jenisKawasan).toBe('Kawasan Hutan');
    // Naming every row of a bulk import identically is the mistake this whole
    // feature exists to avoid.
    expect(rows[a.key].namaKawasan).toBe('TN Kutai');
  });

  it('writes only the filled fields, leaving per-kawasan values alone', () => {
    const list = groups();
    let rows = initialRowAttributeMap(list);
    rows = applyQuickFill(rows, [list[0].key], { jenisKawasan: 'Hak Milik' });

    // Setting the tanggal for everything must not flatten the jenis that was
    // set on one kawasan individually.
    rows = applyQuickFill(
      rows,
      list.map((group) => group.key),
      { tanggalEfektif: '2025-01-01' }
    );

    expect(rows[list[0].key].jenisKawasan).toBe('Hak Milik');
    expect(rows[list[1].key].jenisKawasan).toBeUndefined();
    expect(rows[list[0].key].tanggalEfektif).toBe('2025-01-01');
    expect(rows[list[1].key].tanggalEfektif).toBe('2025-01-01');
  });

  it('ignores keys that are not in the table', () => {
    const list = groups();
    const rows = initialRowAttributeMap(list);
    expect(() => applyQuickFill(rows, ['tidak-ada'], { sumberData: 'X' })).not.toThrow();
  });
});

describe('findRowsMissingAttributes', () => {
  const list = () => groupPolygonsIntoKawasan([ring('TN Kutai', 10), ring('HL Sangatta', 10)]);

  const filled = (groups: ReturnType<typeof list>) =>
    applyQuickFill(
      initialRowAttributeMap(groups),
      groups.map((group) => group.key),
      { jenisKawasan: 'Kawasan Hutan', sumberData: 'KLHK', tanggalEfektif: '2025-07-16' }
    );

  it('names every field a kawasan still lacks', () => {
    const groups = list();
    const problems = findRowsMissingAttributes(groups, initialRowAttributeMap(groups));

    expect(problems).toHaveLength(2);
    expect(problems[0].missing).toEqual(
      expect.arrayContaining(['Jenis Kawasan', 'Sumber Data', 'Tanggal Efektif'])
    );
    // The nama came from the file, so it is not among them.
    expect(problems[0].missing).not.toContain('Nama Kawasan');
    expect(problems[0].nama).toBe('TN Kutai');
  });

  it('passes a kawasan that is fully filled in', () => {
    const groups = list();
    expect(findRowsMissingAttributes(groups, filled(groups))).toEqual([]);
  });

  it('reports an unnamed kawasan until it is given a name', () => {
    const groups = groupPolygonsIntoKawasan([ring(undefined, 10)]);
    let rows = filled(groups);
    expect(findRowsMissingAttributes(groups, rows)[0].missing).toEqual(['Nama Kawasan']);

    rows = applyQuickFill(rows, [groups[0].key], { namaKawasan: 'Kawasan Sisa Utara' });
    expect(findRowsMissingAttributes(groups, rows)).toEqual([]);
  });

  it('rejects a name too short for the server to accept', () => {
    const groups = list();
    const rows = applyQuickFill(filled(groups), [groups[0].key], { namaKawasan: 'X' });
    expect(findRowsMissingAttributes(groups, rows)[0].missing).toEqual(['Nama Kawasan']);
  });

  it('rejects an unparseable date rather than sending it', () => {
    const groups = list();
    const rows = applyQuickFill(
      filled(groups),
      groups.map((group) => group.key),
      { tanggalEfektif: 'belum ada' }
    );
    expect(findRowsMissingAttributes(groups, rows)[0].missing).toContain('Tanggal Efektif');
  });

  it('has nothing to say about a kawasan that is not selected', () => {
    const groups = list();
    expect(findRowsMissingAttributes([], initialRowAttributeMap(groups))).toEqual([]);
  });
});

describe('summarizeImportGroups', () => {
  it('separates what can be imported from what cannot', () => {
    const groups = groupPolygonsIntoKawasan([
      ring('A', 100),
      ring('B', 200),
      ring('C', 400_000),
    ]);
    const summary = summarizeImportGroups(groups);

    expect(summary.totalGroups).toBe(3);
    // Nothing is blocked on size, so every group counts as importable.
    expect(summary.importableGroups).toBe(3);
    expect(summary.blockedGroups).toBe(0);
    expect(summary.totalBlocks).toBe(3);
    expect(summary.totalPoints).toBe(400_300);
  });
});
