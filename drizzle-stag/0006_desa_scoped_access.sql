ALTER TABLE "users" ADD COLUMN "assigned_village_id" bigint;
ALTER TABLE "submission_drafts" ADD COLUMN "village_id" bigint;
ALTER TABLE "submissions" ADD COLUMN "owner_user_id" bigint;

CREATE INDEX "users_assigned_village_idx" ON "users" ("assigned_village_id");
CREATE INDEX "submission_drafts_village_idx" ON "submission_drafts" ("village_id");
CREATE INDEX "submissions_owner_user_idx" ON "submissions" ("owner_user_id");
CREATE INDEX "submissions_village_idx" ON "submissions" ("village_id");
