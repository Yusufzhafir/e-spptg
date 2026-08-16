/**
 * Export a filed pengajuan as GeoJSON / KML / KMZ — the counterpart of the
 * import in `kmz-parser.ts`. Officials hand the boundary over to BPN, ATR or
 * their own GIS desk, and those tools read these formats, so the polygon plus a
 * readable summary of the pengajuan is written into a single feature.
 *
 * The envelopes themselves live in `geo-export.ts`, shared with the kawasan
 * download: this module owns only what is specific to a pengajuan — which
 * fields go into the description and the attribute table, and what the file is
 * called. Runs in the browser: the detail page already holds the whole
 * submission, so there is nothing for the server to do.
 */

import {
  buildGeoExport,
  buildKML,
  buildKMZ,
  sanitiseFilename as sanitiseGeoFilename,
  usablePolygons,
  type GeoExportFeature,
  type GeoExportFormat,
} from './geo-export';
import type { SubmissionGeometry } from '@/types';

export type KMLExportSubmission = {
  id: number;
  namaPemilik: string;
  nik?: string | null;
  desaNama?: string | null;
  /** The desa's kecamatan; falls back to the free-text column when absent. */
  desaKecamatan?: string | null;
  kecamatan?: string | null;
  kabupaten?: string | null;
  luas: number;
  luasManual?: number | null;
  penggunaanLahan?: string | null;
  status: string;
  tanggalPengajuan: Date | string;
  /**
  * Polygon or MultiPolygon — a pengajuan may cover several separated bidang.
  */
  geoJSON?: SubmissionGeometry | null;
};

/** Re-exported so callers keep one import for the whole export path. */
export function sanitiseFilename(value: string): string {
  return sanitiseGeoFilename(value, 'pengajuan');
}

export function submissionExportFilename(
  submission: Pick<KMLExportSubmission, 'id' | 'namaPemilik'>,
  extension: GeoExportFormat
): string {
  return `SPPTG-${submission.id}-${sanitiseFilename(submission.namaPemilik)}.${extension}`;
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** The pengajuan as one export feature — name, blurb and attribute table. */
export function submissionExportFeature(
  submission: KMLExportSubmission
): GeoExportFeature {
  const lokasi = [
    submission.desaNama ?? undefined,
    submission.desaKecamatan || submission.kecamatan || undefined,
    submission.kabupaten ?? undefined,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ');

  const kecamatan = submission.desaKecamatan || submission.kecamatan;

  return {
    name: `SPPTG #${submission.id} — ${submission.namaPemilik}`,
    description: [
      `Nama Pemilik: ${submission.namaPemilik}`,
      submission.nik ? `NIK: ${submission.nik}` : null,
      lokasi ? `Lokasi: ${lokasi}` : null,
      `Luas: ${submission.luas.toLocaleString('id-ID')} m²`,
      submission.penggunaanLahan ? `Penggunaan Lahan: ${submission.penggunaanLahan}` : null,
      `Status: ${submission.status}`,
      `Tanggal Pengajuan: ${formatDate(submission.tanggalPengajuan)}`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
    properties: {
      id: submission.id,
      namaPemilik: submission.namaPemilik,
      nik: submission.nik,
      desa: submission.desaNama,
      kecamatan,
      kabupaten: submission.kabupaten,
      luas_m2: submission.luas,
      luas_manual_m2: submission.luasManual,
      penggunaanLahan: submission.penggunaanLahan,
      status: submission.status,
    },
    geometry: submission.geoJSON,
  };
}

/**
 * Refuse a pengajuan with nothing to export, in this screen's own words.
 *
 * The shared builders throw a generic message because they do not know what
 * they were handed; on the detail page the reader knows exactly which berkas
 * they pressed the button for, and "pengajuan ini tidak memiliki polygon batas
 * lahan" tells them what to fix.
 */
function assertHasPolygon(submission: KMLExportSubmission): void {
  if (usablePolygons(submission.geoJSON).length === 0) {
    throw new Error('Pengajuan ini tidak memiliki polygon batas lahan.');
  }
}

/**
 * Build the KML document for one pengajuan.
 *
 * @throws when the submission has no usable polygon — there is nothing to export.
 */
export function buildSubmissionKML(submission: KMLExportSubmission): string {
  assertHasPolygon(submission);
  return buildKML([submissionExportFeature(submission)], {
    documentName: `SPPTG #${submission.id} — ${submission.namaPemilik}`,
  });
}

/** The pengajuan's boundary in whichever format was asked for. */
export async function buildSubmissionExport(
  submission: KMLExportSubmission,
  format: GeoExportFormat
): Promise<Blob> {
  assertHasPolygon(submission);
  return buildGeoExport([submissionExportFeature(submission)], format, {
    documentName: `SPPTG #${submission.id} — ${submission.namaPemilik}`,
  });
}

/**
 * Zip the KML into a KMZ. Kept as a named export because the detail page has
 * always called it directly; `buildKMZ` is the shared implementation.
 */
export async function buildSubmissionKMZ(kml: string): Promise<Blob> {
  return buildKMZ(kml);
}
