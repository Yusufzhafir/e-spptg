-- Autentikasi mandiri: mengganti Clerk dengan sessions + password hash.
--
-- Beberapa statement di bawah ditulis idempoten (IF NOT EXISTS / IF EXISTS).
-- Alasannya: database stag sudah menerima `Kecamatan` dan `assigned_kecamatan`
-- lewat `drizzle-kit push`, yang tidak mencatat apa pun di __drizzle_migrations,
-- sehingga `generate` memunculkannya lagi di sini. Statement tetap dipertahankan
-- (bukan dihapus) supaya database yang dibangun dari nol lewat 0000..0012 tetap
-- mendapat perubahan tersebut.
--
-- Catatan: di stag, 'Kecamatan' sudah terdaftar SETELAH 'Viewer', bukan sebelum
-- seperti yang dideklarasikan schema. Urutan enum hanya memengaruhi ORDER BY
-- pada kolom bertipe enum, dan tidak ada kueri yang bergantung padanya, jadi
-- tidak dilakukan rebuild tipe.

ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'Kecamatan' BEFORE 'Viewer';--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp NOT NULL,
	"user_agent" varchar(512),
	"ip_address" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_clerk_user_id_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assigned_kecamatan" varchar(255);--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "clerk_user_id";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");