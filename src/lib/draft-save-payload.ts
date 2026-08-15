import type { SubmissionDraft } from '@/types';
import { derivedBidangFields, draftPolygons, polygonsPatch } from './land-polygons';

/**
 * Builds a complete, serializable payload for draft persistence.
 * Keep this in one place to avoid fields getting dropped during step transitions.
 *
 * Cleared fields are sent as null (not undefined): JSON transport drops
 * undefined keys, so the server-side merge would silently keep the old value —
 * e.g. a deleted document would reappear. The server removes null-valued keys
 * from the stored payload.
 */
export function buildDraftSavePayload(draft: SubmissionDraft): Record<string, unknown> {
  // Normalised together so the mirrored `coordinatesGeografis` can never be
  // saved out of step with the polygon it mirrors.
  const geometry = polygonsPatch(draftPolygons(draft));
  /**
   * Nomor persil, luas manual and the tape measurements belong to a bidang now.
   * The pengajuan-level keys are still written, derived from the bidang list, so
   * `submissions.luas_manual` and every reader that predates the move keep
   * working. The draft's own value is only kept where the bidang say nothing —
   * a berkas that already covered several bidang before the move carries its
   * measurements at this level and nowhere else.
   */
  const bidang = derivedBidangFields(geometry.polygons);

  const payload: Record<string, unknown> = {
    // Step 1: Applicant Data
    namaPemohon: draft.namaPemohon,
    nik: draft.nik,
    tempatLahir: draft.tempatLahir,
    tanggalLahir: draft.tanggalLahir,
    pekerjaan: draft.pekerjaan,
    alamatKTP: draft.alamatKTP,
    nomorHP: draft.nomorHP,
    email: draft.email,
    persetujuanData: draft.persetujuanData,

    // Step 2: Land Location & Details
    villageId: draft.villageId,
    namaJalan: draft.namaJalan,
    namaGang: draft.namaGang,
    nomorPersil: bidang.nomorPersil ?? draft.nomorPersil,
    rtrw: draft.rtrw,
    dusun: draft.dusun,
    kecamatan: draft.kecamatan,
    kabupaten: draft.kabupaten,
    penggunaanLahan: draft.penggunaanLahan,
    tahunAwalGarap: draft.tahunAwalGarap,
    statusTanah: draft.statusTanah,
    asalPerolehan: draft.asalPerolehan,
    tahunPerolehan: draft.tahunPerolehan,
    namaKepalaDesa: draft.namaKepalaDesa,
    saksiList: draft.saksiList || [],
    coordinatesGeografis: geometry.coordinatesGeografis,
    polygons: geometry.polygons,
    coordinateSystem: draft.coordinateSystem,
    fotoLahan: draft.fotoLahan || [],
    overlapResults: draft.overlapResults || [],
    luasLahan: draft.luasLahan,
    luasManual: bidang.luasManual ?? draft.luasManual,
    kelilingLahan: draft.kelilingLahan,
    panjangLahan: bidang.panjangLahan ?? draft.panjangLahan,
    lebarLahan: bidang.lebarLahan ?? draft.lebarLahan,

    // Documents
    dokumenKTP: draft.dokumenKTP,
    dokumenKK: draft.dokumenKK,
    dokumenKwitansi: draft.dokumenKwitansi,
    dokumenPermohonan: draft.dokumenPermohonan,
    dokumenSKKepalaDesa: draft.dokumenSKKepalaDesa,

    // Team Members
    juruUkur: draft.juruUkur,
    pihakBPD: draft.pihakBPD,
    kepalaDusun: draft.kepalaDusun,
    rtSetempat: draft.rtSetempat,

    // Field Documents
    dokumenBeritaAcara: draft.dokumenBeritaAcara,
    dokumenPernyataanJualBeli: draft.dokumenPernyataanJualBeli,
    dokumenAsalUsul: draft.dokumenAsalUsul,
    dokumenTidakSengketa: draft.dokumenTidakSengketa,

    // Step 3: Results
    status: draft.status,
    alasanStatus: draft.alasanStatus,
    verifikator: draft.verifikator,
    tanggalKeputusan: draft.tanggalKeputusan,
    feedback: draft.feedback,

    // Step 4: Issuance
    dokumenSPPTG: draft.dokumenSPPTG,
    dokumenSPPTGInduk: draft.dokumenSPPTGInduk,
    nomorSPPTG: draft.nomorSPPTG,
    tanggalTerbit: draft.tanggalTerbit,
  };

  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) {
      payload[key] = null;
    }
  }

  return payload;
}
