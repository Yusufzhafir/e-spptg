CREATE TABLE "email_verification_tokens" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_idx" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens" USING btree ("expires_at");--> statement-breakpoint
-- Grandfather every account that existed before email verification was
-- introduced. Without this the column is NULL for all of them and `auth.login`
-- refuses every existing user — including the superadmins, with no way back in,
-- because "kirim ulang verifikasi" only mails accounts that are still pending.
-- Their addresses were vetted by whoever created them, so `created_at` is the
-- honest stamp: verified as of the moment the account came into being.
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;