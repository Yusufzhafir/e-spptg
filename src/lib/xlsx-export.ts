import JSZip from 'jszip';

/**
 * Minimal `.xlsx` writer — one sheet, strings and numbers.
 *
 * Hand-written rather than a SheetJS/ExcelJS dependency because an `.xlsx` is
 * just a zip of four small XML parts, and this project already ships JSZip for
 * KMZ parsing. That avoids adding a megabyte of library (and, for the npm build
 * of SheetJS, a standing advisory) to a public page for the sake of one export
 * button.
 *
 * What it does **not** do, deliberately: formulas, styles beyond a bold header,
 * multiple sheets, dates. Anything needing those should reach for a real
 * library rather than growing this file.
 */

export type NilaiSel = string | number | null | undefined;

export type SheetData = {
  /** Sheet name as Excel shows it; illegal characters are stripped. */
  nama: string;
  /** First row, rendered bold. */
  header: string[];
  baris: NilaiSel[][];
};

/** XML text escaping. Excel refuses to open a file with a raw `&` in it. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 0 -> A, 25 -> Z, 26 -> AA. Excel addresses columns by letter. */
export function kolomExcel(index: number): string {
  let sisa = index + 1;
  let nama = '';
  while (sisa > 0) {
    const mod = (sisa - 1) % 26;
    nama = String.fromCharCode(65 + mod) + nama;
    sisa = Math.floor((sisa - 1) / 26);
  }
  return nama;
}

function sel(ref: string, value: NilaiSel, gayaHeader: boolean): string {
  const gaya = gayaHeader ? ' s="1"' : '';
  if (value == null || value === '') return `<c r="${ref}"${gaya}/>`;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${gaya}><v>${value}</v></c>`;
  }

  // `t="inlineStr"` keeps everything in the sheet: no sharedStrings part to
  // build, and no index that can drift out of step with the rows.
  return `<c r="${ref}"${gaya} t="inlineStr"><is><t xml:space="preserve">${esc(String(value))}</t></is></c>`;
}

function sheetXml(data: SheetData): string {
  const semuaBaris = [data.header as NilaiSel[], ...data.baris];
  const rows = semuaBaris
    .map((baris, i) => {
      const nomor = i + 1;
      const sel_ = baris
        .map((nilai, kolom) => sel(`${kolomExcel(kolom)}${nomor}`, nilai, i === 0))
        .join('');
      return `<row r="${nomor}">${sel_}</row>`;
    })
    .join('');

  // Column widths are estimated from the header, which is enough to stop the
  // default width turning every label into "#####".
  const cols = data.header
    .map(
      (judul, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${Math.min(Math.max(judul.length + 6, 12), 40)}" customWidth="1"/>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`;
}

/** Excel rejects these in a sheet name, and silently truncates past 31 chars. */
function namaSheetAman(nama: string): string {
  const bersih = nama.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (bersih || 'Sheet1').slice(0, 31);
}

/**
 * Builds the workbook and returns it as a Blob ready for a download link.
 *
 * Browser-only: JSZip's `blob` type does not exist on the server.
 */
export async function buatWorkbook(data: SheetData): Promise<Blob> {
  const zip = new JSZip();
  const nama = namaSheetAman(data.nama);

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(nama)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  );

  // Two styles: index 0 is the default Excel expects to exist, index 1 is bold.
  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`
  );

  zip.file('xl/worksheets/sheet1.xml', sheetXml(data));

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
}

/** Hands the workbook to the browser as a download. */
export async function unduhWorkbook(data: SheetData, namaBerkas: string): Promise<void> {
  const blob = await buatWorkbook(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = namaBerkas.endsWith('.xlsx') ? namaBerkas : `${namaBerkas}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: revoking synchronously can cancel the download in
  // Safari before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
