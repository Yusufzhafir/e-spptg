import { describe, expect, it } from 'vitest';
import {
  STEP1_FIELD_LABELS,
  step1FieldLabels,
  validateStep1Fields,
  validateStep2Fields,
} from './step-field-errors';
import type { SubmissionDraft } from '@/types';

const doc = { name: 'berkas.pdf', size: 1024 };

/** A Step 1 form with every mandatory field filled in. */
function completeStep1(): SubmissionDraft {
  return {
    currentStep: 1,
    namaPemohon: 'Budi Santoso',
    nik: '3201010101010001',
    tempatLahir: 'Sangatta',
    tanggalLahir: '1985-04-17',
    pekerjaan: 'Petani',
    alamatKTP: 'Jl. Yos Sudarso No. 12, RT 03',
    nomorHP: '081234567890',
    email: 'budi@email.com',
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

  it('lets the step through without Surat Pernyataan Tidak Sengketa', () => {
    const draft = completeStep1();
    delete (draft as Partial<SubmissionDraft>).dokumenTidakSengketa;

    expect(validateStep1Fields(draft)).toEqual({});
  });

  it.each([
    ['dokumenKTP'],
    ['dokumenKK'],
    ['dokumenKwitansi'],
    ['dokumenPermohonan'],
  ] as const)('blocks the step when %s is missing', (field) => {
    const draft = completeStep1();
    delete (draft as Partial<SubmissionDraft>)[field];

    const errors = validateStep1Fields(draft);
    expect(Object.keys(errors)).toContain(field);
  });

  it('blocks a foreign phone number', () => {
    const draft = completeStep1();
    draft.nomorHP = '+1 (599) 869-8667';

    expect(validateStep1Fields(draft).nomorHP).toBeDefined();
  });

  it.each(['081234567890', '+62 812 3456 7890', '0812-3456-7890'])(
    'accepts %s',
    (value) => {
      const draft = completeStep1();
      draft.nomorHP = value;

      expect(validateStep1Fields(draft).nomorHP).toBeUndefined();
    }
  );

  it('requires the phone number', () => {
    const draft = completeStep1();
    draft.nomorHP = '';

    expect(validateStep1Fields(draft).nomorHP).toBe('Nomor HP wajib diisi');
  });

  it('blocks a malformed email and requires an empty one to be filled', () => {
    const draft = completeStep1();
    draft.email = 'budi[at]email';
    expect(validateStep1Fields(draft).email).toBeDefined();

    draft.email = '';
    expect(validateStep1Fields(draft).email).toBe('Email wajib diisi');
  });

  it.each([
    ['tempatLahir', 'Tempat lahir wajib diisi'],
    ['tanggalLahir', 'Tanggal lahir wajib diisi'],
    ['pekerjaan', 'Pekerjaan wajib diisi'],
    ['alamatKTP', 'Alamat KTP wajib diisi'],
  ] as const)('requires %s — it is printed on the certificate', (field, message) => {
    const draft = completeStep1();
    delete (draft as Partial<SubmissionDraft>)[field];

    expect(validateStep1Fields(draft)[field]).toBe(message);
  });

  it('treats a whitespace-only identity field as empty', () => {
    const draft = completeStep1();
    draft.alamatKTP = '   ';

    expect(validateStep1Fields(draft).alamatKTP).toBe('Alamat KTP wajib diisi');
  });
});

describe('step1FieldLabels', () => {
  it('names the missing fields in form order, not in error order', () => {
    const draft = completeStep1();
    delete (draft as Partial<SubmissionDraft>).pekerjaan;
    delete (draft as Partial<SubmissionDraft>).tempatLahir;

    expect(step1FieldLabels(validateStep1Fields(draft))).toEqual([
      'Tempat lahir',
      'Pekerjaan',
    ]);
  });

  it('has a label for every field validateStep1Fields can flag', () => {
    // An unlabelled field would silently vanish from the "belum lengkap"
    // message, leaving the user hunting for a red box with no name.
    const everythingMissing = validateStep1Fields({
      saksiList: [],
      coordinatesGeografis: [],
    } as unknown as SubmissionDraft);

    for (const field of Object.keys(everythingMissing)) {
      expect(STEP1_FIELD_LABELS[field], `label untuk ${field}`).toBeDefined();
    }
  });

  it('returns nothing when Step 1 is complete', () => {
    expect(step1FieldLabels(validateStep1Fields(completeStep1()))).toEqual([]);
  });
});

/** A Step 2 form with every mandatory field filled in. */
function completeStep2(): SubmissionDraft {
  return {
    ...completeStep1(),
    currentStep: 2,
    saksiList: [
      {
        id: 'W-1',
        nama: 'Slamet',
        sisi: 'Utara',
        penggunaanLahanBatas: 'Sawah',
      },
    ],
    coordinatesGeografis: [
      { id: 'C-1', latitude: 0.6, longitude: 117.3 },
      { id: 'C-2', latitude: 0.601, longitude: 117.3 },
      { id: 'C-3', latitude: 0.601, longitude: 117.301 },
    ],
    dokumenBeritaAcara: doc,
  } as unknown as SubmissionDraft;
}

describe('validateStep2Fields', () => {
  it('passes with a saksi who has no umur, pekerjaan or alamat', () => {
    // Those three are optional on the form and in boundaryWitnessSchema; the
    // step validator must not be stricter than the schema it fronts.
    expect(validateStep2Fields(completeStep2())).toEqual({});
  });

  it('still demands the saksi fields that are mandatory', () => {
    const draft = completeStep2();
    draft.saksiList = [
      { id: 'W-1', nama: '  ', sisi: 'Utara', penggunaanLahanBatas: 'Sawah' },
    ] as SubmissionDraft['saksiList'];

    expect(validateStep2Fields(draft).saksiList).toContain('nama saksi');
  });

  it('accepts a boundary drawn on a later bidang when the first is still empty', () => {
    const draft = completeStep2();
    // `coordinatesGeografis` mirrors the *first* bidang, so a validator reading
    // only the mirror would reject a pengajuan whose second bidang is complete.
    draft.polygons = [
      { id: 'P-1', coordinates: [] },
      { id: 'P-2', coordinates: completeStep2().coordinatesGeografis },
    ];
    draft.coordinatesGeografis = [];

    expect(validateStep2Fields(draft).coordinatesGeografis).toBeUndefined();
  });

  it('rejects a pengajuan with no usable bidang at all', () => {
    const draft = completeStep2();
    draft.polygons = [{ id: 'P-1', coordinates: [] }];
    draft.coordinatesGeografis = [];

    expect(validateStep2Fields(draft).coordinatesGeografis).toContain('Minimal 3 titik');
  });

  it('still validates a legacy draft that has no polygon list', () => {
    const draft = completeStep2();
    delete draft.polygons;
    draft.coordinatesGeografis = draft.coordinatesGeografis.slice(0, 2);

    expect(validateStep2Fields(draft).coordinatesGeografis).toContain('Minimal 3 titik');
  });
});
