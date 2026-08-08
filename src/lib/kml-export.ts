/**
 * Export a filed pengajuan as KML / KMZ — the counterpart of the import in
 * `kmz-parser.ts`. Officials hand the boundary over to BPN, ATR or their own
 * GIS desk, and those tools read KML, so the polygon plus a readable summary of
 * the pengajuan is written into a single Placemark.
 *
 * Runs in the browser: the detail page already holds the whole submission, so
 * there is nothing for the server to do.
 */

import JSZip from 'jszip';

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
  geoJSON?: { type: 'Polygon'; coordinates: number[][][] } | null;
};

/** KML is XML — every value interpolated into it has to be escaped. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Filesystems (and Windows in particular) reject these in a filename. */
export function sanitiseFilename(value: string): string {
  return (
    value
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'pengajuan'
  );
}

export function submissionExportFilename(
  submission: Pick<KMLExportSubmission, 'id' | 'namaPemilik'>,
  extension: 'kml' | 'kmz'
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

/**
 * A KML LinearRing must be explicitly closed. Drawn polygons usually already
 * repeat the first vertex, but KML/KMZ imports and older rows do not always.
 */
function closeRing(ring: number[][]): number[][] {
  if (ring.length < 3) return ring;
  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng === lastLng && firstLat === lastLat) return ring;
  return [...ring, ring[0]];
}

/** KML orders each tuple lng,lat,altitude — the same order as GeoJSON. */
function ringToCoordinates(ring: number[][]): string {
  return closeRing(ring)
    .map(([lng, lat]) => `${lng},${lat},0`)
    .join(' ');
}

function extendedData(rows: Array<[string, string]>): string {
  const entries = rows
    .map(
      ([name, value]) =>
        `        <Data name="${escapeXml(name)}"><value>${escapeXml(value)}</value></Data>`
    )
    .join('\n');
  return `      <ExtendedData>\n${entries}\n      </ExtendedData>`;
}

/**
 * Build the KML document for one pengajuan.
 *
 * @throws when the submission has no usable polygon — there is nothing to export.
 */
export function buildSubmissionKML(submission: KMLExportSubmission): string {
  const rings = submission.geoJSON?.coordinates ?? [];
  const outerRing = rings[0];
  if (!outerRing || outerRing.length < 3) {
    throw new Error('Pengajuan ini tidak memiliki polygon batas lahan.');
  }

  const lokasi = [
    submission.desaNama ?? undefined,
    submission.desaKecamatan || submission.kecamatan || undefined,
    submission.kabupaten ?? undefined,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ');

  const name = `SPPTG #${submission.id} — ${submission.namaPemilik}`;
  const description = [
    `Nama Pemilik: ${submission.namaPemilik}`,
    submission.nik ? `NIK: ${submission.nik}` : null,
    lokasi ? `Lokasi: ${lokasi}` : null,
    `Luas: ${submission.luas.toLocaleString('id-ID')} m²`,
    submission.penggunaanLahan ? `Penggunaan Lahan: ${submission.penggunaanLahan}` : null,
    `Status: ${submission.status}`,
    `Tanggal Pengajuan: ${formatDate(submission.tanggalPengajuan)}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const data: Array<[string, string]> = [
    ['id', String(submission.id)],
    ['namaPemilik', submission.namaPemilik],
  ];
  if (submission.nik) data.push(['nik', submission.nik]);
  if (submission.desaNama) data.push(['desa', submission.desaNama]);
  const kecamatan = submission.desaKecamatan || submission.kecamatan;
  if (kecamatan) data.push(['kecamatan', kecamatan]);
  if (submission.kabupaten) data.push(['kabupaten', submission.kabupaten]);
  data.push(['luas_m2', String(submission.luas)]);
  if (submission.luasManual != null) {
    data.push(['luas_manual_m2', String(submission.luasManual)]);
  }
  if (submission.penggunaanLahan) {
    data.push(['penggunaanLahan', submission.penggunaanLahan]);
  }
  data.push(['status', submission.status]);

  // Inner rings are holes in the parcel. The app cannot draw them today, but a
  // KML import can carry them, so round-trip whatever is stored.
  const innerBoundaries = rings
    .slice(1)
    .filter((ring) => ring.length >= 3)
    .map(
      (ring) =>
        `          <innerBoundaryIs><LinearRing><coordinates>${ringToCoordinates(
          ring
        )}</coordinates></LinearRing></innerBoundaryIs>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(name)}</name>
    <description>${escapeXml(`Diekspor dari SIAPTAH — Sistem Informasi Administrasi Pertanahan`)}</description>
    <Style id="batasLahan">
      <LineStyle>
        <color>ff2563eb</color>
        <width>3</width>
      </LineStyle>
      <PolyStyle>
        <color>4d2563eb</color>
      </PolyStyle>
    </Style>
    <Placemark>
      <name>${escapeXml(name)}</name>
      <description>${escapeXml(description)}</description>
      <styleUrl>#batasLahan</styleUrl>
${extendedData(data)}
      <Polygon>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${ringToCoordinates(outerRing)}</coordinates>
          </LinearRing>
        </outerBoundaryIs>${innerBoundaries ? `\n${innerBoundaries}` : ''}
      </Polygon>
    </Placemark>
  </Document>
</kml>
`;
}

/**
 * Zip the KML into a KMZ. Google Earth expects the document at the archive
 * root and named `doc.kml`.
 */
export async function buildSubmissionKMZ(kml: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file('doc.kml', kml);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
