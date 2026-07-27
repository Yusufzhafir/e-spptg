import { describe, expect, it } from 'vitest';
import { validateStep1Fields } from './step-field-errors';
import type { SubmissionDraft } from '@/types';

const doc = { name: 'berkas.pdf', size: 1024 };

/** A Step 1 form with every mandatory field filled in. */
function completeStep1(): SubmissionDraft {
  return {
    currentStep: 1,
    namaPemohon: 'Budi Santoso',
    nik: '3201010101010001',
    villageId: 1,
    dokumenKTP: doc,
    dokumenKK: doc,
    dokumenKwitansi: doc,
    dokumenPermohonan: doc,
    dokumenTidakSengketa: doc,
    persetujuanData: true,
    saksiList: [],
    coordinateSystem: 'geografis',
    coordinatesGeografis: [],
    fotoLahan: [],
    overlapResults: [],
  } as unknown as SubmissionDraft;
}

describe('validateStep1Fields', () => {
  it('passes when every mandatory field is present', () => {
    expect(validateStep1Fields(completeStep1())).toEqual({});
  });

  it('requires Surat Pernyataan Tidak Sengketa', () => {
    const draft = completeStep1();
    delete (draft as Partial<SubmissionDraft>).dokumenTidakSengketa;

    const errors = validateStep1Fields(draft);
    expect(errors.dokumenTidakSengketa).toBe(
      'Dokumen Surat Pernyataan Tidak Sengketa wajib diunggah'
    );
  });

  it.each([
    ['dokumenKTP'],
    ['dokumenKK'],
    ['dokumenKwitansi'],
    ['dokumenPermohonan'],
    ['dokumenTidakSengketa'],
  ] as const)('blocks the step when %s is missing', (field) => {
    const draft = completeStep1();
    delete (draft as Partial<SubmissionDraft>)[field];

    const errors = validateStep1Fields(draft);
    expect(Object.keys(errors)).toContain(field);
  });
});
