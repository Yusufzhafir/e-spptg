import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import { SPPTGDocument } from './SPPTGDocument';
import { totalCertificatePages } from './pagination';
import type { SPPTGPDFData } from './types';

/**
 * The certificate is rendered for real here, not just reasoned about.
 *
 * `pagination.ts` promises a page count *before* anything renders — the footer
 * prints "Halaman X dari Y" from it because react-pdf cannot count its own pages
 * in this document (see `DocumentFooter`). That promise is only worth anything if
 * the document actually comes out that long, which is what these assert: render,
 * then count the pages in the produced PDF.
 *
 * Anything that makes a page overflow onto a second sheet breaks the numbering
 * silently, and only this test would catch it. If one of these starts failing
 * after a layout change, lower the per-sheet constants in `pagination.ts` rather
 * than adjusting the expectation.
 *
 * `.test.ts` rather than `.test.tsx` on purpose — vitest only collects `.ts`
 * here, hence `createElement` instead of JSX.
 */

function coordinates(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `c-${index}`,
    latitude: 0.6 + index * 0.0005,
    longitude: 117.3 + (index % 2) * 0.0005,
  }));
}

/** Deliberately verbose: long values are what push a block onto another line. */
function saksi(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    nama: `Saksi Bernama Panjang ${index + 1}`,
    sisi: 'Utara',
    penggunaanLahanBatas: 'Sawah',
    umur: 40 + index,
    pekerjaan: 'Petani',
    alamat: `Jl. Contoh Alamat Yang Cukup Panjang No. ${index + 1}, RT 003 RW 004`,
  }));
}

function certificate(overrides: Partial<SPPTGPDFData> = {}): SPPTGPDFData {
  return {
    namaPemohon: 'Budi Santoso',
    nik: '6401010101010001',
    luasTerbilang: 'seribu dua ratus lima puluh',
    namaDesa: 'Sangatta Utara',
    kecamatan: 'Sangatta Utara',
    kabupaten: 'Kutai Timur',
    saksiList: saksi(2),
    nomorSPPTG: 'TERDAFTAR/SPPTG/001',
    tanggalPernyataan: '2026-02-07',
    coordinatesGeografis: coordinates(4),
    variant: 'terdaftar',
    ...overrides,
  };
}

async function renderedPageCount(data: SPPTGPDFData): Promise<number> {
  // `renderToBuffer` is typed for an element whose props are react-pdf's own
  // `DocumentProps`; the app hands it a wrapper component the same way
  // (`usePDFGenerator`), so the cast lives here rather than in the component.
  const element = createElement(SPPTGDocument, { data }) as Parameters<
    typeof renderToBuffer
  >[0];
  const buffer = await renderToBuffer(element);
  const pdf = await PDFDocument.load(new Uint8Array(buffer));
  return pdf.getPageCount();
}

describe('SPPTGDocument — the rendered page count matches the promised one', () => {
  it('renders a plain terdaftar certificate', async () => {
    const data = certificate();

    expect(await renderedPageCount(data)).toBe(totalCertificatePages(data));
  }, 60000);

  it('renders a terdata certificate, notice sheet and all', async () => {
    const data = certificate({
      variant: 'terdata',
      overlapStatuses: ['Kawasan Hutan'],
      namaJuruUkur: 'Surveyor A',
      jabatanJuruUkur: 'Juru Ukur Desa',
    });

    expect(await renderedPageCount(data)).toBe(totalCertificatePages(data));
  }, 60000);

  it('renders a pengajuan whose saksi overflow the signature page', async () => {
    const data = certificate({ saksiList: saksi(11) });

    expect(await renderedPageCount(data)).toBe(totalCertificatePages(data));
  }, 90000);

  it('renders several bidang with long coordinate lists', async () => {
    const data = certificate({
      polygons: [
        { nama: 'Bidang Utara', coordinates: coordinates(20) },
        { nama: 'Bidang Selatan', coordinates: coordinates(5) },
      ],
    });

    expect(await renderedPageCount(data)).toBe(totalCertificatePages(data));
  }, 90000);

  it('renders the worst case: terdata, many saksi and many bidang at once', async () => {
    const data = certificate({
      variant: 'terdata',
      overlapStatuses: ['Kawasan Hutan', 'Sempadan Sungai'],
      namaJuruUkur: 'Surveyor A',
      saksiList: saksi(9),
      polygons: [
        { nama: 'Bidang A', coordinates: coordinates(18) },
        { nama: 'Bidang B', coordinates: coordinates(17) },
      ],
    });

    expect(await renderedPageCount(data)).toBe(totalCertificatePages(data));
  }, 120000);

  it('renders a berkas with no saksi recorded at all', async () => {
    const data = certificate({ saksiList: [] });

    expect(await renderedPageCount(data)).toBe(totalCertificatePages(data));
  }, 60000);
});
