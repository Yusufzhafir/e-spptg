import { describe, expect, it } from 'vitest';
import { buildSPPTGPDFData, buildWitnessSlots } from './spptg-pdf-data';
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

describe('buildWitnessSlots', () => {
  const saksi = (nama: string) => ({ nama });

  it('prints exactly one block for a single saksi — no empty second slot', () => {
    expect(buildWitnessSlots([saksi('Tetangga 1')])).toEqual([saksi('Tetangga 1')]);
  });

  it.each([2, 3, 4, 9])('prints one block per saksi for %i of them', (count) => {
    const list = Array.from({ length: count }, (_, i) => saksi(`Tetangga ${i + 1}`));

    expect(buildWitnessSlots(list)).toHaveLength(count);
    expect(buildWitnessSlots(list)).toEqual(list);
  });

  it('never truncates — there is no cap on saksi', () => {
    const list = Array.from({ length: 12 }, (_, i) => saksi(`Tetangga ${i + 1}`));

    expect(buildWitnessSlots(list)).toEqual(list);
  });

  it('falls back to one blank slot rather than an empty heading', () => {
    expect(buildWitnessSlots([])).toEqual([undefined]);
    expect(buildWitnessSlots(undefined)).toEqual([undefined]);
  });
});

describe('buildSPPTGPDFData — certificate variant', () => {
  it('marks a terdaftar berkas and carries no checklist', () => {
    const draft = { ...createDraftFixture(), status: 'SPPTG terdaftar' as const };
    const pdfData = buildSPPTGPDFData(draft, null);

    expect(pdfData.variant).toBe('terdaftar');
    expect(pdfData.overlapStatuses).toBeUndefined();
  });

  it('ticks the kawasan a terdata berkas overlaps, and names the juru ukur', () => {
    // The whole chain the notice depends on: status picks the variant, the
    // overlap snapshot picks the ticks, and the surveyor signs it.
    const draft: SubmissionDraft = {
      ...createDraftFixture(),
      status: 'SPPTG terdata',
      juruUkur: { nama: 'Rina Kartika', jabatan: 'Juru Ukur', nomorHP: '081234567890' },
      overlapResults: [
        { kawasanId: 1, namaKawasan: 'Hutan A', jenisKawasan: 'Kawasan Hutan', sumber: 'ProhibitedArea', luasOverlap: 120 },
        { kawasanId: 2, namaKawasan: 'Aset Pemda', jenisKawasan: 'Tanah Pemerintah', sumber: 'ProhibitedArea', luasOverlap: 40 },
      ],
    } as unknown as SubmissionDraft;

    const pdfData = buildSPPTGPDFData(draft, null);

    expect(pdfData.variant).toBe('terdata');
    expect(pdfData.overlapStatuses).toEqual(['Kawasan Hutan', 'Tanah Pemerintah']);
    expect(pdfData.namaJuruUkur).toBe('Rina Kartika');
    expect(pdfData.jabatanJuruUkur).toBe('Juru Ukur');
  });

  it('still ticks when the snapshot holds a jenis recorded before the rename', () => {
    const draft = {
      ...createDraftFixture(),
      status: 'SPPTG terdata',
      overlapResults: [
        { kawasanId: 1, namaKawasan: 'hutan', jenisKawasan: 'Hutan Lindung', sumber: 'ProhibitedArea', luasOverlap: 120 },
      ],
    } as unknown as SubmissionDraft;

    expect(buildSPPTGPDFData(draft, null).overlapStatuses).toEqual(['Kawasan Hutan']);
  });

  it('never ticks a clash with another pengajuan — that blocks issuance instead', () => {
    const draft = {
      ...createDraftFixture(),
      status: 'SPPTG terdata',
      overlapResults: [
        { kawasanId: 9, namaKawasan: 'Budi', jenisKawasan: 'SPPTG terdaftar', sumber: 'Submission', luasOverlap: 500 },
      ],
    } as unknown as SubmissionDraft;

    expect(buildSPPTGPDFData(draft, null).overlapStatuses).toEqual([]);
  });
});

describe('buildSPPTGPDFData — pengajuan covering several bidang', () => {
  const secondBidang = [
    { id: 'D-1', latitude: -6.4, longitude: 107.4 },
    { id: 'D-2', latitude: -6.41, longitude: 107.41 },
    { id: 'D-3', latitude: -6.42, longitude: 107.42 },
  ];

  it('carries every bidang onto the certificate, named where the KML named it', () => {
    const draft: SubmissionDraft = {
      ...createDraftFixture(),
      polygons: [
        { id: 'P-1', nama: 'Bidang Utara', coordinates: createDraftFixture().coordinatesGeografis },
        { id: 'P-2', coordinates: secondBidang },
      ],
    };

    const data = buildSPPTGPDFData(draft, null, { mapUrlGenerator: () => 'https://map' });

    expect(data.polygons).toHaveLength(2);
    expect(data.polygons?.[0].nama).toBe('Bidang Utara');
    expect(data.polygons?.[1].coordinates).toHaveLength(3);
  });

  it('mirrors the first bidang into coordinatesGeografis for older readers', () => {
    const draft: SubmissionDraft = {
      ...createDraftFixture(),
      polygons: [
        { id: 'P-1', coordinates: secondBidang },
        { id: 'P-2', coordinates: createDraftFixture().coordinatesGeografis },
      ],
    };

    const data = buildSPPTGPDFData(draft, null, { mapUrlGenerator: () => 'https://map' });

    expect(data.coordinatesGeografis).toEqual(secondBidang);
  });

  it('drops a bidang that is not yet a polygon', () => {
    const draft: SubmissionDraft = {
      ...createDraftFixture(),
      polygons: [
        { id: 'P-1', coordinates: createDraftFixture().coordinatesGeografis },
        { id: 'P-2', coordinates: secondBidang.slice(0, 2) },
      ],
    };

    const data = buildSPPTGPDFData(draft, null, { mapUrlGenerator: () => 'https://map' });

    expect(data.polygons).toHaveLength(1);
  });

  it('falls back to the legacy single boundary when there is no polygon list', () => {
    const draft = createDraftFixture();

    const data = buildSPPTGPDFData(draft, null, { mapUrlGenerator: () => 'https://map' });

    expect(data.polygons).toHaveLength(1);
    expect(data.polygons?.[0].coordinates).toEqual(draft.coordinatesGeografis);
  });
});
