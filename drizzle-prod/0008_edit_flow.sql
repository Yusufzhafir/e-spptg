ALTER TABLE "submission_drafts" ADD COLUMN IF NOT EXISTS "editing_submission_id" bigint;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "payload" jsonb;
