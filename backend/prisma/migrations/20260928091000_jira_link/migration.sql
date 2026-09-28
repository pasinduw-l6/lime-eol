-- Linking an upgrade action to the Jira issue that carries the work.
--
-- Everything below is a mirror of Jira, refreshed by the worker. Nothing here
-- is a source of truth: if a column disagrees with Jira, Jira is right and the
-- next sync corrects it. The columns exist so the board renders without a
-- request to Jira on every page load, and so it still renders when Jira is
-- unreachable.

ALTER TABLE "upgrade_action"
  ADD COLUMN "jira_issue_id"        TEXT,
  ADD COLUMN "jira_url"             TEXT,
  ADD COLUMN "jira_status"          TEXT,
  ADD COLUMN "jira_status_category" TEXT,
  ADD COLUMN "jira_assignee"        TEXT,
  ADD COLUMN "jira_subtask_done"    INTEGER,
  ADD COLUMN "jira_subtask_total"   INTEGER,
  ADD COLUMN "jira_synced_at"       TIMESTAMPTZ(3),
  ADD COLUMN "jira_sync_error"      TEXT;

CREATE TABLE "jira_subtask" (
  "id"                UUID         NOT NULL,
  "upgrade_action_id" UUID         NOT NULL,
  "issue_key"         TEXT         NOT NULL,
  "issue_id"          TEXT         NOT NULL,
  "summary"           TEXT         NOT NULL,
  "status"            TEXT         NOT NULL,
  "status_category"   TEXT         NOT NULL,
  "assignee"          TEXT,
  "url"               TEXT         NOT NULL,
  "position"          INTEGER      NOT NULL,
  "synced_at"         TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "jira_subtask_pkey" PRIMARY KEY ("id")
);

-- Keyed on Jira's immutable issue id, not the key: an issue moved between
-- projects keeps its id but changes its key, and a re-sync must update that
-- row rather than insert a duplicate.
CREATE UNIQUE INDEX "jira_subtask_action_issue_key"
  ON "jira_subtask" ("upgrade_action_id", "issue_id");

CREATE INDEX "jira_subtask_action_position"
  ON "jira_subtask" ("upgrade_action_id", "position");

ALTER TABLE "jira_subtask"
  ADD CONSTRAINT "jira_subtask_upgrade_action_id_fkey"
  FOREIGN KEY ("upgrade_action_id") REFERENCES "upgrade_action"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
