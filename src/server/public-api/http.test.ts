import { describe, expect, it } from 'vitest';
import { toQueryFilters } from './http';

describe('toQueryFilters', () => {
  it('always restricts to valid submissions so the API matches the app', () => {
    expect(toQueryFilters({}).onlyValid).toBe(true);
  });

  it('resolves kecamatan through villages rather than the stale free-text column', () => {
    // `submissions.kecamatan` is captured at creation time and often empty, so
    // filtering on it returned 0 for kecamatan that clearly have submissions.
    // `scopeKecamatan` joins via `villages`, which is authoritative.
    const filters = toQueryFilters({ kecamatan: 'Sangatta Utara' });
    expect(filters.scopeKecamatan).toBe('Sangatta Utara');
    expect(filters.kecamatan).toBeUndefined();
  });

  it('keeps kecamatan and desaId as separate narrowing conditions', () => {
    const filters = toQueryFilters({ kecamatan: 'Sangatta Utara', desaId: 1 });
    expect(filters.scopeKecamatan).toBe('Sangatta Utara');
    expect(filters.desaId).toBe(1);
  });

  it('maps the Indonesian date params onto the query layer names', () => {
    expect(toQueryFilters({ dari: '2026-01-01', sampai: '2026-12-31' })).toMatchObject({
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });
  });

  it('never forwards a free-text search filter', () => {
    // The app's own filter set has `search`, which matches nama pemilik and NIK.
    // It must not be reachable from this API.
    expect(toQueryFilters({}).search).toBeUndefined();
  });
});
