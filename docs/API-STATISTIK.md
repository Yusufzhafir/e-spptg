# API Statistik SIAPTAH

API baca-saja untuk integrasi ke dashboard eksekutif. Mengembalikan **data agregat**
pengajuan SPPTG — jumlah per status, tren bulanan, dan rekap per desa. API ini
**tidak** memuat data pribadi pemohon (nama, NIK, alamat) dan tidak menyediakan
operasi tulis apa pun.

- Base URL: `https://siaptah.kutaitimurkab.go.id`
- Format: JSON (`application/json; charset=utf-8`)
- Metode: `GET` saja
- Sifat: realtime — setiap permintaan dihitung ulang dari database, respons
  dikirim dengan `Cache-Control: no-store`

## Autentikasi

Setiap permintaan wajib membawa dua header:

| Header | Isi |
|---|---|
| `X-Client-Id` | Client ID yang diberikan pengelola aplikasi (mis. `dashboard-eksekutif`) |
| `X-API-Key` | Secret yang menyertai Client ID tersebut |

Kredensial diterbitkan oleh pengelola SIAPTAH dan disimpan di sisi server
(variabel `STATISTIK_API_CLIENTS`). Kalau perlu dicabut atau diganti, hubungi
pengelola — penggantian berlaku setelah aplikasi di-restart.

**Panggilan harus dari server ke server.** Tidak ada header CORS yang dikirim,
jadi memanggil API ini langsung dari browser akan diblokir — dan memang
disengaja: API key tidak boleh sampai ke browser pengguna.

Selain kredensial, ada pembatasan IP: hanya IP publik yang terdaftar di
`STATISTIK_API_ALLOWED_IPS` yang dilayani. Kirimkan IP publik server dashboard
ke pengelola untuk didaftarkan. Selama daftar itu masih kosong, semua IP
diterima — ini kondisi sementara untuk masa uji coba.

Batas laju: **500 permintaan per menit per client**.

## Parameter (opsional, berlaku di semua endpoint)

| Parameter | Format | Keterangan |
|---|---|---|
| `dari` | `YYYY-MM-DD` | Batas bawah tanggal pengajuan |
| `sampai` | `YYYY-MM-DD` | Batas atas tanggal pengajuan |
| `kecamatan` | teks | Nama kecamatan (tidak membedakan huruf besar/kecil) |
| `desaId` | angka | Id desa |

`kecamatan` dan `desaId` bisa dipakai bersamaan — keduanya mempersempit hasil.
Nama kecamatan dicocokkan lewat data desa (tabel `villages`), bukan teks bebas
pada pengajuan, sehingga hasilnya konsisten dengan rekap per desa.

Tanpa parameter, hasilnya mencakup seluruh data. Angka yang dikembalikan hanya
menghitung pengajuan yang berstatus valid — sama persis dengan angka yang
tampil di dashboard internal SIAPTAH.

## Endpoint

### `GET /api/statistik`

Indeks + uji koneksi. Balasan `200` berarti Client ID, API key, dan IP sudah benar.

### `GET /api/statistik/ringkasan`

Jumlah pengajuan per status beserta totalnya.

```json
{
  "sukses": true,
  "waktu": "2026-07-31T02:15:04.221Z",
  "filter": { "dari": null, "sampai": null, "kecamatan": null, "desaId": null },
  "data": {
    "total": 1284,
    "perStatus": {
      "SPPTG terdata": 402,
      "SPPTG terdaftar": 655,
      "SPPTG ditolak": 88,
      "SPPTG ditinjau ulang": 121,
      "Terbit SPPTG": 18
    }
  }
}
```

Kelima status selalu ada meski nilainya 0, jadi dashboard bisa memetakan kunci
yang tetap tanpa perlu menangani kunci yang hilang.

### `GET /api/statistik/tren-bulanan`

Jumlah pengajuan per bulan, urut naik. Bulan tanpa pengajuan tidak muncul.

```json
{
  "sukses": true,
  "waktu": "2026-07-31T02:15:04.221Z",
  "filter": { "dari": "2026-01-01", "sampai": "2026-07-31", "kecamatan": null, "desaId": null },
  "data": [
    { "bulan": "2026-01", "jumlah": 143 },
    { "bulan": "2026-02", "jumlah": 168 }
  ]
}
```

### `GET /api/statistik/per-desa`

Rekap per desa, urut dari yang terbanyak.

```json
{
  "sukses": true,
  "waktu": "2026-07-31T02:15:04.221Z",
  "filter": { "dari": null, "sampai": null, "kecamatan": "Sangatta Utara", "desaId": null },
  "data": [
    {
      "desaId": 12,
      "desa": "Singa Geweh",
      "kecamatan": "Sangatta Selatan",
      "total": 96,
      "perStatus": {
        "SPPTG terdata": 30,
        "SPPTG terdaftar": 51,
        "SPPTG ditolak": 6,
        "SPPTG ditinjau ulang": 8,
        "Terbit SPPTG": 1
      }
    }
  ]
}
```

Catatan: pengajuan yang belum terhubung ke desa mana pun tidak ikut terhitung di
sini, sehingga jumlah seluruh `total` bisa lebih kecil daripada `total` di
`/ringkasan`.

## Penanganan galat

Semua galat memakai bentuk yang sama:

```json
{ "sukses": false, "kode": "KREDENSIAL_TIDAK_VALID", "pesan": "..." }
```

| HTTP | `kode` | Artinya |
|---|---|---|
| 400 | `PARAMETER_TIDAK_VALID` | Format `dari`/`sampai`/`desaId` salah |
| 401 | `KREDENSIAL_TIDAK_VALID` | Client ID atau API key salah/tidak dikirim |
| 403 | `IP_TIDAK_DIIZINKAN` | IP pemanggil belum didaftarkan |
| 429 | `TERLALU_BANYAK_PERMINTAAN` | Melewati batas laju; lihat header `Retry-After` |
| 500 | `KESALAHAN_SERVER` | Kegagalan di sisi SIAPTAH |
| 503 | `API_BELUM_DIKONFIGURASI` | Kredensial API belum dipasang di server |

## Contoh

```bash
curl -sS 'https://siaptah.kutaitimurkab.go.id/api/statistik/ringkasan' \
  -H 'X-Client-Id: dashboard-eksekutif' \
  -H 'X-API-Key: RAHASIA'

curl -sS 'https://siaptah.kutaitimurkab.go.id/api/statistik/tren-bulanan?dari=2026-01-01&sampai=2026-12-31' \
  -H 'X-Client-Id: dashboard-eksekutif' \
  -H 'X-API-Key: RAHASIA'
```

```php
<?php
// Contoh sisi server (PHP). Jangan panggil dari JavaScript di browser —
// API key akan ikut terkirim ke pengguna.
$ch = curl_init('https://siaptah.kutaitimurkab.go.id/api/statistik/ringkasan');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'X-Client-Id: dashboard-eksekutif',
        'X-API-Key: ' . getenv('SIAPTAH_API_KEY'),
    ],
]);
$data = json_decode(curl_exec($ch), true);
```

## Untuk pengelola SIAPTAH

Mengaktifkan API di server:

1. Buat secret: `openssl rand -base64 32`
2. Isi di `.env` server:
   ```
   STATISTIK_API_CLIENTS=dashboard-eksekutif:SECRET_HASIL_LANGKAH_1
   STATISTIK_API_ALLOWED_IPS=103.10.20.30
   ```
3. `docker compose up -d` (restart container aplikasi)

Kalau `STATISTIK_API_CLIENTS` kosong, seluruh endpoint membalas `503` — jadi API
ini mati secara default dan hanya hidup setelah sengaja dikonfigurasi.

Kode terkait: [`src/server/public-api/`](../src/server/public-api/) (autentikasi
client, allowlist IP, bentuk respons) dan
[`src/app/api/statistik/`](../src/app/api/statistik/) (route handler).
