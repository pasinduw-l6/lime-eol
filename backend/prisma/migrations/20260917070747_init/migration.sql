-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('DATABASE', 'RUNTIME', 'FRAMEWORK', 'OS', 'CONTAINER', 'ORCHESTRATION', 'MESSAGING', 'LIBRARY', 'OTHER');

-- CreateEnum
CREATE TYPE "CycleRule" AS ENUM ('MAJOR', 'MAJOR_MINOR');

-- CreateEnum
CREATE TYPE "EolField" AS ENUM ('EOL', 'EOAS', 'EOES');

-- CreateEnum
CREATE TYPE "EolSource" AS ENUM ('API', 'MANUAL');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('DEV', 'UAT', 'PROD');

-- CreateEnum
CREATE TYPE "DeploymentLocation" AS ENUM ('EC2', 'CUSTOMER_SITE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('NOT_STARTED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "CommStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SENT', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'TEAMS');

-- CreateTable
CREATE TABLE "technology" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "component_type" "ComponentType" NOT NULL,
    "vendor" TEXT,
    "eol_slug" TEXT,
    "cycle_rule" "CycleRule" NOT NULL DEFAULT 'MAJOR',
    "eol_field" "EolField" NOT NULL DEFAULT 'EOL',
    "reference_url" TEXT,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "technology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technology_cycle" (
    "id" UUID NOT NULL,
    "technology_id" UUID NOT NULL,
    "cycle" TEXT NOT NULL,
    "label" TEXT,
    "release_date" DATE,
    "eol_date" DATE,
    "active_support_end" DATE,
    "extended_support_end" DATE,
    "is_lts" BOOLEAN NOT NULL DEFAULT false,
    "is_maintained" BOOLEAN NOT NULL DEFAULT true,
    "latest_patch" TEXT,
    "latest_patch_date" DATE,
    "eol_source" "EolSource" NOT NULL DEFAULT 'API',
    "last_synced_at" TIMESTAMPTZ(3),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "technology_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technology_version" (
    "id" UUID NOT NULL,
    "technology_cycle_id" UUID NOT NULL,
    "full_version" TEXT NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER,
    "patch" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "technology_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technology_cycle_history" (
    "id" UUID NOT NULL,
    "technology_cycle_id" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "source" "EolSource" NOT NULL DEFAULT 'API',
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technology_cycle_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lime_version" (
    "id" UUID NOT NULL,
    "version_number" TEXT NOT NULL,
    "release_date" DATE,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lime_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lime_version_component" (
    "lime_version_id" UUID NOT NULL,
    "tech_version_id" UUID NOT NULL,

    CONSTRAINT "lime_version_component_pkey" PRIMARY KEY ("lime_version_id","tech_version_id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contact" TEXT,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "lime_version_id" UUID,
    "name" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "location" "DeploymentLocation" NOT NULL,
    "location_detail" TEXT,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_owner" (
    "deployment_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "deployment_owner_pkey" PRIMARY KEY ("deployment_id","team_id")
);

-- CreateTable
CREATE TABLE "deployment_component" (
    "deployment_id" UUID NOT NULL,
    "tech_version_id" UUID NOT NULL,

    CONSTRAINT "deployment_component_pkey" PRIMARY KEY ("deployment_id","tech_version_id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "teams_webhook_url" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "entra_oid" TEXT,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateTable
CREATE TABLE "upgrade_action" (
    "id" UUID NOT NULL,
    "technology_cycle_id" UUID NOT NULL,
    "team_id" UUID,
    "assignee_id" UUID,
    "target_version" TEXT,
    "planned_date" DATE,
    "completed_date" DATE,
    "status" "ActionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "jira_key" TEXT,
    "customer_comm" "CommStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "customer_comm_notes" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "upgrade_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upgrade_action_deployment" (
    "upgrade_action_id" UUID NOT NULL,
    "deployment_id" UUID NOT NULL,

    CONSTRAINT "upgrade_action_deployment_pkey" PRIMARY KEY ("upgrade_action_id","deployment_id")
);

-- CreateTable
CREATE TABLE "notification_rule" (
    "id" UUID NOT NULL,
    "threshold_days" INTEGER NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "teams_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" UUID NOT NULL,
    "technology_cycle_id" UUID NOT NULL,
    "upgrade_action_id" UUID,
    "reference_date" DATE NOT NULL,
    "threshold_days" INTEGER NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eol_sync_log" (
    "id" UUID NOT NULL,
    "technology_id" UUID,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "changes" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "raw_response" JSONB,

    CONSTRAINT "eol_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "action" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technology_name_key" ON "technology"("name");

-- CreateIndex
CREATE UNIQUE INDEX "technology_eol_slug_key" ON "technology"("eol_slug");

-- CreateIndex
CREATE INDEX "technology_archived_at_idx" ON "technology"("archived_at");

-- CreateIndex
CREATE INDEX "technology_cycle_eol_date_idx" ON "technology_cycle"("eol_date");

-- CreateIndex
CREATE INDEX "technology_cycle_eol_source_idx" ON "technology_cycle"("eol_source");

-- CreateIndex
CREATE UNIQUE INDEX "technology_cycle_technology_id_cycle_key" ON "technology_cycle"("technology_id", "cycle");

-- CreateIndex
CREATE INDEX "technology_version_technology_cycle_id_major_minor_patch_idx" ON "technology_version"("technology_cycle_id", "major", "minor", "patch");

-- CreateIndex
CREATE UNIQUE INDEX "technology_version_technology_cycle_id_full_version_key" ON "technology_version"("technology_cycle_id", "full_version");

-- CreateIndex
CREATE INDEX "technology_cycle_history_technology_cycle_id_changed_at_idx" ON "technology_cycle_history"("technology_cycle_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "lime_version_version_number_key" ON "lime_version"("version_number");

-- CreateIndex
CREATE INDEX "lime_version_component_tech_version_id_idx" ON "lime_version_component"("tech_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_name_key" ON "customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "customer_code_key" ON "customer"("code");

-- CreateIndex
CREATE INDEX "customer_archived_at_idx" ON "customer"("archived_at");

-- CreateIndex
CREATE INDEX "deployment_environment_idx" ON "deployment"("environment");

-- CreateIndex
CREATE INDEX "deployment_archived_at_idx" ON "deployment"("archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "deployment_customer_id_name_environment_key" ON "deployment"("customer_id", "name", "environment");

-- CreateIndex
CREATE INDEX "deployment_owner_team_id_idx" ON "deployment_owner"("team_id");

-- CreateIndex
CREATE INDEX "deployment_component_tech_version_id_idx" ON "deployment_component"("tech_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_name_key" ON "team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_entra_oid_key" ON "app_user"("entra_oid");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "team_member_user_id_idx" ON "team_member"("user_id");

-- CreateIndex
CREATE INDEX "upgrade_action_status_planned_date_idx" ON "upgrade_action"("status", "planned_date");

-- CreateIndex
CREATE INDEX "upgrade_action_technology_cycle_id_idx" ON "upgrade_action"("technology_cycle_id");

-- CreateIndex
CREATE INDEX "upgrade_action_assignee_id_idx" ON "upgrade_action"("assignee_id");

-- CreateIndex
CREATE INDEX "upgrade_action_deployment_deployment_id_idx" ON "upgrade_action_deployment"("deployment_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_rule_threshold_days_key" ON "notification_rule"("threshold_days");

-- CreateIndex
CREATE INDEX "notification_log_sent_at_idx" ON "notification_log"("sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_log_technology_cycle_id_reference_date_thresho_key" ON "notification_log"("technology_cycle_id", "reference_date", "threshold_days", "recipient", "channel");

-- CreateIndex
CREATE INDEX "eol_sync_log_started_at_idx" ON "eol_sync_log"("started_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "technology_cycle" ADD CONSTRAINT "technology_cycle_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technology"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technology_version" ADD CONSTRAINT "technology_version_technology_cycle_id_fkey" FOREIGN KEY ("technology_cycle_id") REFERENCES "technology_cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technology_cycle_history" ADD CONSTRAINT "technology_cycle_history_technology_cycle_id_fkey" FOREIGN KEY ("technology_cycle_id") REFERENCES "technology_cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lime_version_component" ADD CONSTRAINT "lime_version_component_lime_version_id_fkey" FOREIGN KEY ("lime_version_id") REFERENCES "lime_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lime_version_component" ADD CONSTRAINT "lime_version_component_tech_version_id_fkey" FOREIGN KEY ("tech_version_id") REFERENCES "technology_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_lime_version_id_fkey" FOREIGN KEY ("lime_version_id") REFERENCES "lime_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_owner" ADD CONSTRAINT "deployment_owner_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_owner" ADD CONSTRAINT "deployment_owner_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_component" ADD CONSTRAINT "deployment_component_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_component" ADD CONSTRAINT "deployment_component_tech_version_id_fkey" FOREIGN KEY ("tech_version_id") REFERENCES "technology_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrade_action" ADD CONSTRAINT "upgrade_action_technology_cycle_id_fkey" FOREIGN KEY ("technology_cycle_id") REFERENCES "technology_cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrade_action" ADD CONSTRAINT "upgrade_action_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrade_action" ADD CONSTRAINT "upgrade_action_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrade_action_deployment" ADD CONSTRAINT "upgrade_action_deployment_upgrade_action_id_fkey" FOREIGN KEY ("upgrade_action_id") REFERENCES "upgrade_action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrade_action_deployment" ADD CONSTRAINT "upgrade_action_deployment_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_technology_cycle_id_fkey" FOREIGN KEY ("technology_cycle_id") REFERENCES "technology_cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_upgrade_action_id_fkey" FOREIGN KEY ("upgrade_action_id") REFERENCES "upgrade_action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eol_sync_log" ADD CONSTRAINT "eol_sync_log_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technology"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Business rules expressed in the database
-- ---------------------------------------------------------------------------

-- A completed upgrade must say when it completed, and an action that is not
-- completed must not carry a completion date. Enforced here so no code path
-- can produce a half-finished record.
ALTER TABLE "upgrade_action"
  ADD CONSTRAINT "upgrade_action_completed_date_check"
  CHECK (
    (status = 'COMPLETED' AND completed_date IS NOT NULL)
    OR (status <> 'COMPLETED' AND completed_date IS NULL)
  );

-- At most one primary owner per deployment.
CREATE UNIQUE INDEX "deployment_owner_one_primary"
  ON "deployment_owner" ("deployment_id")
  WHERE is_primary;

-- ---------------------------------------------------------------------------
-- v_cycle_status — objective lifecycle facts, one row per technology cycle.
--
-- Deliberately contains no "approaching" threshold: 180 days is policy, lives
-- in STATUS_APPROACHING_DAYS, and is applied in src/lifecycle/. Freezing it
-- here would give the same rule two sources of truth.
-- ---------------------------------------------------------------------------
CREATE VIEW v_cycle_status AS
SELECT c.id                             AS technology_cycle_id,
       c.technology_id,
       t.name                           AS technology_name,
       t.component_type,
       c.cycle,
       c.eol_date,
       c.active_support_end,
       c.is_lts,
       c.latest_patch,
       c.eol_source,
       (c.eol_date - CURRENT_DATE)      AS days_to_eol,
       (c.eol_date IS NULL)             AS is_unknown,
       (c.eol_date IS NOT NULL
        AND c.eol_date <= CURRENT_DATE)  AS is_eol
FROM technology_cycle c
JOIN technology t ON t.id = c.technology_id
WHERE t.archived_at IS NULL;

-- ---------------------------------------------------------------------------
-- v_deployment_effective_component — what a deployment actually runs.
--
-- A deployment runs the components of its Lime version, plus its own
-- overrides; where both name the same technology, the override wins. That rule
-- is needed by impact, customer components, the dashboard, the inbox and the
-- notification job, so it is defined once, here, rather than five times in
-- application code. DISTINCT ON keeps the highest-priority row per
-- (deployment, technology).
-- ---------------------------------------------------------------------------
CREATE VIEW v_deployment_effective_component AS
SELECT DISTINCT ON (src.deployment_id, src.technology_id)
       src.deployment_id,
       src.technology_id,
       src.technology_cycle_id,
       src.tech_version_id,
       src.source
FROM (
  -- Explicit overrides win.
  SELECT dc.deployment_id,
         c.technology_id,
         v.technology_cycle_id,
         v.id          AS tech_version_id,
         'OVERRIDE'    AS source,
         0             AS priority
  FROM deployment_component dc
  JOIN technology_version v ON v.id = dc.tech_version_id
  JOIN technology_cycle   c ON c.id = v.technology_cycle_id

  UNION ALL

  -- Otherwise the Lime version's default component set applies.
  SELECT d.id          AS deployment_id,
         c.technology_id,
         v.technology_cycle_id,
         v.id          AS tech_version_id,
         'LIME_DEFAULT' AS source,
         1             AS priority
  FROM deployment d
  JOIN lime_version_component lvc ON lvc.lime_version_id = d.lime_version_id
  JOIN technology_version v ON v.id = lvc.tech_version_id
  JOIN technology_cycle   c ON c.id = v.technology_cycle_id
) src
JOIN deployment d ON d.id = src.deployment_id AND d.archived_at IS NULL
ORDER BY src.deployment_id, src.technology_id, src.priority;
