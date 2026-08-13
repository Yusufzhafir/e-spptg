import JSZip from 'jszip';
import { buatWorkbook, kolomExcel } from './xlsx-export';

describe('kolomExcel', () => {
  it('numbers columns the way Excel addresses them', () => {
    expect(kolomExcel(0)).toBe('A');
    expect(kolomExcel(25)).toBe('Z');
    expect(kolomExcel(26)).toBe('AA');
    expect(kolomExcel(27)).toBe('AB');
    expect(kolomExcel(51)).toBe('AZ');
    expect(kolomExcel(52)).toBe('BA');
  });
});

describe('buatWorkbook', () => {
  const data = {
    nama: 'SPPTG per Desa',
    header: ['Desa/Kelurahan', 'Kecamatan', 'Berkas', 'Luas (ha)'],
    baris: [
      ['Teluk Lingga', 'Sangatta Utara', 12, 14.5],
      ['Singa Geweh & Co', 'Sangatta Selatan', 8, 9.25],
    ],
  };

  async function bacaSheet() {
    const blob = await buatWorkbook(data);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    return zip;
  }

  it('writes every part Excel requires to open the file', async () => {
    const zip = await bacaSheet();
    for (const part of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]) {
      expect(zip.file(part), `bagian ${part} hilang`).not.toBeNull();
    }
  });

  it('writes numbers as numbers and text as inline strings', async () => {
    const zip = await bacaSheet();
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');

    // Row 2 is the first data row: A2 text, C2 numeric.
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Teluk Lingga</t></is></c>');
    expect(sheet).toContain('<c r="C2"><v>12</v></c>');
    expect(sheet).toContain('<c r="D2"><v>14.5</v></c>');
  });

  it('escapes XML so an ampersand in a desa name cannot corrupt the file', async () => {
    const zip = await bacaSheet();
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('Singa Geweh &amp; Co');
    expect(sheet).not.toContain('Singa Geweh & Co');
  });

  it('marks the header row bold and keeps it first', async () => {
    const zip = await bacaSheet();
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Desa/Kelurahan</t></is></c>');
  });

  it('sanitises a sheet name Excel would reject', async () => {
    const blob = await buatWorkbook({ ...data, nama: 'Rekap/2026*[uji]' });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const workbook = await zip.file('xl/workbook.xml')!.async('string');
    expect(workbook).toContain('name="Rekap 2026  uji"');
  });
});
