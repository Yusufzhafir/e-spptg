import 'server-only';
import type { CityResponse, Reader } from 'maxmind';
import {
  ipBisaDilacak,
  petakanLokasi,
  LOKASI_KOSONG,
  type Lokasi,
} from '@/lib/geoip-mapping';

/**
 * Lokasi pengunjung dari basis data MMDB **lokal**.
 *
 * Aturannya sama dengan `withRedis()` dan kunci VAPID: **tidak dipasang adalah
 * konfigurasi yang didukung**. Tanpa `GEOIP_MMDB_PATH`, atau kalau berkasnya
 * hilang/rusak, fungsi ini mengembalikan lokasi kosong dan tab "Lokasi" kembali
 * menampilkan "belum tersedia" — penghitung kunjungan tetap jalan seperti biasa.
 *
 * Dua hal yang membuat ini tetap sejalan dengan desain semula:
 * - **Tidak ada panggilan keluar.** Pencarian dilakukan terhadap berkas di disk,
 *   jadi alamat IP pengunjung tidak pernah dikirim ke pihak ketiga. Ini yang
 *   dulu membuat aplikasi sengaja tidak melakukan geolokasi sama sekali.
 * - **Header proxy tetap menang** (lihat `src/app/api/kunjungan/route.ts`).
 *   Kalau suatu saat ada Cloudflare atau modul geoip2 di nginx, sumber itu
 *   dipakai dan berkas ini tinggal dilepas tanpa mengubah kode.
 *
 * Berkasnya (DB-IP City Lite, CC BY 4.0) di-*bind mount* dari host, bukan
 * di-bake ke image: 130 MB tidak perlu ikut setiap kali image dibangun, dan
 * memperbaruinya cukup mengganti berkas lalu me-restart container.
 */

/**
 * Satu kali buka, lalu dipakai ulang — membuka berkas 130 MB pada setiap
 * kunjungan akan membuat penghitung kunjungan lebih mahal daripada halaman yang
 * dihitungnya. Diukur di deployment ini, reader yang sudah terbuka menambah
 * sekitar 30 MB RSS pada container (171 → 199 MiB).
 */
let pembaca: Promise<Reader<CityResponse> | null> | null = null;

function bukaPembaca(): Promise<Reader<CityResponse> | null> {
  const path = process.env.GEOIP_MMDB_PATH;
  if (!path) return Promise.resolve(null);

  // Impor dinamis supaya paket 130 MB-nya tidak ikut dimuat pada deployment yang
  // tidak memasang GEOIP_MMDB_PATH sama sekali.
  return import('maxmind')
    .then((maxmind) => maxmind.open<CityResponse>(path))
    .catch((error) => {
      // Dicatat sekali saja: `pembaca` tetap berisi promise yang sudah selesai,
      // jadi kegagalan tidak dicoba ulang pada setiap kunjungan dan log tidak
      // dibanjiri pesan yang sama.
      console.error('[geoip] gagal membuka basis data, lokasi dinonaktifkan:', error);
      return null;
    });
}

export async function lokasiDariIp(ip: string | null | undefined): Promise<Lokasi> {
  if (!ipBisaDilacak(ip)) return LOKASI_KOSONG;

  pembaca ??= bukaPembaca();
  const reader = await pembaca;
  if (!reader) return LOKASI_KOSONG;

  try {
    return petakanLokasi(reader.get(ip));
  } catch (error) {
    console.error('[geoip] gagal mencari lokasi:', error);
    return LOKASI_KOSONG;
  }
}

/** Hanya untuk pengujian: memaksa pembacaan ulang berkas pada panggilan berikutnya. */
export function resetPembacaGeoIp() {
  pembaca = null;
}
