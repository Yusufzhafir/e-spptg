#!/usr/bin/env bash
# E-SPPTG — backup harian PostgreSQL + object storage MinIO.
#
# Pasang: /usr/local/bin/espptg-backup.sh (chmod 750, owner root)
# Jadwal: lihat deploy/backup/espptg-backup.cron
#
# WAJIB: BACKUP_REMOTE menunjuk ke target di LUAR server ini (NAS, server lain,
# atau bucket MinIO/S3 remote). Backup yang hanya tinggal di host yang sama
# tidak melindungi dari kegagalan disk/host.
set -euo pipefail

PGUSER_APP="espptg"
PGDATABASE_APP="espptg"
MINIO_ALIAS="local"                 # alias `mc` ke http://127.0.0.1:9000
MINIO_BUCKET="spptg-files"
STAGING="/srv/backup/e-spptg"
RETENTION_DAYS=14
BACKUP_REMOTE="${BACKUP_REMOTE:-}"  # contoh: user@nas:/backup/e-spptg

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${STAGING}/${STAMP}"
mkdir -p "${DEST}"

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }

# --- PostgreSQL -------------------------------------------------------------
# Format custom (-Fc) supaya bisa pg_restore selektif.
log "dump database ${PGDATABASE_APP}"
sudo -u postgres pg_dump -Fc -d "${PGDATABASE_APP}" -f "${DEST}/${PGDATABASE_APP}.dump"

# Role & grant tidak ikut pg_dump satu database.
log "dump globals (roles)"
sudo -u postgres pg_dumpall --globals-only > "${DEST}/globals.sql"

# --- Object storage ---------------------------------------------------------
log "mirror bucket ${MINIO_BUCKET}"
mc mirror --overwrite --remove "${MINIO_ALIAS}/${MINIO_BUCKET}" "${DEST}/objects"

# --- Manifest ---------------------------------------------------------------
{
  echo "timestamp=${STAMP}"
  echo "host=$(hostname -f)"
  du -sh "${DEST}"/* 2>/dev/null || true
} > "${DEST}/MANIFEST.txt"

# --- Kirim ke target kedua (di luar server ini) -----------------------------
if [[ -n "${BACKUP_REMOTE}" ]]; then
  log "sinkronisasi ke ${BACKUP_REMOTE}"
  rsync -a --delete-delay "${DEST}/" "${BACKUP_REMOTE}/${STAMP}/"
else
  log "PERINGATAN: BACKUP_REMOTE kosong — backup hanya ada di host ini. Deployment dianggap BELUM lengkap."
fi

# --- Retensi lokal ----------------------------------------------------------
find "${STAGING}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +

log "selesai: ${DEST}"
