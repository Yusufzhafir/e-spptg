import { SubmissionDraft } from '@/types';

export type StepFieldErrors = Record<string, string>;

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

  if (!draft.dokumenKTP) {
    errors.dokumenKTP = 'Dokumen KTP wajib diunggah';
  }

  if (!draft.dokumenKK) {
    errors.dokumenKK = 'Dokumen KK wajib diunggah';
  }

  if (!draft.dokumenKwitansi) {
    errors.dokumenKwitansi =
      'Dokumen Kwitansi Jual Beli/Hibah/Keterangan Warisan wajib diunggah';
  }

  if (!draft.dokumenPermohonan) {
    errors.dokumenPermohonan = 'Dokumen Surat Permohonan wajib diunggah';
  }

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
      (w) => !w.nama?.trim() || !w.sisi || !w.penggunaanLahanBatas?.trim()
    );
    if (invalidWitness) {
      errors.saksiList =
        'Lengkapi data saksi batas lahan: nama saksi, sisi batas, dan penggunaan batas lahan';
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

  if (!draft.nomorSPPTG?.trim()) {
    errors.nomorSPPTG = 'Nomor SPPTG wajib diisi';
  }

  if (!draft.tanggalTerbit) {
    errors.tanggalTerbit = 'Tanggal diterbitkan wajib diisi';
  }

  return errors;
}
