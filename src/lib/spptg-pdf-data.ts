import type { SPPTGPDFData } from '@/components/pdf/types';
import { generateStaticMapUrl } from '@/lib/map-static-api';
import { numberToIndonesianWords } from '@/lib/number-to-words';
import type { SubmissionDraft } from '@/types';

type VillageLike = {
  namaDesa?: string | null;
  namaKepalaDesa?: string | null;
  kecamatan?: string | null;
  kabupaten?: string | null;
};

type BuildSPPTGPDFDataOptions = {
  mapUrlGenerator?: typeof generateStaticMapUrl;
};

function buildBoundaryData(saksiList: SubmissionDraft['saksiList']) {
  const boundaryData: Partial<SPPTGPDFData> = {};

  for (const saksi of saksiList || []) {
    const penggunaan = saksi.penggunaanLahanBatas || '';
    switch (saksi.sisi) {
      case 'Utara':
        boundaryData.batasUtara = saksi.sisi;
        boundaryData.penggunaanBatasUtara = penggunaan;
        break;
      case 'Timur Laut':
        boundaryData.batasTimurLaut = saksi.sisi;
        boundaryData.penggunaanBatasTimurLaut = penggunaan;
        break;
      case 'Timur':
        boundaryData.batasTimur = saksi.sisi;
        boundaryData.penggunaanBatasTimur = penggunaan;
        break;
      case 'Tenggara':
        boundaryData.batasTenggara = saksi.sisi;
        boundaryData.penggunaanBatasTenggara = penggunaan;
        break;
      case 'Selatan':
        boundaryData.batasSelatan = saksi.sisi;
        boundaryData.penggunaanBatasSelatan = penggunaan;
        break;
      case 'Barat Daya':
        boundaryData.batasBaratDaya = saksi.sisi;
        boundaryData.penggunaanBatasBaratDaya = penggunaan;
        break;
      case 'Barat':
        boundaryData.batasBarat = saksi.sisi;
        boundaryData.penggunaanBatasBarat = penggunaan;
        break;
      case 'Barat Laut':
        boundaryData.batasBaratLaut = saksi.sisi;
        boundaryData.penggunaanBatasBaratLaut = penggunaan;
        break;
    }
  }

  return boundaryData;
}

export function buildSPPTGPDFData(
  draft: SubmissionDraft,
  villageData?: VillageLike | null,
  options: BuildSPPTGPDFDataOptions = {}
): SPPTGPDFData {
  const mapUrlGenerator = options.mapUrlGenerator ?? generateStaticMapUrl;
  const luasValue = draft.luasManual || draft.luasLahan || 0;
  const luasTerbilang = luasValue ? numberToIndonesianWords(luasValue) : '';

  const mapImageUrl =
    draft.coordinatesGeografis && draft.coordinatesGeografis.length >= 3
      ? mapUrlGenerator(draft.coordinatesGeografis) || undefined
      : undefined;

  const resolvedNamaDesa = villageData?.namaDesa || '';
  const resolvedKecamatan = villageData?.kecamatan || draft.kecamatan || '';
  const resolvedKabupaten = villageData?.kabupaten || draft.kabupaten || '';
  const resolvedNamaKepalaDesa = villageData?.namaKepalaDesa || draft.namaKepalaDesa;

  return {
    namaPemohon: draft.namaPemohon,
    nik: draft.nik,
    tempatLahir: draft.tempatLahir,
    tanggalLahir: draft.tanggalLahir,
    pekerjaan: draft.pekerjaan,
    alamatKTP: draft.alamatKTP,
    luasManual: luasValue || undefined,
    luasTerbilang,
    luasLahan: draft.luasLahan,
    penggunaanLahan: draft.penggunaanLahan,
    tahunAwalGarap: draft.tahunAwalGarap,
    namaJalan: draft.namaJalan,
    namaGang: draft.namaGang,
    nomorPersil: draft.nomorPersil,
    rtrw: draft.rtrw,
    dusun: draft.dusun,
    namaDesa: resolvedNamaDesa,
    kecamatan: resolvedKecamatan,
    kabupaten: resolvedKabupaten,
    ...buildBoundaryData(draft.saksiList || []),
    saksiList: draft.saksiList || [],
    nomorSPPTG: draft.nomorSPPTG || '',
    tanggalPernyataan: draft.tanggalTerbit || new Date().toISOString().split('T')[0],
    namaKepalaDesa: resolvedNamaKepalaDesa || undefined,
    coordinatesGeografis: draft.coordinatesGeografis || [],
    mapImageUrl,
  };
}
