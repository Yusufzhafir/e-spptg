import { describe, expect, it } from 'vitest';
import { buildDraftSavePayload } from './draft-save-payload';
import type { SubmissionDraft } from '@/types';

function createDraftFixture(): SubmissionDraft {
  return {
    id: 101,
    currentStep: 2,
    namaPemohon: 'Budi Santoso',
    nik: '3201010101010001',
    persetujuanData: true,
    saksiList: [],
    coordinateSystem: 'geografis',
    coordinatesGeografis: [
      { id: 'C-1', latitude: -6.1, longitude: 107.1 },
      { id: 'C-2', latitude: -6.11, longitude: 107.11 },
      { id: 'C-3', latitude: -6.12, longitude: 107.12 },
    ],
    fotoLahan: [],
    overlapResults: [
      {
        kawasanId: 11,
        namaKawasan: 'Kawasan Uji',
        jenisKawasan: 'Kawasan Hutan',
        sumber: 'ProhibitedArea',
        luasOverlap: 42,
      },
    ],
    luasLahan: 1200,
    luasManual: 1300,
    panjangLahan: 40,
    lebarLahan: 25,
    juruUkur: {
      nama: 'Surveyor A',
      jabatan: 'Juru Ukur',
      nomorHP: '081234567890',
    },
    status: 'SPPTG terdaftar',
  };
}

describe('buildDraftSavePayload', () => {
  it('preserves critical step payload fields used for persistence', () => {
    const draft = createDraftFixture();
    const payload = buildDraftSavePayload(draft) as Record<string, unknown>;

    expect(payload.namaPemohon).toBe('Budi Santoso');
    expect(payload.nik).toBe('3201010101010001');
    expect(payload.luasManual).toBe(1300);
    expect(payload.luasLahan).toBe(1200);
    // Optional Step 2 measurements: a field missing from this payload silently
    // never persists, however correct the local state looks.
    expect(payload.panjangLahan).toBe(40);
    expect(payload.lebarLahan).toBe(25);
    expect(payload.coordinatesGeografis).toEqual(draft.coordinatesGeografis);
    expect(payload.overlapResults).toEqual(draft.overlapResults);
    expect(payload.juruUkur).toEqual(draft.juruUkur);
    expect(payload.status).toBe('SPPTG terdaftar');
  });

  it('normalizes coordinate ids before persistence', () => {
    const draft = createDraftFixture();
    draft.coordinatesGeografis = [
      { id: 'C-1', latitude: -6.1, longitude: 107.1 },
      { id: '' as unknown as string, latitude: -6.11, longitude: 107.11 },
      { id: 'C-1', latitude: -6.12, longitude: 107.12 },
    ];

    const payload = buildDraftSavePayload(draft) as {
      coordinatesGeografis: Array<{ id: string; latitude: number; longitude: number }>;
    };

    expect(payload.coordinatesGeografis.map((coord) => coord.id)).toEqual([
      'C-1',
      'C-2',
      'C-1-2',
    ]);
  });

  it('mirrors the first polygon into coordinatesGeografis', () => {
    const draft = createDraftFixture();
    draft.polygons = [
      {
        id: 'P-1',
        coordinates: [
          { id: 'A-1', latitude: -1.1, longitude: 117.1 },
          { id: 'A-2', latitude: -1.2, longitude: 117.2 },
          { id: 'A-3', latitude: -1.3, longitude: 117.3 },
        ],
      },
      {
        id: 'P-2',
        nama: 'Bidang Kedua',
        locked: true,
        coordinates: [
          { id: 'B-1', latitude: -2.1, longitude: 118.1 },
          { id: 'B-2', latitude: -2.2, longitude: 118.2 },
          { id: 'B-3', latitude: -2.3, longitude: 118.3 },
        ],
      },
    ];

    const payload = buildDraftSavePayload(draft) as {
      polygons: Array<{ id: string; coordinates: unknown[] }>;
      coordinatesGeografis: unknown[];
    };

    expect(payload.polygons).toHaveLength(2);
    expect(payload.coordinatesGeografis).toEqual(payload.polygons[0].coordinates);
  });

  it('lifts a legacy single-boundary draft into one polygon', () => {
    const draft = createDraftFixture();
    delete draft.polygons;

    const payload = buildDraftSavePayload(draft) as {
      polygons: Array<{ coordinates: unknown[]; nomorPersil?: string; luasManual?: number }>;
    };

    expect(payload.polygons).toHaveLength(1);
    expect(payload.polygons[0].coordinates).toEqual(draft.coordinatesGeografis);
    // The pengajuan-level measurements move onto the bidang they described.
    expect(payload.polygons[0].luasManual).toBe(1300);
  });

  it('derives the pengajuan-level measurements from the bidang', () => {
    const draft = createDraftFixture();
    draft.polygons = [
      {
        id: 'P-1',
        coordinates: draft.coordinatesGeografis,
        nomorPersil: '12/A',
        luasManual: 900,
        panjang: 30,
        lebar: 30,
      },
      {
        id: 'P-2',
        nama: 'Bidang Kedua',
        coordinates: [
          { id: 'B-1', latitude: -2.1, longitude: 118.1 },
          { id: 'B-2', latitude: -2.2, longitude: 118.2 },
          { id: 'B-3', latitude: -2.3, longitude: 118.3 },
        ],
        nomorPersil: '13/B',
        luasManual: 600,
      },
    ];

    const payload = buildDraftSavePayload(draft) as Record<string, unknown>;

    // Luas manual is the total of both bidang; the rest mirror the first, the
    // way `coordinatesGeografis` mirrors its ring.
    expect(payload.luasManual).toBe(1500);
    expect(payload.nomorPersil).toBe('12/A');
    expect(payload.panjangLahan).toBe(30);
    expect(payload.lebarLahan).toBe(30);
  });

  it('lets a cleared per-bidang measurement stay cleared', () => {
    const draft = createDraftFixture();
    // The surveyor removed the figure in Step 2; the stale draft-level copy must
    // not put it back on the next save.
    draft.polygons = [{ id: 'P-1', coordinates: draft.coordinatesGeografis }];
    draft.luasManual = undefined;
    draft.panjangLahan = undefined;

    const payload = buildDraftSavePayload(draft) as Record<string, unknown>;

    expect(payload.luasManual).toBeNull();
    expect(payload.panjangLahan).toBeNull();
  });
});
