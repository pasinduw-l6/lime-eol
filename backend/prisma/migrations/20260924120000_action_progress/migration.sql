-- Per-environment progress on an upgrade action.
-- A rollout runs DEV, then UAT, then PROD over weeks; one status across all
-- three cannot say which is still outstanding, which is exactly what anyone
-- chasing a deadline needs to know.
ALTER TABLE "upgrade_action_deployment" ADD COLUMN "completed_at" DATE;
