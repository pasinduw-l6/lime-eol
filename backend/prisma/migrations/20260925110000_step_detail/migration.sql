-- A platform upgrade runs over weeks or months, not an afternoon.
--
-- The first version of this table assumed one uninterrupted stretch of work and
-- an estimate in minutes. Real upgrades are picked up and put down across many
-- days, so elapsed time between one start and one finish measures the calendar
-- rather than the effort. spent_minutes accumulates instead, and started_at now
-- marks only the stretch currently running.
CREATE TYPE "StepStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

ALTER TABLE "upgrade_action_step"
  ADD COLUMN "description"    TEXT,
  ADD COLUMN "status"         "StepStatus" NOT NULL DEFAULT 'TODO',
  ADD COLUMN "spent_minutes"  INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN "due_date"       DATE,
  ADD COLUMN "assignee_id"    UUID,
  ADD COLUMN "blocked_reason" TEXT;

-- The old free-text note becomes the description.
UPDATE "upgrade_action_step" SET "description" = "note" WHERE "note" IS NOT NULL;
ALTER TABLE "upgrade_action_step" DROP COLUMN "note";

-- Existing rows carry their state forward: anything already ticked is DONE,
-- anything with a running clock is IN_PROGRESS.
UPDATE "upgrade_action_step" SET "status" = 'DONE' WHERE "completed_at" IS NOT NULL;
UPDATE "upgrade_action_step" SET "status" = 'IN_PROGRESS'
  WHERE "completed_at" IS NULL AND "started_at" IS NOT NULL;

-- And their measured effort, from the single span the old model recorded.
UPDATE "upgrade_action_step"
   SET "spent_minutes" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM ("completed_at" - "started_at")) / 60))
 WHERE "completed_at" IS NOT NULL AND "started_at" IS NOT NULL;

-- A finished step has no clock running.
UPDATE "upgrade_action_step" SET "started_at" = NULL WHERE "completed_at" IS NOT NULL;

CREATE INDEX "upgrade_action_step_assignee_id_idx"
  ON "upgrade_action_step" ("assignee_id");

ALTER TABLE "upgrade_action_step"
  ADD CONSTRAINT "upgrade_action_step_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "app_user" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
