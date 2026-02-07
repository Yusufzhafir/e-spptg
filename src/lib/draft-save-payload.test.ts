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
        jenisKawasan: 'Hutan Lindung',
        sumber: 'ProhibitedArea',
        luasOverlap: 42,
      },
    ],
    luasLahan: 1200,
    luasManual: 1300,
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
    expect(payload.coordinatesGeografis).toEqual(draft.coordinatesGeografis);
    expect(payload.overlapResults).toEqual(draft.overlapResults);
    expect(payload.juruUkur).toEqual(draft.juruUkur);
    expect(payload.status).toBe('SPPTG terdaftar');
  });
});
