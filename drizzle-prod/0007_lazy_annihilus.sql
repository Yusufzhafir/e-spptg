ALTER TABLE "users" ADD COLUMN "sso_sub" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sso_source" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_sso_sub_unique" UNIQUE("sso_sub");