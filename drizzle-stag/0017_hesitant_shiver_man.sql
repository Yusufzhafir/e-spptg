-- Rebuilds prohibited_area_type around the 14 official jenis kawasan.
-- Postgres cannot drop a value from an enum, so the columns detour through
-- text: that window is also the only place the old names can be renamed,
-- because the new type does not contain them yet.
--
-- Renamed:  'Hutan Lindung'  -> 'Kawasan Hutan'
--           'Aset TNI/POLRI' -> 'Tanah TNI/Polri'
-- Dropped:  'Cagar Alam', 'Kawasan Rawan Bencana', 'Lainnya'  (no rows in any
--           known database; the guard below stops the migration if that is not
--           true wherever this runs, instead of failing later with a bare
--           "invalid input value for enum").
DO $$
DECLARE sisa text;
BEGIN
  SELECT string_agg(DISTINCT jenis, ', ') INTO sisa
  FROM (
    SELECT jenis_kawasan::text AS jenis FROM prohibited_areas
    UNION ALL
    SELECT jenis_kawasan::text FROM overlap_results
  ) t
  WHERE jenis IN ('Cagar Alam', 'Kawasan Rawan Bencana', 'Lainnya');

  IF sisa IS NOT NULL THEN
    RAISE EXCEPTION
      'Migrasi dibatalkan: masih ada kawasan berjenis %. Pindahkan dulu ke salah satu dari 14 jenis yang baru.', sisa;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "overlap_results" ALTER COLUMN "jenis_kawasan" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "prohibited_areas" ALTER COLUMN "jenis_kawasan" SET DATA TYPE text;--> statement-breakpoint
UPDATE "prohibited_areas" SET "jenis_kawasan" = 'Kawasan Hutan' WHERE "jenis_kawasan" = 'Hutan Lindung';--> statement-breakpoint
UPDATE "prohibited_areas" SET "jenis_kawasan" = 'Tanah TNI/Polri' WHERE "jenis_kawasan" = 'Aset TNI/POLRI';--> statement-breakpoint
UPDATE "overlap_results" SET "jenis_kawasan" = 'Kawasan Hutan' WHERE "jenis_kawasan" = 'Hutan Lindung';--> statement-breakpoint
UPDATE "overlap_results" SET "jenis_kawasan" = 'Tanah TNI/Polri' WHERE "jenis_kawasan" = 'Aset TNI/POLRI';--> statement-breakpoint
DROP TYPE "public"."prohibited_area_type";--> statement-breakpoint
CREATE TYPE "public"."prohibited_area_type" AS ENUM('Kawasan Hutan', 'Hak Guna Usaha', 'Hak Guna Bangunan', 'Hak Pakai', 'Hak Pengelolaan', 'Hak Pengelolaan Transmigrasi', 'Hak Milik', 'Areal SPPT yang sudah terbit', 'Kawasan Industri', 'Tanah Pemerintah', 'Tanah TNI/Polri', 'Fasum/Fasos', 'Sempadan Sungai', 'Sempadan Pantai');--> statement-breakpoint
ALTER TABLE "overlap_results" ALTER COLUMN "jenis_kawasan" SET DATA TYPE "public"."prohibited_area_type" USING "jenis_kawasan"::"public"."prohibited_area_type";--> statement-breakpoint
ALTER TABLE "prohibited_areas" ALTER COLUMN "jenis_kawasan" SET DATA TYPE "public"."prohibited_area_type" USING "jenis_kawasan"::"public"."prohibited_area_type";
