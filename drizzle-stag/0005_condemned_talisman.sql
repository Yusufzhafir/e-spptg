ALTER TABLE "submission_drafts" ADD COLUMN "village_id" bigint;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "owner_user_id" bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "assigned_village_id" bigint;--> statement-breakpoint
CREATE INDEX "submission_drafts_village_idx" ON "submission_drafts" USING btree ("village_id");--> statement-breakpoint
CREATE INDEX "submissions_owner_user_idx" ON "submissions" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "submissions_village_idx" ON "submissions" USING btree ("villageId");--> statement-breakpoint
CREATE INDEX "users_assigned_village_idx" ON "users" USING btree ("assigned_village_id");