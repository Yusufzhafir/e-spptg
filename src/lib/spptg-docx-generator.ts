/**
 * SPPTG DOCX Generator
 *
 * Builds a filled "Surat Pernyataan Penguasaan Tanah Garapan" as a .docx file,
 * mirroring the react-pdf certificate content (see src/components/pdf/*).
 * Runs in the browser; returns a Blob via docx's Packer.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from 'docx';
import type { SPPTGPDFData } from '@/components/pdf/types';

const FONT = 'Times New Roman';
const SIZE = 24; // 12pt in half-points

function formatIndonesianDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatLuas(luas?: number): string {
  if (luas === undefined || luas === null) return '-';
  return `${luas.toLocaleString('id-ID')} m²`;
}

function text(value: string, opts: { bold?: boolean } = {}): TextRun {
  return new TextRun({ text: value, bold: opts.bold, font: FONT, size: SIZE });
}

function para(
  children: TextRun[],
  opts: { alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number; indentLeft?: number } = {}
): Paragraph {
  return new Paragraph({
    children,
    alignment: opts.alignment,
    spacing: { after: opts.spacingAfter ?? 120, line: 276 },
    indent: opts.indentLeft ? { left: opts.indentLeft } : undefined,
  });
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

/** Borderless label : value rows, aligned via a 3-column table. */
function fieldRows(rows: Array<{ label: string; value?: string }>, indent = 0): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    indent: indent ? { size: indent, type: WidthType.DXA } : undefined,
    rows: rows.map(
      (r) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 38, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              children: [para([text(r.label)], { spacingAfter: 0 })],
            }),
            new TableCell({
              width: { size: 4, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              children: [para([text(':')], { spacingAfter: 0 })],
            }),
            new TableCell({
              width: { size: 58, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              children: [para([text(r.value || '-')], { spacingAfter: 0 })],
            }),
          ],
        })
    ),
  });
}

/** Numbered statement: "n. <text>" laid out with a hanging indent. */
function statement(number: string, runs: TextRun[]): Paragraph {
  return new Paragraph({
    children: [text(`${number} `), ...runs],
    spacing: { after: 120, line: 276 },
    indent: { left: 360, hanging: 360 },
  });
}

function subStatement(letter: string, runs: TextRun[]): Paragraph {
  return new Paragraph({
    children: [text(`${letter}. `), ...runs],
    spacing: { after: 60, line: 276 },
    indent: { left: 720, hanging: 360 },
  });
}

function boundaryRows(data: SPPTGPDFData): Array<{ label: string; value?: string }> {
  const pairs: Array<[string | undefined, string | undefined]> = [
    [data.batasUtara, data.penggunaanBatasUtara],
    [data.batasTimurLaut, data.penggunaanBatasTimurLaut],
    [data.batasTimur, data.penggunaanBatasTimur],
    [data.batasTenggara, data.penggunaanBatasTenggara],
    [data.batasSelatan, data.penggunaanBatasSelatan],
    [data.batasBaratDaya, data.penggunaanBatasBaratDaya],
    [data.batasBarat, data.penggunaanBatasBarat],
    [data.batasBaratLaut, data.penggunaanBatasBaratLaut],
  ];
  return pairs
    .filter(([sisi]) => Boolean(sisi))
    .map(([sisi, penggunaan]) => ({ label: sisi as string, value: penggunaan }));
}

function witnessesTable(data: SPPTGPDFData): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' } as const;
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const headerCell = (label: string) =>
    new TableCell({
      borders: cellBorders,
      children: [para([text(label, { bold: true })], { alignment: AlignmentType.CENTER, spacingAfter: 0 })],
    });

  const header = new TableRow({
    tableHeader: true,
    children: [headerCell('No.'), headerCell('Nama Saksi'), headerCell('Sisi Batas'), headerCell('Penggunaan Batas')],
  });

  const rows =
    data.saksiList.length > 0
      ? data.saksiList.map(
          (w, i) =>
            new TableRow({
              children: [
                new TableCell({ borders: cellBorders, children: [para([text(String(i + 1))], { alignment: AlignmentType.CENTER, spacingAfter: 0 })] }),
                new TableCell({ borders: cellBorders, children: [para([text(w.nama || '-')], { spacingAfter: 0 })] }),
                new TableCell({ borders: cellBorders, children: [para([text(w.sisi || '-')], { spacingAfter: 0 })] }),
                new TableCell({ borders: cellBorders, children: [para([text(w.penggunaanLahanBatas || '-')], { spacingAfter: 0 })] }),
              ],
            })
        )
      : [
          new TableRow({
            children: [
              new TableCell({ borders: cellBorders, columnSpan: 4, children: [para([text('Tidak ada saksi batas')], { alignment: AlignmentType.CENTER, spacingAfter: 0 })] }),
            ],
          }),
        ];

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] });
}

export function buildSPPTGDocx(data: SPPTGPDFData): Document {
  const formattedDate = formatIndonesianDate(data.tanggalPernyataan);
  const declarationLocation = [data.namaDesa, data.kecamatan].filter(Boolean).join(', ');
  const tempatTanggalLahir = [data.tempatLahir, formatIndonesianDate(data.tanggalLahir)]
    .filter(Boolean)
    .join(', ');

  const children: ISectionOptions['children'] = [
    para([text(data.nomorSPPTG || '')], { alignment: AlignmentType.RIGHT, spacingAfter: 120 }),
    para([text('SURAT PERNYATAAN PENGUASAAN TANAH GARAPAN', { bold: true })], {
      alignment: AlignmentType.CENTER,
      spacingAfter: 240,
    }),
    para([text('Saya yang bertanda tangan di bawah ini:')], { spacingAfter: 120 }),
    fieldRows([
      { label: 'Nama', value: data.namaPemohon },
      { label: 'NIK', value: data.nik },
      { label: 'Tempat/Tanggal Lahir', value: tempatTanggalLahir },
      { label: 'Pekerjaan', value: data.pekerjaan },
      { label: 'Alamat', value: data.alamatKTP },
    ]),
    para([text('Dengan ini menyatakan hal-hal sebagai berikut:')], { spacingAfter: 120 }),

    statement('1.', [
      text('Bahwa saya ada menguasai sebidang tanah seluas '),
      text(formatLuas(data.luasManual), { bold: true }),
      text(` (${data.luasTerbilang}), dengan data fisik sebagai berikut:`),
    ]),
    subStatement('a', [text('Letak tanah berada di lokasi berikut:')]),
    fieldRows(
      [
        { label: 'Jalan', value: data.namaJalan },
        { label: 'Gang', value: data.namaGang },
        { label: 'Nomor persil', value: data.nomorPersil },
        { label: 'RT / RW', value: data.rtrw },
        { label: 'Dusun', value: data.dusun },
        { label: 'Kelurahan/Desa', value: data.namaDesa },
        { label: 'Kecamatan', value: data.kecamatan },
        { label: 'Kabupaten', value: data.kabupaten },
      ],
      720
    ),
    subStatement('b', [text('Ukuran tanah dengan spesifikasi berikut:')]),
    fieldRows(
      [
        { label: 'Luas pengukuran', value: formatLuas(data.luasManual) },
        { label: 'Luas perhitungan peta', value: formatLuas(data.luasLahan) },
        ...boundaryRows(data),
      ],
      720
    ),
    subStatement('c', [text(`Penggunaan lahan: ${data.penggunaanLahan || '-'}`)]),
    subStatement('d', [text('Peta lokasi tanah: terlampir')]),

    statement('2.', [
      text('Lahan tersebut telah saya kuasai, saya gunakan dan saya pelihara secara terus menerus sejak '),
      text(String(data.tahunAwalGarap || '-'), { bold: true }),
      text(' sampai dengan sekarang.'),
    ]),
    statement('3.', [
      text(
        'Lahan tersebut telah saya pasangi patok/pal batas pada bagian batas sudut-sudut dan telah mendapat persetujuan dari semua pihak yang berbatasan, di mana mereka membubuhkan tanda tangan pada surat pernyataan ini.'
      ),
    ]),
    statement('4.', [
      text(
        'Lahan tersebut baik sebagian atau keseluruhan tidak ada sengketa / gugatan / tuntutan baik dengan orang, badan hukum, pemerintah, dan/atau pihak lainnya.'
      ),
    ]),
    statement('5.', [
      text(
        'Berkenaan di kemudian hari diketahui bahwa lahan yang saya kuasai sebagaimana diuraikan pada angka 1 (satu) berada dalam kawasan yang peruntukannya tidak sesuai dengan pengelolaan / penguasaan saya maka saya bersedia mengajukan permohonan, mengurus dan menyesuaikan pengelolaan hak atas lahan saya sesuai dengan ketentuan peraturan yang berlaku.'
      ),
    ]),

    para(
      [
        text(
          'Demikian Surat Pernyataan ini saya buat dalam keadaan sadar dan tanpa paksaan dari pihak manapun. Apabila di kemudian hari terbukti pernyataan saya ini tidak benar maka saya bersedia dituntut sesuai ketentuan perundang-undangan yang berlaku.'
        ),
      ],
      { spacingAfter: 240 }
    ),

    para(
      [
        text('Dibuat di '),
        text(declarationLocation || '-', { bold: true }),
        text(' pada tanggal '),
        text(formattedDate || '-', { bold: true }),
      ],
      { alignment: AlignmentType.RIGHT, spacingAfter: 240 }
    ),
    para([text('Yang membuat pernyataan')], { alignment: AlignmentType.RIGHT, spacingAfter: 0 }),
    para([text('(Meterai Rp10.000)')], { alignment: AlignmentType.RIGHT, spacingAfter: 480 }),
    para([text(data.namaPemohon || '-', { bold: true })], { alignment: AlignmentType.RIGHT, spacingAfter: 360 }),

    para([text('Saksi-saksi batas', { bold: true })], { spacingAfter: 120 }),
    witnessesTable(data),

    para([text('Mengetahui,')], { spacingAfter: 0 }),
    para([text(`Kepala Desa ${data.namaDesa || '-'}`)], { spacingAfter: 480 }),
    para([text(data.namaKepalaDesa || '-', { bold: true })], { spacingAfter: 240 }),

    fieldRows([
      { label: 'Nomor Registrasi', value: data.nomorSPPTG },
      { label: 'Tanggal', value: formattedDate },
    ]),
  ];

  return new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE } },
      },
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

/** Build and package the SPPTG certificate as a downloadable .docx Blob. */
export async function generateSPPTGDocxBlob(data: SPPTGPDFData): Promise<Blob> {
  const doc = buildSPPTGDocx(data);
  return Packer.toBlob(doc);
}
