import { SubmissionDraft } from '@/types';
import { isValidPhoneNumber, PHONE_NUMBER_ERROR } from '@/lib/phone-number';
import { EMAIL_ERROR, isValidEmail } from '@/lib/email-address';
import { hasNomorSPPTGBody, nomorSPPTGPrefix } from '@/lib/nomor-spptg';

export type StepFieldErrors = Record<string, string>;

/**
 * Human labels for the Step 1 fields, used when a message has to name what is
 * missing rather than mark it in place — the server rejects a save with raw Zod
 * text ("tempatLahir: expected string, received undefined"), which is the field
 * key, not something a petugas desa can act on.
 */
export const STEP1_FIELD_LABELS: Record<string, string> = {
  namaPemohon: 'Nama pemohon',
  nik: 'NIK',
  villageId: 'Desa',
  tempatLahir: 'Tempat lahir',
  tanggalLahir: 'Tanggal lahir',
  pekerjaan: 'Pekerjaan',
  alamatKTP: 'Alamat KTP',
  nomorHP: 'Nomor HP',
  email: 'Email',
  dokumenKTP: 'Dokumen KTP',
  dokumenKK: 'Dokumen KK',
  dokumenKwitansi: 'Surat Asal Usul Kwitansi Jual Beli/Hibah/Keterangan Waris/Bukti Lain',
  dokumenPermohonan: 'Surat Permohonan',
  persetujuanData: 'Pernyataan kebenaran data',
};

/** The labels behind a `validateStep1Fields` result, in form order. */
export function step1FieldLabels(errors: StepFieldErrors): string[] {
  return Object.keys(STEP1_FIELD_LABELS)
    .filter((key) => key in errors)
    .map((key) => STEP1_FIELD_LABELS[key]);
}

/**
 * Per-field validation for Step 1 (Berkas), mirroring the rules enforced by
 * step1BerkasSchema on the server. Returns a map of field key -> message so
 * the UI can show each error under its own input.
 */
export function validateStep1Fields(draft: SubmissionDraft): StepFieldErrors {
  const errors: StepFieldErrors = {};

  if (!draft.namaPemohon?.trim()) {
    errors.namaPemohon = 'Nama pemohon wajib diisi';
  } else if (draft.namaPemohon.trim().length < 2) {
    errors.namaPemohon = 'Nama pemohon minimal 2 karakter';
  }

  if (!draft.nik) {
    errors.nik = 'NIK wajib diisi';
  } else if (draft.nik.length !== 16) {
    errors.nik = 'NIK harus 16 digit';
  }

  if (!draft.villageId) {
    errors.villageId = 'Desa wajib dipilih';
  }

  // Identity details printed on the SPPTG itself — the certificate names the
  // holder with their birthplace, date of birth, occupation and KTP address, so
  // none of them can be left for later.
  if (!draft.tempatLahir?.trim()) {
    errors.tempatLahir = 'Tempat lahir wajib diisi';
  }

  if (!draft.tanggalLahir?.trim()) {
    errors.tanggalLahir = 'Tanggal lahir wajib diisi';
  }

  if (!draft.pekerjaan?.trim()) {
    errors.pekerjaan = 'Pekerjaan wajib diisi';
  }

  if (!draft.alamatKTP?.trim()) {
    errors.alamatKTP = 'Alamat KTP wajib diisi';
  }

  // Contact details: required, and a filled-in value must also be usable —
  // an unchecked field silently stored a foreign number before this.
  const nomorHP = draft.nomorHP?.trim();
  if (!nomorHP) {
    errors.nomorHP = 'Nomor HP wajib diisi';
  } else if (!isValidPhoneNumber(nomorHP)) {
    errors.nomorHP = PHONE_NUMBER_ERROR;
  }

  const email = draft.email?.trim();
  if (!email) {
    errors.email = 'Email wajib diisi';
  } else if (!isValidEmail(email)) {
    errors.email = EMAIL_ERROR;
  }

  if (!draft.dokumenKTP) {
    errors.dokumenKTP = 'Dokumen KTP wajib diunggah';
  }

  if (!draft.dokumenKK) {
    errors.dokumenKK = 'Dokumen KK wajib diunggah';
  }

  if (!draft.dokumenKwitansi) {
    errors.dokumenKwitansi =
      'Dokumen Surat Asal Usul Kwitansi Jual Beli/Hibah/Keterangan Waris/Bukti Lain wajib diunggah';
  }

  if (!draft.dokumenPermohonan) {
    errors.dokumenPermohonan = 'Dokumen Surat Permohonan wajib diunggah';
  }

  // Surat Pernyataan Tidak Sengketa is deliberately not checked: it is optional,
  // so a berkas without it still passes Step 1 (mirrors step1BerkasSchema).

  if (!draft.persetujuanData) {
    errors.persetujuanData =
      'Anda wajib mencentang pernyataan ini sebelum melanjutkan';
  }

  return errors;
}

/**
 * Per-field validation for Step 2 (Lapangan).
 */
export function validateStep2Fields(draft: SubmissionDraft): StepFieldErrors {
  const errors: StepFieldErrors = {};

  if (draft.saksiList.length < 1) {
    errors.saksiList = 'Minimal 1 saksi batas lahan diperlukan';
  } else {
    const invalidWitness = draft.saksiList.find(
      (w) =>
        !w.nama?.trim() ||
        !w.sisi ||
        !w.penggunaanLahanBatas?.trim() ||
        !w.umur ||
        !w.pekerjaan?.trim() ||
        !w.alamat?.trim()
    );
    if (invalidWitness) {
      errors.saksiList =
        'Lengkapi data saksi batas lahan: nama saksi, sisi batas, penggunaan batas lahan, umur, pekerjaan, dan alamat';
    }
  }

  if (draft.coordinatesGeografis.length < 3) {
    errors.coordinatesGeografis =
      'Minimal 3 titik koordinat diperlukan untuk membentuk polygon';
  }

  if (!draft.dokumenBeritaAcara) {
    errors.dokumenBeritaAcara =
      'Dokumen Berita Acara Validasi Lapangan wajib diunggah';
  }

  return errors;
}

/**
 * Per-field validation for Step 4 (Terbitkan SPPTG).
 */
export function validateStep4Fields(draft: SubmissionDraft): StepFieldErrors {
  const errors: StepFieldErrors = {};

  if (!draft.dokumenSPPTG) {
    errors.dokumenSPPTG = 'Softcopy SPPTG wajib diunggah sebelum diterbitkan';
  }

  // The prefix is seeded into the field, so a plain emptiness check would wave
  // through a certificate numbered "TERDAFTAR/" and nothing else.
  if (!hasNomorSPPTGBody(draft.nomorSPPTG)) {
    errors.nomorSPPTG = `Nomor SPPTG wajib diisi setelah awalan ${nomorSPPTGPrefix(draft.status)}`;
  }

  if (!draft.tanggalTerbit) {
    errors.tanggalTerbit = 'Tanggal diterbitkan wajib diisi';
  }

  return errors;
}
