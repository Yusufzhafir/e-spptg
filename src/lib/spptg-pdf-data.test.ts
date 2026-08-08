import { describe, expect, it } from 'vitest';
import { buildSPPTGPDFData } from './spptg-pdf-data';
import type { SubmissionDraft } from '@/types';

function createDraftFixture(): SubmissionDraft {
  return {
    currentStep: 4,
    namaPemohon: 'Siti Aminah',
    nik: '3201010101010002',
    persetujuanData: true,
    saksiList: [
      { id: 'W-1', nama: 'Tetangga 1', sisi: 'Utara', penggunaanLahanBatas: 'Sawah' },
    ],
    coordinateSystem: 'geografis',
    coordinatesGeografis: [
      { id: 'C-1', latitude: -6.2, longitude: 107.2 },
      { id: 'C-2', latitude: -6.21, longitude: 107.21 },
      { id: 'C-3', latitude: -6.22, longitude: 107.22 },
    ],
    fotoLahan: [],
    overlapResults: [],
    luasLahan: 900,
    luasManual: 1000,
    kecamatan: 'Kecamatan Draft',
    kabupaten: 'Kabupaten Draft',
    namaKepalaDesa: 'Kades Draft',
    nomorSPPTG: '001/SPPTG/2026',
    tanggalTerbit: '2026-02-07',
  };
}

describe('buildSPPTGPDFData', () => {
  it('uses village lookup for location fields and includes map URL', () => {
    const draft = createDraftFixture();

    const pdfData = buildSPPTGPDFData(
      draft,
      {
        namaDesa: 'Desa Sumber',
        namaKepalaDesa: 'Kades Sumber',
        kecamatan: 'Kecamatan Sumber',
        kabupaten: 'Kabupaten Sumber',
      },
      {
        mapUrlGenerator: () => 'https://example.com/static-map.png',
      }
    );

    expect(pdfData.namaDesa).toBe('Desa Sumber');
    expect(pdfData.kecamatan).toBe('Kecamatan Sumber');
    expect(pdfData.kabupaten).toBe('Kabupaten Sumber');
    expect(pdfData.namaKepalaDesa).toBe('Kades Sumber');
    expect(pdfData.mapImageUrl).toBe('https://example.com/static-map.png');
    expect(pdfData.luasManual).toBe(1000);
    expect(pdfData.batasUtara).toBe('Utara');
    expect(pdfData.penggunaanBatasUtara).toBe('Sawah');
  });

  it('carries the land status and acquisition fields used by statements 2 and 4', () => {
    const draft: SubmissionDraft = {
      ...createDraftFixture(),
      statusTanah: 'Tanah Negara',
      asalPerolehan: 'jual beli dengan Bapak Ahmad',
      tahunPerolehan: 2004,
    };

    const pdfData = buildSPPTGPDFData(draft, null, { mapUrlGenerator: () => null });

    expect(pdfData.statusTanah).toBe('Tanah Negara');
    expect(pdfData.asalPerolehan).toBe('jual beli dengan Bapak Ahmad');
    expect(pdfData.tahunPerolehan).toBe(2004);
  });
});
