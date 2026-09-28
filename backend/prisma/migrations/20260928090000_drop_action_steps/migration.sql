-- The to-do list is removed.
--
-- Task breakdown belongs in Jira, which already owns sub-tasks, worklogs,
-- permissions and an audit trail. This registry keeps what Jira cannot know:
-- which technology runs out of support when, on whose installation, and
-- whether the upgrade actually landed.

DROP TABLE IF EXISTS "upgrade_action_step";
DROP TYPE IF EXISTS "StepStatus";
