import { describe, expect, it } from 'vitest';
import {
  buildDashboardSearchParams,
  parseDashboardFilters,
} from './dashboard-filters';

describe('dashboard filters helper', () => {
  it('parses defaults from empty params', () => {
    const filters = parseDashboardFilters(new URLSearchParams());

    expect(filters).toEqual({
      search: '',
      status: 'all',
      desaId: '',
      kecamatan: '',
      dateFrom: '',
      dateTo: '',
    });
  });

  it('parses and normalizes valid values', () => {
    const params = new URLSearchParams({
      search: '  Budi  ',
      status: 'SPPTG terdaftar',
      desaId: '12',
      kecamatan: 'Harjamukti',
      dateFrom: '2026-02-10',
      dateTo: '2026-01-10',
    });

    const filters = parseDashboardFilters(params);

    expect(filters).toEqual({
      search: 'Budi',
      status: 'SPPTG terdaftar',
      desaId: '12',
      kecamatan: 'Harjamukti',
      dateFrom: '2026-01-10',
      dateTo: '2026-02-10',
    });
  });

  it('clears invalid desaId and invalid dates', () => {
    const params = new URLSearchParams({
      desaId: 'abc',
      dateFrom: '2026-2-10',
      dateTo: 'not-a-date',
    });

    const filters = parseDashboardFilters(params);

    expect(filters.desaId).toBe('');
    expect(filters.dateFrom).toBe('');
    expect(filters.dateTo).toBe('');
  });

  it('builds params while removing defaults and preserving unrelated keys', () => {
    const current = new URLSearchParams({
      page: '3',
      status: 'SPPTG terdaftar',
      search: 'Old',
    });

    const next = buildDashboardSearchParams(current, {
      status: 'all',
      search: '  ',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });

    expect(next.get('page')).toBe('3');
    expect(next.get('status')).toBeNull();
    expect(next.get('search')).toBeNull();
    expect(next.get('dateFrom')).toBe('2026-01-01');
    expect(next.get('dateTo')).toBe('2026-01-31');
  });

  it('drops legacy kecamatan when desaId is explicitly set', () => {
    const current = new URLSearchParams({
      kecamatan: 'Harjamukti',
      status: 'SPPTG terdata',
    });

    const next = buildDashboardSearchParams(current, { desaId: '99' });

    expect(next.get('desaId')).toBe('99');
    expect(next.get('kecamatan')).toBeNull();
  });
});
