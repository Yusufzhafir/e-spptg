-- E-SPPTG — bootstrap database di PostgreSQL host (bukan di Docker).
-- Jalankan sebagai superuser postgres:
--   sudo -u postgres psql -v espptg_password="'PASSWORD_KUAT'" -f init-db.sql
--
-- Urutan penting: extension postgis HARUS ada sebelum migrasi Drizzle
-- dijalankan, karena migrasi 0000 memakai tipe kolom geometry(...).

-- 1) Role aplikasi
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'espptg') THEN
    CREATE ROLE espptg LOGIN PASSWORD :'espptg_password';
  END IF;
END
$$;

-- 2) Database
SELECT 'CREATE DATABASE espptg OWNER espptg ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'espptg')\gexec

-- 3) Extension di dalam database espptg
\connect espptg

CREATE EXTENSION IF NOT EXISTS postgis;

-- Drizzle membuat objek di schema public; pastikan role app bisa DDL di sana.
GRANT ALL ON SCHEMA public TO espptg;
ALTER SCHEMA public OWNER TO espptg;

-- Verifikasi
SELECT current_database() AS db, postgis_full_version() AS postgis;
