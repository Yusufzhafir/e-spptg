-- Custom SQL migration file, put your code below! --
CREATE EXTENSION IF NOT EXISTS plpgsql;
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT postgis_extensions_upgrade();