ALTER TABLE "submission_drafts" ADD COLUMN IF NOT EXISTS "village_id" bigint;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "is_valid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "owner_user_id" bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assigned_village_id" bigint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submission_drafts_village_idx" ON "submission_drafts" USING btree ("village_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submissions_owner_user_idx" ON "submissions" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submissions_village_idx" ON "submissions" USING btree ("villageId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_assigned_village_idx" ON "users" USING btree ("assigned_village_id");
