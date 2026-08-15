import { describe, expect, it } from 'vitest';
import {
  COORDINATE_ROWS_PER_SHEET,
  PAGE_SIGNATURES,
  WITNESSES_ON_SIGNATURE_PAGE,
  WITNESSES_PER_CONTINUATION_SHEET,
  certificatePolygons,
  coordinateSheets,
  mapPageNumber,
  terdataNoticePage,
  totalCertificatePages,
  witnessSheets,
  witnessesOnSignaturePage,
} from './pagination';
import type { GeographicCoordinate } from '@/types';

function points(count: number, offset = 0): GeographicCoordinate[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `c-${offset}-${index}`,
    latitude: offset + index * 0.001,
    longitude: 117 + offset,
  }));
}

const base = { variant: 'terdaftar' as const, coordinatesGeografis: points(3) };

describe('certificatePolygons', () => {
  it('falls back to the legacy single boundary', () => {
    expect(certificatePolygons(base)).toEqual([{ coordinates: base.coordinatesGeografis }]);
  });

  it('prefers the polygon list, ignoring empty entries', () => {
    const polygons = certificatePolygons({
      coordinatesGeografis: points(3),
      polygons: [
        { nama: 'Bidang A', coordinates: points(4, 1) },
        { coordinates: [] },
        { nama: 'Bidang B', coordinates: points(5, 2) },
      ],
    });

    expect(polygons.map((polygon) => polygon.nama)).toEqual(['Bidang A', 'Bidang B']);
  });
});

describe('coordinateSheets', () => {
  it('starts each bidang on its own sheet, numbered after the map page', () => {
    const data = {
      variant: 'terdaftar' as const,
      coordinatesGeografis: points(3),
      polygons: [{ coordinates: points(3) }, { coordinates: points(3, 1) }],
    };
    const sheets = coordinateSheets(data);

    expect(sheets.map((sheet) => sheet.page)).toEqual([
      mapPageNumber(data) + 1,
      mapPageNumber(data) + 2,
    ]);
    expect(sheets.map((sheet) => sheet.polygonIndex)).toEqual([0, 1]);
    expect(sheets.every((sheet) => sheet.polygonCount === 2)).toBe(true);
  });

  it('splits a long boundary across sheets with continuous numbering', () => {
    const total = COORDINATE_ROWS_PER_SHEET + 3;
    const sheets = coordinateSheets({
      variant: 'terdaftar',
      coordinatesGeografis: points(total),
    });

    expect(sheets).toHaveLength(2);
    expect(sheets[0].coordinates).toHaveLength(COORDINATE_ROWS_PER_SHEET);
    expect(sheets[0].startIndex).toBe(0);
    expect(sheets[1].coordinates).toHaveLength(3);
    expect(sheets[1].startIndex).toBe(COORDINATE_ROWS_PER_SHEET);
  });

  it('leaves the terdata notice its own page before the attachments', () => {
    const data = { variant: 'terdata' as const, coordinatesGeografis: points(3) };

    expect(mapPageNumber(data)).toBe(5);
    expect(coordinateSheets(data)[0].page).toBe(6);
  });
});

describe('totalCertificatePages', () => {
  it('counts the attachment sheets the document actually renders', () => {
    const data = {
      variant: 'terdaftar' as const,
      coordinatesGeografis: points(3),
      polygons: [{ coordinates: points(3) }, { coordinates: points(3, 1) }],
    };

    // 3 statement/signature pages + map + one sheet per bidang.
    expect(totalCertificatePages(data)).toBe(6);
    expect(totalCertificatePages(data)).toBe(
      mapPageNumber(data) + coordinateSheets(data).length
    );
  });

  it('still counts a certificate with no coordinates at all', () => {
    expect(totalCertificatePages({ variant: 'terdaftar', coordinatesGeografis: [] })).toBe(4);
    expect(totalCertificatePages({ variant: 'terdata', coordinatesGeografis: [] })).toBe(5);
  });
});

function saksi(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    nama: `Saksi ${index + 1}`,
    sisi: 'Utara',
  }));
}

describe('witness pagination', () => {
  it('keeps a certificate with few saksi on exactly the pages it always had', () => {
    const data = {
      variant: 'terdaftar' as const,
      coordinatesGeografis: points(3),
      saksiList: saksi(WITNESSES_ON_SIGNATURE_PAGE),
    };

    expect(witnessSheets(data)).toEqual([]);
    expect(mapPageNumber(data)).toBe(4);
    // 3 statement/signature pages + map + one coordinate sheet.
    expect(totalCertificatePages(data)).toBe(5);
  });

  it('moves the overflow onto continuation sheets right after the signatures', () => {
    const data = {
      variant: 'terdaftar' as const,
      coordinatesGeografis: points(3),
      saksiList: saksi(WITNESSES_ON_SIGNATURE_PAGE + 1),
    };
    const sheets = witnessSheets(data);

    expect(sheets).toHaveLength(1);
    expect(sheets[0].page).toBe(PAGE_SIGNATURES + 1);
    expect(sheets[0].startIndex).toBe(WITNESSES_ON_SIGNATURE_PAGE);
    expect(sheets[0].witnesses).toHaveLength(1);
    // Everything after the signatures shifts down by the sheets added.
    expect(mapPageNumber(data)).toBe(5);
  });

  it('splits a long saksi list across as many sheets as it needs', () => {
    const total =
      WITNESSES_ON_SIGNATURE_PAGE + WITNESSES_PER_CONTINUATION_SHEET + 1;
    const data = {
      variant: 'terdaftar' as const,
      coordinatesGeografis: points(3),
      saksiList: saksi(total),
    };
    const sheets = witnessSheets(data);

    expect(sheets).toHaveLength(2);
    expect(sheets.map((sheet) => sheet.page)).toEqual([4, 5]);
    // Numbering runs on from the signature page, never restarting at 1.
    expect(sheets[1].startIndex).toBe(
      WITNESSES_ON_SIGNATURE_PAGE + WITNESSES_PER_CONTINUATION_SHEET
    );
    // Every saksi is printed exactly once, across the page and the sheets.
    const printed =
      witnessesOnSignaturePage(data).length +
      sheets.reduce((sum, sheet) => sum + sheet.witnesses.length, 0);
    expect(printed).toBe(total);
  });

  it('pushes the terdata notice, map and coordinates down together', () => {
    const data = {
      variant: 'terdata' as const,
      coordinatesGeografis: points(3),
      saksiList: saksi(WITNESSES_ON_SIGNATURE_PAGE + 1),
    };

    // 1-3 statements/signatures, 4 saksi continuation, 5 notice, 6 map, 7 coords.
    expect(terdataNoticePage(data)).toBe(5);
    expect(mapPageNumber(data)).toBe(6);
    expect(coordinateSheets(data)[0].page).toBe(7);
    expect(totalCertificatePages(data)).toBe(7);
  });

  it('never numbers a page beyond the total it reports', () => {
    const data = {
      variant: 'terdata' as const,
      coordinatesGeografis: points(COORDINATE_ROWS_PER_SHEET + 1),
      // The worst case: overflowing saksi, a notice sheet, several bidang and a
      // boundary that outgrows one coordinate sheet, all at once.
      polygons: [
        { nama: 'Bidang A', coordinates: points(COORDINATE_ROWS_PER_SHEET + 1) },
        { nama: 'Bidang B', coordinates: points(3, 1) },
      ],
      saksiList: saksi(11),
    };
    const total = totalCertificatePages(data);
    const pages = [
      ...witnessSheets(data).map((sheet) => sheet.page),
      terdataNoticePage(data),
      mapPageNumber(data),
      ...coordinateSheets(data).map((sheet) => sheet.page),
    ];

    expect(Math.max(...pages)).toBe(total);
    // No page number is issued twice, and none is skipped.
    expect(pages).toEqual([...new Set(pages)].sort((a, b) => a - b));
    expect(pages).toEqual(
      Array.from({ length: total - PAGE_SIGNATURES }, (_, i) => PAGE_SIGNATURES + 1 + i)
    );
  });
});
