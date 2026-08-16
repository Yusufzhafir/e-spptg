import type { SPPTGPDFData } from '@/components/pdf/types';
import {
  generateStaticMapUrl,
  generateStaticMapUrlForPolygons,
} from '@/lib/map-static-api';
import {
  bidangRincianList,
  draftPolygons,
  isUsablePolygon,
  totalLuasPengukuran,
  validCoordinates,
} from '@/lib/land-polygons';
import { numberToIndonesianWords } from '@/lib/number-to-words';
import { checkedTerdataStatuses } from '@/lib/spptg-terdata';
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

/**
 * The witness blocks the certificate prints: exactly the saksi handed in, no
 * padding and no truncation.
 *
 * The form used to be padded up to two slots so an unused line could be filled
 * in by hand, which meant a pengajuan with a single saksi printed a second,
 * empty identity block — an invitation to add a witness after signing. A saksi
 * whose umur/pekerjaan/alamat were not recorded still prints their own block
 * with those lines blank, which is a gap in one witness's details rather than
 * room for an extra witness.
 *
 * One empty slot is still returned when there is no saksi at all: the draft
 * validation makes that impossible to reach through the wizard, and a heading
 * with nothing under it would be worse than a blank line.
 *
 * Callers decide *which* saksi to pass — the signature page hands in only the
 * ones that fit on it (`witnessesOnSignaturePage`), and the rest are printed on
 * continuation sheets.
 */
export function buildWitnessSlots<T>(saksiList: readonly T[] | undefined | null) {
  const witnesses = saksiList ?? [];
  return witnesses.length > 0 ? [...witnesses] : [undefined];
}

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
  // Every bidang of the pengajuan: the map frames all of them, the coordinate
  // attachment prints one sheet per boundary, and each carries its own persil
  // number and measurements.
  const polygons = draftPolygons(draft).filter(isUsablePolygon);
  const polygonRings = polygons.map((polygon) => validCoordinates(polygon.coordinates));
  const rincian = bidangRincianList(polygons);

  /**
   * The area the certificate states. Summed per bidang — each one contributes
   * what the surveyor measured on it, or what its boundary computes when it was
   * not measured by hand — so a claim of three parcels states all three, and
   * never a single parcel's figure for the lot.
   *
   * Falls back to the draft's own totals for a berkas with no usable boundary at
   * all, which is the only way it can be zero here.
   */
  const luasValue =
    totalLuasPengukuran(polygons) || draft.luasManual || draft.luasLahan || 0;
  const luasTerbilang = luasValue ? numberToIndonesianWords(luasValue) : '';

  const mapImageUrl =
    polygonRings.length > 0
      ? (options.mapUrlGenerator
          ? // A caller-supplied generator (the tests) only knows the
            // single-polygon signature, so it is handed the first boundary.
            options.mapUrlGenerator(polygonRings[0])
          : generateStaticMapUrlForPolygons(polygonRings)) || undefined
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
    panjangLahan: rincian.length === 1 ? rincian[0].panjang : undefined,
    lebarLahan: rincian.length === 1 ? rincian[0].lebar : undefined,
    penggunaanLahan: draft.penggunaanLahan,
    tahunAwalGarap: draft.tahunAwalGarap,
    statusTanah: draft.statusTanah,
    asalPerolehan: draft.asalPerolehan,
    tahunPerolehan: draft.tahunPerolehan,
    namaJalan: draft.namaJalan,
    namaGang: draft.namaGang,
    // The single-bidang value. With more than one, statement 1.a prints a row
    // per bidang straight from `polygons` instead.
    nomorPersil: rincian.length === 1 ? rincian[0].nomorPersil : undefined,
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
    coordinatesGeografis: polygonRings[0] ?? draft.coordinatesGeografis ?? [],
    polygons: polygons.map((polygon, index) => ({
      nama: polygon.nama,
      coordinates: polygonRings[index],
      nomorPersil: rincian[index]?.nomorPersil,
      luasManual: rincian[index]?.luasManual,
      luasHitung: rincian[index]?.luasHitung,
      panjang: rincian[index]?.panjang,
      lebar: rincian[index]?.lebar,
    })),
    mapImageUrl,
    ...buildVariantData(draft),
  };
}

/**
 * The fields that only a terdata certificate uses. Derived from the draft's own
 * Step 3 decision rather than passed in, so the document can never disagree with
 * the status the berkas was issued under.
 */
function buildVariantData(draft: SubmissionDraft): Partial<SPPTGPDFData> {
  if (draft.status !== 'SPPTG terdata') return { variant: 'terdaftar' };

  return {
    variant: 'terdata',
    overlapStatuses: checkedTerdataStatuses(draft.overlapResults),
    namaJuruUkur: draft.juruUkur?.nama,
    jabatanJuruUkur: draft.juruUkur?.jabatan,
  };
}
