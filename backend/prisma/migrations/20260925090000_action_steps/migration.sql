-- A to-do list on an upgrade action, worked through in order.
--
-- Timings are recorded rather than typed: started_at and completed_at give the
-- real duration, which is the only honest basis for estimating the next upgrade
-- of the same thing. estimate_minutes is what someone expected beforehand, kept
-- separate so the two can be compared.
CREATE TABLE "upgrade_action_step" (
  "id"                UUID         NOT NULL,
  "upgrade_action_id" UUID         NOT NULL,
  "title"             TEXT         NOT NULL,
  "position"          INTEGER      NOT NULL,
  "estimate_minutes"  INTEGER,
  "started_at"        TIMESTAMPTZ(3),
  "completed_at"      TIMESTAMPTZ(3),
  "completed_by_id"   UUID,
  "note"              TEXT,
  "created_at"        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "upgrade_action_step_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "upgrade_action_step_upgrade_action_id_position_idx"
  ON "upgrade_action_step" ("upgrade_action_id", "position");

-- Steps belong to their action and go with it.
ALTER TABLE "upgrade_action_step"
  ADD CONSTRAINT "upgrade_action_step_upgrade_action_id_fkey"
  FOREIGN KEY ("upgrade_action_id") REFERENCES "upgrade_action" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Whoever ticked it keeps their name on it, but removing an account must not
-- erase the step.
ALTER TABLE "upgrade_action_step"
  ADD CONSTRAINT "upgrade_action_step_completed_by_id_fkey"
  FOREIGN KEY ("completed_by_id") REFERENCES "app_user" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
