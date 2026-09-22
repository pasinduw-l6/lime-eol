-- CreateEnum
CREATE TYPE "ComponentChangeType" AS ENUM ('INSTALL', 'UPGRADE', 'DOWNGRADE', 'REMOVE');

-- CreateTable
CREATE TABLE "component_change" (
    "id" UUID NOT NULL,
    "deployment_id" UUID NOT NULL,
    "technology_id" UUID NOT NULL,
    "from_version_id" UUID,
    "to_version_id" UUID,
    "from_version" TEXT,
    "to_version" TEXT,
    "change_type" "ComponentChangeType" NOT NULL,
    "effective_at" DATE NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" UUID,
    "note" TEXT,

    CONSTRAINT "component_change_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "component_change_deployment_id_effective_at_idx" ON "component_change"("deployment_id", "effective_at");

-- CreateIndex
CREATE INDEX "component_change_technology_id_effective_at_idx" ON "component_change"("technology_id", "effective_at");

-- AddForeignKey
ALTER TABLE "component_change" ADD CONSTRAINT "component_change_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_change" ADD CONSTRAINT "component_change_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technology"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_change" ADD CONSTRAINT "component_change_from_version_id_fkey" FOREIGN KEY ("from_version_id") REFERENCES "technology_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_change" ADD CONSTRAINT "component_change_to_version_id_fkey" FOREIGN KEY ("to_version_id") REFERENCES "technology_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_change" ADD CONSTRAINT "component_change_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

