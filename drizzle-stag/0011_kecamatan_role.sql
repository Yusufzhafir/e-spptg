ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'Kecamatan';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assigned_kecamatan" varchar(255);
