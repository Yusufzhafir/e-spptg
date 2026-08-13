/**
 * Pemetaan hasil mentah MMDB menjadi dua kolom yang disimpan `page_visits`.
 *
 * Dipisah dari `src/server/geoip.ts` supaya bisa diuji tanpa berkas `.mmdb`
 * 130 MB dan tanpa `server-only`: yang di sini murni bentuk data, yang di sana
 * pembacaan berkas dan siklus hidup reader-nya.
 */

/**
 * Bentuk minimal yang kita pakai dari `CityResponse` milik maxmind.
 *
 * `names` sengaja ditulis `{ en?: string }`, bukan `Record<string, string>`:
 * tipe `Names` di maxmind adalah interface dengan properti bahasa yang opsional
 * dan tanpa index signature, jadi `Record` membuatnya tidak bisa ditugaskan.
 */
type NamaBahasa = { en?: string };

export type HasilKota = {
  country?: { iso_code?: string; names?: NamaBahasa };
  city?: { names?: NamaBahasa };
  subdivisions?: readonly { names?: NamaBahasa }[];
};

export type Lokasi = { negara: string | null; kota: string | null };

export const LOKASI_KOSONG: Lokasi = { negara: null, kota: null };

/**
 * Alamat yang tidak pernah ada di basis data mana pun, jadi tidak usah dicari.
 *
 * Bukan sekadar optimasi: tanpa penjagaan ini setiap kunjungan dari jaringan
 * Docker (`172.18.0.1`) atau dari host sendiri akan menghasilkan pencarian
 * gagal yang terlihat seperti kerusakan saat menelusuri masalah.
 */
export function ipBisaDilacak(ip: string | null | undefined): ip is string {
  if (!ip) return false;
  const bersih = ip.trim();
  if (!bersih || bersih === '::1' || bersih === '::') return false;
  if (bersih.startsWith('127.') || bersih.startsWith('10.')) return false;
  if (bersih.startsWith('192.168.')) return false;
  // 172.16.0.0/12 — hanya 172.16–172.31 yang privat, 172.32+ publik.
  const cocok = /^172\.(\d{1,3})\./.exec(bersih);
  if (cocok) {
    const oktet = Number(cocok[1]);
    if (oktet >= 16 && oktet <= 31) return false;
  }
  // fc00::/7 (unique local) dan fe80::/10 (link local).
  const kecil = bersih.toLowerCase();
  if (kecil.startsWith('fc') || kecil.startsWith('fd') || kecil.startsWith('fe8')) {
    return false;
  }
  return true;
}

/**
 * Nama kota dalam bahasa Inggris, bukan lokal: DB-IP mengisi `names.en` untuk
 * hampir semua entri sedangkan `names.id` jarang ada, dan daftar "5 kota
 * teratas" yang separuhnya kosong lebih buruk daripada daftar berbahasa Inggris.
 * Provinsi dipakai sebagai cadangan supaya IP yang hanya dikenal sampai tingkat
 * provinsi tetap memberi keterangan, bukan menghilang dari statistik.
 */
export function petakanLokasi(hasil: HasilKota | null | undefined): Lokasi {
  if (!hasil) return LOKASI_KOSONG;

  const negara = hasil.country?.iso_code?.trim() || null;
  const kota =
    hasil.city?.names?.en?.trim() ||
    hasil.subdivisions?.[hasil.subdivisions.length - 1]?.names?.en?.trim() ||
    null;

  return {
    negara: negara ? negara.slice(0, 80) : null,
    kota: kota ? kota.slice(0, 120) : null,
  };
}
