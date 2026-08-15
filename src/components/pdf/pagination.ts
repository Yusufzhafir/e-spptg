import type { GeographicCoordinate } from '@/types';
import type { SPPTGPDFData } from './types';

/**
 * Where each sheet sits in the certificate, and how many there are.
 *
 * The footer cannot count pages for itself (see `DocumentFooter`), so the layout
 * has to be fixed rather than emergent. That is also why the terdata disclosure
 * notice gets its **own** page instead of trailing the signatures: inline, it
 * fitted under one saksi but pushed onto a fifth sheet under four, and the
 * footer went on insisting "Halaman 3 dari 4" on page four of five.
 *
 * The same constraint governs everything that scales with the data — the saksi
 * blocks and the coordinate tables. Both are chunked into sheets *here*, so the
 * count is known before a single page renders. Nothing in this document may be
 * left to overflow.
 */

/** Everything the layout depends on. Deliberately narrow so callers (and tests) need not build a whole certificate. */
type LayoutLike = Pick<SPPTGPDFData, 'variant'> & {
  saksiList?: SPPTGPDFData['saksiList'];
  polygons?: SPPTGPDFData['polygons'];
  coordinatesGeografis?: GeographicCoordinate[];
};

/** One bidang as the certificate carries it. */
export type CertificatePolygon = NonNullable<SPPTGPDFData['polygons']>[number];

export const PAGE_STATEMENTS_START = 1;
export const PAGE_STATEMENTS_CONT = 2;
export const PAGE_SIGNATURES = 3;

/**
 * Saksi printed on the signature page itself.
 *
 * Four is what that page's layout holds, confirmed by rendering: each saksi
 * costs an identity block plus a signature line, and the declarant column beside
 * it is fixed. A fifth overflows the sheet — which is exactly what the footer
 * cannot survive — so saksi beyond this continue on their own sheets.
 */
export const WITNESSES_ON_SIGNATURE_PAGE = 4;

/**
 * Saksi per continuation sheet, where identity and signature sit together.
 *
 * Three, measured by rendering — a fourth pushes the sheet onto a second page.
 * `SPPTGDocument.test.ts` renders the real document and compares its page count
 * against this module; if it starts failing, lower this rather than the
 * expectation.
 */
export const WITNESSES_PER_CONTINUATION_SHEET = 3;

/**
 * Coordinate rows per attachment sheet.
 *
 * Each sheet carries the same rows twice — once as latitude/longitude and once
 * as UTM — so this is 2×10 table rows plus two headings. Rendering puts the
 * ceiling at 11; ten leaves room for a bidang heading that wraps onto a second
 * line. Lower it if either table grows a column.
 */
export const COORDINATE_ROWS_PER_SHEET = 10;

/** One continuation sheet of saksi: identity block and signature line together. */
export interface WitnessSheet {
  /** 1-based page number within the certificate. */
  page: number;
  /** Position of the first saksi within `saksiList`, for continuous numbering. */
  startIndex: number;
  witnesses: SPPTGPDFData['saksiList'];
}

/** One attachment sheet: a slice of one bidang, printed as lat/lon then UTM. */
export interface CoordinateSheet {
  /** 1-based page number within the certificate. */
  page: number;
  /** Index of the bidang this slice belongs to. */
  polygonIndex: number;
  /** Total bidang, so a sheet can say "Bidang 2 dari 3". */
  polygonCount: number;
  polygonName?: string;
  /** Position of the first row within its bidang, for continuous numbering. */
  startIndex: number;
  coordinates: GeographicCoordinate[];
}

export function isTerdataCertificate(data: Pick<SPPTGPDFData, 'variant'>): boolean {
  return data.variant === 'terdata';
}

/** The saksi whose identity and signature print on the signature page. */
export function witnessesOnSignaturePage(
  data: Pick<LayoutLike, 'saksiList'>
): SPPTGPDFData['saksiList'] {
  return (data.saksiList ?? []).slice(0, WITNESSES_ON_SIGNATURE_PAGE);
}

/**
 * The saksi that did not fit on the signature page, split into sheets.
 *
 * There is no cap on how many saksi a pengajuan may have — a plot can have a
 * witness per boundary side, and more — so the overflow is paginated rather
 * than refused or silently dropped.
 */
export function witnessSheets(data: LayoutLike): WitnessSheet[] {
  const saksiList = data.saksiList ?? [];
  const sheets: WitnessSheet[] = [];
  let page = PAGE_SIGNATURES;

  for (
    let start = WITNESSES_ON_SIGNATURE_PAGE;
    start < saksiList.length;
    start += WITNESSES_PER_CONTINUATION_SHEET
  ) {
    page += 1;
    sheets.push({
      page,
      startIndex: start,
      witnesses: saksiList.slice(start, start + WITNESSES_PER_CONTINUATION_SHEET),
    });
  }

  return sheets;
}

/** Terdata only: the disclosure notice, straight after the signatures. */
export function terdataNoticePage(data: LayoutLike): number {
  return PAGE_SIGNATURES + witnessSheets(data).length + 1;
}

/** The map attachment always follows the last signature/notice page. */
export function mapPageNumber(data: LayoutLike): number {
  return (
    PAGE_SIGNATURES +
    witnessSheets(data).length +
    (isTerdataCertificate(data) ? 2 : 1)
  );
}

/**
 * The bidang of the certificate. Falls back to the single boundary carried by
 * `coordinatesGeografis` so certificates issued before multi-bidang support
 * still print their coordinates.
 */
export function certificatePolygons(
  data: Pick<LayoutLike, 'polygons' | 'coordinatesGeografis'>
): CertificatePolygon[] {
  const polygons = (data.polygons ?? []).filter(
    (polygon) => (polygon.coordinates?.length ?? 0) > 0
  );
  if (polygons.length > 0) return polygons;

  const legacy = data.coordinatesGeografis ?? [];
  return legacy.length > 0 ? [{ coordinates: legacy }] : [];
}

/**
 * The coordinate attachment, already split into sheets. A bidang never shares a
 * sheet with another — each one starts on its own page, so the tables read as
 * one boundary at a time.
 */
export function coordinateSheets(data: LayoutLike): CoordinateSheet[] {
  const polygons = certificatePolygons(data);
  const sheets: CoordinateSheet[] = [];
  let page = mapPageNumber(data);

  polygons.forEach((polygon, polygonIndex) => {
    const coordinates = polygon.coordinates ?? [];
    for (
      let start = 0;
      start < coordinates.length;
      start += COORDINATE_ROWS_PER_SHEET
    ) {
      page += 1;
      sheets.push({
        page,
        polygonIndex,
        polygonCount: polygons.length,
        polygonName: polygon.nama,
        startIndex: start,
        coordinates: coordinates.slice(start, start + COORDINATE_ROWS_PER_SHEET),
      });
    }
  });

  return sheets;
}

export function totalCertificatePages(data: LayoutLike): number {
  return mapPageNumber(data) + coordinateSheets(data).length;
}
