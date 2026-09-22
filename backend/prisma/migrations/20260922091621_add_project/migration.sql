-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ONBOARDING', 'PAUSED');

-- DropIndex
DROP INDEX "deployment_customer_id_name_environment_key";

-- AlterTable
ALTER TABLE "deployment" ADD COLUMN     "project_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "project" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "lime_version" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" DATE,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_engineer" (
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_lead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_engineer_pkey" PRIMARY KEY ("project_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_code_key" ON "project"("code");

-- CreateIndex
CREATE INDEX "project_customer_id_idx" ON "project"("customer_id");

-- CreateIndex
CREATE INDEX "project_engineer_user_id_idx" ON "project_engineer"("user_id");

-- CreateIndex
CREATE INDEX "deployment_project_id_idx" ON "deployment"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "deployment_project_id_environment_key" ON "deployment"("project_id", "environment");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_engineer" ADD CONSTRAINT "project_engineer_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_engineer" ADD CONSTRAINT "project_engineer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

