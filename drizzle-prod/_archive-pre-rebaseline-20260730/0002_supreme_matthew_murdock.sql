ALTER TABLE "status_history" ALTER COLUMN "status_before" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "status_history" ALTER COLUMN "status_after" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."status_spptg";--> statement-breakpoint
CREATE TYPE "public"."status_spptg" AS ENUM('SPPTG terdata', 'SPPTG terdaftar', 'SPPTG ditolak', 'SPPTG ditinjau ulang', 'Terbit SPPTG');--> statement-breakpoint
ALTER TABLE "status_history" ALTER COLUMN "status_before" SET DATA TYPE "public"."status_spptg" USING "status_before"::"public"."status_spptg";--> statement-breakpoint
ALTER TABLE "status_history" ALTER COLUMN "status_after" SET DATA TYPE "public"."status_spptg" USING "status_after"::"public"."status_spptg";--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DATA TYPE "public"."status_spptg" USING "status"::"public"."status_spptg";