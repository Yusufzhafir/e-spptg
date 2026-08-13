/**
 * Pengganti `@/server/db/db` selama pengujian.
 *
 * **Kenapa ada:** sampai 2026-08-14, `pnpm test` di host deploy menulis ke
 * database `siaptah` yang sungguhan. Tes memang mem-mock modul query yang
 * dipanggilnya langsung, tetapi jalur yang bukan bagian dari pengujian —
 * middleware audit (`recordAudit`) dan notifikasi push — memakai `db` sendiri
 * dan tidak pernah di-mock. `recordAudit` menelan errornya (`try/catch`), jadi
 * kegagalannya tidak pernah terlihat: dengan `DATABASE_URL` tak terjangkau ia
 * hanya membuat tes menggantung 5 detik, dan dengan `DATABASE_URL` yang
 * terjangkau ia diam-diam menulis 1.182 baris `audit_logs` produksi selama
 * lima hari sebelum ketahuan.
 *
 * Menambal satu-dua modul tidak cukup — jalur berikutnya yang lupa di-mock akan
 * mengulangi hal yang sama. Jadi yang diputus adalah aksesnya: setiap pemakaian
 * `db` di dalam Vitest melempar, sehingga sebuah tes yang menyentuh database
 * **gagal dengan berisik**, bukan menulis diam-diam.
 *
 * Kalau sebuah tes memang perlu database, mock modul query yang dipakainya
 * (pola yang sudah dipakai `rbac.test.ts` dkk.), jangan lepas alias ini.
 */

const PESAN =
  'Tes menyentuh database sungguhan lewat `@/server/db/db`. ' +
  'Ini diblokir dengan sengaja — mock modul query yang dipakai tes ini ' +
  '(lihat test/db-stub.ts).';

function tolak(): never {
  throw new Error(PESAN);
}

/**
 * Proxy, bukan objek biasa: kegagalan harus terjadi saat query *dijalankan*,
 * bukan saat modul diimpor. Banyak modul mengimpor `db` di tingkat atas tanpa
 * memakainya, dan melempar pada impor akan mematikan tes yang sebenarnya sudah
 * benar-benar ter-mock.
 */
export const db: unknown = new Proxy(
  {},
  {
    get: (_target, prop) => {
      // Vitest, `util.inspect` dan pemeriksaan `typeof`/await menyentuh
      // properti ini saat melaporkan hasil; melempar di sini membuat pesan
      // gagalnya sendiri tidak terbaca.
      if (
        prop === 'then' ||
        prop === Symbol.toStringTag ||
        prop === Symbol.iterator ||
        prop === 'constructor' ||
        prop === 'inspect' ||
        prop === Symbol.for('nodejs.util.inspect.custom')
      ) {
        return undefined;
      }
      return tolak();
    },
    apply: tolak,
  }
);

export type DBTransaction = never;
