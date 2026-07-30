import { describe, expect, it } from 'vitest';
import { keepLatestPerCategory } from './document-list';

const doc = (id: number, category: string, uploadedAt: string) => ({
  id,
  category,
  uploadedAt,
});

describe('keepLatestPerCategory', () => {
  it('keeps only the newest feedback attachment', () => {
    const result = keepLatestPerCategory([
      doc(1, 'Lampiran Feedback', '2025-07-01T00:00:00Z'),
      doc(2, 'Lampiran Feedback', '2025-07-30T00:00:00Z'),
      doc(3, 'Lampiran Feedback', '2025-07-15T00:00:00Z'),
    ]);
    expect(result.map((d) => d.id)).toEqual([2]);
  });

  it('works whichever order the rows arrive in', () => {
    const newestFirst = keepLatestPerCategory([
      doc(2, 'Lampiran Feedback', '2025-07-30T00:00:00Z'),
      doc(1, 'Lampiran Feedback', '2025-07-01T00:00:00Z'),
    ]);
    expect(newestFirst.map((d) => d.id)).toEqual([2]);
  });

  it('keeps every Foto Lahan — that category is legitimately multiple', () => {
    const result = keepLatestPerCategory([
      doc(1, 'Foto Lahan', '2025-07-01T00:00:00Z'),
      doc(2, 'Foto Lahan', '2025-07-02T00:00:00Z'),
      doc(3, 'Foto Lahan', '2025-07-03T00:00:00Z'),
    ]);
    expect(result.map((d) => d.id)).toEqual([1, 2, 3]);
  });

  it('dedupes each single-file category independently', () => {
    const result = keepLatestPerCategory([
      doc(1, 'KTP', '2025-07-01T00:00:00Z'),
      doc(2, 'KTP', '2025-07-05T00:00:00Z'),
      doc(3, 'KK', '2025-07-02T00:00:00Z'),
      doc(4, 'Foto Lahan', '2025-07-02T00:00:00Z'),
      doc(5, 'Foto Lahan', '2025-07-03T00:00:00Z'),
    ]);
    expect(result.map((d) => d.id)).toEqual([2, 3, 4, 5]);
  });

  it('preserves the incoming order of what it keeps', () => {
    const result = keepLatestPerCategory([
      doc(9, 'KK', '2025-07-09T00:00:00Z'),
      doc(1, 'KTP', '2025-07-01T00:00:00Z'),
    ]);
    expect(result.map((d) => d.id)).toEqual([9, 1]);
  });

  it('breaks a timestamp tie on the later insert', () => {
    const sameSecond = '2025-07-30T10:00:00Z';
    const result = keepLatestPerCategory([
      doc(7, 'Lampiran Feedback', sameSecond),
      doc(8, 'Lampiran Feedback', sameSecond),
    ]);
    expect(result.map((d) => d.id)).toEqual([8]);
  });

  it('prefers a real timestamp over an unparseable one', () => {
    const result = keepLatestPerCategory([
      doc(1, 'KTP', 'not-a-date'),
      doc(2, 'KTP', '2025-01-01T00:00:00Z'),
    ]);
    expect(result.map((d) => d.id)).toEqual([2]);
  });

  it('accepts Date objects as well as strings', () => {
    const result = keepLatestPerCategory([
      { id: 1, category: 'KTP', uploadedAt: new Date('2025-07-01T00:00:00Z') },
      { id: 2, category: 'KTP', uploadedAt: new Date('2025-07-02T00:00:00Z') },
    ]);
    expect(result.map((d) => d.id)).toEqual([2]);
  });

  it('returns an empty list unchanged', () => {
    expect(keepLatestPerCategory([])).toEqual([]);
  });
});
