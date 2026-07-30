# E-SPPTG — Runbook Deployment Docker On-Prem

Target: **satu host AlmaLinux 10**, domain `siaptah.kutaitimurkab.go.id`, IP publik
`103.222.254.244`, **port publik hanya 80 dan 443**.

Pembagian tugas:

| Komponen | Lokasi | Port |
|---|---|---|
| nginx (TLS, reverse proxy) | host | 80, 443 (publik) |
| Aplikasi Next.js | **Docker** | 127.0.0.1:3000 (privat) |
| PostgreSQL 16 + PostGIS | host | 127.0.0.1:5432 + bridge Docker (privat) |
| MinIO (API + console) | host | 127.0.0.1:9000 / 9001 (privat) |

Hanya aplikasi yang di-dockerize. PostgreSQL dan MinIO dipasang langsung di server.

## File yang dipakai

| File | Fungsi |
|---|---|
| [Dockerfile](../Dockerfile) | Image aplikasi (multi-stage, output `standalone`) + stage `migrator` |
| [docker-compose.yml](../docker-compose.yml) | Service `app` dan `migrate` |
| [.env.docker.example](../.env.docker.example) | Template `.env` produksi |
| [deploy/nginx/e-spptg.conf](../deploy/nginx/e-spptg.conf) | Konfigurasi nginx host |
| [deploy/postgres/init-db.sql](../deploy/postgres/init-db.sql) | Bootstrap role, database, extension PostGIS |
| [deploy/minio/minio.env](../deploy/minio/minio.env) | `/etc/default/minio` |
| [deploy/backup/espptg-backup.sh](../deploy/backup/espptg-backup.sh) | Backup harian DB + objek |
| [deploy/docker-compose.host-network.yml](../deploy/docker-compose.host-network.yml) | Override opsional: container pakai network host |

---

## 0. Keputusan penting: MinIO diakses lewat nginx

Download dokumen dan template memakai **presigned URL** yang dibuat di
[s3.ts](../src/server/s3/s3.ts) dari `S3_ENDPOINT`. Karena port 9000 tidak publik,
`S3_ENDPOINT` harus memakai domain publik dan nginx meneruskan path bucket ke MinIO:

```
https://siaptah.kutaitimurkab.go.id/spptg-files/<key>?X-Amz-Signature=...
        └── nginx location /spptg-files/ ──► 127.0.0.1:9000 (Host & path tidak diubah)
```

Konsekuensi:

1. `S3_FORCE_PATH_STYLE=true` **wajib** — MinIO tidak punya wildcard DNS per bucket.
   Tanpa ini SDK memakai `spptg-files.siaptah.kutaitimurkab.go.id` dan gagal resolve.
2. Nama bucket menjadi prefix path publik. Jangan bentrok dengan route aplikasi
   (`/`, `/app`, `/api`, `/sign-in`, `/sign-up`). Default yang dipakai: `spptg-files`.
3. `proxy_pass` MinIO **tanpa trailing slash** dan `Host` diteruskan apa adanya —
   tanda tangan SigV4 mencakup host + path, rewrite apa pun akan membuat
   `SignatureDoesNotMatch`.

Alternatif (kalau tim jaringan bisa menambah DNS + sertifikat): pakai subdomain
`s3.siaptah.kutaitimurkab.go.id`, lalu `S3_ENDPOINT`/`S3_PUBLIC_URL` diarahkan ke sana
dan blok `location /spptg-files/` dipindah ke server block subdomain tersebut.

---

## 1. Persiapan host

```bash
sudo dnf -y upgrade
sudo dnf -y install git rsync policycoreutils-python-utils
sudo timedatectl set-timezone Asia/Makassar
```

### Firewall — hanya 80/443 publik

```bash
sudo dnf -y install firewalld && sudo systemctl enable --now firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
# SSH sesuai kebijakan instansi (idealnya dibatasi source IP internal)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

Port 3000, 5432, 9000, 9001 tidak pernah dibuka: semuanya bind ke loopback/bridge.

---

## 2. Docker Engine

```bash
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
docker --version && docker compose version
```

> Kalau repo RHEL belum menyediakan paket untuk EL10, pakai repo CentOS dengan
> `--releasever`: `sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo`
> lalu `sudo dnf -y install docker-ce --releasever=9` sebagai fallback sementara.
> Verifikasi `docker run --rm hello-world` sebelum lanjut.

Batasi ukuran log global (opsional tapi disarankan) di `/etc/docker/daemon.json`:

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }
```

---

## 3. PostgreSQL 16 + PostGIS (di host)

```bash
sudo dnf -y module install postgresql:16/server   # AlmaLinux 10 AppStream
sudo dnf -y install epel-release
sudo dnf -y install postgis                        # cek nama paket: dnf search postgis
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
psql --version
```

> Verifikasi versi PostGIS tersedia sebelum lanjut (`dnf list postgis*`). Jika EPEL 10
> belum menyediakannya, pasang repo PGDG (`pgdg-redhat-repo` untuk EL10) dan gunakan
> paket `postgresql16-server` + `postgis3*_16`. Langkah selanjutnya sama.

### Izinkan koneksi dari container

Container tidak memakai network host (default compose), jadi PostgreSQL harus
mendengar di gateway bridge Docker (`172.17.0.1`).

`/var/lib/pgsql/data/postgresql.conf`:

```
listen_addresses = 'localhost,172.17.0.1'

# Tuning untuk 16 GB RAM, beban rendah
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 32MB
maintenance_work_mem = 512MB
max_connections = 100
wal_compression = on
```

`/var/lib/pgsql/data/pg_hba.conf` (tambahkan **sebelum** baris `host all all` lain):

```
# Aplikasi E-SPPTG dari container Docker
host    espptg    espptg    172.16.0.0/12    scram-sha-256
```

```bash
sudo systemctl restart postgresql
```

> Tidak mau mengubah `listen_addresses`/`pg_hba`? Pakai override
> [docker-compose.host-network.yml](../deploy/docker-compose.host-network.yml) agar
> container memakai network host dan cukup `127.0.0.1:5432`.

### Buat role, database, extension

```bash
sudo -u postgres psql -v espptg_password="'PASSWORD_KUAT'" \
  -f /path/ke/repo/deploy/postgres/init-db.sql
```

Extension `postgis` harus ada **sebelum** migrasi dijalankan — migrasi pertama
memakai tipe kolom `geometry(...)`.

---

## 4. MinIO (di host)

```bash
sudo useradd --system --shell /sbin/nologin minio-user
sudo mkdir -p /srv/minio/data && sudo chown -R minio-user:minio-user /srv/minio

# RPM resmi MinIO (sudah termasuk unit systemd minio.service)
curl -O https://dl.min.io/server/minio/release/linux-amd64/minio.rpm
sudo dnf -y install ./minio.rpm

sudo install -m 600 -o root -g root deploy/minio/minio.env /etc/default/minio
sudo vi /etc/default/minio      # isi MINIO_ROOT_PASSWORD
sudo systemctl enable --now minio
sudo systemctl status minio
```

SELinux untuk data di luar path default:

```bash
sudo semanage fcontext -a -t var_lib_t "/srv/minio(/.*)?"
sudo restorecon -Rv /srv/minio
```

### Bucket, service account, template

```bash
curl -O https://dl.min.io/client/mc/release/linux-amd64/mc
sudo install -m 755 mc /usr/local/bin/mc

mc alias set local http://127.0.0.1:9000 espptg-admin 'PASSWORD_ROOT_MINIO'
mc mb local/spptg-files                      # bucket tetap PRIVAT (default)
mc anonymous set none local/spptg-files      # pastikan tidak ada akses anonim

# Kredensial khusus aplikasi (jangan pakai root di .env)
mc admin user svcacct add local espptg-admin
# -> catat Access Key / Secret Key ke .env sebagai AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY

# Template dokumen resmi (dipakai documents.getTemplateUrl / fetchTemplatePDF)
mc cp --recursive ./template-documents/ local/spptg-files/template-documents/
```

Bucket sengaja privat: seluruh akses objek lewat presigned URL dari aplikasi.

---

## 5. nginx + TLS (di host)

Ketentuan instansi: **sertifikat wildcard** (`*.kutaitimurkab.go.id`), file
`fullchain.pem` + `privkey.pem` di `/opt/certs/`. Konfigurasi nginx sudah menunjuk
ke path tersebut — tidak ada certbot/Let's Encrypt di alur ini.

```bash
sudo dnf -y install nginx

# Sertifikat wildcard
sudo mkdir -p /opt/certs
sudo install -m 644 -o root -g root fullchain.pem /opt/certs/fullchain.pem
sudo install -m 600 -o root -g root privkey.pem   /opt/certs/privkey.pem

# SELinux: tanpa label cert_t, nginx gagal membaca /opt/certs (Permission denied)
sudo semanage fcontext -a -t cert_t "/opt/certs(/.*)?"
sudo restorecon -Rv /opt/certs

# nginx boleh connect ke upstream (app & MinIO) — tanpa ini muncul 502
sudo setsebool -P httpd_can_network_connect 1

sudo install -m 644 deploy/nginx/e-spptg.conf /etc/nginx/conf.d/e-spptg.conf
sudo nginx -t && sudo systemctl enable --now nginx
```

Verifikasi rantai sertifikat dan kecocokan kunci sebelum reload:

```bash
# Domain harus tercakup wildcard (SAN *.kutaitimurkab.go.id)
openssl x509 -in /opt/certs/fullchain.pem -noout -subject -ext subjectAltName -dates
# Modulus sertifikat dan privkey harus identik
openssl x509 -in /opt/certs/fullchain.pem -noout -modulus | openssl md5
openssl rsa  -in /opt/certs/privkey.pem   -noout -modulus | openssl md5
# Rantai lengkap dari luar (jangan ada "unable to get local issuer certificate")
openssl s_client -connect siaptah.kutaitimurkab.go.id:443 \
  -servername siaptah.kutaitimurkab.go.id </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer
```

Catatan wildcard:

- `*.kutaitimurkab.go.id` mencakup `siaptah.kutaitimurkab.go.id`, **tidak** mencakup
  apex `kutaitimurkab.go.id` maupun sub-sub-domain dua tingkat. Aplikasi hanya memakai
  satu subdomain, jadi aman.
- Karena wildcard, alternatif subdomain storage di bagian 0 (misal
  `siaptah-files.kutaitimurkab.go.id`) bisa dipakai **tanpa sertifikat baru** — cukup
  tambah record DNS dan satu server block. Ini opsi paling bersih kalau nanti prefix
  path bucket dirasa mengganggu.
- Sertifikat wildcard biasanya diperbarui manual/DNS-01 oleh tim infra. Catat tanggal
  kedaluwarsa; setelah file diganti jalankan `sudo restorecon -Rv /opt/certs` lalu
  `sudo systemctl reload nginx`.

---

## 6. Konfigurasi aplikasi

```bash
sudo mkdir -p /opt/e-spptg && sudo chown "$USER" /opt/e-spptg
git clone <repo-url> /opt/e-spptg && cd /opt/e-spptg
git checkout main

cp .env.docker.example .env
chmod 600 .env
vi .env
```

Yang wajib diisi: kunci Clerk, kunci Google Maps, `DATABASE_URL` +
`DATABASE_URL_DDL`, kredensial MinIO. Nilai S3 di template sudah sesuai
keputusan bagian 0.

> `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` dan `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
> di-inline saat build. Mengubahnya **wajib rebuild image**, restart saja tidak cukup.

Di dashboard Clerk: tambahkan `https://siaptah.kutaitimurkab.go.id` sebagai domain
aplikasi. Di Google Cloud Console: batasi API key ke referrer domain tersebut.
Server tetap butuh **outbound HTTPS** ke Clerk dan Google Maps.

---

## 7. Build, migrasi, jalankan

```bash
cd /opt/e-spptg

# 1) Build image (sekaligus type check via `next build`)
docker compose build

# 2) Migrasi database — sekali jalan, container langsung dihapus
docker compose --profile tools run --rm migrate

# 3) Jalankan aplikasi
docker compose up -d

docker compose ps
docker compose logs -f app
```

Migrasi memakai folder [drizzle-prod/](../drizzle-prod/) (`prod.drizzle.config.ts`),
bukan `drizzle-stag/`. Config itu membaca `DATABASE_URL_DDL` dari environment
container — file `.env.development.prod` tidak ikut ke image.

### Superadmin pertama

Login pertama membuat baris `users` dengan peran `Viewer`. Naikkan manual sekali:

```bash
sudo -u postgres psql -d espptg -c \
  "UPDATE users SET peran = 'Superadmin' WHERE email = 'admin@kutaitimurkab.go.id';"
```

Selanjutnya penambahan user dilakukan dari dalam aplikasi.

---

## 8. Validasi (checklist rilis)

| # | Uji | Cara |
|---|---|---|
| 1 | Container sehat | `docker compose ps` → `healthy` |
| 2 | HTTPS + redirect | `curl -I http://siaptah.kutaitimurkab.go.id` → 301; `curl -I https://…` → 200 |
| 3 | Login Clerk dari jaringan pemda | login sampai masuk `/app` |
| 4 | Upload PDF 10 MB | via wizard Step 1, lalu `mc ls local/spptg-files/submissions/` |
| 5 | Download dokumen | klik unduh → presigned URL ke domain (bukan `:9000`), file terbuka |
| 6 | Cek overlap PostGIS | submission dengan poligon → Step 3 menampilkan hasil |
| 7 | Generate PDF SPPTG | Step 4 sampai file SPPTG tersimpan sebagai dokumen `SPPG` |
| 8 | Drill restore | lihat bagian 9 |

Uji 5 adalah yang paling sering gagal di on-prem. Kalau muncul
`SignatureDoesNotMatch`, penyebabnya hampir selalu: `S3_FORCE_PATH_STYLE` bukan
`true`, `proxy_pass` MinIO memakai trailing slash (path di-rewrite), atau `Host`
header tidak diteruskan.

---

## 9. Backup & restore (wajib sebelum dinyatakan produksi)

```bash
sudo install -m 750 deploy/backup/espptg-backup.sh /usr/local/bin/espptg-backup.sh
sudo install -m 644 deploy/backup/espptg-backup.cron /etc/cron.d/espptg-backup
sudo vi /etc/cron.d/espptg-backup     # isi BACKUP_REMOTE (target di LUAR server ini)
sudo mkdir -p /srv/backup/e-spptg
sudo BACKUP_REMOTE=user@nas:/backup/e-spptg /usr/local/bin/espptg-backup.sh
```

Drill restore (lakukan sekali, ke database uji — **jangan** ke `espptg` produksi):

```bash
sudo -u postgres createdb espptg_restore_test
sudo -u postgres psql -d espptg_restore_test -c 'CREATE EXTENSION postgis;'
sudo -u postgres pg_restore -d espptg_restore_test /srv/backup/e-spptg/<STAMP>/espptg.dump
sudo -u postgres psql -d espptg_restore_test -c 'SELECT count(*) FROM submissions;'

# Satu objek dari backup
mc cp /srv/backup/e-spptg/<STAMP>/objects/<key> local/spptg-files-restore-test/
```

Tanpa target backup kedua di luar server ini, deployment dianggap **belum lengkap**.

---

## 10. Operasi harian

```bash
# Deploy versi baru
cd /opt/e-spptg && git pull
docker compose build
docker compose --profile tools run --rm migrate   # kalau ada migrasi baru
docker compose up -d
docker image prune -f

# Log & status
docker compose logs -f --tail=200 app
sudo tail -f /var/log/nginx/e-spptg.error.log

# Restart cepat (tanpa rebuild)
docker compose restart app

# Rollback: build ulang dari commit sebelumnya
git checkout <commit-lama> && docker compose build && docker compose up -d
```

Kapasitas (asumsi 32.000 pengajuan × 500 KB DB + 500 KB objek ≈ 31 GiB data mentah)
sesuai spesifikasi: pantau `df -h /var/lib/pgsql /srv/minio /srv/backup` dan
`docker system df`. Upgrade pertama yang disarankan bila terasa sempit adalah
**RAM 32 GB**, bukan tambah CPU.

## Catatan perubahan kode

Dockerisasi ini menyentuh dua file aplikasi (keduanya minimal dan backward compatible):

1. [next.config.ts](../next.config.ts)
   - `output: "standalone"` — image runtime hanya berisi `server.js` + dependency
     yang benar-benar dipakai.
   - `outputFileTracingRoot` + `turbopack.root` dipin ke folder project. Tanpa ini,
     lockfile di folder induk membuat Next menebak root di luar project dan output
     jadi bersarang (`.next/standalone/Website/e-spptg/server.js`), sehingga `COPY`
     di Dockerfile gagal. Ini benar-benar terjadi saat verifikasi build.
   - `images.remotePatterns` kosong bila `S3_BUCKET_NAME`/`S3_DOMAIN` tidak diset
     (sebelumnya menghasilkan hostname `"."` yang invalid).
2. [src/server/s3/s3.ts](../src/server/s3/s3.ts) — opsi `forcePathStyle` dari
   `S3_FORCE_PATH_STYLE`. Default `false`, jadi perilaku Biznet NEO tidak berubah.

### Kenapa NEXT_PUBLIC_* harus jadi build arg

`pnpm build` berjalan dengan `NODE_ENV=production`, dan Next **tidak** membaca
`.env.development.local` pada mode itu. Build tanpa `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
gagal saat prerender `/_not-found` dengan
`@clerk/nextjs: Missing publishableKey` — sudah diverifikasi. Karena itu compose
mengirimkan nilainya sebagai build arg dari `.env`.
